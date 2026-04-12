'use client';
import { useState, useEffect, useCallback } from 'react';
import { Zap, RefreshCw, ChevronDown, ChevronUp, BarChart2, TrendingUp, TrendingDown } from 'lucide-react';
import { SymbolLink } from '@/components/ui/SymbolLink';
import { marketAPI } from '@/lib/api';
import { formatCurrency, formatPercent, formatIST } from '@/lib/format';
import { useMarketCatalog } from '@/lib/hooks/useMarketCatalog';

type SectorStocks = { symbol: string; name: string; price: number; changePercent: number; volume: number; }[];

function SectorCard({ name, stocks, expanded, onToggle }: { name: string; stocks: SectorStocks; expanded: boolean | 'all'; onToggle: (mode?: 'all') => void }) {
  const loaded = stocks.filter(s => s.price > 0);
  const adv = loaded.filter(s => s.changePercent > 0).length;
  const dec = loaded.filter(s => s.changePercent < 0).length;
  const avgChg = loaded.length ? loaded.reduce((sum, s) => sum + s.changePercent, 0) / loaded.length : 0;
  const sentiment = avgChg > 0.3 ? 'bullish' : avgChg < -0.3 ? 'bearish' : 'neutral';
  const sentimentCol = sentiment === 'bullish' ? 'var(--green)' : sentiment === 'bearish' ? 'var(--red)' : 'var(--amber)';
  const showAll = expanded === 'all';
  const displayed = showAll ? stocks : stocks.slice(0, 8);

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <button onClick={() => onToggle()} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
        className="sector-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <div style={{ width: 3, height: 32, borderRadius: 2, background: sentimentCol, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>{name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
              <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: sentimentCol }}>
                {avgChg > 0 ? '+' : ''}{avgChg.toFixed(2)}% avg
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-3)' }}>▲{adv} ▼{dec} ={loaded.length - adv - dec}</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {loaded.length > 0 && (
            <div style={{ width: 60, height: 5, borderRadius: 9, background: 'var(--surface-2)', overflow: 'hidden', display: 'flex' }}>
              <div style={{ width: `${(adv / loaded.length) * 100}%`, background: 'var(--green)', height: '100%' }} />
              <div style={{ width: `${(dec / loaded.length) * 100}%`, background: 'var(--red)', height: '100%' }} />
            </div>
          )}
          {expanded ? <ChevronUp style={{ width: 14, height: 14, color: 'var(--text-3)' }} /> : <ChevronDown style={{ width: 14, height: 14, color: 'var(--text-3)' }} />}
        </div>
      </button>

      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          {displayed.map(s => {
            const up = s.changePercent >= 0;
            return (
              <div key={s.symbol} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 16px', borderBottom: '1px solid rgba(30,42,64,0.4)' }}
                className="stock-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <SymbolLink symbol={s.symbol} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 } as any}>
                    <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)' }}>{s.symbol}</span>
                  </SymbolLink>
                  <span style={{ fontSize: 10, color: 'var(--text-2)', maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                  <span className="mono" style={{ fontSize: 12, color: 'var(--text-1)' }}>{s.price > 0 ? formatCurrency(s.price) : '—'}</span>
                  <span className="mono" style={{ fontSize: 12, fontWeight: 700, width: 60, textAlign: 'right', color: s.price > 0 ? (up ? 'var(--green)' : 'var(--red)') : 'var(--text-3)' }}>
                    {s.price > 0 ? formatPercent(s.changePercent) : '—'}
                  </span>
                  {s.price > 0 && (
                    <SymbolLink symbol={s.symbol}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 5, background: 'var(--primary-dim)', color: 'var(--primary)', cursor: 'pointer' }}>
                        <BarChart2 style={{ width: 11, height: 11 }} />
                      </span>
                    </SymbolLink>
                  )}
                </div>
              </div>
            );
          })}
          {stocks.length > 8 && (
            <button onClick={e => { e.stopPropagation(); onToggle('all'); }}
              style={{ width: '100%', padding: '8px', fontSize: 11, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer' }}>
              {showAll ? 'Show less' : `Show all ${stocks.length} stocks`}
            </button>
          )}
        </div>
      )}
      <style>{`.sector-header:hover { background: rgba(255,255,255,0.02) !important; } .stock-row:hover { background: var(--surface-2); }`}</style>
    </div>
  );
}

