import axios from 'axios';
import * as cheerio from 'cheerio';
import { Financial } from '../models/Financial.js';
import { logger } from '../utils/logger.js';

const SCREENER_URL = 'https://www.screener.in/company';

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
  source: string;
  filingDate: string;
}

const quarterMap: Record<string, number> = {
  'Mar': 1, 'Jun': 2, 'Sep': 3, 'Dec': 4,
};

async function fetchScreenerData(symbol: string): Promise<ParsedFinancial[]> {
  const results: ParsedFinancial[] = [];
  
  try {
    const url = `${SCREENER_URL}/${symbol}/`;
    const res = await axios.get(url, {
      timeout: 20000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    const $ = cheerio.load(res.data);

    const quarters: string[] = [];
    const revenues: number[] = [];
    const netProfits: number[] = [];
    const ePS: number[] = [];

    const headers = $('th.quarter, td.quarter').toArray();
    for (const th of headers) {
      const text = $(th).text().trim();
      if (text.includes('202') || text.includes('202')) {
        quarters.push(text);
      }
    }

    const rows = $('tr').toArray();
    for (const row of rows) {
      const rowText = $(row).text();
      if (rowText.includes('Sales') || rowText.includes('Revenue') || rowText.includes('Income')) {
        const cells = $(row).find('td').toArray();
        let colIdx = 0;
        for (let i = 0; i < cells.length; i++) {
          let val = $(cells[i]).text().replace(/[^\d.-]/g, '');
          val = val.replace(/,/g, '');
          const num = parseFloat(val) * 10000000;
          if (!isNaN(num) && num > 0) {
            revenues.push(num);
          }
        }
      }
      if (rowText.includes('Net Profit') || rowText.includes('Profit before tax')) {
        const cells = $(row).find('td').toArray();
        for (let i = 0; i < cells.length; i++) {
          let val = $(cells[i]).text().replace(/[^\d.-]/g, '');
          val = val.replace(/,/g, '');
          const num = parseFloat(val) * 10000000;
          if (!isNaN(num) && num > 0) {
            netProfits.push(num);
          }
        }
      }
      if (rowText.includes('EPS') || rowText.includes('EPS')) {
        const cells = $(row).find('td').toArray();
        for (let i = 0; i < cells.length; i++) {
          let val = $(cells[i]).text().replace(/[^\d.-]/g, '');
          const num = parseFloat(val);
          if (!isNaN(num)) {
            ePS.push(num);
          }
        }
      }
    }

    const currentYear = new Date().getFullYear();
    const q = currentYear % 100;
    
    let minLen = Math.min(quarters.length, revenues.length, netProfits.length);
    if (minLen === 0) {
      minLen = Math.max(revenues.length, netProfits.length, 4);
    }

    for (let i = 0; i < minLen; i++) {
      const qIdx = (minLen - 1 - i);
      let quarter = (q - i);
      let year = currentYear;
      if (quarter < 1) {
        quarter += 4;
        year -= 1;
      }

      results.push({
        symbol: symbol.toUpperCase(),
        period: `Q${quarter}`,
        year: year,
        quarter: quarter,
        revenue: revenues[qIdx] || 0,
        netIncome: netProfits[qIdx] || 0,
        eps: ePS[qIdx] || 0,
        totalAssets: 0,
        totalLiabilities: 0,
        totalEquity: 0,
        cashFromOperations: 0,
        cashFromInvesting: 0,
        cashFromFinancing: 0,
        source: 'Screener',
        filingDate: `${year}-03-31`,
      });
    }

    if (results.length === 0) {
      logger.warn(`No financial data parsed for ${symbol} from screener.in`);
    }

  } catch (error) {
    logger.warn(`Screener fetch failed for ${symbol}: ${(error as Error).message}`);
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
  const data = await fetchScreenerData(symbol);
  
  if (data.length) {
    const saved = await saveFinancials(data);
    logger.info(`Stored ${saved} financial records for ${symbol} from Screener`);
    return { saved, source: 'Screener' };
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