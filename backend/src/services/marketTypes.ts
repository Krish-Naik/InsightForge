export interface Index {
  symbol: string;
  shortName: string;
  rawSymbol?: string;
  exchange: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  previousClose: number;
  dayHigh: number;
  dayLow: number;
  marketState: string;
  timestamp: string;
  isStale?: boolean;
}

export interface Quote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  dayHigh: number;
  dayLow: number;
  previousClose: number;
  open: number;
  high52w: number;
  low52w: number;
  marketCap: number;
  currency: string;
  marketState: string;
  exchange: string;
  timestamp: string;
  instrumentKey?: string;
  isin?: string;
  isStale?: boolean;
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