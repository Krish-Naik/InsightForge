'use client';

import { useEffect, useMemo, useState } from 'react';
import { marketAPI, type HistoricalBar } from '@/lib/api';

interface SparklineProps {
  symbol: string;
  period?: string;
  width?: number;
  height?: number;
}

const seriesCache = new Map<string, HistoricalBar[]>();
const inflightCache = new Map<string, Promise<HistoricalBar[]>>();

async function loadSeries(symbol: string, period: string): Promise<HistoricalBar[]> {
  const key = `${symbol}:${period}`;
  if (seriesCache.has(key)) return seriesCache.get(key)!;
  if (!inflightCache.has(key)) {
    inflightCache.set(
      key,
      marketAPI.getHistorical(symbol, period)
        .then((series) => {
          seriesCache.set(key, series);
          return series;
        })
        .finally(() => {
          inflightCache.delete(key);
        }),
    );
  }

  return inflightCache.get(key)!;
}

function buildPath(values: number[], width: number, height: number): string {
  if (values.length < 2) return '';

  const padding = 6;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;

  return values
    .map((value, index) => {
      const x = padding + (index / (values.length - 1)) * innerWidth;
      const y = padding + innerHeight - ((value - min) / range) * innerHeight;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

export function Sparkline({ symbol, period = '1mo', width = 180, height = 72 }: SparklineProps) {
  const [series, setSeries] = useState<HistoricalBar[] | null>(seriesCache.get(`${symbol}:${period}`) || null);

  useEffect(() => {
    let active = true;

    loadSeries(symbol, period)
      .then((nextSeries) => {
        if (active) setSeries(nextSeries);
      })
      .catch(() => {
        if (active) setSeries([]);
      });

    return () => {
      active = false;
    };
  }, [symbol, period]);

  const values = useMemo(
    () => (series || []).map((bar) => Number(bar.close || 0)).filter((value) => value > 0),
    [series],
  );

  if (!series) {
    return <div className="skeleton rounded" style={{ width, height }} />;
  }

  if (values.length < 2) {
    return (
      <div
        style={{
          width,
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-3)',
          fontSize: 11,
          border: '1px dashed rgba(255,255,255,0.08)',
          borderRadius: 10,
        }}
      >
        No chart data
      </div>
    );
  }

  const path = buildPath(values, width, height);
  const rising = values[values.length - 1] >= values[0];
  const stroke = rising ? 'var(--green)' : 'var(--red)';
  const fill = rising ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)';

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" aria-hidden="true">
      <defs>
        <linearGradient id={`spark-fill-${symbol.replace(/[^a-z0-9]/gi, '-')}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={fill} />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width={width} height={height} rx="10" fill="rgba(255,255,255,0.02)" />
      <path d={`${path} L ${width - 6} ${height - 6} L 6 ${height - 6} Z`} fill={`url(#spark-fill-${symbol.replace(/[^a-z0-9]/gi, '-')})`} />
      <path d={path} fill="none" stroke={stroke} strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}