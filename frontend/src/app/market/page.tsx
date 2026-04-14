'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  CandlestickChart,
  Layers,
  LineChart,
  RefreshCw,
  ShieldCheck,
  Siren,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { HistoricalSeriesChart } from '@/components/charts/HistoricalSeriesChart';
import { Sparkline } from '@/components/charts/Sparkline';
import { TVWidget } from '@/components/charts/TVWidget';
import { SymbolLink } from '@/components/ui/SymbolLink';
import { EmptyPanel, MetricTile, PageHeader, SectionCard, TrendBadge } from '@/components/ui/page-kit';
import { marketAPI, type Index, type Quote, type SectorOverview } from '@/lib/api';
import { formatCurrency, formatIST, formatLargeNumber, formatPercent } from '@/lib/format';
import { useMarketStream } from '@/lib/hooks/useMarketStream';

type MarketSummary = {
  indices: Index[];
  gainers: Quote[];
  losers: Quote[];
  mostActive: Quote[];
  lastUpdated?: string;
  marketStatus?: string;
};

const EMPTY_SUMMARY: MarketSummary = {
  indices: [],
  gainers: [],
  losers: [],
  mostActive: [],
};

type MarketTab = 'overview' | 'sectors' | 'movers' | 'charts';

function toneFromNumber(value: number): 'positive' | 'negative' | 'warning' {
  if (value > 0) return 'positive';
  if (value < 0) return 'negative';
  return 'warning';
}

function StatusControls({
  connected,
  error,
  loading,
  lastUpdated,
  onRefresh,
}: {
  connected: boolean;
  error: string | null;
  loading: boolean;
  lastUpdated: string | null;
  onRefresh: () => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' }}>
      <TrendBadge tone={connected ? 'positive' : 'warning'}>
        <span className="pulse-dot" style={{ background: connected ? 'var(--green)' : 'var(--amber)' }} />
        {connected ? 'Stream connected' : 'Delayed cache'}
      </TrendBadge>
      {error ? <TrendBadge tone="warning">{error}</TrendBadge> : null}
      {lastUpdated ? <span className="topbar-pill">Updated {formatIST(new Date(lastUpdated))}</span> : null}
      <button onClick={onRefresh} disabled={loading} className="btn btn-ghost">
        <RefreshCw style={{ width: 14, height: 14 }} className={loading ? 'anim-spin' : ''} />
        Refresh snapshot
      </button>
    </div>
  );
}

function IndexCard({ index }: { index: Index }) {
  const positive = index.changePercent >= 0;

  return (
    <SymbolLink symbol={index.symbol} className="metric-card" style={{ textAlign: 'left', padding: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <div>
          <div className="stat-label">{index.shortName || index.symbol}</div>
          <div className="metric-value">{index.price > 0 ? formatCurrency(index.price) : '—'}</div>
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-3)' }}>{index.symbol}</div>
        </div>
        <TrendBadge tone={positive ? 'positive' : 'negative'}>
          {positive ? <ArrowUpRight style={{ width: 12, height: 12 }} /> : <ArrowDownRight style={{ width: 12, height: 12 }} />}
          {formatPercent(index.changePercent)}
        </TrendBadge>
      </div>
      <div style={{ height: 76, marginTop: 14 }}>
        <Sparkline symbol={index.symbol} period="1mo" width={260} height={76} />
      </div>
      <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11, color: 'var(--text-2)' }}>
        <span>Vol {index.volume > 0 ? formatLargeNumber(index.volume) : '—'}</span>
        <span>{index.marketState || 'REGULAR'}</span>
      </div>
    </SymbolLink>
  );
}

function MoversList({ title, subtitle, icon: Icon, items }: {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  items: Quote[];
}) {
  return (
    <SectionCard title={title} subtitle={subtitle} icon={Icon}>
      <div className="stack-12">
        {items.length ? items.slice(0, 8).map((item, index) => (
          <div key={item.symbol} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
              <span className="mono dim" style={{ width: 16 }}>{index + 1}</span>
              <SymbolLink symbol={item.symbol} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
                <div className="mono" style={{ fontSize: 12, fontWeight: 700 }}>{item.symbol}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
              </SymbolLink>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="mono" style={{ fontSize: 12 }}>{formatCurrency(item.price)}</div>
              <div className="mono" style={{ fontSize: 12, color: item.changePercent >= 0 ? 'var(--green)' : 'var(--red)' }}>{formatPercent(item.changePercent)}</div>
            </div>
          </div>
        )) : <EmptyPanel title="Waiting for quotes" description="This leaderboard fills as soon as delayed cached prices are available." icon={Siren} />}
      </div>
    </SectionCard>
  );
}

