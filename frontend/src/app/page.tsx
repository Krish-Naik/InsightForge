'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, BrainCircuit, RefreshCw, ShieldAlert, Sparkles, Target, TrendingDown, TrendingUp, Waves } from 'lucide-react';
import { MarketNarrativeCard, OpportunityInsightCard, RecapInsightCard, SectorPulseCard } from '@/components/ui/insight-kit';
import { EmptyPanel, MetricTile, PageHeader, SectionCard, TrendBadge } from '@/components/ui/page-kit';
import { marketAPI, type MarketSummary, type Quote, type SectorOverview, type TodayDesk } from '@/lib/api';
import { formatCurrency, formatIST, formatLargeNumber, formatPercent, formatTimeAgo } from '@/lib/format';
import { useMarketStream } from '@/lib/hooks/useMarketStream';

const LARGE_CAP = new Set([
  'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'SBIN', 'BHARTIARTL',
  'ITC', 'KOTAKBANK', 'LT', 'HCLTECH', 'BAJFINANCE', 'MARUTI', 'ASIANPAINT',
  'SUNPHARMA', 'TITAN', 'AXISBANK', 'WIPRO', 'ULTRACEMCO', 'NTPC',
  'ONGC', 'TATAMOTORS', 'POWERGRID', 'TATASTEEL', 'JSWSTEEL',
  'M&M', 'ADANIENT', 'ADANIPORTS', 'GRASIM', 'TECHM',
  'HINDUNILVR', 'DIVISLAB', 'DRREDDY', 'CIPLA', 'BRITANNIA',
  'EICHERMOT', 'HEROMOTOCO', 'COALINDIA', 'BPCL', 'NESTLEIND',
  'APOLLOHOSP', 'BAJAJFINSV', 'BAJAJ-AUTO', 'SBILIFE', 'HDFCLIFE',
  'DABUR', 'HAVELLS', 'PIDILITIND', 'SIEMENS', 'TRENT',
]);

const MID_CAP = new Set([
  'AUBANK', 'BALKRISIND', 'BANKBARODA', 'BIOCON', 'BOSCHLTD', 'CANBK', 'CHOLAFIN',
  'CIPLA', 'COLPAL', 'CONCOR', 'CUMMINSIND', 'DABUR', 'DLF', 'FEDERALBNK',
  'GAIL', 'GODREJCP', 'HAVELLS', 'HCC', 'HDFCAMC', 'HDFCLIFE', 'HINDALCO',
  'HONAUT', 'ICICIPRULIFE', 'ICICIGI', 'IDFCFIRSTB', 'INDUSINDBK', 'IRCTC',
  'JINDALSTEL', 'LUPIN', 'MARICO', 'MUTHOOTFIN', 'NMDC', 'OFSS', 'PEL',
  'PETRONET', 'PFC', 'PGHL', 'PIDILITIND', 'PNB', 'POLYCAB', 'POWERGRID',
  'PRESTIGE', 'RAIN', 'RECLTD', 'SAIL', 'SBICARD', 'SBILIFE', 'SOBHA',
  'SUNTV', 'TATAPOWER', 'TORNTPHARM', 'TRENT', 'TVSMOTOR', 'UBL', 'UNIONBANK',
  'VEDL', 'VOLTAS', 'WELSPUNCORP', 'YESBANK', 'ZEEL',
]);

