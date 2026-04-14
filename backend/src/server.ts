import express, { Express, Request, Response } from 'express';
import cors        from 'cors';
import helmet      from 'helmet';
import compression from 'compression';
import morgan      from 'morgan';
import { config }  from './config/index.js';
import { connectDB, isDbConnected } from './config/database.js';
import { logger }    from './utils/logger.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { apiLimiter }  from './middleware/rateLimiter.js';
import { MarketDataService } from './services/marketDataService.js';
import { MarketUniverseService } from './services/marketUniverseService.js';

import authRoutes      from './routes/auth.js';
import watchlistRoutes from './routes/watchlist.js';
import portfolioRoutes from './routes/portfolio.js';
import marketRoutes    from './routes/market.js';

const app: Express = express();

// ── Database ─────────────────────────────────────────────────────────────────
await connectDB();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));

app.use(cors({
  origin:      config.isProd ? false : ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
}));

app.use(compression());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(config.isDev ? morgan('dev') : morgan('combined', {
  stream: { write: (msg: string) => logger.info(msg.trim()) },
}));

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/api/health', (_req: Request, res: Response) => {
  const providers = MarketDataService.getProviderHealth();
  const universe = MarketUniverseService.getStatus();
  const degraded = !isDbConnected() || Boolean(providers.yahoo.lastAttemptAt && !providers.yahoo.ok);

  res.json({
    status: degraded ? 'degraded' : 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    services: {
      database: { connected: isDbConnected() },
      providers: {
        yahoo: {
          ...providers.yahoo,
          configured: true,
          mode: 'public-delayed-cache',
          warning: 'Yahoo Finance is used with delayed cached market data to stay within public API limits.',
        },
      },
      marketUniverse: universe,
      news: {
        configured: true,
        provider: 'rss',
      },
    },
  });
});

// ── SSE: real-time market stream ──────────────────────────────────────────────
interface SSEClient { res: Response; id: number }
const clients = new Set<SSEClient>();

app.get('/api/stream/market', (req: Request, res: Response) => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const client: SSEClient = { res, id: Date.now() };
  clients.add(client);
  logger.debug(`SSE client connected — total: ${clients.size}`);

  // Send initial snapshot immediately
  MarketDataService.getMarketSummary()
    .then(summary => {
      try { res.write(`data: ${JSON.stringify({ type: 'market_update', ...summary })}\n\n`); }
      catch { /* client disconnected */ }
    })
    .catch(() => { /* ignore — YF is primary fallback anyway */ });

  // Heartbeat keeps connection alive through proxies
  const heartbeat = setInterval(() => {
    try { res.write(': heartbeat\n\n'); }
    catch { clients.delete(client); clearInterval(heartbeat); }
  }, 25_000);

  req.on('close', () => {
    clients.delete(client);
    clearInterval(heartbeat);
    logger.debug(`SSE client disconnected — total: ${clients.size}`);
  });
});

// Helper to broadcast to all connected SSE clients
function broadcast(payload: Record<string, unknown>) {
  if (clients.size === 0) return;
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const client of clients) {
    try { client.res.write(data); }
    catch { clients.delete(client); }
  }
}

async function warmMarketCaches() {
  try {
    await MarketDataService.primeHotPathCache();
  } catch (error) {
    logger.warn(`Market cache warmup skipped: ${(error as Error).message}`);
  }
}

void warmMarketCaches();
const marketWarmTimer = setInterval(() => { void warmMarketCaches(); }, 60_000);

// Broadcast index tick every 10 s
setInterval(async () => {
  if (clients.size === 0) return;
  try {
    const indices = await MarketDataService.getIndices();
    broadcast({ type: 'indices_tick', indices });
  } catch { /* ignore */ }
}, 10_000);

// Broadcast full market update every 20 s
setInterval(async () => {
  if (clients.size === 0) return;
  try {
    const summary = await MarketDataService.getMarketSummary();
    broadcast({ type: 'market_update', ...summary });
  } catch { /* ignore */ }
}, 20_000);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',       authRoutes);
app.use('/api/watchlists', watchlistRoutes);
app.use('/api/portfolios', portfolioRoutes);
app.use('/api/market',     marketRoutes);

// ── Error handling ────────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = config.port;
const server = app.listen(PORT, () => {
  logger.info(`🚀 Server on port ${PORT} [${config.nodeEnv}]`);
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
function gracefulShutdown(signal: string) {
  logger.info(`${signal} received — shutting down gracefully`);
  clearInterval(marketWarmTimer);
  for (const client of clients) {
    try { client.res.end(); } catch { /* ignore */ }
  }
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
  // Force exit after 10 s
  setTimeout(() => process.exit(1), 10_000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled rejection: ${(reason as Error)?.message || reason}`);
});

process.on('uncaughtException', (err) => {
  logger.error(`Uncaught exception: ${err.message}`);
  process.exit(1);
});
