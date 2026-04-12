import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

const MAX_BATCH_SIZE = 50;

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

api.interceptors.response.use(
  (res) => (res.data?.data !== undefined ? res.data.data : res.data) as any,
  (err) => {
    const msg =
      err.response?.data?.error ||
      err.response?.data?.message ||
      err.message ||
      'Request failed';
    return Promise.reject(new Error(msg));
  }
);

export interface Quote {
  symbol: string; name: string; price: number; change: number;
  changePercent: number; volume: number; dayHigh: number; dayLow: number;
  previousClose: number; open: number; high52w: number; low52w: number;
  marketCap: number; currency: string; marketState: string; exchange: string;
  timestamp: string;
}

export interface Index extends Quote {
  shortName: string; rawSymbol: string;
}

export interface NewsItem {
  id: string; title: string; summary: string; source: string;
  url: string; time: string; sentiment: 'bullish' | 'bearish' | 'neutral';
  category: string; relatedStocks: string[];
}

export interface ScreenerMetric {
  symbol: string;
  name: string;
  sector: string;
  industry: string;
  exchange: string;
  currentPrice: number;
  changePercent: number;
  volume: number;
  turnover: number;
  dayRangePercent: number;
  week52RangePosition: number;
  distanceFromHigh52: number;
  distanceFromLow52: number;
  momentumScore: number;
  liquidityScore: number;
  high52: number;
  low52: number;
  inNifty50: boolean;
}

export interface HistoricalBar {
  date: string; open: number; high: number; low: number;
  close: number; volume: number;
}

export interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
  sectors?: string[];
  inNifty50?: boolean;
}

export interface CatalogIndex {
  name: string;
  shortName: string;
  aliases: string[];
}

export interface CatalogStock {
  symbol: string;
  name: string;
  sectors: string[];
  aliases: string[];
  inNifty50: boolean;
  exchange: string;
}

export interface MarketCatalog {
  indices: CatalogIndex[];
  stocks: CatalogStock[];
  sectors: Record<string, string[]>;
  nifty50: string[];
}

export const marketAPI = {
  getIndices:       (): Promise<Index[]>                          => api.get('/market/indices'),
  getMarketSummary: (): Promise<any>                              => api.get('/market/summary'),
  getMarketMovers:  (type = 'gainers', count = 10): Promise<Quote[]> =>
    api.get(`/market/movers?type=${type}&count=${count}`),
  getQuotes:        async (symbols: string[]): Promise<Quote[]>   => {
    const uniqueSymbols = [...new Set(symbols.filter(Boolean))];
    if (!uniqueSymbols.length) return [];

    const batches = chunk(uniqueSymbols, MAX_BATCH_SIZE);
    const responses = await Promise.all(
      batches.map((batch) => api.get(`/market/quotes?symbols=${encodeURIComponent(batch.join(','))}`) as Promise<Quote[]>)
    );

    return responses.flat();
  },
  getQuote:         (symbol: string): Promise<Quote>            =>
    api.get(`/market/quote/${encodeURIComponent(symbol)}`),
  searchStocks:     (q: string): Promise<SearchResult[]>         =>
    api.get(`/market/search?q=${encodeURIComponent(q)}`),
  getAnalytics:  async (symbols: string[]): Promise<ScreenerMetric[]>   => {
    const uniqueSymbols = [...new Set(symbols.filter(Boolean))];
    if (!uniqueSymbols.length) return [];

    const batches = chunk(uniqueSymbols, 25);
    const responses = await Promise.all(
      batches.map((batch) => api.get(`/market/analytics?symbols=${encodeURIComponent(batch.join(','))}`) as Promise<ScreenerMetric[]>)
    );

    return responses.flat();
  },
  getFundamentals:  async (symbols: string[]): Promise<ScreenerMetric[]> =>
    marketAPI.getAnalytics(symbols),
  getHistorical:    (symbol: string, period = '3mo'): Promise<HistoricalBar[]> =>
    api.get(`/market/historical/${encodeURIComponent(symbol)}?period=${period}`),
  getAllSectorsData: (): Promise<any>                          => api.get('/market/sectors/all'),
  getCatalog:       (): Promise<MarketCatalog>                    => api.get('/market/catalog'),
  getNiftyStocks:   (): Promise<string[]>                          => api.get('/market/nifty-stocks'),
  getNews:          (filter = 'all', category?: string, limit = 25): Promise<NewsItem[]> => {
    let url = `/market/news?filter=${filter}&limit=${limit}`;
    if (category && category !== 'All') url += `&category=${category}`;
    return api.get(url);
  },
};

export default api;
