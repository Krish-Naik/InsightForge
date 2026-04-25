'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, Sun, Moon } from 'lucide-react';
import { useState, useEffect } from 'react';

const NAV = [
  { href: '/', label: 'Market Overview' },
  { href: '/radar', label: 'Market Mover' },
  { href: '/news', label: 'News' },
  { href: '/watchlist', label: 'Watchlist' },
  { href: '/portfolio', label: 'Portfolio' },
];

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved) {
      setIsDark(saved === 'dark');
      document.documentElement.setAttribute('data-theme', saved);
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = isDark ? 'light' : 'dark';
    setIsDark(!isDark);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const SidebarContent = () => (
    <aside className="nav-shell" style={{ paddingTop: 40, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <nav className="stack-8">
        {NAV.map(({ href, label }) => {
          const active = href === '/' ? pathname === '/' : pathname === href;
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={`nav-link ${active ? 'nav-link-active' : ''}`}
            >
              <span className="nav-link-title">{label}</span>
            </Link>
          );
        })}
      </nav>
      <button onClick={toggleTheme} className="nav-link theme-toggle" style={{ gap: 12, cursor: 'pointer', borderRadius: 12, marginTop: 12, padding: '16px 20px' }}>
        {isDark ? <Sun style={{ width: 22, height: 22, color: '#fbbf24' }} /> : <Moon style={{ width: 22, height: 22, color: '#818cf8' }} />}
        <span className="nav-link-title theme-toggle-text" style={{ color: 'inherit', fontSize: 16 }}>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
      </button>
    </aside>
  );

  return (
    <>
      <div className="hidden lg:flex" style={{ position: 'fixed', top: 98, left: 0, height: 'calc(100vh - 98px)', zIndex: 50 }}>
        <SidebarContent />
      </div>

      <button
        className="lg:hidden"
        onClick={() => setOpen(!open)}
        style={{
          position: 'fixed', top: 16, left: 12, zIndex: 300,
          background: 'var(--surface)', border: '1px solid var(--border-light)',
          borderRadius: 10, padding: 10, cursor: 'pointer', color: 'var(--text-2)',
        }}
      >
        {open ? <X style={{ width: 20, height: 20 }} /> : <Menu style={{ width: 20, height: 20 }} />}
      </button>

      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 250 }}
          />
          <div style={{ position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 260, width: 300 }}>
            <SidebarContent />
          </div>
        </>
      )}
    </>
  );
}
