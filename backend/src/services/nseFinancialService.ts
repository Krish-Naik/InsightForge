import axios from 'axios';
import { Financial } from '../models/Financial.js';
import { logger } from '../utils/logger.js';

const NSE_URL = 'https://www.nseindia.com';
const BSE_URL = 'https://www.bseindia.com';

interface ParsedFinancial {
  symbol: string;
  period: string;
  year: number;
  quarter: number;
  revenue: number;
  netIncome: number;
  eps: number;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  cashFromOperations: number;
  cashFromInvesting: number;
  cashFromFinancing: number;
  source: 'NSE' | 'BSE';
  filingDate: string;
}

async function getNSECookie(): Promise<string> {
  try {
    const res = await axios.get(NSE_URL, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    return res.headers['set-cookie']?.toString() || '';
  } catch {
    return '';
  }
}

async function fetchNSEResults(symbol: string): Promise<ParsedFinancial[]> {
  const results: ParsedFinancial[] = [];
  
  try {
    const cookie = await getNSECookie();
    
    const url = `${NSE_URL}/campusface/getdata?reqstr=${encodeURIComponent(symbol)}&report=PLBSCF`;
    
    const res = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Cookie': cookie,
        'Accept': 'application/json',
      },
    });

    const data = res.data;
    if (data?.results) {
      for (const row of data.results) {
        results.push({
          symbol: symbol.toUpperCase(),
          period: row.period || 'Q',
          year: parseInt(row.year) || new Date().getFullYear(),
          quarter: parseInt(row.quarter) || 1,
          revenue: parseFloat(row.revenue) || 0,
          netIncome: parseFloat(row.netprofit) || 0,
          eps: parseFloat(row.eps) || 0,
          totalAssets: parseFloat(row.totalassets) || 0,
          totalLiabilities: parseFloat(row.totalliabilities) || 0,
          totalEquity: parseFloat(row.totalequity) || 0,
          cashFromOperations: parseFloat(row.operatingcashflow) || 0,
          cashFromInvesting: parseFloat(row.investingcashflow) || 0,
          cashFromFinancing: parseFloat(row.financingcashflow) || 0,
          source: 'NSE',
          filingDate: row.filingdate || '',
        });
      }
    }
  } catch (error) {
    logger.warn(`NSE scrape failed for ${symbol}: ${(error as Error).message}`);
  }

  return results;
}

async function fetchBSEResults(symbol: string): Promise<ParsedFinancial[]> {
  const results: ParsedFinancial[] = [];
  
  try {
    const url = `${BSE_URL}/stocks/stock-quote/${symbol}`;
    
    const res = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    const html = res.data;
    const profitMatch = html.match(/Net Profit[^>]*>(\d[\d,\.]*)/);
    const revenueMatch = html.match(/Total Income[^>]*>(\d[\d,\.]*)/);
    
    if (profitMatch || revenueMatch) {
      results.push({
        symbol: symbol.toUpperCase(),
        period: 'Q4',
        year: new Date().getFullYear(),
        quarter: 4,
        revenue: parseFloat(revenueMatch?.[1]?.replace(/,/g, '') || '0'),
        netIncome: parseFloat(profitMatch?.[1]?.replace(/,/g, '') || '0'),
        eps: 0,
        totalAssets: 0,
        totalLiabilities: 0,
        totalEquity: 0,
        cashFromOperations: 0,
        cashFromInvesting: 0,
        cashFromFinancing: 0,
        source: 'BSE',
        filingDate: new Date().toISOString().split('T')[0],
      });
    }
  } catch (error) {
    logger.warn(`BSE scrape failed for ${symbol}: ${(error as Error).message}`);
  }

  return results;
}

async function saveFinancials(data: ParsedFinancial[]): Promise<number> {
  let saved = 0;
  
  for (const item of data) {
    try {
      await Financial.findOneAndUpdate(
        { symbol: item.symbol, year: item.year, quarter: item.quarter },
        { ...item, lastUpdated: new Date() },
        { upsert: true, new: true }
      );
      saved++;
    } catch (error) {
      logger.warn(`Failed to save financial for ${item.symbol}: ${(error as Error).message}`);
    }
  }
  
  return saved;
}

export async function scrapeAndStoreFinancials(symbol: string): Promise<{ saved: number; source: string }> {
  const nseData = await fetchNSEResults(symbol);
  
  if (nseData.length) {
    const saved = await saveFinancials(nseData);
    logger.info(`Stored ${saved} financial records for ${symbol} from NSE`);
    return { saved, source: 'NSE' };
  }

  const bseData = await fetchBSEResults(symbol);
  
  if (bseData.length) {
    const saved = await saveFinancials(bseData);
    logger.info(`Stored ${saved} financial records for ${symbol} from BSE`);
    return { saved, source: 'BSE' };
  }

  return { saved: 0, source: 'none' };
}

export async function getStoredFinancials(symbol: string): Promise<any[]> {
  return Financial.find({ symbol: symbol.toUpperCase() })
    .sort({ year: -1, quarter: -1 })
    .limit(20)
    .lean();
}

export async function getAllStoredSymbols(): Promise<string[]> {
  const symbols = await Financial.distinct('symbol');
  return symbols;
}