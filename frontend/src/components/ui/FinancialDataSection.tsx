'use client';

import { useEffect, useState } from 'react';
import { Banknote, TrendingUp, PieChart, Scale, Activity, ChevronDown, ChevronUp, Building2 } from 'lucide-react';
import { financialsAPI, marketAPI, type FinancialMetrics, type Quote } from '@/lib/api';
import { formatCurrency, formatNumber, formatPercent } from '@/lib/format';
import { MetricTile, SectionCard, TrendBadge } from '@/components/ui/page-kit';

interface QuarterData {
  year: number;
  quarter: string;
  revenueFromOperations: number | null;
  profitAfterTax: number | null;
  eps: number | null;
  roe: number | null;
  roce: number | null;
  netMargin: number | null;
  roa: number | null;
  debtToEquity: number | null;
  currentRatio: number | null;
  grossMargin: number | null;
  dividendYield: number | null;
  bookValuePerShare: number | null;
  revenueGrowth: number | null;
  profitGrowth: number | null;
}

function formatValue(val: number | null | undefined, type: 'currency' | 'number' | 'percent'): string {
  if (val === null || val === undefined) return '—';
  switch (type) {
    case 'currency': return formatCurrency(val);
    case 'number': return formatNumber(val);
    case 'percent': return formatPercent(val);
    default: return String(val);
  }
}

function formatMarketCap(val: number | null | undefined): string {
  if (val === null || val === undefined) return '—';
  if (val >= 1e12) return `₹${(val / 1e12).toFixed(2)}T`;
  if (val >= 1e10) return `₹${(val / 1e10).toFixed(2)}L Cr`;
  if (val >= 1e7) return `₹${(val / 1e7).toFixed(2)}Cr`;
  if (val >= 1e5) return `₹${(val / 1e5).toFixed(2)}L`;
  return formatCurrency(val);
}

function getTone(val: number | null | undefined, thresholds: { good?: number; bad?: number }): 'positive' | 'negative' | 'primary' {
  if (val === null || val === undefined) return 'primary';
  if (thresholds.good !== undefined && val >= thresholds.good) return 'positive';
  if (thresholds.bad !== undefined && val <= thresholds.bad) return 'negative';
  return 'primary';
}

