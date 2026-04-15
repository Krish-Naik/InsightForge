'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, BrainCircuit, Clock3, RefreshCw, Signal, Sparkles, Target, Zap } from 'lucide-react';
import { OpportunityInsightCard } from '@/components/ui/insight-kit';
import { EmptyPanel, MetricTile, PageHeader, SectionCard, TrendBadge } from '@/components/ui/page-kit';
import { marketAPI, type MarketSummary, type OpportunityMode, type Quote, type RadarResponse, type Selectivity, type TradingHorizon } from '@/lib/api';
import { formatCurrency, formatIST, formatLargeNumber, formatPercent, formatTimeAgo } from '@/lib/format';

const MODES: Array<{ id: OpportunityMode; label: string; description: string }> = [
  { id: 'momentum', label: 'Intraday Momentum', description: 'Fast participation, clean follow-through, and immediate sponsorship.' },
  { id: 'breakout', label: 'Early Breakouts', description: 'Names pressing into cleaner trigger zones without being fully spent.' },
  { id: 'pullback', label: 'Pullback Entries', description: 'Leadership names where the next opportunity may come from patience, not speed.' },
  { id: 'avoid', label: 'Weakness To Avoid', description: 'Moves that look active but are carrying the wrong kind of risk.' },
  { id: 'sympathy', label: 'Sector Sympathy', description: 'Secondary names riding improving sector structure before they become obvious.' },
];

const HORIZONS: TradingHorizon[] = ['intraday', 'swing'];
const SELECTIVITY: Selectivity[] = ['conservative', 'balanced', 'aggressive'];

function toneForChange(value: number) {
  return value >= 0 ? 'positive' : 'negative';
}

function toneForSignal(tone: 'bullish' | 'bearish' | 'balanced' | 'neutral') {
  if (tone === 'bullish') return 'positive' as const;
  if (tone === 'bearish') return 'negative' as const;
  if (tone === 'balanced') return 'warning' as const;
  return 'default' as const;
}

