import axios from 'axios';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { MarketDataService } from './marketDataService.js';
import { NewsService, type NewsItem } from './news.js';
import type {
  GuidedScreenerResponse,
  InsightCoverage,
  OpportunityCard,
  OpportunityMode,
  OpportunityState,
  Quote,
  RadarSignal,
  RadarResponse,
  RadarWindowInsight,
  RecapCard,
  ScoreComponent,
  ScreenerPlaybook,
  ScreenerFilters,
  ScreenerDiagnostics,
  ScreenerMetric,
  ScreenerSort,
  SectorOverview,
  SectorRotationInsight,
  SectorScanInsight,
  SectorShiftSignal,
  Selectivity,
  StockResearch,
  StockStory,
  StoryTimelineEntry,
  TodayDesk,
  TradingHorizon,
} from './marketTypes.js';

type CacheEntry = {
  expiresAt: number;
  value: unknown;
};

type TodayEnhancement = {
  headline?: string;
  summary?: string;
  watchFor?: string;
  risk?: string;
  sectors?: Array<{ sector: string; summary: string }>;
  opportunities?: Array<{
    symbol: string;
    whyNow?: string;
    watchNext?: string;
    risk?: string;
  }>;
};

type StockEnhancement = {
  summary?: string;
  whyMoving?: {
    primary?: string;
    secondary?: string;
    watchNext?: string;
    risk?: string;
    evidence?: string[];
  };
  bullCase?: string[];
  bearCase?: string[];
  timeline?: Array<{
    label: string;
    detail: string;
    tone: 'bullish' | 'bearish' | 'balanced' | 'neutral';
  }>;
};

type CandidateBundle = {
  sector: SectorOverview;
  row: ScreenerMetric;
};

type IntradayPulse = {
  symbol: string;
  latestAt: string;
  change5m: number;
  change15m: number;
  volumeSpike: number;
};

const insightCache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();

const TTL = {
  today: 60_000,
  radar: 20_000,
  stock: 180_000,
} as const;

const RADAR_REFRESH_INTERVAL_SECONDS = 20;

