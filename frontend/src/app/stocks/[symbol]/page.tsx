'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, BrainCircuit, RefreshCw, ShieldAlert, Sparkles, TrendingDown, TrendingUp, Waves } from 'lucide-react';
import { HistoricalSeriesChart } from '@/components/charts/HistoricalSeriesChart';
import { StoryTimeline } from '@/components/ui/insight-kit';
import { SymbolLink } from '@/components/ui/SymbolLink';
import { EmptyPanel, MetricTile, PageHeader, SectionCard, TrendBadge } from '@/components/ui/page-kit';
import { FinancialDataSection } from '@/components/ui/FinancialDataSection';
import { FinancialInsightSection } from '@/components/ui/FinancialInsightSection';
import { PriceInsightSection } from '@/components/ui/PriceInsightSection';
import { marketAPI, type StockResearch } from '@/lib/api';
import { formatCurrency, formatIST, formatNumber, formatPercent, formatTimeAgo } from '@/lib/format';

export default function StockStoryPage() {
  const params = useParams<{ symbol: string }>();
  const symbol = decodeURIComponent(Array.isArray(params.symbol) ? params.symbol[0] : params.symbol || '').toUpperCase();
  const [research, setResearch] = useState<StockResearch | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<'1y' | '2y' | '5y' | '10y'>('2y');
  const [chartPeriod, setChartPeriod] = useState<'1y' | '2y' | '5y'>('1y');

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
  const positive = (quote?.changePercent || analytics?.changePercent || 0) >= 0;
  const stanceTone = story?.stance === 'strong' || story?.stance === 'early'
    ? 'positive'
    : story?.stance === 'weak'
      ? 'negative'
      : story?.stance === 'extended'
        ? 'warning'
        : 'primary';
  const stageTone = story?.setupMap.stage === 'ready' || story?.setupMap.stage === 'fresh'
    ? 'positive'
    : story?.setupMap.stage === 'extended'
      ? 'warning'
      : story?.setupMap.stage === 'weakening'
        ? 'negative'
        : 'primary';

  return (
    <div className="page">
      <PageHeader
        kicker="Stock Story"
        title={profile?.name || symbol}
        description={story?.summary || profile?.narrative || 'Narrative-first research page built to explain the setup before drowning the user in indicators.'}
        actions={
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={() => void loadResearch()} disabled={refreshing} className="btn btn-primary">
              <RefreshCw style={{ width: 14, height: 14 }} className={refreshing ? 'anim-spin' : ''} />
              Refresh story
            </button>
          </div>
        }
      />

      {error ? <TrendBadge tone="warning">{error}</TrendBadge> : null}

      {loading && !research ? (
        <SectionCard title="Loading stock story" subtitle="Building the narrative, setup map, and sector context" icon={BrainCircuit}>
          <div className="stack-12">
            {[...Array(5)].map((_, index) => <div key={index} className="skeleton" style={{ height: 64 }} />)}
          </div>
        </SectionCard>
      ) : research && profile ? (
        <>
          <div className="metric-strip-grid">
            <MetricTile label="Current price" value={quote ? formatCurrency(quote.price) : '—'} tone="primary" icon={positive ? TrendingUp : TrendingDown} subtext={profile.symbol} />
            <MetricTile label="Day move" value={quote ? formatPercent(quote.changePercent) : analytics ? formatPercent(analytics.changePercent) : '—'} tone={positive ? 'positive' : 'negative'} icon={positive ? TrendingUp : TrendingDown} subtext={quote ? `${quote.change >= 0 ? '+' : ''}${formatCurrency(quote.change)}` : 'Delayed quote snapshot'} />
            <MetricTile label="Momentum score" value={analytics ? formatNumber(analytics.momentumScore) : '—'} tone="positive" icon={Sparkles} subtext={analytics?.trend || 'neutral'} />
            <MetricTile label="Story confidence" value={story ? `${story.whyMoving.confidence}` : analytics?.rsi14 != null ? formatNumber(analytics.rsi14) : '—'} tone="warning" icon={BrainCircuit} subtext={analytics?.volumeRatio != null ? `Vol ${analytics.volumeRatio.toFixed(1)}x` : 'Volume ratio unavailable'} />
          </div>

          <SectionCard title="Chart" subtitle="Price history and trends" icon={Waves}>
            <div className="stack-16">
              <div className="tab-group">
                {[
                  { id: '1y', label: '1Y' },
                  { id: '2y', label: '2Y' },
                  { id: '5y', label: '5Y' },
                ].map((entry) => (
                  <button key={entry.id} type="button" onClick={() => setChartPeriod(entry.id as '1y' | '2y' | '5y')} className={`tab ${chartPeriod === entry.id ? 'tab-active' : ''}`}>
                    {entry.label}
                  </button>
                ))}
              </div>
              <HistoricalSeriesChart symbol={profile.symbol} period={chartPeriod} variant="line" height={360} />
            </div>
          </SectionCard>

          {story && (
            <SectionCard title="Price Structure" subtitle="Triggers, invalidation, and the chart in one compact frame" icon={Waves}>
              <div className="stack-16">
                <div className="grid-fit-180">
                  <MetricTile label="Trigger" value={story.setupMap.trigger} tone="primary" />
                  <MetricTile label="Invalidation" value={story.setupMap.invalidation} tone="negative" />
                  <MetricTile label="Support" value={story.setupMap.support} tone="positive" />
                  <MetricTile label="Resistance" value={story.setupMap.resistance} tone="warning" />
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <TrendBadge tone={stageTone}>{story.setupMap.stage}</TrendBadge>
                </div>
              </div>
            </SectionCard>
          )}

          <PriceInsightSection symbol={symbol} />

          <FinancialDataSection symbol={symbol} />

          <div className="workbench-grid">
            <div className="workbench-column">
              <SectionCard title="Why This Name Matters Now" subtitle="Interpretation first, then the proof behind it" icon={BrainCircuit} tone="primary">
                {story ? (
                  <div className="stack-16">
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <TrendBadge tone={stanceTone}>{story.stance}</TrendBadge>
                      <TrendBadge tone="primary">{story.horizonFit}</TrendBadge>
                      <TrendBadge tone={story.sourceMode === 'ai' ? 'primary' : 'warning'}>{story.sourceMode === 'ai' ? 'Groq story' : 'Rules story'}</TrendBadge>
                      <TrendBadge tone="warning">{profile.primarySector}</TrendBadge>
                    </div>

                    <div className="surface-inset">
                      <div className="stat-label">30-second brief</div>
                      <div className="metric-footnote" style={{ marginTop: 10 }}>{story.summary}</div>
                    </div>

                    <div className="grid-fit-220">
                      <div className="surface-inset">
                        <div className="stat-label">Primary reason</div>
                        <div className="metric-footnote" style={{ marginTop: 10 }}>{story.whyMoving.primary}</div>
                      </div>
                      <div className="surface-inset">
                        <div className="stat-label">Secondary reason</div>
                        <div className="metric-footnote" style={{ marginTop: 10 }}>{story.whyMoving.secondary}</div>
                      </div>
                    </div>

                    <div className="surface-inset">
                      <div className="stat-label">Evidence</div>
                      <div className="stack-8" style={{ marginTop: 12 }}>
                        {story.whyMoving.evidence.map((entry) => (
                          <div key={entry} className="metric-footnote">{entry}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <EmptyPanel title="Narrative unavailable" description="The stock story is waiting for enough context to explain the move cleanly." icon={BrainCircuit} />
                )}
              </SectionCard>

              <SectionCard title="Bull Vs Bear Case" subtitle="Useful setups need both conviction and invalidation" icon={Sparkles}>
                {story ? (
                  <div className="grid-fit-220">
                    <div className="metric-card">
                      <div className="stat-label">Bull case</div>
                      <div className="stack-8" style={{ marginTop: 12 }}>
                        {story.bullCase.map((entry) => <div key={entry} className="metric-footnote">{entry}</div>)}
                      </div>
                    </div>
                    <div className="metric-card">
                      <div className="stat-label">Bear case</div>
                      <div className="stack-8" style={{ marginTop: 12 }}>
                        {story.bearCase.map((entry) => <div key={entry} className="metric-footnote">{entry}</div>)}
                      </div>
                    </div>
                  </div>
                ) : (
                  <EmptyPanel title="Decision frame unavailable" description="Bull and bear framing appears once the stock story is generated." icon={Sparkles} />
                )}
              </SectionCard>

              <SectionCard title="Sector And Peers" subtitle="Know whether the stock is leading, lagging, or leaning on the sector" icon={Waves}>
                <div className="stack-16">
                  {sectorOverview ? (
                    <div className="grid-fit-180">
                      <MetricTile label="Sector trend" value={sectorOverview.trend} tone={sectorOverview.trend === 'bullish' ? 'positive' : sectorOverview.trend === 'bearish' ? 'negative' : 'warning'} />
                      <MetricTile label="Average move" value={formatPercent(sectorOverview.averageChangePercent)} tone={sectorOverview.averageChangePercent >= 0 ? 'positive' : 'negative'} />
                      <MetricTile label="Breadth" value={`${sectorOverview.breadth.toFixed(0)}%`} tone="primary" />
                      <MetricTile label="Tracked stocks" value={sectorOverview.stockCount} tone="warning" />
                    </div>
                  ) : null}

                  {peers.length ? (
                    <div className="compact-card-grid">
                      {peers.slice(0, 6).map((peer) => (
                        <Link key={peer.symbol} href={`/stocks/${encodeURIComponent(peer.symbol)}`} className="list-card" style={{ textDecoration: 'none' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                            <div>
                              <div className="stat-label">Peer</div>
                              <div style={{ marginTop: 8, fontSize: 16, fontWeight: 700 }}>{peer.symbol}</div>
                              <div className="metric-footnote">{peer.name}</div>
                            </div>
                            <TrendBadge tone={peer.changePercent >= 0 ? 'positive' : 'negative'}>{formatPercent(peer.changePercent)}</TrendBadge>
                          </div>
                          <div className="opportunity-chip-row">
                            <span className="badge badge-muted">Momentum {peer.momentumScore.toFixed(0)}</span>
                            {peer.trend ? <span className="badge badge-primary">{peer.trend}</span> : null}
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <EmptyPanel title="Peer context unavailable" description="Peers appear once the sector basket has enough clean constituents." icon={Waves} />
                  )}
                </div>
              </SectionCard>
            </div>

            <div className="workbench-column panel-sticky">
              <SectionCard title="Decision Map" subtitle="Everything needed for the next decision in one glance" icon={ShieldAlert} tone="warning">
                {story ? (
                  <div className="stack-16">
                    <div className="grid-fit-180">
                      <MetricTile label="Confidence" value={story.whyMoving.confidence} tone="warning" />
                      <MetricTile label="Stance" value={story.stance} tone={stanceTone} />
                      <MetricTile label="Horizon fit" value={story.horizonFit} tone="primary" />
                      <MetricTile label="Stage" value={story.setupMap.stage} tone={stageTone} />
                    </div>

                    <div className="surface-inset">
                      <div className="stat-label">Watch next</div>
                      <div className="metric-footnote" style={{ marginTop: 10 }}>{story.whyMoving.watchNext}</div>
                    </div>

                    <div className="surface-inset">
                      <div className="stat-label">Main risk</div>
                      <div className="metric-footnote" style={{ marginTop: 10 }}>{story.whyMoving.risk}</div>
                    </div>
                  </div>
                ) : (
                  <EmptyPanel title="Decision map unavailable" description="The decision map will appear once the story engine finishes scoring the setup." icon={ShieldAlert} />
                )}
              </SectionCard>

              <SectionCard title="Action Rail" subtitle="Keep the next action obvious and lightweight" icon={Sparkles}>
                <div className="stack-12">
                  <SymbolLink symbol={profile.symbol} className="btn btn-primary">Open chart</SymbolLink>
                  <Link href="/watchlist" className="btn btn-ghost">Track in watchlist</Link>
                  <Link href="/news" className="btn btn-ghost">Check story feed</Link>
                </div>
              </SectionCard>

              <SectionCard title="Company Context" subtitle="Identity, coverage, and the practical limits of the data stack" icon={ShieldAlert}>
                <div className="stack-12">
                  <div className="surface-inset">
                    <div className="stat-label">Coverage</div>
                    <div className="metric-value">{profile.primarySector}</div>
                    <div className="metric-footnote">{profile.exchange}{profile.industry ? ` • ${profile.industry}` : ''}{profile.inNifty50 ? ' • Nifty 50' : ''}</div>
                  </div>

                  <div className="surface-inset">
                    <div className="stat-label">Aliases</div>
                    <div className="opportunity-chip-row" style={{ marginTop: 12 }}>
                      {profile.aliases.length ? profile.aliases.map((entry) => <span key={entry} className="badge badge-muted">{entry}</span>) : <span className="metric-footnote">No aliases recorded.</span>}
                    </div>
                  </div>

                  <div className="surface-inset">
                    <div className="stat-label">Data notes</div>
                    <div className="stack-8" style={{ marginTop: 12 }}>
                      {profile.dataNotes.map((entry) => <div key={entry} className="metric-footnote">{entry}</div>)}
                    </div>
                  </div>
                </div>
              </SectionCard>
            </div>
          </div>
        </>
      ) : (
        <SectionCard title="Stock story unavailable" subtitle="The symbol could not be resolved into a clean research profile" icon={BrainCircuit}>
          <EmptyPanel title="No stock story" description="Try another symbol from Radar or Guided Screener. The current symbol may not have enough clean market metadata yet." icon={BrainCircuit} />
        </SectionCard>
      )}
    </div>
  );
}