const SMALL_CAP = new Set([
  'ADANIENT', 'ADANIGAS', 'ADFFOODS', 'AJMERA', 'ALEMBICLTD', 'ALKYLAMINE', 'ALOKINDS',
  'AMARAJABAT', 'ANUP', 'APLLTD', 'ARCB', 'ARIHANTCAP', 'ARIHANTFOODS', 'ARVIND',
  'ASHOKLEY', 'ATUL', 'AVANTIFEED', 'BANDHANBNK', 'BEML', 'BHEL', 'CAMP',
  'CANTABIL', 'CAPL', 'CARBORUNIV', 'CENTURYPLY', 'CENTURYTEXT', 'CHAMBLFERT',
  'CHEMCON', 'CHENNPETRO', 'COFORGE', 'COROMANDEL', 'CROMPTON', 'CUB', 'DBL',
  'DEEPAKNTR', 'DHFL', 'DIXON', 'DMART', 'DOD', 'DWARKESH', 'EDELWEISS',
  'EIHOTEL', 'EIMCOELECON', 'ELGIEQUIP', 'ELIN', 'EQUITAS', 'ESCORTS', 'EXIDEIND',
  'FINEORG', 'FINPIPE', 'FMGOETZE', 'GABRIEL', 'GANECOS', 'GDL', 'GENUSPACE',
  'GEPIL', 'GESHIP', 'GLENMARK', 'GMRINFRA', 'GOCOLORS', 'GODREJAG', 'GODREJIND',
  'GODREJP', 'GODREJPROP', 'GPIL', 'GRASIM', 'GSFC', 'GSPL', 'GUFIC', 'HBSL',
  'HCC', 'HCLTECH', 'HERO', 'HFCL', 'HIKAL', 'HINDPETRO', 'HINDZINC', 'HONASA',
  'HUBTOWN', 'IDBI', 'IDFC', 'IEX', 'IFBIND', 'IGL', 'INDHOTEL', 'INDIACEM',
  'INDIAMART', 'INDIGO', 'INDUSTOWER', 'INTELACT', 'IOB', 'IPCALAB', 'JBL',
  'JCHAC', 'JINDALPOLY', 'JKCEMENT', 'JKLAKSHMI', 'JMFINANC', 'JOC', 'JPASSOCIAT',
  'JSL', 'JSWENERGY', 'JUBLFOOD', 'JUBLIN', 'JVS', 'JYOTHYLAB', 'KALPATPOWR',
  'KANSAINER', 'KCP', 'KDDL', 'KEI', 'KNRCON', 'KOLTEPATIL', 'KRBL', 'KSB',
  'LAXMIMACH', 'LEMONTREE', 'LICHSGFIN', 'LINDEINDIA', 'LTIM', 'MAHABANK',
  'MAHINDCIE', 'MAHLIFE', 'MANAPPURAM', 'MANINFRA', 'MAS', 'MATRIMONY',
  'MAWPHL', 'MAXHEALTH', 'MCDOWELL-N', 'MCL', 'MCX', 'MEDICAMEQ', 'MGL',
  'MHRIL', 'MINDACORP', 'MINDAIND', 'MOIL', 'MOREPENLAB', 'MOTHERSUMI',
  'MPHASIS', 'MRF', 'MRL', 'MRPL', 'MUTHOOTFIN', 'NAC', 'NAUKRI',
  'NAVINFLUOR', 'NCC', 'NETWORK18', 'NGLFINE', 'NHC', 'NOCIL', 'NOID',
  'NURMJ', 'OBEROIRLTY', 'OIL', 'OMAXE', 'ONMOBILE', 'ORIENTCEM', 'ORIENTELEC',
  'PAISALO', 'PCBL', 'PERSISTENT', 'PFIZER', 'PIIND', 'PNCINFRA', 'PRAJIND',
  'PRINCE', 'PRISM', 'PRIVISCL', 'PROPTIG', 'PVR', 'QUESS', 'RADIOCITY',
  'RAILTEL', 'RAJRAYON', 'RAJTV', 'RAMCOIND', 'RAMCOSYS', 'RAMPRE', 'RANCH',
  'RCOM', 'RCORP', 'REDINGTON', 'REFEX', 'RENGAS', 'RITES', 'RIVIGO',
  'RSYSTEMS', 'RUBYMILL', 'RUPA', 'SABASE', 'SANDHAR', 'SANGAM', 'SANGHIIND',
  'SARK', 'SCHAEFFLER', 'SEAMABLE', 'SELL', 'SEPOWER', 'SHYAMMETL', 'SIIL',
  'SILGO', 'SIRCA', 'SIS', 'SJVN', 'SKFINDIA', 'SOUTHBANK', 'SPANDANA',
  'SPCEN', 'SPICEJET', 'SPL', 'SPML', 'SRF', 'SRO', 'SSWL', 'STAR',
  'STCINDIA', 'STEELXIND', 'STLTECH', 'SUBEX', 'SUDARSHAN', 'SUJ', 'SUMICHEM',
  'SUNFLAG', 'SUNTECK', 'SUPRAJIT', 'SUPREMEIND', 'SWANENERGY', 'SYNGENE',
  'SYRMA', 'TATACHEM', 'TATACOMM', 'TATACOFFEE', 'TATAELXSI', 'TATAGLOBAL',
  'TATAINVEST', 'TATVA', 'TEJASNET', 'TFCILTD', 'THERMAX', 'THOMASCOOK',
  'THYROCARE', 'TI', 'TIDCO', 'TNP', 'TOSHIBA', 'TREEHOUSE', 'TRITURBINE',
  'TV18BRDCST', 'UCHW', 'UFLEX', 'ULMAT', 'UNICHEM', 'UNO', 'URJA',
  'USHAMART', 'UTI', 'UTIAMC', 'VAKRANGE', 'VARROC', 'VASCONEQ', 'VBL',
  'VENKEYS', 'VENUSREM', 'VGUARD', 'VINATIORG', 'VIPIND', 'VIRCHOW', 'VISAKA',
  'VMART', 'VRLLOG', 'VSL', 'WABCOINDIA', 'WELCORP', 'WELSPUNS', 'WENDT',
  'WESTLIFE', 'WHEELS', 'WOCKPHARMA', 'WONDERLA', 'WSF', 'ZENSARTECH',
  'ZFCVINDIA', 'ZOMATO', 'ZYDUSWELL',
]);

