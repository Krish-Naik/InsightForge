'use client';

/**
 * RADAR PAGE — Trading Intelligence Hub
 * ───────────────────────────────────────
 * Shows ONLY: breakouts, breakdowns, volume spikes, RSI signals,
 *             momentum surges, reversal watch, entry/stop/target.
 *
 * DOES NOT contain: general market overview, sector summaries,
 *                   or basic gainers/losers for information purposes.
 */

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowRight, BarChart2, BarChart3,
  ChevronDown, ChevronUp, RefreshCw, Shield,
  Target, TrendingDown, TrendingUp, Zap,
} from 'lucide-react';
import {
  marketAPI,
  type RadarSignalCard, type RadarSignalType, type RadarSnapshot,
} from '@/lib/api';
import { formatCurrency, formatLargeNumber, formatPercent } from '@/lib/format';

// ── Signal tab config ─────────────────────────────────────────────────────────
type SignalTab = 'all' | RadarSignalType;

interface TabConfig {
  id: SignalTab;
  label: string;
  icon: React.ElementType;
  color: string;
}

const TABS: TabConfig[] = [
  { id: 'all',            label: 'All Signals',     icon: Activity,      color: 'var(--accent)' },
  { id: 'breakout',       label: 'Breakouts',       icon: TrendingUp,    color: 'var(--green)' },
  { id: 'breakdown',      label: 'Breakdowns',      icon: TrendingDown,  color: 'var(--red)' },
  { id: 'volume-spike',   label: 'Vol Spikes',      icon: Zap,           color: 'var(--amber)' },
  { id: 'momentum-surge', label: 'Momentum',        icon: BarChart3,     color: '#a78bfa' },
  { id: 'rsi-oversold',   label: 'RSI Oversold',    icon: ChevronDown,   color: '#38bdf8' },
  { id: 'rsi-overbought', label: 'RSI Overbought',  icon: ChevronUp,     color: '#f97316' },
  { id: 'reversal-watch', label: 'Reversal Watch',  icon: AlertTriangle, color: '#facc15' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function directionColor(d: string) {
  if (d === 'bullish') return 'var(--green)';
  if (d === 'bearish') return 'var(--red)';
  return 'var(--text-3)';
}

function strengthColor(s: string) {
  if (s === 'strong')   return '#22c55e';
  if (s === 'moderate') return '#f59e0b';
  return '#64748b';
}

function getSignalColor(t: RadarSignalType) {
  return TABS.find(tab => tab.id === t)?.color || 'var(--accent)';
}

function tabTitle(t: SignalTab) {
  return TABS.find(tab => tab.id === t)?.label || t;
}

// ── Skeleton ─────────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="skeleton" style={{ height: 260, borderRadius: 14, background: 'var(--bg-2)', animation: 'skeleton-pulse 1.6s ease-in-out infinite' }} />
  );
}

// ── Confidence bar ────────────────────────────────────────────────────────────
function ConfidenceBar({ value }: { value: number }) {
  const pct   = Math.min(100, Math.max(0, value));
  const color = pct >= 72 ? '#22c55e' : pct >= 52 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 5, background: 'var(--bg-2)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.4s ease' }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color, minWidth: 32 }}>{Math.round(pct)}%</span>
    </div>
  );
}

// ── Price level display ───────────────────────────────────────────────────────
function PriceLevel({ label, value, color = 'var(--text-2)' }: { label: string; value: number | null; color?: string }) {
  if (!value) return null;
  return (
    <div style={{ textAlign: 'center', flex: 1 }}>
      <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', color }}>{formatCurrency(value)}</div>
    </div>
  );
}

