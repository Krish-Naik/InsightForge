'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, RefreshCw, ShieldCheck, TrendingDown, TrendingUp } from 'lucide-react';
import { HistoricalSeriesChart } from '@/components/charts/HistoricalSeriesChart';
import { EmptyPanel, MetricTile, PageHeader, SectionCard, TrendBadge } from '@/components/ui/page-kit';
import { marketAPI, type StockResearch } from '@/lib/api';
import { formatCurrency, formatNumber, formatPercent } from '@/lib/format';

const PERIODS = [
  { id: '1y', label: '1Y' },
  { id: '2y', label: '2Y' },
  { id: '5y', label: '5Y' },
  { id: '10y', label: '10Y' },
] as const;

export default function StockResearchPage() {
  const params = useParams<{ symbol: string }>();
  const symbol = decodeURIComponent(Array.isArray(params.symbol) ? params.symbol[0] : params.symbol || '').toUpperCase();
  const [period, setPeriod] = useState<(typeof PERIODS)[number]['id']>('10y');
  const [research, setResearch] = useState<StockResearch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadResearch = useCallback(async () => {
    if (!symbol) return;

    setLoading(true);
    try {
      const nextResearch = await marketAPI.getStockResearch(symbol);
      setResearch(nextResearch);
      setError(null);
    } catch (nextError) {
      setResearch(null);
      setError(nextError instanceof Error ? nextError.message : 'Failed to load stock research.');
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    loadResearch();
  }, [loadResearch]);

  const quote = research?.quote || null;
  const analytics = research?.analytics || null;
  const profile = research?.profile || null;
  const peers = research?.peers || [];
  const sectorOverview = research?.sectorOverview || null;
  const positive = (quote?.changePercent || 0) >= 0;

  const valuationTiles = useMemo(() => {
    return [
      { label: 'PE Ratio', value: analytics?.peRatio != null ? formatNumber(analytics.peRatio) : '—', tone: 'warning' as const },
      { label: 'P/B', value: analytics?.priceToBook != null ? formatNumber(analytics.priceToBook) : '—', tone: 'warning' as const },
      { label: 'Dividend Yield', value: analytics?.dividendYield != null ? formatPercent(analytics.dividendYield) : '—', tone: 'positive' as const },
      { label: 'Revenue Growth', value: analytics?.revenueGrowth != null ? formatPercent(analytics.revenueGrowth) : '—', tone: 'positive' as const },
      { label: 'Profit Margins', value: analytics?.profitMargins != null ? formatPercent(analytics.profitMargins) : '—', tone: 'positive' as const },
      { label: 'Beta', value: analytics?.beta != null ? formatNumber(analytics.beta) : '—', tone: 'primary' as const },
    ];
  }, [analytics]);

  return (
    <div className="page">
      <PageHeader
        kicker="Equity Research"
        title={profile?.name || symbol}
        description={profile?.narrative || 'Production-style research page with delayed cached market data, multi-year price structure, peer context, and valuation plus technical overlays.'}
        actions={
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link href="/screener" className="btn btn-ghost">
              <ArrowLeft style={{ width: 14, height: 14 }} />
              Back to screener
            </Link>
            <button onClick={loadResearch} disabled={loading} className="btn btn-primary">
              <RefreshCw style={{ width: 14, height: 14 }} className={loading ? 'anim-spin' : ''} />
              Refresh research
            </button>
          </div>
        }
      />

      {error ? <TrendBadge tone="warning">{error}</TrendBadge> : null}

      {loading && !research ? (
        <SectionCard title="Loading research" subtitle="Fetching the stock research workspace" icon={ShieldCheck}>
          <div className="stack-12">
            {[...Array(5)].map((_, index) => <div key={index} className="skeleton" style={{ height: 56 }} />)}
          </div>
        </SectionCard>
      ) : research && profile ? (
        <>
          <div className="grid-fit-220">
            <MetricTile label="Current price" value={quote ? formatCurrency(quote.price) : '—'} tone="primary" icon={ShieldCheck} subtext={profile.symbol} />
            <MetricTile label="Day move" value={quote ? formatPercent(quote.changePercent) : '—'} tone={positive ? 'positive' : 'negative'} icon={positive ? TrendingUp : TrendingDown} subtext={quote ? `${quote.change >= 0 ? '+' : ''}${formatCurrency(quote.change)}` : 'No live quote'} />
            <MetricTile label="Momentum score" value={analytics ? formatNumber(analytics.momentumScore) : '—'} tone={(analytics?.momentumScore || 0) >= 0 ? 'positive' : 'negative'} icon={positive ? TrendingUp : TrendingDown} subtext={analytics?.trend || 'neutral'} />
            <MetricTile label="RSI 14" value={analytics?.rsi14 != null ? formatNumber(analytics.rsi14) : '—'} tone="warning" icon={ShieldCheck} subtext={analytics?.volumeRatio != null ? `Vol ratio ${formatNumber(analytics.volumeRatio)}x` : 'Volume ratio unavailable'} />
          </div>

          <div className="two-column-layout">
            <div className="stack-16">
              <SectionCard title="Long-range line chart" subtitle="Use long windows here; intraday candlesticks remain available through the in-app chart modal elsewhere in the workspace" icon={TrendingUp}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <TrendBadge tone="primary">{profile.primarySector}</TrendBadge>
                    {profile.inNifty50 ? <TrendBadge tone="positive">Nifty 50</TrendBadge> : null}
                    {profile.industry ? <TrendBadge tone="warning">{profile.industry}</TrendBadge> : null}
                  </div>
                  <div className="tab-group">
                    {PERIODS.map((entry) => (
                      <button key={entry.id} type="button" onClick={() => setPeriod(entry.id)} className={`tab ${period === entry.id ? 'tab-active' : ''}`}>
                        {entry.label}
                      </button>
                    ))}
                  </div>
                </div>
                <HistoricalSeriesChart symbol={profile.symbol} period={period} variant="line" height={420} />
              </SectionCard>

              <SectionCard title="Technical structure" subtitle="Signals retail users rarely see organized together in one place" icon={ShieldCheck}>
                <div className="grid-fit-180">
                  <MetricTile label="52W range position" value={analytics ? `${formatNumber(analytics.week52RangePosition)}%` : '—'} tone="primary" />
                  <MetricTile label="Distance from 52W high" value={analytics ? formatPercent(analytics.distanceFromHigh52) : '—'} tone="negative" />
                  <MetricTile label="Distance from 52W low" value={analytics ? formatPercent(analytics.distanceFromLow52) : '—'} tone="positive" />
                  <MetricTile label="Liquidity score" value={analytics ? formatNumber(analytics.liquidityScore) : '—'} tone="primary" />
                  <MetricTile label="SMA 20" value={analytics?.sma20 != null ? formatCurrency(analytics.sma20) : '—'} tone="warning" />
                  <MetricTile label="SMA 50" value={analytics?.sma50 != null ? formatCurrency(analytics.sma50) : '—'} tone="warning" />
                </div>
              </SectionCard>

              <SectionCard title="Peer board" subtitle="Closest peer slice from the same tracked sector basket" icon={TrendingUp}>
                {peers.length ? (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Peer</th>
                          <th style={{ textAlign: 'right' }}>Price</th>
                          <th style={{ textAlign: 'right' }}>Day %</th>
                          <th style={{ textAlign: 'right' }}>Momentum</th>
                          <th style={{ textAlign: 'center' }}>Research</th>
                        </tr>
                      </thead>
                      <tbody>
                        {peers.map((peer) => (
                          <tr key={peer.symbol}>
                            <td>
                              <div className="mono" style={{ fontSize: 12, fontWeight: 700 }}>{peer.symbol}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{peer.name}</div>
                            </td>
                            <td style={{ textAlign: 'right' }}><span className="mono">{formatCurrency(peer.currentPrice)}</span></td>
                            <td style={{ textAlign: 'right' }}><span className="mono" style={{ color: peer.changePercent >= 0 ? 'var(--green)' : 'var(--red)' }}>{formatPercent(peer.changePercent)}</span></td>
                            <td style={{ textAlign: 'right' }}><span className="mono">{formatNumber(peer.momentumScore)}</span></td>
                            <td style={{ textAlign: 'center' }}>
                              <Link href={`/stocks/${encodeURIComponent(peer.symbol)}`} className="btn btn-ghost">Open</Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyPanel title="No peer coverage" description="Peer analytics will appear once the sector basket has enough resolved constituents." icon={ShieldCheck} />
                )}
              </SectionCard>
            </div>

            <div className="stack-16">
              <SectionCard title="Company profile" subtitle="Identity and market coverage details" icon={ShieldCheck}>
                <div className="stack-12">
                  <div className="metric-card">
                    <div className="stat-label">Primary sector</div>
                    <div className="metric-value">{profile.primarySector}</div>
                    <div className="metric-footnote">{profile.exchange}{profile.isin ? ` • ISIN ${profile.isin}` : ''}</div>
                  </div>
                  <div className="metric-card">
                    <div className="stat-label">Coverage notes</div>
                    <div className="stack-8" style={{ marginTop: 10 }}>
                      {profile.dataNotes.map((note) => (
                        <div key={note} style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.7 }}>{note}</div>
                      ))}
                    </div>
                  </div>
                  <div className="metric-card">
                    <div className="stat-label">Aliases</div>
                    <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {profile.aliases.length ? profile.aliases.map((alias) => <span key={alias} className="badge badge-muted">{alias}</span>) : <span className="metric-footnote">No aliases available.</span>}
                    </div>
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Valuation and quality" subtitle="Best-effort fundamentals from the legal public-data stack" icon={ShieldCheck}>
                <div className="grid-fit-180">
                  {valuationTiles.map((tile) => (
                    <MetricTile key={tile.label} label={tile.label} value={tile.value} tone={tile.tone} />
                  ))}
                </div>
              </SectionCard>

              <SectionCard title="Sector context" subtitle="How the tracked sector is behaving right now" icon={ShieldCheck}>
                {sectorOverview ? (
                  <div className="grid-fit-180">
                    <MetricTile label="Sector trend" value={sectorOverview.trend} tone={sectorOverview.trend === 'bullish' ? 'positive' : sectorOverview.trend === 'bearish' ? 'negative' : 'warning'} />
                    <MetricTile label="Average move" value={formatPercent(sectorOverview.averageChangePercent)} tone={sectorOverview.averageChangePercent >= 0 ? 'positive' : 'negative'} />
                    <MetricTile label="Breadth" value={`${sectorOverview.breadth.toFixed(0)}%`} tone="primary" />
                    <MetricTile label="Tracked stocks" value={sectorOverview.stockCount} tone="primary" subtext={`${sectorOverview.sampleSize} currently sampled`} />
                  </div>
                ) : (
                  <EmptyPanel title="Sector context unavailable" description="Sector breadth is not available for this symbol yet." icon={ShieldCheck} />
                )}
              </SectionCard>
            </div>
          </div>
        </>
      ) : (
        <SectionCard title="Research unavailable" subtitle="No profile was returned for the selected symbol" icon={ShieldCheck}>
          <EmptyPanel title="No research data" description="Try another symbol from the screener or scanner. The symbol may not have resolved cleanly into the exchange metadata universe yet." icon={ShieldCheck} />
        </SectionCard>
      )}
    </div>
  );
}