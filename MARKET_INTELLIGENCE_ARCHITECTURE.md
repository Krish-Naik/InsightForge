# InsightForge Market Intelligence Architecture

## Goal

Turn InsightForge from a request-time market dashboard into a market intelligence platform that can continuously scan a broad NSE universe, precompute signals, and serve distinct outputs for:

- Today: market overview and narrative
- Radar: live discovery and signal feed
- Guided Screener: deliberate research and filtering
- Stock Story: symbol-level interpretation

The target operating model is not "fetch everything when the user opens a page".

The target operating model is:

1. maintain one master universe
2. sweep that universe in batches on a background cadence
3. compute reusable features once
4. materialize ranked outputs into Redis
5. let APIs read snapshots instead of rebuilding the market on every request

## Current State

The current codebase already has the right seams, but not the final infrastructure.

What is already in place:

- `MarketUniverseService` builds a large exchange universe from Upstox instrument masters
- `YahooFinanceService` already batches quote access and guards concurrency
- `MarketInsightsService` separates Today, Radar, Screener, and Stock Story contracts
- Radar already exposes signal feed, window summaries, and sector shifts
- Screener already exposes structured numeric filters and diagnostics
- SSE already exists for market summary streaming

What is still not true yet:

- there is no Redis-backed feature store
- there is no background sweep worker over a stable 1500-stock manifest
- some sector surfaces still use sampled slices rather than one centralized market processor
- fundamentals coverage is partial because public Yahoo endpoints are inconsistent for deeper fields

So the right next step is not to keep widening request-time scans.

The right next step is to move market-wide work into a background pipeline.

## Product Separation

The platform should use one shared market feature layer, but produce different outputs.

### Today

Question answered: what matters in the market right now?

Output style:

- index state
- breadth state
- sector leadership
- short narrative
- 3 to 5 carry-forward names

### Radar

Question answered: what just became interesting?

Output style:

- short-lived signal feed
- 5m, 15m, and session windows
- sector shift detection
- ranked opportunity stream

Radar is discovery-first. It should prefer freshness, change, and tape behavior.

### Guided Screener

Question answered: which names match the setup I want to research?

Output style:

- playbook-driven result set
- structured numeric filters
- diagnostics and field coverage
- stable ranking rather than short-lived alerts

Screener is research-first. It should prefer repeatable filters, explainable ranking, and provider honesty.

### Stock Story

Question answered: what is really happening in this stock and how should I frame it?

Output style:

- stance
- why it is moving
- setup map
- bull vs bear case
- sector and peer context

## Architecture Principle

Do not let page requests do market reconstruction.

Every expensive cross-market operation should happen before the request path.

The API layer should mostly do:

1. read latest snapshot
2. apply light personalization or filters
3. return a typed payload

## Target System

## 1. Master Universe Layer

Build one canonical tradable universe for scanning.

### Source

- Upstox NSE instrument master for symbol identity and exchange metadata
- optional BSE only for alias resolution, not primary scanning

### Stored fields per symbol

```json
{
  "symbol": "RELIANCE",
  "exchange": "NSE",
  "instrumentKey": "NSE_EQ|INE002A01018",
  "name": "Reliance Industries Limited",
  "sector": "Energy",
  "industry": "Oil & Gas Refining & Marketing",
  "liquidityTier": "A",
  "marketCapBucket": "large",
  "isActive": true,
  "isScanEligible": true,
  "aliases": ["RELIANCE.NS", "Reliance Industries"]
}
```

### Why this matters

Every downstream processor should consume the same symbol manifest.

That prevents Radar, Screener, and Story from quietly using different stock populations.

### Recommended rollout

- `universe:all`: full exchange metadata universe
- `universe:scan:nse1500`: active scan set for liquid NSE names
- `universe:scan:nse500`: fallback smaller set for degraded mode

## 2. Sweep Scheduler

Create a background worker responsible for refreshing market features on cadence.

### Cadence split

- `20s`: quote and tape features for Radar
- `60s`: sector aggregates and Today narrative inputs
- `5m`: slower swing features and expanded Screener ranking
- `daily` or `overnight`: fundamentals refresh and universe maintenance

