import axios from 'axios';
import { clearStoredAuthSession, getStoredAuthSession } from './authStorage';

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
    if (err.response?.status === 401) {
      clearStoredAuthSession();
    }

    const msg =
      err.response?.data?.error ||
      err.response?.data?.message ||
      err.message ||
      'Request failed';
    return Promise.reject(new Error(msg));
  }
);

api.interceptors.request.use((request) => {
  if (typeof window === 'undefined') return request;
  if (request.headers?.Authorization) return request;

  const session = getStoredAuthSession();
  if (session?.token) {
    request.headers = request.headers || {};
    request.headers.Authorization = `Bearer ${session.token}`;
  }

  return request;
});

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
  peRatio?: number | null;
  forwardPe?: number | null;
  priceToBook?: number | null;
  dividendYield?: number | null;
  beta?: number | null;
  revenueGrowth?: number | null;
  profitMargins?: number | null;
  targetMeanPrice?: number | null;
  rsi14?: number;
  sma20?: number;
  sma50?: number;
  volumeRatio?: number;
  trend?: 'bullish' | 'bearish' | 'neutral';
}

export interface SectorOverview {
  sector: string;
  trend: 'bullish' | 'bearish' | 'neutral';
  averageChangePercent: number;
  breadth: number;
  bullishCount: number;
  bearishCount: number;
  stockCount: number;
  sampleSize: number;
  leader: Quote | null;
  laggard: Quote | null;
  stocks: Quote[];
  lastUpdated: string;
}

export interface ResearchProfile {
  symbol: string;
  name: string;
  exchange: string;
  sectors: string[];
  primarySector: string;
  industry?: string;
  isin?: string;
  aliases: string[];
  inNifty50: boolean;
  narrative: string;
  dataNotes: string[];
}

export interface StockResearch {
  profile: ResearchProfile;
  quote: Quote | null;
  analytics: ScreenerMetric | null;
  sectorOverview: SectorOverview | null;
  peers: ScreenerMetric[];
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

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

export interface AuthSession {
  user: AuthUser;
  token: string;
  workspace?: boolean;
}

export interface WatchlistStockRecord {
  _id?: string;
  symbol: string;
  name?: string;
  exchange: string;
}

export interface WatchlistRecord {
  _id: string;
  name: string;
  stocks: WatchlistStockRecord[];
  createdAt?: string;
  updatedAt?: string;
}

export interface PortfolioHoldingRecord {
  _id?: string;
  symbol: string;
  name?: string;
  qty: number;
  avgPrice: number;
  currentPrice?: number;
  sector?: string;
  exchange?: string;
}

export interface PortfolioRecord {
  _id: string;
  name: string;
  holdings: PortfolioHoldingRecord[];
  createdAt?: string;
  updatedAt?: string;
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
  getAllSectorsData: (): Promise<SectorOverview[]>             => api.get('/market/sectors/all'),
  getSectorAnalytics: (sector: string, limit = 40): Promise<ScreenerMetric[]> =>
    api.get(`/market/sectors/${encodeURIComponent(sector)}/analytics?limit=${limit}`),
  getSectorStocks: (sector: string): Promise<Quote[]> =>
    api.get(`/market/sectors/${encodeURIComponent(sector)}/stocks`),
  getStockResearch: (symbol: string): Promise<StockResearch> =>
    api.get(`/market/research/${encodeURIComponent(symbol)}`),
  getCatalog:       (): Promise<MarketCatalog>                    => api.get('/market/catalog'),
  getNiftyStocks:   (): Promise<string[]>                          => api.get('/market/nifty-stocks'),
  getNews:          (filter = 'all', category?: string, limit = 25): Promise<NewsItem[]> => {
    let url = `/market/news?filter=${filter}&limit=${limit}`;
    if (category && category !== 'All') url += `&category=${category}`;
    return api.get(url);
  },
};

export const authAPI = {
  bootstrapWorkspace: (workspaceId: string, name?: string): Promise<AuthSession> =>
    api.post('/auth/workspace', { workspaceId, name }),
  getMe: (): Promise<{ user: AuthUser }> => api.get('/auth/me'),
};

export const watchlistAPI = {
  getAll: (): Promise<WatchlistRecord[]> => api.get('/watchlists'),
  create: (name: string): Promise<WatchlistRecord> => api.post('/watchlists', { name }),
  rename: (id: string, name: string): Promise<WatchlistRecord> => api.put(`/watchlists/${id}`, { name }),
  delete: (id: string): Promise<{ message: string }> => api.delete(`/watchlists/${id}`),
  addStock: (id: string, payload: { symbol: string; name: string; exchange: string }): Promise<WatchlistRecord> =>
    api.post(`/watchlists/${id}/stocks`, payload),
  removeStock: (id: string, symbol: string): Promise<WatchlistRecord> =>
    api.delete(`/watchlists/${id}/stocks/${encodeURIComponent(symbol)}`),
};

export const portfolioAPI = {
  getAll: (): Promise<PortfolioRecord[]> => api.get('/portfolios'),
  create: (name: string): Promise<PortfolioRecord> => api.post('/portfolios', { name }),
  rename: (id: string, name: string): Promise<PortfolioRecord> => api.put(`/portfolios/${id}`, { name }),
  delete: (id: string): Promise<{ message: string }> => api.delete(`/portfolios/${id}`),
  addHolding: (
    id: string,
    payload: { symbol: string; name: string; qty: number; avgPrice: number; sector?: string; exchange?: string },
  ): Promise<PortfolioRecord> => api.post(`/portfolios/${id}/holdings`, payload),
  removeHolding: (id: string, holdingId: string): Promise<PortfolioRecord> =>
    api.delete(`/portfolios/${id}/holdings/${holdingId}`),
};

export default api;
