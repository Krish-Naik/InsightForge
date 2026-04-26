'use client';

/**
 * TODAY PAGE — Pure market snapshot (production-grade)
 * ─────────────────────────────────────────────────────
 * Shows: search bar, market breadth, index board, tape activity (large/mid/small),
 *        sector heatmap, sector performance table, news.
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, BarChart3, Globe, RefreshCw,
  TrendingDown, TrendingUp, Zap, Newspaper, Search, X,
  ArrowUpRight, ArrowDownRight, Minus, ArrowRight,
} from 'lucide-react';
import {
  marketAPI,
  type MarketSummary, type SectorOverview, type NewsItem, type TodayDesk,
  type CapFilter, type SearchResult,
} from '@/lib/api';
import { formatCurrency, formatPercent, formatTimeAgo } from '@/lib/format';
import { useMarketStream } from '@/lib/hooks/useMarketStream';
import { useChart } from '@/lib/contexts/ChartContext';
import type { Index, Quote } from '@/lib/api';

// ── Constants ─────────────────────────────────────────────────────────────────
const CAP_LABELS: Record<CapFilter, string> = {
  all: 'All Cap',
  largecap: 'Large Cap',
  midcap: 'Mid Cap',
  smallcap: 'Small Cap',
};

// ── Index card ────────────────────────────────────────────────────────────────
function IndexCard({ idx }: { idx: Index }) {
  const { openChart } = useChart();
  const isUp = idx.changePercent >= 0;
  // Day range bar position
  const rangePos = idx.dayHigh > idx.dayLow
    ? ((idx.price - idx.dayLow) / (idx.dayHigh - idx.dayLow)) * 100
    : 50;

  return (
    <div
      onClick={() => openChart(idx.rawSymbol)}
      className="index-card"
      style={{
        minWidth: 230,
        flexShrink: 0,
        padding: '16px 18px',
        background: 'var(--surface)',
        borderRadius: 14,
        border: `1px solid ${isUp ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
        boxShadow: 'var(--shadow)',
        cursor: 'pointer',
        transition: 'all 160ms ease',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)' }}>{idx.shortName}</span>
        <span style={{
          fontSize: 11, fontWeight: 800,
          color: isUp ? 'var(--green)' : 'var(--red)',
          background: isUp ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
          padding: '2px 8px', borderRadius: 20,
          display: 'flex', alignItems: 'center', gap: 3,
        }}>
          {isUp ? <ArrowUpRight style={{ width: 10, height: 10 }} /> : <ArrowDownRight style={{ width: 10, height: 10 }} />}
          {formatPercent(idx.changePercent)}
        </span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-mono)', marginBottom: 10, color: 'var(--text-1)' }}>
        {formatCurrency(idx.price)}
      </div>
      {/* Range bar */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ height: 3, background: 'var(--bg-2)', borderRadius: 2, position: 'relative', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', left: 0, top: 0, height: '100%',
            width: `${rangePos}%`,
            background: isUp ? 'var(--green)' : 'var(--red)',
            borderRadius: 2,
            transition: 'width 0.5s ease',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-3)', marginTop: 4 }}>
          <span>L {formatCurrency(idx.dayLow)}</span>
          <span>H {formatCurrency(idx.dayHigh)}</span>
        </div>
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: idx.marketState === 'REGULAR' ? 'var(--green)' : 'var(--amber)',
          display: 'inline-block',
        }} />
        {idx.marketState || 'CLOSED'}
      </div>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function SkeletonBlock({ h = 120, w = '100%' }: { h?: number; w?: string }) {
  return (
    <div
      className="skeleton"
      style={{ height: h, width: w, borderRadius: 12 }}
    />
  );
}

// ── Error banner ──────────────────────────────────────────────────────────────
function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      <span style={{ color: 'var(--red)', fontSize: 13 }}>⚠ {message}</span>
      <button onClick={onRetry} className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }}>
        <RefreshCw style={{ width: 12, height: 12 }} /> Retry
      </button>
    </div>
  );
}

