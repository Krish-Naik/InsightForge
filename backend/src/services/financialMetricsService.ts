import { QuarterlyFinancial } from '../models/QuarterlyFinancial.js';
import { logger } from '../utils/logger.js';
import { getStockData } from './stockCacheService.js';

export interface FinancialMetrics {
  symbol: string;
  companyName: string;
  year: number;
  quarter: string;
  consolidationType: string;

  // Price data (from yfinance)
  currentPrice: number | null;
  marketCap: number | null;
  
  // Financial data (from MongoDB)
  revenueFromOperations: number | null;
  profitAfterTax: number | null;
  totalAssets: number | null;
  totalEquity: number | null;
  totalLiabilities: number | null;
  borrowingsTotal: number | null;
  totalCurrentAssets: number | null;
  totalCurrentLiabilities: number | null;
  inventories: number | null;
  operatingCashFlow: number | null;
  freeCashFlow: number | null;

  // Per-share metrics
  eps: number | null;
  epsYoYGrowth: number | null;
  bookValuePerShare: number | null;
  faceValuePerShare: number | null;
  numberOfShares: number | null;

  // Profitability ratios
  roe: number | null;
  roeYoYGrowth: number | null;
  roce: number | null;
  roceYoYGrowth: number | null;
  roa: number | null;
  roaYoYGrowth: number | null;
  netMargin: number | null;
  netMarginYoYGrowth: number | null;
  grossMargin: number | null;

  // Valuation ratios (require current price)
  peRatio: number | null;
  pbRatio: number | null;
  psRatio: number | null;
  priceToSales: number | null;
  evToEbitda: number | null;

  // Leverage ratios
  debtToEquity: number | null;
  debtToEquityYoYGrowth: number | null;
  currentRatio: number | null;
  quickRatio: number | null;
  interestCoverage: number | null;
  assetTurnover: number | null;

  // Dividend metrics
  dividendPerShare: number | null;
  dividendYield: number | null;
  dividendPayoutRatio: number | null;

  // Cash flow metrics
  cashConversion: number | null;

  // Growth metrics
  revenueGrowth: number | null;
  profitGrowth: number | null;
  assetGrowth: number | null;
  equityGrowth: number | null;

  // Working capital metrics
  receivablesDays: number | null;
  inventoryDays: number | null;
  payableDays: number | null;
  cashConversionCycle: number | null;

  updatedAt: Date;
}

export interface StockMetricsSummary {
  symbol: string;
  companyName: string;
  latest: FinancialMetrics | null;
  annual: {
    totalRevenue: number | null;
    totalProfit: number | null;
    totalAssets: number | null;
    totalEquity: number | null;
    avgRoe: number | null;
    avgRoce: number | null;
    avgNetMargin: number | null;
  };
  quarters: FinancialMetrics[];
}

// Helper functions for calculations
function calculateRoe(netProfit: number | null, equity: number | null): number | null {
  if (netProfit === null || equity === null || equity === 0) return null;
  return (netProfit / equity) * 100;
}

function calculateRoce(
  ebit: number | null,
  totalAssets: number | null,
  currentLiabilities: number | null
): number | null {
  if (ebit === null || totalAssets === null || currentLiabilities === null) return null;
  const capitalEmployed = totalAssets - (currentLiabilities || 0);
  if (capitalEmployed === 0) return null;
  return (ebit / capitalEmployed) * 100;
}

function calculateRoa(netProfit: number | null, totalAssets: number | null): number | null {
  if (netProfit === null || totalAssets === null || totalAssets === 0) return null;
  return (netProfit / totalAssets) * 100;
}

function calculateNetMargin(netProfit: number | null, revenue: number | null): number | null {
  if (netProfit === null || revenue === null || revenue === 0) return null;
  return (netProfit / revenue) * 100;
}

