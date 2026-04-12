'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Clock,
  Flame,
  Globe,
  Layers,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { Sparkline } from '@/components/charts/Sparkline';
import { SymbolLink } from '@/components/ui/SymbolLink';
import { marketAPI, type Index, type Quote } from '@/lib/api';
import { formatCurrency, formatIST, formatLargeNumber, formatPercent } from '@/lib/format';
import { useMarketStream } from '@/lib/hooks/useMarketStream';

type SectorStock = {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap?: number;
};

type SectorSnapshot = {
  name: string;
  trend: string;
  change: number;
  advancers: number;
  decliners: number;
  unchanged: number;
  stocks: SectorStock[];
};

type MarketSummaryData = {
  indices: Index[];
  gainers: Quote[];
  losers: Quote[];
  mostActive: Quote[];
};

const SECTOR_INDEX_MAP: Record<string, string> = {
  Banking: 'NIFTY BANK',
  IT: 'NIFTY IT',
  Auto: 'NIFTY AUTO',
  Metals: 'NIFTY METAL',
  Pharma: 'NIFTY PHARMA',
  Energy: 'NIFTY ENERGY',
  FMCG: 'NIFTY FMCG',
  Realty: 'NIFTY REALTY',
  Telecom: 'NIFTY 50',
  Infra: 'NIFTY INFRA',
  NBFC: 'NIFTY BANK',
};

const EMPTY_SUMMARY: MarketSummaryData = {
  indices: [],
  gainers: [],
  losers: [],
  mostActive: [],
};

function normalizeSectorData(payload: any[]): SectorSnapshot[] {
  return (payload || []).map((sector) => ({
    name: sector.name,
    trend: sector.trend || 'neutral',
    change: Number(sector.change || 0),
    advancers: Number(sector.advancers || 0),
    decliners: Number(sector.decliners || 0),
    unchanged: Number(sector.unchanged || 0),
    stocks: (sector.stocks || []).map((stock: any) => ({
      symbol: stock.symbol,
      name: stock.name || stock.symbol,
      price: Number(stock.price || 0),
      change: Number(stock.change || 0),
      changePercent: Number(stock.changePercent ?? stock.change ?? 0),
      volume: Number(stock.volume || 0),
      marketCap: Number(stock.marketCap || 0),
    })),
  }));
}

function StatusBar({
  loading,
  lastUpdated,
  error,
  connected,
  streamError,
  onRefresh,
}: {
  loading: boolean;
  lastUpdated: Date | null;
  error: string | null;
  connected: boolean;
  streamError: string | null;
  onRefresh: () => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {error && <span className="badge badge-red">{error}</span>}
        {!error && streamError && <span className="badge badge-amber">Live stream degraded</span>}
        {!error && !loading && <span className="badge badge-green">Native charts active</span>}
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: connected ? 'var(--green)' : 'var(--text-3)' }}>
          {connected ? <Wifi style={{ width: 11, height: 11 }} /> : <WifiOff style={{ width: 11, height: 11 }} />}
          {connected ? 'Live stream' : 'Polling'}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {lastUpdated && (
          <span style={{ fontSize: 10, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock style={{ width: 10, height: 10 }} /> {formatIST(lastUpdated)}
          </span>
        )}
        <button onClick={onRefresh} disabled={loading} className="btn btn-ghost" style={{ padding: '4px 8px' }}>
          <RefreshCw style={{ width: 13, height: 13 }} className={loading ? 'anim-spin' : ''} />
        </button>
      </div>
    </div>
  );
}

function NativeChartCard({
  symbol,
  title,
  subtitle,
  price,
  changePercent,
  volumeLabel,
  period = '1mo',
}: {
  symbol: string;
  title: string;
  subtitle: string;
  price: number;
  changePercent: number;
  volumeLabel?: string;
  period?: string;
}) {
  const up = changePercent >= 0;

  return (
    <SymbolLink
      symbol={symbol}
      className="card"
      style={{
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        textAlign: 'left',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))',
        border: `1px solid ${up ? 'rgba(34,197,94,0.16)' : 'rgba(239,68,68,0.16)'}`,
      } as any}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {title}
          </div>
          <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-1)', marginTop: 4 }}>
            {price > 0 ? formatCurrency(price) : '—'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 4 }}>{subtitle}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="mono" style={{ fontSize: 12, fontWeight: 700, color: up ? 'var(--green)' : 'var(--red)', display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'flex-end' }}>
            {up ? <ArrowUpRight style={{ width: 12, height: 12 }} /> : <ArrowDownRight style={{ width: 12, height: 12 }} />}
            {formatPercent(changePercent)}
          </div>
          {volumeLabel && <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 4 }}>{volumeLabel}</div>}
        </div>
      </div>
      <div style={{ height: 82 }}>
        <Sparkline symbol={symbol} period={period} height={82} width={220} />
      </div>
      <div style={{ fontSize: 10, color: 'var(--primary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Open in-app chart
      </div>
    </SymbolLink>
  );
}

