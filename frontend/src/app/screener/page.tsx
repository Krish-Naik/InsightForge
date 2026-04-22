'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowDown, ArrowUp, Download, Filter, RefreshCw,
  Save, Search, Trash2, X, TrendingUp, BarChart3, Zap, Shield, Target,
  CheckCircle2,
} from 'lucide-react';
import { marketAPI, financialsAPI, type SectorOverview } from '@/lib/api';
import { formatCurrency, formatLargeNumber, formatPercent } from '@/lib/format';
import { useMarketCatalog, searchCatalogStocks, type CatalogStock } from '@/lib/hooks/useMarketCatalog';

interface FilterCondition {
  id: string;
  category: string;
  metric: string;
  operator: string;
  value: string;
  enabled: boolean;
}

interface ScreenerResult {
  symbol: string;
  name: string;
  currentPrice: number | null;
  marketCap: number | null;
  peRatio: number | null;
  pbRatio: number | null;
  psRatio: number | null;
  dividendYield: number | null;
  eps: number | null;
  revenue: number | null;
  profit: number | null;
  netMargin: number | null;
  grossMargin: number | null;
  roe: number | null;
  roce: number | null;
  roa: number | null;
  debtToEquity: number | null;
  currentRatio: number | null;
  quickRatio: number | null;
  interestCoverage: number | null;
  revenueGrowth: number | null;
  profitGrowth: number | null;
  epsGrowth: number | null;
  operatingCashFlow: number | null;
  freeCashFlow: number | null;
  score: number;
  lastQuarter: string;
  matchingCriteria?: string[];
}

interface SavedScreener {
  id: string;
  name: string;
  filters: FilterCondition[];
  createdAt: string;
}

const FILTER_CATEGORIES = {
  'Valuation': [
    { value: 'peRatio', label: 'P/E Ratio' },
    { value: 'pbRatio', label: 'P/B Ratio' },
    { value: 'psRatio', label: 'P/S Ratio' },
    { value: 'dividendYield', label: 'Dividend Yield %' },
  ],
  'Profitability': [
    { value: 'roe', label: 'ROE %' },
    { value: 'roce', label: 'ROCE %' },
    { value: 'roa', label: 'ROA %' },
    { value: 'netMargin', label: 'Net Margin %' },
    { value: 'grossMargin', label: 'Gross Margin %' },
  ],
  'Growth': [
    { value: 'revenueGrowth', label: 'Revenue Growth %' },
    { value: 'profitGrowth', label: 'Profit Growth %' },
    { value: 'epsGrowth', label: 'EPS Growth %' },
  ],
  'Leverage': [
    { value: 'debtToEquity', label: 'Debt/Equity' },
    { value: 'currentRatio', label: 'Current Ratio' },
    { value: 'quickRatio', label: 'Quick Ratio' },
    { value: 'interestCoverage', label: 'Interest Coverage' },
  ],
  'Size': [
    { value: 'marketCap', label: 'Market Cap (Cr)' },
    { value: 'revenue', label: 'Revenue (Cr)' },
  ],
};