export function FinancialDataSection({ symbol }: { symbol: string }) {
  const [metrics, setMetrics] = useState<FinancialMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [metricsData, quoteData] = await Promise.all([
          financialsAPI.getMetrics(symbol),
          marketAPI.getQuote(symbol).catch(() => null)
        ]);
        setMetrics(metricsData);
        setQuote(quoteData);
      } catch (err) {
        setMetrics(null);
      } finally {
        setLoading(false);
      }
    };

    if (symbol) {
      fetchData();
    }
  }, [symbol]);

  if (loading) {
    return (
      <SectionCard title="Fundamentals" subtitle="Quarterly financial data" icon={Banknote}>
        <div className="stack-12">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 48 }} />
          ))}
        </div>
      </SectionCard>
    );
  }

  if (!metrics || !metrics.latest) {
    return (
      <SectionCard title="Fundamentals" subtitle="Quarterly financial data" icon={Banknote}>
        <div className="metric-footnote" style={{ padding: 20, textAlign: 'center' }}>
          No financial data available for {symbol}
        </div>
      </SectionCard>
    );
  }

  const latest = metrics.latest;
  const annual = metrics.annual;
  const quarters = (metrics.quarters || []).slice(0, 8).reverse();
  
  const sharesOutstanding = quarters[0]?.numberOfSharesOutstanding || (latest?.totalEquity && latest?.bookValuePerShare ? Math.round(latest.totalEquity / latest.bookValuePerShare) : null);
  const calculatedMarketCap = quote && sharesOutstanding ? quote.price * sharesOutstanding : null;
  const displayMarketCap = quote?.marketCap || calculatedMarketCap;

  const annualEps = latest?.eps ? latest.eps * 4 : null;
  const pe = quote && annualEps ? quote.price / annualEps : null;
  const pb = quote && latest?.bookValuePerShare ? quote.price / latest.bookValuePerShare : null;

  return (
    <SectionCard 
      title="Fundamentals" 
      subtitle="Quarterly financial performance" 
      icon={Banknote}
      actions={
        quarters.length > 0 ? (
          <button 
            onClick={() => setExpanded(!expanded)}
            className="btn btn-ghost"
            style={{ fontSize: 12, padding: '4px 8px' }}
          >
            {expanded ? 'Hide' : 'Show'} {quarters.length} quarters
            {expanded ? <ChevronUp style={{ width: 14, height: 14, marginLeft: 4 }} /> : <ChevronDown style={{ width: 14, height: 14, marginLeft: 4 }} />}
          </button>
        ) : null
      }
    >
      <div className="stack-16">
        {quote && (
          <div className="grid-fit-180">
            <MetricTile label="Market Cap" value={formatMarketCap(displayMarketCap)} tone="primary" icon={Building2} />
            <MetricTile label="Current Price" value={formatCurrency(quote.price)} tone="primary" icon={TrendingUp} subtext={quote.change >= 0 ? `+${formatPercent(quote.changePercent)}` : formatPercent(quote.changePercent)} />
            <MetricTile label="PE Ratio" value={pe && pe > 0 && pe < 500 ? formatNumber(pe) : '—'} tone={pe && pe > 0 && pe < 25 ? 'positive' : pe && pe > 40 ? 'warning' : 'primary'} />
            <MetricTile label="PB Ratio" value={pb && pb > 0 && pb < 100 ? formatNumber(pb) : '—'} tone={pb && pb > 0 && pb < 3 ? 'positive' : pb && pb > 10 ? 'warning' : 'primary'} />
          </div>
        )}

        <div style={{ overflowX: 'auto', margin: '-8px', padding: '8px' }}>
          <table className="financial-table" style={{ width: '100%', minWidth: 800 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '10px 16px', background: 'var(--bg-2)', fontWeight: 600, width: 140 }}>Metric</th>
                {quarters.map((q: any) => (
                  <th key={`${q.year}-${q.quarter}`} style={{ textAlign: 'right', padding: '10px 16px', background: 'var(--bg-2)', fontWeight: 600, whiteSpace: 'nowrap', minWidth: 90 }}>
                    {q.quarter} {q.year}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: '10px 16px', fontWeight: 500, color: 'var(--text-2)' }}>Revenue</td>
                {quarters.map((q: any) => (
                  <td key={`${q.year}-${q.quarter}`} style={{ textAlign: 'right', padding: '10px 16px' }}>
                    {formatValue(q.revenueFromOperations, 'currency')}
                  </td>
                ))}
              </tr>
              <tr style={{ background: 'var(--surface)' }}>
                <td style={{ padding: '10px 16px', fontWeight: 500, color: 'var(--text-2)' }}>Net Profit</td>
                {quarters.map((q: any) => (
                  <td key={`${q.year}-${q.quarter}`} style={{ textAlign: 'right', padding: '10px 16px' }}>
                    <span style={{ color: (q.profitAfterTax ?? 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {formatValue(q.profitAfterTax, 'currency')}
                    </span>
                  </td>
                ))}
              </tr>
              <tr>
                <td style={{ padding: '10px 16px', fontWeight: 500, color: 'var(--text-2)' }}>EPS</td>
                {quarters.map((q: any) => (
                  <td key={`${q.year}-${q.quarter}`} style={{ textAlign: 'right', padding: '10px 16px' }}>
                    {formatValue(q.eps, 'number')}
                  </td>
                ))}
              </tr>
              <tr style={{ background: 'var(--surface)' }}>
                <td style={{ padding: '10px 16px', fontWeight: 500, color: 'var(--text-2)' }}>ROE %</td>
                {quarters.map((q: any) => (
                  <td key={`${q.year}-${q.quarter}`} style={{ textAlign: 'right', padding: '10px 16px' }}>
                    <span style={{ color: getTone(q.roe, { good: 15 }) === 'positive' ? 'var(--green)' : getTone(q.roe, { good: 15 }) === 'negative' ? 'var(--red)' : 'var(--text-1)' }}>
                      {formatValue(q.roe, 'percent')}
                    </span>
                  </td>
                ))}
              </tr>
              <tr>
                <td style={{ padding: '10px 16px', fontWeight: 500, color: 'var(--text-2)' }}>ROCE %</td>
                {quarters.map((q: any) => (
                  <td key={`${q.year}-${q.quarter}`} style={{ textAlign: 'right', padding: '10px 16px' }}>
                    <span style={{ color: getTone(q.roce, { good: 15 }) === 'positive' ? 'var(--green)' : getTone(q.roce, { good: 15 }) === 'negative' ? 'var(--red)' : 'var(--text-1)' }}>
                      {formatValue(q.roce, 'percent')}
                    </span>
                  </td>
                ))}
              </tr>
              <tr style={{ background: 'var(--surface)' }}>
                <td style={{ padding: '10px 16px', fontWeight: 500, color: 'var(--text-2)' }}>Net Margin %</td>
                {quarters.map((q: any) => (
                  <td key={`${q.year}-${q.quarter}`} style={{ textAlign: 'right', padding: '10px 16px' }}>
                    <span style={{ color: getTone(q.netMargin, { good: 15 }) === 'positive' ? 'var(--green)' : getTone(q.netMargin, { good: 15 }) === 'negative' ? 'var(--red)' : 'var(--text-1)' }}>
                      {formatValue(q.netMargin, 'percent')}
                    </span>
                  </td>
                ))}
              </tr>
              <tr>
                <td style={{ padding: '10px 16px', fontWeight: 500, color: 'var(--text-2)' }}>Debt / Equity</td>
                {quarters.map((q: any) => (
                  <td key={`${q.year}-${q.quarter}`} style={{ textAlign: 'right', padding: '10px 16px' }}>
                    <span style={{ color: getTone(q.debtToEquity, { good: 1, bad: 2 }) === 'positive' ? 'var(--green)' : getTone(q.debtToEquity, { good: 1, bad: 2 }) === 'negative' ? 'var(--red)' : 'var(--text-1)' }}>
                      {formatValue(q.debtToEquity, 'number')}
                    </span>
                  </td>
                ))}
              </tr>
              <tr style={{ background: 'var(--surface)' }}>
                <td style={{ padding: '10px 16px', fontWeight: 500, color: 'var(--text-2)' }}>Current Ratio</td>
                {quarters.map((q: any) => (
                  <td key={`${q.year}-${q.quarter}`} style={{ textAlign: 'right', padding: '10px 16px' }}>
                    <span style={{ color: getTone(q.currentRatio, { good: 1.5 }) === 'positive' ? 'var(--green)' : 'var(--text-1)' }}>
                      {formatValue(q.currentRatio, 'number')}
                    </span>
                  </td>
                ))}
              </tr>
              <tr>
                <td style={{ padding: '10px 16px', fontWeight: 500, color: 'var(--text-2)' }}>Gross Margin %</td>
                {quarters.map((q: any) => (
                  <td key={`${q.year}-${q.quarter}`} style={{ textAlign: 'right', padding: '10px 16px' }}>
                    {formatValue(q.grossMargin, 'percent')}
                  </td>
                ))}
              </tr>
              <tr style={{ background: 'var(--surface)' }}>
                <td style={{ padding: '10px 16px', fontWeight: 500, color: 'var(--text-2)' }}>Revenue Growth %</td>
                {quarters.map((q: any) => (
                  <td key={`${q.year}-${q.quarter}`} style={{ textAlign: 'right', padding: '10px 16px' }}>
                    <span style={{ color: (q.revenueGrowth ?? 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {formatValue(q.revenueGrowth, 'percent')}
                    </span>
                  </td>
                ))}
              </tr>
              <tr>
                <td style={{ padding: '10px 16px', fontWeight: 500, color: 'var(--text-2)' }}>Profit Growth %</td>
                {quarters.map((q: any) => (
                  <td key={`${q.year}-${q.quarter}`} style={{ textAlign: 'right', padding: '10px 16px' }}>
                    <span style={{ color: (q.profitGrowth ?? 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {formatValue(q.profitGrowth, 'percent')}
                    </span>
                  </td>
                ))}
              </tr>
              <tr style={{ background: 'var(--surface)' }}>
                <td style={{ padding: '10px 16px', fontWeight: 500, color: 'var(--text-2)' }}>Book Value</td>
                {quarters.map((q: any) => (
                  <td key={`${q.year}-${q.quarter}`} style={{ textAlign: 'right', padding: '10px 16px' }}>
                    {formatValue(q.bookValuePerShare, 'number')}
                  </td>
                ))}
              </tr>
              <tr>
                <td style={{ padding: '10px 16px', fontWeight: 500, color: 'var(--text-2)' }}>Dividend / Share</td>
                {quarters.map((q: any) => (
                  <td key={`${q.year}-${q.quarter}`} style={{ textAlign: 'right', padding: '10px 16px' }}>
                    {formatValue(q.dividendPerShare, 'number')}
                  </td>
                ))}
              </tr>
              <tr style={{ background: 'var(--surface)' }}>
                <td style={{ padding: '10px 16px', fontWeight: 500, color: 'var(--text-2)' }}>Operating CF</td>
                {quarters.map((q: any) => (
                  <td key={`${q.year}-${q.quarter}`} style={{ textAlign: 'right', padding: '10px 16px' }}>
                    <span style={{ color: (q.operatingCashFlow ?? 0) >= 0 ? 'var(--text-1)' : 'var(--red)' }}>
                      {formatValue(q.operatingCashFlow, 'currency')}
                    </span>
                  </td>
                ))}
              </tr>
              <tr>
                <td style={{ padding: '10px 16px', fontWeight: 500, color: 'var(--text-2)' }}>Free Cash Flow</td>
                {quarters.map((q: any) => (
                  <td key={`${q.year}-${q.quarter}`} style={{ textAlign: 'right', padding: '10px 16px' }}>
                    <span style={{ color: (q.freeCashFlow ?? 0) >= 0 ? 'var(--text-1)' : 'var(--red)' }}>
                      {formatValue(q.freeCashFlow, 'currency')}
                    </span>
                  </td>
                ))}
              </tr>
              <tr style={{ background: 'var(--surface)' }}>
                <td style={{ padding: '10px 16px', fontWeight: 500, color: 'var(--text-2)' }}>Cash Conv. %</td>
                {quarters.map((q: any) => (
                  <td key={`${q.year}-${q.quarter}`} style={{ textAlign: 'right', padding: '10px 16px' }}>
                    <span style={{ color: (q.cashConversion ?? 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {formatValue(q.cashConversion, 'percent')}
                    </span>
                  </td>
                ))}
              </tr>
              <tr>
                <td style={{ padding: '10px 16px', fontWeight: 500, color: 'var(--text-2)' }}>Receivables Days</td>
                {quarters.map((q: any) => (
                  <td key={`${q.year}-${q.quarter}`} style={{ textAlign: 'right', padding: '10px 16px' }}>
                    {formatValue(q.receivablesDays, 'number')}
                  </td>
                ))}
              </tr>
              <tr style={{ background: 'var(--surface)' }}>
                <td style={{ padding: '10px 16px', fontWeight: 500, color: 'var(--text-2)' }}>Inventory Days</td>
                {quarters.map((q: any) => (
                  <td key={`${q.year}-${q.quarter}`} style={{ textAlign: 'right', padding: '10px 16px' }}>
                    {formatValue(q.inventoryDays, 'number')}
                  </td>
                ))}
              </tr>
              <tr>
                <td style={{ padding: '10px 16px', fontWeight: 500, color: 'var(--text-2)' }}>Payable Days</td>
                {quarters.map((q: any) => (
                  <td key={`${q.year}-${q.quarter}`} style={{ textAlign: 'right', padding: '10px 16px' }}>
                    {formatValue(q.payableDays, 'number')}
                  </td>
                ))}
              </tr>
              <tr style={{ background: 'var(--surface)' }}>
                <td style={{ padding: '10px 16px', fontWeight: 500, color: 'var(--text-2)' }}>Cash Conv. Cycle</td>
                {quarters.map((q: any) => (
                  <td key={`${q.year}-${q.quarter}`} style={{ textAlign: 'right', padding: '10px 16px' }}>
                    {formatValue(q.cashConversionCycle, 'number')}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {annual.avgRoe && (
          <div className="grid-fit-180" style={{ marginTop: 16 }}>
            <MetricTile label="Avg ROE (3Y)" value={formatPercent(annual.avgRoe)} tone={annual.avgRoe > 15 ? 'positive' : 'primary'} />
            <MetricTile label="Avg ROCE (3Y)" value={annual.avgRoce ? formatPercent(annual.avgRoce) : '—'} tone={annual.avgRoce && annual.avgRoce > 15 ? 'positive' : 'primary'} />
            <MetricTile label="Avg Net Margin (3Y)" value={annual.avgNetMargin ? formatPercent(annual.avgNetMargin) : '—'} tone={annual.avgNetMargin && annual.avgNetMargin > 15 ? 'positive' : 'primary'} />
            <MetricTile label="Book Value" value={latest.bookValuePerShare ? formatNumber(latest.bookValuePerShare) : '—'} tone="primary" icon={PieChart} />
          </div>
        )}
      </div>
    </SectionCard>
  );
}