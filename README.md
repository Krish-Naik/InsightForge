# StockPulse — Indian Market Terminal

Real-time NSE/BSE stock market terminal built with **Next.js 15**, **Express**, **TypeScript**, and **TradingView Widgets**.

---

## Project Structure

```
StockPulse/
├── frontend/               # Next.js 15 + TypeScript
│   ├── src/
│   │   ├── app/            # App Router pages
│   │   ├── components/
│   │   │   ├── charts/     # TVWidget (fixed), ChartModal
│   │   │   ├── layout/     # Header, Sidebar, MarketTicker
│   │   │   └── ui/         # SymbolLink
│   │   ├── lib/
│   │   │   ├── api.ts
│   │   │   ├── format.ts
│   │   │   ├── contexts/
│   │   │   └── hooks/
│   │   └── types/          # Shared TypeScript interfaces
│   ├── public/
│   ├── next.config.ts
│   └── package.json
│
├── backend/                # Express + TypeScript
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/       # yahooFinance, upstoxService, news
│   │   └── utils/
│   ├── .env.example
│   └── package.json
│
└── package.json            # Root monorepo scripts
```

---

## Quick Start

### 1. Install dependencies

```bash
npm run install:all
```

### 2. Configure environment

```bash
cp backend/.env.example backend/.env
# Optional: create a frontend env file when the backend is not on localhost
cp frontend/.env.example frontend/.env.local
# Edit backend/.env with your credentials
```

**Backend env vars:**
| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Any long random string |
| `UPSTOX_ACCESS_TOKEN` | Preferred for local/dev. Paste the access token generated in the Upstox portal here |
| `UPSTOX_API_KEY` | Optional. From [Upstox Developer Portal](https://upstox.com/developer/) |
| `UPSTOX_API_SECRET` | Optional. From Upstox Developer Portal |
| `UPSTOX_AUTH_CODE` | Optional. The short single-use callback `code` from the OAuth redirect URL, not the JWT-like access token |
| `NEWS_API_KEY` | Optional. Enables live market headlines from News API |
| `DEMO_MODE` | Optional. When `true`, demo news/sample data fallbacks are enabled |

> **Note:** The market-data pipeline is Upstox-based. For a stable local setup, prefer `UPSTOX_ACCESS_TOKEN`. `UPSTOX_AUTH_CODE` is single-use and only meant for the OAuth exchange step.

**Frontend env vars:**
| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_BASE_URL` | Backend base URL for the Next.js rewrite proxy |
| `NEXT_PUBLIC_DEMO_MODE` | Mirrors demo mode in the UI. Keeps demo-only fallbacks explicit |
| `NEXT_PUBLIC_PERSISTENCE_MODE` | Defaults to `local` and labels watchlist/portfolio storage mode in the UI |

### 3. Run in development

```bash
npm run dev
```

- Frontend: http://localhost:3000
- Backend: http://localhost:5001

### 4. Validate service health

```bash
curl http://localhost:5001/api/health
```

The health payload now reports:

- MongoDB connectivity
- Yahoo Finance provider status
- Upstox provider status/configuration
- News provider configuration
- Demo mode state

---

## Key Fixes Applied (v2.0)

### 🔴 TradingView Widget Bug (FIXED)

**Symptom:** All TV widgets showed "No data available"  
**Root Cause:** Scripts injected via `innerHTML` are **never executed** by browsers (HTML spec §4.12.1)  
**Fix:** `TVWidget.tsx` now uses `document.createElement('script')` + `.appendChild()` — the only way to dynamically load executable scripts.

### 🟡 52-Week High/Low Wrong Values (FIXED)

Upstox `mapQuote` was mapping circuit limits to 52-week fields. Now uses correct `52_week_high` / `52_week_low` fields.

### 🟡 Missing `stock-nse-india` Dependency (FIXED)

Added to `backend/package.json`.

### 🟢 Performance Improvements

- `ChartModal` lazy-loaded with `next/dynamic` (not bundled until needed)
- `<link rel="preconnect">` to TradingView CDN in `<head>`
- `stale-while-revalidate` cache headers on all API responses
- `next dev --turbopack` for faster HMR
- `optimizePackageImports: ['lucide-react']` in `next.config.ts`
- SSE heartbeat every 25s to prevent proxy timeouts
- Rate limit raised to 200 req/15min (was 100)
