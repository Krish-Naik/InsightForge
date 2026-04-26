/**
 * radarEngineService.ts
 * ─────────────────────
 * Dedicated engine for the Radar page ONLY.
 * Provides: breakouts, breakdowns, volume spikes, RSI signals,
 * momentum alerts, and support/resistance data.
 *
 * NEVER import this in Today or Screener page logic.
 */

import { YahooFinanceService } from './yahooFinanceService.js';
import { getAllStocks, getScannerCache } from './stockCacheService.js';
import { logger } from '../utils/logger.js';
import type { Quote, ScreenerMetric } from './marketTypes.js';

// ── Types ────────────────────────────────────────────────────────────────────
export type SignalType =
  | 'breakout'
  | 'breakdown'
  | 'volume-spike'
  | 'rsi-oversold'
  | 'rsi-overbought'
  | 'momentum-surge'
  | 'reversal-watch';

export type SignalStrength = 'strong' | 'moderate' | 'weak';
export type SignalDirection = 'bullish' | 'bearish' | 'neutral';

export interface RadarSignalCard {
  id:              string;
  symbol:          string;
  name:            string;
  exchange:        string;
  signalType:      SignalType;
  direction:       SignalDirection;
  strength:        SignalStrength;
  confidence:      number;          // 0–100
  price:           number;
  currentPrice:    number | null;
  changePercent:   number;
  volume:          number;
  volumeRatio:     number;          // relative to universe avg
  week52Position:  number;          // 0–100 (% within 52w range)
  rsiEstimate:    number;          // heuristic RSI from price position
  entryZone:       number | null;
  stopLoss:        number | null;
  target:          number | null;
  support:         number | null;
  resistance:      number | null;
  whyNow:         string;
  sector:         string;
  timestamp:       string;
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

// ── Helpers ──────────────────────────────────────────────────────────────────
function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function calcWeek52Position(price: number, low52: number, high52: number): number {
  if (high52 <= low52 || !high52 || !low52) return 50;
  return clamp(((price - low52) / (high52 - low52)) * 100, 0, 100);
}

/** Heuristic RSI estimate from price position + momentum */
function estimateRsi(pos52: number, changePercent: number): number {
  const base = 30 + (pos52 * 0.4);               // 30–70 from 52-week position
  const momentum = clamp(changePercent * 2, -15, 15);
  return clamp(Math.round(base + momentum), 10, 95);
}

function calcEntryStopTarget(
  price: number,
  direction: SignalDirection,
  low52: number,
  high52: number,
): { entry: number | null; stop: number | null; target: number | null } {
  if (!price || price <= 0) return { entry: null, stop: null, target: null };
  if (direction === 'bullish') {
    const entry  = price;
    const stop   = Math.round(Math.max(price * 0.96, low52 * 1.01) * 100) / 100;
    const target = Math.round(Math.min(price * 1.08, high52 * 1.02) * 100) / 100;
    return { entry, stop, target };
  }
  if (direction === 'bearish') {
    const entry  = price;
    const stop   = Math.round(Math.min(price * 1.04, high52 * 0.99) * 100) / 100;
    const target = Math.round(Math.max(price * 0.92, low52 * 0.98) * 100) / 100;
    return { entry, stop, target };
  }
  return { entry: price, stop: null, target: null };
}

function strengthFromConfidence(c: number): SignalStrength {
  if (c >= 72) return 'strong';
  if (c >= 52) return 'moderate';
  return 'weak';
}

function buildWhyNow(
  type: SignalType,
  symbol: string,
  pos52: number,
  volRatio: number,
  rsi: number,
  changePercent: number,
): string {
  switch (type) {
    case 'breakout':
      return `${symbol} is at ${pos52.toFixed(0)}% of its 52-week range with ${volRatio.toFixed(1)}× normal volume — classic breakout conditions.`;
    case 'breakdown':
      return `${symbol} is near its 52-week low (${pos52.toFixed(0)}% range) with ${volRatio.toFixed(1)}× selling volume — breakdown risk is elevated.`;
    case 'volume-spike':
      return `Unusual volume at ${volRatio.toFixed(1)}× the universe average signals significant interest in ${symbol}.`;
    case 'rsi-oversold':
      return `${symbol} is deeply oversold (RSI ~${rsi}) after a ${changePercent.toFixed(1)}% session drop — potential reversal setup forming.`;
    case 'rsi-overbought':
      return `${symbol} is extended (RSI ~${rsi}) at ${pos52.toFixed(0)}% of its 52-week range — momentum strong but entry risk is rising.`;
    case 'momentum-surge':
      return `${symbol} is surging ${changePercent.toFixed(1)}% with ${volRatio.toFixed(1)}× volume — momentum aligned with participation.`;
    case 'reversal-watch':
      return `${symbol} shows early signs of reversal — watch for confirmation above/below key levels.`;
    default:
      return `${symbol} is showing notable price and volume behaviour today.`;
  }
}

// ── Calculate Support/Resistance (pivot + Fibonacci, more accurate) ──────────
function calcSupportResistance(price: number, low52: number, high52: number): { support: number; resistance: number } {
  const range = high52 - low52;
  if (range <= 0 || !low52 || !high52 || price <= 0) {
    return {
      support:    Math.round(price * 0.955 * 100) / 100,
      resistance: Math.round(price * 1.045 * 100) / 100,
    };
  }

  // Fibonacci retracement levels across the 52w range
  const fib382 = low52 + range * 0.382;
  const fib500 = low52 + range * 0.500;
  const fib618 = low52 + range * 0.618;

  // Round-number magnetism
  const roundUnit  = price >= 1000 ? 50 : price >= 200 ? 10 : price >= 50 ? 5 : 1;
  const roundBelow = Math.floor(price / roundUnit) * roundUnit;
  const roundAbove = Math.ceil(price / roundUnit) * roundUnit;

  // Nearest fib below as support, fib above as resistance
  const fibLevels = [fib382, fib500, fib618];
  const supportFib = fibLevels
    .filter(f => f < price && f > low52 * 1.01)
    .reduce<number | null>((best, f) =>
      best === null || Math.abs(price - f) < Math.abs(price - best) ? f : best, null);
  const resistanceFib = fibLevels
    .filter(f => f > price && f < high52 * 0.99)
    .reduce<number | null>((best, f) =>
      best === null || Math.abs(price - f) < Math.abs(price - best) ? f : best, null);

  const support    = Math.round((supportFib ?? Math.max(roundBelow, low52 * 1.01, price * 0.95)) * 100) / 100;
  const resistance = Math.round((resistanceFib ?? Math.min(roundAbove > price ? roundAbove : price * 1.05, high52 * 0.99, price * 1.05)) * 100) / 100;

  return { support, resistance };
}

// ── Signal builders ───────────────────────────────────────────────────────────
function buildCard(
  quote: Quote & { sector?: string },
  type: SignalType,
  direction: SignalDirection,
  confidence: number,
  avgVolume: number,
): RadarSignalCard {
  const pos52    = calcWeek52Position(quote.price, quote.low52w, quote.high52w);
  const volRatio = avgVolume > 0 ? quote.volume / avgVolume : 1;
  const rsi      = estimateRsi(pos52, quote.changePercent);
  const { entry, stop, target } = calcEntryStopTarget(
    quote.price, direction, quote.low52w, quote.high52w,
  );
  const { support, resistance } = calcSupportResistance(
    quote.price, quote.low52w, quote.high52w,
  );

  return {
    id:             `${type}-${quote.symbol}-${Date.now()}`,
    symbol:         quote.symbol,
    name:           quote.name,
    exchange:       quote.exchange,
    signalType:     type,
    direction,
    strength:       strengthFromConfidence(confidence),
    confidence:     clamp(Math.round(confidence), 35, 97),
    price:          quote.price,
    currentPrice:   quote.price,
    changePercent:  quote.changePercent,
    volume:         quote.volume,
    volumeRatio:    Math.round(volRatio * 10) / 10,
    week52Position: Math.round(pos52),
    rsiEstimate:    rsi,
    entryZone:      entry,
    stopLoss:       stop,
    target,
    support,
    resistance,
    whyNow:         buildWhyNow(type, quote.symbol, pos52, volRatio, rsi, quote.changePercent),
    sector:         quote.sector || 'Unclassified',
    timestamp:      quote.timestamp,
  };
}

// ── Main engine ───────────────────────────────────────────────────────────────
export class RadarEngineService {
  /**
   * Build a full radar snapshot from cached stock data.
   * Reads from Redis cache (written by the batch worker) — no live API calls.
   */
  static async getSnapshot(limit = 40): Promise<RadarSnapshot> {
    const now = new Date().toISOString();

    // Load all cached quotes
    let rawStocks = await getAllStocks();

    // Fall back to Yahoo market movers if cache is cold
    if (rawStocks.length < 20) {
      logger.warn('Radar: cache cold, falling back to live movers fetch');
      try {
        const live = await YahooFinanceService.getMarketMovers('gainers', 100);
        rawStocks = live.map(q => ({
          symbol:        q.symbol,
          price:         q.price,
          change:        q.change,
          changePercent: q.changePercent,
          volume:        q.volume,
          dayHigh:       q.dayHigh,
          dayLow:        q.dayLow,
          previousClose: q.previousClose,
          open:          q.open,
          high52w:       q.high52w,
          low52w:        q.low52w,
          marketCap:     q.marketCap,
          marketState:   q.marketState,
          exchange:      q.exchange,
          timestamp:     q.timestamp,
        }));
      } catch (err) {
        logger.warn(`Radar fallback fetch failed: ${(err as Error).message}`);
      }
    }

    const usable = rawStocks.filter(s => s.price > 0 && s.volume > 0);
    const avgVol  = usable.length > 0
      ? usable.reduce((sum, s) => sum + s.volume, 0) / usable.length
      : 0;

    const quotes = usable.map(s => ({
      symbol:        s.symbol,
      name:          s.symbol,
      price:         s.price,
      changePercent: s.changePercent,
      volume:        s.volume,
      dayHigh:       s.dayHigh,
      dayLow:        s.dayLow,
      previousClose: s.previousClose,
      open:          s.open,
      change:        s.change,
      high52w:       s.high52w,
      low52w:        s.low52w,
      marketCap:     s.marketCap,
      currency:      'INR',
      marketState:   s.marketState,
      exchange:      s.exchange,
      timestamp:     s.timestamp,
      isStale:       false as const,
    }));

    // ── Breakouts ─────────────────────────────────────────────────────────────
    const breakouts = quotes
      .filter(q => {
        const pos = calcWeek52Position(q.price, q.low52w, q.high52w);
        const vr  = avgVol > 0 ? q.volume / avgVol : 0;
        return pos >= 92 && vr >= 1.4 && q.changePercent >= 1;
      })
      .sort((a, b) => b.changePercent - a.changePercent)
      .slice(0, limit)
      .map(q => {
        const pos = calcWeek52Position(q.price, q.low52w, q.high52w);
        const vr  = avgVol > 0 ? q.volume / avgVol : 1;
        const conf = clamp(50 + pos * 0.3 + vr * 6 + q.changePercent * 2, 55, 97);
        return buildCard(q, 'breakout', 'bullish', conf, avgVol);
      });

    // ── Breakdowns ────────────────────────────────────────────────────────────
    const breakdowns = quotes
      .filter(q => {
        const pos = calcWeek52Position(q.price, q.low52w, q.high52w);
        const vr  = avgVol > 0 ? q.volume / avgVol : 0;
        return pos <= 8 && vr >= 1.3 && q.changePercent <= -1;
      })
      .sort((a, b) => a.changePercent - b.changePercent)
      .slice(0, limit)
      .map(q => {
        const pos = calcWeek52Position(q.price, q.low52w, q.high52w);
        const vr  = avgVol > 0 ? q.volume / avgVol : 1;
        const conf = clamp(50 + (100 - pos) * 0.3 + vr * 6 + Math.abs(q.changePercent) * 2, 50, 96);
        return buildCard(q, 'breakdown', 'bearish', conf, avgVol);
      });

    // ── Volume spikes ─────────────────────────────────────────────────────────
    const volumeSpikes = quotes
      .filter(q => avgVol > 0 && q.volume > avgVol * 3 && Math.abs(q.changePercent) >= 0.5)
      .sort((a, b) => b.volume - a.volume)
      .slice(0, limit)
      .map(q => {
        const vr   = avgVol > 0 ? q.volume / avgVol : 1;
        const dir: SignalDirection = q.changePercent >= 0 ? 'bullish' : 'bearish';
        const conf = clamp(52 + Math.log10(vr) * 20 + Math.abs(q.changePercent) * 1.5, 50, 94);
        return buildCard(q, 'volume-spike', dir, conf, avgVol);
      });

    // ── RSI signals ───────────────────────────────────────────────────────────
    const rsiOversold = quotes
      .filter(q => {
        const pos = calcWeek52Position(q.price, q.low52w, q.high52w);
        return pos < 18 && q.changePercent <= -0.5;
      })
      .sort((a, b) => a.changePercent - b.changePercent)
      .slice(0, limit)
      .map(q => {
        const rsi  = estimateRsi(calcWeek52Position(q.price, q.low52w, q.high52w), q.changePercent);
        const conf = clamp(85 - rsi + Math.abs(q.changePercent) * 2, 45, 92);
        return buildCard(q, 'rsi-oversold', 'bullish', conf, avgVol);
      });

    const rsiOverbought = quotes
      .filter(q => {
        const pos = calcWeek52Position(q.price, q.low52w, q.high52w);
        return pos > 84 && q.changePercent >= 0.5;
      })
      .sort((a, b) => b.changePercent - a.changePercent)
      .slice(0, limit)
      .map(q => {
        const rsi  = estimateRsi(calcWeek52Position(q.price, q.low52w, q.high52w), q.changePercent);
        const conf = clamp(rsi - 20 + q.changePercent * 2, 45, 92);
        return buildCard(q, 'rsi-overbought', 'bearish', conf, avgVol);
      });

    // ── Momentum surge ────────────────────────────────────────────────────────
    const momentumSurge = quotes
      .filter(q => {
        const vr = avgVol > 0 ? q.volume / avgVol : 0;
        return q.changePercent >= 2.5 && vr >= 1.2;
      })
      .sort((a, b) => b.changePercent - a.changePercent)
      .slice(0, limit)
      .map(q => {
        const vr   = avgVol > 0 ? q.volume / avgVol : 1;
        const conf = clamp(50 + q.changePercent * 3 + vr * 5, 52, 96);
        return buildCard(q, 'momentum-surge', 'bullish', conf, avgVol);
      });

    // ── Reversal watch ────────────────────────────────────────────────────────
    const reversalWatch = quotes
      .filter(q => {
        const pos = calcWeek52Position(q.price, q.low52w, q.high52w);
        const vr  = avgVol > 0 ? q.volume / avgVol : 0;
        // Bears that are now seeing buying volume, or bulls losing steam
        return (
          (pos < 30 && q.changePercent >= 0.5 && vr >= 1.1) ||
          (pos > 75 && q.changePercent <= -0.8 && vr >= 1.2)
        );
      })
      .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
      .slice(0, limit)
      .map(q => {
        const pos = calcWeek52Position(q.price, q.low52w, q.high52w);
        const dir: SignalDirection = q.changePercent >= 0 ? 'bullish' : 'bearish';
        const conf = clamp(45 + Math.abs(q.changePercent) * 3 + (pos < 30 ? 10 : 0), 42, 88);
        return buildCard(q, 'reversal-watch', dir, conf, avgVol);
      });

    const totalSignals =
      breakouts.length + breakdowns.length + volumeSpikes.length +
      rsiOversold.length + rsiOverbought.length + momentumSurge.length + reversalWatch.length;

    logger.info(`Radar snapshot: ${totalSignals} signals (bo=${breakouts.length} bd=${breakdowns.length} vs=${volumeSpikes.length} rs=${rsiOversold.length})`);

    return {
      breakouts,
      breakdowns,
      volumeSpikes,
      rsiOversold,
      rsiOverbought,
      momentumSurge,
      reversalWatch,
      marketAvgVolume: Math.round(avgVol),
      generatedAt: now,
      totalSignals,
    };
  }

