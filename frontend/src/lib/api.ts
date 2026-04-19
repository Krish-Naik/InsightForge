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
  timestamp: string; isStale?: boolean;
}

export interface Index extends Quote {
  shortName: string; rawSymbol: string;
}

export interface NewsItem {
  id: string; title: string; summary: string; source: string;
  url: string; time: string; sentiment: 'bullish' | 'bearish' | 'neutral';
  category: string; relatedStocks: string[];
}

export interface MarketSummary {
  indices: Index[];
  gainers: Quote[];
  losers: Quote[];
  mostActive: Quote[];
  lastUpdated: string;
  marketStatus: string;
}

export type CapFilter = 'all' | 'largecap' | 'midcap' | 'smallcap';

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
  story?: StockStory | null;
}

export type InsightSourceMode = 'deterministic' | 'ai';
export type InsightTone = 'bullish' | 'bearish' | 'balanced' | 'neutral';
export type TradingHorizon = 'intraday' | 'swing';
export type OpportunityMode = 'momentum' | 'breakout' | 'pullback' | 'avoid' | 'sympathy' | 'guided';
export type Selectivity = 'conservative' | 'balanced' | 'aggressive';
export type OpportunityState = 'fresh' | 'building' | 'extended' | 'weakening';
export type ScreenerPlaybook = 'leadership' | 'quality' | 'pullback' | 'sympathy' | 'avoid';
export type ScreenerSort = 'score' | 'momentum' | 'volume' | 'breakout' | 'sector' | 'value';
export type SignalWindow = '5m' | '15m' | 'today';

export interface StoryTimelineEntry {
  label: string;
  detail: string;
  tone: InsightTone;
}

export interface ScoreComponent {
  label: string;
  contribution: number;
  detail: string;
}

export interface OpportunityCard {
  id: string;
  symbol: string;
  name: string;
  sector: string;
  setup: string;
  direction: 'bullish' | 'bearish' | 'neutral';
  whyNow: string;
  watchNext: string;
  risk: string;
  confidence: number;
  score: number;
  horizon: TradingHorizon;
  state: OpportunityState;
  triggerPrice: number | null;
  invalidationPrice: number | null;
  quote: Quote | null;
  analytics: ScreenerMetric | null;
  sectorTrend: SectorOverview['trend'];
  labels: string[];
  scoreBreakdown: ScoreComponent[];
}

export interface MarketNarrative {
  headline: string;
  summary: string;
  watchFor: string;
  risk: string;
  tone: InsightTone;
  strongestSector?: string;
  weakestSector?: string;
}

export interface SectorRotationInsight {
  sector: string;
  trend: SectorOverview['trend'];
  summary: string;
  breadthLabel: string;
  leaderSymbol?: string;
  laggardSymbol?: string;
  movement: 'accelerating' | 'cooling' | 'mixed';
}

export interface RecapCard {
  title: string;
  detail: string;
  tone: InsightTone;
  symbols: string[];
}

export interface InsightCoverage {
  sectorsScanned: number;
  universeStocks: number;
  stocksAnalyzed: number;
  matches: number;
}

export interface SectorScanInsight {
  sector: string;
  trend: SectorOverview['trend'];
  breadth: number;
  averageChangePercent: number;
  candidateCount: number;
  matchCount: number;
  leaderSymbol?: string;
  laggardSymbol?: string;
}

export interface RadarSignal {
  id: string;
  symbol?: string;
  sector: string;
  type: RadarSignalType;
  window: SignalWindow;
  tone: InsightTone;
  title: string;
  detail: string;
  strength: number;
  occurredAt: string;
}

export interface RadarWindowInsight {
  window: SignalWindow;
  label: string;
  summary: string;
  signalCount: number;
  leadingSymbol?: string;
  leadingSector?: string;
}

export interface SectorShiftSignal {
  sector: string;
  direction: 'strengthening' | 'weakening' | 'mixed';
  summary: string;
  breadth: number;
  averageChangePercent: number;
  signalCount: number;
  leaderSymbol?: string;
  laggardSymbol?: string;
}

export interface ScreenerFilters {
  minPrice?: number | null;
  maxPrice?: number | null;
  minMomentumScore?: number | null;
  minVolumeRatio?: number | null;
  maxRsi14?: number | null;
  minWeek52RangePosition?: number | null;
  maxDistanceFromHigh52?: number | null;
  maxPeRatio?: number | null;
  maxPriceToBook?: number | null;
  minRevenueGrowth?: number | null;
  minProfitMargins?: number | null;
  minDividendYield?: number | null;
  minRoe?: number | null;
}

