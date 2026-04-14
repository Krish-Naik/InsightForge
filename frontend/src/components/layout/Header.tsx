'use client';
import Link from 'next/link';
import { Activity, Radio, ShieldCheck, TrendingUp } from 'lucide-react';
import { useMarketStream } from '@/lib/hooks/useMarketStream';

export function Header() {
  const { connected } = useMarketStream(true);

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link href="/market" className="brand-lockup">
          <span className="brand-mark">
            <TrendingUp style={{ width: 20, height: 20, color: 'var(--primary)' }} />
          </span>
          <span>
            <span className="brand-title">StockPulse</span>
            <span className="brand-subtitle">Production market workspace for NSE and BSE</span>
          </span>
        </Link>

        <div className="topbar-meta">
          <span className="topbar-pill">
            <span className={`status-dot ${connected ? 'is-live' : ''}`} />
            {connected ? 'Live stream online' : 'Delayed cache mode'}
          </span>
          <span className="topbar-pill">
            <Radio style={{ width: 13, height: 13, color: 'var(--primary)' }} />
            Yahoo Finance feed
          </span>
          <span className="topbar-pill">
            <Activity style={{ width: 13, height: 13, color: 'var(--amber)' }} />
            TradingView charts
          </span>
          <span className="topbar-pill">
            <ShieldCheck style={{ width: 13, height: 13, color: 'var(--primary-2)' }} />
            Cached for public API safety
          </span>
        </div>
      </div>
    </header>
  );
}