function SectorBoard({ sectors }: { sectors: SectorOverview[] }) {
  return (
    <SectionCard
      title="Sector Breadth"
      subtitle="Bullish and bearish sectors first, with leaders from each market pocket"
      icon={Layers}
    >
      <div className="grid-fit-280">
        {sectors.map((sector) => {
          const tone = sector.trend === 'bullish' ? 'positive' : sector.trend === 'bearish' ? 'negative' : 'warning';
          const proxySymbol = sector.leader?.symbol || sector.stocks[0]?.symbol || 'NIFTY 50';

          return (
            <div key={sector.sector} className="metric-card" style={{ minHeight: 250 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                <div>
                  <div className="stat-label">{sector.sector}</div>
                  <div className="metric-value" style={{ color: tone === 'positive' ? 'var(--green)' : tone === 'negative' ? 'var(--red)' : 'var(--amber)' }}>
                    {formatPercent(sector.averageChangePercent)}
                  </div>
                </div>
                <TrendBadge tone={tone}>{sector.trend}</TrendBadge>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginTop: 14 }}>
                <MetricTile label="Bullish" value={sector.bullishCount} tone="positive" />
                <MetricTile label="Bearish" value={sector.bearishCount} tone="negative" />
                <MetricTile label="Breadth" value={`${sector.breadth.toFixed(0)}%`} tone={tone} />
              </div>

              <div style={{ height: 64, marginTop: 14 }}>
                <Sparkline symbol={proxySymbol} period="1mo" width={260} height={64} />
              </div>

              <div className="stack-8" style={{ marginTop: 14 }}>
                {sector.stocks.slice(0, 4).map((stock) => (
                  <div key={stock.symbol} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                    <SymbolLink symbol={stock.symbol} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
                      <div className="mono" style={{ fontSize: 12, fontWeight: 700 }}>{stock.symbol}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{stock.name}</div>
                    </SymbolLink>
                    <div style={{ textAlign: 'right' }}>
                      <div className="mono" style={{ fontSize: 12 }}>{formatCurrency(stock.price)}</div>
                      <div className="mono" style={{ fontSize: 12, color: stock.changePercent >= 0 ? 'var(--green)' : 'var(--red)' }}>{formatPercent(stock.changePercent)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

function SectorStrip({ title, sectors }: { title: string; sectors: SectorOverview[] }) {
  return (
    <div className="stack-8">
      <div className="stat-label">{title}</div>
      {sectors.length ? sectors.map((sector) => (
        <div key={sector.sector} className="metric-card" style={{ padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700 }}>{sector.sector}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                {sector.stockCount} stocks tracked
              </div>
            </div>
            <div className="mono" style={{ fontSize: 12, color: sector.averageChangePercent >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {formatPercent(sector.averageChangePercent)}
            </div>
          </div>
        </div>
      )) : <div className="metric-footnote">No sector movement available yet.</div>}
    </div>
  );
}

export default function MarketPage() {
  const [summary, setSummary] = useState<MarketSummary>(EMPTY_SUMMARY);
  const [sectors, setSectors] = useState<SectorOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<MarketTab>('overview');
  const [benchmarkSymbol, setBenchmarkSymbol] = useState('NIFTY 50');
  const [benchmarkPeriod, setBenchmarkPeriod] = useState<'1mo' | '3mo' | '1y' | '5y'>('1y');
  const { data: stream, connected, error: streamError, lastEventAt } = useMarketStream(true);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryData, sectorData] = await Promise.all([
        marketAPI.getMarketSummary() as Promise<MarketSummary>,
        marketAPI.getAllSectorsData(),
      ]);
      setSummary(summaryData || EMPTY_SUMMARY);
      setSectors(sectorData || []);
      setLastUpdated(new Date().toISOString());
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to load the market dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (!stream) return;

    if (stream.type === 'market_update' || stream.type === 'indices_tick') {
      setSummary((current) => ({
        ...current,
        indices: stream.indices || current.indices,
        gainers: stream.gainers || current.gainers,
        losers: stream.losers || current.losers,
        mostActive: stream.mostActive || current.mostActive,
      }));
    }
  }, [stream]);

  const headlineIndices = useMemo(() => summary.indices.slice(0, 4), [summary.indices]);
  const averageIndexMove = useMemo(() => {
    if (!summary.indices.length) return 0;
    return summary.indices.reduce((sum, index) => sum + index.changePercent, 0) / summary.indices.length;
  }, [summary.indices]);
  const breadthBias = useMemo(() => {
    const bullish = sectors.filter((sector) => sector.trend === 'bullish').length;
    const bearish = sectors.filter((sector) => sector.trend === 'bearish').length;
    return bullish - bearish;
  }, [sectors]);
  const bullishSectors = useMemo(() => sectors.filter((sector) => sector.trend === 'bullish').slice(0, 3), [sectors]);
  const bearishSectors = useMemo(() => sectors.filter((sector) => sector.trend === 'bearish').slice(0, 3), [sectors]);

  useEffect(() => {
    if (!summary.indices.length) return;
    if (!summary.indices.some((entry) => entry.symbol === benchmarkSymbol)) {
      setBenchmarkSymbol(summary.indices[0].symbol);
    }
  }, [benchmarkSymbol, summary.indices]);

  const benchmarkIndex = useMemo(
    () => summary.indices.find((entry) => entry.symbol === benchmarkSymbol) || headlineIndices[0] || null,
    [benchmarkSymbol, headlineIndices, summary.indices],
  );

  return (
    <div className="page">
      <PageHeader
        kicker="Command Center"
        title="Professional Indian market overview"
        description="A production-style command center built around delayed Yahoo Finance quotes, TradingView charting, sector rotation, and cached movers. The pipeline is intentionally rate-safe so it can scale without tripping public market-data limits."
        actions={
          <StatusControls
            connected={connected}
            error={error || streamError}
            loading={loading}
            lastUpdated={lastEventAt || lastUpdated}
            onRefresh={loadDashboard}
          />
        }
      />

      <div className="grid-fit-220">
        <MetricTile
          label="Market regime"
          value={summary.marketStatus || 'REGULAR'}
          tone="primary"
          icon={ShieldCheck}
          subtext="Derived from the latest headline-index snapshot"
        />
        <MetricTile
          label="Average index move"
          value={formatPercent(averageIndexMove)}
          tone={toneFromNumber(averageIndexMove)}
          icon={Activity}
          subtext="Mean of the tracked benchmark basket"
        />
        <MetricTile
          label="Sector breadth bias"
          value={breadthBias >= 0 ? `+${breadthBias}` : breadthBias}
          tone={breadthBias >= 0 ? 'positive' : 'negative'}
          icon={Layers}
          subtext="Bullish sectors minus bearish sectors"
        />
        <MetricTile
          label="Most active print"
          value={summary.mostActive[0] ? formatLargeNumber(summary.mostActive[0].volume * summary.mostActive[0].price) : '—'}
          tone="warning"
          icon={CandlestickChart}
          subtext="Top visible turnover in the tracked universe"
        />
      </div>

      <div className="tab-group" style={{ alignSelf: 'flex-start' }}>
        {[
          { id: 'overview', label: 'Overview', icon: Activity },
          { id: 'sectors', label: 'Sectors', icon: Layers },
          { id: 'movers', label: 'Movers', icon: TrendingUp },
          { id: 'charts', label: 'Charts', icon: CandlestickChart },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id as MarketTab)} className={`tab ${activeTab === tab.id ? 'tab-active' : ''}`}>
              <Icon style={{ width: 14, height: 14 }} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'overview' ? (
        <div className="stack-16">
          <SectionCard title="Headline Indices" subtitle="Cleaner entry points into the most important benchmarks" icon={CandlestickChart}>
            {headlineIndices.length ? (
              <div className="grid-fit-280">
                {headlineIndices.map((index) => <IndexCard key={index.symbol} index={index} />)}
              </div>
            ) : (
              <EmptyPanel title="Indices unavailable" description="The dashboard is waiting for its first cached summary snapshot. Retry refresh or wait for the live stream to reconnect." icon={Siren} />
            )}
          </SectionCard>

          <SectionCard title="Benchmark Line Board" subtitle="Overview stays on line charts for readability while the full chart workspace remains available under the chart tab" icon={LineChart}>
            {benchmarkIndex ? (
              <div className="stack-16">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div>
                    <div className="stat-label">Benchmark focus</div>
                    <div className="metric-value">{benchmarkIndex.shortName || benchmarkIndex.symbol}</div>
                    <div className="metric-footnote">{benchmarkIndex.symbol}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <TrendBadge tone={benchmarkIndex.changePercent >= 0 ? 'positive' : 'negative'}>{formatPercent(benchmarkIndex.changePercent)}</TrendBadge>
                    <TrendBadge tone="primary">{benchmarkIndex.marketState || 'REGULAR'}</TrendBadge>
                  </div>
                </div>

                <div className="tab-group">
                  {headlineIndices.map((index) => (
                    <button key={index.symbol} type="button" onClick={() => setBenchmarkSymbol(index.symbol)} className={`tab ${benchmarkSymbol === index.symbol ? 'tab-active' : ''}`}>
                      {index.shortName || index.symbol}
                    </button>
                  ))}
                </div>

                <div className="tab-group">
                  {[
                    { id: '1mo', label: '1M' },
                    { id: '3mo', label: '3M' },
                    { id: '1y', label: '1Y' },
                    { id: '5y', label: '5Y' },
                  ].map((entry) => (
                    <button key={entry.id} type="button" onClick={() => setBenchmarkPeriod(entry.id as '1mo' | '3mo' | '1y' | '5y')} className={`tab ${benchmarkPeriod === entry.id ? 'tab-active' : ''}`}>
                      {entry.label}
                    </button>
                  ))}
                </div>

                <HistoricalSeriesChart symbol={benchmarkIndex.symbol} period={benchmarkPeriod} variant="line" height={380} />
              </div>
            ) : (
              <EmptyPanel title="Benchmark preview unavailable" description="Load a summary snapshot first to populate the benchmark line board." icon={LineChart} />
            )}
          </SectionCard>
        </div>
      ) : null}

      {activeTab === 'sectors' ? (
        <div className="two-column-layout">
          <SectorBoard sectors={sectors} />
          <SectionCard title="Rotation Snapshot" subtitle="Fast separation between the strongest and weakest sector pockets" icon={Layers}>
            <div className="stack-16">
              <SectorStrip title="Bullish sectors" sectors={bullishSectors} />
              <SectorStrip title="Bearish sectors" sectors={bearishSectors} />
            </div>
          </SectionCard>
        </div>
      ) : null}

      {activeTab === 'movers' ? (
        <div className="grid-fit-320">
          <MoversList title="Top Gainers" subtitle="Highest positive day-change names in the tracked basket" icon={TrendingUp} items={summary.gainers} />
          <MoversList title="Top Losers" subtitle="Weakest day-change names in the tracked basket" icon={TrendingDown} items={summary.losers} />
          <MoversList title="Most Active" subtitle="Highest visible turnover across the tracked basket" icon={Activity} items={summary.mostActive} />
        </div>
      ) : null}

      {activeTab === 'charts' ? (
        <SectionCard title="Chart Workspace" subtitle="Candlestick-heavy multi-benchmark workspace with TradingView on the overview side and the in-app modal handling lower timeframe symbol drill-down" icon={CandlestickChart}>
          <div style={{ height: 480 }}>
            <TVWidget
              src="https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js"
              config={{
                symbols: [
                  ['NIFTY 50', '^NSEI'],
                  ['BANK NIFTY', '^NSEBANK'],
                  ['NIFTY IT', '^CNXIT'],
                  ['NIFTY PHARMA', '^CNXPHARMA'],
                ],
                chartType: 'candlesticks',
                dateRange: '3M',
                colorTheme: 'dark',
                locale: 'en',
                showVolume: true,
                showMA: true,
                hideDateRanges: false,
                hideMarketStatus: false,
                hideSymbolLogo: false,
                scalePosition: 'right',
                scaleMode: 'Normal',
              }}
            />
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}