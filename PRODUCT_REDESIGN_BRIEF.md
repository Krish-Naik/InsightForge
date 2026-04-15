# StockPulse Product Redesign Brief

## 1. New Product Positioning

StockPulse should stop behaving like a retail market terminal and start behaving like an intelligent trading companion for Indian markets.

### New Promise

StockPulse tells traders:

- what matters now
- why it matters
- what to watch next
- what they can ignore

### Core Shift

Current product:

- tool-first
- table-heavy
- credibility built from data sources
- user does the interpretation

Redesigned product:

- insight-first
- card-driven
- credibility built from clarity and timing
- product does the interpretation

### Product Thesis

Do not compete on more indicators, more filters, or more rows.

Compete on:

- faster comprehension
- stronger conviction
- lower effort
- better market context
- clearer next actions

### Product Personality

StockPulse should feel like:

- a sharp market editor
- a disciplined trading coach
- a living pulse of Indian markets

It should not feel like:

- a generic data dashboard
- a broker terminal clone
- a spreadsheet with charts

## 2. Experience Principles

### One Screen, One Decision

Every primary screen should answer a single user question.

- Home: What matters right now?
- Scanner: What deserves attention now?
- Stock page: What is the real setup here?
- Screener: Where should I look next?

### Narrative Before Numbers

Lead with interpretation, then show proof.

Each major card should follow the same structure:

1. Headline
2. Why it matters
3. Supporting evidence
4. What to watch next
5. Risk or invalidation

### Progressive Disclosure

Never open with a dense table.

Default state:

- 3 to 7 high-signal cards
- clear ranking
- short explanations

Expand state:

- chart
- supporting metrics
- peer or sector context
- full history

### Live Without Pretending Real-Time

Your data is delayed. Do not fake real-time.

Instead, make the product feel alive through:

- visible freshness labels
- animated update markers
- "changed since last refresh" states
- narrative updates every polling cycle
- intraday market-phase UI shifts

### Opinionated Guidance

The product must rank, recommend, and deprioritize.

Examples:

- Best setup in strong sectors
- Strong move, but already extended
- Good company, weak timing
- Watch, not buy yet

## 3. New Information Architecture

Replace the current tool-centric navigation with a decision-centric flow.

### Primary Nav

- Today
- Radar
- Stocks
- Watchlist
- Recap

### Secondary Surfaces

- Guided Screener
- Market Story Feed
- Portfolio
- Alerts

### Page Renames

- Command Center -> Today
- Momentum Scanner -> Radar
- Fundamental Screener -> Guided Screener
- Equity Research -> Stock Story
- News Desk -> Story Feed

## 4. Home Redesign: Today

Home should feel like a live market briefing, not a dashboard.

### Goal

In 20 seconds, the user should know:

- what the market is doing
- which pocket is driving it
- which opportunities deserve a look
- what risks are increasing

### Wireframe Structure

#### A. Top Brief Bar

- Market status
- Last updated time
- Freshness label
- One-line market summary

Example:

"Banks are carrying the market while IT stays weak. Breadth is positive, but leadership is narrow."

#### B. Hero: Today’s Market Story

Large editorial card with:

- headline
- 2 to 3 sentence explanation
- strongest sector
- weakest sector
- dominant sentiment
- CTA to open full market story

This is the new home-page anchor.

#### C. Opportunity Stack

Three to five ranked cards:

- Breakout forming
- Sector leadership follow-through
- Volume ignition
- Pullback in strong trend
- Reversal risk

Each card should show:

- symbol
- setup label
- why now
- confidence score
- next trigger price
- mini chart

#### D. Sector Rotation River

Replace sector tables with a flowing visual strip.

Each sector card should answer:

- Is money rotating in or out?
- Which leader is pulling the sector?
- Is breadth broad or narrow?

Display:

- sector card
- strength direction
- breadth bar
- leader and laggard
- notable change since last refresh

#### E. Stocks To Watch

Not a static watchlist.

This should be a ranked daily watch system.

Each card should state:

- why it is on the watchlist today
- what confirmation is still missing
- what invalidates the idea

#### F. Missed Moves and Daily Recap

After market close, home changes personality.

Replace the live opportunity stack with:

- what worked today
- what failed today
- what was missed early
- what carries into tomorrow

This creates habit and retention.

## 5. Scanner Redesign: Radar

The scanner should stop asking users to build filters.

It should auto-detect opportunity clusters.

### New Goal

Answer: "What deserves my attention right now?"

### New Structure

#### A. Opportunity Modes

Top-level chips:

- Intraday Momentum
- Early Breakouts
- Pullback Entries
- Weakness to Avoid
- Sector Sympathy
- News-Price Divergence

These are not filters. They are strategy lenses.

#### B. Ranked Opportunity Cards

Each card should include:

