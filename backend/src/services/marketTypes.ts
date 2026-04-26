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
  volumeCr?: number;  // Volume in Crores
  dayHigh: number;
  dayLow: number;
  previousClose: number;
  open: number;
  high52w: number;
  low52w: number;
  marketCap: number;
  marketCapCr?: number;  // Market cap in Crores
  currency: string;
  marketState: string;
  exchange: string;
  timestamp: string;
  instrumentKey?: string;
  isin?: string;
  isStale?: boolean;
  peRatio?: number | null;
  priceToBook?: number | null;
  dividendYield?: number | null;
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
  story?: StockStory;
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
export type RadarSignalType = 'breakout' | 'unusual-volume' | 'sector-follow-through' | 'pullback-ready' | 'risk';

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