function calculateGrossMargin(
  revenue: number | null,
  costOfGoodsSold: number | null
): number | null {
  if (revenue === null || costOfGoodsSold === null || revenue === 0) return null;
  const grossProfit = revenue - costOfGoodsSold;
  return (grossProfit / revenue) * 100;
}

function calculateDebtToEquity(
  borrowings: number | null,
  equity: number | null
): number | null {
  if (borrowings === null || equity === null || equity === 0) return null;
  return borrowings / equity;
}

function calculateCurrentRatio(
  currentAssets: number | null,
  currentLiabilities: number | null
): number | null {
  if (currentAssets === null || currentLiabilities === null || currentLiabilities === 0) return null;
  return currentAssets / currentLiabilities;
}

function calculateQuickRatio(
  currentAssets: number | null,
  inventories: number | null,
  currentLiabilities: number | null
): number | null {
  if (currentAssets === null || currentLiabilities === null || currentLiabilities === 0) return null;
  const quickAssets = currentAssets - (inventories || 0);
  return quickAssets / currentLiabilities;
}

function calculateInterestCoverage(
  ebit: number | null,
  financeCosts: number | null
): number | null {
  if (ebit === null || financeCosts === null || financeCosts === 0) return null;
  return ebit / financeCosts;
}

function calculateAssetTurnover(
  revenue: number | null,
  totalAssets: number | null
): number | null {
  if (revenue === null || totalAssets === null || totalAssets === 0) return null;
  return revenue / totalAssets;
}

function calculateBookValuePerShare(
  equity: number | null,
  sharesOutstanding: number | null
): number | null {
  if (equity === null || sharesOutstanding === null || sharesOutstanding === 0) return null;
  return equity / sharesOutstanding;
}

