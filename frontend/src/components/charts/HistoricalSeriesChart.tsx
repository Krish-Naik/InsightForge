'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { marketAPI, type HistoricalBar } from '@/lib/api';

type ChartVariant = 'line' | 'candles';

interface HistoricalSeriesChartProps {
  symbol: string;
  period?: string;
  variant?: ChartVariant;
  height?: number;
  showVolume?: boolean;
  showIndicators?: boolean;
}

type SeriesPoint = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

const seriesCache = new Map<string, HistoricalBar[]>();
const inflightCache = new Map<string, Promise<HistoricalBar[]>>();

async function loadSeries(symbol: string, period: string): Promise<HistoricalBar[]> {
  const key = `${symbol}:${period}`;
  if (seriesCache.has(key)) return seriesCache.get(key)!;

  if (!inflightCache.has(key)) {
    inflightCache.set(
      key,
      marketAPI.getHistorical(symbol, period)
        .then((bars) => {
          seriesCache.set(key, bars);
          return bars;
        })
        .finally(() => {
          inflightCache.delete(key);
        }),
    );
  }

  return inflightCache.get(key)!;
}

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

export function HistoricalSeriesChart({
  symbol,
  period = '1y',
  variant = 'line',
  height = 340,
  showVolume = false,
  showIndicators = false,
}: HistoricalSeriesChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [series, setSeries] = useState<HistoricalBar[] | null>(seriesCache.get(`${symbol}:${period}`) || null);
  const [loading, setLoading] = useState(!series);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    loadSeries(symbol, period)
      .then((bars) => {
        if (!active) return;
        setSeries(bars);
      })
      .catch((nextError) => {
        if (!active) return;
        setSeries([]);
        setError(nextError instanceof Error ? nextError.message : 'Failed to load chart data.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [symbol, period]);

  const points = useMemo<SeriesPoint[]>(() => {
    return (series || [])
      .map((bar) => {
        const time = toChartTime(bar.date || '');
        return {
          time: time || 0,
          open: Number(bar.open || 0),
          high: Number(bar.high || 0),
          low: Number(bar.low || 0),
          close: Number(bar.close || 0),
          volume: Number(bar.volume || 0),
        };
      })
      .filter((bar) => bar.time > 0 && bar.close > 0 && bar.high > 0 && bar.low > 0);
  }, [series]);

  useEffect(() => {
    if (!containerRef.current || !points.length) return;

    let cleanup = () => {};

    import('lightweight-charts').then(({ createChart, CandlestickSeries, ColorType, CrosshairMode, HistogramSeries, LineSeries }) => {
      if (!containerRef.current) return;

      const getCSSVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

      const chartBg = getComputedStyle(containerRef.current).backgroundColor || 'transparent';
      const chart = createChart(containerRef.current, {
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: getCSSVar('--chart-text') || '#6b7280',
          fontSize: 11,
        },
        grid: {
          vertLines: { color: 'transparent' },
          horzLines: { color: getCSSVar('--border-subtle') },
        },
        crosshair: { mode: CrosshairMode.Normal },
        width: containerRef.current.clientWidth,
        height,
        rightPriceScale: {
          borderColor: getCSSVar('--border-subtle'),
          scaleMargins: { top: 0.08, bottom: showVolume ? 0.24 : 0.08 },
        },
        timeScale: {
          borderColor: getCSSVar('--border-subtle'),
          rightOffset: 6,
          barSpacing: variant === 'candles' ? 8 : 6,
          timeVisible: period === '15m' || period === '1d' || period === '5d',
        },
        handleScroll: true,
        handleScale: true,
      });

      if (variant === 'candles') {
        const candles = chart.addSeries(CandlestickSeries, {
          upColor: getCSSVar('--chart-up'),
          downColor: getCSSVar('--chart-down'),
          borderUpColor: getCSSVar('--chart-up'),
          borderDownColor: getCSSVar('--chart-down'),
          wickUpColor: getCSSVar('--chart-up'),
          wickDownColor: getCSSVar('--chart-down'),
        });
        candles.setData(points.map((point) => ({
          time: point.time as any,
          open: point.open,
          high: point.high,
          low: point.low,
          close: point.close,
        })));
      } else {
        const line = chart.addSeries(LineSeries, {
          color: getCSSVar('--chart-line'),
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        line.setData(points.map((point) => ({ time: point.time as any, value: point.close })));
      }

      if (showIndicators) {
        const closes = points.map((point) => point.close);
        const overlays = [
          { color: getCSSVar('--chart-sma-20'), values: calculateSma(closes, 20) },
          { color: getCSSVar('--chart-sma-50'), values: calculateSma(closes, 50) },
          { color: getCSSVar('--chart-ema-21'), values: calculateEma(closes, 21) },
        ];

        for (const overlay of overlays) {
          const seriesLine = chart.addSeries(LineSeries, {
            color: overlay.color,
            lineWidth: 1,
            priceLineVisible: false,
            lastValueVisible: false,
          });

          seriesLine.setData(
            overlay.values
              .map((value, index) => value === null ? null : ({ time: points[index].time as any, value }))
              .filter((value): value is { time: any; value: number } => Boolean(value)),
          );
        }
      }

      if (showVolume) {
        const volume = chart.addSeries(HistogramSeries, {
          priceFormat: { type: 'volume' },
          priceScaleId: 'vol',
        });
        chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
        volume.setData(points
          .filter((point) => point.volume > 0)
          .map((point) => ({
            time: point.time as any,
            value: point.volume,
            color: point.close >= point.open ? getCSSVar('--chart-vol-up') : getCSSVar('--chart-vol-down'),
          })));
      }

      chart.timeScale().fitContent();

      const resizeObserver = new ResizeObserver(() => {
        if (!containerRef.current) return;
        chart.applyOptions({ width: containerRef.current.clientWidth, height });
      });
      resizeObserver.observe(containerRef.current);

      cleanup = () => {
        resizeObserver.disconnect();
        chart.remove();
      };
    });

    return () => {
      cleanup();
    };
  }, [height, period, points, showIndicators, showVolume, variant]);

  return (
    <div style={{ position: 'relative', height, width: '100%' }}>
      {loading ? (
        <div className="empty-state" style={{ height }}>
          <Loader2 className="anim-spin" style={{ width: 24, height: 24, color: 'var(--text-3)' }} />
          <div style={{ fontSize: 12, color: 'var(--text-2)' }}>Loading {symbol} chart...</div>
        </div>
      ) : null}

      {!loading && error ? (
        <div className="empty-state" style={{ height }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--red)' }}>Chart unavailable</div>
          <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{error}</div>
        </div>
      ) : null}

      {!loading && !error && !points.length ? (
        <div className="empty-state" style={{ height }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>No chart data</div>
          <div style={{ fontSize: 12, color: 'var(--text-2)' }}>No historical data for {symbol} in this window.</div>
        </div>
      ) : null}

      <div
        ref={containerRef}
        style={{
          width: '100%',
          height,
          opacity: loading || error || !points.length ? 0 : 1,
          transition: 'opacity 200ms ease',
        }}
      />
    </div>
  );
}