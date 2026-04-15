'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Compass, Filter, RefreshCw, ShieldCheck, Sparkles, Target } from 'lucide-react';
import { OpportunityInsightCard } from '@/components/ui/insight-kit';
import { EmptyPanel, MetricTile, PageHeader, SectionCard, TrendBadge } from '@/components/ui/page-kit';
import { marketAPI, type GuidedScreenerResponse, type ScreenerFilters, type ScreenerPlaybook, type ScreenerSort, type SectorOverview, type Selectivity, type TradingHorizon } from '@/lib/api';
import { formatIST, formatTimeAgo } from '@/lib/format';

const PLAYBOOKS: Array<{ id: ScreenerPlaybook; label: string; description: string }> = [
  { id: 'leadership', label: 'Strong stocks in strong sectors', description: 'Find confirmed leaders after a broad market sweep.' },
  { id: 'quality', label: 'Quality names with improving trend', description: 'Blend durable trend quality with fundamentals when the provider supplies them.' },
  { id: 'pullback', label: 'Pullbacks in leadership', description: 'Look for second-chance entries rather than late chases.' },
  { id: 'sympathy', label: 'Secondary names in hot sectors', description: 'Spot lagging names in sectors where participation is broadening.' },
  { id: 'avoid', label: 'What to leave alone', description: 'Use the screener defensively when market quality is fading.' },
];

const SORTS: Array<{ id: ScreenerSort; label: string }> = [
  { id: 'score', label: 'Best fit' },
  { id: 'momentum', label: 'Momentum' },
  { id: 'volume', label: 'Volume' },
  { id: 'breakout', label: 'Breakout' },
  { id: 'sector', label: 'Sector strength' },
  { id: 'value', label: 'Quality / value' },
];

const EMPTY_FILTERS: ScreenerFilters = {};

