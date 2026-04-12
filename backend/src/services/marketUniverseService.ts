import axios from 'axios';
import { gunzipSync } from 'zlib';
import {
  MARKET_STOCKS,
  type MarketStockDefinition,
} from '../data/marketCatalog.js';
import { logger } from '../utils/logger.js';

const UPSTOX_MASTER_URLS = {
  NSE: 'https://assets.upstox.com/market-quote/instruments/exchange/NSE.json.gz',
  BSE: 'https://assets.upstox.com/market-quote/instruments/exchange/BSE.json.gz',
} as const;
const UNIVERSE_TTL_MS = 12 * 60 * 60 * 1000;
const NON_EQUITY_NAME_PATTERN = /(TBILL|T-BILL|SDL|GSEC|GOVT|GOVERNMENT|BOND|NCD|DEBENTURE|ETF|REIT|INVIT|MUTUAL FUND|LIQUIDBEES|GOLDBEES|SILVERBEES)/i;
const EXCLUDED_BSE_TYPES = new Set(['F']);

export interface UniverseStock {
  symbol: string;
  name: string;
  exchange: string;
  sectors: string[];
  aliases: string[];
  inNifty50: boolean;
  isin?: string;
  industry?: string;
  instrumentKey?: string;
  instrumentKeys?: Partial<Record<'NSE' | 'BSE', string>>;
}

interface UniverseCacheState {
  data: UniverseStock[];
  fetchedAt: number;
  inflight: Promise<UniverseStock[]> | null;
  lookup: Map<string, UniverseStock>;
}

interface UpstoxInstrumentRow {
  symbol: string;
  name: string;
  exchange: 'NSE' | 'BSE';
  instrumentKey: string;
  instrumentType?: string;
  isin?: string;
  securityType?: string;
  industry?: string;
}

const cache: UniverseCacheState = {
  data: [],
  fetchedAt: 0,
  inflight: null,
  lookup: new Map(),
};

