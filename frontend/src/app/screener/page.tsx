'use client';

/**
 * SCREENER PAGE — Custom Stock Filtering
 * ────────────────────────────────────────
 * Users filter stocks by: technical, fundamental, valuation,
 * growth, and dividend criteria.
 *
 * DOES NOT contain: signals, alerts, breakout detection,
 *                   or any AI/intraday trading content.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown, ArrowUp, Check, Download, Filter,
  RefreshCw, Save, Search, Trash2, X,
} from 'lucide-react';
import { marketAPI, type SectorOverview } from '@/lib/api';
import { formatCurrency, formatLargeNumber, formatPercent } from '@/lib/format';

// ── Types ─────────────────────────────────────────────────────────────────────
interface FilterCondition {
  id: string;
  category: string;
  metric: string;
  operator: string;
  value: string;
  enabled: boolean;
}

interface SavedScreener {
  id: string;
  name: string;
  filters: FilterCondition[];
  createdAt: string;
}

// ── Filter catalogue ──────────────────────────────────────────────────────────
const FILTER_CATEGORIES = {
  Technical: [
    { value: 'price',            label: 'Price (₹)' },
    { value: 'changePercent',    label: '% Change (Today)' },
    { value: 'rsi14',            label: 'RSI (14)' },
    { value: 'sma20',            label: 'SMA 20' },
    { value: 'sma50',            label: 'SMA 50' },
    { value: 'volumeRatio',      label: 'Volume Ratio (×avg)' },
    { value: 'momentumScore',    label: 'Momentum Score' },
    { value: 'week52RangePosition', label: '52w Position (%)' },
    { value: 'distanceFromHigh52',  label: 'Distance from 52w High (%)' },
  ],
  Fundamental: [
    { value: 'peRatio',          label: 'P/E Ratio' },
    { value: 'forwardPe',        label: 'Forward P/E' },
    { value: 'priceToBook',      label: 'Price/Book (P/B)' },
    { value: 'profitMargins',    label: 'Profit Margin (%)' },
    { value: 'revenueGrowth',    label: 'Revenue Growth (%)' },
  ],
  Valuation: [
    { value: 'dividendYield',    label: 'Dividend Yield (%)' },
    { value: 'beta',             label: 'Beta' },
    { value: 'marketCap',        label: 'Market Cap' },
  ],
  Volume: [
    { value: 'volume',           label: 'Volume' },
    { value: 'turnover',         label: 'Turnover' },
    { value: 'liquidityScore',   label: 'Liquidity Score' },
  ],
} as const;

const ALL_METRICS = Object.entries(FILTER_CATEGORIES).flatMap(([cat, metrics]) =>
  metrics.map(m => ({ ...m, category: cat }))
);

const OPERATORS = [
  { value: '>',  label: '>' },
  { value: '<',  label: '<' },
  { value: '>=', label: '≥' },
  { value: '<=', label: '≤' },
  { value: '=',  label: '=' },
];

const PRESET_SCREENERS = [
  {
    name: 'Value Picks',
    filters: [
      { metric: 'peRatio',    operator: '<',  value: '15', category: 'Fundamental' },
      { metric: 'priceToBook',operator: '<',  value: '2',  category: 'Fundamental' },
      { metric: 'dividendYield',operator:'>', value: '2',  category: 'Valuation' },
    ],
  },
  {
    name: 'Growth Leaders',
    filters: [
      { metric: 'revenueGrowth', operator: '>', value: '15', category: 'Fundamental' },
      { metric: 'profitMargins', operator: '>', value: '10', category: 'Fundamental' },
      { metric: 'momentumScore', operator: '>', value: '40', category: 'Technical' },
    ],
  },
  {
    name: 'Oversold RSI',
    filters: [
      { metric: 'rsi14',        operator: '<', value: '35', category: 'Technical' },
      { metric: 'price',        operator: '>', value: '50', category: 'Technical' },
      { metric: 'volumeRatio',  operator: '>', value: '1.2', category: 'Technical' },
    ],
  },
  {
    name: 'High Momentum',
    filters: [
      { metric: 'momentumScore', operator: '>', value: '55', category: 'Technical' },
      { metric: 'volumeRatio',   operator: '>', value: '1.5', category: 'Technical' },
      { metric: 'changePercent', operator: '>', value: '1',   category: 'Technical' },
    ],
  },
  {
    name: 'High Dividend',
    filters: [
      { metric: 'dividendYield', operator: '>', value: '3', category: 'Valuation' },
      { metric: 'profitMargins', operator: '>', value: '8', category: 'Fundamental' },
    ],
  },
] as const;

// ── Sorted result type ────────────────────────────────────────────────────────
type SortField = 'symbol' | 'price' | 'changePercent' | 'volume' | 'rsi14' | 'peRatio' |
                 'momentumScore' | 'dividendYield' | 'priceToBook';
type SortDir   = 'asc' | 'desc';

// ── LS helpers ────────────────────────────────────────────────────────────────
const LS_KEY = 'insightforge:screeners';

function loadSavedScreeners(): SavedScreener[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); }
  catch { return []; }
}

function persistScreeners(screeners: SavedScreener[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(screeners)); }
  catch { /* ignore */ }
}

