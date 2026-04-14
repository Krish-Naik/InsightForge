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
} from 'lucide-react';
import { SymbolLink } from '@/components/ui/SymbolLink';
import { EmptyPanel, MetricTile, PageHeader, SectionCard, TrendBadge } from '@/components/ui/page-kit';
import { marketAPI, watchlistAPI, type Quote, type SearchResult, type WatchlistRecord } from '@/lib/api';
import { formatCurrency, formatLargeNumber, formatPercent, formatIST } from '@/lib/format';
import { searchCatalogStocks, useMarketCatalog } from '@/lib/hooks/useMarketCatalog';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { isLocalPersistenceMode } from '@/lib/runtime';
import { ensureWorkspaceSession, resetWorkspaceSession } from '@/lib/workspaceSession';

const STORAGE_KEY = 'sp_watchlists_v4';

const DEFAULT_LISTS = [{ id: '1', name: 'Primary Watchlist', stocks: [] }];

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

type PersistenceMode = 'cloud' | 'local';

function mapWatchlistRecord(record: WatchlistRecord): WatchlistEntry {
  return {
    id: record._id,
    name: record.name,
    stocks: (record.stocks || []).map((stock) => ({
      symbol: stock.symbol,
      name: stock.name || stock.symbol,
      exchange: stock.exchange || 'NSE',
    })),
  };
}

function loadLists() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : DEFAULT_LISTS;
  } catch {
    return DEFAULT_LISTS;
  }
}