### Why split cadence

Not every feature has the same decay curve.

Radar needs fresh tape.
Screener needs stable features.
Fundamental data does not need sub-minute refresh.

## 3. Batch Fetch Layer

The worker should batch through the active universe instead of calling providers symbol by symbol inside request handlers.

### Recommended flow

1. load `universe:scan:nse1500`
2. chunk symbols into provider-safe batches
3. fetch quotes and recent bars
4. compute raw features
5. update per-symbol Redis entries
6. update sector aggregates
7. rebuild Radar and Screener materialized views

### Batch rules

- quote/history provider batches must stay provider-safe
- concurrency must be controlled centrally
- retries should degrade by chunk, not fail the full sweep

### Important constraint

The current Yahoo-based path is safe only because it is conservative.

For a real 1500-stock engine, the fetch layer must be isolated and rate-aware. If the public provider starts throttling, the worker should reduce scope or cadence instead of breaking user requests.

## 4. Feature Engine

This is the shared intelligence layer.

Every symbol should get a reusable feature record.

### Core market features

```json
{
  "symbol": "RELIANCE",
  "price": 3021.55,
  "changePercent": 1.42,
  "volume": 8452210,
  "volumeRatio": 1.64,
  "rsi14": 61.3,
  "momentumScore": 28.6,
  "week52RangePosition": 74.1,
  "distanceFromHigh52": -6.2,
  "distanceFromLow52": 29.7,
  "sma20": 2968.1,
  "sma50": 2892.8,
  "sector": "Energy",
  "sectorTrend": "bullish",
  "sectorBreadth": 18,
  "newsCount": 2,
  "lastUpdated": "2026-04-14T09:55:00.000Z"
}
```

### Incremental feature families

- quote features: price, move, turnover, recent bar deltas
- participation features: relative volume, active turnover, burst detection
- structure features: range position, moving averages, distance from highs/lows
- sector features: sector trend, breadth, leader-laggard context
- narrative features: news count, sector story intensity, catalyst recency
- fundamentals features: PE, P/B, revenue growth, margins, but only where the provider actually supports them

### Rule

If a field is unreliable from the provider, store it as missing and surface coverage honestly.

Do not fabricate a full-fundamental engine on top of partial public data.

## 5. Sector Aggregation Layer

Sector analytics should not be computed by sampling a few names inside page requests.

Instead, each sweep should aggregate sector state from the central symbol feature store.

### Sector snapshot example

```json
{
  "sector": "Capital Goods",
  "stockCount": 118,
  "analyzedCount": 94,
  "bullishCount": 41,
  "bearishCount": 18,
  "breadth": 24,
  "averageChangePercent": 0.87,
  "leader": "SIEMENS",
  "laggard": "KIRLOSBROS",
  "updatedAt": "2026-04-14T09:55:00.000Z"
}
```

This sector layer is then reused by:

- Today narrative
- Radar sector shifts
- Screener sector filters
- Stock Story context

## 6. Materialized Views

After each sweep, build product-specific outputs from shared features.

### Today materialized view

Contains:

- index board
- market narrative
- top sector rotation cards
- carry names
- recap cards

### Radar materialized view

Contains:

- top ranked live signals
- 5m, 15m, today window summaries
- sector shifts
- opportunity stream
- refresh cadence metadata

### Screener materialized base views

Contains:

- playbook-ready candidate pools
- per-playbook rankings
- per-sector slices
- field coverage stats

The API can then apply user filters on top of a stable base view instead of rescanning the universe.

## Redis Layout

Redis is the right place for:

- fast snapshot reads
- lightweight ranking sets
- short TTL feature entries
- SSE fan-out source data

## Key design

### Universe keys

```text
market:universe:master
market:universe:scan:nse1500
market:universe:scan:nse500
market:universe:summary
```

### Per-symbol feature keys

```text
market:feature:symbol:RELIANCE
market:feature:symbol:TCS
market:feature:symbol:INFY
```

### Sector snapshot keys

```text
market:sector:snapshot:Energy
market:sector:snapshot:IT
market:sector:snapshot:Banks
market:sector:snapshot:all
```

