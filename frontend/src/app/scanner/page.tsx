'use client';

import { useCallback, useEffect, useState } from 'react';
import { 
  Activity, AlertTriangle, ArrowRight, BarChart3, BrainCircuit, 
  Calendar, Clock, Filter, Flame, Focus, Gauge, HelpCircle, 
  RefreshCw, ShieldAlert, Sparkles, TrendingDown, TrendingUp, 
  Users, Zap, Target, Signal
} from 'lucide-react';
import Link from 'next/link';
import { marketAPI, type OpportunityCard, type RadarResponse } from '@/lib/api';
import { formatCurrency, formatLargeNumber, formatPercent, formatTimeAgo } from '@/lib/format';

type Timeframe = 'intraday' | 'swing';
type RiskProfile = 'aggressive' | 'balanced' | 'conservative';
type SignalType = 'breakout' | 'reversal' | 'momentum' | 'volume' | 'sector-rotation' | 'news';

interface StrategyConfig {
  timeframe: Timeframe;
  riskProfile: RiskProfile;
}

const TIMEFRAMES: { id: Timeframe; label: string; description: string }[] = [
  { id: 'intraday', label: 'Intraday', description: 'Same-day trades, quick moves' },
  { id: 'swing', label: 'Swing', description: '2-10 day holding period' },
];

const RISK_PROFILES: { id: RiskProfile; label: string; description: string }[] = [
  { id: 'conservative', label: 'Conservative', description: 'Lower risk, proven setups' },
  { id: 'balanced', label: 'Balanced', description: 'Moderate risk/reward' },
  { id: 'aggressive', label: 'Aggressive', description: 'Higher risk, higher potential' },
];

const SIGNAL_TYPES: { id: SignalType; label: string; icon: React.ElementType }[] = [
  { id: 'breakout', label: 'Breakout', icon: TrendingUp },
  { id: 'reversal', label: 'Reversal', icon: TrendingDown },
  { id: 'momentum', label: 'Momentum', icon: Zap },
  { id: 'volume', label: 'Volume Spike', icon: BarChart3 },
  { id: 'sector-rotation', label: 'Sector Rotation', icon: Users },
  { id: 'news', label: 'News Move', icon: Sparkles },
];

function SignalTypeIcon({ type }: { type: SignalType }) {
  const config = SIGNAL_TYPES.find(s => s.id === type);
  const Icon = config?.icon || Signal;
  return <Icon style={{ width: 16, height: 16 }} />;
}

function ConfidenceMeter({ value }: { value: number }) {
  const percentage = Math.min(100, Math.max(0, value));
  const color = percentage >= 70 ? 'var(--green)' : percentage >= 40 ? 'var(--amber)' : 'var(--red)';
  
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: 'var(--bg-2)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${percentage}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
      <span className="mono" style={{ fontSize: 12, fontWeight: 600, width: 32 }}>{Math.round(percentage)}%</span>
    </div>
  );
}