- symbol and sector
- setup type
- why now
- chart thumbnail
- strength vs sector
- volume confirmation
- timing quality
- risk label

Example card:

"BEL is breaking because Defence is one of the strongest pockets today and BEL just reclaimed yesterday’s high on 1.8x relative volume."

#### C. Evidence Drawer

Clicking a card opens a drawer instead of sending the user away immediately.

Drawer contents:

- setup summary
- price structure
- sector context
- recent narrative triggers
- key levels
- CTA: Open stock story

#### D. Smart Tighten/Widen Control

Replace complex filter panels with two simple controls:

- trading horizon: intraday or swing
- selectivity: conservative, balanced, aggressive

The system adjusts card volume and thresholds automatically.

#### E. Don’t Chase Warnings

This is a strong differentiator.

Not all movers should be promoted.

Add cards such as:

- Strong move, poor entry
- Volume spike without follow-through
- Sector strong, stock late

This builds trust faster than endless bullish cards.

## 6. Stock Page Redesign: Stock Story

The stock page should explain the stock like a market analyst, not dump research widgets.

### New Goal

Answer: "What is actually happening in this stock, and what should I do with that information?"

### Wireframe Structure

#### A. 30-Second Brief

Top summary block:

- stock name and symbol
- current stance: strong, early, extended, weak, mixed
- 2 sentence explanation
- trade horizon fit: intraday, swing, watch-only

Example:

"Tata Motors is strong, but not early. Auto is leading, price is above recent resistance, and volume confirms interest. The setup is attractive for pullback buyers, not fresh breakout chasing."

#### B. Why Is This Moving?

This is the signature card.

Blend:

- price action
- sector movement
- related news
- relative strength
- unusual volume

Format:

- Primary reason
- Secondary reason
- Confidence level
- Supporting evidence bullets

#### C. Setup Map

Visual card showing:

- trigger zone
- invalidation zone
- support and resistance
- stretched or early tag

This is more useful than opening with a giant full-width chart.

#### D. Bull vs Bear Case

Two-column decision card:

- what strengthens the setup
- what breaks the setup

This reduces blind confirmation bias.

#### E. Sector and Peer Context

Instead of a peer table first, show:

- sector strength
- whether this stock is leading or lagging its sector
- peer cards ranked by momentum and setup quality

#### F. Narrative Timeline

Event timeline combining:

- news mentions
- sector changes
- price reactions
- watchlist additions

This becomes the memory of the stock.

#### G. Action Rail

Sticky side rail on desktop and bottom sheet on mobile:

- Add to watch
- Set alert
- Track this setup
- Compare with sector leader

## 7. Screener Redesign: Guided Screener

The screener should feel like assisted discovery, not manual query construction.

### New Goal

Answer: "What kind of ideas do I want, and can you find them for me?"

### Replace Manual Filtering With Playbooks

Preset idea goals:

- Strong stocks in strong sectors
- Good businesses with improving momentum
- Pullbacks in leadership names
- Laggards in strong sectors
- Reversals with real participation

### Interaction Model

User selects:

- goal
- time horizon
- aggressiveness

System returns 6 to 12 cards, not 120 rows.

Each result card shows:

- why it matched
- what makes it attractive
- what makes it risky
- similar alternatives

### Guided Refinement

After results, ask smart follow-ups:

- Want stronger volume confirmation?
- Want cheaper valuations?
- Want only sector leaders?

This feels intelligent without exposing complex filters.

## 8. New Signature Features

### Why Is This Moving?

Generate short, evidence-backed explanations for stocks, sectors, and the whole market.

Use current inputs:

- price move
- sector breadth
- recent headlines
- volume ratio
- trend state

LLM is optional for wording quality. The logic should not depend on it.

### Market Story Feed

This replaces a generic news page.

Every story should answer:

- what happened
- who is affected
- what it changes in market behavior

Stories should connect to:

- sectors
- affected stocks
- opportunity cards

### Stocks To Watch Engine

Every morning and intraday refresh cycle, rank a small set of names by:

- setup quality
- sector support
- freshness
- confirmation stage
- risk of chasing

### Sector Rotation Insights

A dedicated engine that says:

- which sectors are strengthening
- which are fading
- which moves are broad vs narrow
- which stock is the cleanest expression of the theme

### Missed Opportunity Replay

One of the strongest retention features.

Show users:

- the sector signal that appeared first
- the stock that confirmed next
- the moment the setup became obvious
- what to watch tomorrow to catch similar moves earlier

### Smart Alerts

Alerts should not be only price-based.

Create alerts like:

- Sector turned bullish and your watchlist stock is waking up
- Stock is moving, but without volume confirmation
- Watchlist name reclaimed resistance with sector support
- Earlier setup is now extended; avoid chasing

## 9. User Journeys

### Beginner Trader

Goal: understand the market without drowning in jargon.

Flow:

