import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CSV_FILES = ['March-25.csv', 'June-25.csv', 'Sep-25.csv', 'Dec-25.csv'];

const NIFTY_50 = new Set([
  'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'SBIN', 'BHARTIARTL',
  'ITC', 'KOTAKBANK', 'LT', 'HCLTECH', 'BAJFINANCE', 'MARUTI', 'ASIANPAINT',
  'SUNPHARMA', 'TITAN', 'AXISBANK', 'WIPRO', 'ULTRACEMCO', 'NTPC',
  'ONGC', 'TATAMOTORS', 'POWERGRID', 'TATASTEEL', 'JSWSTEEL',
  'M&M', 'ADANIENT', 'ADANIPORTS', 'GRASIM', 'TECHM',
  'HINDUNILVR', 'DIVISLAB', 'DRREDDY', 'CIPLA', 'BRITANNIA',
  'EICHERMOT', 'HEROMOTOCO', 'COALINDIA', 'BPCL', 'NESTLEIND',
  'APOLLOHOSP', 'BAJAJFINSV', 'BAJAJ-AUTO', 'SBILIFE', 'HDFCLIFE',
  'DABUR', 'HAVELLS', 'PIDILITIND', 'SIEMENS', 'TRENT'
]);

const SECTOR_MAP: Record<string, string[]> = {
  Banking: ['HDFCBANK', 'ICICIBANK', 'SBIN', 'KOTAKBANK', 'AXISBANK', 'INDUSINDBK', 'FEDERALBNK', 'RBLBANK', 'AUBANK', 'BANDHANBNK', 'CANBK'],
  IT: ['TCS', 'INFY', 'WIPRO', 'HCLTECH', 'TECHM', 'LTIM', 'PERSISTENT', 'COFORGE', 'MPHASIS', 'TATAELXSI'],
  Auto: ['TATAMOTORS', 'MARUTI', 'M&M', 'BAJAJ-AUTO', 'HEROMOTOCO', 'EICHERMOT', 'ASHOKLEY', 'BALKRISIND', 'MOTHERSON'],
  Metals: ['TATASTEEL', 'JSWSTEEL', 'HINDALCO', 'VEDL', 'COALINDIA', 'NMDC', 'SAIL', 'JINDALSTEL', 'WELCORP', 'RATNAMANI'],
  Pharma: ['SUNPHARMA', 'DRREDDY', 'CIPLA', 'DIVISLAB', 'BIOCON', 'LUPIN', 'AUROPHARMA', 'TORNTPHARM', 'GLENMARK', 'ZYDUSWELL'],
  Energy: ['RELIANCE', 'NTPC', 'POWERGRID', 'ONGC', 'BPCL', 'TATAPOWER', 'PETRONET', 'GAIL', 'IOC'],
  FMCG: ['ITC', 'HINDUNILVR', 'NESTLEIND', 'BRITANNIA', 'DABUR', 'GODREJCP', 'MARICO', 'COLPAL'],
  Realty: ['DLF', 'GODREJPROP', 'OBEROIRLTY', 'PRESTIGE', 'SOBHA', 'PHOENIXLTD'],
  NBFC: ['BAJFINANCE', 'BAJAJFINSV', 'SHRIRAMFIN', 'CHOLAFIN', 'MUTHOOTFIN', 'MANAPPURAM'],
};

const stockSectors: Record<string, string[]> = {};
Object.entries(SECTOR_MAP).forEach(([sector, stocks]) => {
  stocks.forEach(s => {
    if (!stockSectors[s]) stockSectors[s] = [];
    stockSectors[s].push(sector);
  });
});

const csvData: Record<string, string> = {};
CSV_FILES.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').slice(1);
  lines.forEach(line => {
    if (!line.trim() || !line.includes('","')) return;
    const match = line.match(/"([A-Z]+)","([^"]+)"/);
    if (match) {
      const symbol = match[1].trim().toUpperCase();
      const name = match[2].trim();
      if (symbol && symbol.length >= 2 && symbol.length <= 10 && /^[A-Z]+$/.test(symbol) && !csvData[symbol]) {
        csvData[symbol] = name;
      }
    }
  });
});

const allSymbols = Object.keys(csvData).sort();
const stockDefs = allSymbols.map(symbol => ({
  symbol,
  name: csvData[symbol] || symbol,
  sectors: stockSectors[symbol] || [],
  inNifty50: NIFTY_50.has(symbol),
  exchange: 'NSE' as const,
}));

console.log('export const GENERATED_STOCKS = {');
stockDefs.forEach(s => {
  const sectorStr = s.sectors.length ? s.sectors.map(x => "'" + x + "'").join(', ') : '';
  console.log(`  "${s.symbol}": { name: "${s.name}", sectors: [${sectorStr}], inNifty50: ${s.inNifty50} },`);
});
console.log('} as const;');
console.log('\nexport type GeneratedStock = typeof GENERATED_STOCKS[string];');
console.log('Total:', stockDefs.length);