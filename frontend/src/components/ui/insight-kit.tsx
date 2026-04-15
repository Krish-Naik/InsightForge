'use client';

import Link from 'next/link';
import { ArrowRight, Flame, Radar, ShieldAlert, Target, TrendingDown, TrendingUp } from 'lucide-react';
import { SymbolLink } from '@/components/ui/SymbolLink';
import { TrendBadge } from '@/components/ui/page-kit';
import type { InsightTone, OpportunityCard, RecapCard, SectorRotationInsight, StoryTimelineEntry } from '@/lib/api';
import { formatCurrency, formatPercent } from '@/lib/format';

function toneToBadge(tone: InsightTone | 'positive' | 'negative' | 'warning' | 'primary') {
  if (tone === 'bullish' || tone === 'positive') return 'positive' as const;
  if (tone === 'bearish' || tone === 'negative') return 'negative' as const;
  if (tone === 'balanced' || tone === 'warning') return 'warning' as const;
  if (tone === 'primary') return 'primary' as const;
  return 'default' as const;
}

function directionIcon(direction: OpportunityCard['direction']) {
  if (direction === 'bullish') return TrendingUp;
  if (direction === 'bearish') return TrendingDown;
  return Radar;
}

export function OpportunityInsightCard({
  opportunity,
  rank,
  compact = false,
}: {
  opportunity: OpportunityCard;
  rank?: number;
  compact?: boolean;
}) {
  const tone = toneToBadge(opportunity.direction);
  const Icon = directionIcon(opportunity.direction);
  const price = opportunity.quote?.price || opportunity.analytics?.currentPrice || 0;
  const move = opportunity.quote?.changePercent ?? opportunity.analytics?.changePercent ?? 0;

  return (
    <article className={`opportunity-card opportunity-card-${opportunity.direction}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <div className="stack-8" style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {typeof rank === 'number' ? <span className="rank-pill">#{rank}</span> : null}
            <TrendBadge tone={tone}>{opportunity.setup}</TrendBadge>
            <span className="badge badge-muted">{opportunity.state}</span>
          </div>
          <div>
            <div className="opportunity-symbol">{opportunity.symbol}</div>
            <div className="opportunity-name">{opportunity.name}</div>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div className="opportunity-price">{formatCurrency(price)}</div>
          <div className={`opportunity-move ${move >= 0 ? 'text-green' : 'text-red'}`}>{formatPercent(move)}</div>
        </div>
      </div>

      <div className="opportunity-context">
        <Icon style={{ width: 16, height: 16, color: 'var(--primary)' }} />
        <span>{opportunity.whyNow}</span>
      </div>

      <div className="opportunity-chip-row">
        {opportunity.labels.slice(0, compact ? 3 : 4).map((label) => (
          <span key={`${opportunity.symbol}-${label}`} className="badge badge-muted">{label}</span>
        ))}
        <span className="badge badge-primary">Confidence {opportunity.confidence}</span>
      </div>

      {opportunity.scoreBreakdown?.length ? (
        <div className="stack-8">
          {opportunity.scoreBreakdown.slice(0, compact ? 2 : 3).map((entry) => (
            <div key={`${opportunity.symbol}-${entry.label}`} className="metric-footnote">
              <span style={{ color: entry.contribution >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
                {entry.contribution >= 0 ? '+' : ''}{Math.round(entry.contribution)}
              </span>{' '}
              {entry.label} · {entry.detail}
            </div>
          ))}
        </div>
      ) : null}

      {!compact ? (
        <div className="opportunity-level-grid">
          <div className="opportunity-level">
            <span>Trigger</span>
            <strong>{opportunity.triggerPrice ? formatCurrency(opportunity.triggerPrice) : 'Watch price'}</strong>
          </div>
          <div className="opportunity-level">
            <span>Invalidation</span>
            <strong>{opportunity.invalidationPrice ? formatCurrency(opportunity.invalidationPrice) : 'Context shift'}</strong>
          </div>
        </div>
      ) : null}

      <div className="opportunity-progress">
        <div className="opportunity-progress-bar" style={{ width: `${opportunity.confidence}%` }} />
      </div>

      <div className="opportunity-footnote">{compact ? opportunity.watchNext : opportunity.risk}</div>

      <div className="card-action-row">
        <Link href={`/stocks/${encodeURIComponent(opportunity.symbol)}`} className="card-link">
          Open story
          <ArrowRight style={{ width: 13, height: 13 }} />
        </Link>
        <SymbolLink symbol={opportunity.symbol} className="card-link card-link-muted">
          Open chart
        </SymbolLink>
      </div>
    </article>
  );
}

export function SectorPulseCard({ entry }: { entry: SectorRotationInsight }) {
  const tone = toneToBadge(entry.trend === 'bullish' ? 'bullish' : entry.trend === 'bearish' ? 'bearish' : 'balanced');

  return (
    <article className={`sector-pulse-card sector-pulse-${entry.trend}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <div>
          <div className="stat-label">{entry.movement}</div>
          <div className="sector-pulse-title">{entry.sector}</div>
        </div>
        <TrendBadge tone={tone}>{entry.breadthLabel}</TrendBadge>
      </div>

      <p className="sector-pulse-summary">{entry.summary}</p>

      <div className="sector-pulse-meta">
        <span>{entry.leaderSymbol ? `Leader ${entry.leaderSymbol}` : 'Leader pending'}</span>
        <span>{entry.laggardSymbol ? `Laggard ${entry.laggardSymbol}` : 'Laggard pending'}</span>
      </div>
    </article>
  );
}

export function RecapInsightCard({ entry }: { entry: RecapCard }) {
  const tone = toneToBadge(entry.tone);
  const Icon = entry.tone === 'bullish' ? Flame : entry.tone === 'bearish' ? ShieldAlert : Target;

  return (
    <article className="recap-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <div>
          <div className="stat-label">Recap</div>
          <div className="recap-card-title">{entry.title}</div>
        </div>
        <TrendBadge tone={tone}>
          <Icon style={{ width: 12, height: 12 }} />
          {entry.tone}
        </TrendBadge>
      </div>

      <p className="recap-card-copy">{entry.detail}</p>

      <div className="opportunity-chip-row">
        {entry.symbols.map((symbol) => (
          <Link key={`${entry.title}-${symbol}`} href={`/stocks/${encodeURIComponent(symbol)}`} className="badge badge-muted" style={{ textDecoration: 'none' }}>
            {symbol}
          </Link>
        ))}
      </div>
    </article>
  );
}

export function StoryTimeline({ items }: { items: StoryTimelineEntry[] }) {
  return (
    <div className="timeline-list">
      {items.map((item) => (
        <div key={`${item.label}-${item.detail}`} className="timeline-item">
          <div className="timeline-dot" />
          <div className="stack-8">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <div className="timeline-label">{item.label}</div>
              <TrendBadge tone={toneToBadge(item.tone)}>{item.tone}</TrendBadge>
            </div>
            <div className="timeline-copy">{item.detail}</div>
          </div>
        </div>
      ))}
    </div>
  );
}