### Radar keys

```text
market:radar:latest:momentum:intraday:balanced
market:radar:latest:breakout:intraday:conservative
market:radar:latest:pullback:swing:balanced
market:radar:signal-feed
market:radar:sector-shifts
```

### Screener keys

```text
market:screener:base:leadership:swing:balanced
market:screener:base:quality:swing:balanced
market:screener:base:pullback:swing:aggressive
market:screener:sector:quality:IT
market:screener:field-coverage
```

### Story keys

```text
market:story:RELIANCE
market:story:TCS
```

### Operational keys

```text
market:sweep:status
market:sweep:last-success
market:sweep:last-degraded
market:provider:health
```

## Value types

Recommended usage:

- JSON strings for typed snapshot payloads
- sorted sets for ranking lists by score
- hashes only if partial field updates are truly needed

For this app, JSON snapshots are the better default because frontend contracts are already object-shaped.

## Scoring Model

Use one shared feature set, but different scoring weights per product.

## Radar score

Radar should prefer freshness and tape behavior.

Suggested normalized formula:

$$
RadarScore = 0.28M + 0.20V + 0.18S + 0.14R + 0.10N + 0.10F - P
$$

Where:

- $M$ = momentum score
- $V$ = relative volume and intraday participation
- $S$ = sector support and breadth
- $R$ = range position / breakout readiness
- $N$ = news or narrative relevance
- $F$ = freshness bonus for recent change bursts
- $P$ = penalties for extension, weak structure, or unreliable confirmation

### Radar penalty examples

- overextended RSI
- move already too far from trigger
- sector not confirming
- volume spike not persisting

## Screener score

Screener should prefer fit to the user’s research playbook.

Example:

$$
ScreenerScore = w_1T + w_2Q + w_3V + w_4S + w_5F - P
$$

Where:

- $T$ = trend and structure fit
- $Q$ = quality or valuation fit when those fields exist
- $V$ = participation fit
- $S$ = sector alignment
- $F$ = playbook-specific features such as pullback depth or breakout readiness
- $P$ = penalties for missing confirmation or missing required fields

The weights should change per playbook:

- `leadership`: trend, sector, participation
- `quality`: quality, stability, sector, not just momentum
- `pullback`: sector leadership plus non-extended structure
- `sympathy`: sector heat plus lagging-stock catch-up potential
- `avoid`: inverse ranking focused on low-quality moves and extension

## Missing-data rule

If a field is missing, do not silently treat it as a strong signal.

Use one of two behaviors:

- neutral contribution for optional fields
- exclusion only when the user explicitly requires that field through a filter

That is why Screener diagnostics and field coverage must remain part of the API contract.

## API Behavior After Redis

Once Redis-backed views exist, request handlers should change behavior.

## `/api/market/today`

Should:

1. read `market:today:latest`
2. optionally apply AI rewrite layer for phrasing only
3. return immediately

## `/api/market/radar`

Should:

1. read the precomputed Radar snapshot for `mode + horizon + selectivity`
2. optionally slice top `N`
3. return typed signal feed, windows, sector shifts, and opportunities

It should not trigger multi-sector provider fanout on request.

## `/api/market/screener`

Should:

1. read the base playbook snapshot
2. apply sector narrowing if needed
3. apply numeric filters in-memory or via cached candidate list
4. recompute diagnostics from that cached base set
5. return stable results

It should not rebuild the full market scan for each query.

## `/api/market/story/:symbol`

Should:

1. read per-symbol features and sector snapshot
2. build or read cached story object
3. optionally run AI rewrite for language quality only

## Example Radar Output

This matches the current contract direction.

