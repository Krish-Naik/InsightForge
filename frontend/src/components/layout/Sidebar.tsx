'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity, Compass, Menu, Newspaper, Star, TimerReset, Wallet, X, Zap,
} from 'lucide-react';
import { useState } from 'react';

const NAV = [
  { href: '/', label: 'Today', icon: Activity, desc: 'Live brief, top opportunities, sector flow' },
  { href: '/scanner', label: 'Radar', icon: Zap, desc: 'Auto-detected setups and avoid lists' },
  { href: '/screener', label: 'Guided Screener', icon: Compass, desc: 'Playbooks instead of filter mazes' },
  { href: '/watchlist', label: 'Watchlist', icon: Star, desc: 'Names ranked by urgency and timing' },
  { href: '/portfolio', label: 'Portfolio', icon: Wallet, desc: 'Conviction, exposure, and carry' },
  { href: '/news', label: 'Story Feed', icon: Newspaper, desc: 'Why the market is behaving this way' },
  { href: '/recap', label: 'Recap', icon: TimerReset, desc: 'What worked, what faded, what carries' },
];

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const SidebarContent = () => (
    <aside className="nav-shell">
      <div className="nav-note stack-8">
        <span className="page-kicker">Decision Flow</span>
        <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>
          Start from what matters now, then expand into evidence only when the setup earns your attention.
        </div>
      </div>

      <div className="nav-section-label">Core</div>
      <nav className="stack-8" style={{ flex: 1 }}>
        {NAV.map(({ href, label, icon: Icon, desc }) => {
          const active = href === '/' ? pathname === '/' : pathname === href;
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
        <span className="nav-section-label" style={{ padding: 0 }}>Stack</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <span className="badge badge-primary">Delayed market feed</span>
          <span className="badge badge-sky">Insight ranking</span>
          <span className="badge badge-amber">Story intelligence</span>
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
