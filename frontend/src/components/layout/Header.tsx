'use client';
import Link from 'next/link';
import { BrainCircuit, Sparkles, Waves, TrendingUp } from 'lucide-react';
import { useMarketStream } from '@/lib/hooks/useMarketStream';

export function Header() {
  const { connected } = useMarketStream(true);

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link href="/" className="brand-lockup">
          <span className="brand-mark">
            <TrendingUp style={{ width: 20, height: 20, color: 'var(--primary)' }} />
          </span>
          <span>
            <span className="brand-title">StockPulse</span>
            <span className="brand-subtitle">Decision companion for Indian traders</span>
          </span>
        </Link>

        <div className="topbar-meta">
          <span className="topbar-pill">
            <span className={`status-dot ${connected ? 'is-live' : ''}`} />
            {connected ? 'Live market pulse' : 'Delayed cache mode'}
          </span>
          <span className="topbar-pill">
            <Waves style={{ width: 13, height: 13, color: 'var(--primary)' }} />
            Ranked market brief
          </span>
          <span className="topbar-pill">
            <BrainCircuit style={{ width: 13, height: 13, color: 'var(--amber)' }} />
            AI-ready explanations
          </span>
          <span className="topbar-pill">
            <Sparkles style={{ width: 13, height: 13, color: 'var(--primary-2)' }} />
            Cached for public feed safety
          </span>
        </div>
      </div>
    </header>
  );
}
