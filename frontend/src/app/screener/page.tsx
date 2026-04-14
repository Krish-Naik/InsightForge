'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  ArrowUpDown,
  Filter,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import { HistoricalSeriesChart } from '@/components/charts/HistoricalSeriesChart';
import { EmptyPanel, MetricTile, PageHeader, SectionCard, TrendBadge } from '@/components/ui/page-kit';
import { marketAPI, type ScreenerMetric, type SearchResult } from '@/lib/api';
import { formatCurrency, formatNumber, formatPercent } from '@/lib/format';
import { searchCatalogStocks, useMarketCatalog } from '@/lib/hooks/useMarketCatalog';
import { useDebounce } from '@/lib/hooks/useDebounce';

type SortKey =
  | 'symbol'
  | 'currentPrice'
  | 'changePercent'
  | 'momentumScore'
  | 'rsi14'
  | 'volumeRatio'
  | 'peRatio'
  | 'priceToBook'
  | 'revenueGrowth';

type PresetFilter = 'all' | 'momentum' | 'value' | 'quality';

function safeNumber(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY;
}

function applyPresetFilter(rows: ScreenerMetric[], preset: PresetFilter): ScreenerMetric[] {
  if (preset === 'momentum') {
    return rows.filter((row) => (row.momentumScore || 0) >= 25 && (row.volumeRatio || 0) >= 1.2);
  }

  if (preset === 'value') {
    return rows.filter((row) => {
      const pe = row.peRatio;
      const priceToBook = row.priceToBook;
      return pe !== null && pe !== undefined && pe > 0 && pe <= 25 && priceToBook !== null && priceToBook !== undefined && priceToBook <= 4;
    });
  }

  if (preset === 'quality') {
    return rows.filter((row) => {
      const revenueGrowth = row.revenueGrowth;
      const profitMargins = row.profitMargins;
      return revenueGrowth !== null && revenueGrowth !== undefined && revenueGrowth >= 8
        && profitMargins !== null && profitMargins !== undefined && profitMargins >= 8;
    });
  }

  return rows;
}

