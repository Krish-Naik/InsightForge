import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { logger } from '../utils/logger.js';
import { MARKET_STOCKS } from '../data/marketCatalog.js';

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  time: string;
  category: string;
  sentiment: string;
  summary: string;
  relatedStocks: string[];
  url: string;
}

interface RssFeedItem {
  title?: string;
  link?: string;
  pubDate?: string;
  description?: string;
  source?: string | { '#text'?: string; text?: string };
}

interface RssFeedResponse {
  rss?: {
    channel?: {
      item?: RssFeedItem | RssFeedItem[];
    };
  };
}

interface CachedNewsState {
  data: NewsItem[];
  ts: number;
}

const NEWS_CACHE_TTL = 10 * 60 * 1000;
let _cache: CachedNewsState | null = null;

const RSS_FEEDS = [
  'https://news.google.com/rss/search?q=Indian+stock+market+when:1d&hl=en-IN&gl=IN&ceid=IN:en',
  'https://news.google.com/rss/search?q=NSE+OR+BSE+stocks+India+when:1d&hl=en-IN&gl=IN&ceid=IN:en',
  'https://news.google.com/rss/search?q=RBI+OR+FII+OR+DII+markets+India+when:1d&hl=en-IN&gl=IN&ceid=IN:en',
  'https://economictimes.indiatimes.com/markets/stocks/rssfeedsok.ms?color=1',
  'https://moneycontrol.com/rss/mcci.xml',
];

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  textNodeName: 'text',
});

function inferCategory(text: string): string {
  const normalized = text.toLowerCase();
  if (/(rbi|inflation|repo|gdp|policy|economy)/.test(normalized)) return 'Economy';
  if (/(nifty|sensex|market|fii|dii|index|stock)/.test(normalized)) return 'Markets';
  if (/(bank|it|pharma|auto|metal|energy|fmcg|realty|infra|telecom|nbfc|sector)/.test(normalized)) return 'Sector';
  if (/(sebi|regulator|rule|compliance|regulation)/.test(normalized)) return 'Regulation';
  if (/(global|fed|china|us |europe|asia|oil|dollar)/.test(normalized)) return 'Global';
  return 'Corporate';
}

function inferSentiment(text: string): 'bullish' | 'bearish' | 'neutral' {
  const normalized = text.toLowerCase();
  if (/(surge|rally|beat|approval|gain|growth|high|record|jump|buyback|bullish|upgrade)/.test(normalized)) return 'bullish';
  if (/(fall|drop|tank|slow|cut|downgrade|bearish|miss|pressure|volatile|selloff)/.test(normalized)) return 'bearish';
  return 'neutral';
}

function extractRelatedStocks(text: string): string[] {
  const normalized = text.toLowerCase();
  return MARKET_STOCKS.filter((stock) => {
    const matchesName = normalized.includes(stock.name.toLowerCase());
    const matchesSymbol = normalized.includes(stock.symbol.toLowerCase());
    const matchesAlias = stock.aliases.some((alias) => normalized.includes(alias.toLowerCase()));
    return matchesName || matchesSymbol || matchesAlias;
  }).slice(0, 5).map((stock) => stock.symbol);
}

function stripHtml(value: string): string {
  return value
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeSource(itemSource: RssFeedItem['source'], title: string): string {
  if (typeof itemSource === 'string' && itemSource.trim()) return itemSource.trim();
  if (typeof itemSource === 'object') {
    const value = itemSource['#text'] || itemSource.text;
    if (value?.trim()) return value.trim();
  }

  const titleParts = title.split(' - ');
  if (titleParts.length > 1) return titleParts[titleParts.length - 1].trim();
  return 'Market Feed';
}

function normalizeRssTitle(title: string): string {
  const parts = title.split(' - ');
  if (parts.length > 1) return parts.slice(0, -1).join(' - ').trim();
  return title.trim();
}

function dedupeNews(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  const deduped: NewsItem[] = [];

  for (const item of items) {
    const key = `${item.url}|${item.title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  return deduped;
}

function mapRssItem(article: RssFeedItem, index: number): NewsItem | null {
  if (!article.title || !article.link || !article.pubDate) return null;

  const title = normalizeRssTitle(stripHtml(article.title));
  const summary = stripHtml(article.description || article.title);
  const combinedText = `${title} ${summary}`;

  return {
    id: `rss-${normalizeArticleId(article.link, index)}`,
    title,
    source: normalizeSource(article.source, article.title),
    time: new Date(article.pubDate).toISOString(),
    category: inferCategory(combinedText),
    sentiment: inferSentiment(combinedText),
    summary,
    relatedStocks: extractRelatedStocks(combinedText),
    url: article.link,
  };
}

function normalizeArticleId(url: string, index: number): string {
  return Buffer.from(`${url}:${index}`).toString('base64').replace(/[^A-Za-z0-9]/g, '').slice(0, 16);
}

async function fetchRssNews(): Promise<NewsItem[]> {
  const feeds = await Promise.allSettled(
    RSS_FEEDS.map((url) => axios.get<string>(url, { timeout: 10_000, responseType: 'text' })),
  );

  const items: NewsItem[] = [];
  feeds.forEach((result, feedIndex) => {
    if (result.status !== 'fulfilled') {
      logger.warn(`RSS feed ${feedIndex + 1} failed: ${result.reason instanceof Error ? result.reason.message : 'unknown error'}`);
      return;
    }

    try {
      const parsed = xmlParser.parse(result.value.data) as RssFeedResponse;
      const rawItems = parsed.rss?.channel?.item;
      const entries = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];
      items.push(
        ...entries
          .map((entry, entryIndex) => mapRssItem(entry, feedIndex * 100 + entryIndex))
          .filter((entry): entry is NewsItem => Boolean(entry)),
      );
    } catch (error) {
      logger.warn(`RSS parse failed: ${(error as Error).message}`);
    }
  });

  return items;
}

async function getNews(): Promise<NewsItem[]> {
  if (_cache && Date.now() - _cache.ts < NEWS_CACHE_TTL) return _cache.data;

  const merged = dedupeNews(await fetchRssNews())
    .sort((left, right) => new Date(right.time).getTime() - new Date(left.time).getTime())
    .slice(0, 40);

  if (merged.length > 0) {
    _cache = { data: merged, ts: Date.now() };
    return merged;
  }

  return [];
}

export class NewsService {
  static async getCuratedNews(filter = 'all', category: string | null = null, limit = 20): Promise<NewsItem[]> {
    let news = await getNews();
    if (filter !== 'all') news = news.filter(n => n.sentiment === filter);
    if (category && category !== 'all') news = news.filter(n => n.category.toLowerCase() === category.toLowerCase());
    return news
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, limit);
  }
  static async getCategories(): Promise<string[]> { return [...new Set((await getNews()).map(n => n.category))]; }
  static getSources(): { name: string }[] { return [{ name: 'Economic Times' }, { name: 'Moneycontrol' }, { name: 'Business Standard' }, { name: 'LiveMint' }, { name: 'NDTV Profit' }]; }
}