// ── Radar engine types (Radar page only) ────────────────────────────────────
export type RadarSignalType =
  | 'breakout' | 'breakdown' | 'volume-spike'
  | 'rsi-oversold' | 'rsi-overbought' | 'momentum-surge' | 'reversal-watch';

export type RadarSignalStrength = 'strong' | 'moderate' | 'weak';
export type RadarSignalDirection = 'bullish' | 'bearish' | 'neutral';

export interface RadarSignalCard {
  id:             string;
  symbol:         string;
  name:           string;
  exchange:       string;
  signalType:     RadarSignalType;
  direction:      RadarSignalDirection;
  strength:       RadarSignalStrength;
  confidence:     number;
  price:          number;
  changePercent:  number;
  volume:         number;
  volumeRatio:    number;
  week52Position: number;
  rsiEstimate:    number;
  entryZone:      number | null;
  stopLoss:       number | null;
  target:         number | null;
  whyNow:         string;
  sector:         string;
  timestamp:      string;
}

export interface RadarSnapshot {
  breakouts:       RadarSignalCard[];
  breakdowns:      RadarSignalCard[];
  volumeSpikes:    RadarSignalCard[];
  rsiOversold:     RadarSignalCard[];
  rsiOverbought:   RadarSignalCard[];
  momentumSurge:   RadarSignalCard[];
  reversalWatch:   RadarSignalCard[];
  marketAvgVolume: number;
  generatedAt:     string;
  totalSignals:    number;
}

export interface SupportResistanceLevel {
  symbol:     string;
  price:      number;
  support:    number;
  resistance: number;
  pivotHigh:  number;
  pivotLow:   number;
  trend:      'uptrend' | 'downtrend' | 'sideways';
}

export interface ScreenerFilterSummary {
  label: string;
  value: string;
}

export interface ScreenerDiagnostics {
  activeFilters: ScreenerFilterSummary[];
  filteredOut: number;
  baseMatches: number;
  fieldCoverage: {
    peRatio: number;
    priceToBook: number;
    revenueGrowth: number;
    profitMargins: number;
  };
  notes: string[];
}

export interface TodayDesk {
  narrative: MarketNarrative;
  sectorRotation: SectorRotationInsight[];
  opportunityStack: OpportunityCard[];
  stocksToWatch: OpportunityCard[];
  recap: RecapCard[];
  generatedAt: string;
  sourceMode: InsightSourceMode;
}

export interface RadarResponse {
  mode: OpportunityMode;
  horizon: TradingHorizon;
  selectivity: Selectivity;
  narrative: string;
  coverage: InsightCoverage;
  sectorFocus: SectorScanInsight[];
  signalFeed: RadarSignal[];
  windowInsights: RadarWindowInsight[];
  sectorShifts: SectorShiftSignal[];
  opportunities: OpportunityCard[];
  refreshIntervalSeconds: number;
  generatedAt: string;
  sourceMode: InsightSourceMode;
}

export interface GuidedScreenerResponse {
  playbook: ScreenerPlaybook;
  horizon: TradingHorizon;
  selectivity: Selectivity;
  sortBy: ScreenerSort;
  sector: string | 'all';
  filters: ScreenerFilters;
  narrative: string;
  coverage: InsightCoverage;
  sectorFocus: SectorScanInsight[];
  diagnostics: ScreenerDiagnostics;
  opportunities: OpportunityCard[];
  generatedAt: string;
  sourceMode: InsightSourceMode;
}

