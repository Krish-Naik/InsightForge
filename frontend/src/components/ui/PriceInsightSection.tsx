'use client';

import { useEffect, useState } from 'react';
import { Zap, TrendingUp, TrendingDown, AlertTriangle, Target, Clock } from 'lucide-react';
import { financialsAPI } from '@/lib/api';
import { SectionCard, TrendBadge } from '@/components/ui/page-kit';

interface PriceInsightData {
  symbol: string;
  summary: string;
  priceDrivers: string[];
  catalysts: string[];
  forecast: string;
  riskFactors: string[];
  opportunity: string;
  priceData: {
    price: number;
    change: number;
    changePercent: number;
    volume: number;
    high52w: number;
    low52w: number;
  };
  generatedAt: string;
}

export function PriceInsightSection({ symbol }: { symbol: string }) {
  const [insight, setInsight] = useState<PriceInsightData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInsight = async () => {
      setLoading(true);
      try {
        const data = await financialsAPI.getPriceInsight(symbol);
        setInsight(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load price insight');
        setInsight(null);
      } finally {
        setLoading(false);
      }
    };

    if (symbol) {
      fetchInsight();
    }
  }, [symbol]);

  const getForecastTone = (forecast: string): 'positive' | 'negative' | 'warning' => {
    if (forecast?.toLowerCase().includes('bullish')) return 'positive';
    if (forecast?.toLowerCase().includes('bearish')) return 'negative';
    return 'warning';
  };

  const formatVolume = (vol?: number) => {
    if (!vol) return 'N/A';
    if (vol >= 1e7) return (vol / 1e7).toFixed(2) + 'Cr';
    if (vol >= 1e5) return (vol / 1e5).toFixed(2) + 'L';
    return vol.toLocaleString();
  };

  const formatPrice = (price?: number) => {
    if (!price) return 'N/A';
    return '₹' + price.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  };

  if (loading) {
    return (
      <SectionCard title="AI Price Insight" subtitle="Why the price is moving" icon={Zap}>
        <div className="stack-12">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 28 }} />
          ))}
        </div>
      </SectionCard>
    );
  }

  if (error || !insight) {
    return (
      <SectionCard title="AI Price Insight" subtitle="Why the price is moving" icon={Zap}>
        <div className="metric-footnote" style={{ padding: 20, textAlign: 'center' }}>
          {error || 'Unable to generate insight'}
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="AI Price Insight" subtitle="Why the price is moving" icon={Zap}>
      <div className="stack-16">
        {insight.priceData && (
          <div className="surface-inset">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div className="stat-label">Current Price</div>
                <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-1)' }}>
                  {formatPrice(insight.priceData.price)}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="stat-label">Day Change</div>
                <div style={{ 
                  fontSize: 18, 
                  fontWeight: 600, 
                  color: insight.priceData.changePercent >= 0 ? 'var(--green)' : 'var(--red)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: 6
                }}>
                  {insight.priceData.changePercent >= 0 ? <TrendingUp style={{ width: 18, height: 18 }} /> : <TrendingDown style={{ width: 18, height: 18 }} />}
                  {insight.priceData.change >= 0 ? '+' : ''}{insight.priceData.changePercent?.toFixed(2)}%
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 24, marginTop: 12, fontSize: 13, color: 'var(--text-2)' }}>
              <div>Vol: {formatVolume(insight.priceData.volume)}</div>
              <div>52W High: {formatPrice(insight.priceData.high52w)}</div>
              <div>52W Low: {formatPrice(insight.priceData.low52w)}</div>
            </div>
          </div>
        )}

        {insight.forecast && (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <TrendBadge tone={getForecastTone(insight.forecast)}>
              {insight.forecast}
            </TrendBadge>
          </div>
        )}

        <div className="surface-inset">
          <div className="stat-label">Why & How is the price changing? (Driver, Latest News, Sentiment)</div>
          <div className="metric-footnote" style={{ marginTop: 8, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
            {insight.summary}
          </div>
        </div>

        {insight.priceDrivers && insight.priceDrivers.length > 0 && (
          <div className="stack-8">
            <div className="stat-label">Price Drivers</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {insight.priceDrivers.map((driver, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <Zap style={{ width: 14, height: 14, marginTop: 3, color: 'var(--accent)' }} />
                  <span className="metric-footnote">{driver}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid-fit-220">
          {insight.catalysts && insight.catalysts.length > 0 && (
            <div className="surface-inset">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Target style={{ width: 14, height: 14, color: 'var(--green)' }} />
                <div className="stat-label">Catalysts</div>
              </div>
              <div className="stack-4">
                {insight.catalysts.map((c, idx) => (
                  <div key={idx} className="metric-footnote">• {c}</div>
                ))}
              </div>
            </div>
          )}

          {insight.riskFactors && insight.riskFactors.length > 0 && (
            <div className="surface-inset">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <AlertTriangle style={{ width: 14, height: 14, color: 'var(--red)' }} />
                <div className="stat-label">Risk Factors</div>
              </div>
              <div className="stack-4">
                {insight.riskFactors.map((r, idx) => (
                  <div key={idx} className="metric-footnote">• {r}</div>
                ))}
              </div>
            </div>
          )}
        </div>

        {insight.opportunity && (
          <div className="surface-tone-positive">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Clock style={{ width: 14, height: 14, color: 'var(--green)' }} />
              <div className="stat-label">Opportunity</div>
            </div>
            <div className="metric-footnote">{insight.opportunity}</div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}