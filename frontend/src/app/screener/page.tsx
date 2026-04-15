'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { 
  ArrowDown, ArrowUp, Compass, Filter, RefreshCw, Save, Search, 
  TrendingDown, TrendingUp, Zap, X, ChevronDown, Check, AlertTriangle
} from 'lucide-react';
import { marketAPI, type SearchResult } from '@/lib/api';
import { formatCurrency, formatLargeNumber, formatPercent } from '@/lib/format';

interface FilterCondition {
  id: string;
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

const METRICS = [
  { value: 'price', label: 'Price', type: 'number' },
  { value: 'changePercent', label: '% Change', type: 'number' },
  { value: 'volume', label: 'Volume', type: 'number' },
  { value: 'marketCap', label: 'Market Cap', type: 'number' },
  { value: 'rsi14', label: 'RSI (14)', type: 'number' },
  { value: 'sma20', label: 'SMA 20', type: 'number' },
  { value: 'sma50', label: 'SMA 50', type: 'number' },
  { value: 'sector', label: 'Sector', type: 'text' },
  { value: 'momentumScore', label: 'Momentum Score', type: 'number' },
  { value: 'volumeRatio', label: 'Volume Ratio', type: 'number' },
];

const OPERATORS = [
  { value: '>', label: 'Greater than' },
  { value: '<', label: 'Less than' },
  { value: '=', label: 'Equals' },
  { value: '>=', label: 'Greater or equal' },
  { value: '<=', label: 'Less or equal' },
];

function MetricIcon({ metric }: { metric: string }) {
  if (metric.includes('change') || metric === 'momentumScore') return <TrendingUp style={{ width: 14, height: 14 }} />;
  if (metric === 'volume' || metric === 'volumeRatio') return <Zap style={{ width: 14, height: 14 }} />;
  if (metric.includes('RSI')) return <AlertTriangle style={{ width: 14, height: 14 }} />;
  return <Filter style={{ width: 14, height: 14 }} />;
}

function StockSearchBar({ onSelect }: { onSelect: (symbol: string) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await marketAPI.searchStocks(query);
        setResults(data.slice(0, 8));
        setShowResults(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'var(--text-3)' }} />
        <input
          type="text"
          className="input"
          placeholder="Search any stock (e.g., RELIANCE, TCS, Bank...)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setShowResults(true)}
          onBlur={() => setTimeout(() => setShowResults(false), 200)}
          style={{ paddingLeft: 40 }}
        />
      </div>
      
      {showResults && (results.length > 0 || loading) && (
        <div className="panel" style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
          marginTop: 4, maxHeight: 300, overflow: 'auto'
        }}>
          {loading ? (
            <div style={{ padding: 12, textAlign: 'center', color: 'var(--text-3)' }}>Searching...</div>
          ) : (
            results.map((stock) => (
              <button
                key={stock.symbol}
                onClick={() => {
                  onSelect(stock.symbol);
                  setQuery('');
                  setShowResults(false);
                }}
                className="list-card"
                style={{ display: 'flex', justifyContent: 'space-between', width: '100%', textAlign: 'left', border: 'none', borderBottom: '1px solid var(--border-light)' }}
              >
                <div>
                  <span className="mono" style={{ fontWeight: 700 }}>{stock.symbol}</span>
                  <span style={{ marginLeft: 8, color: 'var(--text-2)', fontSize: 12 }}>{stock.name}</span>
                </div>
                <span className="badge badge-muted">{stock.exchange}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function FilterRow({ 
  filter, onChange, onRemove 
}: { 
  filter: FilterCondition; 
  onChange: (id: string, updates: Partial<FilterCondition>) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <select
        value={filter.metric}
        onChange={(e) => onChange(filter.id, { metric: e.target.value })}
        className="input"
        style={{ width: 140, padding: '8px 10px' }}
      >
        {METRICS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
      </select>

      <select
        value={filter.operator}
        onChange={(e) => onChange(filter.id, { operator: e.target.value })}
        className="input"
        style={{ width: 140, padding: '8px 10px' }}
      >
        {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>

      <input
        type={METRICS.find(m => m.value === filter.metric)?.type === 'number' ? 'number' : 'text'}
        value={filter.value}
        onChange={(e) => onChange(filter.id, { value: e.target.value })}
        placeholder="Value"
        className="input"
        style={{ width: 100, padding: '8px 10px' }}
      />

      <button onClick={() => onRemove(filter.id)} className="btn btn-ghost" style={{ padding: 6 }}>
        <X style={{ width: 14, height: 14 }} />
      </button>
    </div>
  );
}

function QueryParser({ query, onChange }: { query: string; onChange: (q: string) => void }) {
  const [showHelp, setShowHelp] = useState(false);

  return (
    <div className="surface-inset">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div className="stat-label">Query Expression (optional)</div>
        <button onClick={() => setShowHelp(!showHelp)} className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: 11 }}>
          {showHelp ? 'Hide' : 'Show'} syntax
        </button>
      </div>
      
      <input
        type="text"
        value={query}
        onChange={(e) => onChange(e.target.value)}
        placeholder='e.g., RSI < 30 AND price > 100'
        className="input"
      />

      {showHelp && (
        <div className="metric-footnote" style={{ marginTop: 8 }}>
          <div>Supported: AND, OR, parentheses</div>
          <div>Examples:</div>
          <div style={{ marginLeft: 12, fontFamily: 'var(--font-mono)' }}>
            RSI &lt; 30 AND price &gt; 100<br/>
            volume &gt; 1000000 OR marketCap &gt; 10000<br/>
            (sector = 'Technology' OR sector = 'Finance') AND changePercent &gt; 2
          </div>
        </div>
      )}
    </div>
  );
}

type SortField = 'symbol' | 'price' | 'changePercent' | 'volume' | 'marketCap' | 'rsi14';
type SortDirection = 'asc' | 'desc';

export default function ScreenerPage() {
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [query, setQuery] = useState('');
  const [selectedStocks, setSelectedStocks] = useState<string[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [savedScreeners, setSavedScreeners] = useState<SavedScreener[]>([]);
  const [screenerName, setScreenerName] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  
  const [sortField, setSortField] = useState<SortField>('changePercent');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');

  const addFilter = useCallback(() => {
    setFilters(prev => [...prev, {
      id: crypto.randomUUID(),
      metric: 'price',
      operator: '>',
      value: '',
      enabled: true
    }]);
  }, []);

  const updateFilter = useCallback((id: string, updates: Partial<FilterCondition>) => {
    setFilters(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  }, []);

  const removeFilter = useCallback((id: string) => {
    setFilters(prev => prev.filter(f => f.id !== id));
  }, []);

  const runScreener = useCallback(async () => {
    setLoading(true);
    try {
      const activeFilters = filters.filter(f => f.enabled && f.metric && f.operator && f.value);
      
      const mockResults = await marketAPI.runScreenerFilters({
        filters: activeFilters,
        query: query || undefined,
        symbols: selectedStocks.length > 0 ? selectedStocks : undefined,
      });
      
      setResults(mockResults);
    } catch (error) {
      console.error('Screener error:', error);
    } finally {
      setLoading(false);
    }
  }, [filters, query, selectedStocks]);

  const sortedResults = useMemo(() => {
    return [...results].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      const modifier = sortDir === 'asc' ? 1 : -1;
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return (aVal - bVal) * modifier;
      }
      return String(aVal).localeCompare(String(bVal)) * modifier;
    });
  }, [results, sortField, sortDir]);

  const saveScreener = useCallback(() => {
    if (!screenerName.trim()) return;
    
    const newScreener: SavedScreener = {
      id: crypto.randomUUID(),
      name: screenerName,
      filters: filters.filter(f => f.enabled),
      createdAt: new Date().toISOString(),
    };
    
    setSavedScreeners(prev => [...prev, newScreener]);
    setScreenerName('');
    setShowSaveModal(false);
  }, [screenerName, filters]);

  const loadScreener = useCallback((screener: SavedScreener) => {
    setFilters(screener.filters.map(f => ({ ...f, id: crypto.randomUUID() })));
  }, []);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDir === 'asc' ? <ArrowUp style={{ width: 12, height: 12 }} /> : <ArrowDown style={{ width: 12, height: 12 }} />;
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-kicker">Guided Screener</div>
          <h1 className="page-title">Stock Screener</h1>
          <p className="page-subtitle">
            Filter and discover stocks based on custom criteria. Search any stock, add filters, or use query expressions.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowSaveModal(true)} className="btn btn-ghost">
            <Save style={{ width: 14, height: 14 }} /> Save
          </button>
          <button onClick={() => runScreener()} disabled={loading} className="btn btn-primary">
            <Filter style={{ width: 14, height: 14 }} />
            {loading ? 'Running...' : 'Run Screener'}
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="card" style={{ padding: 16 }}>
        <StockSearchBar onSelect={(symbol) => {
          setSelectedStocks(prev => prev.includes(symbol) ? prev : [...prev, symbol]);
        }} />
        
        {selectedStocks.length > 0 && (
          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {selectedStocks.map(symbol => (
              <span key={symbol} className="badge badge-muted">
                {symbol}
                <button onClick={() => setSelectedStocks(prev => prev.filter(s => s !== symbol))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginLeft: 4 }}>
                  <X style={{ width: 12, height: 12 }} />
                </button>
              </span>
            ))}
            <button onClick={() => setSelectedStocks([])} className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: 11 }}>
              Clear all
            </button>
          </div>
        )}
      </div>

      <div className="two-column-layout">
        {/* Filters Panel */}
        <div className="stack-16">
          <div className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div className="stat-label">Filter Conditions</div>
              <button onClick={addFilter} className="btn btn-ghost" style={{ padding: '6px 12px' }}>
                + Add Filter
              </button>
            </div>
            
            {filters.length === 0 ? (
              <div className="metric-footnote" style={{ textAlign: 'center', padding: 20 }}>
                No filters added. Click "Add Filter" or use query expression below.
              </div>
            ) : (
              <div className="stack-8">
                {filters.map(filter => (
                  <FilterRow key={filter.id} filter={filter} onChange={updateFilter} onRemove={removeFilter} />
                ))}
              </div>
            )}
          </div>

          <QueryParser query={query} onChange={setQuery} />

          {/* Saved Screeners */}
          {savedScreeners.length > 0 && (
            <div className="card" style={{ padding: 16 }}>
              <div className="stat-label" style={{ marginBottom: 12 }}>Saved Screeners</div>
              <div className="stack-8">
                {savedScreeners.map(s => (
                  <button key={s.id} onClick={() => loadScreener(s)} className="list-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600 }}>{s.name}</span>
                    <span className="badge badge-muted">{s.filters.length} filters</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Results Table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="panel-header">
            <div className="panel-title">Results ({sortedResults.length})</div>
          </div>
          
          {sortedResults.length === 0 ? (
            <div className="empty-state">
              <Search style={{ width: 32, height: 32, color: 'var(--text-3)' }} />
              <div style={{ fontWeight: 600 }}>No results</div>
              <div className="metric-footnote">Add filters or search stocks, then click "Run Screener"</div>
            </div>
          ) : (
            <div className="panel-scroll" style={{ maxHeight: 'calc(100vh - 400px)' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th onClick={() => toggleSort('symbol')} style={{ cursor: 'pointer' }}>
                      Symbol <SortIcon field="symbol" />
                    </th>
                    <th onClick={() => toggleSort('price')} style={{ cursor: 'pointer' }}>
                      Price <SortIcon field="price" />
                    </th>
                    <th onClick={() => toggleSort('changePercent')} style={{ cursor: 'pointer' }}>
                      % Change <SortIcon field="changePercent" />
                    </th>
                    <th onClick={() => toggleSort('volume')} style={{ cursor: 'pointer' }}>
                      Volume <SortIcon field="volume" />
                    </th>
                    <th onClick={() => toggleSort('rsi14')} style={{ cursor: 'pointer' }}>
                      RSI <SortIcon field="rsi14" />
                    </th>
                    <th>Sector</th>
                    <th onClick={() => toggleSort('marketCap')} style={{ cursor: 'pointer' }}>
                      Mkt Cap <SortIcon field="marketCap" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedResults.map((stock) => (
                    <tr key={stock.symbol}>
                      <td style={{ fontWeight: 700 }}>{stock.symbol}</td>
                      <td className="mono">{formatCurrency(stock.price)}</td>
                      <td className="mono" style={{ color: stock.changePercent >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {formatPercent(stock.changePercent)}
                      </td>
                      <td className="mono">{formatLargeNumber(stock.volume)}</td>
                      <td className="mono">{stock.rsi14 || '—'}</td>
                      <td>{stock.sector || '—'}</td>
                      <td className="mono">{stock.marketCap ? formatLargeNumber(stock.marketCap) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Save Modal */}
      {showSaveModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="card" style={{ padding: 24, width: 400 }}>
            <div className="stat-label" style={{ marginBottom: 12 }}>Save Screener</div>
            <input
              type="text"
              value={screenerName}
              onChange={(e) => setScreenerName(e.target.value)}
              placeholder="Screener name"
              className="input"
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowSaveModal(false)} className="btn btn-ghost">Cancel</button>
              <button onClick={saveScreener} className="btn btn-primary">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