function MoversTable({ data, loading }: { data: Quote[]; loading: boolean }) {
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {[...Array(5)].map((_, index) => <div key={index} className="skeleton h-9 rounded" />)}
      </div>
    );
  }

  if (!data.length) {
    return <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 12, color: 'var(--text-3)' }}>No data available</div>;
  }

  return (
    <div>
      {data.map((stock, index) => {
        const up = stock.changePercent >= 0;
        return (
          <div key={stock.symbol} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 4px', borderBottom: '1px solid rgba(30,42,64,0.5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <span style={{ fontSize: 10, color: 'var(--text-3)', width: 16, flexShrink: 0 }} className="mono">{index + 1}</span>
              <SymbolLink symbol={stock.symbol} className="text-left" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 } as any}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)' }}>{stock.symbol}</div>
                <div style={{ fontSize: 10, color: 'var(--text-2)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stock.name}</div>
              </SymbolLink>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
              <span className="mono" style={{ fontSize: 12, color: 'var(--text-1)' }}>{formatCurrency(stock.price)}</span>
              <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: up ? 'var(--green)' : 'var(--red)' }}>
                {formatPercent(stock.changePercent)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function OverviewSection({
  summary,
  loading,
}: {
  summary: MarketSummaryData;
  loading: boolean;
}) {
  const mainIndices = summary.indices.slice(0, 3);
  const sectorIndices = summary.indices.slice(3);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>In-App Index Charts</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
          {(loading ? [...Array(3)] : mainIndices).map((entry: Index | undefined, index) => (
            entry ? (
              <NativeChartCard
                key={entry.rawSymbol || entry.symbol}
                symbol={entry.symbol}
                title={entry.symbol}
                subtitle={entry.shortName || entry.symbol}
                price={entry.price}
                changePercent={entry.changePercent}
                volumeLabel={entry.volume > 0 ? `Vol ${formatLargeNumber(entry.volume)}` : undefined}
              />
            ) : (
              <div key={index} className="card" style={{ padding: 16 }}>
                <div className="skeleton h-4 w-24 rounded" />
                <div className="skeleton h-7 w-28 rounded" style={{ marginTop: 8 }} />
                <div className="skeleton h-20 w-full rounded" style={{ marginTop: 12 }} />
              </div>
            )
          ))}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Sector Indices</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
          {sectorIndices.map((index) => (
            <NativeChartCard
              key={index.rawSymbol || index.symbol}
              symbol={index.symbol}
              title={index.shortName || index.symbol}
              subtitle={index.symbol}
              price={index.price}
              changePercent={index.changePercent}
              volumeLabel={index.volume > 0 ? `Vol ${formatLargeNumber(index.volume)}` : undefined}
            />
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
        {[
          { title: 'Top Gainers', data: summary.gainers, icon: TrendingUp, color: 'var(--green)' },
          { title: 'Top Losers', data: summary.losers, icon: TrendingDown, color: 'var(--red)' },
          { title: 'Most Active', data: summary.mostActive, icon: Activity, color: 'var(--amber)' },
        ].map(({ title, data, icon: Icon, color }) => (
          <div key={title} className="card">
            <div className="card-header">
              <Icon style={{ width: 14, height: 14, color }} />
              <h3>{title}</h3>
            </div>
            <div style={{ padding: '8px 12px' }}>
              <MoversTable data={data} loading={loading} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectorsSection({ sectors, loading }: { sectors: SectorSnapshot[]; loading: boolean }) {
  if (loading) {
    return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>{[...Array(6)].map((_, index) => <div key={index} className="card skeleton" style={{ height: 220 }} />)}</div>;
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
      {sectors.map((sector) => {
        const proxySymbol = SECTOR_INDEX_MAP[sector.name] || sector.stocks[0]?.symbol || 'NIFTY 50';
        const leaders = [...sector.stocks]
          .filter((stock) => stock.price > 0)
          .sort((left, right) => Math.abs(right.changePercent) - Math.abs(left.changePercent))
          .slice(0, 4);
        const up = sector.change >= 0;

        return (
          <div key={sector.name} className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-1)' }}>{sector.name}</div>
                <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: up ? 'var(--green)' : 'var(--red)', marginTop: 4 }}>
                  {formatPercent(sector.change)}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 4 }}>
                  ▲ {sector.advancers} • ▼ {sector.decliners} • = {sector.unchanged}
                </div>
              </div>
              <div style={{ width: 120, height: 74 }}>
                <Sparkline symbol={proxySymbol} period="1mo" width={120} height={74} />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {leaders.length ? leaders.map((stock) => {
                const stockUp = stock.changePercent >= 0;
                return (
                  <div key={stock.symbol} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <SymbolLink symbol={stock.symbol} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' } as any}>
                      <div className="mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)' }}>{stock.symbol}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-2)' }}>{stock.name}</div>
                    </SymbolLink>
                    <div style={{ textAlign: 'right' }}>
                      <div className="mono" style={{ fontSize: 11, color: 'var(--text-1)' }}>{formatCurrency(stock.price)}</div>
                      <div className="mono" style={{ fontSize: 11, fontWeight: 700, color: stockUp ? 'var(--green)' : 'var(--red)' }}>{formatPercent(stock.changePercent)}</div>
                    </div>
                  </div>
                );
              }) : <div style={{ fontSize: 12, color: 'var(--text-3)' }}>No sector constituents available.</div>}
            </div>
            <SymbolLink symbol={proxySymbol} className="btn btn-ghost" style={{ justifyContent: 'center' } as any}>
              Open sector chart
            </SymbolLink>
          </div>
        );
      })}
    </div>
  );
}

function HeatmapSection({ sectors }: { sectors: SectorSnapshot[] }) {
  const tiles = useMemo(
    () => sectors
      .flatMap((sector) => sector.stocks.map((stock) => ({ ...stock, sector: sector.name })))
      .filter((stock) => stock.price > 0)
      .sort((left, right) => Math.abs(right.changePercent) - Math.abs(left.changePercent))
      .slice(0, 36),
    [sectors],
  );

  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="card-header">
        <Flame style={{ width: 14, height: 14, color: 'var(--amber)' }} />
        <h3>Native Heatmap</h3>
      </div>
      {tiles.length ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8 }}>
          {tiles.map((stock) => {
            const intensity = Math.min(Math.abs(stock.changePercent) / 5, 1);
            const background = stock.changePercent >= 0
              ? `rgba(34,197,94,${0.12 + intensity * 0.25})`
              : `rgba(239,68,68,${0.12 + intensity * 0.25})`;

            return (
              <SymbolLink
                key={stock.symbol}
                symbol={stock.symbol}
                className="card"
                style={{
                  padding: 12,
                  textAlign: 'left',
                  background,
                  border: '1px solid rgba(255,255,255,0.06)',
                  minHeight: 92,
                } as any}
              >
                <div className="mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)' }}>{stock.symbol}</div>
                <div style={{ fontSize: 10, color: 'var(--text-2)', marginTop: 4 }}>{stock.sector}</div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--text-1)', marginTop: 10 }}>{formatCurrency(stock.price)}</div>
                <div className="mono" style={{ fontSize: 11, fontWeight: 700, color: stock.changePercent >= 0 ? 'var(--green)' : 'var(--red)', marginTop: 4 }}>
                  {formatPercent(stock.changePercent)}
                </div>
              </SymbolLink>
            );
          })}
        </div>
      ) : (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>Heatmap data will appear once live sector quotes arrive.</div>
      )}
    </div>
  );
}

function HotlistsSection({ summary, sectors }: { summary: MarketSummaryData; sectors: SectorSnapshot[] }) {
  const sectorLeaders = useMemo(
    () => sectors
      .filter((sector) => sector.stocks.some((stock) => stock.price > 0))
      .sort((left, right) => right.change - left.change)
      .slice(0, 6),
    [sectors],
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
      <div className="card">
        <div className="card-header">
          <TrendingUp style={{ width: 14, height: 14, color: 'var(--green)' }} />
          <h3>Momentum Board</h3>
        </div>
        <div style={{ padding: '8px 12px' }}>
          <MoversTable data={[...summary.gainers.slice(0, 3), ...summary.mostActive.slice(0, 2)]} loading={false} />
        </div>
      </div>
      <div className="card" style={{ padding: 16 }}>
        <div className="card-header">
          <Layers style={{ width: 14, height: 14, color: 'var(--sky)' }} />
          <h3>Leading Sectors</h3>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sectorLeaders.map((sector) => (
            <SymbolLink key={sector.name} symbol={SECTOR_INDEX_MAP[sector.name] || sector.stocks[0]?.symbol || 'NIFTY 50'} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 10, padding: 12, textAlign: 'left' } as any}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)' }}>{sector.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 4 }}>{sector.stocks.length} tracked stocks</div>
                </div>
                <div className="mono" style={{ fontSize: 12, fontWeight: 700, color: sector.change >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {formatPercent(sector.change)}
                </div>
              </div>
            </SymbolLink>
          ))}
        </div>
      </div>
    </div>
  );
}

