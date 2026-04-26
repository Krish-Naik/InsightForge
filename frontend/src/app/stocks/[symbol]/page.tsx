'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft, ArrowDownRight, ArrowUpRight, BrainCircuit, RefreshCw,
  ShieldAlert, Sparkles, TrendingDown, TrendingUp, Waves, BarChart2,
  Building2, Target, AlertTriangle, DollarSign, Activity,
} from 'lucide-react';
import { HistoricalSeriesChart } from '@/components/charts/HistoricalSeriesChart';
import { StoryTimeline } from '@/components/ui/insight-kit';
import { SymbolLink } from '@/components/ui/SymbolLink';
import { EmptyPanel, MetricTile, PageHeader, SectionCard, TrendBadge } from '@/components/ui/page-kit';
import { FinancialInsightSection } from '@/components/ui/FinancialInsightSection';
import { PriceInsightSection } from '@/components/ui/PriceInsightSection';
import { marketAPI, type StockResearch } from '@/lib/api';
import { formatCurrency, formatPercent, formatTimeAgo } from '@/lib/format';

// ── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton({ h = 64, radius = 8 }: { h?: number; radius?: number }) {
  return <div className="skeleton" style={{ height: h, borderRadius: radius }} />;
}

// ── Quick Stat ────────────────────────────────────────────────────────────────
function QuickStat({ label, value, subtext, color }: { label: string; value: React.ReactNode; subtext?: string; color?: string }) {
  return (
    <div style={{
      padding: '14px 16px',
      borderRadius: 10,
      border: '1px solid var(--border-light)',
      background: 'var(--surface)',
    }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-mono)', color: color || 'var(--text-1)' }}>{value}</div>
      {subtext && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>{subtext}</div>}
    </div>
  );
}

// ── Tag Badge ────────────────────────────────────────────────────────────────
function TagBadge({ children, tone = 'default' }: { children: React.ReactNode; tone?: 'green' | 'red' | 'amber' | 'blue' | 'default' }) {
  const colors: Record<string, { bg: string; color: string; border: string }> = {
    green: { bg: 'rgba(34,197,94,0.1)', color: 'var(--green)', border: 'rgba(34,197,94,0.25)' },
    red: { bg: 'rgba(239,68,68,0.1)', color: 'var(--red)', border: 'rgba(239,68,68,0.25)' },
    amber: { bg: 'rgba(245,158,11,0.1)', color: 'var(--amber)', border: 'rgba(245,158,11,0.25)' },
    blue: { bg: 'rgba(99,102,241,0.1)', color: 'var(--accent)', border: 'rgba(99,102,241,0.25)' },
    default: { bg: 'var(--bg-2)', color: 'var(--text-2)', border: 'var(--border-light)' },
  };
  const c = colors[tone] || colors.default;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '3px 10px',
      borderRadius: 20, fontSize: 11, fontWeight: 600,
      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
    }}>
      {children}
    </span>
  );
}

// ── Level Card (support/resistance) ─────────────────────────────────────────
function LevelCard({ label, value, note, color }: { label: string; value: string; note?: string; color: string }) {
  return (
    <div style={{
      padding: '12px 14px',
      borderRadius: 8, border: `1px solid ${color}22`,
      background: `${color}08`,
    }}>
      <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: color, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--text-1)' }}>{value}</div>
      {note && <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 3 }}>{note}</div>}
    </div>
  );
}

