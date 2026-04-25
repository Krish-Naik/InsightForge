'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, BookText, BrainCircuit, Newspaper, RefreshCw, Rss, Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
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
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState('All');
  const [sentiment, setSentiment] = useState<(typeof SENTIMENT_OPTIONS)[number]['id']>('all');

  const loadNews = useCallback(async () => {
    setRefreshing(true);
    try {
      const stories = await marketAPI.getNews(sentiment, category === 'All' ? undefined : category.toLowerCase(), 30);
      setNews(stories || []);
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to load story feed.');
      setNews([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [category, sentiment]);

  useEffect(() => {
    void loadNews();
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

    return [...counts.entries()].sort((left, right) => right[1] - left[1]).slice(0, 8);
  }, [news]);

  const storyLead = featured
    ? `${featured.category} is leading the conversation right now. ${featured.sentiment === 'bullish' ? 'The tone is constructive, but still needs market confirmation.' : featured.sentiment === 'bearish' ? 'The tone is risk-first, so reactions matter more than headlines.' : 'The tone is balanced, so focus on second-order impact instead of the headline alone.'}`
    : 'Story Feed connects headlines to market behavior, not just article counts.';

  return (
    <div className="page">
      <PageHeader
        kicker="News"
        title="News"
        description="Market news and stories that impact trading decisions."
        actions={
          <button onClick={() => void loadNews()} disabled={refreshing} className="btn btn-ghost">
            <RefreshCw style={{ width: 14, height: 14 }} className={refreshing ? 'anim-spin' : ''} />
            Refresh feed
          </button>
        }
      />

      {error ? <TrendBadge tone="warning">{error}</TrendBadge> : null}

      <div className="metric-strip-grid">
        <MetricTile label="Stories" value={news.length} tone="primary" icon={Newspaper} subtext={storyLead} />
        <MetricTile label="Bullish" value={sentimentStats.bullish} tone="positive" icon={TrendingUp} subtext="Constructive or positive tone" />
        <MetricTile label="Bearish" value={sentimentStats.bearish} tone="negative" icon={TrendingDown} subtext="Risk-heavy or weak tone" />
        <MetricTile label="Symbols in focus" value={symbolsInFocus.length} tone="warning" icon={Sparkles} subtext="Names repeated across stories" />
      </div>

      <div className="workbench-grid">
        <div className="workbench-column">
          <SectionCard title="Featured Narrative" subtitle="The one story most likely to frame the tape" icon={BookText} tone="primary">
            {featured ? (
              <div className="stack-16">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <TrendBadge tone={featured.sentiment === 'bullish' ? 'positive' : featured.sentiment === 'bearish' ? 'negative' : 'warning'}>{featured.sentiment}</TrendBadge>
                    <TrendBadge tone="primary">{featured.category}</TrendBadge>
                  </div>
                  <span className="topbar-pill">{featured.source} • {formatTimeAgo(featured.time)}</span>
                </div>

                <div>
                  <h2 style={{ fontSize: '1.45rem', lineHeight: 1.2 }}>{featured.title}</h2>
                  <p className="metric-footnote" style={{ marginTop: 12 }}>{featured.summary}</p>
                </div>

                <div className="opportunity-chip-row">
                  {(featured.relatedStocks || []).map((symbol) => (
                    <Link key={`${featured.id}-${symbol}`} href={`/stocks/${encodeURIComponent(symbol)}`} className="badge badge-muted" style={{ textDecoration: 'none' }}>
                      {symbol}
                    </Link>
                  ))}
                </div>

                <a href={featured.url} target="_blank" rel="noreferrer" className="card-link">
                  Open source article
                  <ArrowUpRight style={{ width: 13, height: 13 }} />
                </a>
              </div>
            ) : (
              <EmptyPanel title="No featured story" description="Try a wider sentiment lens or refresh the feed once new stories arrive." icon={BookText} />
            )}
          </SectionCard>

          <SectionCard title="Story Stream" subtitle="Scroll the narrative feed without leaving the workbench" icon={BrainCircuit}>
            {loading ? (
              <div className="story-stream">
                {[...Array(5)].map((_, index) => <div key={index} className="skeleton" style={{ height: 92 }} />)}
              </div>
            ) : news.length ? (
              <div className="story-stream">
                {news.slice(1).map((item) => (
                  <article key={item.id} className="recap-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <TrendBadge tone={item.sentiment === 'bullish' ? 'positive' : item.sentiment === 'bearish' ? 'negative' : 'warning'}>{item.sentiment}</TrendBadge>
                        <TrendBadge tone="primary">{item.category}</TrendBadge>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{item.source} • {formatTimeAgo(item.time)}</span>
                    </div>

                    <h3 style={{ marginTop: 10, fontSize: 16, lineHeight: 1.35 }}>{item.title}</h3>
                    <p className="recap-card-copy" style={{ marginTop: 8 }}>{item.summary}</p>

                    <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                      <div className="opportunity-chip-row">
                        {(item.relatedStocks || []).slice(0, 4).map((symbol) => (
                          <Link key={`${item.id}-${symbol}`} href={`/stocks/${encodeURIComponent(symbol)}`} className="badge badge-muted" style={{ textDecoration: 'none' }}>
                            {symbol}
                          </Link>
                        ))}
                      </div>
                      <a href={item.url} target="_blank" rel="noreferrer" className="card-link card-link-muted">
                        Read source
                        <ArrowUpRight style={{ width: 12, height: 12 }} />
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyPanel title="No stories loaded" description="The current feed settings returned no stories." icon={BrainCircuit} />
            )}
          </SectionCard>
        </div>

        <div className="workbench-column">
          <SectionCard title="Feed Controls" subtitle="Shift the narrative lens without opening a large panel" icon={Rss}>
            <div className="stack-12">
              <div>
                <div className="stat-label" style={{ marginBottom: 8 }}>Sentiment</div>
                <div className="tab-group">
                  {SENTIMENT_OPTIONS.map((entry) => (
                    <button key={entry.id} type="button" onClick={() => setSentiment(entry.id)} className={`tab ${sentiment === entry.id ? 'tab-active' : ''}`}>
                      {entry.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="stat-label" style={{ marginBottom: 8 }}>Category</div>
                <div className="tab-group">
                  {CATEGORY_OPTIONS.map((entry) => (
                    <button key={entry} type="button" onClick={() => setCategory(entry)} className={`tab ${category === entry ? 'tab-active' : ''}`}>
                      {entry}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Symbols In Focus" subtitle="The names being repeated often enough to matter" icon={Sparkles}>
            {symbolsInFocus.length ? (
              <div className="panel-scroll-tight stack-12">
                {symbolsInFocus.map(([symbol, count]) => (
                  <Link key={symbol} href={`/stocks/${encodeURIComponent(symbol)}`} className="list-card" style={{ textDecoration: 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                      <div>
                        <div className="stat-label">In focus</div>
                        <div style={{ marginTop: 8, fontSize: 16, fontWeight: 700 }}>{symbol}</div>
                      </div>
                      <TrendBadge tone="primary">{count} mentions</TrendBadge>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyPanel title="No repeated symbols" description="Once stories cluster around the same names, the feed will surface them here." icon={Sparkles} />
            )}
          </SectionCard>

          <SectionCard title="How To Read The Feed" subtitle="Story Feed is designed for impact, not headline consumption" icon={Rss}>
            <div className="stack-12">
              <div className="surface-inset">
                <div className="stat-label">Read for impact</div>
                <div className="metric-footnote" style={{ marginTop: 8 }}>A story matters only if it changes sector behavior, price participation, or trader attention.</div>
              </div>
              <div className="surface-inset">
                <div className="stat-label">Map it to symbols</div>
                <div className="metric-footnote" style={{ marginTop: 8 }}>Use repeated related stocks to decide whether the narrative is broadening or staying isolated.</div>
              </div>
              <div className="surface-inset">
                <div className="stat-label">Respect tone, not hype</div>
                <div className="metric-footnote" style={{ marginTop: 8 }}>Bullish news without market confirmation is still just potential. Bearish stories with real follow-through deserve more weight.</div>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
