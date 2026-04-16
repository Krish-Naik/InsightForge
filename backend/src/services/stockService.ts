import { yahooProvider } from '../providers/yahooProvider.js';
import { cache, TTL } from '../cache/redis.js';
import { NewsService } from '../services/news.js';
import type { ChartBar, Fundamentals, InsightSignal, NewsItem, NormalizedStockData, Quote } from '../providers/index.js';

function calculateRsi(closes: number[], period = 14): number {
  if (closes.length < 2) return 50;
  const deltas = closes.slice(1).map((v, i) => v - closes[i]);
  const gains = deltas.filter(d => d > 0);
  const losses = deltas.filter(d => d < 0).map(Math.abs);
  const avgGain = gains.length ? gains.reduce((a, b) => a + b, 0) / gains.length : 0;
  const avgLoss = losses.length ? losses.reduce((a, b) => a + b, 0) / losses.length : 0;
  if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

function calculateSma(values: number[], period: number): number {
  if (!values.length) return 0;
  const window = values.slice(-Math.min(period, values.length));
  return window.reduce((a, b) => a + b, 0) / window.length;
}

function generateInsights(closes: number[], volumeRatio: number, price: number, sma20: number, sma50: number): InsightSignal[] {
  const insights: InsightSignal[] = [];
  const rsi = calculateRsi(closes);
  
  if (rsi < 30) {
    insights.push({ type: 'oversold', label: 'Oversold', strength: Math.round(100 - rsi), description: `RSI at ${rsi.toFixed(0)} suggests oversold conditions` });
  } else if (rsi > 70) {
    insights.push({ type: 'overbought', label: 'Overbought', strength: Math.round(rsi), description: `RSI at ${rsi.toFixed(0)} suggests overbought conditions` });
  }

  if (volumeRatio >= 1.5) {
    insights.push({ type: 'volume_spike', label: 'High Volume', strength: Math.round(volumeRatio * 30), description: `Volume at ${volumeRatio.toFixed(1)}x average` });
  }

  if (sma20 > sma50 && price > sma20) {
    insights.push({ type: 'bullish_ma', label: 'Bullish MA', strength: 75, description: 'Price above SMA20 which is above SMA50' });
  } else if (sma20 < sma50 && price < sma20) {
    insights.push({ type: 'bearish_ma', label: 'Bearish MA', strength: 75, description: 'Price below SMA20 which is below SMA50' });
  }

  return insights;
}

export class StockService {
  static async getOverview(symbol: string): Promise<NormalizedStockData['header'] | null> {
    const cacheKey = `stock:${symbol}:overview`;
    const cached = await cache.get<NormalizedStockData['header']>(cacheKey);
    if (cached) return cached;

    const quote = await yahooProvider.getQuote(symbol);
    if (!quote || quote.price === 0) return null;

    await cache.set(cacheKey, quote, TTL.PRICE);
    return quote;
  }

  static async getChart(symbol: string, period: string = '1mo'): Promise<ChartBar[]> {
    const cacheKey = `stock:${symbol}:chart:${period}`;
    const cached = await cache.get<ChartBar[]>(cacheKey);
    if (cached) return cached;

    const chart = await yahooProvider.getChart(symbol, period);
    if (chart.length) {
      await cache.set(cacheKey, chart, TTL.CHART);
    }
    return chart;
  }

  static async getFundamentals(symbol: string): Promise<Fundamentals | null> {
    const cacheKey = `stock:${symbol}:fundamentals`;
    const cached = await cache.get<Fundamentals>(cacheKey);
    if (cached) return cached;

    const fundamentals = await yahooProvider.getFundamentals(symbol);
    if (fundamentals) {
      await cache.set(cacheKey, fundamentals, TTL.FUNDAMENTALS);
    }
    return fundamentals;
  }

  static async getNews(symbol?: string, limit = 20): Promise<NewsItem[]> {
    const cacheKey = symbol ? `stock:${symbol}:news` : 'market:news';
    const cached = await cache.get<NewsItem[]>(cacheKey);
    if (cached) return cached;

    const news = await yahooProvider.getNews(symbol);
    const allNews = news.length ? news : await NewsService.getCuratedNews('all', undefined, limit);
    
    const filtered = symbol 
      ? allNews.filter(n => n.relatedStocks.includes(symbol.toUpperCase()))
      : allNews;
    
    await cache.set(cacheKey, filtered, TTL.NEWS);
    return filtered.slice(0, limit);
  }

  static async getInsights(symbol: string): Promise<InsightSignal[]> {
    const cacheKey = `stock:${symbol}:insights`;
    const cached = await cache.get<InsightSignal[]>(cacheKey);
    if (cached) return cached;

    const chart = await this.getChart(symbol, '3mo');
    const quote = await this.getOverview(symbol);
    
    if (!quote || !chart.length) return [];

    const closes = chart.map(b => b.close).filter(c => c > 0);
    const volumes = chart.map(b => b.volume).filter(v => v > 0);
    const sma20 = calculateSma(closes, 20);
    const sma50 = calculateSma(closes, 50);
    const avgVolume = calculateSma(volumes, 20);
    const volumeRatio = avgVolume > 0 ? quote.volume / avgVolume : 1;

    const insights = generateInsights(closes, volumeRatio, quote.price, sma20, sma50);
    
    await cache.set(cacheKey, insights, TTL.PRICE);
    return insights;
  }

  static async getFullData(symbol: string): Promise<NormalizedStockData | null> {
    const [header, chart, fundamentals, news, insights] = await Promise.all([
      this.getOverview(symbol),
      this.getChart(symbol),
      this.getFundamentals(symbol),
      this.getNews(symbol),
      this.getInsights(symbol),
    ]);

    if (!header) return null;

    const closes = chart.map(b => b.close).filter(c => c > 0);
    const sma20 = calculateSma(closes, 20);
    const sma50 = calculateSma(closes, 50);
    const turnover = header.price * header.volume;

    const stats = {
      momentumScore: 0,
      rsi14: calculateRsi(closes),
      volumeRatio: 1,
      sma20,
      sma50,
      turnover,
      dayRangePercent: header.price > 0 ? ((header.dayHigh - header.dayLow) / header.price) * 100 : 0,
      week52RangePosition: header.high52w > header.low52w 
        ? ((header.price - header.low52w) / (header.high52w - header.low52w)) * 100 
        : 0,
      trend: header.changePercent >= 0 ? 'bullish' : 'bearish',
    };

    return {
      header,
      chart,
      stats,
      fundamentals: fundamentals || {
        sector: 'Unclassified',
        industry: 'Equity',
        peRatio: null,
        forwardPe: null,
        priceToBook: null,
        dividendYield: null,
        beta: null,
        revenueGrowth: null,
        profitMargins: null,
        targetMeanPrice: null,
      },
      news,
      insights,
      extra: {},
    };
  }
}