// ── 52W Range Bar ────────────────────────────────────────────────────────────
function RangeBar({ current, low, high }: { current: number; low: number; high: number }) {
  const position = high > low ? ((current - low) / (high - low)) * 100 : 50;
  const clampedPos = Math.max(0, Math.min(100, position));
  return (
    <div>
      <div style={{ position: 'relative', height: 6, background: 'var(--bg-2)', borderRadius: 3, margin: '8px 0' }}>
        <div style={{
          position: 'absolute', top: -2, height: 10, width: 4, borderRadius: 2,
          background: 'var(--text-1)', left: `calc(${clampedPos}% - 2px)`,
          boxShadow: `0 0 0 2px var(--surface)`,
        }} />
        <div style={{
          position: 'absolute', left: 0, top: 2, height: 2,
          width: `${clampedPos}%`,
          background: clampedPos >= 70 ? 'var(--green)' : clampedPos <= 30 ? 'var(--red)' : 'var(--amber)',
          borderRadius: 2,
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-3)' }}>
        <span>52W Low {formatCurrency(low)}</span>
        <span style={{ color: clampedPos >= 70 ? 'var(--green)' : clampedPos <= 30 ? 'var(--red)' : 'var(--amber)', fontWeight: 600 }}>
          {clampedPos.toFixed(0)}% of range
        </span>
        <span>52W High {formatCurrency(high)}</span>
      </div>
    </div>
  );
}

// ── Evidence List ────────────────────────────────────────────────────────────
function EvidenceList({ items }: { items: string[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--text-3)', flexShrink: 0, marginTop: 5 }} />
          {item}
        </div>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function StockStoryPage() {
  const params = useParams<{ symbol: string }>();
  const symbol = decodeURIComponent(
    Array.isArray(params.symbol) ? params.symbol[0] : params.symbol || ''
  ).toUpperCase();

  const [research, setResearch] = useState<StockResearch | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartPeriod, setChartPeriod] = useState<'1y' | '2y' | '5y'>('1y');
  const [chartVariant, setChartVariant] = useState<'line' | 'candles'>('line');

  const loadResearch = useCallback(async () => {
    if (!symbol) return;
    setRefreshing(true);
    try {
      const nextResearch = await marketAPI.getStockResearch(symbol);
      setResearch(nextResearch);
      setError(null);
    } catch (nextError) {
      setResearch(null);
      setError(nextError instanceof Error ? nextError.message : 'Failed to load stock story.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [symbol]);

  useEffect(() => {
    void loadResearch();
  }, [loadResearch]);

  const quote = research?.quote || null;
  const analytics = research?.analytics || null;
  const profile = research?.profile || null;
  const sectorOverview = research?.sectorOverview || null;
  const peers = research?.peers || [];
  const story = research?.story || null;

  const changePercent = quote?.changePercent ?? analytics?.changePercent ?? 0;
  const price = quote?.price ?? 0;
  const isUp = changePercent >= 0;

  const stanceTone = story?.stance === 'strong' || story?.stance === 'early' ? 'positive'
    : story?.stance === 'weak' ? 'negative'
    : story?.stance === 'extended' ? 'warning' : 'primary';

  const stageTone = story?.setupMap.stage === 'ready' || story?.setupMap.stage === 'fresh' ? 'positive'
    : story?.setupMap.stage === 'extended' ? 'warning'
    : story?.setupMap.stage === 'weakening' ? 'negative' : 'primary';

  // RSI color
  const rsi = analytics?.rsi14;
  const rsiColor = rsi ? (rsi >= 70 ? 'var(--red)' : rsi <= 30 ? 'var(--green)' : 'var(--text-1)') : 'var(--text-1)';

  return (
    <div className="page">

      {/* ── Back + Header ────────────────────────────────────────────────── */}
      <div>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-3)', textDecoration: 'none', marginBottom: 12 }}>
          <ArrowLeft style={{ width: 13, height: 13 }} /> Market Overview
        </Link>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isUp ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                border: `1px solid ${isUp ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                fontSize: 13, fontWeight: 800, color: isUp ? 'var(--green)' : 'var(--red)',
                fontFamily: 'var(--font-mono)',
              }}>
                {symbol.slice(0, 2)}
              </div>
              <div>
                <h1 style={{ fontSize: 'clamp(1.5rem, 2.5vw, 2rem)', fontWeight: 800, lineHeight: 1, margin: 0 }}>
                  {profile?.name || symbol}
                </h1>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>
                  {profile?.symbol} · {profile?.exchange} · {profile?.primarySector}
                  {profile?.inNifty50 && (
                    <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--accent)', fontWeight: 700, background: 'rgba(99,102,241,0.1)', padding: '1px 6px', borderRadius: 4 }}>Nifty 50</span>
                  )}
                </div>
              </div>
            </div>

            {/* Tags row */}
            {!loading && story && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <TagBadge tone={story.stance === 'strong' ? 'green' : story.stance === 'weak' ? 'red' : 'amber'}>{story.stance}</TagBadge>
                <TagBadge tone="blue">{story.horizonFit}</TagBadge>
                <TagBadge tone={story.sourceMode === 'ai' ? 'blue' : 'amber'}>{story.sourceMode === 'ai' ? 'AI Story' : 'Rules Story'}</TagBadge>
                {profile?.primarySector && <TagBadge>{profile.primarySector}</TagBadge>}
              </div>
            )}
          </div>

          {/* Price hero */}
          {price > 0 && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 'clamp(1.8rem, 3vw, 2.6rem)', fontWeight: 900, fontFamily: 'var(--font-mono)', lineHeight: 1 }}>
                {formatCurrency(price)}
              </div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6,
                fontSize: 14, fontWeight: 700,
                color: isUp ? 'var(--green)' : 'var(--red)',
                background: isUp ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                padding: '4px 12px', borderRadius: 20,
              }}>
                {isUp ? <ArrowUpRight style={{ width: 14, height: 14 }} /> : <ArrowDownRight style={{ width: 14, height: 14 }} />}
                {formatPercent(changePercent)}
                {quote?.change !== undefined && (
                  <span style={{ fontSize: 11, opacity: 0.7 }}>({quote.change >= 0 ? '+' : ''}{formatCurrency(quote.change)})</span>
                )}
              </div>
              {quote?.timestamp && (
                <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 4 }}>{formatTimeAgo(quote.timestamp)}</div>
              )}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={() => void loadResearch()} disabled={refreshing} className="btn btn-primary" style={{ padding: '8px 14px' }}>
          <RefreshCw style={{ width: 13, height: 13 }} className={refreshing ? 'anim-spin' : ''} />
          Refresh Story
        </button>
        <SymbolLink symbol={profile?.symbol || symbol} className="btn btn-ghost" style={{ padding: '8px 14px' }}>Open Chart</SymbolLink>
        <Link href="/watchlist" className="btn btn-ghost" style={{ padding: '8px 14px' }}>+ Watchlist</Link>
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '12px 16px', color: 'var(--red)', fontSize: 13 }}>
          ⚠ {error}
        </div>
      )}

      {/* ── Loading State ─────────────────────────────────────────────────── */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[...Array(4)].map((_, i) => <Skeleton key={i} h={90} />)}
          </div>
          <Skeleton h={380} />
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Skeleton h={200} /> <Skeleton h={180} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Skeleton h={220} /> <Skeleton h={160} />
            </div>
          </div>
        </div>
      )}

      {/* ── Content ───────────────────────────────────────────────────────── */}
      {!loading && research && profile && (
        <>
          {/* Key metrics strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
            <QuickStat
              label="Current Price"
              value={quote ? formatCurrency(quote.price) : '—'}
              subtext={quote?.marketState || 'Market closed'}
            />
            <QuickStat
              label="Day Range"
              value={quote ? `${formatCurrency(quote.dayLow)} – ${formatCurrency(quote.dayHigh)}` : '—'}
              subtext={quote ? `Open ${formatCurrency(quote.open)}` : undefined}
            />
            <QuickStat
              label="Volume"
              value={quote?.volume ? `${(quote.volume / 1_000_000).toFixed(2)}M` : analytics?.volume ? `${(analytics.volume / 1_000_000).toFixed(2)}M` : '—'}
              subtext={analytics?.volumeRatio ? `${analytics.volumeRatio.toFixed(1)}× avg volume` : 'Volume ratio n/a'}
              color={analytics?.volumeRatio && analytics.volumeRatio > 2 ? 'var(--amber)' : undefined}
            />
            {rsi !== undefined ? (
              <QuickStat
                label="RSI (14)"
                value={rsi.toFixed(1)}
                subtext={rsi >= 70 ? 'Overbought zone' : rsi <= 30 ? 'Oversold zone' : 'Neutral'}
                color={rsiColor}
              />
            ) : (
              <QuickStat
                label="Momentum Score"
                value={analytics ? analytics.momentumScore.toFixed(0) : '—'}
                subtext={analytics?.trend || 'neutral'}
                color={analytics && analytics.momentumScore >= 60 ? 'var(--green)' : analytics && analytics.momentumScore <= 35 ? 'var(--red)' : undefined}
              />
            )}
          </div>

          {/* 52W range */}
          {quote && quote.high52w > 0 && (
            <div className="card" style={{ padding: '16px 18px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>52-Week Range Position</div>
              <RangeBar current={quote.price} low={quote.low52w} high={quote.high52w} />
            </div>
          )}

          {/* ── Chart section ──────────────────────────────────────────────── */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="panel-header">
              <div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <BarChart2 style={{ width: 14, height: 14 }} /> Price Chart
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {/* Period tabs */}
                <div style={{ display: 'flex', gap: 4, background: 'var(--bg-2)', padding: '3px', borderRadius: 7, border: '1px solid var(--border-light)' }}>
                  {(['1y', '2y', '5y'] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => setChartPeriod(p)}
                      style={{
                        padding: '4px 10px', borderRadius: 5, border: 'none', fontSize: 11, fontWeight: 600,
                        background: chartPeriod === p ? 'var(--surface)' : 'transparent',
                        color: chartPeriod === p ? 'var(--text-1)' : 'var(--text-2)',
                        cursor: 'pointer', transition: 'all 120ms ease',
                        boxShadow: chartPeriod === p ? 'var(--shadow)' : 'none',
                      }}
                    >
                      {p.toUpperCase()}
                    </button>
                  ))}
                </div>
                {/* Variant toggle */}
                <div style={{ display: 'flex', gap: 4, background: 'var(--bg-2)', padding: '3px', borderRadius: 7, border: '1px solid var(--border-light)' }}>
                  {(['line', 'candles'] as const).map(v => (
                    <button
                      key={v}
                      onClick={() => setChartVariant(v)}
                      style={{
                        padding: '4px 10px', borderRadius: 5, border: 'none', fontSize: 11, fontWeight: 600,
                        background: chartVariant === v ? 'var(--surface)' : 'transparent',
                        color: chartVariant === v ? 'var(--text-1)' : 'var(--text-2)',
                        cursor: 'pointer', transition: 'all 120ms ease',
                        boxShadow: chartVariant === v ? 'var(--shadow)' : 'none',
                      }}
                    >
                      {v === 'line' ? 'Line' : 'Candles'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ padding: '4px 0 0' }}>
              <HistoricalSeriesChart
                symbol={profile.symbol}
                period={chartPeriod}
                variant={chartVariant}
                height={380}
                showVolume={true}
                showIndicators={chartVariant === 'line'}
              />
            </div>
          </div>

          {/* ── Price Structure ─────────────────────────────────────────────── */}
          {story && (
            <div className="card" style={{ padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Target style={{ width: 15, height: 15, color: 'var(--accent)' }} />
                <span style={{ fontWeight: 700, fontSize: 14 }}>Price Structure & Key Levels</span>
                <TagBadge tone={stageTone as any}>{story.setupMap.stage}</TagBadge>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 14 }}>
                <LevelCard label="Support" value={story.setupMap.support} note="Key buy zone" color="#22c55e" />
                <LevelCard label="Resistance" value={story.setupMap.resistance} note="Key sell zone" color="#ef4444" />
                <LevelCard label="Trigger" value={story.setupMap.trigger} note="Entry signal" color="#6366f1" />
                <LevelCard label="Invalidation" value={story.setupMap.invalidation} note="Stop loss ref" color="#f59e0b" />
              </div>
            </div>
          )}

          {/* ── Main 2-col layout ─────────────────────────────────────────────── */}
          <div className="workbench-grid">

            {/* Left column */}
            <div className="workbench-column">

              {/* Why this stock matters */}
              <div className="card" style={{ padding: '18px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <BrainCircuit style={{ width: 15, height: 15, color: 'var(--accent)' }} />
                  <span style={{ fontWeight: 700, fontSize: 14 }}>Why This Stock Matters Now</span>
                </div>

                {story ? (
                  <>
                    <div style={{ padding: '12px 14px', background: 'var(--bg-2)', borderRadius: 8, marginBottom: 14, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7 }}>
                      {story.summary}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                      <div style={{ padding: '12px', background: 'var(--surface)', border: '1px solid var(--border-light)', borderRadius: 8 }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Primary Driver</div>
                        <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>{story.whyMoving.primary}</div>
                      </div>
                      <div style={{ padding: '12px', background: 'var(--surface)', border: '1px solid var(--border-light)', borderRadius: 8 }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Secondary Driver</div>
                        <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>{story.whyMoving.secondary}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Evidence</div>
                    <EvidenceList items={story.whyMoving.evidence} />
                  </>
                ) : (
                  <EmptyPanel title="Narrative unavailable" description="The stock story is waiting for enough context." icon={BrainCircuit} />
                )}
              </div>

              {/* Bull / Bear framing */}
              <div className="card" style={{ padding: '18px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <Sparkles style={{ width: 15, height: 15, color: 'var(--amber)' }} />
                  <span style={{ fontWeight: 700, fontSize: 14 }}>Bull vs Bear Case</span>
                </div>
                {story ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div style={{ padding: '14px', background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--green)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <TrendingUp style={{ width: 12, height: 12 }} /> Bull Case
                      </div>
                      <EvidenceList items={story.bullCase} />
                    </div>
                    <div style={{ padding: '14px', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--red)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <TrendingDown style={{ width: 12, height: 12 }} /> Bear Case
                      </div>
                      <EvidenceList items={story.bearCase} />
                    </div>
                  </div>
                ) : (
                  <EmptyPanel title="Decision frame unavailable" description="Bull and bear framing appears once the story engine finishes." icon={Sparkles} />
                )}
              </div>

              {/* Sector + Peers */}
              <div className="card" style={{ padding: '18px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <Building2 style={{ width: 15, height: 15, color: 'var(--accent)' }} />
                  <span style={{ fontWeight: 700, fontSize: 14 }}>Sector Context & Peers</span>
                  {sectorOverview && (
                    <TagBadge tone={sectorOverview.trend === 'bullish' ? 'green' : sectorOverview.trend === 'bearish' ? 'red' : 'amber'}>
                      {sectorOverview.sector} {sectorOverview.trend}
                    </TagBadge>
                  )}
                </div>

                {sectorOverview && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
                    <div style={{ textAlign: 'center', padding: '10px 6px', background: 'var(--bg-2)', borderRadius: 8 }}>
                      <div style={{ fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Avg Move</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: sectorOverview.averageChangePercent >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {formatPercent(sectorOverview.averageChangePercent)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '10px 6px', background: 'var(--bg-2)', borderRadius: 8 }}>
                      <div style={{ fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Breadth</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: sectorOverview.breadth > 0 ? 'var(--green)' : 'var(--red)' }}>
                        {sectorOverview.breadth.toFixed(0)}%
                      </div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '10px 6px', background: 'var(--bg-2)', borderRadius: 8 }}>
                      <div style={{ fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Stocks</div>
                      <div style={{ fontSize: 14, fontWeight: 800 }}>{sectorOverview.stockCount}</div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '10px 6px', background: 'var(--bg-2)', borderRadius: 8 }}>
                      <div style={{ fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Tracked</div>
                      <div style={{ fontSize: 14, fontWeight: 800 }}>{sectorOverview.sampleSize}</div>
                    </div>
                  </div>
                )}

                {peers.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
                    {peers.slice(0, 6).map(peer => (
                      <Link key={peer.symbol} href={`/stocks/${encodeURIComponent(peer.symbol)}`} style={{ textDecoration: 'none' }}>
                        <div style={{
                          padding: '12px', borderRadius: 8, border: '1px solid var(--border-light)',
                          background: 'var(--surface)', transition: 'all 150ms ease',
                        }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)', marginBottom: 3 }}>{peer.symbol}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{peer.name}</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: (peer.changePercent || 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                            {formatPercent(peer.changePercent || 0)}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>Momentum {peer.momentumScore.toFixed(0)}</div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <EmptyPanel title="No peer data" description="Peers appear once the sector basket has enough clean constituents." icon={Waves} />
                )}
              </div>

              {/* Financials */}
              <FinancialInsightSection symbol={symbol} />
            </div>

            {/* Right column — sticky */}
            <div className="workbench-column panel-sticky">

              {/* Decision Map */}
              <div className="card" style={{ padding: '18px 20px', borderTop: `2px solid ${stanceTone === 'positive' ? 'var(--green)' : stanceTone === 'negative' ? 'var(--red)' : 'var(--amber)'}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <ShieldAlert style={{ width: 15, height: 15, color: 'var(--amber)' }} />
                  <span style={{ fontWeight: 700, fontSize: 14 }}>Decision Map</span>
                </div>

                {story ? (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                      <div style={{ padding: '10px 12px', background: 'var(--bg-2)', borderRadius: 8 }}>
                        <div style={{ fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Confidence</div>
                        <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--font-mono)' }}>{story.whyMoving.confidence}</div>
                      </div>
                      <div style={{ padding: '10px 12px', background: 'var(--bg-2)', borderRadius: 8 }}>
                        <div style={{ fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Horizon</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>{story.horizonFit}</div>
                      </div>
                    </div>

                    {/* Confidence bar */}
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-3)', marginBottom: 4 }}>
                        <span>Story Confidence</span>
                        <span style={{ fontWeight: 700 }}>{typeof story.whyMoving.confidence === 'number' ? `${story.whyMoving.confidence}%` : story.whyMoving.confidence}</span>
                      </div>
                      <div style={{ height: 4, background: 'var(--bg-2)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          width: `${typeof story.whyMoving.confidence === 'number' ? story.whyMoving.confidence : 50}%`,
                          background: 'var(--accent)', borderRadius: 2,
                          transition: 'width 0.6s ease',
                        }} />
                      </div>
                    </div>

                    <div style={{ padding: '12px 14px', background: 'var(--bg-2)', borderRadius: 8, marginBottom: 10 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
                        <Activity style={{ width: 10, height: 10, display: 'inline', marginRight: 4 }} /> Watch Next
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>{story.whyMoving.watchNext}</div>
                    </div>

                    <div style={{ padding: '12px 14px', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 8 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--red)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
                        <AlertTriangle style={{ width: 10, height: 10, display: 'inline', marginRight: 4 }} /> Main Risk
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>{story.whyMoving.risk}</div>
                    </div>
                  </>
                ) : (
                  <EmptyPanel title="Decision map unavailable" description="The decision map will appear once the story engine finishes scoring." icon={ShieldAlert} />
                )}
              </div>

              {/* Quick actions */}
              <div className="card" style={{ padding: '16px 18px' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Quick Actions</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <SymbolLink symbol={profile.symbol} className="btn btn-primary" style={{ justifyContent: 'center' }}>Open Interactive Chart</SymbolLink>
                  <Link href="/watchlist" className="btn btn-ghost" style={{ justifyContent: 'center' }}>+ Add to Watchlist</Link>
                  <Link href="/news" className="btn btn-ghost" style={{ justifyContent: 'center' }}>View News Feed</Link>
                  <Link href="/radar" className="btn btn-ghost" style={{ justifyContent: 'center' }}>Check Radar Signals</Link>
                </div>
              </div>

              {/* Company context */}
              <div className="card" style={{ padding: '16px 18px' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Building2 style={{ width: 11, height: 11 }} /> Company Context
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ padding: '10px 12px', background: 'var(--bg-2)', borderRadius: 8 }}>
                    <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 4 }}>Coverage</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{profile.primarySector}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                      {profile.exchange}{profile.industry ? ` · ${profile.industry}` : ''}
                    </div>
                  </div>

                  {profile.aliases.length > 0 && (
                    <div style={{ padding: '10px 12px', background: 'var(--bg-2)', borderRadius: 8 }}>
                      <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 6 }}>Aliases & Tickers</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {profile.aliases.map(a => (
                          <span key={a} style={{ fontSize: 10, padding: '2px 8px', background: 'var(--surface)', border: '1px solid var(--border-light)', borderRadius: 4, color: 'var(--text-2)' }}>{a}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {profile.dataNotes.length > 0 && (
                    <div style={{ padding: '10px 12px', background: 'var(--bg-2)', borderRadius: 8 }}>
                      <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 6 }}>Data Notes</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {profile.dataNotes.map(n => (
                          <div key={n} style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.5 }}>{n}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Price insights */}
              <PriceInsightSection symbol={symbol} />
            </div>
          </div>
        </>
      )}

      {/* ── Not Found ─────────────────────────────────────────────────────── */}
      {!loading && !research && !error && (
        <div className="card" style={{ padding: '32px 24px', textAlign: 'center' }}>
          <BrainCircuit style={{ width: 32, height: 32, color: 'var(--text-3)', margin: '0 auto 16px' }} />
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>No data found for {symbol}</div>
          <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 20 }}>
            Try searching from the Market Overview page, or check another symbol.
          </div>
          <Link href="/" className="btn btn-ghost" style={{ display: 'inline-flex' }}>
            <ArrowLeft style={{ width: 13, height: 13 }} /> Back to Overview
          </Link>
        </div>
      )}
    </div>
  );
}