```json
{
  "mode": "momentum",
  "horizon": "intraday",
  "selectivity": "balanced",
  "narrative": "BEL is the sharpest expression of current opportunity, with Capital Goods still setting the tone for the best-looking setups.",
  "coverage": {
    "sectorsScanned": 11,
    "universeStocks": 1502,
    "stocksAnalyzed": 1184,
    "matches": 18
  },
  "signalFeed": [
    {
      "id": "radar-signal-BEL-breakout",
      "symbol": "BEL",
      "sector": "Capital Goods",
      "type": "breakout",
      "window": "5m",
      "tone": "bullish",
      "title": "BEL is pressing a breakout zone",
      "detail": "BEL is in the top 18% of its 52-week range with +0.9% over 15 minutes.",
      "strength": 84,
      "occurredAt": "2026-04-14T09:55:00.000Z"
    }
  ],
  "windowInsights": [
    {
      "window": "5m",
      "label": "Last 5 minutes",
      "summary": "3 signals are active here, led by BEL.",
      "signalCount": 3,
      "leadingSymbol": "BEL",
      "leadingSector": "Capital Goods"
    }
  ],
  "sectorShifts": [
    {
      "sector": "Capital Goods",
      "direction": "strengthening",
      "summary": "Capital Goods is strengthening with 26% breadth and 4 ranked radar names.",
      "breadth": 26,
      "averageChangePercent": 1.1,
      "signalCount": 4,
      "leaderSymbol": "BEL",
      "laggardSymbol": "KIRLOSBROS"
    }
  ],
  "refreshIntervalSeconds": 20
}
```

## Example Screener Output

```json
{
  "playbook": "quality",
  "horizon": "swing",
  "selectivity": "balanced",
  "sortBy": "value",
  "sector": "all",
  "filters": {
    "maxPeRatio": 25,
    "minRevenueGrowth": 10
  },
  "coverage": {
    "sectorsScanned": 11,
    "universeStocks": 1502,
    "stocksAnalyzed": 1184,
    "matches": 14
  },
  "diagnostics": {
    "activeFilters": [
      { "label": "Max PE", "value": "25" },
      { "label": "Min rev growth", "value": "10%" }
    ],
    "filteredOut": 22,
    "baseMatches": 36,
    "fieldCoverage": {
      "peRatio": 61,
      "priceToBook": 58,
      "revenueGrowth": 44,
      "profitMargins": 43
    },
    "notes": [
      "Fundamental filters only activate on names where the live provider returns that field."
    ]
  }
}
```

## Degraded Modes

A public-data-backed market engine needs explicit degraded behavior.

### Level 0: normal

- full scan manifest
- fresh quote sweep
- sector snapshots updated on schedule

### Level 1: provider pressure

- shrink from `nse1500` to `nse500`
- reduce Radar cadence
- keep Today and Screener stable from latest cached snapshots

### Level 2: partial provider failure

- freeze last successful market snapshot
- mark response freshness explicitly
- disable AI rewrite if it risks delaying delivery

### Level 3: fundamental provider gap

- keep technical and sector engine live
- expose reduced field coverage
- do not pretend fundamental filters are fully authoritative

## Rollout Plan

## Phase 1: stabilize current architecture

- keep current contracts
- add this architecture document
- keep request-time insights honest about coverage

## Phase 2: introduce Redis snapshots

- add Redis client and health wiring
- cache sector snapshots and Radar outputs
- move Today and Radar reads to Redis-first

## Phase 3: add sweep worker

- create background sweep process
- scan a controlled liquid manifest first
- materialize per-symbol features and sector aggregates

## Phase 4: expand to full liquid NSE scan

- promote from a sampled or sector-limited universe to `nse1500`
- keep request handlers read-only against precomputed data

## Phase 5: improve fundamentals

- add a stronger provider or nightly ingest for deeper fields like ROE and debt ratios
- widen Screener research depth only after that coverage is real

## Practical Recommendation For This Repo

The next engineering move should be:

1. add Redis
2. create a background market sweep worker
3. materialize `Today`, `Radar`, and Screener base views into Redis
4. convert route handlers to snapshot readers

That gives the app a real path to broad-market scanning without making page loads fragile.

## Bottom Line

To analyze around 1500 NSE stocks reliably, InsightForge needs one shared market intelligence pipeline.

That pipeline should:

- start from one master list
- batch-fetch quotes and bars off-request
- compute reusable features once
- store symbol, sector, and product snapshots in Redis
- let Radar and Screener diverge at the ranking layer, not at the data-ingestion layer

That is how the app becomes a market intelligence platform rather than a redesigned request-time dashboard.