function QuoteTapeList({ title, items }: { title: string; items: Quote[] }) {
  return (
    <div className="surface-inset">
      <div className="stat-label">{title}</div>
      <div className="stack-12" style={{ marginTop: 10 }}>
        {items.length ? items.map((item) => (
          <Link key={`${title}-${item.symbol}`} href={`/stocks/${encodeURIComponent(item.symbol)}`} className="list-card" style={{ textDecoration: 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
              <div>
                <div className="mono" style={{ fontSize: 12, fontWeight: 700 }}>{item.symbol}</div>
                <div className="metric-footnote">{item.name}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="mono" style={{ fontSize: 12 }}>{formatCurrency(item.price)}</div>
                <div className="metric-footnote" style={{ color: item.changePercent >= 0 ? 'var(--green)' : 'var(--red)' }}>{formatPercent(item.changePercent)}</div>
              </div>
            </div>
            {title === 'Most active' ? <div className="metric-footnote">Volume {formatLargeNumber(item.volume)}</div> : null}
          </Link>
        )) : <div className="metric-footnote">No names available.</div>}
      </div>
    </div>
  );
}

export default function ScannerPage() {
  const [mode, setMode] = useState<OpportunityMode>('momentum');
  const [horizon, setHorizon] = useState<TradingHorizon>('intraday');
  const [selectivity, setSelectivity] = useState<Selectivity>('balanced');
  const [radar, setRadar] = useState<RadarResponse | null>(null);
  const [summary, setSummary] = useState<MarketSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRadar = useCallback(async () => {
    setRefreshing(true);
    try {
      const [nextRadar, nextSummary] = await Promise.all([
        marketAPI.getOpportunityRadar(mode, horizon, selectivity),
        marketAPI.getMarketSummary(),
      ]);
      setRadar(nextRadar);
      setSummary(nextSummary);
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to load radar insights.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [horizon, mode, selectivity]);

  useEffect(() => {
    void loadRadar();
  }, [loadRadar]);

  useEffect(() => {
    const refreshInterval = (radar?.refreshIntervalSeconds || 20) * 1000;
    const handle = window.setInterval(() => {
      void loadRadar();
    }, refreshInterval);

    return () => window.clearInterval(handle);
  }, [loadRadar, radar?.refreshIntervalSeconds]);

  const topOpportunity = radar?.opportunities[0] || null;
  const selectedMode = useMemo(() => MODES.find((entry) => entry.id === mode), [mode]);
  const headlineIndices = summary?.indices.slice(0, 3) || [];

  return (
    <div className="page">
      <PageHeader
        kicker="Radar"
        title="Live market radar across the active tape"
        description="Radar is the discovery engine. It sweeps the market, auto-generates live signals, and keeps the tape context visible beside the ranked setup board."
        actions={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {radar?.generatedAt ? <span className="topbar-pill">Updated {formatTimeAgo(radar.generatedAt)} • {formatIST(new Date(radar.generatedAt))}</span> : null}
            <TrendBadge tone={radar?.sourceMode === 'ai' ? 'primary' : 'warning'}>{radar?.sourceMode === 'ai' ? 'Groq wording' : 'Rules ranking'}</TrendBadge>
            <button onClick={() => void loadRadar()} disabled={refreshing} className="btn btn-ghost">
              <RefreshCw style={{ width: 14, height: 14 }} className={refreshing ? 'anim-spin' : ''} />
              Refresh
            </button>
          </div>
        }
      />

      {error ? <TrendBadge tone="warning">{error}</TrendBadge> : null}

      <div className="metric-strip-grid">
        <MetricTile label="Sectors scanned" value={radar?.coverage.sectorsScanned || 0} tone="primary" icon={Target} subtext={selectedMode?.label || 'Choose a lens'} />
        <MetricTile label="Stocks analyzed" value={radar?.coverage.stocksAnalyzed || 0} tone="positive" icon={Sparkles} subtext={`${selectivity} selectivity`} />
        <MetricTile label="Live signals" value={radar?.signalFeed.length || 0} tone="warning" icon={Signal} subtext={topOpportunity?.sector || 'Waiting for a sector lead'} />
        <MetricTile label="Refresh cadence" value={`${radar?.refreshIntervalSeconds || 20}s`} tone="negative" icon={Clock3} subtext={`${radar?.coverage.matches || 0} ranked setups`} />
      </div>

      <div className="workbench-grid-three">
        <SectionCard title="Tape Context" subtitle="Keep the index tape beside the signal stream" icon={Activity} tone="primary">
          {radar ? (
            <div className="stack-16">
              <div className="metric-footnote">{radar.narrative}</div>
              <div className="compact-card-grid">
                {headlineIndices.map((index) => (
                  <div key={index.symbol} className="list-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                      <div>
                        <div className="stat-label">Index</div>
                        <div style={{ marginTop: 8, fontSize: 15, fontWeight: 700 }}>{index.shortName}</div>
                      </div>
                      <TrendBadge tone={toneForChange(index.changePercent)}>{formatPercent(index.changePercent)}</TrendBadge>
                    </div>
                    <div className="metric-footnote">{formatCurrency(index.price)}</div>
                  </div>
                ))}
              </div>
              <div className="surface-inset">
                <div className="stat-label">Top live signal</div>
                <div className="metric-value">{radar.signalFeed[0]?.symbol || topOpportunity?.symbol || '—'}</div>
                <div className="metric-footnote">{radar.signalFeed[0]?.detail || topOpportunity?.whyNow || 'Waiting for a ranked signal.'}</div>
              </div>
            </div>
          ) : (
            <EmptyPanel title="Radar context loading" description="The live tape overview will appear once the radar sweep completes." icon={Activity} />
          )}
        </SectionCard>

        <SectionCard title="Signal Windows" subtitle="Separate tape bursts from session context" icon={Clock3}>
          {radar ? (
            <div className="stack-12">
              {radar.windowInsights.map((entry) => (
                <div key={entry.window} className="list-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                    <div>
                      <div className="stat-label">Window</div>
                      <div style={{ marginTop: 8, fontSize: 15, fontWeight: 700 }}>{entry.label}</div>
                    </div>
                    <TrendBadge tone={entry.signalCount ? 'positive' : 'warning'}>{entry.signalCount} signals</TrendBadge>
                  </div>
                  <div className="metric-footnote">{entry.summary}</div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyPanel title="Signal windows loading" description="The feed will separate 5-minute bursts from 15-minute and session context once the radar sweep completes." icon={Clock3} />
          )}
        </SectionCard>

        <SectionCard title="Radar Lens" subtitle="Switch discovery modes instead of building a manual screen" icon={Target}>
          <div className="panel-scroll-tight stack-12">
            {MODES.map((entry) => {
              const active = entry.id === mode;
              return (
                <button
                  key={entry.id}
                  type="button"
                  className="list-card"
                  onClick={() => setMode(entry.id)}
                  style={{
                    textAlign: 'left',
                    cursor: 'pointer',
                    borderColor: active ? 'rgba(217, 154, 79, 0.34)' : undefined,
                    background: active
                      ? 'linear-gradient(135deg, rgba(217, 154, 79, 0.16), rgba(255,248,236,0.03))'
                      : undefined,
                  }}
                >
                  <div className="stat-label">Mode</div>
                  <div style={{ marginTop: 8, fontSize: 15, fontWeight: 700 }}>{entry.label}</div>
                  <div className="metric-footnote">{entry.description}</div>
                </button>
              );
            })}
          </div>

          <div className="stack-12" style={{ marginTop: 12 }}>
            <div>
              <div className="stat-label" style={{ marginBottom: 8 }}>Trading horizon</div>
              <div className="tab-group">
                {HORIZONS.map((entry) => (
                  <button key={entry} type="button" onClick={() => setHorizon(entry)} className={`tab ${horizon === entry ? 'tab-active' : ''}`}>
                    {entry}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="stat-label" style={{ marginBottom: 8 }}>Selectivity</div>
              <div className="tab-group">
                {SELECTIVITY.map((entry) => (
                  <button key={entry} type="button" onClick={() => setSelectivity(entry)} className={`tab ${selectivity === entry ? 'tab-active' : ''}`}>
                    {entry}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="workbench-grid">
        <SectionCard title="Live Signal Feed" subtitle="Auto-generated tape alerts, not a second screener" icon={Signal}>
          {radar?.signalFeed.length ? (
            <div className="panel-scroll-tight stack-12">
              {radar.signalFeed.map((entry) => (
                <div key={entry.id} className="list-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                    <div>
                      <div className="stat-label">{entry.window}</div>
                      <div style={{ marginTop: 8, fontSize: 15, fontWeight: 700 }}>
                        {entry.symbol ? <Link href={`/stocks/${encodeURIComponent(entry.symbol)}`} style={{ color: 'inherit', textDecoration: 'none' }}>{entry.title}</Link> : entry.title}
                      </div>
                    </div>
                    <TrendBadge tone={toneForSignal(entry.tone)}>Strength {entry.strength}</TrendBadge>
                  </div>
                  <div className="metric-footnote">{entry.detail}</div>
                  <div className="metric-footnote">{formatTimeAgo(entry.occurredAt)} • {formatIST(new Date(entry.occurredAt))} • {entry.sector}</div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyPanel title="No live signal feed yet" description="The feed will show fresh tape alerts once the current radar sweep finds enough movement." icon={Signal} />
          )}
        </SectionCard>

        <SectionCard title="Sector Shift Board" subtitle="Where leadership is broadening or weakening during the current sweep" icon={BrainCircuit}>
          {radar?.sectorShifts.length ? (
            <div className="panel-scroll-tight stack-12">
              {radar.sectorShifts.map((entry) => (
                <div key={entry.sector} className="list-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                    <div>
                      <div className="stat-label">Sector</div>
                      <div style={{ marginTop: 8, fontSize: 15, fontWeight: 700 }}>{entry.sector}</div>
                    </div>
                    <TrendBadge tone={entry.direction === 'strengthening' ? 'positive' : entry.direction === 'weakening' ? 'negative' : 'warning'}>{entry.direction}</TrendBadge>
                  </div>
                  <div className="metric-footnote">{entry.summary}</div>
                  <div className="metric-footnote">Breadth {formatPercent(entry.breadth, 0)} • Avg move {formatPercent(entry.averageChangePercent)} • {entry.signalCount} live signals</div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyPanel title="Sector shifts unavailable" description="Sector-strength transitions will appear here after the radar builds its feed." icon={BrainCircuit} />
          )}
        </SectionCard>
      </div>

      <div className="workbench-grid">
        <SectionCard title="Opportunity Stream" subtitle="Ranked setups still matter, but the signal feed now sits beside them" icon={Zap}>
          {loading && !radar ? (
            <div className="compact-card-grid">
              {[...Array(6)].map((_, index) => <div key={index} className="skeleton" style={{ height: 220 }} />)}
            </div>
          ) : radar?.opportunities.length ? (
            <div className="panel-scroll">
              <div className="compact-card-grid">
                {radar.opportunities.map((opportunity, index) => (
                  <OpportunityInsightCard key={opportunity.id} opportunity={opportunity} rank={index + 1} compact />
                ))}
              </div>
            </div>
          ) : (
            <EmptyPanel title="No ranked setups" description="This lens is currently too selective for the available market structure. Widen selectivity or change the opportunity mode." icon={Zap} />
          )}
        </SectionCard>

        <SectionCard title="Tape Movers" subtitle="Cross-check radar signals against the live tape" icon={Activity}>
          {summary ? (
            <div className="grid-fit-220">
              <QuoteTapeList title="Top gainers" items={summary.gainers.slice(0, 4)} />
              <QuoteTapeList title="Top losers" items={summary.losers.slice(0, 4)} />
              <QuoteTapeList title="Most active" items={summary.mostActive.slice(0, 4)} />
            </div>
          ) : (
            <EmptyPanel title="Tape movers unavailable" description="Gainers, losers, and active names will appear here once the market summary is ready." icon={Activity} />
          )}
        </SectionCard>
      </div>
    </div>
  );
}