  /**
   * Get support/resistance levels for a specific symbol.
   * Uses SMA anchoring, pivot clustering, and recent price action.
   * More robust than simple percentage offsets from 52w range.
   */
  static async getSupportResistance(symbol: string): Promise<SupportResistanceLevel | null> {
    try {
      // Fetch 6 months for better pivot detection
      const bars = await YahooFinanceService.getHistoricalData(symbol, '6mo');
      if (bars.length < 15) return null;

      const closes  = bars.map(b => b.close).filter(c => c > 0);
      const highs   = bars.map(b => b.high).filter(h => h > 0);
      const lows    = bars.map(b => b.low).filter(l => l > 0);
      const volumes = bars.map(b => b.volume || 0);

      const latest = closes.at(-1) ?? 0;
      if (!latest) return null;

      // ── SMA levels (strong dynamic S/R) ──────────────────────────────────
      const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
      const sma20 = avg(closes.slice(-20));
      const sma50 = avg(closes.slice(-50));
      const smaAll = closes.length >= 200 ? avg(closes.slice(-200)) : sma50;

      // ── Pivot points (last 5 and 20 sessions) ────────────────────────────
      const recentHighs20 = highs.slice(-20);
      const recentLows20  = lows.slice(-20);
      const pivotHigh5    = Math.max(...highs.slice(-5));
      const pivotLow5     = Math.min(...lows.slice(-5));
      const pivotHigh20   = Math.max(...recentHighs20);
      const pivotLow20    = Math.min(...recentLows20);

      // ── Volume-weighted nearby zones ─────────────────────────────────────
      // Find the price levels with highest traded volume (acting as value areas)
      let maxVolume = 0;
      let volWeightedPrice = latest;
      for (let i = 0; i < closes.length; i++) {
        if (volumes[i] > maxVolume) {
          maxVolume = volumes[i];
          volWeightedPrice = closes[i];
        }
      }

      // ── Round-number magnetism ────────────────────────────────────────────
      // Prices cluster near round numbers (100, 500, 1000, etc.)
      const roundUnit = latest >= 1000 ? 50 : latest >= 500 ? 20 : latest >= 100 ? 10 : latest >= 50 ? 5 : 1;
      const nearestRoundBelow = Math.floor(latest / roundUnit) * roundUnit;
      const nearestRoundAbove = Math.ceil(latest / roundUnit) * roundUnit;

      // ── Compute final S/R ─────────────────────────────────────────────────
      // Support: strongest floor below current price
      const supportCandidates = [
        sma20 * 0.998,
        sma50 * 0.995,
        pivotLow20,
        pivotLow5,
        nearestRoundBelow,
        volWeightedPrice < latest ? volWeightedPrice : latest * 0.98,
      ].filter(v => v > 0 && v < latest);

      // Resistance: strongest ceiling above current price
      const resistanceCandidates = [
        pivotHigh20,
        pivotHigh5,
        sma20 * 1.002,
        nearestRoundAbove,
        volWeightedPrice > latest ? volWeightedPrice : latest * 1.03,
        latest * 1.05,
      ].filter(v => v > 0 && v > latest);

      // Prefer the closest candidate to current price
      const support    = supportCandidates.length > 0
        ? supportCandidates.reduce((best, v) => Math.abs(latest - v) < Math.abs(latest - best) ? v : best, supportCandidates[0])
        : latest * 0.96;

      const resistance = resistanceCandidates.length > 0
        ? resistanceCandidates.reduce((best, v) => Math.abs(latest - v) < Math.abs(latest - best) ? v : best, resistanceCandidates[0])
        : latest * 1.04;

      // ── Trend determination ───────────────────────────────────────────────
      const trend: SupportResistanceLevel['trend'] =
        latest > sma20 * 1.015 && sma20 > sma50 * 0.995 ? 'uptrend' :
        latest < sma20 * 0.985 && sma20 < sma50 * 1.005 ? 'downtrend' : 'sideways';

      return {
        symbol,
        price:      Math.round(latest * 100) / 100,
        support:    Math.round(support * 100) / 100,
        resistance: Math.round(resistance * 100) / 100,
        pivotHigh:  Math.round(pivotHigh20 * 100) / 100,
        pivotLow:   Math.round(pivotLow20 * 100) / 100,
        trend,
      };
    } catch (err) {
      logger.warn(`SupportResistance failed for ${symbol}: ${(err as Error).message}`);
      return null;
    }
  }
}
