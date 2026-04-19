'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FolderPlus,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Star,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
  ChevronDown,
} from 'lucide-react';
import { SymbolLink } from '@/components/ui/SymbolLink';
import { EmptyPanel, MetricTile, PageHeader, SectionCard, TrendBadge } from '@/components/ui/page-kit';
import { marketAPI, portfolioAPI, type Quote, type SearchResult, type StockStory, type SupportResistanceLevel } from '@/lib/api';
import { formatCurrency, formatPercent, formatIST } from '@/lib/format';
import { searchCatalogStocks, useMarketCatalog } from '@/lib/hooks/useMarketCatalog';
import { useDebounce } from '@/lib/hooks/useDebounce';

const STORAGE_KEY = 'sp_watchlists_v9';

type WatchlistStock = {
  symbol: string;
  name: string;
  exchange: string;
};

type WatchlistEntry = {
  id: string;
  name: string;
  stocks: WatchlistStock[];
};

const DEFAULT_PRIMARY_STOCKS: WatchlistStock[] = [
  { symbol: 'RELIANCE', name: 'Reliance Industries', exchange: 'NSE' },
  { symbol: 'TCS', name: 'Tata Consultancy', exchange: 'NSE' },
  { symbol: 'HDFCBANK', name: 'HDFC Bank', exchange: 'NSE' },
  { symbol: 'INFY', name: 'Infosys', exchange: 'NSE' },
  { symbol: 'AXISBANK', name: 'Axis Bank', exchange: 'NSE' },
  { symbol: 'SBIN', name: 'State Bank of India', exchange: 'NSE' },
  { symbol: 'IRCTC', name: 'IRCTC', exchange: 'NSE' },
  { symbol: 'COFORGE', name: 'Coforge', exchange: 'NSE' },
  { symbol: 'ADANIENSOL', name: 'Adani Energy', exchange: 'NSE' },
  { symbol: 'DELHIVERY', name: 'Delhivery', exchange: 'NSE' },
];

function loadLists(): WatchlistEntry[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.stocks?.length > 0) {
        return parsed;
      }
    }
  } catch {
  }
  return [{ id: 'primary', name: 'Primary Watchlist', stocks: [...DEFAULT_PRIMARY_STOCKS] }];
}

function saveLists(lists: WatchlistEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lists));
}

