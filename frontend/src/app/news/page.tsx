'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  BookText,
  Newspaper,
  RefreshCw,
  Rss,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { TVWidget } from '@/components/charts/TVWidget';
import { SymbolLink } from '@/components/ui/SymbolLink';
import { EmptyPanel, MetricTile, PageHeader, SectionCard, TrendBadge } from '@/components/ui/page-kit';
import { marketAPI, type NewsItem } from '@/lib/api';
import { formatTimeAgo } from '@/lib/format';

const CATEGORY_OPTIONS = ['All', 'Markets', 'Economy', 'Corporate', 'Sector', 'Global', 'Regulation'];
const SENTIMENT_OPTIONS = [
  { id: 'all', label: 'All' },
  { id: 'bullish', label: 'Bullish' },
  { id: 'bearish', label: 'Bearish' },
  { id: 'neutral', label: 'Neutral' },
] as const;

export default function NewsPage() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState('All');
  const [sentiment, setSentiment] = useState<(typeof SENTIMENT_OPTIONS)[number]['id']>('all');

  const loadNews = useCallback(async () => {
    setLoading(true);
    try {
      const stories = await marketAPI.getNews(sentiment, category === 'All' ? undefined : category.toLowerCase(), 30);
      setNews(stories || []);
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to load news.');
      setNews([]);
    } finally {
      setLoading(false);
    }
  }, [category, sentiment]);

  useEffect(() => {
    loadNews();
  }, [loadNews]);

  const featured = news[0] || null;
  const sentimentStats = useMemo(() => ({
    bullish: news.filter((item) => item.sentiment === 'bullish').length,
    bearish: news.filter((item) => item.sentiment === 'bearish').length,
    neutral: news.filter((item) => item.sentiment === 'neutral').length,
  }), [news]);

  const symbolsInFocus = useMemo(() => {
    const counts = new Map<string, number>();

    for (const story of news) {
      for (const symbol of story.relatedStocks || []) {
        counts.set(symbol, (counts.get(symbol) || 0) + 1);
      }
    }

    return [...counts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 8);
  }, [news]);

  return (
    <div className="page">
      <PageHeader
        kicker="News Desk"
        title="Curated market intelligence"
        description="A richer news desk driven by RSS aggregation, article categorization, sentiment tagging, and related-stock extraction. The feed is delayed and cached so news quality improves without creating unstable external call patterns."
        actions={
          <button onClick={loadNews} disabled={loading} className="btn btn-ghost">
            <RefreshCw style={{ width: 14, height: 14 }} className={loading ? 'anim-spin' : ''} />
            Refresh news
          </button>
        }
      />

      {error ? <TrendBadge tone="warning">{error}</TrendBadge> : null}

      <div className="grid-fit-220">
        <MetricTile label="Stories loaded" value={news.length} tone="primary" icon={Newspaper} subtext="Latest delayed cached feed slice" />
        <MetricTile label="Bullish stories" value={sentimentStats.bullish} tone="positive" icon={TrendingUp} subtext="Positive market or corporate tone" />
        <MetricTile label="Bearish stories" value={sentimentStats.bearish} tone="negative" icon={TrendingDown} subtext="Weakness, risk, or regulation pressure" />
        <MetricTile label="Symbols in focus" value={symbolsInFocus.length} tone="warning" icon={Sparkles} subtext="Tickers repeated across the current feed" />
      </div>

      <div className="two-column-layout">
        <div className="stack-16">
          <SectionCard title="Feed Filters" subtitle="Narrow the market intelligence desk by category or sentiment" icon={Rss}>
            <div className="stack-16">
              <div>
                <div className="stat-label" style={{ marginBottom: 8 }}>Sentiment</div>
                <div className="tab-group">
                  {SENTIMENT_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setSentiment(option.id)}
                      className={`tab ${sentiment === option.id ? 'tab-active' : ''}`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="stat-label" style={{ marginBottom: 8 }}>Category</div>
                <div className="tab-group">
                  {CATEGORY_OPTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setCategory(option)}
                      className={`tab ${category === option ? 'tab-active' : ''}`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Featured Story" subtitle="The most recent story in the current filtered feed" icon={BookText}>
            {featured ? (
              <div className="stack-16">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <TrendBadge tone={featured.sentiment === 'bullish' ? 'positive' : featured.sentiment === 'bearish' ? 'negative' : 'warning'}>
                      {featured.sentiment}
                    </TrendBadge>
                    <TrendBadge tone="primary">{featured.category}</TrendBadge>
                  </div>
                  <span className="topbar-pill">{featured.source} • {formatTimeAgo(featured.time)}</span>
                </div>

                <div>
                  <h2 style={{ fontSize: '1.4rem', lineHeight: 1.3 }}>{featured.title}</h2>
                  <p style={{ marginTop: 12, color: 'var(--text-2)', lineHeight: 1.8 }}>{featured.summary}</p>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {(featured.relatedStocks || []).map((symbol) => (
                    <SymbolLink key={symbol} symbol={symbol}>
                      <span className="badge badge-muted">{symbol}</span>
                    </SymbolLink>
                  ))}
                </div>

                <a href={featured.url} target="_blank" rel="noreferrer" className="btn btn-primary" style={{ width: 'fit-content' }}>
                  Open source article
                  <ArrowUpRight style={{ width: 14, height: 14 }} />
                </a>
              </div>
            ) : (
              <EmptyPanel title="No stories in view" description="Try a different category or sentiment filter to repopulate the desk." icon={Newspaper} />
            )}
          </SectionCard>

          <SectionCard title="Live Feed" subtitle="Recent headlines with related-stock drill-down" icon={Rss}>
            {loading ? (
              <div className="stack-12">
                {[...Array(6)].map((_, index) => <div key={index} className="skeleton" style={{ height: 64 }} />)}
              </div>
            ) : news.length ? (
              <div className="stack-16">
                {news.slice(1).map((item) => (
                  <article key={item.id} className="metric-card" style={{ padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <TrendBadge tone={item.sentiment === 'bullish' ? 'positive' : item.sentiment === 'bearish' ? 'negative' : 'warning'}>
                          {item.sentiment}
                        </TrendBadge>
                        <TrendBadge tone="primary">{item.category}</TrendBadge>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{item.source} • {formatTimeAgo(item.time)}</span>
                    </div>

                    <h3 style={{ marginTop: 12, fontSize: 16, lineHeight: 1.45 }}>{item.title}</h3>
                    <p style={{ marginTop: 8, color: 'var(--text-2)', lineHeight: 1.75 }}>{item.summary}</p>

                    <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {(item.relatedStocks || []).slice(0, 4).map((symbol) => (
                          <SymbolLink key={symbol} symbol={symbol}>
                            <span className="badge badge-muted">{symbol}</span>
                          </SymbolLink>
                        ))}
                      </div>
                      <a href={item.url} target="_blank" rel="noreferrer" className="btn btn-ghost">
                        Read source
                        <ArrowUpRight style={{ width: 13, height: 13 }} />
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyPanel title="No stories loaded" description="The current filter combination returned no articles." icon={Rss} />
            )}
          </SectionCard>
        </div>

        <div className="stack-16">
          <SectionCard title="Symbols In Focus" subtitle="Tickers most frequently referenced across the current feed" icon={Sparkles}>
            {symbolsInFocus.length ? (
              <div className="stack-12">
                {symbolsInFocus.map(([symbol, count]) => (
                  <div key={symbol} className="metric-card" style={{ padding: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                      <SymbolLink symbol={symbol} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
                        <div className="mono" style={{ fontSize: 12, fontWeight: 700 }}>{symbol}</div>
                      </SymbolLink>
                      <TrendBadge tone="primary">{count} mentions</TrendBadge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="metric-footnote">Related stocks appear here once articles start referencing listed symbols.</div>
            )}
          </SectionCard>

          <SectionCard title="Timeline" subtitle="TradingView timeline for broader market context" icon={Newspaper}>
            <div style={{ height: 420 }}>
              <TVWidget
                src="https://s3.tradingview.com/external-embedding/embed-widget-timeline.js"
                config={{
                  feedMode: 'market',
                  market: 'stock',
                  colorTheme: 'dark',
                  isTransparent: true,
                  displayMode: 'adaptive',
                  locale: 'en',
                }}
              />
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}