// ── Sector heatmap cell ───────────────────────────────────────────────────────
function HeatmapCell({ sector }: { sector: SectorOverview }) {
  const pct = sector.averageChangePercent;
  const isUp = pct >= 0;
  const abs = Math.min(Math.abs(pct), 4);
  const intensity = 0.1 + (abs / 4) * 0.5;
  const bgColor = isUp
    ? `rgba(34,197,94,${intensity})`
    : `rgba(239,68,68,${intensity})`;
  const border = isUp ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)';
  const breadth = sector.breadth;

  return (
    <div style={{
      background: bgColor,
      border: `1px solid ${border}`,
      borderRadius: 10,
      padding: '12px 14px',
      cursor: 'default',
      transition: 'all 200ms ease',
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-1)', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', opacity: 0.8 }}>
        {sector.sector}
      </div>
      <div style={{ fontSize: 16, fontWeight: 800, color: isUp ? 'var(--green)' : 'var(--red)' }}>
        {pct >= 0 ? '+' : ''}{formatPercent(pct)}
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-2)', marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
        <span>{sector.stockCount} stocks</span>
        <span style={{ color: breadth > 0 ? 'var(--green)' : breadth < 0 ? 'var(--red)' : 'var(--text-3)' }}>
          {breadth > 0 ? '↑' : breadth < 0 ? '↓' : '→'} Breadth
        </span>
      </div>
    </div>
  );
}

// ── Sentiment badge ───────────────────────────────────────────────────────────
const SENTIMENT_COLORS = {
  bullish: { bg: 'rgba(34,197,94,0.12)', color: 'var(--green)', dot: '#22c55e' },
  bearish: { bg: 'rgba(239,68,68,0.12)', color: 'var(--red)', dot: '#ef4444' },
  neutral: { bg: 'rgba(148,163,184,0.12)', color: 'var(--text-2)', dot: '#94a3b8' },
} as const;

function SentimentBadge({ sentiment }: { sentiment: 'bullish' | 'bearish' | 'neutral' }) {
  const c = SENTIMENT_COLORS[sentiment];
  return (
    <span style={{ background: c.bg, color: c.color, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, display: 'inline-flex', alignItems: 'center', gap: 4, textTransform: 'uppercase' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot }} />
      {sentiment}
    </span>
  );
}

