import axios from 'axios';
import * as cheerio from 'cheerio';
import { logger } from '../utils/logger.js';

const SCREENER_URL = 'https://www.screener.in/company';

interface ParsedQuarter {
  year: number;
  quarter: string;
  revenueFromOperations: number | null;
  profitAfterTax: number | null;
  eps: number | null;
  totalEquity: number | null;
  totalAssets: number | null;
  roe: number | null;
  netMargin: number | null;
  dividendPerShare: number | null;
}

const quarterMap: Record<string, string> = {
  'Mar': 'Q4', 'Jun': 'Q1', 'Sep': 'Q2', 'Dec': 'Q3',
};

function parseNumber(val: string | undefined | null): number | null {
  if (!val) return null;
  const cleaned = val.replace(/[₹,\s]/g, '').replace(/cr/i, '0000000').replace(/lac/i, '00000').replace(/lakhs?/i, '00000');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

export async function fetchScreenerFinancials(symbol: string): Promise<{
  symbol: string;
  companyName: string;
  latest: any;
  annual: any;
  quarters: any[];
} | null> {
  try {
    const url = `${SCREENER_URL}/${symbol.toUpperCase()}/`;
    const res = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    const $ = cheerio.load(res.data);

    const quarters: ParsedQuarter[] = [];
    
    const years: string[] = [];
    const revs: (string | null)[] = [];
    const profits: (string | null)[] = [];
    const epsVals: (string | null)[] = [];
    const roeVals: (string | null)[] = [];
    const netMargins: (string | null)[] = [];
    const divs: (string | null)[] = [];

    $('th.quarter, td.quarter').each((i, el) => {
      const text = $(el).text().trim();
      if (i < 5) years.push(text);
      if (i >= 5 && i < 10) revs.push(text || null);
      if (i >= 10 && i < 15) profits.push(text || null);
      if (i >= 15 && i < 20) epsVals.push(text || null);
      if (i >= 20 && i < 25) roeVals.push(text || null);
      if (i >= 25 && i < 30) netMargins.push(text || null);
      if (i >= 30 && i < 35) divs.push(text || null);
    });

    const yearMatch = $('h1').text().match(/FY(\d{2})/);
    const currentYear = yearMatch ? 2000 + parseInt(yearMatch[1]) : 2025;

    for (let i = 0; i < Math.min(years.length, 8); i++) {
      const yearText = years[i];
      const qMatch = yearText.match(/(Mar|Jun|Sep|Dec)\s*(\d{2})/);
      if (!qMatch) continue;

      const month = qMatch[1];
      const yr = parseInt(qMatch[2]);
      const year = yr < 50 ? 2000 + yr : 1900 + yr;
      const quarter = quarterMap[month] || 'Q1';

      quarters.push({
        year,
        quarter,
        revenueFromOperations: parseNumber(revs[i] || ''),
        profitAfterTax: parseNumber(profits[i] || ''),
        eps: parseNumber(epsVals[i] || ''),
        totalEquity: null,
        totalAssets: null,
        roe: parseNumber(roeVals[i] || ''),
        netMargin: parseNumber(netMargins[i] || ''),
        dividendPerShare: parseNumber(divs[i] || ''),
      });
    }

    if (quarters.length === 0) {
      logger.warn(`No data scraped for ${symbol} from screener.in`);
      return null;
    }

    const companyName = $('h1').first().text().replace(/financials/i, '').trim() || symbol.toUpperCase();

    const formattedQuarters = quarters.reverse().map(q => ({
      symbol: symbol.toUpperCase(),
      companyName,
      year: q.year,
      quarter: q.quarter,
      consolidationType: 'Standalone',
      revenueFromOperations: q.revenueFromOperations,
      profitAfterTax: q.profitAfterTax,
      totalAssets: q.totalAssets,
      totalEquity: q.totalEquity,
      totalLiabilities: null,
      borrowingsTotal: null,
      eps: q.eps,
      epsYoYGrowth: null,
      bookValuePerShare: null,
      faceValuePerShare: null,
      roe: q.roe,
      roeYoYGrowth: null,
      roce: null,
      roceYoYGrowth: null,
      roa: null,
      roaYoYGrowth: null,
      netMargin: q.netMargin,
      netMarginYoYGrowth: null,
      grossMargin: null,
      debtToEquity: null,
      debtToEquityYoYGrowth: null,
      currentRatio: null,
      quickRatio: null,
      interestCoverage: null,
      assetTurnover: null,
      dividendPerShare: q.dividendPerShare,
      dividendYield: null,
      dividendPayoutRatio: null,
      operatingCashFlow: null,
      freeCashFlow: null,
      cashConversion: null,
      revenueGrowth: null,
      profitGrowth: null,
      assetGrowth: null,
      equityGrowth: null,
      receivablesDays: null,
      inventoryDays: null,
      payableDays: null,
      cashConversionCycle: null,
      updatedAt: new Date(),
    }));

    const latest = formattedQuarters[formattedQuarters.length - 1] || null;

    return {
      symbol: symbol.toUpperCase(),
      companyName,
      latest,
      annual: {
        totalRevenue: latest?.revenueFromOperations || null,
        totalProfit: latest?.profitAfterTax || null,
        totalAssets: latest?.totalAssets || null,
        totalEquity: latest?.totalEquity || null,
        avgRoe: latest?.roe || null,
        avgRoce: null,
        avgNetMargin: latest?.netMargin || null,
      },
      quarters: formattedQuarters,
    };
  } catch (err) {
    logger.warn(`Failed to fetch from screener.in for ${symbol}: ${(err as Error).message}`);
    return null;
  }
}