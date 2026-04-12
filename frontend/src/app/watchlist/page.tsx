'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  Star, Plus, X, Search, BarChart2, Edit2, Check,
  FolderPlus, Loader2, RefreshCw, ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown,
} from 'lucide-react';
import { SymbolLink } from '@/components/ui/SymbolLink';
import { marketAPI, type Quote, type SearchResult } from '@/lib/api';
import { formatCurrency, formatPercent, formatLargeNumber, formatIST } from '@/lib/format';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { searchCatalogStocks, useMarketCatalog } from '@/lib/hooks/useMarketCatalog';
import { isLocalPersistenceMode, runtimeConfig } from '@/lib/runtime';

const STORAGE_KEY = 'sp_watchlists_v3';

const DEMO_WATCHLISTS = [
  { id: '1', name: 'My Watchlist', stocks: [
    { symbol: 'RELIANCE', name: 'Reliance Industries', exchange: 'NSE' },
    { symbol: 'TCS', name: 'Tata Consultancy Services', exchange: 'NSE' },
    { symbol: 'HDFCBANK', name: 'HDFC Bank', exchange: 'NSE' },
    { symbol: 'INFY', name: 'Infosys', exchange: 'NSE' },
    { symbol: 'ICICIBANK', name: 'ICICI Bank', exchange: 'NSE' },
    { symbol: 'SBIN', name: 'State Bank of India', exchange: 'NSE' },
    { symbol: 'BHARTIARTL', name: 'Bharti Airtel', exchange: 'NSE' },
    { symbol: 'ITC', name: 'ITC Limited', exchange: 'NSE' },
  ]},
  { id: '2', name: 'Banking', stocks: [
    { symbol: 'HDFCBANK', name: 'HDFC Bank', exchange: 'NSE' },
    { symbol: 'ICICIBANK', name: 'ICICI Bank', exchange: 'NSE' },
    { symbol: 'SBIN', name: 'State Bank of India', exchange: 'NSE' },
    { symbol: 'KOTAKBANK', name: 'Kotak Mahindra Bank', exchange: 'NSE' },
    { symbol: 'AXISBANK', name: 'Axis Bank', exchange: 'NSE' },
  ]},
  { id: '3', name: 'Momentum', stocks: [
    { symbol: 'TATAMOTORS', name: 'Tata Motors', exchange: 'NSE' },
    { symbol: 'TATASTEEL', name: 'Tata Steel', exchange: 'NSE' },
    { symbol: 'ADANIENT', name: 'Adani Enterprises', exchange: 'NSE' },
    { symbol: 'BAJFINANCE', name: 'Bajaj Finance', exchange: 'NSE' },
  ]},
];

const DEFAULT_WATCHLISTS = runtimeConfig.demoMode
  ? DEMO_WATCHLISTS
  : [{ id: '1', name: 'My Watchlist', stocks: [] }];

function load() {
  try { const s = localStorage.getItem(STORAGE_KEY); if (s) return JSON.parse(s); } catch {}
  return DEFAULT_WATCHLISTS;
}
function save(d: any[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); }