export default function ScannerPage() {
  const [sectorData, setSectorData] = useState<Record<string, SectorStocks>>({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean | 'all'>>({ Banking: true });
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [error, setError] = useState<string | null>(null);
  const { catalog, loading: catalogLoading, error: catalogError } = useMarketCatalog();

  const sectorMap = catalog?.sectors || {};

  const fetchData = useCallback(async (silent = false) => {
    if (!catalog) return;
    if (!silent) setLoading(true);
    try {
      const data = await marketAPI.getAllSectorsData() as any[];
      const map: Record<string, SectorStocks> = {};
      (data || []).forEach((sector: any) => {
        map[sector.name] = (sector.stocks || []).map((stock: any) => ({
          symbol: stock.symbol,
          name: stock.name || stock.symbol,
          price: Number(stock.price || 0),
          changePercent: Number(stock.changePercent ?? stock.change ?? 0),
          volume: Number(stock.volume || 0),
        }));
      });
      setSectorData(map);
      setLastUpdated(new Date());
      setError(null);
    } catch {
      // Fallback: fetch per sector
      const results: Record<string, SectorStocks> = {};
      await Promise.allSettled(
        Object.entries(sectorMap).map(async ([sector, symbols]) => {
          try {
            const quotes = await marketAPI.getQuotes(symbols) as any[];
            results[sector] = quotes.map((q: any) => ({ symbol: q.symbol, name: q.name || q.symbol, price: q.price, changePercent: Number(q.changePercent ?? q.change ?? 0), volume: q.volume }));
          } catch {
            results[sector] = symbols.map(s => ({ symbol: s, name: s, price: 0, changePercent: 0, volume: 0 }));
          }
        })
      );
      setSectorData(results);
      setError('Using fallback sector snapshot. Live sector aggregation is degraded.');
    } finally { setLoading(false); }
  }, [catalog, sectorMap]);

  useEffect(() => {
    if (!catalog) return;
    fetchData();
    const timer = setInterval(() => fetchData(true), 60000);
    return () => clearInterval(timer);
  }, [catalog, fetchData]);

  const toggle = (name: string, mode?: 'all') => {
    setExpanded(prev => {
      if (mode === 'all') return { ...prev, [name]: prev[name] === 'all' ? true : 'all' };
      return { ...prev, [name]: !prev[name] };
    });
  };

  const allStocks = Object.values(sectorData).flat();
  const loaded = allStocks.filter(s => s.price > 0);
  const advancers = loaded.filter(s => s.changePercent > 0).length;
  const decliners = loaded.filter(s => s.changePercent < 0).length;

  const filteredSectors = Object.keys(sectorMap)
    .filter(s => {
      if (filter === 'all') return true;
      const stocks = (sectorData[s] || []).filter(x => x.price > 0);
      const avg = stocks.length ? stocks.reduce((sum, x) => sum + x.changePercent, 0) / stocks.length : 0;
      return filter === 'bullish' ? avg > 0.3 : filter === 'bearish' ? avg < -0.3 : true;
    })
    .sort((a, b) => {
      if (sortBy === 'name') return a.localeCompare(b);
      const aS = (sectorData[a] || []).filter(s => s.price > 0);
      const bS = (sectorData[b] || []).filter(s => s.price > 0);
      const aA = aS.length ? aS.reduce((sum, s) => sum + s.changePercent, 0) / aS.length : 0;
      const bA = bS.length ? bS.reduce((sum, s) => sum + s.changePercent, 0) / bS.length : 0;
      return sortBy === 'best' ? bA - aA : aA - bA;
    });

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-1)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <Zap style={{ width: 18, height: 18, color: 'var(--amber)' }} /> Intraday Scanner
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text-2)' }}>{lastUpdated ? `Updated ${formatIST(lastUpdated)}` : 'Loading sector data…'}</p>
        </div>
        <button onClick={() => fetchData()} disabled={loading} className="btn btn-ghost" style={{ padding: '5px 8px' }}>
          <RefreshCw style={{ width: 13, height: 13 }} className={loading ? 'anim-spin' : ''} />
        </button>
      </div>

      {catalogError && <div className="badge badge-red" style={{ fontSize: 11, padding: '6px 12px' }}>⚠ {catalogError}</div>}
  {error && <div className="badge badge-amber" style={{ fontSize: 11, padding: '6px 12px' }}>{error}</div>}

      {/* Market Breadth */}
      {loaded.length > 0 && (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Market Breadth — {loaded.length} stocks tracked</div>
            <div style={{ display: 'flex', gap: 16, fontSize: 11 }} className="mono">
              <span style={{ color: 'var(--green)' }}>▲ {advancers} advancing</span>
              <span style={{ color: 'var(--red)' }}>▼ {decliners} declining</span>
              <span style={{ color: 'var(--text-3)' }}>= {loaded.length - advancers - decliners} flat</span>
            </div>
          </div>
          <div style={{ height: 10, borderRadius: 9, background: 'var(--surface-2)', overflow: 'hidden', display: 'flex' }}>
            <div style={{ width: `${(advancers / loaded.length) * 100}%`, background: 'var(--green)', height: '100%', transition: 'width 0.5s', borderRadius: '9px 0 0 9px' }} />
            <div style={{ width: `${((loaded.length - advancers - decliners) / loaded.length) * 100}%`, background: 'var(--amber)', height: '100%', opacity: 0.4 }} />
            <div style={{ width: `${(decliners / loaded.length) * 100}%`, background: 'var(--red)', height: '100%', transition: 'width 0.5s', borderRadius: '0 9px 9px 0' }} />
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <div className="tab-group">
          {[{ id: 'all', l: 'All Sectors' }, { id: 'bullish', l: '▲ Bullish' }, { id: 'bearish', l: '▼ Bearish' }].map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)} className={`tab ${filter === f.id ? 'tab-active' : ''}`}>{f.l}</button>
          ))}
        </div>
        <div className="tab-group">
          {[{ id: 'name', l: 'A–Z' }, { id: 'best', l: '↑ Best' }, { id: 'worst', l: '↓ Worst' }].map(s => (
            <button key={s.id} onClick={() => setSortBy(s.id)} className={`tab ${sortBy === s.id ? 'tab-active' : ''}`}>{s.l}</button>
          ))}
        </div>
      </div>

      {/* Sector cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(loading || catalogLoading)
          ? [...Array(6)].map((_, i) => <div key={i} className="card skeleton" style={{ height: 56 }} />)
          : filteredSectors.map(sector => (
            <SectorCard
              key={sector}
              name={sector}
              stocks={sectorData[sector] || sectorMap[sector].map(s => ({ symbol: s, name: s, price: 0, changePercent: 0, volume: 0 }))}
              expanded={expanded[sector]}
              onToggle={(mode) => toggle(sector, mode)}
            />
          ))}
      </div>
    </div>
  );
}
