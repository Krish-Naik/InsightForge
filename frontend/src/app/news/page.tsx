'use client';
import { useState, useEffect, useCallback } from 'react';
import { Newspaper, Rss, Clock, ExternalLink, RefreshCw, BarChart2, Briefcase, Zap, AlertCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { TVWidget } from '@/components/charts/TVWidget';
import { SymbolLink } from '@/components/ui/SymbolLink';
import { marketAPI, type NewsItem } from '@/lib/api';
import { formatTimeAgo } from '@/lib/format';
import { runtimeConfig } from '@/lib/runtime';

const CATEGORIES = ['All', 'Markets', 'Economy', 'Corporate', 'Global'];

const DEMO_NEWS: NewsItem[] = [
  { id: '1', title: 'Market hits new all-time high amid strong corporate earnings', summary: 'Nifty and Sensex surged to record highs on the back of strong Q3 results from IT and banking sectors.', source: 'Reuters', url: '#', time: new Date().toISOString(), sentiment: 'bullish', category: 'Markets', relatedStocks: ['RELIANCE', 'HDFCBANK'] },
  { id: '2', title: 'RBI keeps interest rates unchanged at 6.5%', summary: 'The central bank maintained the status quo on policy rates, citing sticky core inflation while retaining an accommodative stance.', source: 'Bloomberg', url: '#', time: new Date(Date.now() - 3600000).toISOString(), sentiment: 'neutral', category: 'Economy', relatedStocks: ['SBIN', 'ICICIBANK'] },
  { id: '3', title: 'Auto sales see single-digit growth in recent quarter', summary: 'Major automakers reported tepid volume growth due to supply chain issues and high vehicle costs.', source: 'Economic Times', url: '#', time: new Date(Date.now() - 7200000).toISOString(), sentiment: 'bearish', category: 'Corporate', relatedStocks: ['TATAMOTORS', 'MARUTI'] },
];

export default function NewsPage() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('All');
  const [error, setError] = useState<string | null>(null);

  const fetchNews = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await marketAPI.getNews('all', category === 'All' ? undefined : category.toLowerCase());
      setNews(data);
    } catch {
      setError('Failed to fetch news. The backend might be unreachable.');
      setNews(runtimeConfig.demoMode ? DEMO_NEWS : []);
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'bullish': return 'var(--green)';
      case 'bearish': return 'var(--red)';
      default: return 'var(--amber)';
    }
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'bullish': return <TrendingUp style={{ width: 12, height: 12, color: 'var(--green)' }} />;
      case 'bearish': return <TrendingDown style={{ width: 12, height: 12, color: 'var(--red)' }} />;
      default: return <Minus style={{ width: 12, height: 12, color: 'var(--amber)' }} />;
    }
  };

  return (
    <div className="page" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-1)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <Newspaper style={{ width: 18, height: 18, color: 'var(--primary)' }} /> Market News & Analysis
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text-2)' }}>Real-time curated news across Indian markets</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
           <button onClick={fetchNews} disabled={loading} className="btn btn-ghost" style={{ padding: '5px 8px' }}>
            <RefreshCw style={{ width: 13, height: 13 }} className={loading ? 'anim-spin' : ''} />
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0, marginTop: 4 }}>
        {/* Main News Feed */}
        <div style={{ flex: 2, display: 'flex', flexDirection: 'column', minWidth: 0, gap: 12 }}>
          {error && <div className="badge badge-red" style={{ fontSize: 11, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6 }}><AlertCircle style={{ width: 14, height: 14 }} /> {error}{runtimeConfig.demoMode ? ' — Showing demo data' : ''}</div>}
          
          <div className="tab-group" style={{ alignSelf: 'flex-start' }}>
             {CATEGORIES.map(c => (
              <button key={c} onClick={() => setCategory(c)} className={`tab ${category === c ? 'tab-active' : ''}`}>{c}</button>
            ))}
          </div>

          <div className="card scrollbar-thin" style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8, borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
                  <div className="skeleton h-4 rounded w-3/4" />
                  <div className="skeleton h-3 rounded w-full" />
                  <div className="skeleton h-3 rounded w-1/2" />
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                     <div className="skeleton h-5 rounded w-16" />
                     <div className="skeleton h-5 rounded w-16" />
                  </div>
                </div>
              ))
            ) : news.length > 0 ? (
              news.map((item, index) => (
                <div key={item.id || index} style={{ borderBottom: index < news.length - 1 ? '1px solid var(--border)' : 'none', paddingBottom: index < news.length - 1 ? 16 : 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                     <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)', lineHeight: 1.4 }}>
                        <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit' }} className="hover:text-primary transition-colors">
                            {item.title}
                        </a>
                     </h3>
                     <span className="badge" style={{ backgroundColor: `${getSentimentColor(item.sentiment)}20`, color: getSentimentColor(item.sentiment), border: `1px solid ${getSentimentColor(item.sentiment)}40` }}>
                        {item.sentiment}
                     </span>
                  </div>
                  
                  <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {item.summary}
                  </p>
                  
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                     <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: 'var(--text-3)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Briefcase style={{ width: 11, height: 11 }} /> {item.source}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock style={{ width: 11, height: 11 }} /> {formatTimeAgo(item.time)}</span>
                        {item.category && <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--primary)' }}><Zap style={{ width: 11, height: 11 }} /> {item.category}</span>}
                     </div>
                     
                     {item.relatedStocks && item.relatedStocks.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                           {item.relatedStocks.slice(0, 3).map(sym => (
                             <SymbolLink key={sym} symbol={sym}>
                                <span className="badge badge-muted hover:bg-surface transition-colors cursor-pointer" style={{ padding: '2px 6px', fontSize: 9 }}>{sym}</span>
                             </SymbolLink>
                           ))}
                           {item.relatedStocks.length > 3 && <span style={{ fontSize: 10, color: 'var(--text-3)' }}>+{item.relatedStocks.length - 3}</span>}
                        </div>
                     )}
                  </div>
                </div>
              ))
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-3)' }}>
                    <Rss style={{ width: 48, height: 48, marginBottom: 16, opacity: 0.5 }} />
                    <p>No news available for this category.</p>
                </div>
            )}
          </div>
        </div>

        {/* Sidebar / TV Widgets */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, minWidth: 320, maxWidth: 400 }}>
          <div className="card" style={{ flex: 1, minHeight: 400, display: 'flex', flexDirection: 'column' }}>
            <div className="card-header"><BarChart2 style={{ width: 14, height: 14, color: 'var(--amber)' }} /><h3>Top Stories Timeline</h3></div>
            <div style={{ flex: 1, padding: 8 }}>
                <TVWidget 
                    src="https://s3.tradingview.com/external-embedding/embed-widget-timeline.js"
                    config={{
                        feedMode: "market",
                        market: "stock",
                        colorTheme: "dark",
                        isTransparent: true,
                        displayMode: 'regular',
                        width: "100%",
                        height: "100%",
                        locale: "en",
                        largeChartUrl: ""
                    }}
                    className="h-full"
                />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
