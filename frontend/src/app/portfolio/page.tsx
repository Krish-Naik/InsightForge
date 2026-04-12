'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  Wallet, Trash2, TrendingUp, TrendingDown, Plus, FolderPlus,
  Edit2, Check, X, BarChart2, RefreshCw, Search,
} from 'lucide-react';
import { SymbolLink } from '@/components/ui/SymbolLink';
import { marketAPI, type Quote, type SearchResult } from '@/lib/api';
import { formatCurrency, formatPercent, formatIST } from '@/lib/format';
import { searchCatalogStocks, useMarketCatalog } from '@/lib/hooks/useMarketCatalog';
import { isLocalPersistenceMode, runtimeConfig } from '@/lib/runtime';

const STORAGE_KEY = 'sp_portfolios_v3';

const SECTOR_COLORS: Record<string, string> = {
  Energy: '#3b82f6', IT: '#8b5cf6', Banking: '#22c55e', FMCG: '#eab308',
  Auto: '#f97316', Pharma: '#ec4899', Infra: '#06b6d4', Metals: '#14b8a6',
  Telecom: '#6366f1', NBFC: '#a78bfa', Realty: '#fb923c', Other: '#6b7280',
};

const SECTOR_LIST = Object.keys(SECTOR_COLORS);

const DEMO_PORTFOLIOS = [
  { id: '1', name: 'Primary Portfolio', holdings: [
    { id: '1', symbol: 'RELIANCE', name: 'Reliance Industries', qty: 50, avgPrice: 2650, sector: 'Energy' },
    { id: '2', symbol: 'TCS', name: 'Tata Consultancy Services', qty: 20, avgPrice: 3500, sector: 'IT' },
    { id: '3', symbol: 'HDFCBANK', name: 'HDFC Bank', qty: 100, avgPrice: 1550, sector: 'Banking' },
    { id: '4', symbol: 'SBIN', name: 'State Bank of India', qty: 200, avgPrice: 720, sector: 'Banking' },
    { id: '5', symbol: 'ITC', name: 'ITC Limited', qty: 500, avgPrice: 420, sector: 'FMCG' },
  ]},
  { id: '2', name: 'Swing Trades', holdings: [
    { id: '6', symbol: 'TATAMOTORS', name: 'Tata Motors', qty: 100, avgPrice: 920, sector: 'Auto' },
    { id: '7', symbol: 'TATASTEEL', name: 'Tata Steel', qty: 500, avgPrice: 148, sector: 'Metals' },
  ]},
];

const DEFAULT_PORTFOLIOS = runtimeConfig.demoMode
  ? DEMO_PORTFOLIOS
  : [{ id: '1', name: 'My Portfolio', holdings: [] }];

function load() {
  try { const s = localStorage.getItem(STORAGE_KEY); if (s) return JSON.parse(s); } catch {}
  return DEFAULT_PORTFOLIOS;
}
function save(d: any[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); }

