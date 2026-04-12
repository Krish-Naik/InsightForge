import axios from 'axios';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';
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

interface NewsApiArticle {
  title?: string;
  description?: string;
  url?: string;
  publishedAt?: string;
  source?: { name?: string };
}

interface NewsApiResponse {
  status: string;
  articles?: NewsApiArticle[];
}

interface CachedNewsState {
  data: NewsItem[];
  ts: number;
}

const NEWS_CACHE_TTL = 10 * 60 * 1000;
let _cache: CachedNewsState | null = null;

function makeNews(): NewsItem[] {
  const now = new Date();
  const minutesAgo = (mins: number) => new Date(now.getTime() - mins * 60 * 1000).toISOString();
  return [
    { id: '1', title: 'NIFTY 50 hits fresh 52-week high on strong FII inflows', source: 'Economic Times', time: minutesAgo(8), category: 'Markets', sentiment: 'bullish', summary: 'The benchmark index rallied 1.2% led by banking and IT heavyweights as FIIs turned net buyers after three weeks of selling.', relatedStocks: ['HDFCBANK', 'ICICIBANK', 'TCS'], url: 'https://economictimes.indiatimes.com' },
    { id: '2', title: 'RBI holds repo rate at 6.25% — signals possible cut in June policy', source: 'Moneycontrol', time: minutesAgo(35), category: 'Economy', sentiment: 'bullish', summary: 'The RBI maintained status quo but changed stance to "accommodative", hinting at rate cuts as inflation eases toward 4% target.', relatedStocks: ['SBIN', 'HDFCBANK', 'KOTAKBANK'], url: 'https://moneycontrol.com' },
    { id: '3', title: 'IT sector faces headwinds as US tech spending slows in Q1', source: 'Business Standard', time: minutesAgo(90), category: 'Sector', sentiment: 'bearish', summary: 'Indian IT majors TCS and Infosys face near-term pressure as clients trim discretionary tech spending. Analysts cut FY26 estimates by 3-5%.', relatedStocks: ['TCS', 'INFY', 'WIPRO', 'HCLTECH'], url: 'https://business-standard.com' },
    { id: '4', title: 'Reliance Industries eyes $10B green energy capex over next 3 years', source: 'LiveMint', time: minutesAgo(150), category: 'Corporate', sentiment: 'bullish', summary: 'Reliance plans massive green hydrogen and solar capacity additions, positioning for India energy transition at unmatched scale.', relatedStocks: ['RELIANCE'], url: 'https://livemint.com' },
    { id: '5', title: 'SEBI tightens algo trading rules for retail investors', source: 'NDTV Profit', time: minutesAgo(210), category: 'Regulation', sentiment: 'neutral', summary: 'SEBI has proposed new guardrails for retail algo traders, requiring API providers to register and comply with stricter risk management norms.', relatedStocks: [], url: 'https://ndtvprofit.com' },
    { id: '6', title: 'Tata Motors EV deliveries surge 40% YoY — Nexon tops charts again', source: 'Economic Times', time: minutesAgo(300), category: 'Corporate', sentiment: 'bullish', summary: 'Tata Motors reported record EV deliveries for March quarter. Management guides for 35% volume growth in FY27.', relatedStocks: ['TATAMOTORS'], url: 'https://economictimes.indiatimes.com' },
    { id: '7', title: 'Metal stocks tank as China factory data disappoints', source: 'Moneycontrol', time: minutesAgo(420), category: 'Sector', sentiment: 'bearish', summary: 'Tata Steel and JSW Steel fell 4-5% after China PMI missed expectations, raising concerns about global steel demand.', relatedStocks: ['TATASTEEL', 'JSWSTEEL', 'HINDALCO'], url: 'https://moneycontrol.com' },
    { id: '8', title: 'Sun Pharma bags USFDA nod for key oncology drug', source: 'Business Standard', time: minutesAgo(600), category: 'Corporate', sentiment: 'bullish', summary: 'Sun Pharma received USFDA approval for generic oncology formulation expected to generate $150M annual revenue.', relatedStocks: ['SUNPHARMA'], url: 'https://business-standard.com' },
    { id: '9', title: 'FII buying crosses Rs 15,000 Cr in April — DII flows also positive', source: 'LiveMint', time: minutesAgo(780), category: 'Markets', sentiment: 'bullish', summary: 'Sustained buying by FIIs and DIIs has pushed market breadth to multi-month highs with advance-decline ratio at 3:1.', relatedStocks: [], url: 'https://livemint.com' },
    { id: '10', title: 'HDFC Bank Q4 results: NIM pressure persists, loan growth steady', source: 'Economic Times', time: minutesAgo(960), category: 'Corporate', sentiment: 'neutral', summary: 'Q4 numbers were in-line. Net interest margins compressed by 10bps QoQ while loan book grew 14% YoY.', relatedStocks: ['HDFCBANK'], url: 'https://economictimes.indiatimes.com' },
    { id: '11', title: 'Adani Group completes $3.5B overseas bond raise at tight spreads', source: 'NDTV Profit', time: minutesAgo(1200), category: 'Corporate', sentiment: 'bullish', summary: 'Adani Group successfully raised $3.5 billion through international bonds, demonstrating improved investor confidence.', relatedStocks: ['ADANIENT', 'ADANIPORTS'], url: 'https://ndtvprofit.com' },
    { id: '12', title: 'Pharma sector outperforms as rupee weakens against dollar', source: 'Moneycontrol', time: minutesAgo(1440), category: 'Sector', sentiment: 'bullish', summary: 'Export-oriented pharma companies gained 2-3% as rupee slipped to 84.2 vs USD. Sun Pharma, Dr Reddy and Cipla led.', relatedStocks: ['SUNPHARMA', 'DRREDDY', 'CIPLA'], url: 'https://business-standard.com' },
  ];
}