const PRESET_SCREENERS = [
  {
    name: 'Quality Picks',
    description: 'High ROE & Low Debt',
    filters: [
      { category: 'Profitability', metric: 'roe', operator: '>=', value: '15' },
      { category: 'Leverage', metric: 'debtToEquity', operator: '<=', value: '0.5' },
    ],
  },
  {
    name: 'High Growth',
    description: 'Revenue growth >20%',
    filters: [
      { category: 'Growth', metric: 'revenueGrowth', operator: '>=', value: '20' },
      { category: 'Profitability', metric: 'netMargin', operator: '>=', value: '10' },
    ],
  },
  {
    name: 'Value Picks',
    description: 'Low P/E & P/B',
    filters: [
      { category: 'Valuation', metric: 'peRatio', operator: '<=', value: '15' },
      { category: 'Valuation', metric: 'pbRatio', operator: '<=', value: '2' },
      { category: 'Profitability', metric: 'roe', operator: '>=', value: '12' },
    ],
  },
  {
    name: 'Dividend Stars',
    description: 'High dividend yield',
    filters: [
      { category: 'Valuation', metric: 'dividendYield', operator: '>=', value: '3' },
      { category: 'Leverage', metric: 'debtToEquity', operator: '<=', value: '1' },
    ],
  },
  {
    name: 'Profitable & Growing',
    description: 'High margins + growth',
    filters: [
      { category: 'Profitability', metric: 'netMargin', operator: '>=', value: '15' },
      { category: 'Profitability', metric: 'roe', operator: '>=', value: '18' },
      { category: 'Growth', metric: 'revenueGrowth', operator: '>=', value: '15' },
    ],
  },
  {
    name: 'Large Cap Quality',
    description: 'Big & profitable',
    filters: [
      { category: 'Size', metric: 'marketCap', operator: '>=', value: '10000' },
      { category: 'Profitability', metric: 'roe', operator: '>=', value: '15' },
      { category: 'Profitability', metric: 'roce', operator: '>=', value: '15' },
    ],
  },
];

const LS_KEY = 'insightforge:screeners';

function loadSavedScreeners(): SavedScreener[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); }
  catch { return []; }
}

function persistScreeners(screeners: SavedScreener[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(screeners)); }
  catch { /* ignore */ }
}

