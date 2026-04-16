'use client';

/**
 * TODAY PAGE — Pure market snapshot
 * ──────────────────────────────────
 * Shows: indices, sector breadth, heatmap, gainers/losers,
 *        volume leaders, news sentiment, VIX, market narrative.
 *
 * DOES NOT contain: signals, alerts, breakouts, entry/exit,
 *                   or any trading intelligence.
 */

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, BarChart3, Globe, Minus, RefreshCw,
  TrendingDown, TrendingUp, Zap, Newspaper,
} from 'lucide-react';
import {
  marketAPI,
  type MarketSummary, type SectorOverview, type NewsItem, type TodayDesk,
} from '@/lib/api';
import { formatCurrency, formatLargeNumber, formatPercent, formatTimeAgo } from '@/lib/format';
import { useMarketStream } from '@/lib/hooks/useMarketStream';

// ── Skeleton ──────────────────────────────────────────────────────────────────
function SkeletonBlock({ h = 120, className = '' }: { h?: number; className?: string }) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{ height: h, borderRadius: 12, background: 'var(--bg-2)', animation: 'skeleton-pulse 1.6s ease-in-out infinite' }}
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
  const pct    = sector.averageChangePercent;
  const abs    = Math.min(Math.abs(pct), 3);
  const alpha  = 0.15 + (abs / 3) * 0.55;
  const bg     = pct >= 0 ? `rgba(34,197,94,${alpha})` : `rgba(239,68,68,${alpha})`;
  const border = pct >= 0 ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)';

  return (
    <div style={{
      background: bg, border: `1px solid ${border}`, borderRadius: 10,
      padding: '12px 14px', cursor: 'default',
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-1)', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {sector.sector}
      </div>
      <div style={{ fontSize: 15, fontWeight: 800, color: pct >= 0 ? 'var(--green)' : 'var(--red)' }}>
        {formatPercent(pct)}
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 3 }}>
        {sector.stockCount} stocks · {sector.sampleSize} tracked
      </div>
    </div>
  );
}

