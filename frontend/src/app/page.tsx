'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, BrainCircuit, RefreshCw, ShieldAlert, Sparkles, Target, TrendingDown, TrendingUp, Waves } from 'lucide-react';
import { OpportunityInsightCard, RecapInsightCard, SectorPulseCard } from '@/components/ui/insight-kit';
import { EmptyPanel, MetricTile, PageHeader, SectionCard, TrendBadge } from '@/components/ui/page-kit';
import { marketAPI, type MarketSummary, type Quote, type SectorOverview, type TodayDesk } from '@/lib/api';
import { formatCurrency, formatIST, formatLargeNumber, formatPercent, formatTimeAgo } from '@/lib/format';
import { useMarketStream } from '@/lib/hooks/useMarketStream';

function toneForChange(value: number) {
  return value >= 0 ? 'positive' : 'negative';
}

function preferredIndices(indices: MarketSummary['indices']) {
  const priority = ['NIFTY 50', 'NIFTY BANK', 'NIFTY NEXT 50', 'FINNIFTY', 'SENSEX'];
  const ranked = [...indices].sort((left, right) => {
    const leftIndex = priority.findIndex((entry) => left.symbol.includes(entry) || left.shortName.includes(entry));
    const rightIndex = priority.findIndex((entry) => right.symbol.includes(entry) || right.shortName.includes(entry));
    return (leftIndex === -1 ? 99 : leftIndex) - (rightIndex === -1 ? 99 : rightIndex);
  });
  return ranked.slice(0, 4);
}

function QuoteList({ title, items }: { title: string; items: Quote[] }) {
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
          </Link>
        )) : <div className="metric-footnote">No names available.</div>}
      </div>
    </div>
  );
}