function parseFilterValue(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function FilterInput({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: number | null | undefined;
  placeholder: string;
  onChange: (nextValue: string) => void;
}) {
  return (
    <div>
      <div className="stat-label" style={{ marginBottom: 8 }}>{label}</div>
      <input
        className="input"
        inputMode="decimal"
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

export default function ScreenerPage() {
  const [playbook, setPlaybook] = useState<ScreenerPlaybook>('leadership');
  const [horizon, setHorizon] = useState<TradingHorizon>('swing');
  const [selectivity, setSelectivity] = useState<Selectivity>('balanced');
  const [sortBy, setSortBy] = useState<ScreenerSort>('score');
  const [sector, setSector] = useState<string | 'all'>('all');
  const [draftFilters, setDraftFilters] = useState<ScreenerFilters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<ScreenerFilters>(EMPTY_FILTERS);
  const [screen, setScreen] = useState<GuidedScreenerResponse | null>(null);
  const [sectors, setSectors] = useState<SectorOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadResults = useCallback(async () => {
    setRefreshing(true);
    try {
      const [nextScreen, nextSectors] = await Promise.all([
        marketAPI.getGuidedScreener(playbook, horizon, selectivity, sortBy, sector, appliedFilters),
        marketAPI.getAllSectorsData(),
      ]);
      setScreen(nextScreen);
      setSectors(nextSectors);
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to load guided screener ideas.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [appliedFilters, horizon, playbook, sector, selectivity, sortBy]);

  useEffect(() => {
    void loadResults();
  }, [loadResults]);

  const activePlaybook = useMemo(() => PLAYBOOKS.find((entry) => entry.id === playbook) || PLAYBOOKS[0], [playbook]);
  const sectorOptions = useMemo(() => ['all', ...sectors.map((entry) => entry.sector)], [sectors]);

  const updateFilter = useCallback((key: keyof ScreenerFilters, rawValue: string) => {
    setDraftFilters((current) => ({
      ...current,
      [key]: parseFilterValue(rawValue),
    }));
  }, []);

  const applyFilters = useCallback(() => {
    setAppliedFilters({ ...draftFilters });
  }, [draftFilters]);

  const clearFilters = useCallback(() => {
    setDraftFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
  }, []);

  return (
    <div className="page">
      <PageHeader
        kicker="Guided Screener"
        title="Market-wide discovery with real screen controls"
        description="Guided Screener is the deliberate workflow. Start with a playbook, then narrow the market with structured filters and transparent ranking logic."
        actions={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {screen?.generatedAt ? <span className="topbar-pill">Updated {formatTimeAgo(screen.generatedAt)} • {formatIST(new Date(screen.generatedAt))}</span> : null}
            <TrendBadge tone={screen?.sourceMode === 'ai' ? 'primary' : 'warning'}>{screen?.sourceMode === 'ai' ? 'Groq phrasing' : 'Rules-first'}</TrendBadge>
            <button onClick={() => void loadResults()} disabled={refreshing} className="btn btn-ghost">
              <RefreshCw style={{ width: 14, height: 14 }} className={refreshing ? 'anim-spin' : ''} />
              Refresh
            </button>
          </div>
        }
      />

      {error ? <TrendBadge tone="warning">{error}</TrendBadge> : null}

      <div className="metric-strip-grid">
        <MetricTile label="Playbook" value={activePlaybook.label} tone="primary" icon={Compass} subtext={activePlaybook.description} />
        <MetricTile label="Sector focus" value={screen?.sector === 'all' ? 'All sectors' : screen?.sector || 'All sectors'} tone="positive" icon={Target} subtext={`${screen?.coverage.sectorsScanned || 0} sectors scanned`} />
        <MetricTile label="Base matches" value={screen?.diagnostics.baseMatches || 0} tone="warning" icon={Sparkles} subtext={`${screen?.coverage.matches || 0} final matches`} />
        <MetricTile label="Sort" value={SORTS.find((entry) => entry.id === sortBy)?.label || 'Best fit'} tone="negative" icon={Filter} subtext={`${screen?.diagnostics.activeFilters.length || 0} active filters`} />
      </div>

      <div className="workbench-grid-three">
        <SectionCard title="Playbooks" subtitle="Start with the type of opportunity you want to discover" icon={Compass}>
          <div className="panel-scroll-tight stack-12">
            {PLAYBOOKS.map((entry) => {
              const active = entry.id === playbook;
              return (
                <button
                  key={entry.id}
                  type="button"
                  className="list-card"
                  onClick={() => setPlaybook(entry.id)}
                  style={{
                    textAlign: 'left',
                    cursor: 'pointer',
                    borderColor: active ? 'rgba(217, 154, 79, 0.34)' : undefined,
                    background: active ? 'linear-gradient(135deg, rgba(217, 154, 79, 0.16), rgba(255,248,236,0.03))' : undefined,
                  }}
                >
                  <div className="stat-label">Playbook</div>
                  <div style={{ marginTop: 8, fontSize: 15, fontWeight: 700 }}>{entry.label}</div>
                  <div className="metric-footnote">{entry.description}</div>
                </button>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard title="Screen Controls" subtitle="Macro controls that reshape the research universe" icon={Filter}>
          <div className="stack-12">
            <div>
              <div className="stat-label" style={{ marginBottom: 8 }}>Sector focus</div>
              <select value={sector} onChange={(event) => setSector(event.target.value)} className="input">
                {sectorOptions.map((entry) => (
                  <option key={entry} value={entry}>{entry === 'all' ? 'All sectors' : entry}</option>
                ))}
              </select>
            </div>

            <div>
              <div className="stat-label" style={{ marginBottom: 8 }}>Sort results by</div>
              <div className="tab-group">
                {SORTS.map((entry) => (
                  <button key={entry.id} type="button" onClick={() => setSortBy(entry.id)} className={`tab ${sortBy === entry.id ? 'tab-active' : ''}`}>{entry.label}</button>
                ))}
              </div>
            </div>

            <div>
              <div className="stat-label" style={{ marginBottom: 8 }}>Horizon</div>
              <div className="tab-group">
                {(['intraday', 'swing'] as TradingHorizon[]).map((entry) => (
                  <button key={entry} type="button" onClick={() => setHorizon(entry)} className={`tab ${horizon === entry ? 'tab-active' : ''}`}>{entry}</button>
                ))}
              </div>
            </div>

            <div>
              <div className="stat-label" style={{ marginBottom: 8 }}>Selectivity</div>
              <div className="tab-group">
                {(['conservative', 'balanced', 'aggressive'] as Selectivity[]).map((entry) => (
                  <button key={entry} type="button" onClick={() => setSelectivity(entry)} className={`tab ${selectivity === entry ? 'tab-active' : ''}`}>{entry}</button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" onClick={applyFilters} className="btn btn-primary">Run screen</button>
              <button type="button" onClick={clearFilters} className="btn btn-ghost">Clear filters</button>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Numeric Filters" subtitle="Price, momentum, participation, and valuation thresholds" icon={Filter}>
          <div className="grid-fit-180">
            <FilterInput label="Min price" value={draftFilters.minPrice} placeholder="e.g. 200" onChange={(value) => updateFilter('minPrice', value)} />
            <FilterInput label="Max price" value={draftFilters.maxPrice} placeholder="e.g. 2500" onChange={(value) => updateFilter('maxPrice', value)} />
            <FilterInput label="Min momentum" value={draftFilters.minMomentumScore} placeholder="e.g. 20" onChange={(value) => updateFilter('minMomentumScore', value)} />
            <FilterInput label="Min volume ratio" value={draftFilters.minVolumeRatio} placeholder="e.g. 1.2" onChange={(value) => updateFilter('minVolumeRatio', value)} />
            <FilterInput label="Max RSI" value={draftFilters.maxRsi14} placeholder="e.g. 68" onChange={(value) => updateFilter('maxRsi14', value)} />
            <FilterInput label="Min 52W range" value={draftFilters.minWeek52RangePosition} placeholder="e.g. 55" onChange={(value) => updateFilter('minWeek52RangePosition', value)} />
            <FilterInput label="Near 52W high" value={draftFilters.maxDistanceFromHigh52} placeholder="within %" onChange={(value) => updateFilter('maxDistanceFromHigh52', value)} />
            <FilterInput label="Max PE" value={draftFilters.maxPeRatio} placeholder="e.g. 25" onChange={(value) => updateFilter('maxPeRatio', value)} />
            <FilterInput label="Max P/B" value={draftFilters.maxPriceToBook} placeholder="e.g. 4" onChange={(value) => updateFilter('maxPriceToBook', value)} />
            <FilterInput label="Min revenue growth" value={draftFilters.minRevenueGrowth} placeholder="e.g. 12" onChange={(value) => updateFilter('minRevenueGrowth', value)} />
            <FilterInput label="Min profit margin" value={draftFilters.minProfitMargins} placeholder="e.g. 10" onChange={(value) => updateFilter('minProfitMargins', value)} />
          </div>
        </SectionCard>
      </div>

      <div className="workbench-grid">
        <SectionCard title="Screen Readout" subtitle="Why this screen is returning these names" icon={ShieldCheck} tone="primary">
          {screen ? (
            <div className="stack-16">
              <div className="metric-footnote">{screen.narrative}</div>
              <div className="grid-fit-180">
                <MetricTile label="Universe in focus" value={screen.coverage.universeStocks} tone="primary" />
                <MetricTile label="Sectors scanned" value={screen.coverage.sectorsScanned} tone="positive" />
                <MetricTile label="Filtered out" value={screen.diagnostics.filteredOut} tone="warning" />
                <MetricTile label="Matches" value={screen.coverage.matches} tone="negative" />
              </div>

              {screen.diagnostics.activeFilters.length ? (
                <div className="opportunity-chip-row">
                  {screen.diagnostics.activeFilters.map((entry) => (
                    <span key={`${entry.label}-${entry.value}`} className="badge badge-muted">{entry.label}: {entry.value}</span>
                  ))}
                </div>
              ) : null}

              <div className="grid-fit-180">
                <MetricTile label="PE coverage" value={`${screen.diagnostics.fieldCoverage.peRatio}%`} tone="primary" />
                <MetricTile label="P/B coverage" value={`${screen.diagnostics.fieldCoverage.priceToBook}%`} tone="positive" />
                <MetricTile label="Growth coverage" value={`${screen.diagnostics.fieldCoverage.revenueGrowth}%`} tone="warning" />
                <MetricTile label="Margin coverage" value={`${screen.diagnostics.fieldCoverage.profitMargins}%`} tone="negative" />
              </div>

              <div className="stack-8">
                {screen.diagnostics.notes.map((entry) => (
                  <div key={entry} className="metric-footnote">{entry}</div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyPanel title="Screener readout loading" description="The screen explanation will appear once the broader market sweep completes." icon={ShieldCheck} />
          )}
        </SectionCard>

        <SectionCard title="Sector Match Board" subtitle="Where the current screen is finding qualified names" icon={Target}>
          {screen?.sectorFocus.length ? (
            <div className="panel-scroll-tight stack-12">
              {screen.sectorFocus.map((entry) => (
                <div key={entry.sector} className="list-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                    <div>
                      <div className="stat-label">Sector</div>
                      <div style={{ marginTop: 8, fontSize: 15, fontWeight: 700 }}>{entry.sector}</div>
                    </div>
                    <TrendBadge tone={entry.trend === 'bullish' ? 'positive' : entry.trend === 'bearish' ? 'negative' : 'warning'}>{entry.matchCount} matches</TrendBadge>
                  </div>
                  <div className="metric-footnote">Breadth {entry.breadth.toFixed(0)}% • Avg move {entry.averageChangePercent.toFixed(2)}% • Candidates {entry.candidateCount}</div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyPanel title="Sector board unavailable" description="Sector match density will appear here once the screen has enough qualified names." icon={Target} />
          )}
        </SectionCard>
      </div>

      <div className="workbench-grid">
        <SectionCard title="Qualified Results" subtitle="Broader discovery results with explicit research controls" icon={Sparkles}>
          {loading && !screen ? (
            <div className="compact-card-grid">
              {[...Array(6)].map((_, index) => <div key={index} className="skeleton" style={{ height: 220 }} />)}
            </div>
          ) : screen?.opportunities.length ? (
            <div className="panel-scroll">
              <div className="compact-card-grid">
                {screen.opportunities.map((opportunity, index) => (
                  <OpportunityInsightCard key={`${opportunity.id}-${playbook}-${sortBy}`} opportunity={opportunity} rank={index + 1} compact />
                ))}
              </div>
            </div>
          ) : (
            <EmptyPanel title="No ideas matched" description="The playbook and numeric filters are stricter than current market conditions. Loosen one threshold or change the sector focus." icon={Compass} />
          )}
        </SectionCard>
      </div>
    </div>
  );
}
