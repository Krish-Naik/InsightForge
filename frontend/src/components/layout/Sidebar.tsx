'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity, Star, Zap, BarChart3, Wallet, Newspaper,
  TrendingUp, X, Menu,
} from 'lucide-react';
import { useState } from 'react';

const NAV = [
  { href: '/market',    label: 'Market',    icon: Activity,  desc: 'Live overview' },
  { href: '/watchlist', label: 'Watchlist', icon: Star,      desc: 'Track stocks' },
  { href: '/scanner',   label: 'Scanner',   icon: Zap,       desc: 'Sector scan' },
  { href: '/screener',  label: 'Screener',  icon: BarChart3, desc: 'Quote analytics' },
  { href: '/portfolio', label: 'Portfolio', icon: Wallet,    desc: 'P&L tracker' },
  { href: '/news',      label: 'News',      icon: Newspaper, desc: 'Market news' },
];

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const SidebarContent = () => (
    <aside
      style={{
        width: 200,
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      <nav style={{ padding: '10px', flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV.map(({ href, label, icon: Icon, desc }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 12px',
                borderRadius: 7,
                textDecoration: 'none',
                transition: 'all 0.12s',
                background: active ? 'var(--primary-dim)' : 'transparent',
                border: active ? '1px solid var(--primary-border)' : '1px solid transparent',
                color: active ? 'var(--primary)' : 'var(--text-2)',
              }}
              className="sidebar-link"
            >
              <Icon
                style={{ width: 16, height: 16, flexShrink: 0, color: active ? 'var(--primary)' : 'var(--text-3)' }}
              />
              <div style={{ lineHeight: 1.2, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
                <div style={{ fontSize: 10, color: active ? 'var(--primary)' : 'var(--text-3)', opacity: 0.8 }}>{desc}</div>
              </div>
              {active && (
                <div style={{ marginLeft: 'auto', width: 3, height: 18, background: 'var(--primary)', borderRadius: 2, flexShrink: 0 }} />
              )}
            </Link>
          );
        })}
      </nav>

      <div style={{ padding: '12px', borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: 9, color: 'var(--text-3)', textAlign: 'center', lineHeight: 1.8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Official Upstox Market Data<br />
          NewsAPI Feed
        </div>
      </div>

      <style>{`
        .sidebar-link:hover {
          background: var(--surface-2) !important;
          color: var(--text-1) !important;
          border-color: var(--border) !important;
        }
      `}</style>
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
          position: 'fixed', top: 12, left: 12, zIndex: 300,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 8, padding: 8, cursor: 'pointer', color: 'var(--text-2)',
        }}
      >
        {open ? <X style={{ width: 18, height: 18 }} /> : <Menu style={{ width: 18, height: 18 }} />}
      </button>

      {/* Mobile drawer */}
      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 250 }}
          />
          <div style={{ position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 260 }}>
            <SidebarContent />
          </div>
        </>
      )}
    </>
  );
}
