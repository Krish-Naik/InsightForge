'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Radar,
  RefreshCw,
  Signal,
  Siren,
  Target,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { HistoricalSeriesChart } from '@/components/charts/HistoricalSeriesChart';
import { SymbolLink } from '@/components/ui/SymbolLink';
import { EmptyPanel, MetricTile, PageHeader, SectionCard, TrendBadge } from '@/components/ui/page-kit';
import { marketAPI, type ScreenerMetric, type SectorOverview } from '@/lib/api';
import { formatCurrency, formatNumber, formatPercent } from '@/lib/format';

type SectorTrendFilter = 'same' | 'all' | 'bullish' | 'bearish';

function sortSectorRows(rows: ScreenerMetric[], trend: SectorOverview['trend'] | undefined) {
  const ordered = [...rows];
  ordered.sort((left, right) => {
    if (trend === 'bearish') {
      return left.momentumScore - right.momentumScore;
    }
    return right.momentumScore - left.momentumScore;
  });
  return ordered;
}

function SectorList({
  title,
  sectors,
  selectedSector,
  onSelect,
}: {
  title: string;
  sectors: SectorOverview[];
  selectedSector: string | null;
  onSelect: (sector: string) => void;
}) {
  return (
    <div className="stack-8">
      <div className="stat-label">{title}</div>
      {sectors.length ? sectors.map((sector) => {
        const active = selectedSector === sector.sector;
        return (
          <button
            key={sector.sector}
            type="button"
            className="metric-card"
            onClick={() => onSelect(sector.sector)}
            style={{
              padding: 14,
              textAlign: 'left',
              cursor: 'pointer',
              borderColor: active ? 'rgba(77, 199, 255, 0.34)' : undefined,
              background: active
                ? 'linear-gradient(135deg, rgba(77, 199, 255, 0.14), rgba(19, 224, 161, 0.08))'
                : undefined,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{sector.sector}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                  {sector.stockCount} tracked stocks
                </div>
              </div>
              <TrendBadge tone={sector.trend === 'bullish' ? 'positive' : 'negative'}>
                {formatPercent(sector.averageChangePercent)}
              </TrendBadge>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 10, fontSize: 11, color: 'var(--text-2)' }}>
              <span>▲ {sector.bullishCount}</span>
              <span>▼ {sector.bearishCount}</span>
              <span>Breadth {sector.breadth.toFixed(0)}%</span>
            </div>
          </button>
        );
      }) : <div className="metric-footnote">No sector data available.</div>}
    </div>
  );
}