// ── Signal card ───────────────────────────────────────────────────────────────
function SignalCard({ card }: { card: RadarSignalCard }) {
  const accentColor = getSignalColor(card.signalType);
  const TabIcon     = TABS.find(t => t.id === card.signalType)?.icon || Activity;

  return (
    <article style={{
      background: 'var(--bg-card)',
      border: `1px solid var(--border)`,
      borderTop: `3px solid ${accentColor}`,
      borderRadius: 14,
      padding: 12,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      minWidth: 0,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 2, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 800, fontFamily: 'var(--font-mono)', letterSpacing: '-0.01em' }}>
              {card.symbol}
            </span>
            <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 20, background: `${accentColor}20`, color: accentColor, display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap' }}>
              <TabIcon style={{ width: 9, height: 9 }} />
              {tabTitle(card.signalType)}
            </span>
            <span style={{ fontSize: 9, fontWeight: 700, color: strengthColor(card.strength), whiteSpace: 'nowrap' }}>
              {card.strength.toUpperCase()}
            </span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.exchange} · {card.sector}</div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, fontFamily: 'var(--font-mono)' }}>{formatCurrency(card.price)}</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: card.changePercent >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {card.changePercent >= 0 ? '▲' : '▼'} {formatPercent(card.changePercent)}
          </div>
        </div>
      </div>

      {/* Signal metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
        <div style={{ background: 'var(--bg-2)', borderRadius: 6, padding: '6px 8px', textAlign: 'center' }}>
          <div style={{ fontSize: 9, color: 'var(--text-3)', marginBottom: 1 }}>52w Pos</div>
          <div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: card.week52Position >= 80 ? 'var(--green)' : card.week52Position <= 20 ? 'var(--red)' : 'var(--text-1)' }}>
            {card.week52Position}%
          </div>
        </div>
        <div style={{ background: 'var(--bg-2)', borderRadius: 6, padding: '6px 8px', textAlign: 'center' }}>
          <div style={{ fontSize: 9, color: 'var(--text-3)', marginBottom: 1 }}>RSI ~</div>
          <div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: card.rsiEstimate >= 70 ? 'var(--amber)' : card.rsiEstimate <= 30 ? '#38bdf8' : 'var(--text-1)' }}>
            {card.rsiEstimate}
          </div>
        </div>
        <div style={{ background: 'var(--bg-2)', borderRadius: 6, padding: '6px 8px', textAlign: 'center' }}>
          <div style={{ fontSize: 9, color: 'var(--text-3)', marginBottom: 1 }}>Vol Ratio</div>
          <div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: card.volumeRatio >= 2 ? 'var(--amber)' : 'var(--text-1)' }}>
            {card.volumeRatio.toFixed(1)}×
          </div>
        </div>
      </div>

      {/* Confidence */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 10, color: 'var(--text-3)' }}>Confidence</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: directionColor(card.direction) }}>
            {card.direction.toUpperCase()}
          </span>
        </div>
        <ConfidenceBar value={card.confidence} />
      </div>

      {/* Support / Resistance Levels */}
      {(card.support || card.resistance) && (
        <div style={{ display: 'flex', background: 'var(--bg-2)', borderRadius: 8, padding: '8px 0', gap: 0 }}>
          <PriceLevel label="Support"    value={card.support}    color="var(--green)" />
          <div style={{ width: 1, background: 'var(--border)' }} />
          <PriceLevel label="Current"      value={card.currentPrice} color="var(--text-1)" />
          <div style={{ width: 1, background: 'var(--border)' }} />
          <PriceLevel label="Resistance" value={card.resistance}  color="var(--red)" />
        </div>
      )}

      {/* Why now */}
      <div style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.4, background: 'var(--bg-2)', padding: '8px 10px', borderRadius: 6, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
        {card.whyNow}
      </div>

      {/* Action */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <Link
          href={`/stocks/${encodeURIComponent(card.symbol)}`}
          className="btn btn-primary"
          style={{ flex: 1, fontSize: 11, padding: '6px 8px', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 4 }}
        >
          Full Analysis <ArrowRight style={{ width: 10, height: 10 }} />
        </Link>
        <div style={{ fontSize: 9, color: 'var(--text-3)', alignSelf: 'center', whiteSpace: 'nowrap' }}>
          Vol {formatLargeNumber(card.volume)}
        </div>
      </div>
    </article>
  );
}

// ── Stat tile ─────────────────────────────────────────────────────────────────
function StatTile({ label, value, sub, color = 'var(--text-1)' }: {
  label: string; value: number | string; sub?: string; color?: string;
}) {
  return (
    <div className="metric-card">
      <div className="stat-label">{label}</div>
      <div className="metric-value" style={{ color, fontSize: 22 }}>{value}</div>
      {sub && <div className="metric-footnote">{sub}</div>}
    </div>
  );
}

// ── Sort option ───────────────────────────────────────────────────────────────
type SortKey = 'confidence' | 'changePercent' | 'volume' | 'week52Position';