export default function ScreenerPage() {
  const { catalog } = useMarketCatalog();
  const [rows, setRows] = useState<ScreenerMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sector, setSector] = useState('All');
  const [preset, setPreset] = useState<PresetFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('momentumScore');
  const [sortAsc, setSortAsc] = useState(false);
  const [modeLabel, setModeLabel] = useState('Nifty 50 delayed scan');
  const [previewSymbol, setPreviewSymbol] = useState<string | null>(null);
  const [previewPeriod, setPreviewPeriod] = useState<'1y' | '2y' | '5y' | '10y'>('10y');
  const debouncedSearch = useDebounce(search, 350);

  const sectorOptions = useMemo(() => ['All', ...Object.keys(catalog?.sectors || {})], [catalog]);

  const loadRows = useCallback(async () => {
    if (!catalog) return;

    setLoading(true);
    try {
      let symbols: string[] = [];

      if (debouncedSearch.trim().length >= 2) {
        const localMatches: SearchResult[] = searchCatalogStocks(catalog, debouncedSearch, 12).map((entry) => ({
          symbol: entry.symbol,
          name: entry.name,
          exchange: entry.exchange,
          type: 'EQUITY',
          sectors: entry.sectors,
          inNifty50: entry.inNifty50,
        }));
        const remoteMatches = await marketAPI.searchStocks(debouncedSearch) as SearchResult[];
        const combined = [...remoteMatches, ...localMatches.filter((entry) => !remoteMatches.some((remote) => remote.symbol === entry.symbol))];
        const filtered = sector === 'All'
          ? combined
          : combined.filter((entry) => !entry.sectors?.length || entry.sectors.includes(sector));
        symbols = [...new Set(filtered.map((entry) => entry.symbol))].slice(0, 30);
        setModeLabel('Search-driven market universe');
      } else if (sector !== 'All') {
        symbols = catalog.sectors[sector] || [];
        setModeLabel(`${sector} delayed scan`);
      } else {
        symbols = catalog.nifty50 || [];
        setModeLabel('Nifty 50 delayed scan');
      }

      if (!symbols.length) {
        setRows([]);
        setError(null);
        setLoading(false);
        return;
      }

      const metrics = await marketAPI.getAnalytics(symbols);
      setRows(metrics || []);
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to load screener rows.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [catalog, debouncedSearch, sector]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const filteredRows = useMemo(() => applyPresetFilter(rows, preset), [rows, preset]);

  const sortedRows = useMemo(() => {
    const nextRows = [...filteredRows];
    nextRows.sort((left, right) => {
      if (sortKey === 'symbol') {
        return sortAsc ? left.symbol.localeCompare(right.symbol) : right.symbol.localeCompare(left.symbol);
      }

      const leftValue = safeNumber(left[sortKey] as number | null | undefined);
      const rightValue = safeNumber(right[sortKey] as number | null | undefined);
      return sortAsc ? leftValue - rightValue : rightValue - leftValue;
    });
    return nextRows;
  }, [filteredRows, sortAsc, sortKey]);

  const avgMomentum = useMemo(() => {
    if (!sortedRows.length) return 0;
    return sortedRows.reduce((sum, row) => sum + (row.momentumScore || 0), 0) / sortedRows.length;
  }, [sortedRows]);
  const avgPe = useMemo(() => {
    const usable = sortedRows.filter((row) => row.peRatio !== null && row.peRatio !== undefined);
    if (!usable.length) return null;
    return usable.reduce((sum, row) => sum + (row.peRatio || 0), 0) / usable.length;
  }, [sortedRows]);
  const avgRevenueGrowth = useMemo(() => {
    const usable = sortedRows.filter((row) => row.revenueGrowth !== null && row.revenueGrowth !== undefined);
    if (!usable.length) return null;
    return usable.reduce((sum, row) => sum + (row.revenueGrowth || 0), 0) / usable.length;
  }, [sortedRows]);

  useEffect(() => {
    if (!sortedRows.length) {
      setPreviewSymbol(null);
      return;
    }

    if (!previewSymbol || !sortedRows.some((row) => row.symbol === previewSymbol)) {
      setPreviewSymbol(sortedRows[0].symbol);
    }
  }, [previewSymbol, sortedRows]);

  const previewRow = useMemo(
    () => sortedRows.find((row) => row.symbol === previewSymbol) || sortedRows[0] || null,
    [previewSymbol, sortedRows],
  );

  const onSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc((current) => !current);
      return;
    }

    setSortKey(key);
    setSortAsc(false);
  };

  const SortHeader = ({ column, label }: { column: SortKey; label: string }) => (
    <th onClick={() => onSort(column)} style={{ cursor: 'pointer' }}>
      <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
        {label}
        <ArrowUpDown style={{ width: 11, height: 11, color: sortKey === column ? 'var(--primary)' : 'var(--text-3)' }} />
      </span>
    </th>
  );

  return (
    <div className="page">
      <PageHeader
        kicker="Fundamental Screener"
        title="Momentum plus valuation in one scan"
        description="This screener combines delayed market structure with trailing valuation, revenue growth, profitability, RSI, and participation metrics. Full-market scanning is intentionally narrowed through search, sector focus, and liquid universes to stay within public data limits."
        actions={
          <button onClick={loadRows} disabled={loading} className="btn btn-ghost">
            <RefreshCw style={{ width: 14, height: 14 }} className={loading ? 'anim-spin' : ''} />
            Refresh screener
          </button>
        }
      />

      {error ? <TrendBadge tone="warning">{error}</TrendBadge> : null}

      <div className="two-column-layout">
        <SectionCard title="Filters" subtitle="Scope the scan before fetching delayed analytics" icon={Filter}>
          <div className="stack-16">
            <div style={{ position: 'relative' }}>
              <Search style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--text-3)' }} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search NSE symbols or company names"
                className="input"
                style={{ paddingLeft: 38 }}
              />
            </div>

            <div>
              <div className="stat-label" style={{ marginBottom: 8 }}>Sector</div>
              <div className="tab-group">
                {sectorOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setSector(option)}
                    className={`tab ${sector === option ? 'tab-active' : ''}`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="stat-label" style={{ marginBottom: 8 }}>Preset</div>
              <div className="tab-group">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'momentum', label: 'Momentum' },
                  { id: 'value', label: 'Value' },
                  { id: 'quality', label: 'Quality' },
                ].map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setPreset(option.id as PresetFilter)}
                    className={`tab ${preset === option.id ? 'tab-active' : ''}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="metric-card">
              <div className="stat-label">Current mode</div>
              <div className="metric-value">{modeLabel}</div>
              <div className="metric-footnote">
                Search expands to the broader market universe. Otherwise the screener stays on a limited basket for API safety.
              </div>
            </div>
          </div>
        </SectionCard>

        <div className="stack-16">
          <SectionCard title="Snapshot" subtitle="Fast summary of the visible screener slice" icon={SlidersHorizontal}>
            <div className="grid-fit-180">
              <MetricTile label="Visible rows" value={sortedRows.length} tone="primary" icon={Sparkles} />
              <MetricTile label="Avg momentum" value={formatNumber(avgMomentum)} tone={avgMomentum >= 0 ? 'positive' : 'negative'} icon={Sparkles} />
              <MetricTile label="Avg PE" value={avgPe !== null ? formatNumber(avgPe) : '—'} tone="warning" icon={Filter} />
              <MetricTile label="Avg revenue %" value={avgRevenueGrowth !== null ? formatPercent(avgRevenueGrowth) : '—'} tone="positive" icon={Sparkles} />
            </div>
          </SectionCard>

          <SectionCard title="Long-range line preview" subtitle="The main table stays focused on screening, while this panel gives a multi-year line view before you open the full research page" icon={Sparkles}>
            {previewRow ? (
              <div className="stack-16">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div>
                    <div className="stat-label">Preview symbol</div>
                    <div className="metric-value">{previewRow.symbol}</div>
                    <div className="metric-footnote">{previewRow.name}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <TrendBadge tone={previewRow.changePercent >= 0 ? 'positive' : 'negative'}>{formatPercent(previewRow.changePercent)}</TrendBadge>
                    <TrendBadge tone={previewRow.trend === 'bullish' ? 'positive' : previewRow.trend === 'bearish' ? 'negative' : 'warning'}>{previewRow.trend || 'neutral'}</TrendBadge>
                  </div>
                </div>

                <div className="tab-group">
                  {[
                    { id: '1y', label: '1Y' },
                    { id: '2y', label: '2Y' },
                    { id: '5y', label: '5Y' },
                    { id: '10y', label: '10Y' },
                  ].map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => setPreviewPeriod(entry.id as '1y' | '2y' | '5y' | '10y')}
                      className={`tab ${previewPeriod === entry.id ? 'tab-active' : ''}`}
                    >
                      {entry.label}
                    </button>
                  ))}
                </div>

                <HistoricalSeriesChart symbol={previewRow.symbol} period={previewPeriod} variant="line" height={320} />
              </div>
            ) : (
              <EmptyPanel title="No preview symbol" description="The line preview appears once the screener has at least one matching row." icon={Sparkles} />
            )}
          </SectionCard>
        </div>
      </div>

      <SectionCard title="Screener Table" subtitle="Sortable analytics across price action, momentum, and fundamentals" icon={Filter}>
        {loading ? (
          <div className="stack-12">
            {[...Array(8)].map((_, index) => <div key={index} className="skeleton" style={{ height: 46 }} />)}
          </div>
        ) : sortedRows.length ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <SortHeader column="symbol" label="Symbol" />
                  <SortHeader column="currentPrice" label="Price" />
                  <SortHeader column="changePercent" label="Day %" />
                  <SortHeader column="momentumScore" label="Momentum" />
                  <SortHeader column="rsi14" label="RSI 14" />
                  <SortHeader column="volumeRatio" label="Vol Ratio" />
                  <SortHeader column="peRatio" label="PE" />
                  <SortHeader column="priceToBook" label="P/B" />
                  <SortHeader column="revenueGrowth" label="Revenue %" />
                  <th>Trend</th>
                  <th style={{ textAlign: 'center' }}>Research</th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row) => (
                  <tr key={row.symbol}>
                    <td>
                      <Link
                        href={`/stocks/${encodeURIComponent(row.symbol)}`}
                        onMouseEnter={() => setPreviewSymbol(row.symbol)}
                        onFocus={() => setPreviewSymbol(row.symbol)}
                        style={{ textDecoration: 'none', color: 'inherit' }}
                      >
                        <div className="mono" style={{ fontSize: 12, fontWeight: 700 }}>{row.symbol}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{row.name}</div>
                      </Link>
                    </td>
                    <td><span className="mono">{formatCurrency(row.currentPrice)}</span></td>
                    <td><span className="mono" style={{ color: row.changePercent >= 0 ? 'var(--green)' : 'var(--red)' }}>{formatPercent(row.changePercent)}</span></td>
                    <td><span className="mono">{formatNumber(row.momentumScore)}</span></td>
                    <td><span className="mono">{row.rsi14 !== undefined ? formatNumber(row.rsi14) : '—'}</span></td>
                    <td><span className="mono">{row.volumeRatio !== undefined ? `${formatNumber(row.volumeRatio)}x` : '—'}</span></td>
                    <td><span className="mono">{row.peRatio !== null && row.peRatio !== undefined ? formatNumber(row.peRatio) : '—'}</span></td>
                    <td><span className="mono">{row.priceToBook !== null && row.priceToBook !== undefined ? formatNumber(row.priceToBook) : '—'}</span></td>
                    <td><span className="mono">{row.revenueGrowth !== null && row.revenueGrowth !== undefined ? formatPercent(row.revenueGrowth) : '—'}</span></td>
                    <td>
                      <TrendBadge tone={row.trend === 'bullish' ? 'positive' : row.trend === 'bearish' ? 'negative' : 'warning'}>
                        {row.trend || 'neutral'}
                      </TrendBadge>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <Link href={`/stocks/${encodeURIComponent(row.symbol)}`} className="btn btn-ghost" onMouseEnter={() => setPreviewSymbol(row.symbol)}>
                        Open
                        <ArrowUpRight style={{ width: 13, height: 13 }} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyPanel title="No screener rows" description="Try a broader sector, clear the search term, or switch to a different preset." icon={Filter} />
        )}
      </SectionCard>
    </div>
  );
}