export default function ScannerPage() {
  const [sectorOverview, setSectorOverview] = useState<SectorOverview[]>([]);
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  const [rows, setRows] = useState<ScreenerMetric[]>([]);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingRows, setLoadingRows] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trendFilter, setTrendFilter] = useState<SectorTrendFilter>('same');
  const [focusSymbol, setFocusSymbol] = useState<string | null>(null);
  const [focusPeriod, setFocusPeriod] = useState<'1d' | '5d' | '1mo'>('1d');

  const loadOverview = useCallback(async () => {
    setLoadingOverview(true);
    try {
      const overview = await marketAPI.getAllSectorsData();
      setSectorOverview(overview || []);

      if (!selectedSector) {
        const defaultSector = overview.find((sector) => sector.trend === 'bullish')?.sector || overview[0]?.sector || null;
        setSelectedSector(defaultSector);
      }

      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to load scanner sectors.');
    } finally {
      setLoadingOverview(false);
    }
  }, [selectedSector]);

  const loadSectorRows = useCallback(async (sectorName: string) => {
    setLoadingRows(true);
    try {
      const metrics = await marketAPI.getSectorAnalytics(sectorName, 48);
      setRows(metrics || []);
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to load scanner constituents.');
      setRows([]);
    } finally {
      setLoadingRows(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (!selectedSector) return;
    loadSectorRows(selectedSector);
  }, [selectedSector, loadSectorRows]);

  const selectedSectorMeta = useMemo(
    () => sectorOverview.find((sector) => sector.sector === selectedSector) || null,
    [sectorOverview, selectedSector],
  );

  const bullishSectors = useMemo(
    () => sectorOverview.filter((sector) => sector.trend === 'bullish').sort((left, right) => right.averageChangePercent - left.averageChangePercent),
    [sectorOverview],
  );
  const bearishSectors = useMemo(
    () => sectorOverview.filter((sector) => sector.trend === 'bearish').sort((left, right) => left.averageChangePercent - right.averageChangePercent),
    [sectorOverview],
  );

  const filteredRows = useMemo(() => {
    if (!selectedSectorMeta) return sortSectorRows(rows, undefined);

    const matchingTrend = trendFilter === 'same'
      ? selectedSectorMeta.trend
      : trendFilter === 'all'
        ? null
        : trendFilter;

    const nextRows = matchingTrend
      ? rows.filter((row) => row.trend === matchingTrend)
      : rows;

    return sortSectorRows(nextRows, selectedSectorMeta.trend);
  }, [rows, selectedSectorMeta, trendFilter]);

  const sectorBreadthTone = selectedSectorMeta?.trend === 'bullish'
    ? 'positive'
    : selectedSectorMeta?.trend === 'bearish'
      ? 'negative'
      : 'warning';

  useEffect(() => {
    if (!filteredRows.length) {
      setFocusSymbol(null);
      return;
    }

    if (!focusSymbol || !filteredRows.some((row) => row.symbol === focusSymbol)) {
      setFocusSymbol(filteredRows[0].symbol);
    }
  }, [filteredRows, focusSymbol]);

  const focusRow = useMemo(
    () => filteredRows.find((row) => row.symbol === focusSymbol) || filteredRows[0] || null,
    [filteredRows, focusSymbol],
  );

  return (
    <div className="page">
      <PageHeader
        kicker="Momentum Scanner"
        title="Sector-first intraday scanner"
        description="Sectors are ranked by breadth first, then the selected sector expands into a momentum table powered by RSI, trend state, volume ratio, and delayed valuation overlays. This avoids hammering public APIs across the full universe every refresh cycle."
        actions={
          <button onClick={loadOverview} disabled={loadingOverview} className="btn btn-ghost">
            <RefreshCw style={{ width: 14, height: 14 }} className={loadingOverview ? 'anim-spin' : ''} />
            Refresh sectors
          </button>
        }
      />

      {error ? <TrendBadge tone="warning">{error}</TrendBadge> : null}

      <div className="grid-fit-220">
        <MetricTile label="Bullish sectors" value={bullishSectors.length} tone="positive" icon={TrendingUp} subtext="Positive breadth and sector momentum" />
        <MetricTile label="Bearish sectors" value={bearishSectors.length} tone="negative" icon={TrendingDown} subtext="Negative breadth and weakening setups" />
        <MetricTile label="Selected sector" value={selectedSectorMeta?.sector || '—'} tone={sectorBreadthTone} icon={Radar} subtext={selectedSectorMeta ? `${selectedSectorMeta.stockCount} tracked stocks` : 'Choose a sector to scan'} />
        <MetricTile label="Breadth score" value={selectedSectorMeta ? `${selectedSectorMeta.breadth.toFixed(0)}%` : '—'} tone={sectorBreadthTone} icon={Signal} subtext={selectedSectorMeta ? `${selectedSectorMeta.sampleSize} live names sampled` : 'Bullish minus bearish participation'} />
      </div>

      <div className="two-column-layout">
        <div className="stack-16">
          <SectionCard title="Sector Radar" subtitle="Pick a bullish or bearish pocket before drilling into dynamic constituents" icon={Target}>
            {loadingOverview ? (
              <div className="grid-fit-280">
                {[...Array(6)].map((_, index) => <div key={index} className="skeleton" style={{ height: 96 }} />)}
              </div>
            ) : sectorOverview.length ? (
              <div className="grid-fit-280">
                <SectorList title="Bullish sectors" sectors={bullishSectors} selectedSector={selectedSector} onSelect={setSelectedSector} />
                <SectorList title="Bearish sectors" sectors={bearishSectors} selectedSector={selectedSector} onSelect={setSelectedSector} />
              </div>
            ) : (
              <EmptyPanel title="No sector breadth yet" description="The scanner will populate once the delayed sector snapshot is available." icon={Siren} />
            )}
          </SectionCard>

          <SectionCard title="Scan Controls" subtitle="Align results to the selected sector trend or widen them back to all tracked names" icon={Signal}>
            <div className="stack-16">
              <div className="tab-group">
                {[
                  { id: 'same', label: 'Same trend' },
                  { id: 'all', label: 'All stocks' },
                  { id: 'bullish', label: 'Bullish only' },
                  { id: 'bearish', label: 'Bearish only' },
                ].map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setTrendFilter(option.id as SectorTrendFilter)}
                    className={`tab ${trendFilter === option.id ? 'tab-active' : ''}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {selectedSectorMeta ? (
                <div className="metric-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                    <div>
                      <div className="stat-label">Selected sector</div>
                      <div className="metric-value">{selectedSectorMeta.sector}</div>
                    </div>
                    <TrendBadge tone={sectorBreadthTone}>{selectedSectorMeta.trend}</TrendBadge>
                  </div>
                  <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <span className="badge badge-green">▲ {selectedSectorMeta.bullishCount}</span>
                    <span className="badge badge-red">▼ {selectedSectorMeta.bearishCount}</span>
                    <span className="badge badge-muted">Avg {formatPercent(selectedSectorMeta.averageChangePercent)}</span>
                    <span className="badge badge-primary">{selectedSectorMeta.stockCount} covered</span>
                  </div>
                </div>
              ) : (
                <div className="metric-footnote">Choose a sector to load constituent analytics.</div>
              )}
            </div>
          </SectionCard>
        </div>

        <SectionCard title="Fast Candle View" subtitle="Lower-timeframe candle workspace for the currently selected momentum name" icon={Radar}>
          {focusRow ? (
            <div className="stack-16">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <div>
                  <div className="stat-label">Focus symbol</div>
                  <div className="metric-value">{focusRow.symbol}</div>
                  <div className="metric-footnote">{focusRow.name}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <TrendBadge tone={focusRow.changePercent >= 0 ? 'positive' : 'negative'}>{formatPercent(focusRow.changePercent)}</TrendBadge>
                  <TrendBadge tone={focusRow.trend === 'bullish' ? 'positive' : focusRow.trend === 'bearish' ? 'negative' : 'warning'}>{focusRow.trend || 'neutral'}</TrendBadge>
                </div>
              </div>

              <div className="tab-group">
                {[
                  { id: '1d', label: '1D' },
                  { id: '5d', label: '5D' },
                  { id: '1mo', label: '1M' },
                ].map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setFocusPeriod(option.id as '1d' | '5d' | '1mo')}
                    className={`tab ${focusPeriod === option.id ? 'tab-active' : ''}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <HistoricalSeriesChart symbol={focusRow.symbol} period={focusPeriod} variant="candles" height={360} showVolume showIndicators />
            </div>
          ) : (
            <EmptyPanel title="No focus symbol" description="Pick a sector or widen the trend filter to load a momentum name into the candle workspace." icon={Radar} />
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="Sector Constituents"
        subtitle={selectedSectorMeta ? `Momentum, RSI, volume, and valuation scan for ${selectedSectorMeta.sector}` : 'Select a sector to inspect its stocks'}
        icon={Radar}
      >
        {loadingRows ? (
          <div className="stack-12">
            {[...Array(6)].map((_, index) => <div key={index} className="skeleton" style={{ height: 48 }} />)}
          </div>
        ) : filteredRows.length ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Focus</th>
                  <th style={{ textAlign: 'right' }}>Price</th>
                  <th style={{ textAlign: 'right' }}>Day %</th>
                  <th style={{ textAlign: 'right' }}>Momentum</th>
                  <th style={{ textAlign: 'right' }}>RSI 14</th>
                  <th style={{ textAlign: 'right' }}>Vol Ratio</th>
                  <th style={{ textAlign: 'right' }}>PE</th>
                  <th style={{ textAlign: 'right' }}>Revenue %</th>
                  <th style={{ textAlign: 'center' }}>Trend</th>
                  <th style={{ textAlign: 'center' }}>Chart</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.symbol}>
                    <td>
                      <button type="button" onClick={() => setFocusSymbol(row.symbol)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
                        <div className="mono" style={{ fontSize: 12, fontWeight: 700, color: row.symbol === focusRow?.symbol ? 'var(--primary)' : 'var(--text-1)' }}>{row.symbol}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{row.name}</div>
                      </button>
                    </td>
                    <td style={{ textAlign: 'right' }}><span className="mono">{formatCurrency(row.currentPrice)}</span></td>
                    <td style={{ textAlign: 'right' }}>
                      <span className="mono" style={{ color: row.changePercent >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {formatPercent(row.changePercent)}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}><span className="mono">{formatNumber(row.momentumScore)}</span></td>
                    <td style={{ textAlign: 'right' }}><span className="mono">{row.rsi14 !== undefined ? formatNumber(row.rsi14) : '—'}</span></td>
                    <td style={{ textAlign: 'right' }}><span className="mono">{row.volumeRatio !== undefined ? `${formatNumber(row.volumeRatio)}x` : '—'}</span></td>
                    <td style={{ textAlign: 'right' }}><span className="mono">{row.peRatio !== null && row.peRatio !== undefined ? formatNumber(row.peRatio) : '—'}</span></td>
                    <td style={{ textAlign: 'right' }}><span className="mono">{row.revenueGrowth !== null && row.revenueGrowth !== undefined ? formatPercent(row.revenueGrowth) : '—'}</span></td>
                    <td style={{ textAlign: 'center' }}>
                      <TrendBadge tone={row.trend === 'bullish' ? 'positive' : row.trend === 'bearish' ? 'negative' : 'warning'}>
                        {row.trend || 'neutral'}
                      </TrendBadge>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <SymbolLink symbol={row.symbol} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                        <span className="btn btn-ghost">Open</span>
                      </SymbolLink>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyPanel title="No scanner rows" description="The chosen sector currently has no rows matching the active trend filter." icon={Siren} />
        )}
      </SectionCard>
    </div>
  );
}