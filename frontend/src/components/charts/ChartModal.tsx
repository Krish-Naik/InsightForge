'use client';
import { useEffect, useRef, useState, useCallback, memo } from 'react';
import { X, Maximize2, Minimize2, Loader2, RefreshCw } from 'lucide-react';
import { useChart } from '@/lib/contexts/ChartContext';
import { marketAPI, type Quote, type HistoricalBar } from '@/lib/api';
import { formatCurrency, formatPercent } from '@/lib/format';

const PERIODS = [
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '30m', value: '30m' },
  { label: '1H', value: '1h' },
  { label: '1D', value: '1d' },
  { label: '5D', value: '5d' },
  { label: '1M', value: '1mo' },
  { label: '3M', value: '3mo' },
  { label: '6M', value: '6mo' },
  { label: '1Y', value: '1y' },
  { label: 'ALL', value: 'max' },
];

function toChartTime(value: string): number | null {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return Math.floor(timestamp / 1000);
}

function calculateSma(values: number[], period: number): Array<number | null> {
  if (!values.length) return [];

  return values.map((_, index) => {
    if (index + 1 < period) return null;
    const window = values.slice(index - period + 1, index + 1);
    return window.reduce((sum, entry) => sum + entry, 0) / window.length;
  });
}

function calculateEma(values: number[], period: number): Array<number | null> {
  if (!values.length) return [];

  const multiplier = 2 / (period + 1);
  let ema = values[0];

  return values.map((value, index) => {
    if (index === 0) return value;
    ema = (value - ema) * multiplier + ema;
    return index + 1 < period ? null : ema;
  });
}