function calculateYoYGrowth(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function calculateReceivablesDays(
  receivables: number | null,
  revenue: number | null
): number | null {
  if (receivables === null || revenue === null || revenue === 0) return null;
  return (receivables / revenue) * 365;
}

function calculateInventoryDays(
  inventory: number | null,
  cogs: number | null
): number | null {
  if (inventory === null || cogs === null || cogs === 0) return null;
  return (inventory / cogs) * 365;
}

function calculatePayableDays(
  payables: number | null,
  cogs: number | null
): number | null {
  if (payables === null || cogs === null || cogs === 0) return null;
  return (payables / cogs) * 365;
}

function calculateCashConversionCycle(
  receivablesDays: number | null,
  inventoryDays: number | null,
  payableDays: number | null
): number | null {
  if (receivablesDays === null && inventoryDays === null && payableDays === null) return null;
  const rcv = receivablesDays || 0;
  const inv = inventoryDays || 0;
  const pay = payableDays || 0;
  return rcv + inv - pay;
}

function calculateCashConversion(
  operatingCashFlow: number | null,
  netProfit: number | null
): number | null {
  if (operatingCashFlow === null || netProfit === null || netProfit === 0) return null;
  return (operatingCashFlow / netProfit) * 100;
}

// Fetch current price from cache (filled by batch worker) - no API calls
async function fetchCurrentPrice(symbol: string): Promise<{ price: number; marketCap: number | null } | null> {
  try {
    const cached = await getStockData(symbol.toUpperCase());
    if (cached && cached.price > 0) {
      return {
        price: cached.price,
        marketCap: cached.marketCap > 0 ? cached.marketCap : null,
      };
    }
    return null;
  } catch (error) {
    logger.warn(`Failed to get cached price for ${symbol}: ${(error as Error).message}`);
    return null;
  }
}

export async function computeMetrics(
  symbol: string,
  year?: number,
  consolidationType: 'Standalone' | 'Consolidated' = 'Standalone'
): Promise<StockMetricsSummary | null> {
  try {
    const query: any = {
      symbol: symbol.toUpperCase(),
      consolidationType,
    };
    
    if (year) {
      query.year = year;
    }

    const financials = await QuarterlyFinancial.find(query)
      .sort({ year: -1, quarter: -1 })
      .limit(8)
      .lean();

    if (!financials || financials.length === 0) {
      return null;
    }

    const companyName = financials[0].companyName || symbol;
    
    // Fetch current price from yfinance
    const priceData = await fetchCurrentPrice(symbol);
    const currentPrice = priceData?.price || null;
    const marketCapFromYahoo = priceData?.marketCap || null;

    const quarters: FinancialMetrics[] = [];

    for (let i = 0; i < financials.length; i++) {
      const q = financials[i];
      const prev = financials[i + 1];

      // Extract financial data (all in Crores)
      const revenue = q.revenueFromOperations || 0;
      const netProfit = q.profitLossForPeriod || 0;
      const profitBeforeTax = q.profitLossBeforeTax || 0;
      const financeCosts = q.financeCosts || 0;
      const totalAssets = q.totalAssets || 0;
      const totalEquity = q.totalEquity || 0;
      const currentAssets = q.totalCurrentAssets || 0;
      const currentLiabilities = q.totalCurrentLiabilities || 0;
      const nonCurrentLiabilities = q.totalNonCurrentLiabilities || 0;
      const inventories = q.inventories || 0;
      const tradeReceivables = q.tradeReceivablesCurrent || 0;
      const tradePayables = q.tradePayablesCurrent || 0;
      const borrowingsCurrent = q.borrowingsCurrent || 0;
      const borrowingsNonCurrent = q.borrowingsNonCurrent || 0;
      const borrowings = borrowingsCurrent + borrowingsNonCurrent;
      const costMaterials = q.costOfMaterialsConsumed || 0;
      const basicEps = q.basicEarningsLossPerShareFromContinuingAndDiscontinuedOperations || 0;
      const dividend = q.dividendPerShare || 0;
      const faceValue = q.faceValuePerShare || 10;
      const equityShareCapitalCr = q.equityShareCapital || 0;
      const operatingCashFlow = q.cashFlowsFromUsedInOperatingActivities || 0;
      const investingCashFlow = q.cashFlowsFromUsedInInvestingActivities || 0;
      const freeCashFlow = q.freeCashFlow || (operatingCashFlow - Math.abs(investingCashFlow));

      // Previous year data for YoY calculations
      const revenuePrev = prev?.revenueFromOperations || null;
      const profitPrev = prev?.profitLossForPeriod || null;
      const assetsPrev = prev?.totalAssets || null;
      const equityPrev = prev?.totalEquity || null;

      // Calculate EBIT
      const ebit = profitBeforeTax + financeCosts;

      // Calculate number of shares
      let numberOfShares = null;
      if (equityShareCapitalCr > 0 && faceValue > 0) {
        numberOfShares = (equityShareCapitalCr * 10000000) / faceValue;
      }

      // Calculate market cap (in Crores)
      let marketCap = marketCapFromYahoo;
      if (!marketCap && currentPrice && numberOfShares) {
        marketCap = (currentPrice * numberOfShares) / 10000000;
      }

      // Calculate book value per share
      const bookValuePerShare = calculateBookValuePerShare(totalEquity * 10000000, numberOfShares);

      // Calculate valuation ratios (need current price)
      const peRatio = currentPrice && basicEps ? currentPrice / basicEps : null;
      const pbRatio = currentPrice && bookValuePerShare ? currentPrice / bookValuePerShare : null;
      const annualRevenue = revenue * 4; // Quarterly to annual
      const psRatio = marketCap && annualRevenue ? marketCap / annualRevenue : null;
      
      // Calculate dividend yield
      const dividendYield = currentPrice && dividend ? (dividend / currentPrice) * 100 : null;

      // Calculate profitability metrics
      const roe = calculateRoe(netProfit, totalEquity);
      const roce = calculateRoce(ebit, totalAssets, currentLiabilities);
      const roa = calculateRoa(netProfit, totalAssets);
      const netMargin = calculateNetMargin(netProfit, revenue);
      const grossMargin = calculateGrossMargin(revenue, costMaterials);

      // Calculate leverage metrics
      const debtToEquity = calculateDebtToEquity(borrowings, totalEquity);
      const currentRatio = calculateCurrentRatio(currentAssets, currentLiabilities);
      const quickRatio = calculateQuickRatio(currentAssets, inventories, currentLiabilities);
      const interestCoverage = calculateInterestCoverage(ebit, financeCosts);
      const assetTurnover = calculateAssetTurnover(revenue, totalAssets);

      // Calculate working capital metrics
      const receivablesDays = calculateReceivablesDays(tradeReceivables, revenue);
      const inventoryDays = calculateInventoryDays(inventories, costMaterials);
      const payableDays = calculatePayableDays(tradePayables, costMaterials);
      const cashConversionCycle = calculateCashConversionCycle(receivablesDays, inventoryDays, payableDays);

      // Calculate cash flow metrics
      const cashConversion = calculateCashConversion(operatingCashFlow, netProfit);
      const dividendPayoutRatio = dividend && basicEps && basicEps > 0 ? (dividend / basicEps) * 100 : null;

      // Calculate YoY growth
      const revenueGrowth = calculateYoYGrowth(revenue, revenuePrev);
      const profitGrowth = calculateYoYGrowth(netProfit, profitPrev);
      const assetGrowth = calculateYoYGrowth(totalAssets, assetsPrev);
      const equityGrowth = calculateYoYGrowth(totalEquity, equityPrev);
      const epsYoYGrowth = calculateYoYGrowth(
        basicEps,
        prev?.basicEarningsLossPerShareFromContinuingAndDiscontinuedOperations || null
      );
      const roeYoYGrowth = calculateYoYGrowth(roe, calculateRoe(profitPrev, equityPrev));
      const roceYoYGrowth = calculateYoYGrowth(
        roce,
        calculateRoce(
          (prev?.profitLossBeforeTax || 0) + (prev?.financeCosts || 0),
          prev?.totalAssets || null,
          prev?.totalCurrentLiabilities || null
        )
      );
      const roaYoYGrowth = calculateYoYGrowth(roa, calculateRoa(profitPrev, assetsPrev));
      const netMarginYoYGrowth = calculateYoYGrowth(netMargin, calculateNetMargin(profitPrev, revenuePrev));
      const debtToEquityYoYGrowth = calculateYoYGrowth(
        debtToEquity,
        calculateDebtToEquity(
          (prev?.borrowingsCurrent || 0) + (prev?.borrowingsNonCurrent || 0),
          prev?.totalEquity || null
        )
      );

      const metrics: FinancialMetrics = {
        symbol,
        companyName,
        year: q.year,
        quarter: q.quarter,
        consolidationType: q.consolidationType,

        // Price data
        currentPrice,
        marketCap,

        // Financial data
        revenueFromOperations: revenue,
        profitAfterTax: netProfit,
        totalAssets,
        totalEquity,
        totalLiabilities: currentLiabilities + nonCurrentLiabilities,
        borrowingsTotal: borrowings,
        totalCurrentAssets: currentAssets,
        totalCurrentLiabilities: currentLiabilities,
        inventories,
        operatingCashFlow,
        freeCashFlow,

        // Per-share metrics
        eps: basicEps,
        epsYoYGrowth,
        bookValuePerShare,
        faceValuePerShare: faceValue,
        numberOfShares,

        // Profitability ratios
        roe,
        roeYoYGrowth,
        roce,
        roceYoYGrowth,
        roa,
        roaYoYGrowth,
        netMargin,
        netMarginYoYGrowth,
        grossMargin,

        // Valuation ratios
        peRatio,
        pbRatio,
        psRatio,
        priceToSales: psRatio,
        evToEbitda: null, // Would need enterprise value calculation

        // Leverage ratios
        debtToEquity,
        debtToEquityYoYGrowth,
        currentRatio,
        quickRatio,
        interestCoverage,
        assetTurnover,

        // Dividend metrics
        dividendPerShare: dividend,
        dividendYield,
        dividendPayoutRatio,

        // Cash flow metrics
        cashConversion,

        // Growth metrics
        revenueGrowth,
        profitGrowth,
        assetGrowth,
        equityGrowth,

        // Working capital metrics
        receivablesDays,
        inventoryDays,
        payableDays,
        cashConversionCycle,

        updatedAt: q.updatedAt || new Date(),
      };

      quarters.push(metrics);
    }

    const latest = quarters[0] || null;

    const annualData = quarters.reduce(
      (acc, q) => {
        if (q.revenueFromOperations) acc.totalRevenue += q.revenueFromOperations;
        if (q.profitAfterTax) acc.totalProfit += q.profitAfterTax;
        if (q.totalAssets) acc.totalAssets = q.totalAssets; // Take latest
        if (q.totalEquity) acc.totalEquity = q.totalEquity; // Take latest
        if (q.roe) { acc.roeSum += q.roe; acc.roeCount++; }
        if (q.roce) { acc.roceSum += q.roce; acc.roceCount++; }
        if (q.netMargin) { acc.netMarginSum += q.netMargin; acc.netMarginCount++; }
        return acc;
      },
      {
        totalRevenue: 0,
        totalProfit: 0,
        totalAssets: 0,
        totalEquity: 0,
        roeSum: 0,
        roeCount: 0,
        roceSum: 0,
        roceCount: 0,
        netMarginSum: 0,
        netMarginCount: 0,
      }
    );

    return {
      symbol,
      companyName,
      latest,
      annual: {
        totalRevenue: annualData.totalRevenue || null,
        totalProfit: annualData.totalProfit || null,
        totalAssets: annualData.totalAssets || null,
        totalEquity: annualData.totalEquity || null,
        avgRoe: annualData.roeCount > 0 ? annualData.roeSum / annualData.roeCount : null,
        avgRoce: annualData.roceCount > 0 ? annualData.roceSum / annualData.roceCount : null,
        avgNetMargin: annualData.netMarginCount > 0 ? annualData.netMarginSum / annualData.netMarginCount : null,
      },
      quarters,
    };
  } catch (error) {
    logger.error(`Error in computeMetrics for ${symbol}: ${(error as Error).message}`, { stack: (error as Error).stack });
    throw error;
  }
}

export async function searchStocksByMetrics(criteria: {
  minRoe?: number;
  maxRoe?: number;
  minRoce?: number;
  maxRoce?: number;
  minRoa?: number;
  minNetMargin?: number;
  maxNetMargin?: number;
  minGrossMargin?: number;
  minDebtToEquity?: number;
  maxDebtToEquity?: number;
  minCurrentRatio?: number;
  maxCurrentRatio?: number;
  minInterestCoverage?: number;
  minPeRatio?: number;
  maxPeRatio?: number;
  minPbRatio?: number;
  maxPbRatio?: number;
  minDividendYield?: number;
  minRevenue?: number;
  minMarketCap?: number;
  maxMarketCap?: number;
  minRevenueGrowth?: number;
  minProfitGrowth?: number;
  minEpsGrowth?: number;
  limit?: number;
}): Promise<FinancialMetrics[]> {
  // Get latest financials for all stocks
  const financials = await QuarterlyFinancial.aggregate([
    { $match: { consolidationType: 'Standalone' } },
    { $sort: { year: -1, quarter: -1 } },
    {
      $group: {
        _id: '$symbol',
        doc: { $first: '$$ROOT' },
      },
    },
    { $replaceRoot: { newRoot: '$doc' } },
    { $limit: criteria.limit || 200 },
  ]);

  const results: FinancialMetrics[] = [];
  const processed = new Set<string>();

  for (const f of financials) {
    const key = f.symbol;
    if (processed.has(key)) continue;
    processed.add(key);

    try {
      const result = await computeMetrics(f.symbol);
      if (!result?.latest) continue;

      const m = result.latest;

      // Apply filters
      if (criteria.minRoe !== undefined && (m.roe === null || m.roe < criteria.minRoe)) continue;
      if (criteria.maxRoe !== undefined && (m.roe === null || m.roe > criteria.maxRoe)) continue;
      if (criteria.minRoce !== undefined && (m.roce === null || m.roce < criteria.minRoce)) continue;
      if (criteria.maxRoce !== undefined && (m.roce === null || m.roce > criteria.maxRoce)) continue;
      if (criteria.minRoa !== undefined && (m.roa === null || m.roa < criteria.minRoa)) continue;
      if (criteria.minNetMargin !== undefined && (m.netMargin === null || m.netMargin < criteria.minNetMargin)) continue;
      if (criteria.maxNetMargin !== undefined && (m.netMargin === null || m.netMargin > criteria.maxNetMargin)) continue;
      if (criteria.minGrossMargin !== undefined && (m.grossMargin === null || m.grossMargin < criteria.minGrossMargin)) continue;
      if (criteria.minDebtToEquity !== undefined && (m.debtToEquity === null || m.debtToEquity < criteria.minDebtToEquity)) continue;
      if (criteria.maxDebtToEquity !== undefined && (m.debtToEquity === null || m.debtToEquity > criteria.maxDebtToEquity)) continue;
      if (criteria.minCurrentRatio !== undefined && (m.currentRatio === null || m.currentRatio < criteria.minCurrentRatio)) continue;
      if (criteria.maxCurrentRatio !== undefined && (m.currentRatio === null || m.currentRatio > criteria.maxCurrentRatio)) continue;
      if (criteria.minInterestCoverage !== undefined && (m.interestCoverage === null || m.interestCoverage < criteria.minInterestCoverage)) continue;
      if (criteria.minPeRatio !== undefined && (m.peRatio === null || m.peRatio < criteria.minPeRatio)) continue;
      if (criteria.maxPeRatio !== undefined && (m.peRatio === null || m.peRatio > criteria.maxPeRatio)) continue;
      if (criteria.minPbRatio !== undefined && (m.pbRatio === null || m.pbRatio < criteria.minPbRatio)) continue;
      if (criteria.maxPbRatio !== undefined && (m.pbRatio === null || m.pbRatio > criteria.maxPbRatio)) continue;
      if (criteria.minDividendYield !== undefined && (m.dividendYield === null || m.dividendYield < criteria.minDividendYield)) continue;
      if (criteria.minRevenue !== undefined && (m.revenueFromOperations === null || m.revenueFromOperations < criteria.minRevenue)) continue;
      if (criteria.minMarketCap !== undefined && (m.marketCap === null || m.marketCap < criteria.minMarketCap)) continue;
      if (criteria.maxMarketCap !== undefined && (m.marketCap === null || m.marketCap > criteria.maxMarketCap)) continue;
      if (criteria.minRevenueGrowth !== undefined && (m.revenueGrowth === null || m.revenueGrowth < criteria.minRevenueGrowth)) continue;
      if (criteria.minProfitGrowth !== undefined && (m.profitGrowth === null || m.profitGrowth < criteria.minProfitGrowth)) continue;
      if (criteria.minEpsGrowth !== undefined && (m.epsYoYGrowth === null || m.epsYoYGrowth < criteria.minEpsGrowth)) continue;

      results.push(m);

      if (criteria.limit && results.length >= criteria.limit) break;
    } catch (error) {
      logger.warn(`Failed to compute metrics for ${f.symbol}: ${(error as Error).message}`);
    }
  }

  return results;
}