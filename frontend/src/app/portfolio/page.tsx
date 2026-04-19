'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FolderPlus,
  Pencil,
  PieChart,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Wallet,
  X,
  ArrowUpDown,
  TrendingUp,
  BarChart3,
} from 'lucide-react';
import { SymbolLink } from '@/components/ui/SymbolLink';
import { EmptyPanel, MetricTile, PageHeader, SectionCard, TrendBadge } from '@/components/ui/page-kit';
import { marketAPI, portfolioAPI, type PortfolioRecord, type Quote, type SearchResult } from '@/lib/api';
import { formatCurrency, formatPercent, formatIST } from '@/lib/format';
import { searchCatalogStocks, useMarketCatalog } from '@/lib/hooks/useMarketCatalog';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { isLocalPersistenceMode } from '@/lib/runtime';
import { ensureWorkspaceSession, resetWorkspaceSession } from '@/lib/workspaceSession';
import { Sparkline } from '@/components/charts/Sparkline';

const STORAGE_KEY = 'sp_portfolios_v4';

const DEFAULT_PORTFOLIOS = [{ id: '1', name: 'Primary Portfolio', holdings: [] }];

type SortField = 'symbol' | 'value' | 'pnl' | 'qty' | 'avgPrice';
type SortDir = 'asc' | 'desc';

type Holding = {
  id: string;
  symbol: string;
  name: string;
  qty: number;
  avgPrice: number;
  sector: string;
};

type PortfolioEntry = {
  id: string;
  name: string;
  holdings: Holding[];
};

type PersistenceMode = 'cloud' | 'local';

function mapPortfolioRecord(record: PortfolioRecord): PortfolioEntry {
  return {
    id: record._id,
    name: record.name,
    holdings: (record.holdings || []).map((holding) => ({
      id: holding._id || `${holding.symbol}-${holding.avgPrice}`,
      symbol: holding.symbol,
      name: holding.name || holding.symbol,
      qty: holding.qty,
      avgPrice: holding.avgPrice,
      sector: holding.sector || 'Other',
    })),
  };
}

function loadPortfolios() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : DEFAULT_PORTFOLIOS;
  } catch {
    return DEFAULT_PORTFOLIOS;
  }
}

