'use client';
import { TrendingUp } from 'lucide-react';

export function Header() {
  return (
    <header
      style={{
        height: 52,
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}
    >
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'var(--primary-dim)', border: '1px solid var(--primary-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <TrendingUp style={{ width: 16, height: 16, color: 'var(--primary)' }} />
        </div>
        <div style={{ lineHeight: 1.1 }}>
          <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: '-0.03em', color: 'var(--text-1)' }}>
            StockPulse
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Indian Markets
          </div>
        </div>
      </div>

      {/* Right: Exchange badges + LIVE */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {['NSE', 'BSE', 'MCX'].map((ex) => (
          <span
            key={ex}
            style={{
              fontSize: 9, fontWeight: 700, color: 'var(--text-3)',
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              borderRadius: 4, padding: '2px 6px', textTransform: 'uppercase', letterSpacing: '0.1em',
            }}
          >
            {ex}
          </span>
        ))}

        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
            borderRadius: 6, padding: '4px 10px',
          }}
        >
          <span
            style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)', display: 'inline-block', animation: 'pulse-anim 2s ease-in-out infinite' }}
          />
          <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--green)', letterSpacing: '0.12em' }}>
            LIVE
          </span>
        </div>
      </div>
    </header>
  );
}
