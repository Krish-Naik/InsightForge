'use client';
import Link from 'next/link';
import { TrendingUp } from 'lucide-react';

export function Header() {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link href="/" className="brand-lockup">
          <span className="brand-mark">
            <TrendingUp style={{ width: 18, height: 18, color: 'var(--text-1)' }} />
          </span>
          <span>
            <span className="brand-title">InsightForge</span>
          </span>
        </Link>
      </div>
    </header>
  );
}