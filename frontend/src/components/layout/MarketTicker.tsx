'use client';
import { useEffect, useState, useCallback } from 'react';
import { marketAPI } from '@/lib/api';
import { formatCurrency, formatPercent } from '@/lib/format';
import { useMarketStream } from '@/lib/hooks/useMarketStream';

interface TickerItem {
  symbol: string;
  shortName: string;
  price: number;
  changePercent: number;
}

const DISPLAY_INDICES = [
  'NIFTY 50', 'NIFTY BANK', 'NIFTY IT', 'NIFTY PHARMA',
  'NIFTY AUTO', 'NIFTY METAL', 'NIFTY FMCG', 'NIFTY ENERGY',
];

export function MarketTicker() {
  const [items, setItems] = useState<TickerItem[]>([]);
  const { data: streamData, connected } = useMarketStream(true);

  const fetchIndices = useCallback(async () => {
    try {
      const data = await marketAPI.getIndices();
      const mapped = (data as any[])
        .filter((i: any) => DISPLAY_INDICES.includes(i.symbol))
        .map((i: any) => ({
          symbol: i.symbol,
          shortName: i.shortName || i.symbol,
          price: i.price,
          changePercent: i.changePercent,
        }));
      if (mapped.some((item) => item.price > 0)) setItems(mapped);
    } catch {/* silently ignore */}
  }, []);

  useEffect(() => { fetchIndices(); }, [fetchIndices]);

  useEffect(() => {
    if (!streamData) return;
    if (streamData.type === 'market_update' || streamData.type === 'indices_tick') {
      const indices = streamData.indices as any[];
      if (indices?.length) {
        const mapped = indices
          .filter((i: any) => DISPLAY_INDICES.includes(i.symbol))
          .map((i: any) => ({ symbol: i.symbol, shortName: i.shortName || i.symbol, price: i.price, changePercent: i.changePercent }));
          if (mapped.some((item) => item.price > 0)) setItems(mapped);
      }
    }
  }, [streamData]);

  if (!items.length) {
    return (
      <div className="ticker-bar">
        <div className="ticker-inner">
          <div className="topbar-pill">Loading market data</div>
          <div className="ticker-track" style={{ display: 'flex', gap: 10 }}>
        {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 32, width: 120 }} />
        ))}
          </div>
        </div>
      </div>
    );
  }

  const doubled = [...items, ...items];

  return (
    <div className="ticker-bar">
      <div className="ticker-inner">
        <div className="ticker-track">
          <div className="ticker-strip">
          {doubled.map((item, i) => {
            const up = item.changePercent >= 0;
            return (
              <div key={`${item.symbol}-${i}`} className="ticker-chip">
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)' }}>
                  {item.shortName}
                </span>
                <span className="mono" style={{ fontWeight: 600, color: 'var(--text-1)' }}>
                  {item.price > 0 ? formatCurrency(item.price).replace('₹', '') : '—'}
                </span>
                <span className="mono" style={{ fontWeight: 600, color: up ? 'var(--green)' : 'var(--red)' }}>
                  {item.price > 0 ? formatPercent(item.changePercent) : '—'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      </div>
    </div>
  );
}
