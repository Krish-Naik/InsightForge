'use client';

import type { CSSProperties, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

type Tone = 'default' | 'primary' | 'positive' | 'negative' | 'warning';

const toneStyles: Record<Tone, CSSProperties> = {
  default: {
    borderColor: 'var(--border)',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015))',
  },
  primary: {
    borderColor: 'rgba(77, 199, 255, 0.28)',
    background: 'linear-gradient(135deg, rgba(77, 199, 255, 0.12), rgba(19, 224, 161, 0.08))',
  },
  positive: {
    borderColor: 'rgba(50, 211, 139, 0.24)',
    background: 'linear-gradient(135deg, rgba(50, 211, 139, 0.12), rgba(77, 199, 255, 0.04))',
  },
  negative: {
    borderColor: 'rgba(255, 108, 121, 0.24)',
    background: 'linear-gradient(135deg, rgba(255, 108, 121, 0.12), rgba(255, 191, 94, 0.04))',
  },
  warning: {
    borderColor: 'rgba(255, 191, 94, 0.24)',
    background: 'linear-gradient(135deg, rgba(255, 191, 94, 0.12), rgba(77, 199, 255, 0.04))',
  },
};

const toneText: Record<Tone, string> = {
  default: 'var(--text-1)',
  primary: 'var(--primary)',
  positive: 'var(--green)',
  negative: 'var(--red)',
  warning: 'var(--amber)',
};

export function PageHeader({
  kicker,
  title,
  description,
  actions,
}: {
  kicker: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        <div className="page-kicker">{kicker}</div>
        <h1 className="page-title">{title}</h1>
        <p className="page-subtitle">{description}</p>
      </div>
      {actions ? <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>{actions}</div> : null}
    </div>
  );
}

export function SectionCard({
  title,
  subtitle,
  icon: Icon,
  tone = 'default',
  actions,
  children,
  style,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  tone?: Tone;
  actions?: ReactNode;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <section className="panel" style={{ ...toneStyles[tone], ...style }}>
      <div className="panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {Icon ? <Icon style={{ width: 16, height: 16, color: toneText[tone] }} /> : null}
          <div>
            <div className="panel-title">{title}</div>
            {subtitle ? <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-3)' }}>{subtitle}</div> : null}
          </div>
        </div>
        {actions}
      </div>
      <div className="panel-body">{children}</div>
    </section>
  );
}

export function MetricTile({
  label,
  value,
  subtext,
  tone = 'default',
  icon: Icon,
}: {
  label: string;
  value: ReactNode;
  subtext?: ReactNode;
  tone?: Tone;
  icon?: LucideIcon;
}) {
  return (
    <div className="metric-card" style={toneStyles[tone]}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <div>
          <div className="stat-label">{label}</div>
          <div className="metric-value" style={{ color: toneText[tone] === 'var(--text-1)' ? 'var(--text-1)' : toneText[tone] }}>{value}</div>
        </div>
        {Icon ? <Icon style={{ width: 18, height: 18, color: toneText[tone], flexShrink: 0 }} /> : null}
      </div>
      {subtext ? <div className="metric-footnote">{subtext}</div> : null}
    </div>
  );
}

export function TrendBadge({ tone, children }: { tone: Tone; children: ReactNode }) {
  const className = tone === 'positive'
    ? 'badge badge-green'
    : tone === 'negative'
      ? 'badge badge-red'
      : tone === 'warning'
        ? 'badge badge-amber'
        : tone === 'primary'
          ? 'badge badge-primary'
          : 'badge badge-muted';

  return <span className={className}>{children}</span>;
}

export function EmptyPanel({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <div className="empty-state">
      <Icon style={{ width: 28, height: 28, color: 'var(--text-3)' }} />
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>{title}</div>
      <div style={{ maxWidth: 480, lineHeight: 1.6 }}>{description}</div>
    </div>
  );
}