// ── Sentiment badge ───────────────────────────────────────────────────────────
const SENTIMENT_COLORS = {
  bullish: { bg: 'rgba(34,197,94,0.12)', color: 'var(--green)', dot: '#22c55e' },
  bearish: { bg: 'rgba(239,68,68,0.12)', color: 'var(--red)',   dot: '#ef4444' },
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

// ── Quote row shared component ────────────────────────────────────────────────
function QuoteRow({ symbol, name, price, changePercent }: {
  symbol: string; name: string; price: number; changePercent: number;
}) {
  const isUp = changePercent >= 0;
  return (
    <Link href={`/stocks/${encodeURIComponent(symbol)}`} style={{ textDecoration: 'none', display: 'block' }}>
      <div className="list-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{symbol}</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{name}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}>{formatCurrency(price)}</div>
          <div style={{ fontSize: 11, color: isUp ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
            {isUp ? '▲' : '▼'} {formatPercent(changePercent)}
          </div>
        </div>
      </div>
    </Link>
  );
}

// ── Global indices pill row ───────────────────────────────────────────────────
const GLOBAL_INDICES = [
  { label: 'S&P 500', symbol: '^GSPC', note: 'US' },
  { label: 'Nasdaq',  symbol: '^IXIC', note: 'US' },
  { label: 'Nikkei',  symbol: '^N225', note: 'JP' },
  { label: 'Hang Seng',symbol:'^HSI',  note: 'HK' },
  { label: 'DAX',     symbol: '^GDAXI',note: 'DE' },
  { label: 'FTSE 100',symbol: '^FTSE', note: 'UK' },
];

// ── Main page ─────────────────────────────────────────────────────────────────
export default function TodayPage() {
  const [summary,  setSummary]  = useState<MarketSummary | null>(null);
  const [sectors,  setSectors]  = useState<SectorOverview[]>([]);
  const [news,     setNews]     = useState<NewsItem[]>([]);
  const [desk,     setDesk]     = useState<TodayDesk | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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
      if (s.status   === 'fulfilled') setSummary(s.value);
      if (sec.status === 'fulfilled') setSectors(sec.value);
      if (n.status   === 'fulfilled') setNews(n.value);
      if (d.status   === 'fulfilled') setDesk(d.value);
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

  // Derived breadth
  const advancers  = summary ? summary.gainers.filter(q => q.changePercent > 0).length : 0;
  const decliners  = summary ? summary.losers.filter(q => q.changePercent < 0).length  : 0;
  const unchanged  = summary ? (summary.mostActive.length - advancers - decliners) : 0;

  const bullishSectors = sectors.filter(s => s.trend === 'bullish').length;
  const bearishSectors = sectors.filter(s => s.trend === 'bearish').length;

  // VIX from indices (look for India VIX)
  const vixIndex = summary?.indices.find(i => i.symbol.includes('VIX') || i.symbol.includes('INDIAVIX'));

  // Top 8 sector heatmap entries
  const heatmapSectors = useMemo(
    () => [...sectors].sort((a, b) => Math.abs(b.averageChangePercent) - Math.abs(a.averageChangePercent)).slice(0, 12),
    [sectors],
  );

  // Volume leaders — just top volume, no signals
  const volumeLeaders = useMemo(
    () => summary ? [...summary.mostActive].slice(0, 10) : [],
    [summary],
  );

  return (
    <div className="page">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <div className="page-kicker">Today</div>
          <h1 className="page-title">Market Snapshot</h1>
          <p className="page-subtitle">
            What is happening in the market today — indices, sectors, breadth, and news.
            Trading signals and setups live on the <Link href="/radar" style={{ color: 'var(--accent)' }}>Radar page</Link>.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="topbar-pill">
            <span className={`status-dot ${connected ? 'is-live' : ''}`} />
            {connected ? 'Live' : 'Delayed'}
          </span>
          {desk?.generatedAt && (
            <span className="topbar-pill">Updated {formatTimeAgo(desk.generatedAt)}</span>
          )}
          <button onClick={() => void load()} disabled={refreshing} className="btn btn-ghost">
            <RefreshCw style={{ width: 13, height: 13 }} className={refreshing ? 'anim-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {error && <ErrorBanner message={error} onRetry={() => void load()} />}

      {/* ── Breadth strip ────────────────────────────────────────────────────── */}
      <div className="metric-strip-grid">
        {loading ? (
          [1,2,3,4].map(i => <SkeletonBlock key={i} h={90} />)
        ) : (
          <>
            <div className="metric-card">
              <div className="stat-label">Market Status</div>
              <div className="metric-value" style={{ fontSize: 18 }}>{summary?.marketStatus || '—'}</div>
              <div className="metric-footnote">{summary?.lastUpdated ? formatTimeAgo(summary.lastUpdated) : ''}</div>
            </div>
            <div className="metric-card">
              <div className="stat-label">Advancers</div>
              <div className="metric-value" style={{ color: 'var(--green)' }}>{advancers}</div>
              <div className="metric-footnote">vs {decliners} decliners</div>
            </div>
            <div className="metric-card">
              <div className="stat-label">Sectors Up</div>
              <div className="metric-value" style={{ color: 'var(--green)' }}>{bullishSectors}</div>
              <div className="metric-footnote">vs {bearishSectors} down</div>
            </div>
            {vixIndex ? (
              <div className="metric-card">
                <div className="stat-label">India VIX</div>
                <div className="metric-value" style={{ color: vixIndex.price > 20 ? 'var(--amber)' : 'var(--text-1)' }}>
                  {formatCurrency(vixIndex.price)}
                </div>
                <div className="metric-footnote" style={{ color: vixIndex.changePercent >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {formatPercent(vixIndex.changePercent)}
                </div>
              </div>
            ) : (
              <div className="metric-card">
                <div className="stat-label">Breadth Bias</div>
                <div className="metric-value" style={{ color: advancers >= decliners ? 'var(--green)' : 'var(--red)' }}>
                  {advancers >= decliners ? 'Bullish' : 'Bearish'}
                </div>
                <div className="metric-footnote">A:{advancers} D:{decliners} U:{unchanged}</div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Market narrative ─────────────────────────────────────────────────── */}
      {loading ? (
        <SkeletonBlock h={100} />
      ) : desk?.narrative && (
        <div className="card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <Activity style={{ width: 18, height: 18, color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{desk.narrative.headline}</div>
              <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>{desk.narrative.summary}</div>
              {desk.narrative.watchFor && (
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic' }}>
                  Watch: {desk.narrative.watchFor}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Index board ──────────────────────────────────────────────────────── */}
      <div className="full-width-section">
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="panel-header">
            <div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Activity style={{ width: 15, height: 15 }} /> Index Board
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Nifty, Sensex, Sectoral</span>
          </div>
          {loading ? (
            <div style={{ padding: 16 }}><SkeletonBlock h={80} /></div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <div style={{ display: 'flex', gap: 12, padding: '14px 16px', minWidth: 'max-content' }}>
                {(summary?.indices || []).map(idx => (
                  <div key={idx.symbol} className="index-card" style={{ minWidth: 160, flexShrink: 0 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>{idx.shortName}</div>
                    <div style={{ fontSize: 17, fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
                      {formatCurrency(idx.price)}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                        {formatCurrency(idx.dayLow)} — {formatCurrency(idx.dayHigh)}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: idx.changePercent >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {formatPercent(idx.changePercent)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Sector heatmap ───────────────────────────────────────────────────── */}
      <div className="full-width-section">
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="panel-header">
            <div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart3 style={{ width: 15, height: 15 }} /> Sector Heatmap
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Average change % per sector</span>
          </div>
          <div style={{ padding: 16 }}>
            {loading ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
                {[...Array(8)].map((_, i) => <SkeletonBlock key={i} h={70} />)}
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

      {/* ── Tape activity ─────────────────────────────────────────────────────── */}
      <div className="full-width-section">
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="panel-header">
            <div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrendingUp style={{ width: 15, height: 15 }} /> Tape Activity
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Gainers · Losers · Active</span>
          </div>
          <div style={{ padding: 16 }}>
            {loading ? (
              <div className="grid-fit-220">{[1,2,3].map(i => <SkeletonBlock key={i} h={200} />)}</div>
            ) : (
              <div className="grid-fit-220">
                {/* Top Gainers */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, fontSize: 12, fontWeight: 700, color: 'var(--green)' }}>
                    <TrendingUp style={{ width: 13, height: 13 }} /> Top Gainers
                  </div>
                  <div className="stack-8">
                    {(summary?.gainers || []).slice(0, 10).map(q => (
                      <QuoteRow key={q.symbol} symbol={q.symbol} name={q.name} price={q.price} changePercent={q.changePercent} />
                    ))}
                  </div>
                </div>
                {/* Top Losers */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, fontSize: 12, fontWeight: 700, color: 'var(--red)' }}>
                    <TrendingDown style={{ width: 13, height: 13 }} /> Top Losers
                  </div>
                  <div className="stack-8">
                    {(summary?.losers || []).slice(0, 10).map(q => (
                      <QuoteRow key={q.symbol} symbol={q.symbol} name={q.name} price={q.price} changePercent={q.changePercent} />
                    ))}
                  </div>
                </div>
                {/* Volume Leaders */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, fontSize: 12, fontWeight: 700, color: 'var(--text-2)' }}>
                    <Zap style={{ width: 13, height: 13 }} /> Volume Leaders
                    <span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 400, marginLeft: 4 }}>(no signals)</span>
                  </div>
                  <div className="stack-8">
                    {volumeLeaders.map(q => (
                      <Link key={q.symbol} href={`/stocks/${encodeURIComponent(q.symbol)}`} style={{ textDecoration: 'none', display: 'block' }}>
                        <div className="list-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{q.symbol}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{q.name}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 11, color: 'var(--text-2)' }}>Vol</div>
                            <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{formatLargeNumber(q.volume)}</div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Sector performance table ──────────────────────────────────────────── */}
      <div className="full-width-section">
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="panel-header">
            <div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Globe style={{ width: 15, height: 15 }} /> Sector Performance
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Breadth = (bullish − bearish) / total</span>
          </div>
          <div style={{ overflowX: 'auto', maxHeight: 380 }}>
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
                  </tr>
                </thead>
                <tbody>
                  {sectors.map(s => (
                    <tr key={s.sector}>
                      <td style={{ fontWeight: 600 }}>{s.sector}</td>
                      <td>
                        <span style={{ fontSize: 11, fontWeight: 700, color: s.trend === 'bullish' ? 'var(--green)' : s.trend === 'bearish' ? 'var(--red)' : 'var(--text-3)' }}>
                          {s.trend === 'bullish' ? '▲' : s.trend === 'bearish' ? '▼' : '■'} {s.trend}
                        </span>
                      </td>
                      <td className="mono" style={{ textAlign: 'right', color: s.averageChangePercent >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {formatPercent(s.averageChangePercent)}
                      </td>
                      <td className="mono" style={{ textAlign: 'right', color: s.breadth >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {s.breadth.toFixed(0)}%
                      </td>
                      <td className="mono" style={{ textAlign: 'right' }}>{s.stockCount}</td>
                      <td style={{ fontSize: 11, color: 'var(--text-2)' }}>{s.leader?.symbol || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* ── Market news sentiment ─────────────────────────────────────────────── */}
      <div className="full-width-section">
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="panel-header">
            <div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Newspaper style={{ width: 15, height: 15 }} /> Market News
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Sentiment-tagged headlines</span>
          </div>
          <div style={{ padding: 16 }}>
            {loading ? (
              <div className="stack-8">{[1,2,3,4].map(i => <SkeletonBlock key={i} h={60} />)}</div>
            ) : news.length === 0 ? (
              <div className="empty-state"><Newspaper style={{ width: 24, height: 24, color: 'var(--text-3)' }} /><div>No news available</div></div>
            ) : (
              <div className="stack-8">
                {news.slice(0, 12).map(item => (
                  <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                    <div className="list-card" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, lineHeight: 1.4 }}>{item.title}</div>
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