export default function RootPage() {
  const [desk, setDesk] = useState<TodayDesk | null>(null);
  const [summary, setSummary] = useState<MarketSummary | null>(null);
  const [sectors, setSectors] = useState<SectorOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { connected, error: streamError } = useMarketStream(true);

  const loadOverview = useCallback(async () => {
    setRefreshing(true);
    try {
      const [nextDesk, nextSummary, nextSectors] = await Promise.all([
        marketAPI.getTodayDesk(),
        marketAPI.getMarketSummary(),
        marketAPI.getAllSectorsData(),
      ]);
      setDesk(nextDesk);
      setSummary(nextSummary);
      setSectors(nextSectors);
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to load market overview.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview();
    const timer = window.setInterval(() => { void loadOverview(); }, 60_000);
    return () => window.clearInterval(timer);
  }, [loadOverview]);

  const positiveSectors = sectors.filter((entry) => entry.trend === 'bullish').length;
  const negativeSectors = sectors.filter((entry) => entry.trend === 'bearish').length;
  const breadthLead = [...sectors].sort((left, right) => right.breadth - left.breadth).slice(0, 6);
  const breadthRisks = [...sectors].sort((left, right) => left.breadth - right.breadth).slice(0, 3);
  const primaryIndices = preferredIndices(summary?.indices || []);
  const activeWatch = desk?.stocksToWatch.slice(0, 3) || [];
  const breadthBias = sectors.length
    ? (sectors.reduce((sum, entry) => sum + entry.breadth, 0) / sectors.length)
    : 0;

  return (
    <div className="page">
      <PageHeader
        kicker="Today"
        title="Market overview first, setups second"
        description="Start with Nifty, sector breadth, active tape, and market risk. Stock ideas stay available, but they no longer dominate the home page."
        actions={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <TrendBadge tone={connected ? 'positive' : 'warning'}>
              <span className={`status-dot ${connected ? 'is-live' : ''}`} />
              {connected ? 'Live pulse' : 'Delayed pulse'}
            </TrendBadge>
            {desk ? <TrendBadge tone={desk.sourceMode === 'ai' ? 'primary' : 'warning'}>{desk.sourceMode === 'ai' ? 'Groq overview' : 'Rules overview'}</TrendBadge> : null}
            {desk?.generatedAt ? <span className="topbar-pill">Updated {formatTimeAgo(desk.generatedAt)} • {formatIST(new Date(desk.generatedAt))}</span> : null}
            <button onClick={() => void loadOverview()} disabled={refreshing} className="btn btn-ghost">
              <RefreshCw style={{ width: 14, height: 14 }} className={refreshing ? 'anim-spin' : ''} />
              Refresh
            </button>
          </div>
        }
      />

      {error || streamError ? <TrendBadge tone="warning">{error || streamError}</TrendBadge> : null}

      <div className="metric-strip-grid">
        <MetricTile label="Market status" value={summary?.marketStatus || '—'} tone="primary" icon={Activity} subtext={primaryIndices[0] ? `${primaryIndices[0].shortName} ${formatPercent(primaryIndices[0].changePercent)}` : 'Waiting for index data'} />
        <MetricTile label="Bullish sectors" value={positiveSectors} tone="positive" icon={TrendingUp} subtext="Sectors with positive breadth" />
        <MetricTile label="Bearish sectors" value={negativeSectors} tone="negative" icon={TrendingDown} subtext="Sectors with negative breadth" />
        <MetricTile label="Breadth bias" value={formatPercent(breadthBias, 1)} tone={breadthBias >= 0 ? 'warning' : 'negative'} icon={Waves} subtext="Average sector breadth across the market" />
      </div>

      <div className="workbench-grid-three">
        <SectionCard title="Index Board" subtitle="Nifty and the headline tape before stock ideas" icon={Activity} tone="primary">
          {primaryIndices.length ? (
            <div className="compact-card-grid">
              {primaryIndices.map((index) => (
                <div key={index.symbol} className="list-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                    <div>
                      <div className="stat-label">Index</div>
                      <div style={{ marginTop: 8, fontSize: 15, fontWeight: 700 }}>{index.shortName}</div>
                      <div className="metric-footnote">{index.symbol}</div>
                    </div>
                    <TrendBadge tone={toneForChange(index.changePercent)}>{formatPercent(index.changePercent)}</TrendBadge>
                  </div>
                  <div className="metric-value" style={{ marginTop: 12 }}>{formatCurrency(index.price)}</div>
                  <div className="metric-footnote">Range {formatCurrency(index.dayLow)} to {formatCurrency(index.dayHigh)}</div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyPanel title="Index board loading" description="Index context will appear here as soon as the cached market summary is ready." icon={Activity} />
          )}
        </SectionCard>

        <SectionCard title="Market Narrative" subtitle="General overview before specific setups" icon={BrainCircuit}>
          {desk ? (
            <div className="stack-16">
              <div>
                <h2 style={{ fontSize: '1.55rem', lineHeight: 1.15 }}>{desk.narrative.headline}</h2>
                <p className="metric-footnote" style={{ marginTop: 12 }}>{desk.narrative.summary}</p>
              </div>
              <div className="surface-inset">
                <div className="stat-label">Watch for</div>
                <div className="metric-footnote" style={{ marginTop: 10 }}>{desk.narrative.watchFor}</div>
              </div>
              <div className="surface-inset">
                <div className="stat-label">Main risk</div>
                <div className="metric-footnote" style={{ marginTop: 10 }}>{desk.narrative.risk}</div>
              </div>
            </div>
          ) : (
            <EmptyPanel title="Overview loading" description="The narrative overview appears once market breadth and index context are combined." icon={BrainCircuit} />
          )}
        </SectionCard>

        <SectionCard title="Risk Monitor" subtitle="Where the general tape is strengthening or cracking" icon={ShieldAlert}>
          {sectors.length ? (
            <div className="stack-12">
              <div className="surface-inset">
                <div className="stat-label">Strongest pocket</div>
                <div className="metric-value">{breadthLead[0]?.sector || '—'}</div>
                <div className="metric-footnote">Breadth {breadthLead[0] ? formatPercent(breadthLead[0].breadth, 0) : '—'}</div>
              </div>
              <div className="surface-inset">
                <div className="stat-label">Weakest pocket</div>
                <div className="metric-value">{breadthRisks[0]?.sector || '—'}</div>
                <div className="metric-footnote">Breadth {breadthRisks[0] ? formatPercent(breadthRisks[0].breadth, 0) : '—'}</div>
              </div>
              <div className="surface-inset">
                <div className="stat-label">Active tape</div>
                <div className="metric-footnote" style={{ marginTop: 10 }}>{summary?.mostActive[0] ? `${summary.mostActive[0].symbol} is leading activity with ${formatLargeNumber(summary.mostActive[0].volume)} volume.` : 'Waiting for activity data.'}</div>
              </div>
            </div>
          ) : (
            <EmptyPanel title="Risk monitor loading" description="Sector breadth and pressure points will appear here once the market-wide snapshot is ready." icon={ShieldAlert} />
          )}
        </SectionCard>
      </div>

      <div className="workbench-grid">
        <SectionCard title="Sector Breadth" subtitle="Leadership, laggards, and where the market is actually broadening" icon={Waves}>
          {desk?.sectorRotation.length ? (
            <div className="panel-scroll stack-12">
              {desk.sectorRotation.map((entry) => (
                <SectorPulseCard key={entry.sector} entry={entry} />
              ))}
            </div>
          ) : (
            <EmptyPanel title="Sector breadth unavailable" description="Sector breadth cards will appear here once the sector snapshot is ready." icon={Waves} />
          )}
        </SectionCard>

        <SectionCard title="Tape Activity" subtitle="Gainers, losers, and most-active names for the general overview" icon={Activity}>
          {summary ? (
            <div className="grid-fit-220">
              <QuoteList title="Top gainers" items={summary.gainers.slice(0, 4)} />
              <QuoteList title="Top losers" items={summary.losers.slice(0, 4)} />
              <QuoteList title="Most active" items={summary.mostActive.slice(0, 4)} />
            </div>
          ) : (
            <EmptyPanel title="Tape activity unavailable" description="Market movers will appear here once the summary snapshot is loaded." icon={Activity} />
          )}
        </SectionCard>
      </div>

      <div className="workbench-grid">
        <SectionCard title="Actionable Follow-Through" subtitle="Setups are still here, but they now sit behind the broader market read" icon={Target}>
          {activeWatch.length ? (
            <div className="compact-card-grid">
              {activeWatch.map((entry, index) => (
                <OpportunityInsightCard key={`${entry.id}-watch`} opportunity={entry} rank={index + 1} compact />
              ))}
            </div>
          ) : (
            <EmptyPanel title="No carry setups yet" description="Once the market overview identifies cleaner follow-through names, they will appear here." icon={Target} />
          )}
        </SectionCard>

        <SectionCard title="Carry And Cautions" subtitle="What should frame tomorrow after the general market read" icon={ShieldAlert}>
          {desk?.recap.length ? (
            <div className="panel-scroll-tight stack-12">
              {desk.recap.map((entry) => (
                <RecapInsightCard key={`${entry.title}-${entry.symbols.join('-')}`} entry={entry} />
              ))}
            </div>
          ) : (
            <EmptyPanel title="Recap pending" description="Carry-forward notes appear once the system has enough context to summarize what matters next." icon={ShieldAlert} />
          )}
        </SectionCard>
      </div>
    </div>
  );
}
