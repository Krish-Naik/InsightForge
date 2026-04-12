'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
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
      <div
        className="h-9 flex items-center px-4 gap-3 overflow-hidden"
        style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
      >
        {[...Array(6)].map((_, i) => (
          <div key={i} className="skeleton h-4 w-24 rounded" />
        ))}
      </div>
    );
  }

  const doubled = [...items, ...items];

  return (
    <div
      className="h-9 flex items-center overflow-hidden relative"
      style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
    >
      {/* Live / Polling badge */}
      <div
        className="shrink-0 flex items-center gap-1.5 px-3 border-r text-xs h-full"
        style={{ borderColor: 'var(--border)', color: connected ? 'var(--green)' : 'var(--text-3)' }}
      >
        {connected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
        <span className="font-semibold uppercase tracking-widest text-[9px]">
          {connected ? 'Live' : 'Poll'}
        </span>
      </div>

      {/* Scrolling strip */}
      <div className="flex-1 overflow-hidden">
        <div
          className="flex items-center gap-0"
          style={{ animation: 'ticker-scroll 40s linear infinite', width: 'max-content' }}
        >
          {doubled.map((item, i) => {
            const up = item.changePercent >= 0;
            return (
              <div
                key={`${item.symbol}-${i}`}
                className="flex items-center gap-2 px-4 py-0.5 border-r shrink-0"
                style={{ borderColor: 'var(--border)' }}
              >
                <span className="font-semibold text-xs" style={{ color: 'var(--text-2)' }}>
                  {item.shortName}
                </span>
                <span className="mono font-bold text-xs" style={{ color: 'var(--text-1)' }}>
                  {item.price > 0 ? formatCurrency(item.price).replace('₹', '') : '—'}
                </span>
                <span
                  className="mono text-xs font-bold"
                  style={{ color: up ? 'var(--green)' : 'var(--red)' }}
                >
                  {item.price > 0 ? formatPercent(item.changePercent) : '—'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes ticker-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