function flattenSnapshot(snapshot: RadarSnapshot, tab: SignalTab): RadarSignalCard[] {
  if (tab === 'all') {
    // Merge all signal lists, deduplicate by symbol+type
    const seen = new Set<string>();
    const merged: RadarSignalCard[] = [
      ...snapshot.breakouts, ...snapshot.breakdowns, ...snapshot.volumeSpikes,
      ...snapshot.rsiOversold, ...snapshot.rsiOverbought,
      ...snapshot.momentumSurge, ...snapshot.reversalWatch,
    ];
    return merged.filter(c => {
      const key = `${c.symbol}-${c.signalType}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  const map: Record<string, RadarSignalCard[]> = {
    'breakout':       snapshot.breakouts,
    'breakdown':      snapshot.breakdowns,
    'volume-spike':   snapshot.volumeSpikes,
    'rsi-oversold':   snapshot.rsiOversold,
    'rsi-overbought': snapshot.rsiOverbought,
    'momentum-surge': snapshot.momentumSurge,
    'reversal-watch': snapshot.reversalWatch,
  };
  return map[tab] || [];
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function RadarPage() {
  const [snapshot,   setSnapshot]   = useState<RadarSnapshot | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [activeTab,  setActiveTab]  = useState<SignalTab>('all');
  const [sortKey,    setSortKey]    = useState<SortKey>('confidence');
  const [page,       setPage]       = useState(1);
  const PAGE_SIZE = 24;

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await marketAPI.getRadarSnapshot(60);
      setSnapshot(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load radar signals');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  // Refresh every 20s when tab is active
  useEffect(() => {
    const t = window.setInterval(() => { if (!refreshing) void load(); }, 20_000);
    return () => window.clearInterval(t);
  }, [load, refreshing]);

  // Reset page when tab changes
  useEffect(() => setPage(1), [activeTab, sortKey]);

  const cards = snapshot ? flattenSnapshot(snapshot, activeTab) : [];

  const sorted = [...cards].sort((a, b) => {
    switch (sortKey) {
      case 'confidence':    return b.confidence    - a.confidence;
      case 'changePercent': return Math.abs(b.changePercent) - Math.abs(a.changePercent);
      case 'volume':        return b.volume        - a.volume;
      case 'week52Position':return b.week52Position - a.week52Position;
      default: return 0;
    }
  });

  const totalPages    = Math.ceil(sorted.length / PAGE_SIZE);
  const paginated     = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const strongSignals = cards.filter(c => c.strength === 'strong').length;
  const bullishCount  = cards.filter(c => c.direction === 'bullish').length;
  const bearishCount  = cards.filter(c => c.direction === 'bearish').length;

  return (
    <div className="page">

      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-kicker">Radar</div>
          <h1 className="page-title">Market Mover</h1>
          <p className="page-subtitle">
            Auto-detected trading signals ranked by confidence — breakouts, breakdowns, RSI extremes,
            volume spikes, and momentum surges. Entry, stop, and target levels included.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => void load()} disabled={refreshing} className="btn btn-primary" style={{ padding: '8px 16px' }}>
            <RefreshCw style={{ width: 13, height: 13 }} className={refreshing ? 'anim-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--red)', fontSize: 13 }}>⚠ {error}</span>
          <button onClick={() => void load()} className="btn btn-ghost" style={{ fontSize: 12 }}>Retry</button>
        </div>
      )}

      {/* Stats */}
      <div className="metric-strip-grid">
        <StatTile label="Total Signals"   value={snapshot?.totalSignals || 0}  sub="across all types" />
        <StatTile label="Strong Signals"  value={strongSignals}                  sub="confidence ≥ 72%" color="var(--green)" />
        <StatTile label="Bullish"          value={bullishCount}                  sub="directional bias"  color="var(--green)" />
        <StatTile label="Bearish"          value={bearishCount}                  sub="directional bias"  color="var(--red)" />
      </div>

      {/* Tab selector */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {TABS.map(tab => {
          const Icon    = tab.icon;
          const count   = snapshot ? flattenSnapshot(snapshot, tab.id).length : 0;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`btn ${isActive ? 'btn-primary' : 'btn-ghost'}`}
              style={{ padding: '7px 14px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, ...(isActive ? {} : {}) }}
            >
              <Icon style={{ width: 12, height: 12, color: isActive ? 'inherit' : tab.color }} />
              {tab.label}
              {count > 0 && (
                <span style={{ background: isActive ? 'rgba(255,255,255,0.2)' : 'var(--bg-2)', borderRadius: 10, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Sort bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
          {sorted.length} signal{sorted.length !== 1 ? 's' : ''} in <strong>{tabTitle(activeTab)}</strong>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Sort:</span>
          {(['confidence', 'changePercent', 'volume', 'week52Position'] as SortKey[]).map(k => (
            <button
              key={k}
              onClick={() => setSortKey(k)}
              className={`btn ${sortKey === k ? 'btn-primary' : 'btn-ghost'}`}
              style={{ padding: '5px 10px', fontSize: 11 }}
            >
              {k === 'confidence'    ? 'Confidence'
               : k === 'changePercent' ? '% Move'
               : k === 'volume'       ? 'Volume'
               : '52w Pos'}
            </button>
          ))}
        </div>
      </div>

      {/* Cards grid */}
      {loading && !snapshot ? (
        <div className="compact-card-grid">
          {[...Array(8)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : paginated.length === 0 ? (
        <div className="empty-state">
          <Target style={{ width: 36, height: 36, color: 'var(--text-3)' }} />
          <div style={{ fontWeight: 600 }}>No signals in this category yet</div>
          <div className="metric-footnote">The batch worker is building the data — refresh in a minute</div>
          <button onClick={() => void load()} className="btn btn-ghost">Refresh</button>
        </div>
      ) : (
        <div className="compact-card-grid">
          {paginated.map(card => <SignalCard key={card.id} card={card} />)}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 8 }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn btn-ghost" style={{ padding: '7px 14px' }}>
            ← Previous
          </button>
          <span style={{ alignSelf: 'center', fontSize: 12, color: 'var(--text-2)' }}>
            Page {page} of {totalPages}
          </span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn btn-ghost" style={{ padding: '7px 14px' }}>
            Next →
          </button>
        </div>
      )}

      {/* Disclaimer */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '12px 16px', background: 'var(--bg-2)', borderRadius: 10, marginTop: 4 }}>
        <Shield style={{ width: 14, height: 14, color: 'var(--text-3)', flexShrink: 0, marginTop: 2 }} />
        <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0, lineHeight: 1.5 }}>
          Signals are algorithmic — not financial advice. Entry/stop/target are computed estimates,
          not guaranteed price levels. Always verify before acting.
        </p>
      </div>
    </div>
  );
}