// ── CSV export ────────────────────────────────────────────────────────────────
function exportCsv(rows: any[]) {
  if (!rows.length) return;
  const headers = ['symbol','name','price','changePercent','volume','rsi14','peRatio','priceToBook','dividendYield','momentumScore','sector'];
  const csv     = [headers.join(','), ...rows.map(r =>
    headers.map(h => {
      const v = r[h] ?? '';
      return typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` : v;
    }).join(',')
  )].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: 'screener-results.csv' });
  a.click();
  URL.revokeObjectURL(url);
}

// ── Sub-components ────────────────────────────────────────────────────────────
function FilterRow({ filter, onChange, onRemove }: {
  filter: FilterCondition;
  onChange: (id: string, updates: Partial<FilterCondition>) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '8px 0', borderBottom: '1px solid var(--border-light)' }}>
      <button
        onClick={() => onChange(filter.id, { enabled: !filter.enabled })}
        style={{ background: filter.enabled ? 'var(--accent)' : 'var(--bg-2)', border: `1px solid ${filter.enabled ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 6, width: 22, height: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0 }}
      >
        {filter.enabled && <Check style={{ width: 12, height: 12, color: '#fff' }} />}
      </button>

      <select
        value={filter.metric}
        onChange={e => onChange(filter.id, { metric: e.target.value, category: ALL_METRICS.find(m => m.value === e.target.value)?.category || '' })}
        className="input"
        style={{ width: 180, padding: '7px 10px', fontSize: 12 }}
      >
        {Object.entries(FILTER_CATEGORIES).map(([cat, metrics]) => (
          <optgroup key={cat} label={cat}>
            {metrics.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </optgroup>
        ))}
      </select>

      <select
        value={filter.operator}
        onChange={e => onChange(filter.id, { operator: e.target.value })}
        className="input"
        style={{ width: 70, padding: '7px 8px', fontSize: 12 }}
      >
        {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>

      <input
        type="number"
        value={filter.value}
        onChange={e => onChange(filter.id, { value: e.target.value })}
        placeholder="Value"
        className="input"
        style={{ width: 90, padding: '7px 10px', fontSize: 12 }}
      />

      <span style={{ fontSize: 10, color: 'var(--text-3)', minWidth: 80 }}>{filter.category}</span>

      <button onClick={() => onRemove(filter.id)} className="btn btn-ghost" style={{ padding: 6, marginLeft: 'auto' }}>
        <X style={{ width: 13, height: 13 }} />
      </button>
    </div>
  );
}

function StockSearch({ onAdd }: { onAdd: (symbol: string) => void }) {
  const [q,       setQ]       = useState('');
  const [results, setResults] = useState<{ symbol: string; name: string; exchange: string }[]>([]);
  const [open,    setOpen]    = useState(false);
  const timer = useRef<NodeJS.Timeout | undefined>(undefined);

  useEffect(() => {
    clearTimeout(timer.current);
    if (q.length < 2) { setResults([]); return; }
    timer.current = setTimeout(async () => {
      try { setResults((await marketAPI.searchStocks(q)).slice(0, 8)); setOpen(true); }
      catch { /* ignore */ }
    }, 280);
    return () => clearTimeout(timer.current);
  }, [q]);

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: 'var(--text-3)' }} />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 180)}
          placeholder="Search stock to add (e.g. RELIANCE, HDFC…)"
          className="input"
          style={{ paddingLeft: 38 }}
        />
      </div>
      {open && results.length > 0 && (
        <div className="panel" style={{ position: 'absolute', top: '105%', left: 0, right: 0, zIndex: 200, maxHeight: 280, overflow: 'auto', marginTop: 4 }}>
          {results.map(r => (
            <button
              key={r.symbol}
              onClick={() => { onAdd(r.symbol); setQ(''); setOpen(false); }}
              className="list-card"
              style={{ display: 'flex', justifyContent: 'space-between', width: '100%', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer' }}
            >
              <div>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13 }}>{r.symbol}</span>
                <span style={{ marginLeft: 10, color: 'var(--text-2)', fontSize: 12 }}>{r.name}</span>
              </div>
              <span className="badge badge-muted">{r.exchange}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ScreenerPage() {
  const [filters,       setFilters]       = useState<FilterCondition[]>([]);
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([]);
  const [results,       setResults]       = useState<any[]>([]);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [savedScreeners, setSavedScreeners] = useState<SavedScreener[]>(() => loadSavedScreeners());
  const [screenerName,  setScreenerName]  = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [sectors,       setSectors]       = useState<SectorOverview[]>([]);
  const [sectorFilter,  setSectorFilter]  = useState('all');
  const [sortField,     setSortField]     = useState<SortField>('changePercent');
  const [sortDir,       setSortDir]       = useState<SortDir>('desc');
  const [page,          setPage]          = useState(1);
  const PAGE_SIZE = 25;

  // Load sectors for sector filter dropdown
  useEffect(() => {
    marketAPI.getAllSectorsData().then(setSectors).catch(() => {});
  }, []);

  const addFilter = useCallback(() => {
    setFilters(prev => [...prev, {
      id: crypto.randomUUID(), category: 'Technical',
      metric: 'price', operator: '>', value: '', enabled: true,
    }]);
  }, []);

  const updateFilter = useCallback((id: string, updates: Partial<FilterCondition>) => {
    setFilters(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  }, []);

  const removeFilter = useCallback((id: string) => {
    setFilters(prev => prev.filter(f => f.id !== id));
  }, []);

  const applyPreset = useCallback((preset: typeof PRESET_SCREENERS[number]) => {
    setFilters(preset.filters.map(f => ({
      id: crypto.randomUUID(),
      enabled: true,
      ...f,
    } as FilterCondition)));
  }, []);

  const runScreener = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const activeFilters = filters.filter(f => f.enabled && f.metric && f.operator && f.value);
      const sectorSymbols = sectorFilter !== 'all'
        ? sectors.find(s => s.sector === sectorFilter)?.stocks?.map?.(s => (s as any).symbol) || []
        : undefined;

      const data = await marketAPI.runScreenerFilters({
        filters: activeFilters,
        symbols: selectedSymbols.length > 0
          ? selectedSymbols
          : sectorSymbols,
      });
      setResults(data);
      setPage(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Screener failed');
    } finally {
      setLoading(false);
    }
  }, [filters, selectedSymbols, sectorFilter, sectors]);

  const saveScreener = useCallback(() => {
    if (!screenerName.trim()) return;
    const next: SavedScreener = {
      id: crypto.randomUUID(),
      name: screenerName.trim(),
      filters: filters.filter(f => f.enabled),
      createdAt: new Date().toISOString(),
    };
    const updated = [...savedScreeners, next];
    setSavedScreeners(updated);
    persistScreeners(updated);
    setScreenerName('');
    setShowSaveModal(false);
  }, [screenerName, filters, savedScreeners]);

  const deleteScreener = useCallback((id: string) => {
    const updated = savedScreeners.filter(s => s.id !== id);
    setSavedScreeners(updated);
    persistScreeners(updated);
  }, [savedScreeners]);

  const loadScreener = useCallback((s: SavedScreener) => {
    setFilters(s.filters.map(f => ({ ...f, id: crypto.randomUUID() })));
  }, []);

  const toggleSort = (f: SortField) => {
    if (sortField === f) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(f); setSortDir('desc'); }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDir === 'asc'
      ? <ArrowUp style={{ width: 11, height: 11, display: 'inline' }} />
      : <ArrowDown style={{ width: 11, height: 11, display: 'inline' }} />;
  };

  const sortedResults = useMemo(() => {
    return [...results].sort((a, b) => {
      const av = a[sortField]; const bv = b[sortField];
      const m  = sortDir === 'asc' ? 1 : -1;
      if (av == null && bv == null) return 0;
      if (av == null) return 1; if (bv == null) return -1;
      return (typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv))) * m;
    });
  }, [results, sortField, sortDir]);

  const totalPages = Math.ceil(sortedResults.length / PAGE_SIZE);
  const pageRows   = sortedResults.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="page">

      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-kicker">Screener</div>
          <h1 className="page-title">Stock Screener</h1>
          <p className="page-subtitle">
            Filter stocks by technical, fundamental, valuation and growth criteria.
            Build custom screens, save them, and export results.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowSaveModal(true)} className="btn btn-ghost" style={{ fontSize: 12 }}>
            <Save style={{ width: 13, height: 13 }} /> Save
          </button>
          <button onClick={runScreener} disabled={loading} className="btn btn-primary" style={{ fontSize: 12 }}>
            <Filter style={{ width: 13, height: 13 }} />
            {loading ? 'Running…' : 'Run Screener'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: 'var(--red)' }}>
          ⚠ {error}
        </div>
      )}

      <div className="two-column-layout">

        {/* ── LEFT PANEL: Filters ───────────────────────────────────────────── */}
        <div className="stack-16">

          {/* Preset screeners */}
          <div className="card" style={{ padding: 16 }}>
            <div className="stat-label" style={{ marginBottom: 10 }}>Quick Presets</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {PRESET_SCREENERS.map(ps => (
                <button key={ps.name} onClick={() => applyPreset(ps)} className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 11 }}>
                  {ps.name}
                </button>
              ))}
            </div>
          </div>

          {/* Stock search box */}
          <div className="card" style={{ padding: 16 }}>
            <div className="stat-label" style={{ marginBottom: 8 }}>Search & Pin Stocks</div>
            <StockSearch onAdd={s => setSelectedSymbols(prev => prev.includes(s) ? prev : [...prev, s])} />
            {selectedSymbols.length > 0 && (
              <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {selectedSymbols.map(s => (
                  <span key={s} style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 16, padding: '3px 10px', fontSize: 11, fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    {s}
                    <button onClick={() => setSelectedSymbols(prev => prev.filter(x => x !== s))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-3)', lineHeight: 1 }}>×</button>
                  </span>
                ))}
                <button onClick={() => setSelectedSymbols([])} className="btn btn-ghost" style={{ padding: '3px 8px', fontSize: 10 }}>Clear all</button>
              </div>
            )}
          </div>

          {/* Sector filter */}
          <div className="card" style={{ padding: 16 }}>
            <div className="stat-label" style={{ marginBottom: 8 }}>Sector Filter</div>
            <select value={sectorFilter} onChange={e => setSectorFilter(e.target.value)} className="input" style={{ fontSize: 12 }}>
              <option value="all">All Sectors</option>
              {sectors.map(s => <option key={s.sector} value={s.sector}>{s.sector}</option>)}
            </select>
          </div>

          {/* Filter conditions */}
          <div className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div className="stat-label">Filter Conditions</div>
              <button onClick={addFilter} className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 12 }}>+ Add Filter</button>
            </div>
            {filters.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 12, color: 'var(--text-3)' }}>
                No filters added yet. Use presets above or click "Add Filter".
              </div>
            ) : (
              <div>
                {filters.map(f => (
                  <FilterRow key={f.id} filter={f} onChange={updateFilter} onRemove={removeFilter} />
                ))}
                <button onClick={() => setFilters([])} className="btn btn-ghost" style={{ marginTop: 10, padding: '5px 10px', fontSize: 11 }}>
                  <Trash2 style={{ width: 11, height: 11 }} /> Clear all filters
                </button>
              </div>
            )}
          </div>

          {/* Saved screeners */}
          {savedScreeners.length > 0 && (
            <div className="card" style={{ padding: 16 }}>
              <div className="stat-label" style={{ marginBottom: 10 }}>Saved Screeners</div>
              <div className="stack-8">
                {savedScreeners.map(s => (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-2)', borderRadius: 8 }}>
                    <button onClick={() => loadScreener(s)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text-1)', textAlign: 'left', flex: 1 }}>
                      {s.name}
                      <span style={{ fontSize: 10, color: 'var(--text-3)', marginLeft: 8 }}>{s.filters.length} filters</span>
                    </button>
                    <button onClick={() => deleteScreener(s.id)} className="btn btn-ghost" style={{ padding: 4 }}>
                      <Trash2 style={{ width: 12, height: 12 }} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT PANEL: Results ──────────────────────────────────────────── */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div className="panel-header">
            <div className="panel-title">Results ({sortedResults.length})</div>
            {sortedResults.length > 0 && (
              <button onClick={() => exportCsv(sortedResults)} className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: 11 }}>
                <Download style={{ width: 12, height: 12 }} /> Export CSV
              </button>
            )}
          </div>

          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)' }}>
              <RefreshCw style={{ width: 20, height: 20, animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
              Running screener…
            </div>
          ) : sortedResults.length === 0 ? (
            <div className="empty-state">
              <Search style={{ width: 28, height: 28, color: 'var(--text-3)' }} />
              <div style={{ fontWeight: 600 }}>No results yet</div>
              <div className="metric-footnote">Add filters and click "Run Screener"</div>
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto', flex: 1 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th onClick={() => toggleSort('symbol')} style={{ cursor: 'pointer' }}>Symbol <SortIcon field="symbol" /></th>
                      <th onClick={() => toggleSort('price')} style={{ cursor: 'pointer', textAlign: 'right' }}>Price <SortIcon field="price" /></th>
                      <th onClick={() => toggleSort('changePercent')} style={{ cursor: 'pointer', textAlign: 'right' }}>Chg% <SortIcon field="changePercent" /></th>
                      <th onClick={() => toggleSort('rsi14')} style={{ cursor: 'pointer', textAlign: 'right' }}>RSI <SortIcon field="rsi14" /></th>
                      <th onClick={() => toggleSort('peRatio')} style={{ cursor: 'pointer', textAlign: 'right' }}>P/E <SortIcon field="peRatio" /></th>
                      <th onClick={() => toggleSort('priceToBook')} style={{ cursor: 'pointer', textAlign: 'right' }}>P/B <SortIcon field="priceToBook" /></th>
                      <th onClick={() => toggleSort('dividendYield')} style={{ cursor: 'pointer', textAlign: 'right' }}>Div% <SortIcon field="dividendYield" /></th>
                      <th onClick={() => toggleSort('momentumScore')} style={{ cursor: 'pointer', textAlign: 'right' }}>Mom <SortIcon field="momentumScore" /></th>
                      <th onClick={() => toggleSort('volume')} style={{ cursor: 'pointer', textAlign: 'right' }}>Volume <SortIcon field="volume" /></th>
                      <th>Sector</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((row, i) => (
                      <tr key={row.symbol || i}>
                        <td style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                          {row.symbol}
                          {row.name && <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 400, fontFamily: 'inherit' }}>{row.name}</div>}
                        </td>
                        <td className="mono" style={{ textAlign: 'right' }}>{row.price ? formatCurrency(row.price) : '—'}</td>
                        <td className="mono" style={{ textAlign: 'right', color: row.changePercent >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                          {row.changePercent != null ? formatPercent(row.changePercent) : '—'}
                        </td>
                        <td className="mono" style={{ textAlign: 'right', color: row.rsi14 >= 70 ? 'var(--amber)' : row.rsi14 <= 30 ? '#38bdf8' : 'var(--text-1)' }}>
                          {row.rsi14 != null ? Number(row.rsi14).toFixed(1) : '—'}
                        </td>
                        <td className="mono" style={{ textAlign: 'right' }}>{row.peRatio != null ? Number(row.peRatio).toFixed(1) : '—'}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{row.priceToBook != null ? Number(row.priceToBook).toFixed(2) : '—'}</td>
                        <td className="mono" style={{ textAlign: 'right', color: row.dividendYield > 3 ? 'var(--green)' : 'var(--text-1)' }}>
                          {row.dividendYield != null ? `${Number(row.dividendYield).toFixed(2)}%` : '—'}
                        </td>
                        <td className="mono" style={{ textAlign: 'right', color: row.momentumScore >= 50 ? 'var(--green)' : row.momentumScore < 0 ? 'var(--red)' : 'var(--text-2)' }}>
                          {row.momentumScore != null ? Math.round(row.momentumScore) : '—'}
                        </td>
                        <td className="mono" style={{ textAlign: 'right' }}>{row.volume ? formatLargeNumber(row.volume) : '—'}</td>
                        <td style={{ fontSize: 11, color: 'var(--text-2)' }}>{row.sector || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderTop: '1px solid var(--border-light)', fontSize: 12 }}>
                  <span style={{ color: 'var(--text-3)' }}>
                    Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, sortedResults.length)} of {sortedResults.length}
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn btn-ghost" style={{ padding: '5px 10px' }}>← Prev</button>
                    <span style={{ alignSelf: 'center', color: 'var(--text-2)' }}>{page}/{totalPages}</span>
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn btn-ghost" style={{ padding: '5px 10px' }}>Next →</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Save modal */}
      {showSaveModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="card" style={{ padding: 24, width: 380, maxWidth: '100%' }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Save Screener</div>
            <input
              type="text"
              value={screenerName}
              onChange={e => setScreenerName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveScreener()}
              placeholder="e.g. My Value Screen"
              className="input"
              autoFocus
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowSaveModal(false)} className="btn btn-ghost">Cancel</button>
              <button onClick={saveScreener} disabled={!screenerName.trim()} className="btn btn-primary">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
