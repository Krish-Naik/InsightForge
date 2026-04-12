'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  BarChart2,
  BarChart3,
  RefreshCw,
  Search,
} from 'lucide-react';
import { SymbolLink } from '@/components/ui/SymbolLink';
import { marketAPI, type ScreenerMetric, type SearchResult } from '@/lib/api';
import { formatCurrency, formatLargeNumber, formatNumber, formatPercent } from '@/lib/format';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { useMarketCatalog } from '@/lib/hooks/useMarketCatalog';

type SortKey = 'symbol' | 'currentPrice' | 'changePercent' | 'turnover' | 'volume' | 'dayRangePercent' | 'week52RangePosition' | 'momentumScore';

const PAGE_SIZE = 20;

export default function ScreenerPage() {
  const [data, setData] = useState<ScreenerMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sector, setSector] = useState('All');
  const [sortKey, setSortKey] = useState<SortKey>('turnover');
  const [sortAsc, setSortAsc] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [resultCount, setResultCount] = useState(0);
  const [modeLabel, setModeLabel] = useState('Fast liquid-market snapshot');
  const { catalog, loading: catalogLoading, error: catalogError } = useMarketCatalog();
  const debouncedSearch = useDebounce(search, 350);

  const sectorOptions = useMemo(() => ['All', ...Object.keys(catalog?.sectors || {})], [catalog]);
  const searchMode = debouncedSearch.trim().length >= 2;

  const loadData = useCallback(async () => {
    if (!catalog?.nifty50?.length) return;
    setLoading(true);
    setError(null);

    try {
      let symbols: string[] = [];

      if (searchMode) {
        const matches = await marketAPI.searchStocks(debouncedSearch) as SearchResult[];
        const filteredMatches = sector === 'All'
          ? matches
          : matches.filter((match) => !match.sectors?.length || match.sectors.includes(sector));
        symbols = filteredMatches.slice(0, PAGE_SIZE).map((match) => match.symbol);
        setResultCount(filteredMatches.length);
        setModeLabel('Official Upstox NSE/BSE universe');
      } else {
        const sectorSymbols = sector === 'All'
          ? catalog.nifty50
          : (catalog.sectors[sector] || []).filter((symbol) => catalog.nifty50.includes(symbol));
        const offset = (page - 1) * PAGE_SIZE;
        symbols = sectorSymbols.slice(offset, offset + PAGE_SIZE);
        setResultCount(sectorSymbols.length);
        setModeLabel('Fast liquid-market snapshot');
      }

      if (!symbols.length) {
        setData([]);
        setLoading(false);
        return;
      }

      const metrics = await marketAPI.getAnalytics(symbols) as ScreenerMetric[];
      setData(metrics || []);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to load screener data.');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [catalog, debouncedSearch, page, searchMode, sector]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, sector]);

  useEffect(() => {
    if (!catalog) return;
    loadData();
  }, [catalog, loadData]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const sorted = [...data].sort((left, right) => {
    const a = left[sortKey] as string | number;
    const b = right[sortKey] as string | number;
    if (typeof a === 'string' && typeof b === 'string') {
      return sortAsc ? a.localeCompare(b) : b.localeCompare(a);
    }
    return sortAsc ? Number(a) - Number(b) : Number(b) - Number(a);
  });

  const pageCount = resultCount ? Math.max(1, Math.ceil(resultCount / PAGE_SIZE)) : 1;

  const summaryStats = useMemo(() => {
    const totalTurnover = sorted.reduce((sum, row) => sum + (row.turnover || 0), 0);
    const avgDayMove = sorted.length
      ? sorted.reduce((sum, row) => sum + (row.changePercent || 0), 0) / sorted.length
      : 0;
    const avgMomentum = sorted.length
      ? sorted.reduce((sum, row) => sum + (row.momentumScore || 0), 0) / sorted.length
      : 0;

    return {
      totalTurnover,
      avgDayMove,
      avgMomentum,
    };
  }, [sorted]);

  const SortableHeader = ({ column, label, right }: { column: SortKey; label: string; right?: boolean }) => (
    <th style={{ textAlign: right ? 'right' : 'left', cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => handleSort(column)}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {label}
        <ArrowUpDown style={{ width: 9, height: 9, opacity: sortKey === column ? 1 : 0.35, color: sortKey === column ? 'var(--primary)' : 'inherit' }} />
      </span>
    </th>
  );

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-1)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <BarChart3 style={{ width: 18, height: 18, color: 'var(--primary)' }} /> Market Screener
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text-2)' }}>Quote-driven analytics from official Upstox market data. Default view stays on the liquid core set for speed.</p>
        </div>
        <button onClick={loadData} disabled={loading} className="btn btn-ghost" style={{ padding: '5px 8px' }}>
          <RefreshCw style={{ width: 13, height: 13 }} className={loading ? 'anim-spin' : ''} />
        </button>
      </div>

      {catalogError && <div className="badge badge-red" style={{ fontSize: 11, padding: '6px 12px' }}>{catalogError}</div>}
      {error && <div className="badge badge-red" style={{ fontSize: 11, padding: '6px 12px' }}>{error}</div>}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <div style={{ position: 'relative', minWidth: 240 }}>
          <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: 'var(--text-3)' }} />
          <input
            type="text"
            placeholder="Search the Upstox stock universe…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="input"
            style={{ paddingLeft: 30, fontSize: 12 }}
          />
        </div>
        <div className="tab-group">
          {sectorOptions.map((option) => (
            <button key={option} onClick={() => setSector(option)} className={`tab ${sector === option ? 'tab-active' : ''}`}>{option}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <span className="badge badge-muted">{modeLabel}</span>
        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{resultCount} matching symbols</span>
      </div>

      {!loading && sorted.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
          {[
            { label: 'Loaded', value: `${sorted.length}`, color: 'var(--text-1)' },
            { label: 'Avg Day Move', value: formatPercent(summaryStats.avgDayMove), color: summaryStats.avgDayMove >= 0 ? 'var(--green)' : 'var(--red)' },
            { label: 'Avg Momentum', value: formatNumber(summaryStats.avgMomentum), color: summaryStats.avgMomentum >= 0 ? 'var(--amber)' : 'var(--text-2)' },
            { label: 'Visible Turnover', value: formatLargeNumber(summaryStats.totalTurnover), color: 'var(--sky)' },
          ].map(({ label, value, color }) => (
            <div key={label} className="card" style={{ padding: '12px 14px' }}>
              <div className="stat-label" style={{ marginBottom: 4 }}>{label}</div>
              <div className="mono" style={{ fontSize: 18, fontWeight: 700, color }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <SortableHeader column="symbol" label="Symbol" />
                <SortableHeader column="currentPrice" label="Price" right />
                <SortableHeader column="changePercent" label="Day %" right />
                <SortableHeader column="turnover" label="Turnover" right />
                <SortableHeader column="volume" label="Volume" right />
                <SortableHeader column="dayRangePercent" label="Day Range" right />
                <SortableHeader column="week52RangePosition" label="52W Pos" right />
                <SortableHeader column="momentumScore" label="Momentum" right />
                <th>Sector</th>
                <th style={{ textAlign: 'center' }}>Chart</th>
              </tr>
            </thead>
            <tbody>
              {(loading || catalogLoading)
                ? [...Array(10)].map((_, rowIndex) => (
                  <tr key={rowIndex}>
                    {[...Array(10)].map((_, cellIndex) => <td key={cellIndex}><div className="skeleton h-4 rounded" style={{ width: cellIndex === 0 ? 80 : 50 }} /></td>)}
                  </tr>
                ))
                : sorted.map((row) => {
                  const up = row.changePercent >= 0;
                  const momentumColor = row.momentumScore >= 20 ? 'var(--green)' : row.momentumScore <= -20 ? 'var(--red)' : 'var(--text-2)';
                  return (
                    <tr key={row.symbol}>
                      <td>
                        <SymbolLink symbol={row.symbol} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 } as any}>
                          <div className="mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)' }}>{row.symbol}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-2)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name}</div>
                        </SymbolLink>
                      </td>
                      <td style={{ textAlign: 'right' }}><span className="mono" style={{ fontSize: 12, color: 'var(--text-1)' }}>{row.currentPrice > 0 ? formatCurrency(row.currentPrice) : '—'}</span></td>
                      <td style={{ textAlign: 'right' }}><span className="mono" style={{ fontSize: 12, color: up ? 'var(--green)' : 'var(--red)' }}>{formatPercent(row.changePercent)}</span></td>
                      <td style={{ textAlign: 'right' }}><span className="mono" style={{ fontSize: 11, color: 'var(--text-2)' }}>{row.turnover > 0 ? formatLargeNumber(row.turnover) : '—'}</span></td>
                      <td style={{ textAlign: 'right' }}><span className="mono" style={{ fontSize: 11, color: 'var(--text-2)' }}>{row.volume > 0 ? formatLargeNumber(row.volume) : '—'}</span></td>
                      <td style={{ textAlign: 'right' }}><span className="mono" style={{ fontSize: 11, color: row.dayRangePercent > 3 ? 'var(--amber)' : 'var(--text-2)' }}>{row.dayRangePercent > 0 ? formatPercent(row.dayRangePercent) : '—'}</span></td>
                      <td style={{ textAlign: 'right' }}><span className="mono" style={{ fontSize: 11, color: row.week52RangePosition >= 70 ? 'var(--green)' : row.week52RangePosition <= 30 ? 'var(--red)' : 'var(--text-2)' }}>{row.week52RangePosition > 0 ? `${formatNumber(row.week52RangePosition)}%` : '—'}</span></td>
                      <td style={{ textAlign: 'right' }}><span className="mono" style={{ fontSize: 12, color: momentumColor }}>{formatNumber(row.momentumScore)}</span></td>
                      <td>{row.sector && row.sector !== 'Unknown' ? <span className="badge badge-muted">{row.sector}</span> : <span style={{ color: 'var(--text-3)', fontSize: 11 }}>—</span>}</td>
                      <td style={{ textAlign: 'center' }}>
                        <SymbolLink symbol={row.symbol}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 5, background: 'var(--primary-dim)', color: 'var(--primary)', cursor: 'pointer' }}>
                            <BarChart2 style={{ width: 11, height: 11 }} />
                          </span>
                        </SymbolLink>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
        {!loading && !catalogLoading && !sorted.length && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
            {searchMode ? 'No stocks matched that search.' : 'No stocks matched the current filter.'}
          </div>
        )}
      </div>

      {!loading && sorted.length > 0 && (
        <div style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'right' }}>
          Metrics are derived from official Upstox quote fields for fast, fair-use screening.
        </div>
      )}

      {!searchMode && pageCount > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1 || loading} className="btn btn-ghost">
            <ArrowLeft style={{ width: 13, height: 13 }} /> Prev
          </button>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Page {page} of {pageCount}</span>
          <button onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={page === pageCount || loading} className="btn btn-ghost">
            Next <ArrowRight style={{ width: 13, height: 13 }} />
          </button>
        </div>
      )}
    </div>
  );
}
