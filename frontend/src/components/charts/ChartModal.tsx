'use client';
import { useEffect, useRef, useState, useCallback, memo } from 'react';
import { X, Maximize2, Minimize2, Loader2, RefreshCw } from 'lucide-react';
import { useChart } from '@/lib/contexts/ChartContext';
import { marketAPI, type Quote, type HistoricalBar } from '@/lib/api';
import { formatCurrency, formatPercent } from '@/lib/format';

const PERIODS = [
  { label: '1D', value: '1d' },
  { label: '5D', value: '5d' },
  { label: '1M', value: '1mo' },
  { label: '3M', value: '3mo' },
  { label: '6M', value: '6mo' },
  { label: '1Y', value: '1y' },
];

function ChartModalInner() {
  const { activeSymbol, exchange, closeChart } = useChart();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const candleRef = useRef<any>(null);
  const volRef = useRef<any>(null);
  const [full, setFull] = useState(false);
  const [period, setPeriod] = useState('3mo');
  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (sym: string, per: string) => {
    if (!sym) return;
    setLoading(true);
    setError(null);
    try {
      const [hist, q] = await Promise.allSettled([
        marketAPI.getHistorical(sym, per),
        marketAPI.getQuote(sym),
      ]);
      setQuote(q.status === 'fulfilled' ? q.value : null);

      if (!candleRef.current) return;

      const historical = hist.status === 'fulfilled' && Array.isArray(hist.value)
        ? hist.value as HistoricalBar[]
        : [];

      candleRef.current.setData([]);
      volRef.current?.setData([]);

      const bars = historical
          .map((d) => ({
            time: (d.date ?? '').split('T')[0] as any,
            open: +d.open, high: +d.high, low: +d.low, close: +d.close,
          }))
          .filter((bar) => bar.time && bar.open > 0);

      const vols = historical
          .map((d) => ({
            time: (d.date ?? '').split('T')[0] as any,
            value: +d.volume || 0,
            color: +d.close >= +d.open ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)',
          }))
          .filter((volumeBar) => volumeBar.time && volumeBar.value > 0);

      if (bars.length) {
        candleRef.current.setData(bars);
        chartRef.current?.timeScale().fitContent();
      }
      if (volRef.current && vols.length) volRef.current.setData(vols);

      if (hist.status === 'rejected') {
        setError(hist.reason instanceof Error ? hist.reason.message : 'Failed to load chart data.');
      } else if (!bars.length) {
        setError('No chart data available for this symbol and period.');
      }
    } catch {
      setError('Failed to load chart data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!activeSymbol || !containerRef.current) return;
    let chart: any;

    import('lightweight-charts').then(({ createChart, ColorType, CrosshairMode, CandlestickSeries, HistogramSeries }) => {
      if (!containerRef.current) return;
      containerRef.current.innerHTML = '';

      chart = createChart(containerRef.current, {
        layout: { background: { type: ColorType.Solid, color: '#0f1320' }, textColor: '#8898b4', fontSize: 11 },
        grid: { vertLines: { color: 'rgba(30,42,64,0.5)' }, horzLines: { color: 'rgba(30,42,64,0.5)' } },
        crosshair: { mode: CrosshairMode.Normal },
        rightPriceScale: { borderColor: 'rgba(30,42,64,0.8)', scaleMargins: { top: 0.08, bottom: 0.22 } },
        timeScale: { borderColor: 'rgba(30,42,64,0.8)', rightOffset: 5, barSpacing: 8, timeVisible: true },
        handleScroll: true,
        handleScale: true,
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      });

      const candle = chart.addSeries(CandlestickSeries, {
        upColor: '#22c55e', downColor: '#ef4444',
        borderUpColor: '#22c55e', borderDownColor: '#ef4444',
        wickUpColor: '#22c55e', wickDownColor: '#ef4444',
      });

      const vol = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: 'vol',
      });
      chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

      chartRef.current = chart;
      candleRef.current = candle;
      volRef.current = vol;

      const ro = new ResizeObserver(() => {
        if (containerRef.current)
          chart.applyOptions({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight });
      });
      ro.observe(containerRef.current);

      loadData(activeSymbol, period);

      return () => ro.disconnect();
    });

    return () => {
      chart?.remove();
      chartRef.current = null;
      candleRef.current = null;
      volRef.current = null;
    };
  }, [activeSymbol]);  // only rebuild chart on symbol change

  useEffect(() => {
    if (activeSymbol && candleRef.current) loadData(activeSymbol, period);
  }, [period, activeSymbol, loadData]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeChart(); };
    if (activeSymbol) {
      document.addEventListener('keydown', onKey);
      document.body.style.overflow = 'hidden';
    }
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [activeSymbol, closeChart]);

  if (!activeSymbol) return null;

  const up = (quote?.changePercent ?? 0) >= 0;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center anim-fade">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={closeChart} />

      {/* Modal */}
      <div
        className={`relative glass flex flex-col transition-all duration-200 shadow-2xl ${
          full ? 'w-full h-full rounded-none' : 'w-[96vw] h-[88vh] max-w-[1500px] rounded-xl'
        }`}
        style={{ background: '#0f1320', border: '1px solid #1e2a40' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#1e2a40' }}>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="pulse-dot" style={{ background: up ? 'var(--green)' : 'var(--red)' }} />
              <span className="mono font-bold text-base" style={{ color: 'var(--text-1)' }}>
                {exchange}:{activeSymbol}
              </span>
            </div>
            {quote && (
              <div className="flex items-center gap-3">
                <span className="mono font-bold text-lg" style={{ color: 'var(--text-1)' }}>
                  {formatCurrency(quote.price)}
                </span>
                <span className="badge" style={{
                  background: up ? 'var(--green-dim)' : 'var(--red-dim)',
                  color:       up ? 'var(--green)'    : 'var(--red)',
                }}>
                  {formatPercent(quote.changePercent)}
                </span>
                <span className="text-xs" style={{ color: 'var(--text-2)' }}>
                  Vol: {quote.volume > 0 ? (quote.volume / 1e5).toFixed(2) + 'L' : '—'}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Period selector */}
            <div className="tab-group">
              {PERIODS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPeriod(p.value)}
                  className={`tab text-xs px-2 py-1 ${period === p.value ? 'tab-active' : ''}`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => loadData(activeSymbol, period)}
              className="btn btn-ghost p-2"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'anim-spin' : ''}`} />
            </button>
            <button onClick={() => setFull(!full)} className="btn btn-ghost p-2">
              {full ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button onClick={closeChart} className="btn btn-ghost p-2">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Chart area */}
        <div className="flex-1 relative overflow-hidden">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center z-10" style={{ background: '#0f1320' }}>
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-6 h-6 anim-spin" style={{ color: 'var(--primary)' }} />
                <span className="text-xs" style={{ color: 'var(--text-2)' }}>Loading chart data…</span>
              </div>
            </div>
          )}
          {error && !loading && (
            <div className="absolute inset-0 flex items-center justify-center z-10" style={{ background: '#0f1320' }}>
              <div className="text-center">
                <div className="text-sm mb-1" style={{ color: 'var(--red)' }}>{error}</div>
                <button onClick={() => loadData(activeSymbol, period)} className="btn btn-ghost text-xs mt-2">
                  Retry
                </button>
              </div>
            </div>
          )}
          <div ref={containerRef} className="w-full h-full" />
        </div>

        {/* Footer bar */}
        {quote && (
          <div className="flex items-center gap-6 px-4 py-2 text-xs border-t" style={{ borderColor: '#1e2a40', color: 'var(--text-2)' }}>
            <span>O: <span className="mono" style={{ color: 'var(--text-1)' }}>{formatCurrency(quote.open)}</span></span>
            <span>H: <span className="mono" style={{ color: 'var(--green)' }}>{formatCurrency(quote.dayHigh)}</span></span>
            <span>L: <span className="mono" style={{ color: 'var(--red)' }}>{formatCurrency(quote.dayLow)}</span></span>
            <span>Prev: <span className="mono" style={{ color: 'var(--text-1)' }}>{formatCurrency(quote.previousClose)}</span></span>
            <span>52W H: <span className="mono" style={{ color: 'var(--green)' }}>{formatCurrency(quote.high52w)}</span></span>
            <span>52W L: <span className="mono" style={{ color: 'var(--red)' }}>{formatCurrency(quote.low52w)}</span></span>
          </div>
        )}
      </div>
    </div>
  );
}

export const ChartModal = memo(ChartModalInner);