function exportCsv(rows: ScreenerResult[]) {
  if (!rows.length) return;
  const headers = ['Symbol', 'Name', 'Price', 'Market Cap', 'P/E', 'P/B', 'ROE', 'ROCE', 'Net Margin', 'Revenue Growth', 'Score'];
  const csv = [
    headers.join(','),
    ...rows.map(r => [
      r.symbol,
      `"${r.name}"`,
      r.currentPrice || '',
      r.marketCap || '',
      r.peRatio || '',
      r.pbRatio || '',
      r.roe || '',
      r.roce || '',
      r.netMargin || '',
      r.revenueGrowth || '',
      r.score,
    ].join(','))
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `screener-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// Transform backend FinancialMetrics to ScreenerResult
function transformToScreenerResult(metric: any, activeFilters: FilterCondition[]): ScreenerResult {
  // Calculate score based on matching criteria
  let score = 0;
  const matchingCriteria: string[] = [];

  activeFilters.forEach(filter => {
    const metricValue = metric[filter.metric];
    const filterValue = parseFloat(filter.value);
    
    if (metricValue !== null && metricValue !== undefined && !isNaN(filterValue)) {
      let matches = false;
      if (filter.operator === '>=' && metricValue >= filterValue) matches = true;
      if (filter.operator === '<=' && metricValue <= filterValue) matches = true;
      if (filter.operator === '>' && metricValue > filterValue) matches = true;
      if (filter.operator === '<' && metricValue < filterValue) matches = true;
      if (filter.operator === '==' && Math.abs(metricValue - filterValue) < 0.01) matches = true;
      
      if (matches) {
        score += 10;
        const categoryLabel = Object.entries(FILTER_CATEGORIES)
          .find(([_, metrics]) => metrics.some(m => m.value === filter.metric))?.[0] || '';
        const metricLabel = Object.values(FILTER_CATEGORIES)
          .flat()
          .find(m => m.value === filter.metric)?.label || filter.metric;
        matchingCriteria.push(`${metricLabel} ${filter.operator} ${filter.value}`);
      }
    }
  });

  // Bonus points for quality metrics
  if (metric.roe && metric.roe >= 15) score += 5;
  if (metric.roce && metric.roce >= 15) score += 5;
  if (metric.debtToEquity !== null && metric.debtToEquity <= 0.5) score += 5;
  if (metric.currentRatio && metric.currentRatio >= 1.5) score += 3;
  if (metric.revenueGrowth && metric.revenueGrowth >= 15) score += 5;

  return {
    symbol: metric.symbol,
    name: metric.companyName,
    currentPrice: metric.currentPrice,
    marketCap: metric.marketCap,
    peRatio: metric.peRatio,
    pbRatio: metric.pbRatio,
    psRatio: metric.psRatio,
    dividendYield: metric.dividendYield,
    eps: metric.eps,
    revenue: metric.revenueFromOperations,
    profit: metric.profitAfterTax,
    netMargin: metric.netMargin,
    grossMargin: metric.grossMargin,
    roe: metric.roe,
    roce: metric.roce,
    roa: metric.roa,
    debtToEquity: metric.debtToEquity,
    currentRatio: metric.currentRatio,
    quickRatio: metric.quickRatio,
    interestCoverage: metric.interestCoverage,
    revenueGrowth: metric.revenueGrowth,
    profitGrowth: metric.profitGrowth,
    epsGrowth: metric.epsYoYGrowth,
    operatingCashFlow: metric.operatingCashFlow,
    freeCashFlow: metric.freeCashFlow,
    score: Math.min(score, 100),
    lastQuarter: `${metric.quarter} ${metric.year}`,
    matchingCriteria: matchingCriteria.length > 0 ? matchingCriteria : undefined,
  };
}

export default function ScreenerPage() {
  const router = useRouter();
  const { catalog } = useMarketCatalog();
  const [filters, setFilters] = useState<FilterCondition[]>([
    { id: crypto.randomUUID(), category: 'Profitability', metric: 'roe', operator: '>=', value: '15', enabled: true }
  ]);
  const [results, setResults] = useState<ScreenerResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<string>('score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [savedScreeners, setSavedScreeners] = useState<SavedScreener[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [screenerName, setScreenerName] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CatalogStock[]>([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  useEffect(() => {
    setSavedScreeners(loadSavedScreeners());
  }, []);

  const runScreener = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const activeFilters = filters.filter(f => f.enabled && f.metric && f.operator && f.value);
      
      let filterPayload: any = { limit: 200 };
      
      for (const f of activeFilters) {
        const val = parseFloat(f.value);
        if (isNaN(val)) continue;

        if (f.category === 'Valuation') {
          if (f.metric === 'peRatio') {
            if (f.operator === '>=') filterPayload.minPe = val;
            else if (f.operator === '<=') filterPayload.maxPe = val;
          } else if (f.metric === 'pbRatio') {
            if (f.operator === '>=') filterPayload.minPb = val;
            else if (f.operator === '<=') filterPayload.maxPb = val;
          } else if (f.metric === 'psRatio') {
            if (f.operator === '>=') filterPayload.minPs = val;
            else if (f.operator === '<=') filterPayload.maxPs = val;
          } else if (f.metric === 'dividendYield') {
            filterPayload.minDividendYield = val;
          }
        } else if (f.category === 'Profitability') {
          if (f.metric === 'roe') {
            if (f.operator === '>=') filterPayload.minRoe = val;
            else if (f.operator === '<=') filterPayload.maxRoe = val;
          } else if (f.metric === 'roce') {
            if (f.operator === '>=') filterPayload.minRoce = val;
            else if (f.operator === '<=') filterPayload.maxRoce = val;
          } else if (f.metric === 'roa') {
            filterPayload.minRoa = val;
          } else if (f.metric === 'netMargin') {
            if (f.operator === '>=') filterPayload.minNetMargin = val;
            else if (f.operator === '<=') filterPayload.maxNetMargin = val;
          } else if (f.metric === 'grossMargin') {
            filterPayload.minGrossMargin = val;
          }
        } else if (f.category === 'Growth') {
          if (f.metric === 'revenueGrowth') {
            filterPayload.minRevenueGrowth = val;
          } else if (f.metric === 'profitGrowth') {
            filterPayload.minProfitGrowth = val;
          } else if (f.metric === 'epsGrowth') {
            filterPayload.minEpsGrowth = val;
          }
        } else if (f.category === 'Leverage') {
          if (f.metric === 'debtToEquity') {
            if (f.operator === '<=') filterPayload.maxDebtToEquity = val;
            else if (f.operator === '>=') filterPayload.minDebtToEquity = val;
          } else if (f.metric === 'currentRatio') {
            if (f.operator === '>=') filterPayload.minCurrentRatio = val;
            else if (f.operator === '<=') filterPayload.maxCurrentRatio = val;
          } else if (f.metric === 'quickRatio') {
            if (f.operator === '>=') filterPayload.minQuickRatio = val;
          } else if (f.metric === 'interestCoverage') {
            filterPayload.minInterestCoverage = val;
          }
        } else if (f.category === 'Size') {
          if (f.metric === 'marketCap') {
            if (f.operator === '>=') filterPayload.minMarketCap = val;
            else if (f.operator === '<=') filterPayload.maxMarketCap = val;
          } else if (f.metric === 'revenue') {
            filterPayload.minRevenue = val;
          }
        }
      }

const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Request timed out. Try again later.')), 15000)
      );
      const mongoResults = await Promise.race([
        financialsAPI.runAdvancedScreener(filterPayload),
        timeoutPromise
      ]);
        
      // Transform backend FinancialMetrics to ScreenerResult
      const transformedResults = mongoResults.map(metric => 
        transformToScreenerResult(metric, activeFilters)
      );
      
      setResults(transformedResults);
      setPage(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Screener failed. Please try again.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

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

  const navigateToStock = (symbol: string) => {
    router.push(`/stocks/${encodeURIComponent(symbol)}`);
  };

  const toggleSort = (f: string) => {
    if (sortField === f) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(f); setSortDir('desc'); }
  };

  const toggleExpand = (symbol: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(symbol)) next.delete(symbol);
      else next.add(symbol);
      return next;
    });
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setSearchQuery(q);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!q.trim()) {
      setSearchResults([]);
      setShowSearchDropdown(false);
      return;
    }
    searchTimeoutRef.current = setTimeout(() => {
      const found = searchCatalogStocks(catalog, q);
      setSearchResults(found.slice(0, 8));
      setShowSearchDropdown(found.length > 0);
    }, 200);
  };

  const addFilter = () => {
    setFilters(f => [...f, { id: crypto.randomUUID(), category: 'Profitability', metric: 'roe', operator: '>=', value: '', enabled: true }]);
  };

  const removeFilter = (id: string) => {
    setFilters(f => f.filter(x => x.id !== id));
  };

  const updateFilter = (id: string, updates: Partial<FilterCondition>) => {
    setFilters(f => f.map(x => x.id === id ? { ...x, ...updates } : x));
  };

  const sorted = useMemo(() => {
    const copy = [...results];
    copy.sort((a, b) => {
      const aVal = (a as any)[sortField] ?? -Infinity;
      const bVal = (b as any)[sortField] ?? -Infinity;
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });
    return copy;
  }, [results, sortField, sortDir]);

  const perPage = 50;
  const totalPages = Math.ceil(sorted.length / perPage);
  const paged = sorted.slice((page - 1) * perPage, page * perPage);

  return (
    <div className="page">
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <BarChart3 style={{ width: 28, height: 28, color: 'var(--primary)' }} />
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Stock Screener</h1>
        </div>
        <p style={{ color: 'var(--text-2)', fontSize: 14, margin: 0 }}>
          Filter stocks by fundamentals using quarterly financial data
        </p>
      </div>

      <div className="workbench-grid">
        <div className="workbench-column">
          {/* Preset Screeners */}
          <div className="card" style={{ padding: 16, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Zap style={{ width: 16, height: 16, color: 'var(--primary)' }} />
              <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Quick Start</h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
              {PRESET_SCREENERS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => {
                    setFilters(preset.filters.map(f => ({ ...f, id: crypto.randomUUID(), enabled: true })));
                  }}
                  className="btn btn-ghost"
                  style={{ fontSize: 12, textAlign: 'left', padding: '8px 12px', height: 'auto', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}
                >
                  <div style={{ fontWeight: 600 }}>{preset.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{preset.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Filters */}
          <div className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Filter style={{ width: 16, height: 16, color: 'var(--primary)' }} />
                <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Filters</h3>
              </div>
              <button onClick={addFilter} className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }}>
                + Add Filter
              </button>
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              {filters.map((filter) => (
                <div key={filter.id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 80px 100px 80px 24px', gap: 8, alignItems: 'center', padding: 8, background: 'var(--bg-2)', borderRadius: 6 }}>
                  <input
                    type="checkbox"
                    checked={filter.enabled}
                    onChange={e => updateFilter(filter.id, { enabled: e.target.checked })}
                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                  />
                  <select
                    value={filter.category}
                    onChange={e => {
                      const newCat = e.target.value;
                      const firstMetric = (FILTER_CATEGORIES as any)[newCat]?.[0]?.value || 'roe';
                      updateFilter(filter.id, { category: newCat, metric: firstMetric });
                    }}
                    className="input"
                    style={{ fontSize: 11, padding: '4px 8px' }}
                  >
                    {Object.keys(FILTER_CATEGORIES).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <select
                    value={filter.metric}
                    onChange={e => updateFilter(filter.id, { metric: e.target.value })}
                    className="input"
                    style={{ fontSize: 11, padding: '4px 8px' }}
                  >
                    {((FILTER_CATEGORIES as any)[filter.category] || []).map((m: any) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                  <select
                    value={filter.operator}
                    onChange={e => updateFilter(filter.id, { operator: e.target.value })}
                    className="input"
                    style={{ fontSize: 11, padding: '4px 8px' }}
                  >
                    <option value=">=">&gt;=</option>
                    <option value="<=">&lt;=</option>
                    <option value=">">&gt;</option>
                    <option value="<">&lt;</option>
                    <option value="==">=</option>
                  </select>
                  <input
                    type="number"
                    value={filter.value}
                    onChange={e => updateFilter(filter.id, { value: e.target.value })}
                    placeholder="Value"
                    className="input"
                    style={{ fontSize: 11, padding: '4px 8px' }}
                  />
                  <button
                    onClick={() => removeFilter(filter.id)}
                    className="btn btn-ghost"
                    style={{ padding: 4, width: 24, height: 24, minWidth: 'unset' }}
                  >
                    <X style={{ width: 14, height: 14 }} />
                  </button>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={runScreener} disabled={loading} className="btn btn-primary" style={{ fontSize: 12 }}>
                {loading ? (
                  <>
                    <RefreshCw style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} />
                    Running...
                  </>
                ) : (
                  <>
                    <Search style={{ width: 14, height: 14 }} />
                    Run Screener
                  </>
                )}
              </button>
              <button onClick={() => setShowSaveModal(true)} className="btn btn-ghost" style={{ fontSize: 12 }}>
                <Save style={{ width: 14, height: 14 }} />
                Save
              </button>
              {results.length > 0 && (
                <button onClick={() => exportCsv(results)} className="btn btn-ghost" style={{ fontSize: 12 }}>
                  <Download style={{ width: 14, height: 14 }} />
                  CSV
                </button>
              )}
            </div>
          </div>

          {/* Saved Screeners */}
          {savedScreeners.length > 0 && (
            <div className="card" style={{ padding: 16, marginTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Target style={{ width: 16, height: 16, color: 'var(--primary)' }} />
                <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Saved Screeners</h3>
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {savedScreeners.map((s) => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-2)', borderRadius: 6 }}>
                    <button
                      onClick={() => loadScreener(s)}
                      className="btn btn-ghost"
                      style={{ fontSize: 12, padding: 0, textAlign: 'left', flex: 1 }}
                    >
                      {s.name}
                      <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>
                        {s.filters.length} filters • {new Date(s.createdAt).toLocaleDateString()}
                      </div>
                    </button>
                    <button
                      onClick={() => deleteScreener(s.id)}
                      className="btn btn-ghost"
                      style={{ padding: 4, width: 24, height: 24, minWidth: 'unset' }}
                    >
                      <Trash2 style={{ width: 14, height: 14 }} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="workbench-column" style={{ flex: 2 }}>
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: 16, borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Results</h3>
                  <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '4px 0 0' }}>
                    {results.length} stocks found
                  </p>
                </div>
                {totalPages > 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="btn btn-ghost"
                      style={{ fontSize: 11, padding: '4px 8px' }}
                    >
                      Prev
                    </button>
                    <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
                      {page} / {totalPages}
                    </span>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="btn btn-ghost"
                      style={{ fontSize: 11, padding: '4px 8px' }}
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            </div>

            {error && (
              <div style={{ padding: 16, background: 'var(--red-bg)', color: 'var(--red)', fontSize: 12 }}>
                {error}
              </div>
            )}

            {loading ? (
              <div style={{ padding: 20 }}>
                <div className="skeleton" style={{ height: 48, marginBottom: 12 }} />
                <div className="skeleton" style={{ height: 48, marginBottom: 12 }} />
                <div className="skeleton" style={{ height: 48 }} />
              </div>
            ) : results.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>
                <Shield style={{ width: 48, height: 48, margin: '0 auto 12px', opacity: 0.3 }} />
                <p style={{ fontSize: 14, margin: 0 }}>No results yet. Configure filters and run the screener.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 600, cursor: 'pointer' }} onClick={() => toggleSort('symbol')}>
                        Symbol {sortField === 'symbol' && (sortDir === 'asc' ? <ArrowUp style={{ width: 12, height: 12, display: 'inline' }} /> : <ArrowDown style={{ width: 12, height: 12, display: 'inline' }} />)}
                      </th>
                      <th style={{ textAlign: 'center', padding: '12px 16px', fontWeight: 600, cursor: 'pointer', width: 60 }} onClick={() => toggleSort('score')}>
                        Score {sortField === 'score' && (sortDir === 'asc' ? <ArrowUp style={{ width: 12, height: 12, display: 'inline' }} /> : <ArrowDown style={{ width: 12, height: 12, display: 'inline' }} />)}
                      </th>
                      <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 600, cursor: 'pointer' }} onClick={() => toggleSort('currentPrice')}>
                        Price {sortField === 'currentPrice' && (sortDir === 'asc' ? <ArrowUp style={{ width: 12, height: 12, display: 'inline' }} /> : <ArrowDown style={{ width: 12, height: 12, display: 'inline' }} />)}
                      </th>
                      <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 600, cursor: 'pointer' }} onClick={() => toggleSort('marketCap')}>
                        MCap {sortField === 'marketCap' && (sortDir === 'asc' ? <ArrowUp style={{ width: 12, height: 12, display: 'inline' }} /> : <ArrowDown style={{ width: 12, height: 12, display: 'inline' }} />)}
                      </th>
                      <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 600, cursor: 'pointer' }} onClick={() => toggleSort('peRatio')}>
                        P/E {sortField === 'peRatio' && (sortDir === 'asc' ? <ArrowUp style={{ width: 12, height: 12, display: 'inline' }} /> : <ArrowDown style={{ width: 12, height: 12, display: 'inline' }} />)}
                      </th>
                      <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 600, cursor: 'pointer' }} onClick={() => toggleSort('roe')}>
                        ROE {sortField === 'roe' && (sortDir === 'asc' ? <ArrowUp style={{ width: 12, height: 12, display: 'inline' }} /> : <ArrowDown style={{ width: 12, height: 12, display: 'inline' }} />)}
                      </th>
                      <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 600, cursor: 'pointer' }} onClick={() => toggleSort('roce')}>
                        ROCE {sortField === 'roce' && (sortDir === 'asc' ? <ArrowUp style={{ width: 12, height: 12, display: 'inline' }} /> : <ArrowDown style={{ width: 12, height: 12, display: 'inline' }} />)}
                      </th>
                      <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 600, cursor: 'pointer' }} onClick={() => toggleSort('netMargin')}>
                        Margin {sortField === 'netMargin' && (sortDir === 'asc' ? <ArrowUp style={{ width: 12, height: 12, display: 'inline' }} /> : <ArrowDown style={{ width: 12, height: 12, display: 'inline' }} />)}
                      </th>
                      <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 600, cursor: 'pointer' }} onClick={() => toggleSort('debtToEquity')}>
                        D/E {sortField === 'debtToEquity' && (sortDir === 'asc' ? <ArrowUp style={{ width: 12, height: 12, display: 'inline' }} /> : <ArrowDown style={{ width: 12, height: 12, display: 'inline' }} />)}
                      </th>
                      <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 600, cursor: 'pointer' }} onClick={() => toggleSort('revenueGrowth')}>
                        Rev Gr {sortField === 'revenueGrowth' && (sortDir === 'asc' ? <ArrowUp style={{ width: 12, height: 12, display: 'inline' }} /> : <ArrowDown style={{ width: 12, height: 12, display: 'inline' }} />)}
                      </th>
                      <th style={{ textAlign: 'center', padding: '12px 16px', fontWeight: 600, width: 50 }}>
                        •••
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((r) => (
                      <>
                        <tr
                          key={r.symbol}
                          onClick={() => navigateToStock(r.symbol)}
                          style={{ borderBottom: '1px solid var(--border-light)', cursor: 'pointer' }}
                          className="hover-row"
                        >
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontWeight: 600 }}>{r.symbol}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>{r.name}</div>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, background: r.score >= 50 ? 'var(--green-bg)' : r.score >= 30 ? 'var(--yellow-bg)' : 'var(--bg-2)', color: r.score >= 50 ? 'var(--green)' : r.score >= 30 ? 'var(--yellow)' : 'var(--text-2)', fontSize: 11, fontWeight: 600 }}>
                              {r.score}
                            </div>
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                            {r.currentPrice ? `₹${r.currentPrice.toFixed(2)}` : '-'}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {r.marketCap ? formatLargeNumber(r.marketCap / 1e7) + ' Cr' : '-'}
                          </td>
                          <td style={{ textAlign: 'right' }}>{r.peRatio?.toFixed(1) || '-'}</td>
                          <td style={{ textAlign: 'right', color: r.roe && r.roe >= 15 ? 'var(--green)' : 'inherit' }}>
                            {r.roe ? `${r.roe.toFixed(1)}%` : '-'}
                          </td>
                          <td style={{ textAlign: 'right', color: r.roce && r.roce >= 15 ? 'var(--green)' : 'inherit' }}>
                            {r.roce ? `${r.roce.toFixed(1)}%` : '-'}
                          </td>
                          <td style={{ textAlign: 'right', color: r.netMargin && r.netMargin >= 10 ? 'var(--green)' : 'inherit' }}>
                            {r.netMargin ? `${r.netMargin.toFixed(1)}%` : '-'}
                          </td>
                          <td style={{ textAlign: 'right', color: r.debtToEquity && r.debtToEquity < 0.5 ? 'var(--green)' : 'inherit' }}>
                            {r.debtToEquity?.toFixed(2) || '-'}
                          </td>
                          <td style={{ textAlign: 'right', color: r.revenueGrowth && r.revenueGrowth > 0 ? 'var(--green)' : r.revenueGrowth && r.revenueGrowth < 0 ? 'var(--red)' : 'inherit' }}>
                            {r.revenueGrowth ? `${r.revenueGrowth > 0 ? '+' : ''}${r.revenueGrowth.toFixed(1)}%` : '-'}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleExpand(r.symbol); }}
                              className="btn btn-ghost"
                              style={{ padding: '2px 6px', fontSize: 10 }}
                            >
                              {expandedRows.has(r.symbol) ? '−' : '+'}
                            </button>
                          </td>
                        </tr>
                        {expandedRows.has(r.symbol) && (
                          <tr>
                            <td colSpan={11} style={{ background: 'var(--bg-2)', padding: '12px 16px' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                                <div>
                                  <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 8 }}>Valuation</div>
                                  <div style={{ display: 'grid', gap: 4 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                      <span style={{ fontSize: 11 }}>P/B Ratio</span>
                                      <span style={{ fontSize: 11, fontWeight: 600 }}>{r.pbRatio?.toFixed(2) || '-'}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                      <span style={{ fontSize: 11 }}>P/S Ratio</span>
                                      <span style={{ fontSize: 11, fontWeight: 600 }}>{r.psRatio?.toFixed(2) || '-'}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                      <span style={{ fontSize: 11 }}>Div Yield</span>
                                      <span style={{ fontSize: 11, fontWeight: 600 }}>{r.dividendYield ? `${r.dividendYield.toFixed(2)}%` : '-'}</span>
                                    </div>
                                  </div>
                                </div>
                                <div>
                                  <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 8 }}>Profitability</div>
                                  <div style={{ display: 'grid', gap: 4 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                      <span style={{ fontSize: 11 }}>ROA</span>
                                      <span style={{ fontSize: 11, fontWeight: 600 }}>{r.roa ? `${r.roa.toFixed(1)}%` : '-'}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                      <span style={{ fontSize: 11 }}>Gross Margin</span>
                                      <span style={{ fontSize: 11, fontWeight: 600 }}>{r.grossMargin ? `${r.grossMargin.toFixed(1)}%` : '-'}</span>
                                    </div>
                                  </div>
                                </div>
                                <div>
                                  <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 8 }}>Leverage</div>
                                  <div style={{ display: 'grid', gap: 4 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                      <span style={{ fontSize: 11 }}>Current Ratio</span>
                                      <span style={{ fontSize: 11, fontWeight: 600 }}>{r.currentRatio?.toFixed(2) || '-'}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                      <span style={{ fontSize: 11 }}>Quick Ratio</span>
                                      <span style={{ fontSize: 11, fontWeight: 600 }}>{r.quickRatio?.toFixed(2) || '-'}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                      <span style={{ fontSize: 11 }}>Interest Coverage</span>
                                      <span style={{ fontSize: 11, fontWeight: 600 }}>{r.interestCoverage?.toFixed(1) || '-'}</span>
                                    </div>
                                  </div>
                                </div>
                                <div>
                                  <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 8 }}>Growth & Cash</div>
                                  <div style={{ display: 'grid', gap: 4 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                      <span style={{ fontSize: 11 }}>Profit Growth</span>
                                      <span style={{ fontSize: 11, fontWeight: 600 }}>{r.profitGrowth ? `${r.profitGrowth > 0 ? '+' : ''}${r.profitGrowth.toFixed(1)}%` : '-'}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                      <span style={{ fontSize: 11 }}>EPS Growth</span>
                                      <span style={{ fontSize: 11, fontWeight: 600 }}>{r.epsGrowth ? `${r.epsGrowth > 0 ? '+' : ''}${r.epsGrowth.toFixed(1)}%` : '-'}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                      <span style={{ fontSize: 11 }}>FCF (Cr)</span>
                                      <span style={{ fontSize: 11, fontWeight: 600 }}>{r.freeCashFlow ? formatLargeNumber(r.freeCashFlow / 1e7) : '-'}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              {r.matchingCriteria && r.matchingCriteria.length > 0 && (
                                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-light)' }}>
                                  <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 6 }}>Matching Criteria:</div>
                                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                    {r.matchingCriteria.map((criteria, idx) => (
                                      <div key={idx} className="badge" style={{ fontSize: 10, background: 'var(--green-bg)', color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <CheckCircle2 style={{ width: 10, height: 10 }} />
                                        {criteria}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              <div style={{ marginTop: 8, fontSize: 10, color: 'var(--text-3)' }}>
                                Data as of: {r.lastQuarter}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {showSaveModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '90%', maxWidth: 400, padding: 20 }}>
            <h3 style={{ marginBottom: 12, fontSize: 16 }}>Save Screener</h3>
            <input
              value={screenerName}
              onChange={e => setScreenerName(e.target.value)}
              placeholder="Screener name"
              className="input"
              style={{ marginBottom: 12 }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowSaveModal(false)} className="btn btn-ghost">Cancel</button>
              <button onClick={saveScreener} className="btn btn-primary" disabled={!screenerName.trim()}>Save</button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}