// ── Quote row ─────────────────────────────────────────────────────────────────
function QuoteRow({ q, rank }: { q: Quote; rank?: number }) {
  const isUp = q.changePercent >= 0;
  const tradedValue = (q.price || 0) * (q.volume || 0);
  const tradedCr = tradedValue / 10_000_000;
  return (
    <Link href={`/stocks/${encodeURIComponent(q.symbol)}`} style={{ textDecoration: 'none', display: 'block' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-light)',
        background: 'var(--surface)', transition: 'all 150ms ease',
        cursor: 'pointer',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {rank !== undefined && (
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', minWidth: 16, textAlign: 'center' }}>#{rank}</span>
          )}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-1)' }}>{q.symbol}</div>
            <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.name}</div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-1)' }}>{formatCurrency(q.price)}</div>
          <div style={{
            fontSize: 11, fontWeight: 700,
            color: isUp ? 'var(--green)' : 'var(--red)',
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3, marginTop: 2,
          }}>
            {isUp ? <ArrowUpRight style={{ width: 10, height: 10 }} /> : <ArrowDownRight style={{ width: 10, height: 10 }} />}
            {formatPercent(q.changePercent)}
          </div>
          {tradedCr > 0 && (
            <div style={{ fontSize: 9, color: 'var(--text-3)', marginTop: 1 }}>
              ₹{tradedCr >= 1 ? tradedCr.toFixed(1) + ' Cr' : (tradedValue / 100000).toFixed(1) + ' L'}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

// ── Stock Search Bar ──────────────────────────────────────────────────────────
function StockSearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) { setResults([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await marketAPI.searchStocks(value.trim());
        setResults(data.slice(0, 8));
        setOpen(data.length > 0);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 280);
  };

  const handleSelect = (symbol: string) => {
    setOpen(false);
    setQuery('');
    router.push(`/stocks/${encodeURIComponent(symbol)}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); setQuery(''); }
    if (e.key === 'Enter' && results.length > 0) handleSelect(results[0].symbol);
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%', maxWidth: 480 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px', borderRadius: 10,
        border: '1px solid var(--border-light)',
        background: 'var(--surface)', boxShadow: 'var(--shadow)',
        transition: 'border-color 150ms ease',
      }}>
        <Search style={{ width: 15, height: 15, color: 'var(--text-3)', flexShrink: 0 }} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search any stock, e.g. RELIANCE, TCS, INFY..."
          style={{
            flex: 1, border: 'none', outline: 'none', background: 'transparent',
            fontSize: 13, color: 'var(--text-1)', fontFamily: 'inherit',
          }}
          aria-label="Search stocks"
          id="stock-search-input"
        />
        {searching && (
          <RefreshCw style={{ width: 13, height: 13, color: 'var(--text-3)', animation: 'spin 1s linear infinite' }} />
        )}
        {query && !searching && (
          <button onClick={() => { setQuery(''); setResults([]); setOpen(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-3)' }}>
            <X style={{ width: 14, height: 14 }} />
          </button>
        )}
      </div>
      {open && results.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
          background: 'var(--surface)', border: '1px solid var(--border-light)',
          borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          zIndex: 200, overflow: 'hidden',
        }}>
          {results.map((r, idx) => (
            <button
              key={`${r.symbol}-${idx}`}
              onClick={() => handleSelect(r.symbol)}
              style={{
                width: '100%', textAlign: 'left', background: 'none',
                border: 'none', borderBottom: '1px solid var(--border-light)',
                padding: '10px 14px', cursor: 'pointer', display: 'flex',
                justifyContent: 'space-between', alignItems: 'center',
                transition: 'background 120ms ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              <div>
                <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-1)' }}>{r.symbol}</span>
                <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 8 }}>{r.name}</span>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 10, color: 'var(--text-3)', background: 'var(--bg-2)', padding: '2px 6px', borderRadius: 4 }}>{r.exchange || 'NSE'}</span>
                {r.inNifty50 && (
                  <span style={{ fontSize: 9, color: 'var(--accent)', background: 'rgba(99,102,241,0.1)', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>N50</span>
                )}
                <ArrowRight style={{ width: 12, height: 12, color: 'var(--text-3)' }} />
              </div>
            </button>
          ))}
          <div style={{ padding: '8px 14px', fontSize: 10, color: 'var(--text-3)' }}>
            Press Enter to view top result · Esc to close
          </div>
        </div>
      )}
    </div>
  );
}

// ── Market Breadth Panel ─────────────────────────────────────────────────────
function MarketBreadthPanel({
  advancers, decliners, unchanged, totalStocks,
  bullishSectors, bearishSectors, totalSectors,
  vixIndex, marketStatus, lastUpdated, desk,
}: {
  advancers: number; decliners: number; unchanged: number; totalStocks: number;
  bullishSectors: number; bearishSectors: number; totalSectors: number;
  vixIndex: Index | undefined;
  marketStatus: string; lastUpdated: string;
  desk: TodayDesk | null;
}) {
  const adRatio = decliners > 0 ? advancers / decliners : advancers > 0 ? 99 : 1;
  const advancerPct = totalStocks > 0 ? Math.round((advancers / totalStocks) * 100) : 0;
  const bullishPct = totalSectors > 0 ? Math.round((bullishSectors / totalSectors) * 100) : 0;

  // Market regime label
  const regime = adRatio >= 2.5 ? 'Strong Bull'
    : adRatio >= 1.5 ? 'Bullish'
    : adRatio >= 0.8 ? 'Mixed'
    : adRatio >= 0.5 ? 'Bearish'
    : 'Strong Bear';

  const regimeColor = adRatio >= 1.5 ? 'var(--green)'
    : adRatio >= 0.8 ? 'var(--amber)'
    : 'var(--red)';

  const vixLevel = vixIndex?.price || 0;
  const vixLabel = vixLevel > 25 ? 'High Fear' : vixLevel > 18 ? 'Elevated' : vixLevel > 12 ? 'Moderate' : 'Low';
  const vixColor = vixLevel > 25 ? 'var(--red)' : vixLevel > 18 ? 'var(--amber)' : 'var(--green)';

  const strongestSector = desk?.narrative?.strongestSector;
  const weakestSector = desk?.narrative?.weakestSector;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
      gap: 12,
    }}>
      {/* Market Status */}
      <div className="metric-card" style={{ gridColumn: 'span 1' }}>
        <div className="stat-label">Market Regime</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: regimeColor, marginTop: 6 }}>{regime}</div>
        <div style={{ marginTop: 8, height: 3, background: 'var(--bg-2)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.min(advancerPct, 100)}%`, background: regimeColor, borderRadius: 2, transition: 'width 0.6s ease' }} />
        </div>
        <div className="metric-footnote" style={{ marginTop: 4 }}>{marketStatus} · {lastUpdated ? formatTimeAgo(lastUpdated) : '—'}</div>
      </div>

      {/* Advancers vs Decliners */}
      <div className="metric-card">
        <div className="stat-label">Advancers / Decliners</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 6 }}>
          <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--green)' }}>{advancers}</span>
          <span style={{ fontSize: 13, color: 'var(--text-3)' }}>vs</span>
          <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--red)' }}>{decliners}</span>
        </div>
        {/* A/D bar */}
        <div style={{ marginTop: 8, height: 4, display: 'flex', borderRadius: 2, overflow: 'hidden', gap: 1 }}>
          <div style={{ flex: advancers, background: 'var(--green)', minWidth: 2 }} />
          <div style={{ flex: unchanged, background: 'var(--bg-3)', minWidth: unchanged > 0 ? 2 : 0 }} />
          <div style={{ flex: decliners, background: 'var(--red)', minWidth: 2 }} />
        </div>
        <div className="metric-footnote" style={{ marginTop: 4 }}>
          A/D ratio {adRatio.toFixed(2)} · {unchanged} unchanged · {totalStocks} tracked
        </div>
      </div>

      {/* Sector Breadth */}
      <div className="metric-card">
        <div className="stat-label">Sector Breadth</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 6 }}>
          <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--green)' }}>{bullishSectors}</span>
          <span style={{ fontSize: 13, color: 'var(--text-3)' }}>/ {totalSectors}</span>
          <span style={{ fontSize: 12, color: bullishPct >= 60 ? 'var(--green)' : bullishPct <= 40 ? 'var(--red)' : 'var(--amber)', fontWeight: 700 }}>({bullishPct}%)</span>
        </div>
        <div style={{ marginTop: 8, height: 4, display: 'flex', borderRadius: 2, overflow: 'hidden', gap: 1 }}>
          <div style={{ flex: bullishSectors, background: 'var(--green)', minWidth: 2 }} />
          <div style={{ flex: totalSectors - bullishSectors - bearishSectors, background: 'var(--bg-3)' }} />
          <div style={{ flex: bearishSectors, background: 'var(--red)', minWidth: bearishSectors > 0 ? 2 : 0 }} />
        </div>
        <div className="metric-footnote" style={{ marginTop: 4 }}>
          {bearishSectors} bearish · {totalSectors - bullishSectors - bearishSectors} neutral
          {strongestSector && <span> · <b style={{ color: 'var(--green)' }}>{strongestSector}</b> leading</span>}
        </div>
      </div>

      {/* VIX / Breadth Bias */}
      <div className="metric-card">
        {vixIndex ? (
          <>
            <div className="stat-label">India VIX · Volatility</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: vixColor, marginTop: 6 }}>{vixLevel.toFixed(1)}</div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: vixLevel > 25 ? 'rgba(239,68,68,0.1)' : vixLevel > 18 ? 'rgba(245,158,11,0.1)' : 'rgba(34,197,94,0.1)', color: vixColor }}>
              {vixLabel}
            </div>
            <div className="metric-footnote" style={{ marginTop: 4, color: vixIndex.changePercent >= 0 ? 'var(--red)' : 'var(--green)' }}>
              {formatPercent(vixIndex.changePercent)} · {vixIndex.changePercent > 0 ? 'Fear rising' : 'Fear falling'}
            </div>
          </>
        ) : (
          <>
            <div className="stat-label">Breadth Signal</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: regimeColor, marginTop: 6 }}>{regime}</div>
            <div className="metric-footnote" style={{ marginTop: 6 }}>
              {advancerPct}% of tracked stocks advancing
              {weakestSector && <span> · <span style={{ color: 'var(--red)' }}>{weakestSector}</span> weakest</span>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Tape Activity (Market Movers) ─────────────────────────────────────────────
function TapeActivity({
  capFilter, onCapChange,
  movers, moversLoading,
}: {
  capFilter: CapFilter;
  onCapChange: (cap: CapFilter) => void;
  movers: { gainers: Quote[]; losers: Quote[]; volumeLeaders: Quote[] } | null;
  moversLoading: boolean;
}) {
  const [tab, setTab] = useState<'gainers' | 'losers' | 'volumeLeaders'>('gainers');
  const items = movers?.[tab] || [];

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div className="panel-header">
        <div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Activity style={{ width: 14, height: 14 }} /> Tape Activity
          <span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 400 }}>· Full market universe</span>
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {(['all', 'largecap', 'midcap', 'smallcap'] as CapFilter[]).map(cap => (
            <button
              key={cap}
              onClick={() => onCapChange(cap)}
              style={{
                fontSize: 10, padding: '5px 10px', borderRadius: 6,
                border: capFilter === cap ? 'none' : '1px solid var(--border-light)',
                background: capFilter === cap ? 'var(--text-1)' : 'transparent',
                color: capFilter === cap ? 'var(--surface)' : 'var(--text-2)',
                cursor: 'pointer', fontWeight: 600, transition: 'all 150ms ease',
              }}
            >
              {CAP_LABELS[cap]}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {([
            { key: 'gainers', label: 'Top Gainers', Icon: TrendingUp, color: 'var(--green)' },
            { key: 'losers', label: 'Top Losers', Icon: TrendingDown, color: 'var(--red)' },
            { key: 'volumeLeaders', label: 'Volume Leaders', Icon: Zap, color: 'var(--accent)' },
          ] as const).map(({ key, label, Icon, color }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                flex: 1, padding: '8px 10px', borderRadius: 8, border: 'none',
                background: tab === key ? color : 'var(--bg-2)',
                color: tab === key ? 'white' : 'var(--text-2)',
                fontWeight: 700, fontSize: 11, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                transition: 'all 150ms ease',
              }}
            >
              <Icon style={{ width: 12, height: 12 }} /> {label}
            </button>
          ))}
        </div>

        {/* Content */}
        {moversLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[...Array(8)].map((_, i) => <SkeletonBlock key={i} h={52} />)}
          </div>
        ) : items.length === 0 ? (
          <div className="empty-state" style={{ padding: '32px 0' }}>
            <Activity style={{ width: 24, height: 24, color: 'var(--text-3)' }} />
            <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
              No {CAP_LABELS[capFilter]} {tab === 'gainers' ? 'gainers' : tab === 'losers' ? 'losers' : 'volume leaders'} available.
              {capFilter !== 'all' && ' Try "All Cap" to see the full market.'}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {items.slice(0, 15).map((q, i) => <QuoteRow key={q.symbol} q={q} rank={i + 1} />)}
            {items.length > 15 && (
              <div style={{ textAlign: 'center', padding: '8px 0', fontSize: 11, color: 'var(--text-3)' }}>
                + {items.length - 15} more stocks in this category
              </div>
            )}
          </div>
        )}

        {/* Cap explanation footer */}
        <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--bg-2)', borderRadius: 6, fontSize: 10, color: 'var(--text-3)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--text-2)' }}>Cap thresholds:</strong> Large &gt;₹20,000 Cr · Mid ₹5,000–₹20,000 Cr · Small &lt;₹5,000 Cr
          {movers && (
            <span> · Showing {items.length} stocks from {
              capFilter === 'all'
                ? `${(movers.gainers.length + movers.losers.length)} in universe`
                : `${CAP_LABELS[capFilter]} universe`
            }</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function TodayPage() {
  const [summary, setSummary] = useState<MarketSummary | null>(null);
  const [sectors, setSectors] = useState<SectorOverview[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [desk, setDesk] = useState<TodayDesk | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [capFilter, setCapFilter] = useState<CapFilter>('all');
  const [movers, setMovers] = useState<{ gainers: Quote[]; losers: Quote[]; volumeLeaders: Quote[] } | null>(null);
  const [moversLoading, setMoversLoading] = useState(false);
  const [moversError, setMoversError] = useState<string | null>(null);

  const { connected } = useMarketStream(true);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [s, sec, n, d] = await Promise.allSettled([
        marketAPI.getMarketSummary(),
        marketAPI.getAllSectorsData(),
        marketAPI.getNews('all', undefined, 20),
        marketAPI.getTodayDesk(),
      ]);
      if (s.status === 'fulfilled') setSummary(s.value);
      if (sec.status === 'fulfilled') setSectors(sec.value);
      if (n.status === 'fulfilled') setNews(n.value);
      if (d.status === 'fulfilled') setDesk(d.value);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load market data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(t);
  }, [load]);

  // ── Movers: fetch enhanced (full universe by cap) ─────────────────────────
  const loadMovers = useCallback(async () => {
    setMoversLoading(true);
    setMoversError(null);
    try {
      // Try enhanced movers first (full cached universe)
      const data = await marketAPI.getEnhancedMovers();
      let capData: { gainers: Quote[]; losers: Quote[]; volumeLeaders: Quote[] };

      if (capFilter === 'all') {
        // Merge all segments, deduplicate, then re-sort
        const seen = new Set<string>();
        const dedupe = (arr: Quote[]) => arr.filter(q => {
          if (seen.has(q.symbol)) return false;
          seen.add(q.symbol); return true;
        });

        const allGainers = dedupe([
          ...(data.largecap?.gainers || []),
          ...(data.midcap?.gainers || []),
          ...(data.smallcap?.gainers || []),
        ]).sort((a, b) => (b.changePercent || 0) - (a.changePercent || 0));

        const seen2 = new Set<string>();
        const dedupe2 = (arr: Quote[]) => arr.filter(q => {
          if (seen2.has(q.symbol)) return false;
          seen2.add(q.symbol); return true;
        });

        const allLosers = dedupe2([
          ...(data.largecap?.losers || []),
          ...(data.midcap?.losers || []),
          ...(data.smallcap?.losers || []),
        ]).sort((a, b) => (a.changePercent || 0) - (b.changePercent || 0));

        const seen3 = new Set<string>();
        const dedupe3 = (arr: Quote[]) => arr.filter(q => {
          if (seen3.has(q.symbol)) return false;
          seen3.add(q.symbol); return true;
        });

        const allVolume = dedupe3([
          ...(data.largecap?.volumeLeaders || []),
          ...(data.midcap?.volumeLeaders || []),
          ...(data.smallcap?.volumeLeaders || []),
        ]).sort((a, b) => ((b.price || 0) * (b.volume || 0)) - ((a.price || 0) * (a.volume || 0)));

        capData = { gainers: allGainers, losers: allLosers, volumeLeaders: allVolume };
      } else {
        const seg = data[capFilter as keyof typeof data];
        capData = seg || { gainers: [], losers: [], volumeLeaders: [] };
      }

      // Fallback: if we got very few results, supplement from market summary
      if (capData.gainers.length < 3 && summary) {
        const fallbackGainers = [...summary.gainers].sort((a, b) => (b.changePercent || 0) - (a.changePercent || 0));
        const fallbackLosers = [...summary.losers].sort((a, b) => (a.changePercent || 0) - (b.changePercent || 0));
        const fallbackVol = [...summary.mostActive];
        capData = {
          gainers: capData.gainers.length > 0 ? capData.gainers : fallbackGainers,
          losers: capData.losers.length > 0 ? capData.losers : fallbackLosers,
          volumeLeaders: capData.volumeLeaders.length > 0 ? capData.volumeLeaders : fallbackVol,
        };
      }

      setMovers(capData);
    } catch (e) {
      // On error, fall back to basic market summary movers
      if (summary) {
        setMovers({
          gainers: [...summary.gainers].sort((a, b) => (b.changePercent || 0) - (a.changePercent || 0)),
          losers: [...summary.losers].sort((a, b) => (a.changePercent || 0) - (b.changePercent || 0)),
          volumeLeaders: [...summary.mostActive],
        });
      } else {
        setMoversError('Failed to load tape activity');
      }
    } finally {
      setMoversLoading(false);
    }
  }, [capFilter, summary]);

  useEffect(() => {
    void loadMovers();
  }, [loadMovers]);

  // ── Derived market breadth (from summary + ALL quotes) ────────────────────
  const allQuotes = useMemo(() => {
    if (!summary) return [];
    const seen = new Set<string>();
    return [...summary.gainers, ...summary.losers, ...summary.mostActive].filter(q => {
      if (seen.has(q.symbol)) return false;
      seen.add(q.symbol); return true;
    });
  }, [summary]);

  const advancers = allQuotes.filter(q => q.changePercent > 0).length;
  const decliners = allQuotes.filter(q => q.changePercent < 0).length;
  const unchanged = allQuotes.length - advancers - decliners;

  const bullishSectors = sectors.filter(s => s.trend === 'bullish').length;
  const bearishSectors = sectors.filter(s => s.trend === 'bearish').length;

  const vixIndex = summary?.indices.find(i => i.symbol.includes('VIX') || i.symbol.includes('INDIAVIX'));

  const heatmapSectors = useMemo(
    () => [...sectors].sort((a, b) => Math.abs(b.averageChangePercent) - Math.abs(a.averageChangePercent)).slice(0, 16),
    [sectors],
  );

  return (
    <div className="page">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <div className="page-kicker">Today</div>
          <h1 className="page-title">Market Overview</h1>
          <p className="page-subtitle">
            Snapshot of what is moving the market — indices, breadth, sectors and tape.
            Trading signals live on the <Link href="/radar" style={{ color: 'var(--accent)' }}>Radar page</Link>.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {connected && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-3)' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
              Live
            </span>
          )}
          <button onClick={() => void load()} disabled={refreshing} className="btn btn-ghost">
            <RefreshCw style={{ width: 13, height: 13 }} className={refreshing ? 'anim-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Search Bar ───────────────────────────────────────────────────── */}
      <StockSearchBar />

      {error && <ErrorBanner message={error} onRetry={() => void load()} />}

      {/* ── Market Breadth Panel ─────────────────────────────────────────── */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {[1, 2, 3, 4].map(i => <SkeletonBlock key={i} h={100} />)}
        </div>
      ) : (
        <MarketBreadthPanel
          advancers={advancers}
          decliners={decliners}
          unchanged={unchanged}
          totalStocks={allQuotes.length}
          bullishSectors={bullishSectors}
          bearishSectors={bearishSectors}
          totalSectors={sectors.length}
          vixIndex={vixIndex}
          marketStatus={summary?.marketStatus || 'CLOSED'}
          lastUpdated={summary?.lastUpdated || ''}
          desk={desk}
        />
      )}

      {/* ── Market Narrative ─────────────────────────────────────────────── */}
      {!loading && desk?.narrative && (
        <div className="card" style={{ padding: '16px 20px', borderLeft: `3px solid ${desk.narrative.tone === 'bullish' ? 'var(--green)' : desk.narrative.tone === 'bearish' ? 'var(--red)' : 'var(--amber)'}` }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <Activity style={{ width: 16, height: 16, color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{desk.narrative.headline}</span>
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20, textTransform: 'uppercase',
                  background: desk.narrative.tone === 'bullish' ? 'rgba(34,197,94,0.1)' : desk.narrative.tone === 'bearish' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                  color: desk.narrative.tone === 'bullish' ? 'var(--green)' : desk.narrative.tone === 'bearish' ? 'var(--red)' : 'var(--amber)',
                }}>
                  {desk.narrative.tone}
                </span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>{desk.narrative.summary}</div>
              <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
                {desk.narrative.watchFor && (
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                    <span style={{ fontWeight: 700, color: 'var(--amber)' }}>Watch: </span>{desk.narrative.watchFor}
                  </div>
                )}
                {desk.narrative.risk && (
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                    <span style={{ fontWeight: 700, color: 'var(--red)' }}>Risk: </span>{desk.narrative.risk}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Index Board ──────────────────────────────────────────────────── */}
      <div className="full-width-section">
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="panel-header">
            <div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <BarChart3 style={{ width: 14, height: 14 }} /> Index Board
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Nifty, Sensex, Sectoral</span>
          </div>
          {loading ? (
            <div style={{ padding: 16 }}><SkeletonBlock h={120} /></div>
          ) : (
            <div style={{ overflowX: 'auto', padding: '14px 16px 18px' }}>
              <div style={{ display: 'flex', gap: 12, minWidth: 'max-content' }}>
                {(summary?.indices || []).map(idx => (
                  <IndexCard key={idx.symbol} idx={idx} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Tape Activity ────────────────────────────────────────────────── */}
      <div className="full-width-section">
        <TapeActivity
          capFilter={capFilter}
          onCapChange={setCapFilter}
          movers={movers}
          moversLoading={moversLoading || loading}
        />
        {moversError && (
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--red)', textAlign: 'center' }}>{moversError}</div>
        )}
      </div>

      {/* ── Sector Heatmap ───────────────────────────────────────────────── */}
      <div className="full-width-section">
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="panel-header">
            <div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart3 style={{ width: 14, height: 14 }} /> Sector Heatmap
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Average change % · color intensity = momentum</span>
          </div>
          <div style={{ padding: 16 }}>
            {loading ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
                {[...Array(12)].map((_, i) => <SkeletonBlock key={i} h={72} />)}
              </div>
            ) : heatmapSectors.length === 0 ? (
              <div className="empty-state"><BarChart3 style={{ width: 28, height: 28, color: 'var(--text-3)' }} /><div>Sector data loading…</div></div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
                {heatmapSectors.map(s => <HeatmapCell key={s.sector} sector={s} />)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Sector Performance Table ─────────────────────────────────────── */}
      <div className="full-width-section">
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="panel-header">
            <div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Globe style={{ width: 14, height: 14 }} /> Sector Performance
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Breadth = (bullish − bearish) / total</span>
          </div>
          <div style={{ overflowX: 'auto', maxHeight: 400 }}>
            {loading ? (
              <div style={{ padding: 16 }}><SkeletonBlock h={200} /></div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Sector</th>
                    <th>Trend</th>
                    <th style={{ textAlign: 'right' }}>Avg Chg%</th>
                    <th style={{ textAlign: 'right' }}>Breadth</th>
                    <th style={{ textAlign: 'right' }}>Stocks</th>
                    <th>Leader</th>
                    <th>Laggard</th>
                  </tr>
                </thead>
                <tbody>
                  {sectors.map(s => {
                    const trendColor = s.trend === 'bullish' ? 'var(--green)' : s.trend === 'bearish' ? 'var(--red)' : 'var(--text-3)';
                    return (
                      <tr key={s.sector}>
                        <td style={{ fontWeight: 600 }}>{s.sector}</td>
                        <td>
                          <span style={{ fontSize: 11, fontWeight: 700, color: trendColor, display: 'flex', alignItems: 'center', gap: 4 }}>
                            {s.trend === 'bullish' ? <ArrowUpRight style={{ width: 12, height: 12 }} /> : s.trend === 'bearish' ? <ArrowDownRight style={{ width: 12, height: 12 }} /> : <Minus style={{ width: 12, height: 12 }} />}
                            {s.trend}
                          </span>
                        </td>
                        <td className="mono" style={{ textAlign: 'right', color: s.averageChangePercent >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                          {s.averageChangePercent >= 0 ? '+' : ''}{formatPercent(s.averageChangePercent)}
                        </td>
                        <td className="mono" style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                            <div style={{ width: 36, height: 4, background: 'var(--bg-2)', borderRadius: 2, overflow: 'hidden' }}>
                              <div style={{ width: `${Math.min(Math.max((s.breadth + 100) / 2, 0), 100)}%`, height: '100%', background: s.breadth >= 0 ? 'var(--green)' : 'var(--red)', borderRadius: 2 }} />
                            </div>
                            <span style={{ color: s.breadth >= 0 ? 'var(--green)' : 'var(--red)', fontSize: 11 }}>{s.breadth.toFixed(0)}%</span>
                          </div>
                        </td>
                        <td className="mono" style={{ textAlign: 'right', color: 'var(--text-2)' }}>{s.stockCount}</td>
                        <td style={{ fontSize: 11 }}>
                          {s.leader ? (
                            <Link href={`/stocks/${encodeURIComponent(s.leader.symbol)}`} style={{ textDecoration: 'none', color: 'var(--green)', fontWeight: 600 }}>
                              {s.leader.symbol}
                            </Link>
                          ) : '—'}
                        </td>
                        <td style={{ fontSize: 11 }}>
                          {s.laggard ? (
                            <Link href={`/stocks/${encodeURIComponent(s.laggard.symbol)}`} style={{ textDecoration: 'none', color: 'var(--red)', fontWeight: 600 }}>
                              {s.laggard.symbol}
                            </Link>
                          ) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* ── Market News ──────────────────────────────────────────────────── */}
      <div className="full-width-section">
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="panel-header">
            <div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Newspaper style={{ width: 14, height: 14 }} /> Market News
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Sentiment-tagged headlines</span>
          </div>
          <div style={{ padding: 16 }}>
            {loading ? (
              <div className="stack-8">{[1, 2, 3, 4].map(i => <SkeletonBlock key={i} h={60} />)}</div>
            ) : news.length === 0 ? (
              <div className="empty-state"><Newspaper style={{ width: 24, height: 24, color: 'var(--text-3)' }} /><div>No news available</div></div>
            ) : (
              <div className="stack-8">
                {news.slice(0, 12).map((item, idx) => (
                  <a key={`${item.id}-${idx}`} href={item.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                    <div className="list-card" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, lineHeight: 1.4, color: 'var(--text-1)' }}>{item.title}</div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                          <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{item.source} · {formatTimeAgo(item.time)}</span>
                          <SentimentBadge sentiment={item.sentiment} />
                          {item.relatedStocks?.slice(0, 3).map(s => (
                            <span key={s} style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--accent)', background: 'rgba(99,102,241,0.1)', padding: '1px 6px', borderRadius: 4 }}>
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