export default function WatchlistPage() {
  const [lists, setLists] = useState<any[]>(DEFAULT_WATCHLISTS);
  const [activeId, setActiveId] = useState('1');
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const { catalog } = useMarketCatalog();

  // Load from localStorage on mount
  useEffect(() => {
    const d = load();
    setLists(d);
    setActiveId(d[0]?.id || '1');
  }, []);

  const activeList = lists.find(w => w.id === activeId);
  const debouncedSearch = useDebounce(searchQuery, 400);

  const fetchQuotes = useCallback(async (silent = false) => {
    if (!activeList?.stocks?.length) { setQuotes({}); return; }
    if (!silent) setQuotesLoading(true);
    try {
      const symbols = activeList.stocks.map((s: any) => s.symbol);
      const data = await marketAPI.getQuotes(symbols) as Quote[];
      const m: Record<string, Quote> = {};
      data.forEach(q => { m[q.symbol] = q; });
      setQuotes(m); setLastUpdated(new Date());
    } catch {} finally { setQuotesLoading(false); }
  }, [activeList]);

  useEffect(() => { fetchQuotes(); const t = setInterval(() => fetchQuotes(true), 30000); return () => clearInterval(t); }, [fetchQuotes]);

  useEffect(() => {
    if (!debouncedSearch || debouncedSearch.length < 1) { setSearchResults([]); return; }
    const existing = new Set(activeList?.stocks?.map((s: any) => s.symbol) || []);
    const local = searchCatalogStocks(catalog, debouncedSearch, 12)
      .filter((stock) => !existing.has(stock.symbol))
      .map((stock) => ({ symbol: stock.symbol, name: stock.name, exchange: stock.exchange }));
    if (debouncedSearch.length >= 2) {
      setSearching(true);
      marketAPI.searchStocks(debouncedSearch)
        .then((remote: SearchResult[]) => {
          const filtered = (remote || []).filter((result) => !existing.has(result.symbol));
          const combined = [...filtered, ...local.filter((localResult) => !filtered.find((result) => result.symbol === localResult.symbol))].slice(0, 10);
          setSearchResults(combined.length ? combined : local.slice(0, 8));
        })
        .catch(() => setSearchResults(local.slice(0, 8)))
        .finally(() => setSearching(false));
    } else { setSearchResults(local.slice(0, 8)); }
  }, [debouncedSearch, activeList]);

  const addStock = (stock: any) => {
    const up = lists.map(w => w.id === activeId
      ? { ...w, stocks: [...w.stocks, { symbol: stock.symbol, name: stock.name || stock.shortname || stock.symbol, exchange: stock.exchange || 'NSE' }] } : w);
    setLists(up); save(up); setSearchQuery(''); setSearchResults([]); setShowSearch(false);
  };
  const removeStock = (symbol: string) => {
    const up = lists.map(w => w.id === activeId ? { ...w, stocks: w.stocks.filter((s: any) => s.symbol !== symbol) } : w);
    setLists(up); save(up);
    setQuotes(prev => { const n = { ...prev }; delete n[symbol]; return n; });
  };
  const createList = () => {
    const id = Date.now().toString();
    const up = [...lists, { id, name: `Watchlist ${lists.length + 1}`, stocks: [] }];
    setLists(up); save(up); setActiveId(id);
  };
  const deleteList = (id: string) => {
    if (lists.length <= 1) return;
    const up = lists.filter(w => w.id !== id);
    setLists(up); save(up); if (activeId === id) setActiveId(up[0]?.id);
  };
  const renameList = (id: string) => {
    if (!newName.trim()) return;
    const up = lists.map(w => w.id === id ? { ...w, name: newName.trim() } : w);
    setLists(up); save(up); setEditingName(null); setNewName('');
  };

  const stocks = activeList?.stocks || [];
  const quotedStocks = stocks.filter((s: any) => (quotes[s.symbol]?.price ?? 0) > 0);
  const advancers = quotedStocks.filter((s: any) => (quotes[s.symbol]?.changePercent ?? 0) > 0).length;
  const decliners = quotedStocks.filter((s: any) => (quotes[s.symbol]?.changePercent ?? 0) < 0).length;

  return (
    <div className="page">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Star style={{ width: 18, height: 18, color: 'var(--amber)' }} />
          <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-1)' }}>{activeList?.name || 'Watchlist'}</h1>
          <span className="badge badge-muted">{stocks.length}</span>
          {isLocalPersistenceMode() && <span className="badge badge-muted">Local device</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {lastUpdated && <span style={{ fontSize: 10, color: 'var(--text-3)' }}>Updated {formatIST(lastUpdated)}</span>}
          <button onClick={() => fetchQuotes()} disabled={quotesLoading} className="btn btn-ghost" style={{ padding: '5px 8px' }}>
            <RefreshCw style={{ width: 13, height: 13 }} className={quotesLoading ? 'anim-spin' : ''} />
          </button>
          <button onClick={() => { setShowSearch(!showSearch); setSearchQuery(''); }} className="btn btn-primary">
            <Plus style={{ width: 13, height: 13 }} /> Add Stock
          </button>
        </div>
      </div>

      {/* Watchlist Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflowX: 'auto' }} className="no-scrollbar">
        {lists.map(w => (
          <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
            {editingName === w.id ? (
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <input value={newName} onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && renameList(w.id)}
                  className="input" style={{ width: 120, padding: '4px 8px', fontSize: 12 }} autoFocus />
                <button onClick={() => renameList(w.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)' }}><Check style={{ width: 13, height: 13 }} /></button>
                <button onClick={() => setEditingName(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)' }}><X style={{ width: 13, height: 13 }} /></button>
              </div>
            ) : (
              <button onClick={() => setActiveId(w.id)} className={`tab ${activeId === w.id ? 'tab-active' : ''}`}>
                <Star style={{ width: 11, height: 11 }} /> {w.name}
                {activeId === w.id && <span style={{ fontSize: 9, opacity: 0.6, marginLeft: 2 }}>{w.stocks.length}</span>}
              </button>
            )}
            {activeId === w.id && !editingName && (
              <div style={{ display: 'flex', gap: 2, marginLeft: 2 }}>
                <button onClick={() => { setEditingName(w.id); setNewName(w.name); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 4 }}><Edit2 style={{ width: 11, height: 11 }} /></button>
                {lists.length > 1 && <button onClick={() => deleteList(w.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 4 }}><X style={{ width: 11, height: 11 }} /></button>}
              </div>
            )}
          </div>
        ))}
        <button onClick={createList} className="tab" style={{ borderStyle: 'dashed', borderColor: 'var(--border)', marginLeft: 4 }}>
          <FolderPlus style={{ width: 12, height: 12 }} /> New
        </button>
      </div>

      {/* Breadth bar */}
      {quotedStocks.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
            <TrendingUp style={{ width: 12, height: 12, color: 'var(--green)' }} />
            <span style={{ color: 'var(--green)', fontWeight: 700 }} className="mono">{advancers} Up</span>
            <span style={{ color: 'var(--text-3)' }}>/</span>
            <TrendingDown style={{ width: 12, height: 12, color: 'var(--red)' }} />
            <span style={{ color: 'var(--red)', fontWeight: 700 }} className="mono">{decliners} Down</span>
          </div>
          <div style={{ flex: 1, height: 4, borderRadius: 9, background: 'var(--surface-2)', overflow: 'hidden', display: 'flex' }}>
            {advancers > 0 && <div style={{ height: '100%', background: 'var(--green)', width: `${(advancers / quotedStocks.length) * 100}%`, transition: 'width 0.3s' }} />}
            {decliners > 0 && <div style={{ height: '100%', background: 'var(--red)', width: `${(decliners / quotedStocks.length) * 100}%`, transition: 'width 0.3s' }} />}
          </div>
        </div>
      )}

      {/* Search panel */}
      {showSearch && (
        <div className="card p-4 anim-fade" style={{ padding: 12 }}>
          <div style={{ position: 'relative', marginBottom: 8 }}>
            <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--text-3)' }} />
            <input type="text" placeholder="Search by symbol or name…" value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)} className="input" style={{ paddingLeft: 32 }} autoFocus />
            {searching && <Loader2 style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--primary)' }} className="anim-spin" />}
          </div>
          {searchResults.length > 0 ? (
            <div style={{ maxHeight: 200, overflowY: 'auto' }} className="scrollbar-thin">
              {searchResults.map((s: any) => (
                <button key={s.symbol} onClick={() => addStock(s)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 8px', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 6 }}
                  className="hover-row">
                  <div style={{ textAlign: 'left' }}>
                    <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)' }}>{s.symbol}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-2)', marginLeft: 8 }}>{s.name || s.shortname}</span>
                  </div>
                  <Plus style={{ width: 14, height: 14, color: 'var(--primary)' }} />
                </button>
              ))}
            </div>
          ) : searchQuery && !searching ? (
            <p style={{ fontSize: 12, color: 'var(--text-3)', padding: '4px 8px' }}>No results for "{searchQuery}"</p>
          ) : !searchQuery ? (
            <p style={{ fontSize: 11, color: 'var(--text-3)', padding: '4px 8px' }}>Type to search NSE/BSE stocks</p>
          ) : null}
          <style>{`.hover-row:hover { background: var(--surface-2) !important; }`}</style>
        </div>
      )}

      {/* Table */}
      {stocks.length > 0 ? (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Symbol / Name</th>
                  <th style={{ textAlign: 'right' }}>LTP</th>
                  <th style={{ textAlign: 'right' }}>Change</th>
                  <th style={{ textAlign: 'right' }}>Volume</th>
                  <th style={{ textAlign: 'right' }}>Day Range</th>
                  <th style={{ textAlign: 'right' }}>52W High</th>
                  <th style={{ textAlign: 'center' }}>Chart</th>
                  <th style={{ width: 32 }}></th>
                </tr>
              </thead>
              <tbody>
                {quotesLoading && !Object.keys(quotes).length
                  ? stocks.map((s: any) => (
                    <tr key={s.symbol}>
                      <td><div className="skeleton h-4 w-24 rounded" /> <div className="skeleton h-3 w-32 rounded mt-1" /></td>
                      {[...Array(6)].map((_, i) => <td key={i}><div className="skeleton h-4 w-16 rounded ml-auto" /></td>)}
                      <td></td>
                    </tr>
                  ))
                  : stocks.map((stock: any) => {
                    const q = quotes[stock.symbol];
                    const up = (q?.changePercent ?? 0) >= 0;
                    return (
                      <tr key={stock.symbol}>
                        <td>
                          <SymbolLink symbol={stock.symbol} exchange={stock.exchange}
                            className="text-left" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 } as any}>
                            <div className="mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)' }}>{stock.symbol}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-2)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stock.name}</div>
                          </SymbolLink>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: q?.price > 0 ? 'var(--text-1)' : 'var(--text-3)' }}>
                            {q?.price > 0 ? formatCurrency(q.price) : '—'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {q?.price > 0 ? (
                            <div className="mono" style={{ fontSize: 12, fontWeight: 700, color: up ? 'var(--green)' : 'var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 2 }}>
                              {up ? <ArrowUpRight style={{ width: 12, height: 12 }} /> : <ArrowDownRight style={{ width: 12, height: 12 }} />}
                              {formatPercent(q.changePercent)}
                            </div>
                          ) : <span style={{ color: 'var(--text-3)', fontSize: 12 }}>—</span>}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span className="mono" style={{ fontSize: 11, color: 'var(--text-2)' }}>{q?.volume > 0 ? formatLargeNumber(q.volume) : '—'}</span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {q?.dayHigh > 0
                            ? <span className="mono" style={{ fontSize: 11, color: 'var(--text-2)' }}>{formatCurrency(q.dayLow)} – {formatCurrency(q.dayHigh)}</span>
                            : <span style={{ color: 'var(--text-3)', fontSize: 11 }}>—</span>}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span className="mono" style={{ fontSize: 11, color: 'var(--text-2)' }}>{q?.high52w > 0 ? formatCurrency(q.high52w) : '—'}</span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <SymbolLink symbol={stock.symbol} exchange={stock.exchange}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, background: 'var(--primary-dim)', color: 'var(--primary)', cursor: 'pointer' }}>
                              <BarChart2 style={{ width: 13, height: 13 }} />
                            </span>
                          </SymbolLink>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button onClick={() => removeStock(stock.symbol)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', opacity: 0, transition: 'opacity 0.1s' }}
                            className="remove-btn">
                            <X style={{ width: 14, height: 14 }} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          <style>{`
            tr:hover .remove-btn { opacity: 1 !important; }
            .remove-btn:hover { color: var(--red) !important; }
          `}</style>
        </div>
      ) : (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <Star style={{ width: 40, height: 40, color: 'var(--text-3)', margin: '0 auto 12px', opacity: 0.3 }} />
          <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)', marginBottom: 4 }}>Watchlist is empty</p>
          <p style={{ fontSize: 12, color: 'var(--text-2)' }}>Click "Add Stock" to start tracking</p>
        </div>
      )}
    </div>
  );
}