function OpportunityCardRadar({ 
  opportunity
}: { 
  opportunity: OpportunityCard;
}) {
  const isBullish = opportunity.direction === 'bullish';
  const signalType = opportunity.setup?.toLowerCase().includes('breakout') ? 'breakout' :
                     opportunity.setup?.toLowerCase().includes('reversal') ? 'reversal' :
                     opportunity.setup?.toLowerCase().includes('volume') ? 'volume' : 'momentum';

  return (
    <article className={`card ${isBullish ? 'opportunity-card-bullish' : 'opportunity-card-bearish'}`} style={{ padding: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="opportunity-symbol">{opportunity.symbol}</span>
            <span className={`badge ${isBullish ? 'badge-green' : 'badge-red'}`}>
              {isBullish ? <TrendingUp style={{ width: 10, height: 10 }} /> : <TrendingDown style={{ width: 10, height: 10 }} />}
              {opportunity.direction}
            </span>
          </div>
          <div className="opportunity-name">{opportunity.name}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="opportunity-price">{formatCurrency(opportunity.quote?.price || 0)}</div>
          <div className={`opportunity-move ${(opportunity.quote?.changePercent || 0) >= 0 ? 'text-green' : 'text-red'}`}>
            {formatPercent(opportunity.quote?.changePercent || 0)}
          </div>
        </div>
      </div>

      {/* Signal Details */}
      <div className="surface-inset" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <SignalTypeIcon type={signalType as SignalType} />
            <span style={{ fontWeight: 600, fontSize: 13 }}>{opportunity.setup}</span>
          </div>
          <span className="badge badge-muted">{opportunity.state}</span>
        </div>
        <div className="metric-footnote" style={{ marginTop: 8, lineHeight: 1.5 }}>
          {opportunity.whyNow}
        </div>
      </div>

      {/* Metrics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
        <div className="opportunity-level">
          <span>Volume</span>
          <strong>{formatLargeNumber(opportunity.quote?.volume || 0)}</strong>
        </div>
        <div className="opportunity-level">
          <span>RSI</span>
          <strong>{opportunity.analytics?.rsi14 || '—'}</strong>
        </div>
        <div className="opportunity-level">
          <span>Sector</span>
          <strong style={{ fontSize: 11 }}>{opportunity.labels?.[0] || '—'}</strong>
        </div>
      </div>

      {/* Confidence */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span className="stat-label">Confidence</span>
          <span className="mono" style={{ fontSize: 11, fontWeight: 600 }}>{opportunity.confidence}/100</span>
        </div>
        <ConfidenceMeter value={opportunity.confidence} />
      </div>

      {/* Why Explanation */}
      {opportunity.risk && (
        <div style={{ marginBottom: 12, padding: 10, background: 'var(--bg-2)', borderRadius: 8 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
            <BrainCircuit style={{ width: 12, height: 12, color: 'var(--text-2)' }} />
            <span className="stat-label">Why this signal?</span>
          </div>
          <div className="metric-footnote">{opportunity.risk}</div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        <Link 
          href={`/stocks/${encodeURIComponent(opportunity.symbol)}`} 
          className="btn btn-primary"
          style={{ flex: 1, fontSize: 11, padding: '8px 12px' }}
        >
          View Analysis <ArrowRight style={{ width: 12, height: 12 }} />
        </Link>
        <button className="btn btn-ghost" style={{ padding: 8 }}>
          <Sparkles style={{ width: 14, height: 14 }} />
        </button>
      </div>
    </article>
  );
}

export default function RadarPage() {
  const [config, setConfig] = useState<StrategyConfig>({
    timeframe: 'swing',
    riskProfile: 'balanced',
  });
  const [radar, setRadar] = useState<RadarResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sortBy, setSortBy] = useState<'confidence' | 'urgency' | 'volume'>('confidence');
  const [signalFilter, setSignalFilter] = useState<SignalType | 'all'>('all');

  const loadRadar = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await marketAPI.getOpportunityRadar('momentum', config.timeframe, config.riskProfile);
      setRadar(data);
    } catch (error) {
      console.error('Radar load error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [config.timeframe, config.riskProfile]);

  useEffect(() => {
    void loadRadar();
  }, [loadRadar]);

  const filteredOpportunities = radar?.opportunities.filter(opp => {
    if (signalFilter === 'all') return true;
    return opp.setup?.toLowerCase().includes(signalFilter);
  }) || [];

  const sortedOpportunities = [...filteredOpportunities].sort((a, b) => {
    switch (sortBy) {
      case 'confidence':
        return b.confidence - a.confidence;
      case 'volume':
        return (b.quote?.volume || 0) - (a.quote?.volume || 0);
      case 'urgency':
        return (b.quote?.changePercent || 0) - (a.quote?.changePercent || 0);
      default:
        return 0;
    }
  });

  const liveSignals = radar?.signalFeed?.filter(s => s.strength >= 7) || [];
  const confirmedSignals = radar?.signalFeed?.filter(s => s.strength < 7) || [];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-kicker">AI Radar</div>
          <h1 className="page-title">Opportunity Discovery</h1>
          <p className="page-subtitle">
            AI-generated trading opportunities based on strategy, timeframe, and market behavior. 
            Different from manual screening - signals are auto-detected and ranked by confidence.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {radar?.generatedAt && (
            <span className="topbar-pill">
              <Clock style={{ width: 12, height: 12 }} />
              Updated {formatTimeAgo(radar.generatedAt)}
            </span>
          )}
          <button onClick={() => loadRadar()} disabled={refreshing} className="btn btn-primary">
            <RefreshCw style={{ width: 14, height: 14 }} className={refreshing ? 'anim-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Strategy Selectors */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
          {/* Timeframe */}
          <div>
            <div className="stat-label" style={{ marginBottom: 8 }}>
              <Calendar style={{ width: 14, height: 14, display: 'inline', marginRight: 6 }} />
              Timeframe
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {TIMEFRAMES.map(tf => (
                <button
                  key={tf.id}
                  onClick={() => setConfig(prev => ({ ...prev, timeframe: tf.id }))}
                  className={`btn ${config.timeframe === tf.id ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ flex: 1 }}
                >
                  {tf.label}
                </button>
              ))}
            </div>
          </div>

          {/* Risk Profile */}
          <div>
            <div className="stat-label" style={{ marginBottom: 8 }}>
              <Gauge style={{ width: 14, height: 14, display: 'inline', marginRight: 6 }} />
              Risk Profile
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {RISK_PROFILES.map(rp => (
                <button
                  key={rp.id}
                  onClick={() => setConfig(prev => ({ ...prev, riskProfile: rp.id }))}
                  className={`btn ${config.riskProfile === rp.id ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ flex: 1 }}
                >
                  {rp.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="metric-strip-grid">
        <div className="metric-card">
          <div className="stat-label">Signals Found</div>
          <div className="metric-value">{radar?.signalFeed?.length || 0}</div>
          <div className="metric-footnote">Total detected</div>
        </div>
        <div className="metric-card">
          <div className="stat-label">Live Signals</div>
          <div className="metric-value" style={{ color: 'var(--green)' }}>{liveSignals.length}</div>
          <div className="metric-footnote">Strength 7+</div>
        </div>
        <div className="metric-card">
          <div className="stat-label">Confirmed</div>
          <div className="metric-value" style={{ color: 'var(--amber)' }}>{confirmedSignals.length}</div>
          <div className="metric-footnote">Strength &lt; 7</div>
        </div>
        <div className="metric-card">
          <div className="stat-label">Opportunities</div>
          <div className="metric-value">{sortedOpportunities.length}</div>
          <div className="metric-footnote">Ranked by {sortBy}</div>
        </div>
      </div>

      {/* Signal Types & Sorting */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => setSignalFilter('all')}
              className={`btn ${signalFilter === 'all' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ padding: '6px 12px' }}
            >
              All Signals
            </button>
            {SIGNAL_TYPES.map(st => (
              <button
                key={st.id}
                onClick={() => setSignalFilter(st.id)}
                className={`btn ${signalFilter === st.id ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '6px 12px', fontSize: 11 }}
              >
                <st.icon style={{ width: 12, height: 12, marginRight: 4 }} />
                {st.label}
              </button>
            ))}
          </div>
          
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="stat-label">Sort by:</span>
            <div className="tab-group">
              <button onClick={() => setSortBy('confidence')} className={`tab ${sortBy === 'confidence' ? 'tab-active' : ''}`}>
                Confidence
              </button>
              <button onClick={() => setSortBy('urgency')} className={`tab ${sortBy === 'urgency' ? 'tab-active' : ''}`}>
                Urgency
              </button>
              <button onClick={() => setSortBy('volume')} className={`tab ${sortBy === 'volume' ? 'tab-active' : ''}`}>
                Volume
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Opportunity Cards */}
      {loading && !radar ? (
        <div className="compact-card-grid">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 320 }} />
          ))}
        </div>
      ) : sortedOpportunities.length === 0 ? (
        <div className="empty-state">
          <Target style={{ width: 40, height: 40, color: 'var(--text-3)' }} />
          <div style={{ fontWeight: 600, fontSize: 16 }}>No signals found</div>
          <div className="metric-footnote">Try adjusting your timeframe or risk profile</div>
        </div>
      ) : (
        <div className="compact-card-grid">
          {sortedOpportunities.map((opportunity, index) => (
            <OpportunityCardRadar
              key={`${opportunity.id}-${index}`}
              opportunity={opportunity}
            />
          ))}
        </div>
      )}
    </div>
  );
}
