export interface MarketIndexDefinition {
  name: string;
  shortName: string;
  yahooSymbol: string;
  upstoxSymbol: string;
  aliases?: string[];
}

export interface MarketStockDefinition {
  symbol: string;
  name: string;
  sectors: string[];
  aliases: string[];
  yahooSymbol: string;
  upstoxInstrumentKey?: string;
  inNifty50: boolean;
  exchange: 'NSE';
}

type StockSeed = {
  name?: string;
  aliases?: string[];
  yahooSymbol?: string;
  upstoxInstrumentKey?: string;
};

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function normalizeSearchValue(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function tokenizeSearchValue(value: string): string[] {
  return value
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
}

export const MARKET_INDICES: MarketIndexDefinition[] = [
  {
    name: 'NIFTY 50',
    shortName: 'NIFTY',
    yahooSymbol: '^NSEI',
    upstoxSymbol: 'NIFTY 50',
    aliases: ['NIFTY', 'NSEI'],
  },
  {
    name: 'NIFTY BANK',
    shortName: 'BANKNIFTY',
    yahooSymbol: '^NSEBANK',
    upstoxSymbol: 'NIFTY BANK',
    aliases: ['BANKNIFTY'],
  },
  {
    name: 'NIFTY IT',
    shortName: 'IT',
    yahooSymbol: '^CNXIT',
    upstoxSymbol: 'NIFTY IT',
  },
  {
    name: 'NIFTY PHARMA',
    shortName: 'PHARMA',
    yahooSymbol: '^CNXPHARMA',
    upstoxSymbol: 'NIFTY PHARMA',
  },
  {
    name: 'NIFTY AUTO',
    shortName: 'AUTO',
    yahooSymbol: '^CNXAUTO',
    upstoxSymbol: 'NIFTY AUTO',
  },
  {
    name: 'NIFTY METAL',
    shortName: 'METAL',
    yahooSymbol: '^CNXMETAL',
    upstoxSymbol: 'NIFTY METAL',
  },
  {
    name: 'NIFTY ENERGY',
    shortName: 'ENERGY',
    yahooSymbol: '^CNXENERGY',
    upstoxSymbol: 'NIFTY ENERGY',
  },
  {
    name: 'NIFTY FMCG',
    shortName: 'FMCG',
    yahooSymbol: '^CNXFMCG',
    upstoxSymbol: 'NIFTY FMCG',
  },
  {
    name: 'NIFTY REALTY',
    shortName: 'REALTY',
    yahooSymbol: '^CNXREALTY',
    upstoxSymbol: 'NIFTY REALTY',
  },
  {
    name: 'NIFTY PSU BANK',
    shortName: 'PSU BANK',
    yahooSymbol: '^CNXPSUBANK',
    upstoxSymbol: 'NIFTY PSU BANK',
  },
  {
    name: 'NIFTY INFRA',
    shortName: 'INFRA',
    yahooSymbol: '^CNXINFRA',
    upstoxSymbol: 'NIFTY INFRA',
  },
  {
    name: 'NIFTY MIDCAP',
    shortName: 'MIDCAP',
    yahooSymbol: '^CNXMIDCP',
    upstoxSymbol: 'NIFTY MIDCAP 100',
    aliases: ['NIFTY MIDCAP 100'],
  },
];

export const NIFTY_50_STOCKS = [
  'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'SBIN', 'BHARTIARTL',
  'ITC', 'KOTAKBANK', 'LT', 'HCLTECH', 'BAJFINANCE', 'MARUTI', 'ASIANPAINT',
  'SUNPHARMA', 'TITAN', 'AXISBANK', 'WIPRO', 'ULTRACEMCO', 'NTPC',
  'ONGC', 'TATAMOTORS', 'POWERGRID', 'TATASTEEL', 'JSWSTEEL',
  'M&M', 'ADANIENT', 'ADANIPORTS', 'GRASIM', 'TECHM',
  'HINDUNILVR', 'DIVISLAB', 'DRREDDY', 'CIPLA', 'BRITANNIA',
  'EICHERMOT', 'HEROMOTOCO', 'COALINDIA', 'BPCL', 'NESTLEIND',
  'APOLLOHOSP', 'BAJAJFINSV', 'BAJAJ-AUTO', 'SBILIFE', 'HDFCLIFE',
  'DABUR', 'HAVELLS', 'PIDILITIND', 'SIEMENS', 'TRENT',
] as const;

export const SECTOR_MAP: Record<string, string[]> = {
  Banking: ['HDFCBANK', 'ICICIBANK', 'SBIN', 'KOTAKBANK', 'AXISBANK', 'BANKBARODA', 'INDUSINDBK', 'PNB', 'FEDERALBNK', 'IDFCFIRSTB'],
  IT: ['TCS', 'INFY', 'WIPRO', 'HCLTECH', 'TECHM', 'LTIM', 'PERSISTENT', 'COFORGE', 'MPHASIS', 'TATAELXSI'],
  Auto: ['TATAMOTORS', 'MARUTI', 'M&M', 'BAJAJ-AUTO', 'HEROMOTOCO', 'EICHERMOT', 'ASHOKLEY', 'BALKRISIND', 'MOTHERSON', 'EXIDEIND'],
  Metals: ['TATASTEEL', 'JSWSTEEL', 'HINDALCO', 'VEDL', 'COALINDIA', 'NMDC', 'SAIL', 'JINDALSTEL'],
  Pharma: ['SUNPHARMA', 'DRREDDY', 'CIPLA', 'DIVISLAB', 'BIOCON', 'LUPIN', 'AUROPHARMA', 'TORNTPHARM'],
  Energy: ['RELIANCE', 'NTPC', 'POWERGRID', 'ONGC', 'BPCL', 'TATAPOWER', 'PETRONET', 'GAIL'],
  FMCG: ['ITC', 'HINDUNILVR', 'NESTLEIND', 'BRITANNIA', 'DABUR', 'GODREJCP', 'MARICO', 'COLPAL'],
  Realty: ['DLF', 'GODREJPROP', 'OBEROIRLTY', 'PRESTIGE', 'SOBHA', 'PHOENIXLTD'],
  Telecom: ['BHARTIARTL', 'IDEA'],
  Infra: ['LT', 'ADANIPORTS', 'IRCTC', 'CONCOR', 'NBCC', 'RVNL'],
  NBFC: ['BAJFINANCE', 'BAJAJFINSV', 'SHRIRAMFIN', 'CHOLAFIN', 'MUTHOOTFIN', 'MANAPPURAM'],
};

const STOCK_SEEDS: Record<string, StockSeed> = {
  RELIANCE: { name: 'Reliance Industries Limited', upstoxInstrumentKey: 'NSE_EQ|INE002A01018' },
  TCS: { name: 'Tata Consultancy Services Limited', upstoxInstrumentKey: 'NSE_EQ|INE467B01029' },
  HDFCBANK: { name: 'HDFC Bank Limited', upstoxInstrumentKey: 'NSE_EQ|INE040A01034' },
  INFY: { name: 'Infosys Limited', upstoxInstrumentKey: 'NSE_EQ|INE009A01021' },
  ICICIBANK: { name: 'ICICI Bank Limited', upstoxInstrumentKey: 'NSE_EQ|INE090A01021' },
  SBIN: { name: 'State Bank of India', upstoxInstrumentKey: 'NSE_EQ|INE062A01020' },
  BHARTIARTL: { name: 'Bharti Airtel Limited', upstoxInstrumentKey: 'NSE_EQ|INE397D01024' },
  ITC: { name: 'ITC Limited', upstoxInstrumentKey: 'NSE_EQ|INE154A01025' },
  KOTAKBANK: { name: 'Kotak Mahindra Bank Limited', upstoxInstrumentKey: 'NSE_EQ|INE237A01028' },
  LT: { name: 'Larsen & Toubro Limited', aliases: ['LARSEN & TOUBRO', 'LNT'], upstoxInstrumentKey: 'NSE_EQ|INE018A01030' },
  HCLTECH: { name: 'HCL Technologies Limited', upstoxInstrumentKey: 'NSE_EQ|INE860A01027' },
  BAJFINANCE: { name: 'Bajaj Finance Limited', upstoxInstrumentKey: 'NSE_EQ|INE296A01024' },
  MARUTI: { name: 'Maruti Suzuki India Limited', upstoxInstrumentKey: 'NSE_EQ|INE585B01010' },
  ASIANPAINT: { name: 'Asian Paints Limited', upstoxInstrumentKey: 'NSE_EQ|INE021A01026' },
  SUNPHARMA: { name: 'Sun Pharmaceutical Industries Limited', upstoxInstrumentKey: 'NSE_EQ|INE044A01036' },
  TITAN: { name: 'Titan Company Limited', upstoxInstrumentKey: 'NSE_EQ|INE280A01028' },
  AXISBANK: { name: 'Axis Bank Limited', upstoxInstrumentKey: 'NSE_EQ|INE238A01034' },
  WIPRO: { name: 'Wipro Limited', upstoxInstrumentKey: 'NSE_EQ|INE075A01022' },
  ULTRACEMCO: { name: 'UltraTech Cement Limited', upstoxInstrumentKey: 'NSE_EQ|INE481G01011' },
  NTPC: { name: 'NTPC Limited', upstoxInstrumentKey: 'NSE_EQ|INE733E01010' },
  ONGC: { name: 'Oil and Natural Gas Corporation Limited', upstoxInstrumentKey: 'NSE_EQ|INE213A01029' },
  TATAMOTORS: { name: 'Tata Motors Limited', aliases: ['TATA MOTORS'], yahooSymbol: 'TMCV', upstoxInstrumentKey: 'NSE_EQ|INE155A01022' },
  POWERGRID: { name: 'Power Grid Corporation of India Limited', upstoxInstrumentKey: 'NSE_EQ|INE752E01010' },
  TATASTEEL: { name: 'Tata Steel Limited', upstoxInstrumentKey: 'NSE_EQ|INE081A01020' },
  JSWSTEEL: { name: 'JSW Steel Limited', upstoxInstrumentKey: 'NSE_EQ|INE019A01038' },
  'M&M': { name: 'Mahindra & Mahindra Limited', aliases: ['MM', 'MAHINDRA', 'MAHINDRA & MAHINDRA'], upstoxInstrumentKey: 'NSE_EQ|INE101A01026' },
  ADANIENT: { name: 'Adani Enterprises Limited', upstoxInstrumentKey: 'NSE_EQ|INE423A01024' },
  ADANIPORTS: { name: 'Adani Ports and Special Economic Zone Limited', upstoxInstrumentKey: 'NSE_EQ|INE742F01042' },
  GRASIM: { name: 'Grasim Industries Limited', upstoxInstrumentKey: 'NSE_EQ|INE047A01021' },
  TECHM: { name: 'Tech Mahindra Limited', upstoxInstrumentKey: 'NSE_EQ|INE281A01028' },
  HINDUNILVR: { name: 'Hindustan Unilever Limited', upstoxInstrumentKey: 'NSE_EQ|INE030A01027' },
  DIVISLAB: { name: "Divi's Laboratories Limited", upstoxInstrumentKey: 'NSE_EQ|INE361B01024' },
  DRREDDY: { name: "Dr. Reddy's Laboratories Limited", upstoxInstrumentKey: 'NSE_EQ|INE089A01023' },
  CIPLA: { name: 'Cipla Limited', upstoxInstrumentKey: 'NSE_EQ|INE059A01026' },
  BRITANNIA: { name: 'Britannia Industries Limited', upstoxInstrumentKey: 'NSE_EQ|INE216A01030' },
  EICHERMOT: { name: 'Eicher Motors Limited', upstoxInstrumentKey: 'NSE_EQ|INE066A01021' },
  HEROMOTOCO: { name: 'Hero MotoCorp Limited', upstoxInstrumentKey: 'NSE_EQ|INE158A01026' },
  COALINDIA: { name: 'Coal India Limited', upstoxInstrumentKey: 'NSE_EQ|INE522F01014' },
  BPCL: { name: 'Bharat Petroleum Corporation Limited', upstoxInstrumentKey: 'NSE_EQ|INE029A01011' },
  NESTLEIND: { name: 'Nestle India Limited', upstoxInstrumentKey: 'NSE_EQ|INE239A01024' },
  APOLLOHOSP: { name: 'Apollo Hospitals Enterprise Limited', upstoxInstrumentKey: 'NSE_EQ|INE437A01024' },
  BAJAJFINSV: { name: 'Bajaj Finserv Limited', upstoxInstrumentKey: 'NSE_EQ|INE918I01026' },
  'BAJAJ-AUTO': { name: 'Bajaj Auto Limited', aliases: ['BAJAJ AUTO'], upstoxInstrumentKey: 'NSE_EQ|INE917I01010' },
  SBILIFE: { name: 'SBI Life Insurance Company Limited', upstoxInstrumentKey: 'NSE_EQ|INE123W01016' },
  HDFCLIFE: { name: 'HDFC Life Insurance Company Limited', upstoxInstrumentKey: 'NSE_EQ|INE795G01014' },
  DABUR: { name: 'Dabur India Limited', upstoxInstrumentKey: 'NSE_EQ|INE016A01026' },
  HAVELLS: { name: 'Havells India Limited', upstoxInstrumentKey: 'NSE_EQ|INE176B01034' },
  PIDILITIND: { name: 'Pidilite Industries Limited', upstoxInstrumentKey: 'NSE_EQ|INE318A01026' },
  SIEMENS: { name: 'Siemens Limited', upstoxInstrumentKey: 'NSE_EQ|INE003A01024' },
  TRENT: { name: 'Trent Limited', upstoxInstrumentKey: 'NSE_EQ|INE849A01020' },
  BANKBARODA: { name: 'Bank of Baroda' },
  INDUSINDBK: { name: 'IndusInd Bank Limited' },
  PNB: { name: 'Punjab National Bank' },
  FEDERALBNK: { name: 'The Federal Bank Limited' },
  IDFCFIRSTB: { name: 'IDFC First Bank Limited', aliases: ['IDFC FIRST BANK'] },
  LTIM: { name: 'LTIMindtree Limited', aliases: ['LTIMINDTREE'], yahooSymbol: 'LTM' },
  PERSISTENT: { name: 'Persistent Systems Limited' },
  COFORGE: { name: 'Coforge Limited' },
  MPHASIS: { name: 'Mphasis Limited' },
  TATAELXSI: { name: 'Tata Elxsi Limited' },
  ASHOKLEY: { name: 'Ashok Leyland Limited', aliases: ['ASHOK LEYLAND'] },
  BALKRISIND: { name: 'Balkrishna Industries Limited' },
  MOTHERSON: { name: 'Samvardhana Motherson International Limited', aliases: ['MOTHERSON SUMI'] },
  EXIDEIND: { name: 'Exide Industries Limited' },
  HINDALCO: { name: 'Hindalco Industries Limited' },
  VEDL: { name: 'Vedanta Limited' },
  NMDC: { name: 'NMDC Limited' },
  SAIL: { name: 'Steel Authority of India Limited' },
  JINDALSTEL: { name: 'Jindal Steel & Power Limited', aliases: ['JSPL'] },
  BIOCON: { name: 'Biocon Limited' },
  LUPIN: { name: 'Lupin Limited' },
  AUROPHARMA: { name: 'Aurobindo Pharma Limited', aliases: ['AUROBINDO PHARMA'] },
  TORNTPHARM: { name: 'Torrent Pharmaceuticals Limited' },
  TATAPOWER: { name: 'Tata Power Company Limited', aliases: ['TATA POWER'] },
  PETRONET: { name: 'Petronet LNG Limited' },
  GAIL: { name: 'GAIL (India) Limited' },
  GODREJCP: { name: 'Godrej Consumer Products Limited' },
  MARICO: { name: 'Marico Limited' },
  COLPAL: { name: 'Colgate-Palmolive (India) Limited' },
  DLF: { name: 'DLF Limited' },
  GODREJPROP: { name: 'Godrej Properties Limited' },
  OBEROIRLTY: { name: 'Oberoi Realty Limited' },
  PRESTIGE: { name: 'Prestige Estates Projects Limited' },
  SOBHA: { name: 'Sobha Limited' },
  PHOENIXLTD: { name: 'The Phoenix Mills Limited', aliases: ['PHOENIX MILLS'] },
  IDEA: { name: 'Vodafone Idea Limited', aliases: ['VODAFONE IDEA'] },
  IRCTC: { name: 'Indian Railway Catering and Tourism Corporation Limited' },
  CONCOR: { name: 'Container Corporation of India Limited' },
  NBCC: { name: 'NBCC (India) Limited' },
  RVNL: { name: 'Rail Vikas Nigam Limited' },
  SHRIRAMFIN: { name: 'Shriram Finance Limited', aliases: ['SHRIRAM FINANCE'] },
  CHOLAFIN: { name: 'Cholamandalam Investment and Finance Company Limited' },
  MUTHOOTFIN: { name: 'Muthoot Finance Limited' },
  MANAPPURAM: { name: 'Manappuram Finance Limited' },
};

const ALL_STOCK_SYMBOLS = unique([
  ...NIFTY_50_STOCKS,
  ...Object.values(SECTOR_MAP).flat(),
]);

export const MARKET_STOCKS: MarketStockDefinition[] = ALL_STOCK_SYMBOLS
  .map((symbol) => {
    const seed = STOCK_SEEDS[symbol] || {};
    const sectors = Object.entries(SECTOR_MAP)
      .filter(([, stocks]) => stocks.includes(symbol))
      .map(([sector]) => sector);

    return {
      symbol,
      name: seed.name || symbol,
      sectors,
      aliases: seed.aliases || [],
      yahooSymbol: seed.yahooSymbol || symbol,
      upstoxInstrumentKey: seed.upstoxInstrumentKey,
      inNifty50: NIFTY_50_STOCKS.includes(symbol as (typeof NIFTY_50_STOCKS)[number]),
      exchange: 'NSE' as const,
    };
  })
  .sort((left, right) => Number(right.inNifty50) - Number(left.inNifty50) || left.symbol.localeCompare(right.symbol));

export const INDIAN_INDICES = MARKET_INDICES.map((index) => ({
  symbol: index.yahooSymbol,
  name: index.name,
  shortName: index.shortName,
}));

export const UPSTOX_INSTRUMENTS: Record<string, string> = {
  ...Object.fromEntries(MARKET_INDICES.map((index) => [index.upstoxSymbol, `NSE_INDEX|${index.upstoxSymbol.replace('NIFTY ', 'Nifty ')}`])),
  ...Object.fromEntries(
    MARKET_STOCKS.filter((stock) => stock.upstoxInstrumentKey).map((stock) => [stock.symbol, stock.upstoxInstrumentKey!]),
  ),
};

UPSTOX_INSTRUMENTS['NIFTY 50'] = 'NSE_INDEX|Nifty 50';
UPSTOX_INSTRUMENTS['NIFTY BANK'] = 'NSE_INDEX|Nifty Bank';
UPSTOX_INSTRUMENTS['NIFTY IT'] = 'NSE_INDEX|Nifty IT';
UPSTOX_INSTRUMENTS['NIFTY PHARMA'] = 'NSE_INDEX|Nifty Pharma';
UPSTOX_INSTRUMENTS['NIFTY AUTO'] = 'NSE_INDEX|Nifty Auto';
UPSTOX_INSTRUMENTS['NIFTY METAL'] = 'NSE_INDEX|Nifty Metal';
UPSTOX_INSTRUMENTS['NIFTY ENERGY'] = 'NSE_INDEX|Nifty Energy';
UPSTOX_INSTRUMENTS['NIFTY FMCG'] = 'NSE_INDEX|Nifty FMCG';
UPSTOX_INSTRUMENTS['NIFTY REALTY'] = 'NSE_INDEX|Nifty Realty';
UPSTOX_INSTRUMENTS['NIFTY PSU BANK'] = 'NSE_INDEX|Nifty PSU Bank';
UPSTOX_INSTRUMENTS['NIFTY INFRA'] = 'NSE_INDEX|Nifty Infra';
UPSTOX_INSTRUMENTS['NIFTY MIDCAP 100'] = 'NSE_INDEX|Nifty Midcap 100';

export const UPSTOX_INDEX_SYMBOLS = MARKET_INDICES.map((index) => index.upstoxSymbol);

export function findStockDefinition(query: string): MarketStockDefinition | undefined {
  const normalizedQuery = normalizeSearchValue(query);
  if (!normalizedQuery) return undefined;

  return MARKET_STOCKS.find((stock) =>
    [stock.symbol, stock.yahooSymbol, stock.name, ...stock.aliases].some(
      (value) => normalizeSearchValue(value) === normalizedQuery,
    ),
  );
}

export function findIndexDefinition(query: string): MarketIndexDefinition | undefined {
  const normalizedQuery = normalizeSearchValue(query);
  if (!normalizedQuery) return undefined;

  return MARKET_INDICES.find((index) =>
    [index.name, index.shortName, index.yahooSymbol, index.upstoxSymbol, ...(index.aliases || [])].some(
      (value) => normalizeSearchValue(value) === normalizedQuery,
    ),
  );
}

export function getYahooLookupCandidates(query: string): string[] {
  const stock = findStockDefinition(query);
  const index = findIndexDefinition(query);
  const candidateSymbols = [
    index?.yahooSymbol,
    index?.name,
    index?.shortName,
    ...(index?.aliases || []),
    stock?.yahooSymbol,
    stock?.symbol,
    query,
    ...(stock?.aliases || []).filter((alias) => /^[A-Z0-9&.-]+$/i.test(alias)),
  ].filter((value): value is string => Boolean(value));

  return unique(candidateSymbols.map((value) => value.toUpperCase()));
}

export function getSearchCatalogResults(query: string, limit = 10) {
  const normalizedQuery = normalizeSearchValue(query);
  if (!normalizedQuery) return [];
  const shortQuery = normalizedQuery.length < 4;

  const ranked = MARKET_STOCKS
    .map((stock) => {
      const exactSymbol = normalizeSearchValue(stock.symbol) === normalizedQuery;
      const symbolPrefix = normalizeSearchValue(stock.symbol).startsWith(normalizedQuery);
      const aliasPrefix = stock.aliases.some((alias) => normalizeSearchValue(alias).startsWith(normalizedQuery));
      const nameTokenPrefix = tokenizeSearchValue(stock.name).some((token) => token.startsWith(normalizedQuery));
      const aliasTokenPrefix = stock.aliases.some((alias) => tokenizeSearchValue(alias).some((token) => token.startsWith(normalizedQuery)));
      const nameContains = !shortQuery && normalizeSearchValue(stock.name).includes(normalizedQuery);

      if (!exactSymbol && !symbolPrefix && !aliasPrefix && !nameTokenPrefix && !aliasTokenPrefix && !nameContains) {
        return null;
      }

      const score = exactSymbol
        ? 5
        : symbolPrefix
          ? 4
          : aliasPrefix
            ? 3
            : nameTokenPrefix || aliasTokenPrefix
              ? 2
              : 1;

      return {
        score,
        stock,
      };
    })
    .filter((entry): entry is { score: number; stock: MarketStockDefinition } => Boolean(entry))
    .sort((left, right) => right.score - left.score || Number(right.stock.inNifty50) - Number(left.stock.inNifty50) || left.stock.symbol.localeCompare(right.stock.symbol))
    .slice(0, limit);

  return ranked.map(({ stock }) => ({
    symbol: stock.symbol,
    name: stock.name,
    exchange: stock.exchange,
    type: 'EQUITY',
    sectors: stock.sectors,
    inNifty50: stock.inNifty50,
  }));
}

export function getPublicMarketCatalog() {
  return {
    indices: MARKET_INDICES.map((index) => ({
      name: index.name,
      shortName: index.shortName,
      aliases: index.aliases || [],
    })),
    stocks: MARKET_STOCKS.map((stock) => ({
      symbol: stock.symbol,
      name: stock.name,
      sectors: stock.sectors,
      aliases: stock.aliases,
      inNifty50: stock.inNifty50,
      exchange: stock.exchange,
    })),
    sectors: SECTOR_MAP,
    nifty50: [...NIFTY_50_STOCKS],
  };
}