const SECTIONS = [
  { id: 'overview', label: 'Overview', icon: Globe },
  { id: 'sectors', label: 'Sectors', icon: Layers },
  { id: 'heatmap', label: 'Heatmap', icon: Flame },
  { id: 'hotlists', label: 'Hotlists', icon: BarChart3 },
];

export default function MarketPage() {
  const [active, setActive] = useState('overview');
  const [summary, setSummary] = useState<MarketSummaryData>(EMPTY_SUMMARY);
  const [sectors, setSectors] = useState<SectorSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [sectorLoading, setSectorLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const { data: stream, connected, error: streamError } = useMarketStream(true);

  const fetchData = useCallback(async () => {
    setLoading(summary.indices.length === 0);
    setSectorLoading(sectors.length === 0);
    try {
      const [summaryResult, sectorResult] = await Promise.allSettled([
        marketAPI.getMarketSummary(),
        marketAPI.getAllSectorsData(),
      ]);

      if (summaryResult.status === 'fulfilled') {
        setSummary(summaryResult.value || EMPTY_SUMMARY);
      }

      if (sectorResult.status === 'fulfilled') {
        setSectors(normalizeSectorData(sectorResult.value));
      }

      if (summaryResult.status === 'rejected' && sectorResult.status === 'rejected') {
        throw new Error('Market data is temporarily unavailable.');
      }

      setError(null);
      setLastUpdated(new Date());
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to load market data.');
    } finally {
      setLoading(false);
      setSectorLoading(false);
    }
  }, [summary.indices.length, sectors.length]);

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, 30000);
    return () => clearInterval(timer);
  }, [fetchData]);

  useEffect(() => {
    if (!stream) return;

    if ((stream.type === 'market_update' || stream.type === 'indices_tick') && stream.indices?.some((index: Index) => index.price > 0)) {
      setSummary((previous) => ({
        indices: stream.indices || previous.indices,
        gainers: stream.gainers?.length ? stream.gainers : previous.gainers,
        losers: stream.losers?.length ? stream.losers : previous.losers,
        mostActive: stream.mostActive?.length ? stream.mostActive : previous.mostActive,
      }));
      setLastUpdated(new Date());
    }
  }, [stream]);

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-1)', marginBottom: 2 }}>Market Overview</h1>
          <p style={{ fontSize: 12, color: 'var(--text-2)' }}>Fast native market views with in-app charts for NSE & BSE</p>
        </div>
        <div className="tab-group">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActive(id)} className={`tab ${active === id ? 'tab-active' : ''}`}>
              <Icon style={{ width: 13, height: 13 }} /> {label}
            </button>
          ))}
        </div>
      </div>

      <StatusBar
        loading={loading || sectorLoading}
        lastUpdated={lastUpdated}
        error={error}
        connected={connected}
        streamError={streamError}
        onRefresh={fetchData}
      />

      {active === 'overview' && <OverviewSection summary={summary} loading={loading} />}
      {active === 'sectors' && <SectorsSection sectors={sectors} loading={sectorLoading} />}
      {active === 'heatmap' && <HeatmapSection sectors={sectors} />}
      {active === 'hotlists' && <HotlistsSection summary={summary} sectors={sectors} />}
    </div>
  );
}
