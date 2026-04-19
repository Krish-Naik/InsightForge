'use client';

import { useEffect, useState } from 'react';
import { Lightbulb, TrendingUp, TrendingDown, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { financialsAPI } from '@/lib/api';
import { SectionCard, TrendBadge } from '@/components/ui/page-kit';

interface FinancialInsightData {
  symbol: string;
  summary: string;
  keyInsights: string[];
  quarterlyTrend: string;
  strengths: string[];
  concerns: string[];
  verdict: string;
  financialSummary: any;
  generatedAt: string;
}

export function FinancialInsightSection({ symbol }: { symbol: string }) {
  const [insight, setInsight] = useState<FinancialInsightData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInsight = async () => {
      setLoading(true);
      try {
        const data = await financialsAPI.getInsight(symbol);
        setInsight(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load insight');
        setInsight(null);
      } finally {
        setLoading(false);
      }
    };

    if (symbol) {
      fetchInsight();
    }
  }, [symbol]);

  const getVerdictTone = (verdict: string): 'positive' | 'negative' | 'warning' => {
    if (verdict?.toLowerCase().includes('bullish')) return 'positive';
    if (verdict?.toLowerCase().includes('bearish')) return 'negative';
    return 'warning';
  };

  const getTrendIcon = (trend: string) => {
    if (trend?.toLowerCase().includes('improving')) return <TrendingUp style={{ width: 16, height: 16 }} />;
    if (trend?.toLowerCase().includes('declining')) return <TrendingDown style={{ width: 16, height: 16 }} />;
    return null;
  };

  if (loading) {
    return (
      <SectionCard title="AI Financial Insight" subtitle="Fundamental analysis powered by Grok" icon={Lightbulb}>
        <div className="stack-12">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 32 }} />
          ))}
        </div>
      </SectionCard>
    );
  }

  if (error || !insight) {
    return (
      <SectionCard title="AI Financial Insight" subtitle="Fundamental analysis powered by Grok" icon={Lightbulb}>
        <div className="metric-footnote" style={{ padding: 20, textAlign: 'center' }}>
          {error || 'Unable to generate insight'}
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard 
      title="AI Financial Insight" 
      subtitle="Fundamental analysis powered by Grok" 
      icon={Lightbulb}
    >
      <div className="stack-16">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          {insight.verdict && (
            <TrendBadge tone={getVerdictTone(insight.verdict)}>
              {insight.verdict}
            </TrendBadge>
          )}
          {insight.quarterlyTrend && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--text-2)' }}>
              {getTrendIcon(insight.quarterlyTrend)}
              {insight.quarterlyTrend} Trend
            </div>
          )}
        </div>

        <div className="surface-inset">
          <div className="stat-label">Investment Thesis</div>
          <div className="metric-footnote" style={{ marginTop: 10, lineHeight: 1.6 }}>{insight.summary}</div>
        </div>

        {insight.keyInsights && insight.keyInsights.length > 0 && (
          <div className="stack-8">
            <div className="stat-label">Key Insights</div>
            {insight.keyInsights.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <Lightbulb style={{ width: 14, height: 14, marginTop: 3, color: 'var(--accent)' }} />
                <span className="metric-footnote">{item}</span>
              </div>
            ))}
          </div>
        )}

        <div className="grid-fit-220">
          {insight.strengths && insight.strengths.length > 0 && (
            <div className="surface-inset">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <CheckCircle style={{ width: 14, height: 14, color: 'var(--green)' }} />
                <div className="stat-label">Strengths</div>
              </div>
              <div className="stack-4">
                {insight.strengths.map((s, idx) => (
                  <div key={idx} className="metric-footnote">• {s}</div>
                ))}
              </div>
            </div>
          )}

          {insight.concerns && insight.concerns.length > 0 && (
            <div className="surface-inset">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <AlertCircle style={{ width: 14, height: 14, color: 'var(--red)' }} />
                <div className="stat-label">Concerns</div>
              </div>
              <div className="stack-4">
                {insight.concerns.map((c, idx) => (
                  <div key={idx} className="metric-footnote">• {c}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </SectionCard>
  );
}