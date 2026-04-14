export interface Quote {
  symbol:        string;
  name:          string;
  price:         number;
  change:        number;
  changePercent: number;
  volume:        number;
  dayHigh:       number;
  dayLow:        number;
  previousClose: number;
  open:          number;
  high52w:       number;
  low52w:        number;
  marketCap:     number;
  currency:      string;
  marketState:   string;
  exchange:      string;
  timestamp:     string;
  isStale?:      boolean;
}

export interface Index extends Quote {
  shortName: string;
  rawSymbol: string;
}

export interface NewsItem {
  id:            string;
  title:         string;
  summary:       string;
  source:        string;
  url:           string;
  time:          string;
  sentiment:     'bullish' | 'bearish' | 'neutral';
  category:      string;
  relatedStocks: string[];
}

export interface ScreenerMetric {
  symbol:             string;
  name:               string;
  sector:             string;
  industry:           string;
  exchange:           string;
  currentPrice:       number;
  changePercent:      number;
  volume:             number;
  turnover:           number;
  dayRangePercent:    number;
  week52RangePosition:number;
  distanceFromHigh52: number;
  distanceFromLow52:  number;
  momentumScore:      number;
  liquidityScore:     number;
  high52:             number;
  low52:              number;
  inNifty50:          boolean;
  peRatio?:           number | null;
  forwardPe?:         number | null;
  priceToBook?:       number | null;
  dividendYield?:     number | null;
  beta?:              number | null;
  revenueGrowth?:     number | null;
  profitMargins?:     number | null;
  targetMeanPrice?:   number | null;
  rsi14?:             number;
  sma20?:             number;
  sma50?:             number;
  volumeRatio?:       number;
  trend?:             'bullish' | 'bearish' | 'neutral';
}

export interface SectorOverview {
  sector:               string;
  trend:                'bullish' | 'bearish' | 'neutral';
  averageChangePercent: number;
  breadth:              number;
  bullishCount:         number;
  bearishCount:         number;
  stockCount:           number;
  leader:               Quote | null;
  laggard:              Quote | null;
  stocks:               Quote[];
  lastUpdated:          string;
}

export interface HistoricalBar {
  date:   string;
  open:   number;
  high:   number;
  low:    number;
  close:  number;
  volume: number;
}

export interface WatchlistStock {
  symbol:   string;
  name:     string;
  exchange: string;
}

export interface Watchlist {
  id:     string;
  name:   string;
  stocks: WatchlistStock[];
}