export interface StockStory {
  stance: 'strong' | 'early' | 'extended' | 'weak' | 'mixed';
  horizonFit: TradingHorizon | 'watch-only';
  summary: string;
  whyMoving: {
    primary: string;
    secondary: string;
    confidence: number;
    evidence: string[];
    watchNext: string;
    risk: string;
  };
  setupMap: {
    trigger: string;
    invalidation: string;
    support: string;
    resistance: string;
    stage: OpportunityState | 'ready';
  };
  bullCase: string[];
  bearCase: string[];
  timeline: StoryTimelineEntry[];
  generatedAt: string;
  sourceMode: InsightSourceMode;
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
  getMarketSummary: (): Promise<MarketSummary>                    => api.get('/market/summary'),
  getTodayDesk: (): Promise<TodayDesk>                            => api.get('/market/today'),
  getOpportunityRadar: (
    mode: OpportunityMode = 'momentum',
    horizon: TradingHorizon = 'intraday',
    selectivity: Selectivity = 'balanced',
  ): Promise<RadarResponse> =>
    api.get(`/market/radar?mode=${mode}&horizon=${horizon}&selectivity=${selectivity}`),
  getGuidedScreener: (
    playbook: ScreenerPlaybook = 'leadership',
    horizon: TradingHorizon = 'swing',
    selectivity: Selectivity = 'balanced',
    sortBy: ScreenerSort = 'score',
    sector: string | 'all' = 'all',
    filters: ScreenerFilters = {},
  ): Promise<GuidedScreenerResponse> => {
    const params = new URLSearchParams({
      playbook,
      horizon,
      selectivity,
      sortBy,
      sector,
    });

    Object.entries(filters).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') return;
      params.set(key, String(value));
    });

    return api.get(`/market/screener?${params.toString()}`);
  },
  runScreenerFilters: async (payload: {
    filters: Array<{ metric: string; operator: string; value: string; enabled: boolean }>;
    query?: string;
    symbols?: string[];
  }): Promise<any[]> => {
    return api.post('/market/screener/run', payload);
  },
  getMarketMovers:  (type = 'gainers', count = 10): Promise<Quote[]> =>
    api.get(`/market/movers?type=${type}&count=${count}`),
  getQuotes: async (symbols: string[]): Promise<Quote[]> => {
    const uniqueSymbols = [...new Set(symbols.filter(Boolean))];
    if (!uniqueSymbols.length) return [];

    const batches = chunk(uniqueSymbols, MAX_BATCH_SIZE);
    const settled = await Promise.allSettled(
      batches.map((batch) => api.get(`/market/quotes?symbols=${encodeURIComponent(batch.join(','))}`) as Promise<Quote[]>)
    );

    const results: Quote[] = [];
    for (const outcome of settled) {
      if (outcome.status === 'fulfilled') results.push(...outcome.value);
    }
    return results;
  },
  getQuote:         (symbol: string): Promise<Quote>            =>
    api.get(`/market/quote/${encodeURIComponent(symbol)}`),
  searchStocks:     (q: string): Promise<SearchResult[]>         =>
    api.get(`/market/search?q=${encodeURIComponent(q)}`),
  getAnalytics: async (symbols: string[]): Promise<ScreenerMetric[]> => {
    const uniqueSymbols = [...new Set(symbols.filter(Boolean))];
    if (!uniqueSymbols.length) return [];

    const batches = chunk(uniqueSymbols, 25);
    const settled = await Promise.allSettled(
      batches.map((batch) => api.get(`/market/analytics?symbols=${encodeURIComponent(batch.join(','))}`) as Promise<ScreenerMetric[]>)
    );

    const results: ScreenerMetric[] = [];
    for (const outcome of settled) {
      if (outcome.status === 'fulfilled') results.push(...outcome.value);
    }
    return results;
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
  getStockStory: (symbol: string): Promise<StockStory> =>
    api.get(`/market/story/${encodeURIComponent(symbol)}`),
  getCatalog:       (): Promise<MarketCatalog>                    => api.get('/market/catalog'),
  getPrimaryWatchlist: (): Promise<{ symbol: string; name: string }[]> => api.get('/market/primary-watchlist'),
  getNiftyStocks:   (): Promise<string[]>                          => api.get('/market/nifty-stocks'),
  getNews: (filter = 'all', category?: string, limit = 25): Promise<NewsItem[]> => {
    let url = `/market/news?filter=${filter}&limit=${limit}`;
    if (category && category !== 'All') url += `&category=${category}`;
    return api.get(url);
  },
  // ── Radar page signals (engine-driven, no AI) ────────────────────────────
  getRadarSnapshot: (limit = 40): Promise<RadarSnapshot> =>
    api.get(`/market/radar/signals?limit=${limit}`),
  getRadarSR: (symbol: string): Promise<SupportResistanceLevel> =>
    api.get(`/market/radar/sr/${encodeURIComponent(symbol)}`),
  getMovers: (cap: CapFilter = 'all'): Promise<{ gainers: Quote[]; losers: Quote[]; volumeLeaders: Quote[] }> =>
    api.get(`/market/movers/by-cap?cap=${cap}`),
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

export interface FinancialData {
  symbol: string;
  companyName: string;
  year: number;
  quarter: string;
  consolidationType: string;
  revenueFromOperations: number | null;
  profitLossForPeriod: number | null;
  totalAssets: number | null;
  totalEquity: number | null;
  totalLiabilities: number | null;
  eps: number | null;
  bookValuePerShare: number | null;
  [key: string]: any;
}

export interface FinancialMetrics {
  symbol: string;
  companyName: string;
  latest: {
    revenueFromOperations: number | null;
    profitAfterTax: number | null;
    totalAssets: number | null;
    totalEquity: number | null;
    eps: number | null;
    bookValuePerShare: number | null;
    roe: number | null;
    roce: number | null;
    roa: number | null;
    netMargin: number | null;
    grossMargin: number | null;
    debtToEquity: number | null;
    currentRatio: number | null;
    quickRatio: number | null;
    interestCoverage: number | null;
    assetTurnover: number | null;
    dividendPerShare: number | null;
    dividendYield: number | null;
    dividendPayoutRatio: number | null;
    operatingCashFlow: number | null;
    freeCashFlow: number | null;
    cashConversion: number | null;
    revenueGrowth: number | null;
    profitGrowth: number | null;
    [key: string]: any;
  } | null;
  annual: {
    totalRevenue: number | null;
    totalProfit: number | null;
    avgRoe: number | null;
    avgRoce: number | null;
    avgNetMargin: number | null;
  };
  quarters: any[];
}

export const financialsAPI = {
  getFinancials: (symbol: string, options?: { year?: number; quarter?: string; consolidationType?: string }): Promise<FinancialData[]> =>
    api.get(`/financials/${encodeURIComponent(symbol)}`, { params: options }),
  getLatestFinancials: (symbol: string, consolidationType?: string): Promise<FinancialData | null> =>
    api.get(`/financials/${encodeURIComponent(symbol)}/latest`, { params: { consolidationType } }),
  getMetrics: (symbol: string, options?: { year?: number; consolidationType?: string }): Promise<FinancialMetrics> =>
    api.get(`/financials/metrics/${encodeURIComponent(symbol)}`, { params: options }),
  getQuarterlyMetrics: (symbol: string, year: number, quarter: string, consolidationType?: string): Promise<any> =>
    api.get(`/financials/metrics/${encodeURIComponent(symbol)}/${year}/${quarter}`, { params: { consolidationType } }),
  getInsight: (symbol: string): Promise<{
    symbol: string;
    summary: string;
    keyInsights: string[];
    quarterlyTrend: string;
    strengths: string[];
    concerns: string[];
    verdict: string;
    financialSummary: any;
    generatedAt: string;
  }> => api.get(`/financials/insight/${encodeURIComponent(symbol)}`),
  getPriceInsight: (symbol: string): Promise<{
    symbol: string;
    summary: string;
    priceDrivers: string[];
    catalysts: string[];
    forecast: string;
    riskFactors: string[];
    opportunity: string;
    priceData: {
      price: number;
      change: number;
      changePercent: number;
      volume: number;
      high52w: number;
      low52w: number;
    };
    generatedAt: string;
  }> => api.get(`/financials/price-insight/${encodeURIComponent(symbol)}`),
  searchByMetrics: (criteria: {
    minRoe?: number;
    maxRoe?: number;
    minRoce?: number;
    maxRoce?: number;
    minNetMargin?: number;
    maxNetMargin?: number;
    minDebtToEquity?: number;
    maxDebtToEquity?: number;
    minCurrentRatio?: number;
    minRevenue?: number;
    limit?: number;
  }): Promise<{ symbol: string; companyName: string; [key: string]: any }[]> =>
    api.get('/financials/search', { params: criteria }),
  getScreenerData: (payload: {
    symbols?: string[];
    filters?: Array<{ metric: string; operator: string; value: string }>;
    limit?: number;
  }): Promise<{ symbol: string; companyName: string; [key: string]: any }[]> =>
    api.post('/financials/screener', payload),
  getSummary: (): Promise<{
    totalRecords: number;
    byQuarter: Record<string, number>;
    byConsolidation: Record<string, number>;
  }> => api.get('/financials/summary'),
};

export default api;
