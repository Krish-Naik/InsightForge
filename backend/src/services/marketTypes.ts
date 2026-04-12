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
}