function StatCard({ label, value, sub, colored, isPositive }: any) {
  return (
    <div className="card" style={{ padding: '12px 16px' }}>
      <div className="stat-label" style={{ marginBottom: 4 }}>{label}</div>
      <div className="mono" style={{ fontSize: 16, fontWeight: 700, color: colored ? (isPositive ? 'var(--green)' : 'var(--red)') : 'var(--text-1)', display: 'flex', alignItems: 'center', gap: 5 }}>
        {colored && (isPositive ? <TrendingUp style={{ width: 14, height: 14 }} /> : <TrendingDown style={{ width: 14, height: 14 }} />)}
        {value}
      </div>
      {sub && <div className="mono" style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export default function PortfolioPage() {
  const [portfolios, setPortfolios] = useState<any[]>(DEFAULT_PORTFOLIOS);
  const [activeId, setActiveId] = useState('1');
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ symbol: '', name: '', qty: '', avgPrice: '', sector: '' });
  const [addSearch, setAddSearch] = useState('');
  const [addResults, setAddResults] = useState<any[]>([]);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const { catalog } = useMarketCatalog();

  useEffect(() => {
    const d = load(); setPortfolios(d); setActiveId(d[0]?.id || '1');
  }, []);

  const portfolio = portfolios.find(p => p.id === activeId);
  const holdings = portfolio?.holdings || [];

  const fetchQuotes = useCallback(async (silent = false) => {
    if (!holdings.length) { setQuotes({}); return; }
    if (!silent) setLoading(true);
    try {
      const symbols = [...new Set(holdings.map((h: any) => h.symbol))];
      const data = await marketAPI.getQuotes(symbols as string[]) as Quote[];
      const m: Record<string, Quote> = {};
      data.forEach(q => { m[q.symbol] = q; });
      setQuotes(m); setLastUpdated(new Date());
    } catch {} finally { setLoading(false); }
  }, [portfolio]);

  useEffect(() => { fetchQuotes(); const t = setInterval(() => fetchQuotes(true), 30000); return () => clearInterval(t); }, [fetchQuotes]);

  useEffect(() => {
    if (addSearch.length < 2) { setAddResults([]); return; }
    const t = setTimeout(async () => {
      const local = searchCatalogStocks(catalog, addSearch, 10).map((stock) => ({ symbol: stock.symbol, name: stock.name }));
      try {
        const remote = await marketAPI.searchStocks(addSearch) as SearchResult[];
        const combined = [...(remote || []), ...local.filter((stock) => !(remote || []).find((candidate) => candidate.symbol === stock.symbol))]
          .slice(0, 6);
        setAddResults(combined);
      } catch {
        setAddResults(local.slice(0, 6));
      }
    }, 400);
    return () => clearTimeout(t);
  }, [addSearch, catalog]);

  const addHolding = async () => {
    if (!addForm.symbol || !addForm.qty || !addForm.avgPrice) return;
    const holding = {
      id: Date.now().toString(), symbol: addForm.symbol.toUpperCase(),
      name: addForm.name || addForm.symbol, qty: parseFloat(addForm.qty),
      avgPrice: parseFloat(addForm.avgPrice), sector: addForm.sector || 'Other',
    };
    const up = portfolios.map(p => p.id === activeId ? { ...p, holdings: [...p.holdings, holding] } : p);
    setPortfolios(up); save(up);
    setAddForm({ symbol: '', name: '', qty: '', avgPrice: '', sector: '' }); setShowAdd(false);
  };

  const removeHolding = (hId: string) => {
    const up = portfolios.map(p => p.id === activeId ? { ...p, holdings: p.holdings.filter((h: any) => h.id !== hId) } : p);
    setPortfolios(up); save(up);
  };

  const createPortfolio = () => {
    const id = Date.now().toString();
    const up = [...portfolios, { id, name: `Portfolio ${portfolios.length + 1}`, holdings: [] }];
    setPortfolios(up); save(up); setActiveId(id);
  };

  const deletePortfolio = (id: string) => {
    if (portfolios.length <= 1) return;
    const up = portfolios.filter(p => p.id !== id);
    setPortfolios(up); save(up); if (activeId === id) setActiveId(up[0]?.id);
  };

  const renamePortfolio = (id: string) => {
    if (!newName.trim()) return;
    const up = portfolios.map(p => p.id === id ? { ...p, name: newName.trim() } : p);
    setPortfolios(up); save(up); setEditingName(null); setNewName('');
  };

  // Calculations
  let totalInvested = 0, totalCurrent = 0;
  const sectorAlloc: Record<string, number> = {};
  holdings.forEach((h: any) => {
    const ltp = quotes[h.symbol]?.price || h.avgPrice;
    const invested = h.avgPrice * h.qty, current = ltp * h.qty;
    totalInvested += invested; totalCurrent += current;
    sectorAlloc[h.sector || 'Other'] = (sectorAlloc[h.sector || 'Other'] || 0) + current;
  });
  const totalPnL = totalCurrent - totalInvested;
  const totalPnLPct = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;
  const todayPnL = holdings.reduce((sum: number, h: any) => sum + ((quotes[h.symbol]?.change || 0) * h.qty), 0);

  return (
    <div className="page">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Wallet style={{ width: 18, height: 18, color: 'var(--primary)' }} />
          <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-1)' }}>{portfolio?.name || 'Portfolio'}</h1>
          <span className="badge badge-muted">{holdings.length} holdings</span>
          {isLocalPersistenceMode() && <span className="badge badge-muted">Local device</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {lastUpdated && <span style={{ fontSize: 10, color: 'var(--text-3)' }}>Updated {formatIST(lastUpdated)}</span>}
          <button onClick={() => fetchQuotes()} disabled={loading} className="btn btn-ghost" style={{ padding: '5px 8px' }}>
            <RefreshCw style={{ width: 13, height: 13 }} className={loading ? 'anim-spin' : ''} />
          </button>
          <button onClick={() => setShowAdd(!showAdd)} className="btn btn-primary">
            <Plus style={{ width: 13, height: 13 }} /> Add Holding
          </button>
        </div>
      </div>

      {/* Portfolio Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflowX: 'auto' }} className="no-scrollbar">
        {portfolios.map(p => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
            {editingName === p.id ? (
              <div style={{ display: 'flex', gap: 4 }}>
                <input value={newName} onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && renamePortfolio(p.id)}
                  className="input" style={{ width: 130, padding: '4px 8px', fontSize: 12 }} autoFocus />
                <button onClick={() => renamePortfolio(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)' }}><Check style={{ width: 13, height: 13 }} /></button>
                <button onClick={() => setEditingName(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)' }}><X style={{ width: 13, height: 13 }} /></button>
              </div>
            ) : (
              <button onClick={() => setActiveId(p.id)} className={`tab ${activeId === p.id ? 'tab-active' : ''}`}>
                <Wallet style={{ width: 11, height: 11 }} /> {p.name}
              </button>
            )}
            {activeId === p.id && !editingName && (
              <div style={{ display: 'flex', gap: 2, marginLeft: 2 }}>
                <button onClick={() => { setEditingName(p.id); setNewName(p.name); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 3 }}><Edit2 style={{ width: 11, height: 11 }} /></button>
                {portfolios.length > 1 && <button onClick={() => deletePortfolio(p.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 3 }}><X style={{ width: 11, height: 11 }} /></button>}
              </div>
            )}
          </div>
        ))}
        <button onClick={createPortfolio} className="tab" style={{ borderStyle: 'dashed', borderColor: 'var(--border)', marginLeft: 4 }}>
          <FolderPlus style={{ width: 12, height: 12 }} /> New
        </button>
      </div>

      {/* Add Holding Form */}
      {showAdd && (
        <div className="card anim-fade" style={{ padding: 16 }}>
          <h3 style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Add New Holding</h3>
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: 'var(--text-3)' }} />
            <input placeholder="Search symbol…" value={addSearch} onChange={e => setAddSearch(e.target.value)}
              className="input" style={{ paddingLeft: 30, fontSize: 12 }} />
            {addResults.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, marginTop: 4, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 32px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
                {addResults.map((s: any) => (
                  <button key={s.symbol} onClick={() => { setAddForm(f => ({ ...f, symbol: s.symbol, name: s.name || s.shortname || s.symbol })); setAddSearch(''); setAddResults([]); }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer' }}
                    className="search-row">
                    <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)' }}>{s.symbol}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-2)' }}>{s.name || s.shortname}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8, marginBottom: 12 }}>
            {[
              { placeholder: 'Symbol *', key: 'symbol', upper: true },
              { placeholder: 'Stock name', key: 'name', upper: false },
              { placeholder: 'Quantity *', key: 'qty', type: 'number', upper: false },
              { placeholder: 'Avg Price ₹ *', key: 'avgPrice', type: 'number', upper: false },
            ].map(({ placeholder, key, type, upper }) => (
              <input key={key} placeholder={placeholder} type={type || 'text'} className="input" style={{ fontSize: 12 }}
                value={(addForm as any)[key]}
                onChange={e => setAddForm(f => ({ ...f, [key]: upper ? e.target.value.toUpperCase() : e.target.value }))} />
            ))}
            <select value={addForm.sector} onChange={e => setAddForm(f => ({ ...f, sector: e.target.value }))} className="input" style={{ fontSize: 12 }}>
              <option value="">Sector</option>
              {SECTOR_LIST.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => { setShowAdd(false); setAddForm({ symbol: '', name: '', qty: '', avgPrice: '', sector: '' }); }} className="btn btn-ghost">Cancel</button>
            <button onClick={addHolding} disabled={!addForm.symbol || !addForm.qty || !addForm.avgPrice} className="btn btn-primary">Add Holding</button>
          </div>
          <style>{`.search-row:hover { background: var(--surface-2) !important; }`}</style>
        </div>
      )}

      {holdings.length > 0 ? (
        <>
          {/* Summary Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
            <StatCard label="Invested" value={formatCurrency(totalInvested)} />
            <StatCard label="Current Value" value={formatCurrency(totalCurrent)} />
            <StatCard label="Total P&L" value={`${totalPnL >= 0 ? '+' : ''}${formatCurrency(totalPnL)}`} colored isPositive={totalPnL >= 0} />
            <StatCard label="Returns" value={formatPercent(totalPnLPct)} colored isPositive={totalPnLPct >= 0} />
            <StatCard label="Day P&L" value={`${todayPnL >= 0 ? '+' : ''}${formatCurrency(todayPnL)}`} colored isPositive={todayPnL >= 0} />
          </div>

          {/* Sector Allocation */}
          {totalCurrent > 0 && (
            <div className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Sector Allocation</div>
              </div>
              <div style={{ height: 8, borderRadius: 9, overflow: 'hidden', display: 'flex', marginBottom: 12 }}>
                {Object.entries(sectorAlloc).map(([sec, val]) => (
                  <div key={sec} style={{ height: '100%', width: `${(val / totalCurrent) * 100}%`, background: SECTOR_COLORS[sec] || SECTOR_COLORS.Other }} title={`${sec}: ${((val / totalCurrent) * 100).toFixed(1)}%`} />
                ))}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 20px' }}>
                {Object.entries(sectorAlloc).map(([sec, val]) => (
                  <div key={sec} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: SECTOR_COLORS[sec] || SECTOR_COLORS.Other, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: 'var(--text-2)' }}>{sec}</span>
                    <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-1)' }}>{((val / totalCurrent) * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Holdings Table */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div className="card-header"><Wallet style={{ width: 14, height: 14, color: 'var(--primary)' }} /><h3>Holdings</h3></div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Stock</th>
                    <th style={{ textAlign: 'right' }}>Qty</th>
                    <th style={{ textAlign: 'right' }}>Avg Cost</th>
                    <th style={{ textAlign: 'right' }}>LTP</th>
                    <th style={{ textAlign: 'right' }}>Curr. Val</th>
                    <th style={{ textAlign: 'right' }}>P&L</th>
                    <th style={{ textAlign: 'right' }}>P&L%</th>
                    <th style={{ textAlign: 'right' }}>Day Chg</th>
                    <th style={{ textAlign: 'center' }}>Chart</th>
                    <th style={{ width: 32 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.map((h: any) => {
                    const q = quotes[h.symbol];
                    const ltp = q?.price || h.avgPrice;
                    const pnl = (ltp - h.avgPrice) * h.qty;
                    const pnlPct = ((ltp - h.avgPrice) / h.avgPrice) * 100;
                    const currVal = ltp * h.qty;
                    const isUp = pnl >= 0;
                    const dayChg = (q?.change || 0) * h.qty;
                    return (
                      <tr key={h.id}>
                        <td>
                          <SymbolLink symbol={h.symbol} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 } as any}>
                            <div className="mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)' }}>{h.symbol}</div>
                          </SymbolLink>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 1 }}>
                            <span style={{ fontSize: 10, color: 'var(--text-2)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.name}</span>
                            {h.sector && <span className="badge badge-muted">{h.sector}</span>}
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}><span className="mono" style={{ fontSize: 12, color: 'var(--text-1)' }}>{h.qty}</span></td>
                        <td style={{ textAlign: 'right' }}><span className="mono" style={{ fontSize: 11, color: 'var(--text-2)' }}>{formatCurrency(h.avgPrice)}</span></td>
                        <td style={{ textAlign: 'right' }}><span className="mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)' }}>{formatCurrency(ltp)}</span></td>
                        <td style={{ textAlign: 'right' }}><span className="mono" style={{ fontSize: 11, color: 'var(--text-1)' }}>{formatCurrency(currVal)}</span></td>
                        <td style={{ textAlign: 'right' }}>
                          <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: isUp ? 'var(--green)' : 'var(--red)' }}>
                            {isUp ? '+' : ''}{formatCurrency(pnl)}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: isUp ? 'var(--green)' : 'var(--red)' }}>
                            {formatPercent(pnlPct)}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span className="mono" style={{ fontSize: 11, color: dayChg >= 0 ? 'var(--green)' : 'var(--red)' }}>
                            {q ? `${dayChg >= 0 ? '+' : ''}${formatCurrency(dayChg)}` : '—'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <SymbolLink symbol={h.symbol}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 5, background: 'var(--primary-dim)', color: 'var(--primary)', cursor: 'pointer' }}>
                              <BarChart2 style={{ width: 11, height: 11 }} />
                            </span>
                          </SymbolLink>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button onClick={() => removeHolding(h.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', opacity: 0, transition: 'opacity 0.1s' }} className="remove-btn-p">
                            <Trash2 style={{ width: 13, height: 13 }} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <style>{`tr:hover .remove-btn-p { opacity: 1 !important; } .remove-btn-p:hover { color: var(--red) !important; }`}</style>
          </div>
        </>
      ) : (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <Wallet style={{ width: 40, height: 40, color: 'var(--text-3)', margin: '0 auto 12px', opacity: 0.3 }} />
          <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)', marginBottom: 4 }}>No holdings yet</p>
          <p style={{ fontSize: 12, color: 'var(--text-2)' }}>Click "Add Holding" to track your investments</p>
        </div>
      )}
    </div>
  );
}