function savePortfolios(data: unknown) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export default function PortfolioPage() {
  const { catalog } = useMarketCatalog();
  const [portfolios, setPortfolios] = useState<PortfolioEntry[]>(DEFAULT_PORTFOLIOS as PortfolioEntry[]);
  const [activeId, setActiveId] = useState('1');
  const [persistenceMode, setPersistenceMode] = useState<PersistenceMode>(isLocalPersistenceMode() ? 'local' : 'cloud');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [showComposer, setShowComposer] = useState(false);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [composer, setComposer] = useState({ symbol: '', name: '', qty: '', avgPrice: '', sector: '' });
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [sortField, setSortField] = useState<SortField>('value');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selectedHolding, setSelectedHolding] = useState<string | null>(null);
  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      if (isLocalPersistenceMode()) {
        const nextPortfolios = loadPortfolios();
        if (cancelled) return;
        setPersistenceMode('local');
        setPortfolios(nextPortfolios);
        setActiveId(nextPortfolios[0]?.id || '1');
        setBootstrapping(false);
        return;
      }

      try {
        await ensureWorkspaceSession();
        let remotePortfolios = await portfolioAPI.getAll();
        if (!remotePortfolios.length) {
          remotePortfolios = [await portfolioAPI.create('Primary Portfolio')];
        }

        const nextPortfolios = remotePortfolios.map(mapPortfolioRecord);
        if (cancelled) return;
        setPersistenceMode('cloud');
        setStatusMessage('Workspace synced with Mongo-backed portfolios.');
        setPortfolios(nextPortfolios);
        setActiveId(nextPortfolios[0]?.id || '1');
      } catch (error) {
        const nextPortfolios = loadPortfolios();
        if (cancelled) return;
        setPersistenceMode('local');
        setStatusMessage(`${(error as Error).message} Falling back to local storage.`);
        setPortfolios(nextPortfolios);
        setActiveId(nextPortfolios[0]?.id || '1');
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

  const activePortfolio = useMemo(
    () => portfolios.find((portfolio) => portfolio.id === activeId) || portfolios[0] || null,
    [portfolios, activeId],
  );

  const fetchQuotes = useCallback(async () => {
    if (!activePortfolio?.holdings?.length) {
      setQuotes({});
      return;
    }

    setLoadingQuotes(true);
    try {
      const symbols: string[] = [...new Set(activePortfolio.holdings.map((holding) => holding.symbol))];
      const data = await marketAPI.getQuotes(symbols);
      setQuotes(Object.fromEntries(data.map((quote) => [quote.symbol, quote])));
      setLastUpdated(new Date());
    } finally {
      setLoadingQuotes(false);
    }
  }, [activePortfolio]);

  useEffect(() => {
    fetchQuotes();
  }, [fetchQuotes]);

  useEffect(() => {
    if (!debouncedSearch.trim() || !catalog) {
      setSearchResults([]);
      return;
    }

    const localResults: SearchResult[] = searchCatalogStocks(catalog, debouncedSearch, 8).map((stock) => ({
      symbol: stock.symbol,
      name: stock.name,
      exchange: stock.exchange,
      type: 'EQUITY',
      sectors: stock.sectors,
      inNifty50: stock.inNifty50,
    }));

    marketAPI.searchStocks(debouncedSearch)
      .then((remoteResults) => {
        const merged = [...remoteResults, ...localResults.filter((item) => !remoteResults.some((remote) => remote.symbol === item.symbol))].slice(0, 10);
        setSearchResults(merged);
      })
      .catch(() => setSearchResults(localResults));
  }, [catalog, debouncedSearch]);

  const updatePortfolios = (nextPortfolios: PortfolioEntry[]) => {
    setPortfolios(nextPortfolios);
    if (persistenceMode === 'local') {
      savePortfolios(nextPortfolios);
    }
  };

  const createPortfolio = async () => {
    if (persistenceMode === 'cloud') {
      try {
        const created = mapPortfolioRecord(await portfolioAPI.create(`Portfolio ${portfolios.length + 1}`));
        const nextPortfolios = [...portfolios, created];
        setPortfolios(nextPortfolios);
        setActiveId(created.id);
        return;
      } catch (error) {
        setStatusMessage((error as Error).message);
      }
    }

    const id = Date.now().toString();
    const nextPortfolios = [...portfolios, { id, name: `Portfolio ${portfolios.length + 1}`, holdings: [] }];
    updatePortfolios(nextPortfolios);
    setActiveId(id);
  };

  const deletePortfolio = async (id: string) => {
    if (portfolios.length <= 1) return;

    if (persistenceMode === 'cloud') {
      try {
        await portfolioAPI.delete(id);
      } catch (error) {
        setStatusMessage((error as Error).message);
        return;
      }
    }

    const nextPortfolios = portfolios.filter((portfolio) => portfolio.id !== id);
    updatePortfolios(nextPortfolios);
    setActiveId(nextPortfolios[0]?.id || '1');
  };

  const renamePortfolio = async (id: string) => {
    if (!draftName.trim()) return;

    if (persistenceMode === 'cloud') {
      try {
        const updated = mapPortfolioRecord(await portfolioAPI.rename(id, draftName.trim()));
        setPortfolios((current) => current.map((portfolio) => (portfolio.id === id ? updated : portfolio)));
      } catch (error) {
        setStatusMessage((error as Error).message);
        return;
      }
    } else {
      updatePortfolios(portfolios.map((portfolio) => (portfolio.id === id ? { ...portfolio, name: draftName.trim() } : portfolio)));
    }

    setEditingId(null);
    setDraftName('');
  };

  const addHolding = async () => {
    if (!activePortfolio || !composer.symbol || !composer.qty || !composer.avgPrice) return;

    if (persistenceMode === 'cloud') {
      try {
        const updated = mapPortfolioRecord(await portfolioAPI.addHolding(activePortfolio.id, {
          symbol: composer.symbol.toUpperCase(),
          name: composer.name || composer.symbol.toUpperCase(),
          qty: Number(composer.qty),
          avgPrice: Number(composer.avgPrice),
          sector: composer.sector || 'Other',
          exchange: 'NSE',
        }));
        setPortfolios((current) => current.map((portfolio) => (portfolio.id === activePortfolio.id ? updated : portfolio)));
      } catch (error) {
        setStatusMessage((error as Error).message);
        return;
      }
    } else {

    const nextHolding: Holding = {
      id: Date.now().toString(),
      symbol: composer.symbol.toUpperCase(),
      name: composer.name || composer.symbol.toUpperCase(),
      qty: Number(composer.qty),
      avgPrice: Number(composer.avgPrice),
      sector: composer.sector || 'Other',
    };

    updatePortfolios(portfolios.map((portfolio) => (
      portfolio.id === activePortfolio.id
        ? { ...portfolio, holdings: [...portfolio.holdings, nextHolding] }
        : portfolio
    )));
    }

    setComposer({ symbol: '', name: '', qty: '', avgPrice: '', sector: '' });
    setShowComposer(false);
  };

  const removeHolding = async (holdingId: string) => {
    if (!activePortfolio) return;

    if (persistenceMode === 'cloud') {
      try {
        const updated = mapPortfolioRecord(await portfolioAPI.removeHolding(activePortfolio.id, holdingId));
        setPortfolios((current) => current.map((portfolio) => (portfolio.id === activePortfolio.id ? updated : portfolio)));
      } catch (error) {
        setStatusMessage((error as Error).message);
        return;
      }
    } else {
      updatePortfolios(portfolios.map((portfolio) => (
        portfolio.id === activePortfolio.id
          ? { ...portfolio, holdings: portfolio.holdings.filter((holding) => holding.id !== holdingId) }
          : portfolio
      )));
    }
  };

  const holdings = activePortfolio?.holdings || [];
  const portfolioRows = holdings.map((holding) => {
    const quote = quotes[holding.symbol];
    const ltp = quote?.price || holding.avgPrice;
    const currentValue = ltp * holding.qty;
    const investedValue = holding.avgPrice * holding.qty;
    const pnl = currentValue - investedValue;
    const pnlPercent = investedValue > 0 ? (pnl / investedValue) * 100 : 0;
    const dayPnl = (quote?.change || 0) * holding.qty;
    return { holding, quote, ltp, currentValue, investedValue, pnl, pnlPercent, dayPnl };
  });

  const sortedPortfolioRows = useMemo(() => {
    const sorted = [...portfolioRows].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'symbol': cmp = a.holding.symbol.localeCompare(b.holding.symbol); break;
        case 'value': cmp = a.currentValue - b.currentValue; break;
        case 'pnl': cmp = a.pnl - b.pnl; break;
        case 'qty': cmp = a.holding.qty - b.holding.qty; break;
        case 'avgPrice': cmp = a.holding.avgPrice - b.holding.avgPrice; break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [portfolioRows, sortField, sortDir]);

  const toggleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir(field === 'symbol' ? 'asc' : 'desc');
    }
  }, [sortField]);

  const totals = useMemo(() => {
    const invested = portfolioRows.reduce((sum, row) => sum + row.investedValue, 0);
    const current = portfolioRows.reduce((sum, row) => sum + row.currentValue, 0);
    const pnl = current - invested;
    const pnlPercent = invested > 0 ? (pnl / invested) * 100 : 0;
    const dayPnl = portfolioRows.reduce((sum, row) => sum + row.dayPnl, 0);
    return { invested, current, pnl, pnlPercent, dayPnl };
  }, [portfolioRows]);

  const allocation = useMemo(() => {
    const totalsBySector = new Map<string, number>();
    for (const row of portfolioRows) {
      totalsBySector.set(row.holding.sector, (totalsBySector.get(row.holding.sector) || 0) + row.currentValue);
    }
    return [...totalsBySector.entries()].sort((left, right) => right[1] - left[1]);
  }, [portfolioRows]);

  return (
    <div className="page">
      <PageHeader
        kicker="Portfolio"
        title={activePortfolio?.name || 'Conviction And Carry'}
        description="Track holdings, sector allocation, and performance across the active book."
        actions={
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {lastUpdated ? <span className="topbar-pill">Updated {formatIST(lastUpdated)}</span> : null}
            <button onClick={fetchQuotes} disabled={loadingQuotes} className="btn btn-ghost">
              <RefreshCw style={{ width: 14, height: 14 }} className={loadingQuotes ? 'anim-spin' : ''} />
            </button>
          </div>
        }
      />

      <div className="metric-strip-grid">
        <MetricTile label="Invested" value={formatCurrency(totals.invested)} tone="primary" icon={Wallet} subtext="Total cost basis of the active portfolio" />
        <MetricTile label="Current value" value={formatCurrency(totals.current)} tone="primary" icon={Wallet} subtext="Marked using delayed current prices" />
        <MetricTile label="Total P&L" value={`${totals.pnl >= 0 ? '+' : ''}${formatCurrency(totals.pnl)}`} tone={totals.pnl >= 0 ? 'positive' : 'negative'} icon={Wallet} subtext={formatPercent(totals.pnlPercent)} />
        <MetricTile label="Day P&L" value={`${totals.dayPnl >= 0 ? '+' : ''}${formatCurrency(totals.dayPnl)}`} tone={totals.dayPnl >= 0 ? 'positive' : 'negative'} icon={Wallet} subtext="Approximate session move based on day change" />
      </div>

      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 12 }}>
        {portfolios.map((portfolio) => {
          const active = activePortfolio?.id === portfolio.id;
          return (
            <div
              key={portfolio.id}
              onClick={() => setActiveId(portfolio.id)}
              className="list-card"
              style={{ minWidth: 160, padding: 10, cursor: 'pointer', borderColor: active ? 'var(--primary)' : undefined, background: active ? 'rgba(217,154,79,0.1)' : undefined, flexShrink: 0 }}
            >
              {editingId === portfolio.id ? (
                <div onClick={(e) => e.stopPropagation()}>
                  <input value={draftName} onChange={(e) => setDraftName(e.target.value)} className="input" style={{ marginBottom: 6 }} />
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => renamePortfolio(portfolio.id)} className="btn btn-primary" style={{ fontSize: 10 }}>Save</button>
                    <button onClick={() => setEditingId(null)} className="btn btn-ghost" style={{ fontSize: 10 }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 12 }}>{portfolio.name}</span>
                    {active && <TrendBadge tone="primary">Active</TrendBadge>}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{portfolio.holdings.length} holdings</div>
                  <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                    <button onClick={(e) => { e.stopPropagation(); setEditingId(portfolio.id); setDraftName(portfolio.name); }} className="btn btn-ghost" style={{ padding: '4px 6px' }}>
                      <Pencil style={{ width: 10, height: 10 }} />
                    </button>
                    {portfolios.length > 1 && (
                      <button onClick={(e) => { e.stopPropagation(); deletePortfolio(portfolio.id); }} className="btn btn-danger" style={{ padding: '4px 6px' }}>
                        <Trash2 style={{ width: 10, height: 10 }} />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <button onClick={createPortfolio} className="btn btn-ghost" style={{ minWidth: 80, flexShrink: 0 }}>
          <FolderPlus style={{ width: 12, height: 12 }} />
          New
        </button>
      </div>

      {bootstrapping || statusMessage ? (
        <div className="metric-footnote" style={{ marginTop: 12 }}>
          {bootstrapping ? 'Preparing workspace session and persistence layer...' : statusMessage}
        </div>
      ) : null}

      <div className="workbench-grid">
        <div className="workbench-column">
          <SectionCard title="Add Holding" subtitle="Search a stock and record quantity plus average cost" icon={Search}>
            <div className="stack-16">
              <button onClick={() => setShowComposer((current) => !current)} className="btn btn-ghost">
                {showComposer ? <X style={{ width: 14, height: 14 }} /> : <Search style={{ width: 14, height: 14 }} />}
                {showComposer ? 'Hide composer' : 'Open composer'}
              </button>

              {showComposer ? (
                <div className="stack-12">
                  <div style={{ position: 'relative' }}>
                    <Search style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--text-3)' }} />
                    <input value={search} onChange={(event) => setSearch(event.target.value)} className="input" style={{ paddingLeft: 38 }} placeholder="Search symbol or company" />
                  </div>

                  {searchResults.length ? (
                    <div className="stack-8">
                      {searchResults.map((result) => (
                        <button
                          key={result.symbol}
                          type="button"
                          onClick={() => setComposer((current) => ({
                            ...current,
                            symbol: result.symbol,
                            name: result.name,
                            sector: result.sectors?.[0] || current.sector,
                          }))}
                          className="list-card"
                          style={{ cursor: 'pointer', textAlign: 'left' }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                            <div>
                              <div className="mono" style={{ fontSize: 12, fontWeight: 700 }}>{result.symbol}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>{result.name}</div>
                            </div>
                            <Plus style={{ width: 14, height: 14, color: 'var(--primary)' }} />
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : null}

                  <div className="grid-fit-180">
                    <input className="input" placeholder="Symbol" value={composer.symbol} onChange={(event) => setComposer((current) => ({ ...current, symbol: event.target.value.toUpperCase() }))} />
                    <input className="input" placeholder="Name" value={composer.name} onChange={(event) => setComposer((current) => ({ ...current, name: event.target.value }))} />
                    <input className="input" placeholder="Quantity" type="number" value={composer.qty} onChange={(event) => setComposer((current) => ({ ...current, qty: event.target.value }))} />
                    <input className="input" placeholder="Average price" type="number" value={composer.avgPrice} onChange={(event) => setComposer((current) => ({ ...current, avgPrice: event.target.value }))} />
                    <input className="input" placeholder="Sector" value={composer.sector} onChange={(event) => setComposer((current) => ({ ...current, sector: event.target.value }))} />
                  </div>

                  <button onClick={addHolding} className="btn btn-primary" disabled={!composer.symbol || !composer.qty || !composer.avgPrice}>
                    Add holding
                  </button>
                </div>
              ) : null}
            </div>
          </SectionCard>
        </div>

        <div className="workbench-column">
          <SectionCard title="Allocation" subtitle="Current sector exposure by marked value" icon={PieChart}>
            {allocation.length ? (
              <div className="stack-16">
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120 }}>
                  {allocation.map(([sector, value], index) => {
                    const weight = totals.current > 0 ? (value / totals.current) * 100 : 0;
                    const barHeight = Math.max(weight * 1.2, 8);
                    const colors = ['#d99a4f', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444', '#14b8a6', '#f59e0b'];
                    const color = colors[index % colors.length];
                    return (
                      <div key={sector} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                        <div style={{ fontSize: 10, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{weight.toFixed(1)}%</div>
                        <div
                          style={{
                            width: '100%',
                            height: barHeight,
                            background: `linear-gradient(180deg, ${color}, ${color}88)`,
                            borderRadius: 4,
                            minHeight: 8,
                          }}
                          title={sector}
                        />
                        <div style={{ fontSize: 9, color: 'var(--text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{sector}</div>
                      </div>
                    );
                  })}
                </div>
                <div className="panel-scroll-tight stack-8">
                  {allocation.map(([sector, value]) => {
                    const weight = totals.current > 0 ? (value / totals.current) * 100 : 0;
                    return (
                      <div key={sector} className="list-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 700 }}>{sector}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>{formatCurrency(value)}</div>
                          </div>
                          <TrendBadge tone="primary">{weight.toFixed(1)}%</TrendBadge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <EmptyPanel title="No allocation yet" description="Sector allocation appears once you add holdings to the portfolio." icon={PieChart} />
            )}
          </SectionCard>

          <SectionCard title="Holdings" subtitle="Cost basis, current value, and performance across the active book" icon={Wallet}>
            {sortedPortfolioRows.length ? (
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th onClick={() => toggleSort('symbol')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          Holding {sortField === 'symbol' && (sortDir === 'asc' ? '↑' : '↓')}
                        </span>
                      </th>
                      <th style={{ width: 80 }}>Trend</th>
                      <th onClick={() => toggleSort('qty')} style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                          Qty {sortField === 'qty' && (sortDir === 'asc' ? '↑' : '↓')}
                        </span>
                      </th>
                      <th onClick={() => toggleSort('avgPrice')} style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                          Avg Price {sortField === 'avgPrice' && (sortDir === 'asc' ? '↑' : '↓')}
                        </span>
                      </th>
                      <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>LTP</th>
                      <th onClick={() => toggleSort('value')} style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                          Value {sortField === 'value' && (sortDir === 'asc' ? '↑' : '↓')}
                        </span>
                      </th>
                      <th onClick={() => toggleSort('pnl')} style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                          P&L {sortField === 'pnl' && (sortDir === 'asc' ? '↑' : '↓')}
                        </span>
                      </th>
                      <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Day P&L</th>
                      <th style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPortfolioRows.map((row) => (
                      <tr
                        key={row.holding.id}
                        onClick={() => setSelectedHolding(selectedHolding === row.holding.id ? null : row.holding.id)}
                        style={{ cursor: 'pointer', background: selectedHolding === row.holding.id ? 'rgba(217, 154, 79, 0.08)' : undefined }}
                      >
                        <td>
                          <SymbolLink symbol={row.holding.symbol} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
                            <div className="mono" style={{ fontSize: 12, fontWeight: 700 }}>{row.holding.symbol}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{row.holding.name}</div>
                          </SymbolLink>
                        </td>
                        <td style={{ padding: '6px 4px' }}>
                          <div style={{ width: 70, height: 28 }}>
                            <Sparkline symbol={row.holding.symbol} period="1mo" width={70} height={28} />
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}><span className="mono">{row.holding.qty}</span></td>
                        <td style={{ textAlign: 'right' }}><span className="mono">{formatCurrency(row.holding.avgPrice)}</span></td>
                        <td style={{ textAlign: 'right' }}><span className="mono">{formatCurrency(row.ltp)}</span></td>
                        <td style={{ textAlign: 'right' }}><span className="mono">{formatCurrency(row.currentValue)}</span></td>
                        <td style={{ textAlign: 'right' }}>
                          <span className="mono" style={{ color: row.pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                            {row.pnl >= 0 ? '+' : ''}{formatCurrency(row.pnl)}
                          </span>
                          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{formatPercent(row.pnlPercent)}</div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span className="mono" style={{ color: row.dayPnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                            {row.dayPnl >= 0 ? '+' : ''}{formatCurrency(row.dayPnl)}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button onClick={(e) => { e.stopPropagation(); removeHolding(row.holding.id); }} className="btn btn-danger">
                            <Trash2 style={{ width: 13, height: 13 }} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyPanel title="No holdings yet" description="Open the composer and add a few positions to start tracking your portfolio." icon={Wallet} />
            )}
          </SectionCard>

          {selectedHolding && (
            <SectionCard title="Position Detail" subtitle={`Detailed view for ${sortedPortfolioRows.find(r => r.holding.id === selectedHolding)?.holding.symbol || 'selected position'}`} icon={BarChart3}>
              {(() => {
                const row = sortedPortfolioRows.find(r => r.holding.id === selectedHolding);
                if (!row) return null;
                return (
                  <div className="stack-16">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                      <div className="metric-card">
                        <div className="stat-label">Symbol</div>
                        <div className="metric-value" style={{ fontSize: 18 }}>{row.holding.symbol}</div>
                      </div>
                      <div className="metric-card">
                        <div className="stat-label">Company</div>
                        <div className="metric-value" style={{ fontSize: 14 }}>{row.holding.name}</div>
                      </div>
                      <div className="metric-card">
                        <div className="stat-label">Quantity</div>
                        <div className="metric-value" style={{ fontSize: 18 }}>{row.holding.qty}</div>
                      </div>
                      <div className="metric-card">
                        <div className="stat-label">Avg Price</div>
                        <div className="metric-value" style={{ fontSize: 18 }}>{formatCurrency(row.holding.avgPrice)}</div>
                      </div>
                      <div className="metric-card">
                        <div className="stat-label">LTP</div>
                        <div className="metric-value" style={{ fontSize: 18 }}>{formatCurrency(row.ltp)}</div>
                      </div>
                      <div className="metric-card">
                        <div className="stat-label">Current Value</div>
                        <div className="metric-value" style={{ fontSize: 18 }}>{formatCurrency(row.currentValue)}</div>
                      </div>
                      <div className="metric-card" style={{ borderColor: row.pnl >= 0 ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)', background: row.pnl >= 0 ? 'rgba(34, 197, 94, 0.05)' : 'rgba(239, 68, 68, 0.05)' }}>
                        <div className="stat-label">Unrealized P&L</div>
                        <div className="metric-value" style={{ fontSize: 18, color: row.pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                          {row.pnl >= 0 ? '+' : ''}{formatCurrency(row.pnl)}
                        </div>
                        <div className="metric-footnote">{formatPercent(row.pnlPercent)}</div>
                      </div>
                      <div className="metric-card" style={{ borderColor: row.dayPnl >= 0 ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)', background: row.dayPnl >= 0 ? 'rgba(34, 197, 94, 0.05)' : 'rgba(239, 68, 68, 0.05)' }}>
                        <div className="stat-label">Day P&L</div>
                        <div className="metric-value" style={{ fontSize: 18, color: row.dayPnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                          {row.dayPnl >= 0 ? '+' : ''}{formatCurrency(row.dayPnl)}
                        </div>
                      </div>
                    </div>
                    {row.quote && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginTop: 16 }}>
                        <div className="metric-card">
                          <div className="stat-label">Day High</div>
                          <div className="metric-value">{formatCurrency(row.quote.dayHigh)}</div>
                        </div>
                        <div className="metric-card">
                          <div className="stat-label">Day Low</div>
                          <div className="metric-value">{formatCurrency(row.quote.dayLow)}</div>
                        </div>
                        <div className="metric-card">
                          <div className="stat-label">Volume</div>
                          <div className="metric-value">{row.quote.volume?.toLocaleString()}</div>
                        </div>
                        <div className="metric-card">
                          <div className="stat-label">52W High</div>
                          <div className="metric-value">{formatCurrency(row.quote.high52w)}</div>
                        </div>
                        <div className="metric-card">
                          <div className="stat-label">52W Low</div>
                          <div className="metric-value">{formatCurrency(row.quote.low52w)}</div>
                        </div>
                        <div className="metric-card">
                          <div className="stat-label">Market Cap</div>
                          <div className="metric-value">{row.quote.marketCap ? `${(row.quote.marketCap / 1e12).toFixed(1)}T` : 'N/A'}</div>
                        </div>
                      </div>
                    )}
                    <div style={{ marginTop: 16 }}>
                      <Sparkline symbol={row.holding.symbol} period="3mo" width={600} height={160} />
                    </div>
                  </div>
                );
              })()}
            </SectionCard>
          )}
        </div>
      </div>
    </div>
  );
}