function inferCategory(text: string): string {
  const normalized = text.toLowerCase();
  if (/(rbi|inflation|repo|gdp|policy|economy)/.test(normalized)) return 'Economy';
  if (/(nifty|sensex|market|fii|dii|index|stock)/.test(normalized)) return 'Markets';
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
    const matchesName = stock.name.toLowerCase().includes(normalized) || normalized.includes(stock.name.toLowerCase());
    const matchesSymbol = normalized.includes(stock.symbol.toLowerCase());
    const matchesAlias = stock.aliases.some((alias) => normalized.includes(alias.toLowerCase()));
    return matchesName || matchesSymbol || matchesAlias;
  }).slice(0, 5).map((stock) => stock.symbol);
}

function mapArticle(article: NewsApiArticle, index: number): NewsItem | null {
  if (!article.title || !article.url || !article.publishedAt) return null;

  const summary = article.description || article.title;
  const combinedText = `${article.title} ${summary}`;

  return {
    id: `news-${normalizeArticleId(article.url, index)}`,
    title: article.title,
    source: article.source?.name || 'News API',
    time: new Date(article.publishedAt).toISOString(),
    category: inferCategory(combinedText),
    sentiment: inferSentiment(combinedText),
    summary,
    relatedStocks: extractRelatedStocks(combinedText),
    url: article.url,
  };
}

function normalizeArticleId(url: string, index: number): string {
  return Buffer.from(`${url}:${index}`).toString('base64').replace(/[^A-Za-z0-9]/g, '').slice(0, 16);
}

async function fetchLiveNews(): Promise<NewsItem[]> {
  const response = await axios.get<NewsApiResponse>('https://newsapi.org/v2/top-headlines', {
    params: {
      apiKey: config.newsApiKey,
      category: 'business',
      country: 'in',
      pageSize: 30,
    },
    timeout: 10_000,
  });

  return (response.data.articles || [])
    .map(mapArticle)
    .filter((article): article is NewsItem => Boolean(article));
}

async function getNews(): Promise<NewsItem[]> {
  if (_cache && Date.now() - _cache.ts < NEWS_CACHE_TTL) return _cache.data;

  if (config.newsApiKey) {
    try {
      const liveNews = await fetchLiveNews();
      if (liveNews.length > 0) {
        _cache = { data: liveNews, ts: Date.now() };
        return liveNews;
      }
    } catch (error) {
      logger.warn(`News API fetch failed: ${(error as Error).message}`);
    }
  }

  if (config.demoMode) {
    const demoNews = makeNews();
    _cache = { data: demoNews, ts: Date.now() };
    return demoNews;
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