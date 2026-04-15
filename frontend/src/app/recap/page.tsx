'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, TimerReset } from 'lucide-react';
import { OpportunityInsightCard, RecapInsightCard, SectorPulseCard } from '@/components/ui/insight-kit';
import { EmptyPanel, MetricTile, PageHeader, SectionCard, TrendBadge } from '@/components/ui/page-kit';
import { marketAPI, type TodayDesk } from '@/lib/api';
import { formatIST, formatTimeAgo } from '@/lib/format';

export default function RecapPage() {
  const [desk, setDesk] = useState<TodayDesk | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDesk = useCallback(async () => {
    setRefreshing(true);
    try {
      const nextDesk = await marketAPI.getTodayDesk();
      setDesk(nextDesk);
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to load recap.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadDesk();
  }, [loadDesk]);

  const bearishNotes = desk?.recap.filter((entry) => entry.tone === 'bearish' || entry.tone === 'balanced').length || 0;

  return (
    <div className="page">
      <PageHeader
        kicker="Recap"
        title="Compact closeout for what worked and what still matters"
        description="Recap should train judgment. It is here to show what deserved attention, what was noise, and what still deserves carry-forward focus."
        actions={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {desk?.generatedAt ? <span className="topbar-pill">Updated {formatTimeAgo(desk.generatedAt)} • {formatIST(new Date(desk.generatedAt))}</span> : null}
            <TrendBadge tone={desk?.sourceMode === 'ai' ? 'primary' : 'warning'}>{desk?.sourceMode === 'ai' ? 'Groq recap' : 'Rules recap'}</TrendBadge>
            <button onClick={() => void loadDesk()} disabled={refreshing} className="btn btn-ghost">
              <RefreshCw style={{ width: 14, height: 14 }} className={refreshing ? 'anim-spin' : ''} />
              Refresh
            </button>
          </div>
        }
      />

      {error ? <TrendBadge tone="warning">{error}</TrendBadge> : null}

      <div className="metric-strip-grid">
        <MetricTile label="Key takeaways" value={desk?.recap.length || 0} tone="primary" icon={TimerReset} subtext={desk?.narrative.watchFor || 'Watching for the strongest lesson'} />
        <MetricTile label="Carry ideas" value={desk?.stocksToWatch.length || 0} tone="positive" icon={TimerReset} subtext="Names still worth attention" />
        <MetricTile label="Bearish notes" value={bearishNotes} tone="negative" icon={TimerReset} subtext="Warnings or failed structures" />
        <MetricTile label="Sector carry" value={desk?.sectorRotation.slice(0, 3).length || 0} tone="warning" icon={TimerReset} subtext="Sectors likely to shape the next session" />
      </div>

      <div className="workbench-grid">
        <SectionCard title="Key Takeaways" subtitle="The most useful lessons from the current market state" icon={TimerReset}>
        {loading && !desk ? (
          <div className="compact-card-grid">
            {[...Array(3)].map((_, index) => <div key={index} className="skeleton" style={{ height: 180 }} />)}
          </div>
        ) : desk?.recap.length ? (
          <div className="compact-card-grid">
            {desk.recap.map((entry) => (
              <RecapInsightCard key={`${entry.title}-${entry.symbols.join('-')}`} entry={entry} />
            ))}
          </div>
        ) : (
          <EmptyPanel title="Recap not ready" description="Once the day’s structure settles, the strongest lessons and carry-forward ideas will appear here." icon={TimerReset} />
        )}
        </SectionCard>

        <div className="workbench-column">
          <SectionCard title="Carry-Forward Watchlist" subtitle="Names that still deserve attention beyond the first burst" icon={TimerReset}>
            {desk?.stocksToWatch.length ? (
              <div className="panel-scroll-tight stack-12">
                {desk.stocksToWatch.map((entry, index) => (
                  <OpportunityInsightCard key={`${entry.id}-carry`} opportunity={entry} rank={index + 1} compact />
                ))}
              </div>
            ) : (
              <EmptyPanel title="No carry ideas" description="When leadership is too scattered, InsightForge avoids forcing a carry list." icon={TimerReset} />
            )}
          </SectionCard>

          <SectionCard title="Sector Context" subtitle="Which pockets should probably frame the next session" icon={TimerReset}>
            {desk?.sectorRotation.length ? (
              <div className="panel-scroll-tight stack-12">
                {desk.sectorRotation.slice(0, 4).map((entry) => (
                  <SectorPulseCard key={`${entry.sector}-recap`} entry={entry} />
                ))}
              </div>
            ) : (
              <EmptyPanel title="Sector recap unavailable" description="Sector carry will appear here once the breadth snapshot is available." icon={TimerReset} />
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