function normalizeSearchValue(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function tokenizeSearchValue(value: string): string[] {
  return value
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
}

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

function splitCsvLine(line: string): string[] {
  const columns: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      columns.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  columns.push(current.trim());
  return columns;
}

function mergeExchange(existing: string | undefined, next: 'NSE' | 'BSE'): string {
  if (!existing) return next;
  if (existing === next || existing.includes(next)) return existing;
  return existing === 'NSE' ? 'NSE,BSE' : 'BSE,NSE';
}

function preferIncomingListing(existing: UniverseStock | undefined, nextExchange: 'NSE' | 'BSE'): boolean {
  if (!existing) return true;
  if (nextExchange === 'NSE' && !existing.exchange.includes('NSE')) return true;
  return false;
}

function inferSectors(seed: MarketStockDefinition | undefined, industry?: string): string[] {
  if (seed?.sectors?.length) return [...seed.sectors];
  const source = `${industry || ''}`.toUpperCase();
  if (!source) return [];

  if (source.includes('BANK') || source.includes('FINANCIAL SERVICE')) return ['Banking'];
  if (source.includes('NBFC') || source.includes('FINANCE')) return ['NBFC'];
  if (source.includes('SOFTWARE') || source.includes('IT ') || source.includes('TECH')) return ['IT'];
  if (source.includes('AUTO') || source.includes('AUTOMOBILE')) return ['Auto'];
  if (source.includes('STEEL') || source.includes('METAL') || source.includes('MINING')) return ['Metals'];
  if (source.includes('PHARMA') || source.includes('HEALTHCARE') || source.includes('DRUG')) return ['Pharma'];
  if (source.includes('POWER') || source.includes('ENERGY') || source.includes('OIL') || source.includes('GAS')) return ['Energy'];
  if (source.includes('FMCG') || source.includes('CONSUMER') || source.includes('FOOD')) return ['FMCG'];
  if (source.includes('REALTY') || source.includes('REAL ESTATE')) return ['Realty'];
  if (source.includes('TELECOM')) return ['Telecom'];
  if (source.includes('INFRA') || source.includes('CONSTRUCTION') || source.includes('ENGINEERING')) return ['Infra'];
  return [];
}

function decodeCompressedJson<T>(payload: ArrayBuffer): T {
  const zipped = Buffer.from(payload);
  const decoded = gunzipSync(zipped).toString('utf8');
  return JSON.parse(decoded) as T;
}

function isSupportedInstrument(record: Record<string, unknown>, exchange: 'NSE' | 'BSE'): boolean {
  const segment = `${record.segment || ''}`.toUpperCase();
  const instrumentType = `${record.instrument_type || ''}`.toUpperCase();
  const tradingSymbol = `${record.trading_symbol || ''}`.trim();
  const name = `${record.name || ''}`.trim();
  const securityType = `${record.security_type || ''}`.toUpperCase();

  if (segment !== `${exchange}_EQ`) return false;
  if (!tradingSymbol || !name || !record.instrument_key) return false;
  if (NON_EQUITY_NAME_PATTERN.test(name)) return false;

  if (exchange === 'NSE') {
    return instrumentType === 'EQ' && (!securityType || securityType === 'NORMAL');
  }

  return !EXCLUDED_BSE_TYPES.has(instrumentType);
}

async function fetchUpstoxRows(exchange: 'NSE' | 'BSE'): Promise<UpstoxInstrumentRow[]> {
  const response = await axios.get<ArrayBuffer>(UPSTOX_MASTER_URLS[exchange], {
    responseType: 'arraybuffer',
    timeout: 30_000,
    headers: {
      'User-Agent': 'Mozilla/5.0',
      Accept: 'application/octet-stream,application/gzip,*/*',
    },
  });

  const payload = decodeCompressedJson<Array<Record<string, unknown>>>(response.data);

  return payload
    .filter((record) => isSupportedInstrument(record, exchange))
    .map((record) => ({
      symbol: normalizeSymbol(`${record.trading_symbol || ''}`),
      name: `${record.name || ''}`.trim(),
      exchange,
      instrumentKey: `${record.instrument_key || ''}`.trim(),
      instrumentType: `${record.instrument_type || ''}`.trim() || undefined,
      isin: `${record.isin || ''}`.trim() || undefined,
      securityType: `${record.security_type || ''}`.trim() || undefined,
      industry: undefined,
    }));
}

function mergeSeedStock(
  existing: UniverseStock | undefined,
  seed: Partial<UniverseStock>,
): UniverseStock {
  const nextExchange = (seed.exchange || 'NSE') as 'NSE' | 'BSE';
  const preferSeed = preferIncomingListing(existing, nextExchange);
  const aliases = new Set([...(existing?.aliases || []), ...(seed.aliases || [])]);

  if (existing?.symbol && seed.symbol && existing.symbol !== seed.symbol) {
    aliases.add(existing.symbol);
    aliases.add(seed.symbol);
  }

  return {
    symbol: preferSeed ? seed.symbol || existing?.symbol || '' : existing?.symbol || seed.symbol || '',
    name: preferSeed ? seed.name || existing?.name || seed.symbol || '' : existing?.name || seed.name || existing?.symbol || '',
    exchange: mergeExchange(existing?.exchange, nextExchange),
    sectors: [...new Set([...(existing?.sectors || []), ...(seed.sectors || [])])],
    aliases: [...aliases],
    inNifty50: Boolean(seed.inNifty50 || existing?.inNifty50),
    isin: seed.isin || existing?.isin,
    industry: seed.industry || existing?.industry,
    instrumentKey: preferSeed ? seed.instrumentKey || existing?.instrumentKey : existing?.instrumentKey || seed.instrumentKey,
    instrumentKeys: {
      ...(existing?.instrumentKeys || {}),
      ...((seed.exchange && seed.instrumentKey) ? { [seed.exchange]: seed.instrumentKey } : {}),
    },
  };
}

function buildFallbackUniverse(): UniverseStock[] {
  return MARKET_STOCKS.map((stock) => ({
    symbol: stock.symbol,
    name: stock.name,
    exchange: stock.exchange,
    sectors: [...stock.sectors],
    aliases: [...stock.aliases],
    inNifty50: stock.inNifty50,
    instrumentKey: stock.upstoxInstrumentKey,
    instrumentKeys: stock.upstoxInstrumentKey ? { NSE: stock.upstoxInstrumentKey } : {},
  }));
}

function buildLookup(universe: UniverseStock[]): Map<string, UniverseStock> {
  const lookup = new Map<string, UniverseStock>();

  const register = (value: string | undefined, stock: UniverseStock) => {
    const normalized = normalizeSearchValue(value || '');
    if (!normalized) return;
    const current = lookup.get(normalized);
    if (!current || (!current.exchange.includes('NSE') && stock.exchange.includes('NSE'))) {
      lookup.set(normalized, stock);
    }
  };

  for (const stock of universe) {
    register(stock.symbol, stock);
    register(stock.name, stock);
    register(stock.isin, stock);
    for (const alias of stock.aliases) register(alias, stock);
  }

  return lookup;
}

async function buildUniverse(): Promise<UniverseStock[]> {
  const merged = new Map<string, UniverseStock>();
  const seedBySymbol = new Map(MARKET_STOCKS.map((stock) => [stock.symbol, stock]));
  const seedByIsin = new Map(
    MARKET_STOCKS
      .filter((stock) => stock.upstoxInstrumentKey?.includes('|'))
      .map((stock) => [stock.upstoxInstrumentKey!.split('|')[1], stock]),
  );

  for (const stock of MARKET_STOCKS) {
    merged.set(stock.symbol, {
      symbol: stock.symbol,
      name: stock.name,
      exchange: stock.exchange,
      sectors: [...stock.sectors],
      aliases: [...stock.aliases],
      inNifty50: stock.inNifty50,
      instrumentKey: stock.upstoxInstrumentKey,
      instrumentKeys: stock.upstoxInstrumentKey ? { NSE: stock.upstoxInstrumentKey } : {},
    });
  }

  const [nseRows, bseRows] = await Promise.allSettled([fetchUpstoxRows('NSE'), fetchUpstoxRows('BSE')]);

  if (nseRows.status === 'fulfilled') {
    for (const row of nseRows.value) {
      const seed = seedBySymbol.get(row.symbol) || (row.isin ? seedByIsin.get(row.isin) : undefined);
      const mergeKey = row.isin || row.symbol;
      merged.set(mergeKey, mergeSeedStock(merged.get(mergeKey), {
        symbol: seed?.symbol || row.symbol,
        name: seed?.name || row.name,
        exchange: 'NSE',
        sectors: inferSectors(seed),
        aliases: [...(seed?.aliases || []), row.symbol !== seed?.symbol ? row.symbol : ''].filter(Boolean),
        inNifty50: seed?.inNifty50 || false,
        isin: row.isin,
        instrumentKey: row.instrumentKey,
      }));
    }
  } else {
    logger.warn(`Failed to load Upstox NSE instrument master: ${nseRows.reason instanceof Error ? nseRows.reason.message : 'unknown error'}`);
  }

  if (bseRows.status === 'fulfilled') {
    for (const row of bseRows.value) {
      const seed = seedBySymbol.get(row.symbol) || (row.isin ? seedByIsin.get(row.isin) : undefined);
      const mergeKey = row.isin || row.symbol;
      merged.set(mergeKey, mergeSeedStock(merged.get(mergeKey), {
        symbol: seed?.symbol || row.symbol,
        name: seed?.name || row.name,
        exchange: 'BSE',
        sectors: inferSectors(seed, row.industry),
        aliases: [...(seed?.aliases || []), row.symbol !== seed?.symbol ? row.symbol : ''].filter(Boolean),
        inNifty50: seed?.inNifty50 || false,
        isin: row.isin,
        industry: row.industry,
        instrumentKey: row.instrumentKey,
      }));
    }
  } else {
    logger.warn(`Failed to load Upstox BSE instrument master: ${bseRows.reason instanceof Error ? bseRows.reason.message : 'unknown error'}`);
  }

  const result = [...merged.values()].sort(
    (left, right) =>
      Number(right.inNifty50) - Number(left.inNifty50)
      || left.symbol.localeCompare(right.symbol),
  );

  return result.length ? result : buildFallbackUniverse();
}

export class MarketUniverseService {
  static async getUniverse(): Promise<UniverseStock[]> {
    const isFresh = cache.data.length > 0 && Date.now() - cache.fetchedAt < UNIVERSE_TTL_MS;
    if (isFresh) return cache.data;
    if (cache.inflight) return cache.inflight;

    cache.inflight = buildUniverse()
      .then((data) => {
        cache.data = data;
        cache.fetchedAt = Date.now();
        cache.lookup = buildLookup(data);
        return data;
      })
      .catch((error) => {
        logger.warn(`Failed to build exchange universe: ${(error as Error).message}`);
        if (!cache.data.length) {
          cache.data = buildFallbackUniverse();
          cache.lookup = buildLookup(cache.data);
        }
        return cache.data;
      })
      .finally(() => {
        cache.inflight = null;
      });

    return cache.inflight;
  }

  static async searchStocks(query: string, limit = 20) {
    const normalizedQuery = normalizeSearchValue(query);
    if (!normalizedQuery) return [];

    const shortQuery = normalizedQuery.length < 4;
    const universe = await this.getUniverse();

    return universe
      .map((stock) => {
        const exactSymbol = normalizeSearchValue(stock.symbol) === normalizedQuery;
        const symbolPrefix = normalizeSearchValue(stock.symbol).startsWith(normalizedQuery);
        const aliasPrefix = stock.aliases.some((alias) => normalizeSearchValue(alias).startsWith(normalizedQuery));
        const tokenPrefix = [stock.name, ...stock.aliases].some((value) =>
          tokenizeSearchValue(value).some((token) => token.startsWith(normalizedQuery)),
        );
        const nameContains = !shortQuery && normalizeSearchValue(stock.name).includes(normalizedQuery);

        if (!exactSymbol && !symbolPrefix && !aliasPrefix && !tokenPrefix && !nameContains) {
          return null;
        }

        const score = exactSymbol
          ? 6
          : symbolPrefix
            ? 5
            : aliasPrefix
              ? 4
              : tokenPrefix
                ? 3
                : 2;

        return { score, stock };
      })
      .filter((entry): entry is { score: number; stock: UniverseStock } => Boolean(entry))
      .sort(
        (left, right) =>
          right.score - left.score
          || Number(right.stock.inNifty50) - Number(left.stock.inNifty50)
          || Number(right.stock.exchange.includes('NSE')) - Number(left.stock.exchange.includes('NSE'))
          || left.stock.symbol.localeCompare(right.stock.symbol),
      )
      .slice(0, limit)
      .map(({ stock }) => ({
        symbol: stock.symbol,
        name: stock.name,
        exchange: stock.exchange,
        type: 'EQUITY',
        sectors: stock.sectors,
        inNifty50: stock.inNifty50,
      }));
  }

  static async resolveSymbols(symbols: string[]): Promise<Map<string, UniverseStock>> {
    const universe = await this.getUniverse();
    if (!cache.lookup.size) cache.lookup = buildLookup(universe);

    const resolved = new Map<string, UniverseStock>();
    for (const symbol of symbols) {
      const normalized = normalizeSearchValue(symbol);
      if (!normalized) continue;
      const match = cache.lookup.get(normalized);
      if (match) resolved.set(normalizeSymbol(symbol), match);
    }

    return resolved;
  }

  static getStatus() {
    return {
      loaded: cache.data.length > 0,
      size: cache.data.length,
      loading: Boolean(cache.inflight),
      lastUpdatedAt: cache.fetchedAt ? new Date(cache.fetchedAt).toISOString() : null,
    };
  }

  static async getSummary() {
    const universe = await this.getUniverse();
    return {
      totalStocks: universe.length,
      nseStocks: universe.filter((stock) => stock.exchange.includes('NSE')).length,
      bseStocks: universe.filter((stock) => stock.exchange.includes('BSE')).length,
      lastUpdatedAt: cache.fetchedAt ? new Date(cache.fetchedAt).toISOString() : null,
    };
  }
}