1. Open Today
2. Read the one-line market brief
3. See three ranked stocks to watch
4. Open one stock story
5. Read the bull vs bear case
6. Save to watchlist with alert

What matters most:

- simple language
- clear risk labels
- fewer choices
- guided follow-up actions

### Intraday Trader

Goal: find timely setups quickly.

Flow:

1. Open Radar in Intraday Momentum mode
2. See ranked opportunity cards
3. Open evidence drawer
4. Check trigger and invalidation
5. Add alert or jump to chart
6. Review recap after close

What matters most:

- speed
- ranking
- timing quality
- anti-chasing warnings

### Swing Trader

Goal: build a focused watchlist with context and patience.

Flow:

1. Open Today and check sector rotation
2. Open Guided Screener with a playbook
3. Review curated stock cards
4. Open Stock Story for deeper context
5. Save setups to Watchlist
6. Come back for carry-forward recap

What matters most:

- sector leadership
- narrative quality
- cleaner setups
- carry-forward continuity

## 10. Microcopy Examples

### Home

- "Banks are doing the heavy lifting. The index looks healthy, but leadership is narrow."
- "Momentum is improving in Auto, but most names are already extended. Focus on second-chance pullbacks."
- "Pharma is waking up after a quiet week. Watch for confirmation, not early excitement."

### Opportunity Card

- "Aarti Industries is interesting because Chemicals is improving and the stock is breaking a 10-day squeeze with higher participation."
- "This move looks strong, but entry quality is deteriorating. Let it reset before acting."

### Stock Story

- "Why it is moving: sector tailwind first, stock confirmation second."
- "Setup quality is high, but freshness is fading. This is a watch, not a chase."
- "The bull case stays valid above the reclaim zone. Below it, the move loses structure."

### Recap

- "You missed this because the signal started in the sector before the stock became obvious."
- "This breakout worked because breadth expanded, not just price."

## 11. Interaction Patterns

### Card Motion

- subtle live pulse when a card changes meaningfully
- highlight changed fields after refresh
- animate rank movement up or down

### Hover and Tap Behavior

- hover reveals evidence summary on desktop
- tap expands a bottom sheet on mobile
- long-press adds to watchlist or sets alert

### Timeline Interaction

- scrub a stock’s narrative timeline
- click an event to jump chart to that point
- compare price reaction before and after each trigger

### Refresh UX

- show next refresh countdown
- label cards as new, improving, weakening, or stale
- never silently replace important conclusions

## 12. Visual Direction

Keep the product premium and sharp, but move away from the generic terminal aesthetic.

### Recommended Visual Language

- editorial layout meets live market motion
- bold headlines
- compact evidence chips
- layered cards with strong hierarchy
- adaptive color intensity based on market phase

### Market-Phase Personality

- Pre-open: calm, preparatory, anticipatory
- Live market: vivid, energetic, dynamic
- Post-close: reflective, editorial, recap-focused

### Component Priorities

- cards over tables
- rank over raw lists
- summaries over dashboards
- context over widget density

## 13. Viral and 10x Features

### Shareable Morning Brief

Generate a beautiful mobile card that says:

- market mood
- sectors to watch
- top three names

Optimized for WhatsApp, Telegram, and X sharing.

### If You Only Watch 5 Stocks Today

Daily short list with strong reasons. This can become a habit loop and a share object.

### Missed Move Replay

Highly differentiated and emotionally sticky.

It teaches users instead of only informing them.

### Hinglish Audio Brief

Optional but powerful for Indian retail audiences.

A 45 to 60 second audio market briefing could create strong habit and differentiation.

### Personal Watchlist Prioritizer

Not all watchlist names deserve equal attention.

Rank them by:

- setup freshness
- sector support
- price proximity to trigger
- news relevance

## 14. What To Remove or De-emphasize

- giant tables as default views
- large filter panels as primary interaction
- source-heavy credibility copy at the top of core pages
- standalone modules that require users to connect the dots manually
- dense metric grids before narrative context

## 15. Practical Build Order

### Phase 1: Reframe the Experience

- Redesign Home into Today
- Add market brief and opportunity stack
- Add sector rotation cards
- Add stocks to watch block

### Phase 2: Build the Intelligence Layer

- Add explanation templates for why stocks or sectors are moving
- Add opportunity scoring and anti-chasing labels
- Add narrative timeline structure

### Phase 3: Replace Tool-Like Pages

- Turn Scanner into Radar
- Turn Screener into Guided Screener
- Turn stock page into Stock Story

### Phase 4: Habit and Retention

- Add recap mode
- Add missed-move replay
- Add smart alerts
- Add shareable daily brief

## 16. Final Product Standard

The user should feel:

- "This app tells me where to focus."
- "It saves me from noise."
- "It explains the market in plain English."
- "It helps me act with more confidence."

If the current product is a market workspace, the redesigned product should feel like a market companion with judgment.