function saveLists(data: unknown) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export default function WatchlistPage() {
  const { catalog } = useMarketCatalog();
  const [lists, setLists] = useState<WatchlistEntry[]>(DEFAULT_LISTS as WatchlistEntry[]);
  const [activeId, setActiveId] = useState('1');
  const [persistenceMode, setPersistenceMode] = useState<PersistenceMode>(isLocalPersistenceMode() ? 'local' : 'cloud');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [search, setSearch] = useState('');
  const [showComposer, setShowComposer] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      if (isLocalPersistenceMode()) {
        const nextLists = loadLists();
        if (cancelled) return;
        setPersistenceMode('local');
        setLists(nextLists);
        setActiveId(nextLists[0]?.id || '1');
        setBootstrapping(false);
        return;
      }

      try {
        await ensureWorkspaceSession();
        let remoteLists = await watchlistAPI.getAll();
        if (!remoteLists.length) {
          remoteLists = [await watchlistAPI.create('Primary Watchlist')];
        }

        const nextLists = remoteLists.map(mapWatchlistRecord);
        if (cancelled) return;
        setPersistenceMode('cloud');
        setStatusMessage('Workspace synced with Mongo-backed watchlists.');
        setLists(nextLists);
        setActiveId(nextLists[0]?.id || '1');
      } catch (error) {
        const nextLists = loadLists();
        if (cancelled) return;
        setPersistenceMode('local');
        setStatusMessage(`${(error as Error).message} Falling back to local storage.`);
        setLists(nextLists);
        setActiveId(nextLists[0]?.id || '1');
        resetWorkspaceSession();
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    }

    void initialize();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeList = useMemo(() => lists.find((list) => list.id === activeId) || lists[0] || null, [lists, activeId]);

  const fetchQuotes = useCallback(async () => {
    if (!activeList?.stocks?.length) {
      setQuotes({});
      return;
    }

    setLoadingQuotes(true);
    try {
      const symbols: string[] = [...new Set(activeList.stocks.map((stock) => stock.symbol))];
      const data = await marketAPI.getQuotes(symbols);
      setQuotes(Object.fromEntries(data.map((quote) => [quote.symbol, quote])));
      setLastUpdated(new Date());
    } finally {
      setLoadingQuotes(false);
    }
  }, [activeList]);

  useEffect(() => {
    fetchQuotes();
  }, [fetchQuotes]);

  useEffect(() => {
    if (!debouncedSearch.trim() || !catalog) {
      setSearchResults([]);
      return;
    }

    const existing = new Set((activeList?.stocks || []).map((stock) => stock.symbol));
    const localResults: SearchResult[] = searchCatalogStocks(catalog, debouncedSearch, 8)
      .filter((stock) => !existing.has(stock.symbol))
      .map((stock) => ({
        symbol: stock.symbol,
        name: stock.name,
        exchange: stock.exchange,
        type: 'EQUITY',
        sectors: stock.sectors,
        inNifty50: stock.inNifty50,
      }));

    marketAPI.searchStocks(debouncedSearch)
      .then((remoteResults) => {
        const filtered = remoteResults.filter((item) => !existing.has(item.symbol));
        const merged = [...filtered, ...localResults.filter((item) => !filtered.some((remote) => remote.symbol === item.symbol))].slice(0, 10);
        setSearchResults(merged);
      })
      .catch(() => setSearchResults(localResults));
  }, [activeList, catalog, debouncedSearch]);

  const updateLists = (nextLists: WatchlistEntry[]) => {
    setLists(nextLists);
    if (persistenceMode === 'local') {
      saveLists(nextLists);
    }
  };

  const createList = async () => {
    if (persistenceMode === 'cloud') {
      try {
        const created = mapWatchlistRecord(await watchlistAPI.create(`Watchlist ${lists.length + 1}`));
        const nextLists = [...lists, created];
        setLists(nextLists);
        setActiveId(created.id);
        return;
      } catch (error) {
        setStatusMessage((error as Error).message);
      }
    }

    const id = Date.now().toString();
    const nextLists = [...lists, { id, name: `Watchlist ${lists.length + 1}`, stocks: [] }];
    updateLists(nextLists);
    setActiveId(id);
  };

  const deleteList = async (id: string) => {
    if (lists.length <= 1) return;

    if (persistenceMode === 'cloud') {
      try {
        await watchlistAPI.delete(id);
      } catch (error) {
        setStatusMessage((error as Error).message);
        return;
      }
    }

    const nextLists = lists.filter((list) => list.id !== id);
    updateLists(nextLists);
    setActiveId(nextLists[0]?.id || '1');
  };

  const renameList = async (id: string) => {
    if (!draftName.trim()) return;

    if (persistenceMode === 'cloud') {
      try {
        const updated = mapWatchlistRecord(await watchlistAPI.rename(id, draftName.trim()));
        setLists((current) => current.map((list) => (list.id === id ? updated : list)));
      } catch (error) {
        setStatusMessage((error as Error).message);
        return;
      }
    } else {
      updateLists(lists.map((list) => (list.id === id ? { ...list, name: draftName.trim() } : list)));
    }

    setEditingId(null);
    setDraftName('');
  };

  const addSymbol = async (result: SearchResult) => {
    if (!activeList) return;

    if (persistenceMode === 'cloud') {
      try {
        const updated = mapWatchlistRecord(await watchlistAPI.addStock(activeList.id, {
          symbol: result.symbol,
          name: result.name,
          exchange: result.exchange,
        }));
        setLists((current) => current.map((list) => (list.id === activeList.id ? updated : list)));
      } catch (error) {
        setStatusMessage((error as Error).message);
        return;
      }
    } else {
    const nextLists = lists.map((list) => {
      if (list.id !== activeList.id) return list;
      return {
        ...list,
        stocks: [...list.stocks, { symbol: result.symbol, name: result.name, exchange: result.exchange }],
      };
    });
    updateLists(nextLists);
    }

    setSearch('');
    setSearchResults([]);
    setShowComposer(false);
  };

  const removeSymbol = async (symbol: string) => {
    if (!activeList) return;

    if (persistenceMode === 'cloud') {
      try {
        const updated = mapWatchlistRecord(await watchlistAPI.removeStock(activeList.id, symbol));
        setLists((current) => current.map((list) => (list.id === activeList.id ? updated : list)));
      } catch (error) {
        setStatusMessage((error as Error).message);
        return;
      }
    } else {
      updateLists(lists.map((list) => (
        list.id === activeList.id
          ? { ...list, stocks: list.stocks.filter((stock) => stock.symbol !== symbol) }
          : list
      )));
    }

    setQuotes((current) => {
      const next = { ...current };
      delete next[symbol];
      return next;
    });
  };

  const trackedQuotes = useMemo<Quote[]>(
    () => (activeList?.stocks || []).map((stock) => quotes[stock.symbol]).filter((quote): quote is Quote => Boolean(quote)),
    [activeList, quotes],
  );
  const advancers = trackedQuotes.filter((quote) => (quote?.changePercent || 0) > 0).length;
  const decliners = trackedQuotes.filter((quote) => (quote?.changePercent || 0) < 0).length;
  const averageMove = trackedQuotes.length
    ? trackedQuotes.reduce((sum: number, quote: Quote) => sum + (quote.changePercent || 0), 0) / trackedQuotes.length
    : 0;

  return (
    <div className="page">
      <PageHeader
        kicker="Watchlists"
        title={activeList?.name || 'Watchlists'}
        description="Build focused boards for leaders, sectors, or event-driven setups. Quotes stay delayed and batched so even multiple boards do not overwhelm the public data pipeline."
        actions={
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {lastUpdated ? <span className="topbar-pill">Updated {formatIST(lastUpdated)}</span> : null}
            <TrendBadge tone={persistenceMode === 'cloud' ? 'positive' : 'warning'}>
              {persistenceMode === 'cloud' ? 'Mongo workspace sync' : 'Local device storage'}
            </TrendBadge>
            <button onClick={fetchQuotes} disabled={loadingQuotes} className="btn btn-ghost">
              <RefreshCw style={{ width: 14, height: 14 }} className={loadingQuotes ? 'anim-spin' : ''} />
              Refresh board
            </button>
            <button onClick={() => setShowComposer((current) => !current)} className="btn btn-primary">
              <Plus style={{ width: 14, height: 14 }} />
              Add symbol
            </button>
          </div>
        }
      />

      <div className="grid-fit-220">
        <MetricTile label="Tracked symbols" value={activeList?.stocks?.length || 0} tone="primary" icon={Star} subtext="Symbols on the active board" />
        <MetricTile label="Advancers" value={advancers} tone="positive" icon={TrendingUp} subtext="Positive day movers in the board" />
        <MetricTile label="Decliners" value={decliners} tone="negative" icon={TrendingDown} subtext="Negative day movers in the board" />
        <MetricTile label="Average move" value={formatPercent(averageMove)} tone={averageMove >= 0 ? 'positive' : 'negative'} icon={Star} subtext="Mean day move across quoted symbols" />
      </div>

      {bootstrapping || statusMessage ? (
        <div className="metric-footnote" style={{ marginTop: 12 }}>
          {bootstrapping ? 'Preparing workspace session and persistence layer...' : statusMessage}
        </div>
      ) : null}

      <div className="two-column-layout">
        <div className="stack-16">
          <SectionCard title="Boards" subtitle="Curate multiple watchlists for different setups" icon={FolderPlus}>
            <div className="stack-12">
              {lists.map((list) => {
                const active = activeList?.id === list.id;
                return (
                  <div key={list.id} className="metric-card" style={{ padding: 14, borderColor: active ? 'rgba(77, 199, 255, 0.34)' : undefined }}>
                    {editingId === list.id ? (
                      <div className="stack-8">
                        <input value={draftName} onChange={(event) => setDraftName(event.target.value)} className="input" />
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => renameList(list.id)} className="btn btn-primary">Save</button>
                          <button onClick={() => setEditingId(null)} className="btn btn-ghost">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button type="button" onClick={() => setActiveId(list.id)} style={{ width: '100%', background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 700 }}>{list.name}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>{list.stocks.length} symbols</div>
                            </div>
                            {active ? <TrendBadge tone="primary">Active</TrendBadge> : null}
                          </div>
                        </button>
                        <div style={{ marginTop: 10, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                          <button onClick={() => { setEditingId(list.id); setDraftName(list.name); }} className="btn btn-ghost">
                            <Pencil style={{ width: 13, height: 13 }} />
                            Rename
                          </button>
                          {lists.length > 1 ? (
                            <button onClick={() => deleteList(list.id)} className="btn btn-danger">
                              <Trash2 style={{ width: 13, height: 13 }} />
                              Delete
                            </button>
                          ) : null}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
              <button onClick={createList} className="btn btn-ghost">
                <FolderPlus style={{ width: 14, height: 14 }} />
                Create new board
              </button>
            </div>
          </SectionCard>

          <SectionCard title="Symbol Composer" subtitle="Search across the delayed market universe and add names to the active board" icon={Search}>
            <div className="stack-12">
              <button onClick={() => setShowComposer((current) => !current)} className="btn btn-ghost">
                {showComposer ? <X style={{ width: 14, height: 14 }} /> : <Search style={{ width: 14, height: 14 }} />}
                {showComposer ? 'Hide search' : 'Open search'}
              </button>

              {showComposer ? (
                <div className="stack-12">
                  <div style={{ position: 'relative' }}>
                    <Search style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--text-3)' }} />
                    <input value={search} onChange={(event) => setSearch(event.target.value)} className="input" style={{ paddingLeft: 38 }} placeholder="Search symbol or company" />
                  </div>
                  {searchResults.length ? searchResults.map((result) => (
                    <button key={result.symbol} type="button" onClick={() => addSymbol(result)} className="metric-card" style={{ padding: 14, cursor: 'pointer', textAlign: 'left' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                        <div>
                          <div className="mono" style={{ fontSize: 12, fontWeight: 700 }}>{result.symbol}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>{result.name}</div>
                        </div>
                        <Plus style={{ width: 14, height: 14, color: 'var(--primary)' }} />
                      </div>
                    </button>
                  )) : <div className="metric-footnote">Search results appear here as you type.</div>}
                </div>
              ) : null}
            </div>
          </SectionCard>
        </div>

        <SectionCard title="Live Board" subtitle="Delayed quote board with fast chart drill-down and board cleanup" icon={Star}>
          {activeList?.stocks?.length ? (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th style={{ textAlign: 'right' }}>Price</th>
                    <th style={{ textAlign: 'right' }}>Day %</th>
                    <th style={{ textAlign: 'right' }}>Volume</th>
                    <th style={{ textAlign: 'right' }}>Range</th>
                    <th style={{ textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {activeList.stocks.map((stock: { symbol: string; name: string; exchange: string }) => {
                    const quote = quotes[stock.symbol];
                    return (
                      <tr key={stock.symbol}>
                        <td>
                          <SymbolLink symbol={stock.symbol} exchange={stock.exchange} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
                            <div className="mono" style={{ fontSize: 12, fontWeight: 700 }}>{stock.symbol}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{stock.name}</div>
                          </SymbolLink>
                        </td>
                        <td style={{ textAlign: 'right' }}><span className="mono">{quote ? formatCurrency(quote.price) : '—'}</span></td>
                        <td style={{ textAlign: 'right' }}><span className="mono" style={{ color: (quote?.changePercent || 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>{quote ? formatPercent(quote.changePercent) : '—'}</span></td>
                        <td style={{ textAlign: 'right' }}><span className="mono">{quote?.volume ? formatLargeNumber(quote.volume) : '—'}</span></td>
                        <td style={{ textAlign: 'right' }}><span className="mono">{quote ? `${formatCurrency(quote.dayLow)} - ${formatCurrency(quote.dayHigh)}` : '—'}</span></td>
                        <td style={{ textAlign: 'center' }}>
                          <button onClick={() => removeSymbol(stock.symbol)} className="btn btn-danger">
                            <Trash2 style={{ width: 13, height: 13 }} />
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyPanel title="Watchlist is empty" description="Add a few symbols to start tracking a focused market board." icon={Star} />
          )}
        </SectionCard>
      </div>
    </div>
  );
}