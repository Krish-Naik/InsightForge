export interface ChartBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
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
  isStale: boolean;
}

export interface Fundamentals {
  sector: string;
  industry: string;
  peRatio: number | null;
  forwardPe: number | null;
  priceToBook: number | null;
  dividendYield: number | null;
  beta: number | null;
  revenueGrowth: number | null;
  profitMargins: number | null;
  targetMeanPrice: number | null;
}

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

export interface InsightSignal {
  type: string;
  label: string;
  strength: number;
  description: string;
}

export interface MarketDataProvider {
  getQuote(symbol: string): Promise<Quote | null>;
  getChart(symbol: string, period: string): Promise<ChartBar[]>;
  getFundamentals(symbol: string): Promise<Fundamentals | null>;
  getNews(symbol?: string): Promise<NewsItem[]>;
}

export interface NormalizedStockData {
  header: {
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
    exchange: string;
    currency: string;
    timestamp: string;
  };
  chart: ChartBar[];
  stats: {
    momentumScore: number;
    rsi14: number;
    volumeRatio: number;
    sma20: number;
    sma50: number;
    turnover: number;
    dayRangePercent: number;
    week52RangePosition: number;
    trend: string;
  };
  fundamentals: Fundamentals;
  news: NewsItem[];
  insights: InsightSignal[];
  extra: Record<string, unknown>;
}