type Segment = 'overall' | 'largeCap' | 'midCap' | 'smallCap';

function filterBySegment(quotes: Quote[], segment: Segment): Quote[] {
  if (segment === 'overall') return quotes;
  const set = segment === 'largeCap' ? LARGE_CAP : segment === 'midCap' ? MID_CAP : SMALL_CAP;
  return quotes.filter(q => set.has(q.symbol));
}

function toneForChange(value: number) {
  return value >= 0 ? 'positive' : 'negative';
}

function preferredIndices(indices: MarketSummary['indices']) {
  const priority = ['NIFTY 50', 'NIFTY BANK', 'NIFTY NEXT 50', 'FINNIFTY', 'SENSEX'];
  const ranked = [...indices].sort((left, right) => {
    const leftIndex = priority.findIndex((entry) => left.symbol.includes(entry) || left.shortName.includes(entry));
    const rightIndex = priority.findIndex((entry) => right.symbol.includes(entry) || right.shortName.includes(entry));
    return (leftIndex === -1 ? 99 : leftIndex) - (rightIndex === -1 ? 99 : rightIndex);
  });
  return ranked.slice(0, 4);
}

function QuoteList({ title, items }: { title: string; items: Quote[] }) {
  return (
    <div className="surface-inset">
      <div className="stat-label">{title}</div>
      <div className="stack-12" style={{ marginTop: 10 }}>
        {items.length ? items.map((item) => (
          <Link key={`${title}-${item.symbol}`} href={`/stocks/${encodeURIComponent(item.symbol)}`} className="list-card" style={{ textDecoration: 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
              <div>
                <div className="mono" style={{ fontSize: 12, fontWeight: 700 }}>{item.symbol}</div>
                <div className="metric-footnote">{item.name}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="mono" style={{ fontSize: 12 }}>{formatCurrency(item.price)}</div>
                <div className="metric-footnote" style={{ color: item.changePercent >= 0 ? 'var(--green)' : 'var(--red)' }}>{formatPercent(item.changePercent)}</div>
              </div>
            </div>
          </Link>
        )) : <div className="metric-footnote">No names available.</div>}
      </div>
    </div>
  );
}

export default function RootPage() {
  const [desk, setDesk] = useState<TodayDesk | null>(null);
  const [summary, setSummary] = useState<MarketSummary | null>(null);
  const [sectors, setSectors] = useState<SectorOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSegment, setActiveSegment] = useState<Segment>('overall');
  const { connected, error: streamError } = useMarketStream(true);

  const loadOverview = useCallback(async () => {
    setRefreshing(true);
    try {
      const [nextDesk, nextSummary, nextSectors] = await Promise.all([
        marketAPI.getTodayDesk(),
        marketAPI.getMarketSummary(),
        marketAPI.getAllSectorsData(),
      ]);
      setDesk(nextDesk);
      setSummary(nextSummary);
      setSectors(nextSectors);
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to load market overview.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview();
    const timer = window.setInterval(() => { void loadOverview(); }, 60_000);
    return () => window.clearInterval(timer);
  }, [loadOverview]);

  const positiveSectors = sectors.filter((entry) => entry.trend === 'bullish').length;
  const negativeSectors = sectors.filter((entry) => entry.trend === 'bearish').length;
  const breadthLead = [...sectors].sort((left, right) => right.breadth - left.breadth).slice(0, 6);
  const breadthRisks = [...sectors].sort((left, right) => left.breadth - right.breadth).slice(0, 3);
  const allIndices = summary?.indices || [];
  const primaryIndices = preferredIndices(allIndices);
  const activeWatch = desk?.stocksToWatch.slice(0, 3) || [];
  const breadthBias = sectors.length
    ? (sectors.reduce((sum, entry) => sum + entry.breadth, 0) / sectors.length)
    : 0;

  return (
    <div className="page">
      <PageHeader
        kicker="Today"
        title="Market overview first, setups second"
        description="Start with Nifty, sector breadth, active tape, and market risk. Stock ideas stay available, but they no longer dominate the home page."
        actions={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <TrendBadge tone={connected ? 'positive' : 'warning'}>
              <span className={`status-dot ${connected ? 'is-live' : ''}`} />
              {connected ? 'Live pulse' : 'Delayed pulse'}
            </TrendBadge>
            {desk ? <TrendBadge tone={desk.sourceMode === 'ai' ? 'primary' : 'warning'}>{desk.sourceMode === 'ai' ? 'Groq overview' : 'Rules overview'}</TrendBadge> : null}
            {desk?.generatedAt ? <span className="topbar-pill">Updated {formatTimeAgo(desk.generatedAt)} • {formatIST(new Date(desk.generatedAt))}</span> : null}
            <button onClick={() => void loadOverview()} disabled={refreshing} className="btn btn-ghost">
              <RefreshCw style={{ width: 14, height: 14 }} className={refreshing ? 'anim-spin' : ''} />
              Refresh
            </button>
          </div>
        }
      />

      {error || streamError ? <TrendBadge tone="warning">{error || streamError}</TrendBadge> : null}

      <div className="metric-strip-grid">
        <MetricTile label="Market status" value={summary?.marketStatus || '—'} tone="primary" icon={Activity} subtext={primaryIndices[0] ? `${primaryIndices[0].shortName} ${formatPercent(primaryIndices[0].changePercent)}` : 'Waiting for index data'} />
        <MetricTile label="Bullish sectors" value={positiveSectors} tone="positive" icon={TrendingUp} subtext="Sectors with positive breadth" />
        <MetricTile label="Bearish sectors" value={negativeSectors} tone="negative" icon={TrendingDown} subtext="Sectors with negative breadth" />
        <MetricTile label="Breadth bias" value={formatPercent(breadthBias, 1)} tone={breadthBias >= 0 ? 'warning' : 'negative'} icon={Waves} subtext="Average sector breadth across the market" />
      </div>

      <div className="full-width-section">
        <SectionCard title="Index Board" subtitle="Nifty and the headline tape before stock ideas" icon={Activity} tone="primary">
          {allIndices.length ? (
            <div className="index-scroll-container">
              <div className="index-scroll-inner">
                {allIndices.map((index) => (
                  <div key={index.symbol} className="index-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                      <div>
                        <div className="stat-label">Index</div>
                        <div style={{ marginTop: 8, fontSize: 15, fontWeight: 700 }}>{index.shortName}</div>
                        <div className="metric-footnote">{index.symbol}</div>
                      </div>
                      <TrendBadge tone={toneForChange(index.changePercent)}>{formatPercent(index.changePercent)}</TrendBadge>
                    </div>
                    <div className="metric-value" style={{ marginTop: 12 }}>{formatCurrency(index.price)}</div>
                    <div className="metric-footnote">Range {formatCurrency(index.dayLow)} to {formatCurrency(index.dayHigh)}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyPanel title="Index board loading" description="Index context will appear here as soon as the cached market summary is ready." icon={Activity} />
          )}
        </SectionCard>
      </div>

      <div className="full-width-section">
        <SectionCard title="Market Summary" subtitle="Real-time market overview for focused trading decisions" icon={BrainCircuit}>
          {desk?.narrative ? (
            <MarketNarrativeCard narrative={desk.narrative} />
          ) : (
            <EmptyPanel title="Overview loading" description="The narrative overview appears once market breadth and index context are combined." icon={BrainCircuit} />
          )}
        </SectionCard>
      </div>

      <div className="full-width-section">
        <SectionCard title="Tape Activity" subtitle="Gainers, losers, and most-active names across market segments" icon={Activity}>
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              {(['overall', 'largeCap', 'midCap', 'smallCap'] as const).map((seg) => (
                <button
                  key={seg}
                  onClick={() => setActiveSegment(seg)}
                  className={`btn ${activeSegment === seg ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ padding: '6px 14px', fontSize: '0.85rem' }}
                >
                  {seg === 'overall' ? 'All Caps' : seg === 'largeCap' ? 'Large Cap' : seg === 'midCap' ? 'Mid Cap' : 'Small Cap'}
                </button>
              ))}
            </div>
            {summary ? (
              <div className="grid-fit-220">
                <QuoteList title="Top Gainers" items={filterBySegment(summary.gainers, activeSegment).slice(0, 10)} />
                <QuoteList title="Top Losers" items={filterBySegment(summary.losers, activeSegment).slice(0, 10)} />
                <QuoteList title="Most Active" items={filterBySegment(summary.mostActive, activeSegment).slice(0, 10)} />
              </div>
            ) : (
              <EmptyPanel title="Loading tape activity" description="Market movers will appear here once data is loaded." icon={Activity} />
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