function ChartModalInner() {
  const { activeSymbol, exchange, closeChart } = useChart();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const candleRef = useRef<any>(null);
  const volRef = useRef<any>(null);
  const sma20Ref = useRef<any>(null);
  const sma50Ref = useRef<any>(null);
  const ema21Ref = useRef<any>(null);
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
      sma20Ref.current?.setData([]);
      sma50Ref.current?.setData([]);
      ema21Ref.current?.setData([]);

      const bars = historical
        .map((entry) => {
          const time = toChartTime(entry.date ?? '');
          return {
            time: time as any,
            open: +entry.open,
            high: +entry.high,
            low: +entry.low,
            close: +entry.close,
          };
        })
        .filter((bar) => bar.time && bar.open > 0 && bar.high > 0 && bar.low > 0 && bar.close > 0);

      const vols = historical
        .map((entry) => {
          const time = toChartTime(entry.date ?? '');
          return {
            time: time as any,
            value: +entry.volume || 0,
            color: +entry.close >= +entry.open ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)',
          };
        })
        .filter((volumeBar) => volumeBar.time && volumeBar.value > 0);

      const closes = bars.map((bar) => bar.close);
      const sma20 = calculateSma(closes, 20)
        .map((value, index) => (value === null ? null : { time: bars[index].time, value }))
        .filter((value): value is { time: any; value: number } => Boolean(value));
      const sma50 = calculateSma(closes, 50)
        .map((value, index) => (value === null ? null : { time: bars[index].time, value }))
        .filter((value): value is { time: any; value: number } => Boolean(value));
      const ema21 = calculateEma(closes, 21)
        .map((value, index) => (value === null ? null : { time: bars[index].time, value }))
        .filter((value): value is { time: any; value: number } => Boolean(value));

      if (bars.length) {
        candleRef.current.setData(bars);
        sma20Ref.current?.setData(sma20);
        sma50Ref.current?.setData(sma50);
        ema21Ref.current?.setData(ema21);
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

    import('lightweight-charts').then(({ createChart, ColorType, CrosshairMode, CandlestickSeries, HistogramSeries, LineSeries }) => {
      if (!containerRef.current) return;
      containerRef.current.innerHTML = '';

      chart = createChart(containerRef.current, {
        layout: { background: { type: ColorType.Solid, color: '#ffffff' }, textColor: '#374151', fontSize: 11 },
        grid: { vertLines: { color: '#e5e7eb' }, horzLines: { color: '#e5e7eb' } },
        crosshair: { mode: CrosshairMode.Normal },
        rightPriceScale: { borderColor: '#e5e7eb', scaleMargins: { top: 0.08, bottom: 0.22 } },
        timeScale: { borderColor: '#e5e7eb', rightOffset: 5, barSpacing: 10, timeVisible: true },
        handleScroll: true,
        handleScale: true,
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      });

      const candle = chart.addSeries(CandlestickSeries, {
        upColor: '#16a34a', downColor: '#dc2626',
        borderUpColor: '#16a34a', borderDownColor: '#dc2626',
        wickUpColor: '#16a34a', wickDownColor: '#dc2626',
      });

      const vol = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: 'vol',
      });
      const sma20 = chart.addSeries(LineSeries, {
        color: '#4dc7ff',
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      const sma50 = chart.addSeries(LineSeries, {
        color: '#ffbf5e',
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      const ema21 = chart.addSeries(LineSeries, {
        color: '#13e0a1',
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

      chartRef.current = chart;
      candleRef.current = candle;
      volRef.current = vol;
      sma20Ref.current = sma20;
      sma50Ref.current = sma50;
      ema21Ref.current = ema21;

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
      sma20Ref.current = null;
      sma50Ref.current = null;
      ema21Ref.current = null;
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
        style={{ background: '#ffffff', border: '1px solid #e5e7eb' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#e5e7eb' }}>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="pulse-dot" style={{ background: up ? 'var(--green)' : 'var(--red)' }} />
              <span className="mono font-bold text-base" style={{ color: '#111827' }}>
                {exchange}:{activeSymbol}
              </span>
            </div>
            {quote && (
              <div className="flex items-center gap-3">
                <span className="mono font-bold text-lg" style={{ color: '#111827' }}>
                  {formatCurrency(quote.price)}
                </span>
                <span className="badge" style={{
                  background: up ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                  color:       up ? 'var(--green)'    : 'var(--red)',
                }}>
                  {formatPercent(quote.changePercent)}
                </span>
                <span className="text-xs" style={{ color: '#6b7280' }}>
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
            <div className="absolute inset-0 flex items-center justify-center z-10" style={{ background: '#ffffff' }}>
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-6 h-6 anim-spin" style={{ color: '#111827' }} />
                <span className="text-xs" style={{ color: '#6b7280' }}>Loading chart data…</span>
              </div>
            </div>
          )}
          {error && !loading && (
            <div className="absolute inset-0 flex items-center justify-center z-10" style={{ background: '#ffffff' }}>
              <div className="text-center">
                <div className="text-sm mb-1" style={{ color: '#dc2626' }}>{error}</div>
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
          <div className="flex items-center gap-6 px-4 py-2 text-xs border-t" style={{ borderColor: '#e5e7eb', color: '#6b7280' }}>
            <span>O: <span className="mono" style={{ color: '#111827' }}>{formatCurrency(quote.open)}</span></span>
            <span>H: <span className="mono" style={{ color: '#16a34a' }}>{formatCurrency(quote.dayHigh)}</span></span>
            <span>L: <span className="mono" style={{ color: '#dc2626' }}>{formatCurrency(quote.dayLow)}</span></span>
            <span>Prev: <span className="mono" style={{ color: '#111827' }}>{formatCurrency(quote.previousClose)}</span></span>
            <span>52W H: <span className="mono" style={{ color: '#16a34a' }}>{formatCurrency(quote.high52w)}</span></span>
            <span>52W L: <span className="mono" style={{ color: '#dc2626' }}>{formatCurrency(quote.low52w)}</span></span>
            <span>SMA20 / SMA50 / EMA21 enabled</span>
          </div>
        )}
      </div>
    </div>
  );
}

export const ChartModal = memo(ChartModalInner);
