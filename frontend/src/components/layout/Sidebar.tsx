'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity, BarChart3, Menu, Newspaper, Star, Wallet, X, Zap,
} from 'lucide-react';
import { useState } from 'react';

const NAV = [
  { href: '/market', label: 'Command Center', icon: Activity, desc: 'Overview, movers, sectors, charts' },
  { href: '/scanner', label: 'Momentum Scanner', icon: Zap, desc: 'Sector-first trend discovery' },
  { href: '/screener', label: 'Fundamental Screener', icon: BarChart3, desc: 'Technical and valuation filters' },
  { href: '/watchlist', label: 'Watchlists', icon: Star, desc: 'Curated live boards' },
  { href: '/portfolio', label: 'Portfolio', icon: Wallet, desc: 'Allocation and P&L tracking' },
  { href: '/news', label: 'News Desk', icon: Newspaper, desc: 'Curated market intelligence' },
];

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const SidebarContent = () => (
    <aside className="nav-shell">
      <div className="nav-note stack-8">
        <span className="page-kicker">Market Pipeline</span>
        <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>
          Delayed Yahoo market data, TradingView charting, sector-first scanning, and cached news aggregation.
        </div>
      </div>

      <div className="nav-section-label">Workspace</div>
      <nav className="stack-8" style={{ flex: 1 }}>
        {NAV.map(({ href, label, icon: Icon, desc }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={`nav-link ${active ? 'nav-link-active' : ''}`}
            >
              <Icon style={{ width: 18, height: 18, flexShrink: 0, color: active ? 'var(--primary)' : 'var(--text-3)' }} />
              <span style={{ minWidth: 0, flex: 1 }}>
                <span className="nav-link-title">{label}</span>
                <span className="nav-link-desc">{desc}</span>
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="nav-note stack-8">
        <span className="nav-section-label" style={{ padding: 0 }}>Sources</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <span className="badge badge-primary">Yahoo Finance</span>
          <span className="badge badge-sky">TradingView</span>
          <span className="badge badge-amber">RSS Aggregation</span>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop */}
      <div className="hidden lg:flex" style={{ height: '100%' }}>
        <SidebarContent />
      </div>

      {/* Mobile toggle btn */}
      <button
        className="lg:hidden"
        onClick={() => setOpen(!open)}
        style={{
          position: 'fixed', top: 18, left: 14, zIndex: 300,
          background: 'rgba(9, 24, 36, 0.92)', border: '1px solid var(--border)',
          borderRadius: 14, padding: 10, cursor: 'pointer', color: 'var(--text-2)',
        }}
      >
        {open ? <X style={{ width: 18, height: 18 }} /> : <Menu style={{ width: 18, height: 18 }} />}
      </button>

      {/* Mobile drawer */}
      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(1,6,10,0.72)', backdropFilter: 'blur(6px)', zIndex: 250 }}
          />
          <div style={{ position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 260 }}>
            <SidebarContent />
          </div>
        </>
      )}
    </>
  );
}
