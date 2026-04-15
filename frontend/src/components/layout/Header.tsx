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
            <TrendingUp style={{ width: 18, height: 18, color: 'var(--text-1)' }} />
          </span>
          <span>
            <span className="brand-title">InsightForge</span>
            <span className="brand-subtitle">Decision companion for Indian traders</span>
          </span>
        </Link>

        <div className="topbar-meta">
          <span className="topbar-pill">
            <span className={`status-dot ${connected ? 'is-live' : ''}`} />
            {connected ? 'Live data' : 'Cached mode'}
          </span>
          <span className="topbar-pill">
            <Waves style={{ width: 12, height: 12, color: 'var(--text-2)' }} />
            Ranked brief
          </span>
          <span className="topbar-pill">
            <BrainCircuit style={{ width: 12, height: 12, color: 'var(--text-2)' }} />
            AI insights
          </span>
          <span className="topbar-pill">
            <Sparkles style={{ width: 12, height: 12, color: 'var(--text-2)' }} />
            Cached feed
          </span>
        </div>
      </div>
    </header>
  );
}
