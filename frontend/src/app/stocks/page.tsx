'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Search, ArrowUpDown, BarChart3, TrendingUp, TrendingDown } from 'lucide-react';
import { PageHeader, SectionCard, EmptyPanel } from '@/components/ui/page-kit';
import { marketAPI, type MarketCatalog, type Quote } from '@/lib/api';
import { formatLargeNumber, formatPercent, formatNumber } from '@/lib/format';

type SortField = 'symbol' | 'name' | 'price' | 'change' | 'volume' | 'marketCap';
type SortDir = 'asc' | 'desc';

export default function StocksPage() {
  const [catalog, setCatalog] = useState<MarketCatalog | null>(null);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('symbol');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await marketAPI.getCatalog();
      setCatalog(data);
      
      const symbols = data.stocks.slice(0, 100).map((s: any) => s.symbol);
      if (symbols.length > 0) {
        try {
          const quotesData = await marketAPI.getQuotes(symbols);
          const quoteMap: Record<string, Quote> = {};
          quotesData.forEach((q: Quote) => { quoteMap[q.symbol] = q; });
          setQuotes(quoteMap);
        } catch (e) { console.error('Failed to load quotes', e); }
      }
    } catch (err) {
      console.error('Failed to load catalog', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const stocks = (catalog?.stocks || []).map((s: any) => ({
    symbol: s.symbol,
    name: s.name,
    exchange: s.exchange || 'NSE',
    price: quotes[s.symbol]?.price,
    change: quotes[s.symbol]?.change,
    changePercent: quotes[s.symbol]?.changePercent,
    volume: quotes[s.symbol]?.volume,
    marketCap: quotes[s.symbol]?.marketCap,
  }));

  const filtered = stocks.filter((s: any) => 
    s.symbol.toLowerCase().includes(search.toLowerCase()) ||
    (s.name || '').toLowerCase().includes(search.toLowerCase())
  );

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    switch (sortField) {
      case 'symbol': cmp = a.symbol.localeCompare(b.symbol); break;
      case 'name': cmp = (a.name || '').localeCompare(b.name || ''); break;
      case 'price': cmp = (a.price || 0) - (b.price || 0); break;
      case 'change': cmp = (a.changePercent || 0) - (b.changePercent || 0); break;
      case 'volume': cmp = (a.volume || 0) - (b.volume || 0); break;
      case 'marketCap': cmp = (a.marketCap || 0) - (b.marketCap || 0); break;
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <th onClick={() => toggleSort(field)} style={{ cursor: 'pointer', userSelect: 'none' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {label} {sortField === field && (sortDir === 'asc' ? '▲' : '▼')}
      </span>
    </th>
  );

  return (
    <div className="page">
      <PageHeader
        kicker="Market"
        title="All Stocks"
        description={`Browse ${catalog?.stocks?.length || 0} tracked stocks across NSE & BSE`}
      />

      <SectionCard title="Stock Directory" subtitle="Search and sort tracked securities" icon={Search}>
        <div style={{ marginBottom: 16 }}>
          <input
            type="text"
            placeholder="Search by symbol or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input"
            style={{ width: '100%', maxWidth: 400 }}
          />
        </div>

        {loading ? (
          <div className="skeleton" style={{ height: 400 }} />
        ) : sorted.length > 0 ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <SortHeader field="symbol" label="Symbol" />
                  <SortHeader field="name" label="Name" />
                  <SortHeader field="price" label="Price" />
                  <SortHeader field="change" label="Change" />
                  <SortHeader field="volume" label="Volume" />
                  <SortHeader field="marketCap" label="Market Cap" />
                </tr>
              </thead>
              <tbody>
                {sorted.slice(0, 100).map((stock: any) => {
                  const positive = (stock.changePercent || 0) >= 0;
                  return (
                    <tr key={stock.symbol}>
                      <td>
                        <Link href={`/stocks/${encodeURIComponent(stock.symbol)}`} className="mono" style={{ fontWeight: 700, color: 'var(--accent)' }}>
                          {stock.symbol}
                        </Link>
                      </td>
                      <td>{stock.name || '—'}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{stock.price ? formatLargeNumber(stock.price) : '—'}</td>
                      <td className={`mono ${positive ? 'text-positive' : 'text-negative'}`} style={{ textAlign: 'right' }}>
                        {stock.changePercent != null ? formatPercent(stock.changePercent) : '—'}
                      </td>
                      <td className="mono" style={{ textAlign: 'right' }}>{stock.volume ? formatNumber(stock.volume) : '—'}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{stock.marketCap ? formatLargeNumber(stock.marketCap) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyPanel title="No stocks found" description="Try adjusting your search" icon={Search} />
        )}
      </SectionCard>
    </div>
  );
}