function isoNow(): string {
  return new Date().toISOString();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentMove(current: number | null | undefined, previous: number | null | undefined): number {
  if (!current || !previous || !Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

function toOptionalNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function hasMetricValue(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function formatInr(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
}

function formatPercent(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function quoteFromMetric(metric: ScreenerMetric): Quote {
  return {
    symbol: metric.symbol,
    name: metric.name,
    price: metric.currentPrice,
    change: 0,
    changePercent: metric.changePercent,
    volume: metric.volume,
    dayHigh: 0,
    dayLow: 0,
    previousClose: 0,
    open: 0,
    high52w: metric.high52,
    low52w: metric.low52,
    marketCap: 0,
    currency: 'INR',
    marketState: 'REGULAR',
    exchange: metric.exchange,
    timestamp: isoNow(),
  };
}

async function loadWithCache<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const cached = insightCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value as T;
  }

  const active = inflight.get(key);
  if (active) return active as Promise<T>;

  const request = loader()
    .then((value) => {
      insightCache.set(key, {
        value,
        expiresAt: Date.now() + ttlMs,
      });
      inflight.delete(key);
      return value;
    })
    .catch((error) => {
      inflight.delete(key);
      throw error;
    });

  inflight.set(key, request as Promise<unknown>);
  return request;
}

function stripCodeFences(input: string): string {
  const trimmed = input.trim();
  if (!trimmed.startsWith('```')) return trimmed;
  return trimmed.replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
}

function parseJsonObject<T>(payload: string): T | null {
  try {
    return JSON.parse(stripCodeFences(payload)) as T;
  } catch {
    const firstBrace = payload.indexOf('{');
    const lastBrace = payload.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return null;

    try {
      return JSON.parse(payload.slice(firstBrace, lastBrace + 1)) as T;
    } catch {
      return null;
    }
  }
}

function dedupeBySymbol(rows: ScreenerMetric[]): ScreenerMetric[] {
  const seen = new Set<string>();
  const deduped: ScreenerMetric[] = [];

  for (const row of rows) {
    if (seen.has(row.symbol)) continue;
    seen.add(row.symbol);
    deduped.push(row);
  }

  return deduped;
}

function relatedNewsMap(newsItems: NewsItem[]): Map<string, NewsItem[]> {
  const map = new Map<string, NewsItem[]>();

  for (const story of newsItems) {
    for (const symbol of story.relatedStocks || []) {
      const current = map.get(symbol) || [];
      current.push(story);
      map.set(symbol, current);
    }
  }

  return map;
}

function classifyState(row: ScreenerMetric): OpportunityState {
  const rangePosition = row.week52RangePosition || 0;
  const rsi = row.rsi14 || 50;
  const volumeRatio = row.volumeRatio || 1;

  if (rangePosition >= 94 || rsi >= 73) return 'extended';
  if (volumeRatio >= 1.25 && Math.abs(row.changePercent) >= 1) return 'fresh';
  if (row.changePercent >= 0) return 'building';
  return 'weakening';
}

function deriveDirection(row: ScreenerMetric, sector: SectorOverview): 'bullish' | 'bearish' | 'neutral' {
  if (row.changePercent >= 0.4 || sector.trend === 'bullish') return 'bullish';
  if (row.changePercent <= -0.4 || sector.trend === 'bearish') return 'bearish';
  return 'neutral';
}

function deriveSetup(row: ScreenerMetric, sector: SectorOverview, newsCount: number, mode: OpportunityMode): string {
  const rangePosition = row.week52RangePosition || 0;
  const volumeRatio = row.volumeRatio || 1;
  const rsi = row.rsi14 || 50;

  if (mode === 'avoid') return 'Weakness to avoid';
  if (mode === 'pullback' && sector.trend === 'bullish') return 'Pullback watch';
  if (newsCount > 0 && volumeRatio >= 1.2) return 'Narrative ignition';
  if (sector.trend === 'bullish' && volumeRatio >= 1.4 && row.changePercent >= 1.2) return 'Sector leadership';
  if (sector.trend === 'bullish' && rangePosition >= 60 && rangePosition <= 90 && rsi <= 70) return 'Breakout forming';
  if (sector.trend === 'bullish' && rsi <= 58) return 'Constructive base';
  if (sector.trend === 'bearish') return 'Pressure building';
  return 'Watch setup';
}

function buildRiskCopy(state: OpportunityState, sector: SectorOverview, row: ScreenerMetric): string {
  if (state === 'extended') return 'Price is strong, but entry quality is fading. Wait for a reset instead of chasing.';
  if ((row.volumeRatio || 1) < 1) return 'The move still needs cleaner participation before it becomes convincing.';
  if (sector.trend === 'bearish') return 'Sector pressure is still strong enough to break weak setups quickly.';
  return 'Risk stays contained only while the stock keeps holding its nearby support zone.';
}

function buildOpportunity(
  row: ScreenerMetric,
  sector: SectorOverview,
  stories: NewsItem[],
  horizon: TradingHorizon,
  mode: OpportunityMode,
): OpportunityCard {
  const state = classifyState(row);
  const direction = deriveDirection(row, sector);
  const setup = deriveSetup(row, sector, stories.length, mode);
  const currentPrice = row.currentPrice || 0;
  const support = row.sma20 || currentPrice * 0.975;
  const resistance = currentPrice * (direction === 'bearish' ? 0.996 : 1.006);
  const triggerPrice = currentPrice > 0 ? Number(resistance.toFixed(2)) : null;
  const invalidationPrice = currentPrice > 0
    ? Number((direction === 'bearish' ? currentPrice * 1.018 : support).toFixed(2))
    : null;
  const volumeRatio = row.volumeRatio || 1;
  const scoreBreakdown: ScoreComponent[] = [
    {
      label: 'Sector backdrop',
      contribution: sector.trend === 'bullish' ? 9 : sector.trend === 'bearish' ? -9 : 0,
      detail: sector.trend === 'bullish'
        ? `${sector.sector} is supportive.`
        : sector.trend === 'bearish'
          ? `${sector.sector} is acting as a headwind.`
          : `${sector.sector} is mixed.`,
    },
    {
      label: 'Momentum',
      contribution: clamp((row.momentumScore || 0) / 3, -12, 16),
      detail: `Momentum score ${Math.round(row.momentumScore || 0)}.`,
    },
    {
      label: 'Participation',
      contribution: clamp((volumeRatio - 1) * 14, -8, 12),
      detail: `Volume is ${volumeRatio.toFixed(1)}x normal.`,
    },
    {
      label: 'Price move',
      contribution: clamp(row.changePercent * 1.6, -10, 10),
      detail: `Session move is ${formatPercent(row.changePercent)}.`,
    },
    {
      label: 'Breadth',
      contribution: clamp(sector.breadth / 10, -8, 8),
      detail: `Sector breadth is ${sector.breadth.toFixed(0)}%.`,
    },
    {
      label: 'Narrative',
      contribution: stories.length ? 4 : 0,
      detail: stories.length ? `${stories.length} linked news item${stories.length > 1 ? 's' : ''} add context.` : 'No linked news catalyst.',
    },
    {
      label: 'Timing penalty',
      contribution: state === 'extended' ? -6 : 0,
      detail: state === 'extended' ? 'The move is already stretched.' : 'Timing quality is still intact.',
    },
  ];
  const scoreBase = 56 + scoreBreakdown.reduce((sum, entry) => sum + entry.contribution, 0);
  const score = clamp(Math.round(scoreBase), 28, 96);
  const confidence = clamp(Math.round(scoreBase + (state === 'fresh' ? 4 : 0)), 35, 97);
  const sectorLeadText = sector.trend === 'bullish'
    ? `${sector.sector} is leading with ${sector.breadth.toFixed(0)}% breadth.`
    : sector.trend === 'bearish'
      ? `${sector.sector} is under pressure with ${sector.breadth.toFixed(0)}% breadth.`
      : `${sector.sector} is mixed, so stock-specific confirmation matters more.`;
  const volumeText = volumeRatio >= 1.4
    ? `Participation is strong at ${volumeRatio.toFixed(1)}x normal volume.`
    : volumeRatio >= 1.1
      ? 'Participation is improving, but not yet decisive.'
      : 'Volume remains muted for now.';
  const whyNow = `${row.symbol} is interesting because ${sectorLeadText} ${volumeText}`;
  const watchNext = direction === 'bearish'
    ? `Watch for stabilization back above ${formatInr(triggerPrice)} before revisiting the setup.`
    : state === 'extended'
      ? `Watch for a reset or a hold above ${formatInr(triggerPrice)} before chasing.`
      : `Watch for follow-through above ${formatInr(triggerPrice)} while support holds near ${formatInr(invalidationPrice)}.`;
  const labels = [
    sector.sector,
    `Vol ${volumeRatio.toFixed(1)}x`,
    `RSI ${(row.rsi14 || 50).toFixed(0)}`,
    state,
  ];

  return {
    id: `${mode}-${horizon}-${row.symbol}`,
    symbol: row.symbol,
    name: row.name,
    sector: sector.sector,
    setup,
    direction,
    whyNow,
    watchNext,
    risk: buildRiskCopy(state, sector, row),
    confidence,
    score,
    horizon,
    state,
    triggerPrice,
    invalidationPrice,
    quote: quoteFromMetric(row),
    analytics: row,
    sectorTrend: sector.trend,
    labels,
    scoreBreakdown: scoreBreakdown
      .filter((entry) => Math.abs(entry.contribution) >= 1)
      .sort((left, right) => Math.abs(right.contribution) - Math.abs(left.contribution))
      .slice(0, 4),
  };
}

function describeSectorMovement(sector: SectorOverview): SectorRotationInsight['movement'] {
  if (sector.trend === 'bullish' && sector.breadth >= 15) return 'accelerating';
  if (sector.trend === 'bearish' && sector.breadth <= -15) return 'cooling';
  return 'mixed';
}

function buildSectorRotationInsight(sector: SectorOverview): SectorRotationInsight {
  const breadthLabel = sector.breadth >= 20
    ? 'broad participation'
    : sector.breadth <= -20
      ? 'broad weakness'
      : 'narrow leadership';
  const summary = sector.trend === 'bullish'
    ? `${sector.sector} is attracting flows, led by ${sector.leader?.symbol || 'its leaders'}, but breadth is ${breadthLabel}.`
    : sector.trend === 'bearish'
      ? `${sector.sector} is losing sponsorship, with ${sector.laggard?.symbol || 'laggards'} dragging the group lower.`
      : `${sector.sector} is mixed. Leadership exists, but participation is still not broad enough.`;

  return {
    sector: sector.sector,
    trend: sector.trend,
    summary,
    breadthLabel,
    leaderSymbol: sector.leader?.symbol,
    laggardSymbol: sector.laggard?.symbol,
    movement: describeSectorMovement(sector),
  };
}

function buildMarketNarrative(summary: Awaited<ReturnType<typeof MarketDataService.getMarketSummary>>, sectors: SectorOverview[]) {
  const avgIndexMove = average(summary.indices.map((index) => index.changePercent));
  const positiveSectors = sectors.filter((sector) => sector.trend === 'bullish').length;
  const negativeSectors = sectors.filter((sector) => sector.trend === 'bearish').length;
  const strongestSector = sectors[0]?.sector;
  const weakestSector = [...sectors].reverse().find((sector) => sector.trend === 'bearish')?.sector;
  const tone = avgIndexMove >= 0.45 && positiveSectors >= negativeSectors
    ? 'bullish'
    : avgIndexMove <= -0.45 && negativeSectors >= positiveSectors
      ? 'bearish'
      : Math.abs(avgIndexMove) < 0.25
        ? 'balanced'
        : 'neutral';
  const headline = strongestSector && weakestSector
    ? `${strongestSector} is carrying the tape while ${weakestSector} stays on the back foot.`
    : strongestSector
      ? `${strongestSector} is setting the tone for the market right now.`
      : 'The market is waiting for broader leadership to emerge.';
  const breadthCopy = positiveSectors > negativeSectors
    ? 'Breadth is net positive, but conviction is still concentrated in a few pockets.'
    : positiveSectors < negativeSectors
      ? 'Breadth is weak, so stock selection matters more than index comfort.'
      : 'Breadth is balanced, so leadership quality matters more than raw index movement.';

  return {
    headline,
    summary: `${breadthCopy} Headline indices are at ${formatPercent(avgIndexMove)} on average.`,
    watchFor: strongestSector
      ? `Watch whether ${strongestSector} keeps broadening beyond its top one or two leaders.`
      : 'Watch for a sector to establish cleaner leadership before leaning aggressive.',
    risk: weakestSector
      ? `${weakestSector} remains the main drag. If more sectors join that weakness, today's tone can fade quickly.`
      : 'Leadership is still thin enough to reverse if volume fades.',
    tone,
    strongestSector,
    weakestSector,
  } as const;
}

function buildRecap(opportunities: OpportunityCard[], sectors: SectorOverview[]): RecapCard[] {
  const strongest = opportunities[0];
  const risk = opportunities.find((entry) => entry.direction === 'bearish' || entry.state === 'extended');
  const carry = opportunities.find((entry) => entry.state === 'building');
  const weakSector = [...sectors].reverse().find((sector) => sector.trend === 'bearish');

  return [
    strongest ? {
      title: 'Working now',
      detail: `${strongest.symbol} is the cleanest expression of current leadership because the sector backdrop and participation are aligned.`,
      tone: 'bullish' as const,
      symbols: [strongest.symbol],
    } : null,
    risk ? {
      title: 'What not to chase',
      detail: `${risk.symbol} is moving, but the setup is losing freshness. Let it prove itself again before acting.`,
      tone: 'balanced' as const,
      symbols: [risk.symbol],
    } : null,
    weakSector ? {
      title: 'Main drag',
      detail: `${weakSector.sector} is the pocket most likely to keep weighing on sentiment if weakness spreads further.`,
      tone: 'bearish' as const,
      symbols: [weakSector.laggard?.symbol || weakSector.leader?.symbol || weakSector.sector],
    } : null,
    carry ? {
      title: 'Carry forward',
      detail: `${carry.symbol} still looks constructive, but tomorrow matters more than today’s first move.`,
      tone: 'neutral' as const,
      symbols: [carry.symbol],
    } : null,
  ].filter((entry): entry is RecapCard => Boolean(entry));
}

async function maybeRewriteTodayCopy(
  desk: TodayDesk,
  sectors: SectorOverview[],
): Promise<TodayDesk> {
  if (!config.ai.enabled) return desk;

  const prompt = {
    market: {
      headline: desk.narrative.headline,
      summary: desk.narrative.summary,
      watchFor: desk.narrative.watchFor,
      risk: desk.narrative.risk,
    },
    sectors: sectors.slice(0, 5).map((sector) => ({
      sector: sector.sector,
      trend: sector.trend,
      avgMove: sector.averageChangePercent,
      breadth: sector.breadth,
      leader: sector.leader?.symbol,
      laggard: sector.laggard?.symbol,
    })),
    opportunities: desk.opportunityStack.slice(0, 5).map((opportunity) => ({
      symbol: opportunity.symbol,
      setup: opportunity.setup,
      sector: opportunity.sector,
      whyNow: opportunity.whyNow,
      watchNext: opportunity.watchNext,
      risk: opportunity.risk,
    })),
  };

  try {
    const response = await axios.post(
      `${config.ai.baseUrl.replace(/\/$/, '')}/chat/completions`,
      {
        model: config.ai.model,
        temperature: 0.2,
          ...(config.ai.provider === 'groq' ? { response_format: { type: 'json_object' } } : {}),
        messages: [
          {
            role: 'system',
            content: 'You write concise, evidence-first market copy for Indian retail traders. Return valid JSON only. Do not add markdown or code fences.',
          },
          {
            role: 'user',
            content: `Rewrite this market desk copy with sharper editorial language while staying grounded in the supplied facts. Keep it concise. JSON shape: {"headline":string,"summary":string,"watchFor":string,"risk":string,"sectors":[{"sector":string,"summary":string}],"opportunities":[{"symbol":string,"whyNow":string,"watchNext":string,"risk":string}]}. Facts: ${JSON.stringify(prompt)}`,
          },
        ],
      },
      {
        timeout: config.ai.timeoutMs,
        headers: {
          Authorization: `Bearer ${config.ai.apiKey}`,
          'Content-Type': 'application/json',
        },
      },
    );

    const content = response.data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') return desk;

    const parsed = parseJsonObject<TodayEnhancement>(content);
      if (!parsed) {
        logger.warn('AI market desk rewrite returned unparseable JSON. Falling back to deterministic copy.');
        return desk;
      }

    const sectorCopy = new Map((parsed.sectors || []).map((entry) => [entry.sector, entry.summary]));
    const opportunityCopy = new Map((parsed.opportunities || []).map((entry) => [entry.symbol, entry]));

    return {
      ...desk,
      narrative: {
        ...desk.narrative,
        headline: parsed.headline || desk.narrative.headline,
        summary: parsed.summary || desk.narrative.summary,
        watchFor: parsed.watchFor || desk.narrative.watchFor,
        risk: parsed.risk || desk.narrative.risk,
      },
      sectorRotation: desk.sectorRotation.map((sector) => ({
        ...sector,
        summary: sectorCopy.get(sector.sector) || sector.summary,
      })),
      opportunityStack: desk.opportunityStack.map((opportunity) => ({
        ...opportunity,
        whyNow: opportunityCopy.get(opportunity.symbol)?.whyNow || opportunity.whyNow,
        watchNext: opportunityCopy.get(opportunity.symbol)?.watchNext || opportunity.watchNext,
        risk: opportunityCopy.get(opportunity.symbol)?.risk || opportunity.risk,
      })),
      stocksToWatch: desk.stocksToWatch.map((opportunity) => ({
        ...opportunity,
        whyNow: opportunityCopy.get(opportunity.symbol)?.whyNow || opportunity.whyNow,
        watchNext: opportunityCopy.get(opportunity.symbol)?.watchNext || opportunity.watchNext,
        risk: opportunityCopy.get(opportunity.symbol)?.risk || opportunity.risk,
      })),
      sourceMode: 'ai',
    };
  } catch (error) {
    logger.warn(`AI market desk rewrite failed: ${(error as Error).message}`);
    return desk;
  }
}

async function maybeRewriteStockStory(story: StockStory, research: StockResearch): Promise<StockStory> {
  if (!config.ai.enabled) return story;

  const prompt = {
    symbol: research.profile.symbol,
    company: research.profile.name,
    sector: research.profile.primarySector,
    analytics: research.analytics ? {
      changePercent: research.analytics.changePercent,
      momentumScore: research.analytics.momentumScore,
      volumeRatio: research.analytics.volumeRatio,
      rsi14: research.analytics.rsi14,
      trend: research.analytics.trend,
      week52RangePosition: research.analytics.week52RangePosition,
    } : null,
    sectorOverview: research.sectorOverview ? {
      trend: research.sectorOverview.trend,
      breadth: research.sectorOverview.breadth,
      averageChangePercent: research.sectorOverview.averageChangePercent,
      leader: research.sectorOverview.leader?.symbol,
    } : null,
    story,
  };

  try {
    const response = await axios.post(
      `${config.ai.baseUrl.replace(/\/$/, '')}/chat/completions`,
      {
        model: config.ai.model,
        temperature: 0.2,
          ...(config.ai.provider === 'groq' ? { response_format: { type: 'json_object' } } : {}),
        messages: [
          {
            role: 'system',
            content: 'You write concise, evidence-backed stock setup explanations for Indian retail traders. Return valid JSON only. No markdown.',
          },
          {
            role: 'user',
            content: `Rewrite this stock story copy while preserving the factual stance and trading discipline. JSON shape: {"summary":string,"whyMoving":{"primary":string,"secondary":string,"watchNext":string,"risk":string,"evidence":string[]},"bullCase":string[],"bearCase":string[],"timeline":[{"label":string,"detail":string,"tone":"bullish"|"bearish"|"balanced"|"neutral"}]}. Facts: ${JSON.stringify(prompt)}`,
          },
        ],
      },
      {
        timeout: config.ai.timeoutMs,
        headers: {
          Authorization: `Bearer ${config.ai.apiKey}`,
          'Content-Type': 'application/json',
        },
      },
    );

    const content = response.data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') return story;

    const parsed = parseJsonObject<StockEnhancement>(content);
      if (!parsed) {
        logger.warn('AI stock story rewrite returned unparseable JSON. Falling back to deterministic copy.');
        return story;
      }

    return {
      ...story,
      summary: parsed.summary || story.summary,
      whyMoving: {
        ...story.whyMoving,
        primary: parsed.whyMoving?.primary || story.whyMoving.primary,
        secondary: parsed.whyMoving?.secondary || story.whyMoving.secondary,
        watchNext: parsed.whyMoving?.watchNext || story.whyMoving.watchNext,
        risk: parsed.whyMoving?.risk || story.whyMoving.risk,
        evidence: parsed.whyMoving?.evidence?.length ? parsed.whyMoving.evidence : story.whyMoving.evidence,
      },
      bullCase: parsed.bullCase?.length ? parsed.bullCase : story.bullCase,
      bearCase: parsed.bearCase?.length ? parsed.bearCase : story.bearCase,
      timeline: parsed.timeline?.length ? parsed.timeline : story.timeline,
      sourceMode: 'ai',
    };
  } catch (error) {
    logger.warn(`AI stock story rewrite failed: ${(error as Error).message}`);
    return story;
  }
}

async function getSectorCandidates(sectors: SectorOverview[], perSector: number): Promise<Array<{ sector: SectorOverview; row: ScreenerMetric }>> {
  const bundles = await Promise.all(
    sectors.map(async (sector) => ({
      sector,
      rows: await MarketDataService.getSectorAnalytics(sector.sector, perSector),
    })),
  );

  return bundles.flatMap(({ sector, rows }) => rows.map((row) => ({ sector, row })));
}

function dedupeCandidateBundles(candidates: CandidateBundle[]): CandidateBundle[] {
  const seen = new Set<string>();
  const deduped: CandidateBundle[] = [];

  for (const candidate of candidates) {
    if (seen.has(candidate.row.symbol)) continue;
    seen.add(candidate.row.symbol);
    deduped.push(candidate);
  }

  return deduped;
}

function sortSectorsForRadar(sectors: SectorOverview[], mode: OpportunityMode): SectorOverview[] {
  const score = (sector: SectorOverview) => {
    const trendWeight = mode === 'avoid'
      ? sector.trend === 'bearish' ? 30 : sector.trend === 'neutral' ? 16 : 0
      : sector.trend === 'bullish' ? 28 : sector.trend === 'neutral' ? 14 : 4;
    return trendWeight + clamp(Math.abs(sector.breadth), 0, 40) + Math.abs(sector.averageChangePercent) * 6;
  };

  return [...sectors].sort((left, right) => score(right) - score(left));
}

function sortSectorsForScreener(sectors: SectorOverview[], sector: string | 'all'): SectorOverview[] {
  if (sector !== 'all') {
    return sectors.filter((entry) => entry.sector === sector);
  }

  return [...sectors].sort((left, right) => {
    const leftScore = (left.trend === 'bullish' ? 24 : left.trend === 'neutral' ? 12 : 6) + clamp(Math.abs(left.breadth), 0, 40);
    const rightScore = (right.trend === 'bullish' ? 24 : right.trend === 'neutral' ? 12 : 6) + clamp(Math.abs(right.breadth), 0, 40);
    return rightScore - leftScore;
  });
}

function filterCandidatesByMode(
  candidates: CandidateBundle[],
  mode: OpportunityMode,
  horizon: TradingHorizon,
  relaxed = false,
): CandidateBundle[] {
  return candidates.filter(({ sector, row }) => {
    const volumeRatio = row.volumeRatio || 1;
    const rangePosition = row.week52RangePosition || 0;
    const rsi = row.rsi14 || 50;

    if (mode === 'avoid') {
      return sector.trend === 'bearish' || rangePosition >= (relaxed ? 88 : 94) || rsi >= (relaxed ? 68 : 73) || row.changePercent <= (relaxed ? -0.4 : -1);
    }

    if (mode === 'pullback') {
      return sector.trend !== 'bearish' && rangePosition >= (relaxed ? 28 : 45) && rangePosition <= (relaxed ? 88 : 82) && rsi <= (relaxed ? 64 : 60);
    }

    if (mode === 'sympathy') {
      return sector.trend !== 'bearish' && row.changePercent >= (relaxed ? -0.2 : 0) && volumeRatio >= (relaxed ? 0.95 : 1) && (row.momentumScore || 0) >= (relaxed ? 7 : 10);
    }

    if (mode === 'breakout') {
      return sector.trend !== 'bearish' && volumeRatio >= (relaxed ? 1.05 : 1.2) && rangePosition >= (relaxed ? 48 : 60) && rangePosition <= 92;
    }

    if (mode === 'guided') {
      return sector.trend !== 'bearish' && (row.momentumScore || 0) >= (relaxed ? 8 : 12);
    }

    if (horizon === 'intraday') {
      return sector.trend !== 'bearish' && volumeRatio >= (relaxed ? 1.02 : 1.15) && Math.abs(row.changePercent) >= (relaxed ? 0.3 : 0.8);
    }

    return sector.trend !== 'bearish' && (row.momentumScore || 0) >= (relaxed ? 10 : 16);
  });
}

function buildOpportunityPool(
  candidates: CandidateBundle[],
  mode: OpportunityMode,
  horizon: TradingHorizon,
  newsMap: Map<string, NewsItem[]>,
): OpportunityCard[] {
  const strict = dedupeCandidateBundles(filterCandidatesByMode(candidates, mode, horizon, false));
  const relaxed = dedupeCandidateBundles(filterCandidatesByMode(candidates, mode, horizon, true));
  const selected = strict.length >= 6 ? strict : dedupeCandidateBundles([...strict, ...relaxed]);
  const pool = selected.length ? selected : dedupeCandidateBundles(candidates);

  return pool
    .map(({ sector, row }) => buildOpportunity(row, sector, newsMap.get(row.symbol) || [], horizon, mode))
    .sort((left, right) => right.score - left.score);
}

function radarLimitBySelectivity(selectivity: Selectivity): number {
  if (selectivity === 'conservative') return 12;
  if (selectivity === 'aggressive') return 28;
  return 18;
}

function radarSectorLimitBySelectivity(selectivity: Selectivity): number {
  if (selectivity === 'conservative') return 8;
  if (selectivity === 'aggressive') return 12;
  return 10;
}

function screenerLimitBySelectivity(selectivity: Selectivity): number {
  if (selectivity === 'conservative') return 14;
  if (selectivity === 'aggressive') return 36;
  return 24;
}

function screenerSectorLimitBySelectivity(selectivity: Selectivity, sector: string | 'all'): number {
  if (sector !== 'all') {
    if (selectivity === 'conservative') return 24;
    if (selectivity === 'aggressive') return 48;
    return 36;
  }

  if (selectivity === 'conservative') return 10;
  if (selectivity === 'aggressive') return 18;
  return 14;
}

function buildCoverage(
  sectors: SectorOverview[],
  candidates: CandidateBundle[],
  opportunities: OpportunityCard[],
): InsightCoverage {
  const stocksAnalyzed = dedupeBySymbol(candidates.map((candidate) => candidate.row)).length;

  return {
    sectorsScanned: sectors.length,
    universeStocks: sectors.reduce((sum, sector) => sum + sector.stockCount, 0),
    stocksAnalyzed,
    matches: opportunities.length,
  };
}

function buildSectorScanInsights(
  sectors: SectorOverview[],
  candidates: CandidateBundle[],
  opportunities: OpportunityCard[],
  limit = 8,
): SectorScanInsight[] {
  const candidateCounts = new Map<string, number>();
  const matchCounts = new Map<string, number>();

  for (const candidate of candidates) {
    candidateCounts.set(candidate.sector.sector, (candidateCounts.get(candidate.sector.sector) || 0) + 1);
  }

  for (const opportunity of opportunities) {
    matchCounts.set(opportunity.sector, (matchCounts.get(opportunity.sector) || 0) + 1);
  }

  return sectors
    .map((sector) => ({
      sector: sector.sector,
      trend: sector.trend,
      breadth: sector.breadth,
      averageChangePercent: sector.averageChangePercent,
      candidateCount: candidateCounts.get(sector.sector) || 0,
      matchCount: matchCounts.get(sector.sector) || 0,
      leaderSymbol: sector.leader?.symbol,
      laggardSymbol: sector.laggard?.symbol,
    }))
    .sort((left, right) => right.matchCount - left.matchCount || Math.abs(right.breadth) - Math.abs(left.breadth))
    .slice(0, limit);
}

function buildRadarNarrative(mode: OpportunityMode, opportunities: OpportunityCard[], sectors: SectorOverview[]): string {
  const topSector = sectors[0]?.sector || 'the market';
  const topName = opportunities[0]?.symbol;

  if (mode === 'avoid') {
    return `These names are moving for the wrong reasons right now. The goal is to avoid emotional entries until structure improves.`;
  }

  if (mode === 'pullback') {
    return `Leadership is already visible, so the better question is where the second chance may come from. ${topSector} remains the cleanest hunting ground.`;
  }

  return topName
    ? `${topName} is the sharpest expression of current opportunity, with ${topSector} still setting the tone for the best-looking setups.`
    : `The market still lacks a clean leadership pocket, so selectivity matters more than activity.`;
}

function playbookToMode(playbook: ScreenerPlaybook): OpportunityMode {
  if (playbook === 'pullback') return 'pullback';
  if (playbook === 'sympathy') return 'sympathy';
  if (playbook === 'avoid') return 'avoid';
  if (playbook === 'quality') return 'guided';
  return 'momentum';
}

function matchesScreenerPlaybook(opportunity: OpportunityCard, playbook: ScreenerPlaybook, relaxed = false): boolean {
  const analytics = opportunity.analytics;

  if (!analytics) return false;

  if (playbook === 'quality') {
    const hasFundamentalSupport = (analytics.revenueGrowth ?? 0) >= (relaxed ? 5 : 8)
      || (analytics.profitMargins ?? 0) >= (relaxed ? 5 : 8)
      || (((analytics.peRatio ?? 999) > 0) && ((analytics.peRatio ?? 999) <= (relaxed ? 35 : 28)))
      || (((analytics.priceToBook ?? 999) > 0) && ((analytics.priceToBook ?? 999) <= (relaxed ? 5.5 : 4.5)));
    const stabilityProxy = opportunity.direction !== 'bearish'
      && opportunity.state !== 'weakening'
      && (analytics.volumeRatio || 1) >= (relaxed ? 0.95 : 1)
      && (analytics.rsi14 || 50) >= (relaxed ? 42 : 46)
      && (analytics.rsi14 || 50) <= (relaxed ? 68 : 64)
      && (analytics.week52RangePosition || 0) >= (relaxed ? 35 : 42)
      && (analytics.week52RangePosition || 0) <= (relaxed ? 82 : 76);

    return opportunity.direction !== 'bearish' && (hasFundamentalSupport || stabilityProxy);
  }

  if (playbook === 'pullback') {
    return opportunity.sectorTrend === 'bullish'
      && opportunity.state !== 'extended'
      && (analytics.week52RangePosition || 0) >= (relaxed ? 25 : 35)
      && (analytics.week52RangePosition || 0) <= (relaxed ? 84 : 78)
      && (analytics.rsi14 || 50) <= (relaxed ? 64 : 60);
  }

  if (playbook === 'sympathy') {
    return opportunity.sectorTrend === 'bullish'
      && opportunity.direction !== 'bearish'
      && (analytics.momentumScore || 0) >= (relaxed ? 7 : 10)
      && (analytics.volumeRatio || 1) >= (relaxed ? 0.95 : 1);
  }

  if (playbook === 'avoid') {
    return opportunity.direction === 'bearish'
      || opportunity.state === 'extended'
      || opportunity.sectorTrend === 'bearish'
      || (relaxed && (analytics.rsi14 || 50) >= 66);
  }

  return opportunity.sectorTrend !== 'bearish' && opportunity.score >= (relaxed ? 56 : 64) && (relaxed || opportunity.state !== 'weakening');
}

function screenerValueScore(analytics: ScreenerMetric | null): number {
  if (!analytics) return -1;

  let score = 0;

  if ((analytics.peRatio ?? 0) > 0) {
    score += clamp(36 - (analytics.peRatio || 0), 0, 30);
  }

  if ((analytics.priceToBook ?? 0) > 0) {
    score += clamp(6 - (analytics.priceToBook || 0), 0, 6) * 4;
  }

  score += clamp((analytics.revenueGrowth || 0) / 2, 0, 12);
  score += clamp((analytics.profitMargins || 0) / 2, 0, 12);
  score += clamp((70 - Math.abs((analytics.rsi14 || 50) - 55)) / 4, 0, 8);

  return score;
}

function screenerBreakoutScore(opportunity: OpportunityCard): number {
  const analytics = opportunity.analytics;
  if (!analytics) return -1;

  return (analytics.week52RangePosition || 0)
    + clamp((analytics.volumeRatio || 1) * 16, 0, 26)
    + clamp((analytics.momentumScore || 0) / 2, -10, 35);
}

function screenerSectorScore(opportunity: OpportunityCard): number {
  const analytics = opportunity.analytics;
  return clamp(opportunity.score, 0, 100)
    + clamp(opportunity.confidence, 0, 100) / 5
    + clamp(opportunity.sectorTrend === 'bullish' ? 18 : opportunity.sectorTrend === 'bearish' ? -12 : 4, -12, 18)
    + clamp((analytics?.volumeRatio || 1) * 8, 0, 12);
}

function sortScreenerOpportunities(opportunities: OpportunityCard[], sortBy: ScreenerSort): OpportunityCard[] {
  const sorted = [...opportunities];

  sorted.sort((left, right) => {
    if (sortBy === 'momentum') {
      return (right.analytics?.momentumScore || 0) - (left.analytics?.momentumScore || 0) || right.score - left.score;
    }

    if (sortBy === 'volume') {
      return (right.analytics?.volumeRatio || 0) - (left.analytics?.volumeRatio || 0) || right.score - left.score;
    }

    if (sortBy === 'breakout') {
      return screenerBreakoutScore(right) - screenerBreakoutScore(left) || right.score - left.score;
    }

    if (sortBy === 'sector') {
      return screenerSectorScore(right) - screenerSectorScore(left) || right.score - left.score;
    }

    if (sortBy === 'value') {
      return screenerValueScore(right.analytics) - screenerValueScore(left.analytics) || right.score - left.score;
    }

    return right.score - left.score;
  });

  return sorted;
}

function normalizeScreenerFilters(filters: Partial<Record<keyof ScreenerFilters, unknown>> | undefined): ScreenerFilters {
  return {
    minPrice: toOptionalNumber(filters?.minPrice),
    maxPrice: toOptionalNumber(filters?.maxPrice),
    minMomentumScore: toOptionalNumber(filters?.minMomentumScore),
    minVolumeRatio: toOptionalNumber(filters?.minVolumeRatio),
    maxRsi14: toOptionalNumber(filters?.maxRsi14),
    minWeek52RangePosition: toOptionalNumber(filters?.minWeek52RangePosition),
    maxDistanceFromHigh52: toOptionalNumber(filters?.maxDistanceFromHigh52),
    maxPeRatio: toOptionalNumber(filters?.maxPeRatio),
    maxPriceToBook: toOptionalNumber(filters?.maxPriceToBook),
    minRevenueGrowth: toOptionalNumber(filters?.minRevenueGrowth),
    minProfitMargins: toOptionalNumber(filters?.minProfitMargins),
  };
}

function applyScreenerFilters(opportunities: OpportunityCard[], filters: ScreenerFilters): OpportunityCard[] {
  return opportunities.filter((opportunity) => {
    const analytics = opportunity.analytics;
    if (!analytics) return false;

    if (hasMetricValue(filters.minPrice) && analytics.currentPrice < filters.minPrice) return false;
    if (hasMetricValue(filters.maxPrice) && analytics.currentPrice > filters.maxPrice) return false;
    if (hasMetricValue(filters.minMomentumScore) && (analytics.momentumScore || 0) < filters.minMomentumScore) return false;
    if (hasMetricValue(filters.minVolumeRatio) && (analytics.volumeRatio || 0) < filters.minVolumeRatio) return false;
    if (hasMetricValue(filters.maxRsi14) && (analytics.rsi14 || 100) > filters.maxRsi14) return false;
    if (hasMetricValue(filters.minWeek52RangePosition) && (analytics.week52RangePosition || 0) < filters.minWeek52RangePosition) return false;
    if (hasMetricValue(filters.maxDistanceFromHigh52) && (analytics.distanceFromHigh52 || -100) < -filters.maxDistanceFromHigh52) return false;
    if (hasMetricValue(filters.maxPeRatio) && (!hasMetricValue(analytics.peRatio) || analytics.peRatio > filters.maxPeRatio)) return false;
    if (hasMetricValue(filters.maxPriceToBook) && (!hasMetricValue(analytics.priceToBook) || analytics.priceToBook > filters.maxPriceToBook)) return false;
    if (hasMetricValue(filters.minRevenueGrowth) && (!hasMetricValue(analytics.revenueGrowth) || analytics.revenueGrowth < filters.minRevenueGrowth)) return false;
    if (hasMetricValue(filters.minProfitMargins) && (!hasMetricValue(analytics.profitMargins) || analytics.profitMargins < filters.minProfitMargins)) return false;

    return true;
  });
}

function buildScreenerDiagnostics(baseMatches: OpportunityCard[], filtered: OpportunityCard[], filters: ScreenerFilters): ScreenerDiagnostics {
  const total = Math.max(baseMatches.length, 1);
  const activeFilters = [
    hasMetricValue(filters.minPrice) ? { label: 'Min price', value: formatInr(filters.minPrice) } : null,
    hasMetricValue(filters.maxPrice) ? { label: 'Max price', value: formatInr(filters.maxPrice) } : null,
    hasMetricValue(filters.minMomentumScore) ? { label: 'Min momentum', value: String(filters.minMomentumScore) } : null,
    hasMetricValue(filters.minVolumeRatio) ? { label: 'Min volume ratio', value: `${filters.minVolumeRatio?.toFixed(1)}x` } : null,
    hasMetricValue(filters.maxRsi14) ? { label: 'Max RSI', value: String(filters.maxRsi14) } : null,
    hasMetricValue(filters.minWeek52RangePosition) ? { label: 'Min 52W range', value: `${filters.minWeek52RangePosition}%` } : null,
    hasMetricValue(filters.maxDistanceFromHigh52) ? { label: 'Near high', value: `within ${filters.maxDistanceFromHigh52}%` } : null,
    hasMetricValue(filters.maxPeRatio) ? { label: 'Max PE', value: String(filters.maxPeRatio) } : null,
    hasMetricValue(filters.maxPriceToBook) ? { label: 'Max P/B', value: String(filters.maxPriceToBook) } : null,
    hasMetricValue(filters.minRevenueGrowth) ? { label: 'Min rev growth', value: `${filters.minRevenueGrowth}%` } : null,
    hasMetricValue(filters.minProfitMargins) ? { label: 'Min profit margin', value: `${filters.minProfitMargins}%` } : null,
  ].filter((entry): entry is { label: string; value: string } => Boolean(entry));

  const fieldCoverage = {
    peRatio: Math.round((baseMatches.filter((entry) => hasMetricValue(entry.analytics?.peRatio)).length / total) * 100),
    priceToBook: Math.round((baseMatches.filter((entry) => hasMetricValue(entry.analytics?.priceToBook)).length / total) * 100),
    revenueGrowth: Math.round((baseMatches.filter((entry) => hasMetricValue(entry.analytics?.revenueGrowth)).length / total) * 100),
    profitMargins: Math.round((baseMatches.filter((entry) => hasMetricValue(entry.analytics?.profitMargins)).length / total) * 100),
  };

  const notes: string[] = [];

  if ([filters.maxPeRatio, filters.maxPriceToBook, filters.minRevenueGrowth, filters.minProfitMargins].some(hasMetricValue)) {
    notes.push('Fundamental filters only activate on names where the live provider returns that field.');
  }

  if (!activeFilters.length) {
    notes.push('No manual filters are active. Results are ranked by the selected playbook and sort model.');
  }

  if (filtered.length === 0 && baseMatches.length > 0) {
    notes.push('The active filter set removed every playbook match. Loosen one or two numeric thresholds first.');
  }

  return {
    activeFilters,
    filteredOut: Math.max(baseMatches.length - filtered.length, 0),
    baseMatches: baseMatches.length,
    fieldCoverage,
    notes,
  };
}

async function getIntradayPulses(symbols: string[]): Promise<Map<string, IntradayPulse>> {
  const uniqueSymbols = [...new Set(symbols.filter(Boolean))];
  const pulses = await Promise.all(uniqueSymbols.map(async (symbol) => {
    const bars = await MarketDataService.getHistoricalData(symbol, '1d');
    const validBars = bars.filter((bar) => bar.close > 0);
    if (validBars.length < 2) return null;

    const latest = validBars.at(-1);
    const previous5m = validBars.at(-2) || latest;
    const previous15m = validBars.at(-4) || previous5m || latest;
    if (!latest || !previous5m || !previous15m) return null;

    const recentVolumes = validBars
      .slice(Math.max(validBars.length - 7, 0), -1)
      .map((bar) => bar.volume)
      .filter((volume) => volume > 0);
    const averageVolume = average(recentVolumes);

    return {
      symbol,
      latestAt: latest.date,
      change5m: percentMove(latest.close, previous5m.close),
      change15m: percentMove(latest.close, previous15m.close),
      volumeSpike: averageVolume > 0 ? latest.volume / averageVolume : 1,
    };
  }));

  return new Map(pulses.filter((entry): entry is IntradayPulse => Boolean(entry)).map((entry) => [entry.symbol, entry]));
}

function buildRadarSignal(opportunity: OpportunityCard, pulse: IntradayPulse | undefined, mode: OpportunityMode): RadarSignal {
  const analytics = opportunity.analytics;
  const rangePosition = analytics?.week52RangePosition || 0;
  const change5m = pulse?.change5m || 0;
  const change15m = pulse?.change15m || 0;
  const volumeSpike = pulse?.volumeSpike || Math.max(analytics?.volumeRatio || 1, 1);
  const window = Math.abs(change5m) >= 0.45 || volumeSpike >= 1.7
    ? '5m'
    : Math.abs(change15m) >= 0.75
      ? '15m'
      : 'today';
  const occurredAt = pulse?.latestAt || isoNow();

  if (opportunity.direction === 'bearish' || opportunity.state === 'weakening') {
    return {
      id: `radar-signal-${opportunity.symbol}-risk`,
      symbol: opportunity.symbol,
      sector: opportunity.sector,
      type: 'risk',
      window,
      tone: 'bearish',
      title: `${opportunity.symbol} is slipping under pressure`,
      detail: `${opportunity.sector} is not supporting the move, and the last ${window} pulse is ${formatPercent(Math.min(change5m, change15m))}.`,
      strength: clamp(Math.round(opportunity.score + Math.abs(change15m) * 12), 35, 98),
      occurredAt,
    };
  }

  if (mode === 'pullback' || opportunity.setup.toLowerCase().includes('pullback')) {
    return {
      id: `radar-signal-${opportunity.symbol}-pullback`,
      symbol: opportunity.symbol,
      sector: opportunity.sector,
      type: 'pullback-ready',
      window,
      tone: 'balanced',
      title: `${opportunity.symbol} is setting up for a cleaner re-entry`,
      detail: `${opportunity.sector} remains supportive and short-term pressure is stabilizing with ${formatPercent(change15m)} over 15 minutes.`,
      strength: clamp(Math.round(opportunity.score + volumeSpike * 5), 35, 96),
      occurredAt,
    };
  }

  if (volumeSpike >= 1.8) {
    return {
      id: `radar-signal-${opportunity.symbol}-volume`,
      symbol: opportunity.symbol,
      sector: opportunity.sector,
      type: 'unusual-volume',
      window,
      tone: 'bullish',
      title: `${opportunity.symbol} is seeing unusual participation`,
      detail: `${opportunity.sector} has a live participation spike at ${volumeSpike.toFixed(1)}x recent 5-minute volume.`,
      strength: clamp(Math.round(opportunity.score + volumeSpike * 8), 35, 98),
      occurredAt,
    };
  }

  if (rangePosition >= 58 && (change15m >= 0.6 || change5m >= 0.35)) {
    return {
      id: `radar-signal-${opportunity.symbol}-breakout`,
      symbol: opportunity.symbol,
      sector: opportunity.sector,
      type: 'breakout',
      window,
      tone: 'bullish',
      title: `${opportunity.symbol} is pressing a breakout zone`,
      detail: `${opportunity.symbol} is in the top ${Math.round(100 - rangePosition)}% of its 52-week range with ${formatPercent(change15m)} over 15 minutes.`,
      strength: clamp(Math.round(opportunity.score + change15m * 12), 35, 98),
      occurredAt,
    };
  }

  return {
    id: `radar-signal-${opportunity.symbol}-sector`,
    symbol: opportunity.symbol,
    sector: opportunity.sector,
    type: 'sector-follow-through',
    window,
    tone: 'bullish',
    title: `${opportunity.symbol} is following sector strength`,
    detail: `${opportunity.sector} is broadening and ${opportunity.symbol} is confirming with ${formatPercent(change5m || opportunity.analytics?.changePercent || 0)} of live movement.`,
    strength: clamp(Math.round(opportunity.score + (analytics?.volumeRatio || 1) * 4), 35, 98),
    occurredAt,
  };
}

async function buildRadarSignals(opportunities: OpportunityCard[], mode: OpportunityMode): Promise<RadarSignal[]> {
  const signalCandidates = opportunities.slice(0, 8);
  const pulses = await getIntradayPulses(signalCandidates.map((entry) => entry.symbol));
  const windowRank = { '5m': 0, '15m': 1, today: 2 } as const;

  return signalCandidates
    .map((opportunity) => buildRadarSignal(opportunity, pulses.get(opportunity.symbol), mode))
    .sort((left, right) => windowRank[left.window] - windowRank[right.window] || right.strength - left.strength)
    .slice(0, 8);
}

function buildRadarWindowInsights(signalFeed: RadarSignal[]): RadarWindowInsight[] {
  return (['5m', '15m', 'today'] as const).map((window) => {
    const entries = signalFeed.filter((signal) => signal.window === window);
    const lead = entries[0];

    return {
      window,
      label: window === '5m' ? 'Last 5 minutes' : window === '15m' ? 'Last 15 minutes' : 'Today',
      summary: entries.length
        ? `${entries.length} ${entries.length === 1 ? 'signal is' : 'signals are'} active here, led by ${lead?.symbol || lead?.sector || 'the tape'}.`
        : window === 'today'
          ? 'Session-level context is driving the radar more than fresh tape bursts.'
          : 'No standout tape burst is active in this window right now.',
      signalCount: entries.length,
      leadingSymbol: lead?.symbol,
      leadingSector: lead?.sector,
    };
  });
}

function buildSectorShiftSignals(sectors: SectorOverview[], opportunities: OpportunityCard[]): SectorShiftSignal[] {
  const matchCounts = new Map<string, number>();

  for (const opportunity of opportunities) {
    matchCounts.set(opportunity.sector, (matchCounts.get(opportunity.sector) || 0) + 1);
  }

  return sectors
    .map((sector) => {
      const direction: SectorShiftSignal['direction'] = sector.trend === 'bullish'
        ? 'strengthening'
        : sector.trend === 'bearish'
          ? 'weakening'
          : 'mixed';

      return {
        sector: sector.sector,
        direction,
        summary: sector.trend === 'bullish'
          ? `${sector.sector} is strengthening with ${sector.breadth.toFixed(0)}% breadth and ${matchCounts.get(sector.sector) || 0} ranked radar names.`
          : sector.trend === 'bearish'
            ? `${sector.sector} is weakening with ${sector.breadth.toFixed(0)}% breadth and still requires caution.`
            : `${sector.sector} is mixed, so only stock-specific setups deserve attention.`,
        breadth: sector.breadth,
        averageChangePercent: sector.averageChangePercent,
        signalCount: matchCounts.get(sector.sector) || 0,
        leaderSymbol: sector.leader?.symbol,
        laggardSymbol: sector.laggard?.symbol,
      };
    })
    .sort((left, right) => right.signalCount - left.signalCount || Math.abs(right.breadth) - Math.abs(left.breadth))
    .slice(0, 6);
}

function buildScreenerNarrative(
  playbook: ScreenerPlaybook,
  sector: string | 'all',
  opportunities: OpportunityCard[],
  coverage: InsightCoverage,
): string {
  const lead = opportunities[0];

  if (playbook === 'avoid') {
    return `The screener is in defense mode, surfacing ${coverage.matches} names where timing quality or sector context looks weak enough to avoid.`;
  }

  if (sector !== 'all') {
    return lead
      ? `${sector} is the active focus. ${lead.symbol} currently sets the bar for this playbook, with ${coverage.matches} matches across ${coverage.stocksAnalyzed} analyzed names.`
      : `${sector} is the active focus, but the current playbook is not finding enough clean matches yet.`;
  }

  return lead
    ? `${lead.symbol} leads this ${playbook} screen after a market-wide sweep across ${coverage.sectorsScanned} sectors and ${coverage.stocksAnalyzed} analyzed names.`
    : `The current playbook is scanning broadly, but conviction is still too thin to surface strong matches.`;
}

function buildStockStoryDeterministic(research: StockResearch): StockStory {
  const quote = research.quote;
  const analytics = research.analytics;
  const sector = research.sectorOverview;
  const volumeRatio = analytics?.volumeRatio || 1;
  const rsi = analytics?.rsi14 || 50;
  const rangePosition = analytics?.week52RangePosition || 0;
  const sectorTrend = sector?.trend || 'neutral';

  const stance: StockStory['stance'] = analytics?.trend === 'bullish' && rangePosition < 82 && volumeRatio >= 1.15
    ? 'strong'
    : analytics?.trend === 'bullish' && rangePosition < 65
      ? 'early'
      : analytics?.trend === 'bullish' && (rangePosition >= 82 || rsi >= 70)
        ? 'extended'
        : analytics?.trend === 'bearish' || (quote?.changePercent || 0) < -1
          ? 'weak'
          : 'mixed';
  const horizonFit: StockStory['horizonFit'] = volumeRatio >= 1.35 && Math.abs(quote?.changePercent || 0) >= 1
    ? 'intraday'
    : analytics?.trend === 'bullish'
      ? 'swing'
      : 'watch-only';
  const currentPrice = analytics?.currentPrice || quote?.price || 0;
  const support = analytics?.sma20 || currentPrice * 0.975;
  const resistance = currentPrice * 1.008;
  const trigger = analytics?.trend === 'bearish' ? currentPrice * 1.01 : resistance;
  const invalidation = analytics?.trend === 'bearish' ? currentPrice * 1.02 : support;

  const summary = `${research.profile.name} is ${stance}, not generic. ${research.profile.primarySector} is ${sectorTrend === 'bullish' ? 'supportive' : sectorTrend === 'bearish' ? 'a headwind' : 'mixed'}, and the current setup suits ${horizonFit === 'watch-only' ? 'watching, not forcing' : `${horizonFit} traders`} best.`;
  const evidence = [
    `Sector breadth is ${sector ? `${sector.breadth.toFixed(0)}%` : 'unavailable'}.`,
    `Momentum score is ${analytics ? analytics.momentumScore.toFixed(0) : 'not available'}.`,
    `Volume is ${volumeRatio.toFixed(1)}x the recent average.`,
  ];
  const timeline: StoryTimelineEntry[] = [
    {
      label: 'Market context',
      detail: `${research.profile.primarySector} is ${sectorTrend === 'bullish' ? 'providing tailwind' : sectorTrend === 'bearish' ? 'creating drag' : 'offering mixed support'} for this name.`,
      tone: sectorTrend === 'bullish' ? 'bullish' : sectorTrend === 'bearish' ? 'bearish' : 'neutral',
    },
    {
      label: 'Price structure',
      detail: `${research.profile.symbol} is trading ${rangePosition >= 80 ? 'close to its upper range' : rangePosition <= 35 ? 'well below prior highs' : 'in the middle of its range'}, with RSI near ${rsi.toFixed(0)}.`,
      tone: stance === 'strong' || stance === 'early' ? 'bullish' : stance === 'weak' ? 'bearish' : 'balanced',
    },
    {
      label: 'Participation',
      detail: volumeRatio >= 1.2
        ? 'Participation is confirming the move.'
        : 'Participation is still modest, so the setup needs more proof.',
      tone: volumeRatio >= 1.2 ? 'bullish' : 'balanced',
    },
  ];

  return {
    stance,
    horizonFit,
    summary,
    whyMoving: {
      primary: sectorTrend === 'bullish'
        ? `${research.profile.primarySector} is providing the main tailwind, and the stock is participating with improving structure.`
        : sectorTrend === 'bearish'
          ? `${research.profile.primarySector} is weak, so the stock is fighting a difficult backdrop.`
          : 'The move is mostly stock-specific right now because sector support is still mixed.',
      secondary: volumeRatio >= 1.2
        ? `Volume confirmation at ${volumeRatio.toFixed(1)}x is helping the move look real.`
        : 'Volume confirmation is still light, so this setup needs one more proof point.',
      confidence: clamp(Math.round((analytics?.momentumScore || 0) + (sector?.breadth || 0) / 4 + 50), 35, 94),
      evidence,
      watchNext: analytics?.trend === 'bearish'
        ? `Watch for a reclaim of ${formatInr(trigger)} before treating the damage as repaired.`
        : `Watch whether price can hold above ${formatInr(trigger)} without losing support near ${formatInr(invalidation)}.`,
      risk: stance === 'extended'
        ? 'The story is still constructive, but timing quality is deteriorating.'
        : stance === 'weak'
          ? 'The setup is vulnerable until sector pressure eases.'
          : 'The setup breaks down quickly if support is lost on weak participation.',
    },
    setupMap: {
      trigger: formatInr(trigger),
      invalidation: formatInr(invalidation),
      support: formatInr(support),
      resistance: formatInr(resistance),
      stage: stance === 'extended' ? 'extended' : stance === 'early' ? 'building' : stance === 'weak' ? 'weakening' : 'ready',
    },
    bullCase: [
      `${research.profile.primarySector} stays supportive instead of giving back breadth.`,
      `Volume keeps holding above normal and price respects ${formatInr(invalidation)}.`,
      `Relative strength stays intact versus sector peers.`,
    ],
    bearCase: [
      `Sector leadership narrows and this stock stops confirming with participation.`,
      `Price loses ${formatInr(invalidation)} and turns the current structure into a failed move.`,
      `The stock remains near highs without fresh participation, which raises chase risk.`,
    ],
    timeline,
    generatedAt: isoNow(),
    sourceMode: 'deterministic',
  };
}

export class MarketInsightsService {
  static async getTodayDesk(): Promise<TodayDesk> {
    return loadWithCache('insights:today', TTL.today, async () => {
      const [summary, sectors, news] = await Promise.all([
        MarketDataService.getMarketSummary(),
        MarketDataService.getAllSectorsData(),
        NewsService.getCuratedNews('all', undefined, 18),
      ]);
      const selectedSectors = [
        ...sectors.filter((sector) => sector.trend === 'bullish').slice(0, 3),
        ...sectors.filter((sector) => sector.trend === 'bearish').slice(0, 2),
      ];
      const candidates = await getSectorCandidates(selectedSectors, 6);
      const newsMap = relatedNewsMap(news);
      const opportunities = dedupeBySymbol(candidates.map(({ sector, row }) => row))
        .map((row) => {
          const sector = selectedSectors.find((entry) => entry.sector === row.sector) || selectedSectors[0];
          if (!sector) return null;
          return buildOpportunity(row, sector, newsMap.get(row.symbol) || [], 'swing', 'guided');
        })
        .filter((entry): entry is OpportunityCard => Boolean(entry))
        .sort((left, right) => right.score - left.score);
      const narrative = buildMarketNarrative(summary, sectors);
      const desk: TodayDesk = {
        narrative,
        sectorRotation: sectors.slice(0, 8).map(buildSectorRotationInsight),
        opportunityStack: opportunities.slice(0, 5),
        stocksToWatch: opportunities.filter((entry) => entry.state !== 'extended').slice(0, 5),
        recap: buildRecap(opportunities, sectors),
        generatedAt: isoNow(),
        sourceMode: 'deterministic',
      };

      return maybeRewriteTodayCopy(desk, sectors);
    });
  }

  static async getOpportunityRadar(
    mode: OpportunityMode = 'momentum',
    horizon: TradingHorizon = 'intraday',
    selectivity: Selectivity = 'balanced',
  ): Promise<RadarResponse> {
    const cacheKey = `insights:radar:${mode}:${horizon}:${selectivity}`;
    return loadWithCache(cacheKey, TTL.radar, async () => {
      const sectors = await MarketDataService.getAllSectorsData();
      const selectedSectors = sortSectorsForRadar(sectors, mode);
      const [candidates, news] = await Promise.all([
        getSectorCandidates(selectedSectors, radarSectorLimitBySelectivity(selectivity)),
        NewsService.getCuratedNews('all', undefined, 18),
      ]);
      const newsMap = relatedNewsMap(news);
      const filtered = buildOpportunityPool(candidates, mode, horizon, newsMap)
        .slice(0, radarLimitBySelectivity(selectivity));
      const coverage = buildCoverage(selectedSectors, candidates, filtered);
      const sectorFocus = buildSectorScanInsights(selectedSectors, candidates, filtered);
      const signalFeed = await buildRadarSignals(filtered, mode);
      const windowInsights = buildRadarWindowInsights(signalFeed);
      const sectorShifts = buildSectorShiftSignals(selectedSectors, filtered);

      return {
        mode,
        horizon,
        selectivity,
        narrative: buildRadarNarrative(mode, filtered, selectedSectors),
        coverage,
        sectorFocus,
        signalFeed,
        windowInsights,
        sectorShifts,
        opportunities: filtered,
        refreshIntervalSeconds: RADAR_REFRESH_INTERVAL_SECONDS,
        generatedAt: isoNow(),
        sourceMode: 'deterministic',
      };
    });
  }

  static async getGuidedScreener(
    playbook: ScreenerPlaybook = 'leadership',
    horizon: TradingHorizon = 'swing',
    selectivity: Selectivity = 'balanced',
    sortBy: ScreenerSort = 'score',
    sector: string | 'all' = 'all',
    filters?: Partial<Record<keyof ScreenerFilters, unknown>>,
  ): Promise<GuidedScreenerResponse> {
    const normalizedSector = sector === 'all' ? 'all' : sector.trim();
    const normalizedFilters = normalizeScreenerFilters(filters);
    const cacheKey = `insights:screener:${playbook}:${horizon}:${selectivity}:${sortBy}:${normalizedSector}:${JSON.stringify(normalizedFilters)}`;

    return loadWithCache(cacheKey, TTL.radar, async () => {
      const sectors = sortSectorsForScreener(await MarketDataService.getAllSectorsData(), normalizedSector);
      const [candidates, news] = await Promise.all([
        getSectorCandidates(sectors, screenerSectorLimitBySelectivity(selectivity, normalizedSector)),
        NewsService.getCuratedNews('all', undefined, 18),
      ]);
      const newsMap = relatedNewsMap(news);
      const mode = playbookToMode(playbook);
      const opportunityPool = buildOpportunityPool(candidates, mode, horizon, newsMap);
      const strictMatches = opportunityPool.filter((opportunity) => matchesScreenerPlaybook(opportunity, playbook, false));
      const relaxedMatches = opportunityPool.filter((opportunity) => matchesScreenerPlaybook(opportunity, playbook, true));
      const baseMatches = strictMatches.length >= 8 ? strictMatches : (relaxedMatches.length ? relaxedMatches : opportunityPool);
      const filteredMatches = applyScreenerFilters(baseMatches, normalizedFilters);
      const opportunities = sortScreenerOpportunities(
        filteredMatches.length ? filteredMatches : baseMatches,
        sortBy,
      ).slice(0, screenerLimitBySelectivity(selectivity));
      const coverage = buildCoverage(sectors, candidates, opportunities);
      const sectorFocus = buildSectorScanInsights(sectors, candidates, opportunities, normalizedSector === 'all' ? 10 : 1);
      const diagnostics = buildScreenerDiagnostics(baseMatches, filteredMatches, normalizedFilters);

      return {
        playbook,
        horizon,
        selectivity,
        sortBy,
        sector: normalizedSector,
        filters: normalizedFilters,
        narrative: buildScreenerNarrative(playbook, normalizedSector, opportunities, coverage),
        coverage,
        sectorFocus,
        diagnostics,
        opportunities,
        generatedAt: isoNow(),
        sourceMode: 'deterministic',
      };
    });
  }

  static async getStockStory(symbol: string): Promise<StockStory | null> {
    const cacheKey = `insights:stock:${symbol.trim().toUpperCase()}`;
    return loadWithCache(cacheKey, TTL.stock, async () => {
      const research = await MarketDataService.getStockResearch(symbol);
      if (!research) return null;
      const story = buildStockStoryDeterministic(research);
      return maybeRewriteStockStory(story, research);
    });
  }
}