export default function WatchlistPage() {
  const { catalog } = useMarketCatalog();
  const [lists, setLists] = useState<WatchlistEntry[]>(loadLists);
  const [activeIdx, setActiveIdx] = useState(0);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [draftName, setDraftName] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [expandedStock, setExpandedStock] = useState<string | null>(null);
  const [stockStory, setStockStory] = useState<Record<string, StockStory>>({});
  const [stockSR, setStockSR] = useState<Record<string, SupportResistanceLevel>>({});
  const [loadingInsights, setLoadingInsights] = useState<string | null>(null);
  const [portfolios, setPortfolios] = useState<{_id: string; name: string; holdings: any[]}[]>([]);
  const [showPortfolioMenu, setShowPortfolioMenu] = useState<string | null>(null);
  const debouncedSearch = useDebounce(search, 300);

  const activeList = useMemo(() => lists[activeIdx] || null, [lists, activeIdx]);

  // Reset expanded stock when switching watchlists
  useEffect(() => {
    setExpandedStock(null);
  }, [activeIdx]);

  const fetchQuotes = useCallback(async () => {
    const allSymbols = lists.flatMap((l) => l.stocks.map((s) => s.symbol));
    const uniqueSymbols = [...new Set(allSymbols)];
    if (!uniqueSymbols.length) {
      setQuotes({});
      return;
    }
    setLoadingQuotes(true);
    try {
      const data = await marketAPI.getQuotes(uniqueSymbols);
      setQuotes(Object.fromEntries(data.map((q) => [q.symbol, q])));
      setLastUpdated(new Date());
    } finally {
      setLoadingQuotes(false);
    }
  }, [lists]);

  useEffect(() => {
    fetchQuotes();
  }, [fetchQuotes]);

  useEffect(() => {
    portfolioAPI.getAll()
      .then(setPortfolios)
      .catch(() => setPortfolios([]));
  }, []);

  const loadStockInsights = useCallback(async (symbol: string) => {
    // Only show loading if we haven't loaded this stock yet or if it's the same stock
    const hasExisting = stockStory[symbol] || stockSR[symbol];
    if (hasExisting && loadingInsights !== symbol) return;
    
    setLoadingInsights(symbol);
    try {
      const [story, sr] = await Promise.all([
        marketAPI.getStockStory(symbol).catch(() => null),
        marketAPI.getRadarSR(symbol).catch(() => null),
      ]);
      if (story && story.sourceMode === 'ai') {
        setStockStory((prev) => ({ ...prev, [symbol]: story }));
      }
      if (sr) setStockSR((prev) => ({ ...prev, [symbol]: sr }));
    } catch {
    }
    setLoadingInsights(null);
  }, [stockStory, stockSR, loadingInsights]);

  useEffect(() => {
    if (!debouncedSearch.trim() || !catalog) {
      setSearchResults([]);
      return;
    }
    const existing = new Set(lists.flatMap((l) => l.stocks.map((s) => s.symbol)));
    const local = searchCatalogStocks(catalog, debouncedSearch, 10)
      .filter((s) => !existing.has(s.symbol))
      .map((s) => ({
        symbol: s.symbol,
        name: s.name,
        exchange: s.exchange,
        type: 'EQUITY' as const,
        sectors: s.sectors,
        inNifty50: s.inNifty50,
      }));
    marketAPI.searchStocks(debouncedSearch)
      .then((remote) => {
        const filtered = remote.filter((r) => !existing.has(r.symbol));
        const merged = [...filtered, ...local.filter((l) => !filtered.some((f) => f.symbol === l.symbol))].slice(0, 10);
        setSearchResults(merged);
      })
      .catch(() => setSearchResults(local));
  }, [debouncedSearch, catalog, lists]);

  const addStockToList = (result: SearchResult, listIdx: number) => {
    const newLists = lists.map((list, idx) => {
      if (idx !== listIdx) return list;
      if (list.stocks.some((s) => s.symbol === result.symbol)) return list;
      return { ...list, stocks: [...list.stocks, { symbol: result.symbol, name: result.name || result.symbol, exchange: result.exchange || 'NSE' }] };
    });
    setLists(newLists);
    saveLists(newLists);
    setSearch('');
    setSearchResults([]);
    setShowSearch(false);
  };

  const removeStockFromList = (symbol: string, listIdx: number) => {
    const newLists = lists.map((list, idx) => idx !== listIdx ? list : { ...list, stocks: list.stocks.filter((s) => s.symbol !== symbol) });
    setLists(newLists);
    saveLists(newLists);
    setQuotes((q) => { const n = {...q}; delete n[symbol]; return n; });
  };

  const addToPortfolio = async (portfolioId: string, stock: WatchlistStock) => {
    try {
      await portfolioAPI.addHolding(portfolioId, {
        symbol: stock.symbol,
        name: stock.name,
        exchange: stock.exchange,
        qty: 1,
        avgPrice: quotes[stock.symbol]?.price || 0,
      });
      setShowPortfolioMenu(null);
    } catch (err) {
      console.error('Failed to add to portfolio:', err);
    }
  };

  const createList = () => {
    const newId = 'list_' + Date.now();
    const newLists = [...lists, { id: newId, name: 'Watchlist ' + (lists.length + 1), stocks: [] }];
    setLists(newLists);
    saveLists(newLists);
    setActiveIdx(newLists.length - 1);
  };

  const deleteList = (idx: number) => {
    if (lists.length <= 1) return;
    const newLists = lists.filter((_, i) => i !== idx);
    setLists(newLists);
    saveLists(newLists);
    if (activeIdx >= idx) setActiveIdx(Math.max(0, activeIdx - 1));
  };

  const renameList = (idx: number) => {
    if (!draftName.trim()) return;
    const newLists = lists.map((list, i) => i !== idx ? list : { ...list, name: draftName.trim() });
    setLists(newLists);
    saveLists(newLists);
    setEditingIdx(null);
    setDraftName('');
  };

  const trackedQuotes = useMemo(() => (activeList?.stocks || []).map((s) => quotes[s.symbol]).filter(Boolean), [activeList, quotes]);
  const advancers = trackedQuotes.filter((q) => (q?.changePercent || 0) > 0).length;
  const decliners = trackedQuotes.filter((q) => (q?.changePercent || 0) < 0).length;
  const avgMove = trackedQuotes.length ? trackedQuotes.reduce((s, q) => s + (q.changePercent || 0), 0) / trackedQuotes.length : 0;

  return (
    <div className="page">
      <PageHeader
        kicker="Watchlist"
        title="Market Watchlist"
        description="Track stocks with AI insights"
        actions={
          <div style={{ display: 'flex', gap: 10 }}>
            {lastUpdated && <span className="topbar-pill">Updated {formatIST(lastUpdated)}</span>}
            <button onClick={fetchQuotes} disabled={loadingQuotes} className="btn btn-ghost">
              <RefreshCw style={{ width: 14, height: 14 }} className={loadingQuotes ? 'anim-spin' : ''} />
            </button>
          </div>
        }
      />
      <div className="metric-strip-grid">
        <MetricTile label={activeList?.name || 'Watchlist'} value={activeList?.stocks.length || 0} tone="primary" icon={Star} subtext="stocks" />
        <MetricTile label="Advancers" value={advancers} tone="positive" icon={TrendingUp} />
        <MetricTile label="Decliners" value={decliners} tone="negative" icon={TrendingDown} />
        <MetricTile label="Avg %" value={formatPercent(avgMove)} tone={avgMove >= 0 ? 'positive' : 'negative'} icon={Star} />
      </div>
      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 12 }}>
        {lists.map((list, idx) => {
          const isActive = activeIdx === idx;
          return (
            <div key={list.id} onClick={() => setActiveIdx(idx)} className="list-card" style={{ minWidth: 160, padding: 10, cursor: 'pointer', borderColor: isActive ? 'var(--primary)' : undefined, background: isActive ? 'rgba(217,154,79,0.1)' : undefined, flexShrink: 0 }}>
              {editingIdx === idx ? (
                <div onClick={(e) => e.stopPropagation()}>
                  <input value={draftName} onChange={(e) => setDraftName(e.target.value)} className="input" style={{ marginBottom: 6 }} />
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => renameList(idx)} className="btn btn-primary" style={{ fontSize: 10 }}>Save</button>
                    <button onClick={() => setEditingIdx(null)} className="btn btn-ghost" style={{ fontSize: 10 }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 12 }}>{list.name}</span>
                    {isActive && <TrendBadge tone="primary">Active</TrendBadge>}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={(e) => { e.stopPropagation(); setActiveIdx(idx); setShowSearch(true); }} className="btn btn-primary" style={{ fontSize: 10, flex: 1 }}>
                      <Plus style={{ width: 10, height: 10 }} /> Add
                    </button>
                    {idx >= 0 && (
                      <>
                        <button onClick={(e) => { e.stopPropagation(); setEditingIdx(idx); setDraftName(list.name); }} className="btn btn-ghost" style={{ padding: '4px 6px' }}>
                          <Pencil style={{ width: 10, height: 10 }} />
                        </button>
                        {lists.length > 1 && (
                          <button onClick={(e) => { e.stopPropagation(); deleteList(idx); }} className="btn btn-danger" style={{ padding: '4px 6px' }}>
                            <Trash2 style={{ width: 10, height: 10 }} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <button onClick={createList} className="btn btn-ghost" style={{ minWidth: 40, alignSelf: 'center', flexShrink: 0 }}>
          <Plus style={{ width: 16, height: 16 }} />
        </button>
      </div>
      <SectionCard title={activeList?.name || 'Stocks'} icon={Star}>
        {showSearch && (
          <div style={{ marginBottom: 12, padding: 10, background: 'var(--bg-2)', borderRadius: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 11 }}>Add to: <strong>{lists[activeIdx]?.name}</strong></span>
              <button onClick={() => setShowSearch(false)}><X style={{ width: 14, height: 14 }} /></button>
            </div>
            <div style={{ position: 'relative' }}>
              <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 12, height: 12, color: 'var(--text-3)' }} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} className="input" style={{ paddingLeft: 30 }} placeholder="Search..." />
            </div>
            {searchResults.length > 0 && (
              <div style={{ marginTop: 8, maxHeight: 150, overflowY: 'auto' }}>
                {searchResults.map((r) => (
                  <button key={r.symbol} onClick={() => addStockToList(r, activeIdx)} className="list-card" style={{ padding: 8, marginBottom: 4, cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 11 }}>{r.symbol}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{r.name}</div>
                      </div>
                      <Plus style={{ width: 12, height: 12 }} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {activeList?.stocks?.length ? (
            activeList.stocks.map((s) => {
              const q = quotes[s.symbol];
              const pos = (q?.changePercent || 0) >= 0;
              const isExpanded = expandedStock === s.symbol;
              const story = stockStory[s.symbol];
              const sr = stockSR[s.symbol];
              return (
                <div key={s.symbol} className="list-card" style={{ padding: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 10, background: pos ? 'rgba(34,139,34,0.04)' : 'rgba(220,20,60,0.04)' }}>
                    <SymbolLink symbol={s.symbol} exchange={s.exchange} style={{ background: 'none', border: 'none', padding: 0 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 12 }}>{s.symbol}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{s.name}</div>
                      </div>
                    </SymbolLink>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 600, fontSize: 12 }}>{q ? formatCurrency(q.price) : '—'}</div>
                        <div style={{ fontSize: 10, color: pos ? 'var(--green)' : 'var(--red)' }}>{q ? formatPercent(q.changePercent) : '—'}</div>
                      </div>
                      {portfolios.length > 0 && (
                        <div style={{ position: 'relative' }}>
                          <button 
                            onClick={() => setShowPortfolioMenu(showPortfolioMenu === s.symbol ? null : s.symbol)} 
                            className="btn btn-primary"
                            style={{ 
                              padding: '4px 10px', 
                              fontSize: 10,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4
                            }}
                          >
                            <Plus style={{ width: 10, height: 10 }} />
                            Portfolio
                          </button>
                          {showPortfolioMenu === s.symbol && (
                            <div style={{ 
                              position: 'absolute', 
                              right: 0, 
                              top: '100%', 
                              marginTop: 4,
                              background: 'var(--bg-2)', 
                              borderRadius: 6, 
                              padding: 8, 
                              zIndex: 100, 
                              display: 'flex', 
                              flexDirection: 'column', 
                              gap: 4, 
                              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                              minWidth: 140,
                              border: '1px solid var(--border)'
                            }}>
                              <div style={{ fontSize: 9, color: 'var(--text-3)', marginBottom: 4, textTransform: 'uppercase', fontWeight: 600 }}>
                                Select Portfolio
                              </div>
                              {portfolios.map(p => (
                                <button 
                                  key={p._id} 
                                  onClick={() => addToPortfolio(p._id, s)} 
                                  className="btn btn-ghost" 
                                  style={{ 
                                    fontSize: 11, 
                                    justifyContent: 'flex-start', 
                                    padding: '6px 8px',
                                    borderRadius: 4,
                                    background: 'transparent'
                                  }}
                                >
                                  <Plus style={{ width: 10, height: 10, color: 'var(--green)' }} />
                                  {p.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      <button onClick={() => { setExpandedStock(isExpanded ? null : s.symbol); loadStockInsights(s.symbol); setShowPortfolioMenu(null); }} className="btn btn-ghost" style={{ padding: '4px 6px' }}>
                        {loadingInsights === s.symbol ? '...' : <ChevronDown style={{ width: 12, height: 12 }} />}
                      </button>
                      <button onClick={() => removeStockFromList(s.symbol, activeIdx)} className="btn btn-danger" style={{ padding: '4px 6px' }}>
                        <Trash2 style={{ width: 10, height: 10 }} />
                      </button>
                    </div>
                  </div>
                  {isExpanded && (
                    <div style={{ padding: 10, borderTop: '1px solid var(--border)', background: 'var(--bg-2)' }}>
                      {story ? (
                        <div>
                          <div>
                            <TrendBadge tone={story.stance === 'strong' ? 'positive' : story.stance === 'weak' ? 'negative' : 'warning'}>{story.stance}</TrendBadge>
                            <span style={{ fontSize: 10, marginLeft: 6 }}>{story.horizonFit}</span>
                          </div>
                          <div style={{ fontSize: 11, marginTop: 6, fontWeight: 600 }}>Why Moving</div>
                          <div style={{ fontSize: 11 }}>{story.whyMoving?.primary || story.summary}</div>
                          {story.whyMoving?.secondary && <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 4 }}>{story.whyMoving.secondary}</div>}
                          {sr && (sr.support > 0 || sr.resistance > 0) && (
                            <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 10 }}>
                              <span><span style={{ color: 'var(--green)' }}>S:</span> {formatCurrency(sr.support)}</span>
                              <span><span style={{ color: 'var(--red)' }}>R:</span> {formatCurrency(sr.resistance)}</span>
                              {sr.trend && <span>Trend: {sr.trend}</span>}
                            </div>
                          )}
                          {story.whyMoving?.risk && <div style={{ fontSize: 10, marginTop: 6, color: 'var(--red)' }}>Risk: {story.whyMoving.risk}</div>}
                          {portfolios.length > 0 && (
                            <div style={{ marginTop: 10 }}>
                              <button onClick={() => setShowPortfolioMenu(showPortfolioMenu === s.symbol ? null : s.symbol)} className="btn btn-primary" style={{ fontSize: 10, width: '100%' }}>
                                Add to Portfolio
                              </button>
                              {showPortfolioMenu === s.symbol && (
                                <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  {portfolios.map(p => (
                                    <button key={p._id} onClick={() => addToPortfolio(p._id, s)} className="btn btn-ghost" style={{ fontSize: 10, justifyContent: 'flex-start' }}>
                                      + {p.name}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : loadingInsights === s.symbol ? (
                        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Loading...</div>
                      ) : (
                        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>No insights</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <EmptyPanel title="Empty" description="Add stocks to this watchlist" icon={Star} />
          )}
        </div>
      </SectionCard>
    </div>
  );
}