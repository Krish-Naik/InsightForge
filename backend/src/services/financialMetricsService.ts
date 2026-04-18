import { QuarterlyFinancial } from '../models/QuarterlyFinancial.js';
import { logger } from '../utils/logger.js';

export interface FinancialMetrics {
  symbol: string;
  companyName: string;
  year: number;
  quarter: string;
  consolidationType: string;

  revenueFromOperations: number | null;
  profitAfterTax: number | null;
  totalAssets: number | null;
  totalEquity: number | null;
  totalLiabilities: number | null;
  borrowingsTotal: number | null;

  eps: number | null;
  epsYoYGrowth: number | null;
  bookValuePerShare: number | null;
  faceValuePerShare: number | null;

  roe: number | null;
  roeYoYGrowth: number | null;
  roce: number | null;
  roceYoYGrowth: number | null;
  roa: number | null;
  roaYoYGrowth: number | null;

  netMargin: number | null;
  netMarginYoYGrowth: number | null;
  grossMargin: number | null;

  debtToEquity: number | null;
  debtToEquityYoYGrowth: number | null;
  currentRatio: number | null;
  quickRatio: number | null;

  interestCoverage: number | null;
  assetTurnover: number | null;

  dividendPerShare: number | null;
  dividendYield: number | null;
  dividendPayoutRatio: number | null;

  operatingCashFlow: number | null;
  freeCashFlow: number | null;
  cashConversion: number | null;

  revenueGrowth: number | null;
  profitGrowth: number | null;
  assetGrowth: number | null;
  equityGrowth: number | null;

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
  if (revenue === null || costOfGoodsSold === null) return null;
  const grossProfit = revenue - costOfGoodsSold;
  if (revenue === 0) return null;
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

function calculateDividendYield(
  dividendPerShare: number | null,
  marketPrice: number | null
): number | null {
  if (dividendPerShare === null || marketPrice === null || marketPrice === 0) return null;
  return (dividendPerShare / marketPrice) * 100;
}

function calculateDividendPayoutRatio(
  dividendPerShare: number | null,
  eps: number | null
): number | null {
  if (dividendPerShare === null || eps === null || eps === 0) return null;
  return (dividendPerShare / eps) * 100;
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

export async function computeMetrics(
  symbol: string,
  year?: number,
  consolidationType: 'Standalone' | 'Consolidated' = 'Standalone'
): Promise<StockMetricsSummary | null> {
  const query: any = { symbol: symbol.toUpperCase(), consolidationType };
  if (year) query.year = year;

  const financials = await QuarterlyFinancial.find(query)
    .sort({ year: -1, quarter: -1 })
    .lean();

  if (financials.length === 0) {
    return null;
  }

  const companyName = financials[0].companyName;
  const quarters: FinancialMetrics[] = [];

  for (let i = 0; i < financials.length; i++) {
    const q = financials[i];
    const prev = financials[i + 1] || null;

    const revenue = q.revenueFromOperations;
    const netProfit = q.profitLossForPeriod;
    const totalAssets = q.totalAssets;
    const totalEquity = q.totalEquity;
    const totalLiabilities = q.totalLiabilities;
    const currentAssets = q.totalCurrentAssets;
    const currentLiabilities = q.totalCurrentLiabilities;
    const borrowings = (q.borrowingsCurrent || 0) + (q.borrowingsNonCurrent || 0);
    const financeCosts = q.financeCosts;
    const inventories = q.inventories;
    const tradeReceivables = q.tradeReceivablesCurrent;
    const tradePayables = q.tradePayablesCurrent;
    const cogs = q.costOfMaterialsConsumed;
    const basicEps = q.basicEarningsLossPerShareFromContinuingAndDiscontinuedOperations;
    const faceValue = q.faceValuePerShare;
    const sharesOutstanding = q.numberOfSharesOutstanding;
    const dividend = q.dividendPerShare;
    const operatingCashFlow = q.cashFlowsFromUsedInOperatingActivities;
    const freeCashFlow = q.freeCashFlow;

    const revenuePrev = prev?.revenueFromOperations;
    const profitPrev = prev?.profitLossForPeriod;
    const assetsPrev = prev?.totalAssets;
    const equityPrev = prev?.totalEquity;
    const epsPrev = prev?.basicEarningsLossPerShareFromContinuingAndDiscontinuedOperations;

    const bookValuePerShare = calculateBookValuePerShare(totalEquity, sharesOutstanding);
    const ebit = (q.profitLossBeforeTax || 0) + (financeCosts || 0);

    const metrics: FinancialMetrics = {
      symbol: q.symbol,
      companyName: q.companyName,
      year: q.year,
      quarter: q.quarter,
      consolidationType: q.consolidationType,

      revenueFromOperations: revenue,
      profitAfterTax: netProfit,
      totalAssets: totalAssets,
      totalEquity: totalEquity,
      totalLiabilities: totalLiabilities,
      borrowingsTotal: borrowings,

      eps: basicEps,
      epsYoYGrowth: calculateYoYGrowth(basicEps, epsPrev),
      bookValuePerShare: bookValuePerShare,
      faceValuePerShare: faceValue,

      roe: calculateRoe(netProfit, totalEquity),
      roeYoYGrowth: calculateYoYGrowth(
        calculateRoe(netProfit, totalEquity),
        calculateRoe(profitPrev, equityPrev)
      ),
      roce: calculateRoce(ebit, totalAssets, currentLiabilities),
      roceYoYGrowth: calculateYoYGrowth(
        calculateRoce(ebit, totalAssets, currentLiabilities),
        calculateRoce(
          ((prev?.profitLossBeforeTax || 0) + (prev?.financeCosts || 0)),
          prev?.totalAssets,
          prev?.totalCurrentLiabilities
        )
      ),
      roa: calculateRoa(netProfit, totalAssets),
      roaYoYGrowth: calculateYoYGrowth(
        calculateRoa(netProfit, totalAssets),
        calculateRoa(profitPrev, assetsPrev)
      ),

      netMargin: calculateNetMargin(netProfit, revenue),
      netMarginYoYGrowth: calculateYoYGrowth(
        calculateNetMargin(netProfit, revenue),
        calculateNetMargin(profitPrev, revenuePrev)
      ),
      grossMargin: calculateGrossMargin(revenue, cogs),

      debtToEquity: calculateDebtToEquity(borrowings, totalEquity),
      debtToEquityYoYGrowth: calculateYoYGrowth(
        calculateDebtToEquity(borrowings, totalEquity),
        calculateDebtToEquity(
          ((prev?.borrowingsCurrent || 0) + (prev?.borrowingsNonCurrent || 0)),
          prev?.totalEquity
        )
      ),
      currentRatio: calculateCurrentRatio(currentAssets, currentLiabilities),
      quickRatio: calculateQuickRatio(currentAssets, inventories, currentLiabilities),

      interestCoverage: calculateInterestCoverage(ebit, financeCosts),
      assetTurnover: calculateAssetTurnover(revenue, totalAssets),

      dividendPerShare: dividend,
      dividendYield: null,
      dividendPayoutRatio: calculateDividendPayoutRatio(dividend, basicEps),

      operatingCashFlow: operatingCashFlow,
      freeCashFlow: freeCashFlow,
      cashConversion: calculateCashConversion(operatingCashFlow, netProfit),

      revenueGrowth: calculateYoYGrowth(revenue, revenuePrev),
      profitGrowth: calculateYoYGrowth(netProfit, profitPrev),
      assetGrowth: calculateYoYGrowth(totalAssets, assetsPrev),
      equityGrowth: calculateYoYGrowth(totalEquity, equityPrev),

      receivablesDays: calculateReceivablesDays(tradeReceivables, revenue),
      inventoryDays: calculateInventoryDays(inventories, cogs),
      payableDays: calculatePayableDays(tradePayables, cogs),
      cashConversionCycle: calculateCashConversionCycle(
        calculateReceivablesDays(tradeReceivables, revenue),
        calculateInventoryDays(inventories, cogs),
        calculatePayableDays(tradePayables, cogs)
      ),

      updatedAt: q.updatedAt,
    };

    quarters.push(metrics);
  }

  const latest = quarters[0] || null;

  const annualData = quarters.reduce(
    (acc, q) => {
      if (q.revenueFromOperations) acc.totalRevenue += q.revenueFromOperations;
      if (q.profitAfterTax) acc.totalProfit += q.profitAfterTax;
      if (q.totalAssets) acc.totalAssets += q.totalAssets;
      if (q.totalEquity) acc.totalEquity += q.totalEquity;
      if (q.roe) acc.roeSum += q.roe;
      if (q.roce) acc.roceSum += q.roce;
      if (q.netMargin) acc.netMarginSum += q.netMargin;
      acc.count++;
      return acc;
    },
    {
      totalRevenue: 0,
      totalProfit: 0,
      totalAssets: 0,
      totalEquity: 0,
      roeSum: 0,
      roceSum: 0,
      netMarginSum: 0,
      count: 0,
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
      avgRoe: annualData.count > 0 ? annualData.roeSum / annualData.count : null,
      avgRoce: annualData.count > 0 ? annualData.roceSum / annualData.count : null,
      avgNetMargin: annualData.count > 0 ? annualData.netMarginSum / annualData.count : null,
    },
    quarters,
  };
}

export async function computeQuarterlyMetrics(
  symbol: string,
  year: number,
  quarter: string,
  consolidationType: 'Standalone' | 'Consolidated' = 'Standalone'
): Promise<FinancialMetrics | null> {
  const financials = await QuarterlyFinancial.findOne({
    symbol: symbol.toUpperCase(),
    year,
    quarter,
    consolidationType,
  }).lean();

  if (!financials) {
    return null;
  }

  const prevQuarterly = await QuarterlyFinancial.findOne({
    symbol: symbol.toUpperCase(),
    year: quarter === 'Q1' ? year - 1 : year,
    quarter: quarter === 'Q1' ? 'Q4' : `Q${parseInt(quarter.replace('Q', '')) - 1}` as any,
    consolidationType,
  }).lean();

  const result = await computeMetrics(symbol, year, consolidationType);
  return result?.latest || null;
}

export async function getAllStocksWithMetrics(
  filter?: {
    minRevenue?: number;
    minMarketCap?: number;
    sectors?: string[];
  },
  options?: {
    limit?: number;
    sortBy?: keyof FinancialMetrics;
    sortOrder?: 'asc' | 'desc';
  }
): Promise<FinancialMetrics[]> {
  const match: any = {};

  if (filter?.minRevenue) {
    match.revenueFromOperations = { $gte: filter.minRevenue };
  }

  const pipeline: any[] = [
    { $match: match },
    { $sort: { quarterEndDate: -1 } },
    {
      $group: {
        _id: { symbol: '$symbol', consolidationType: '$consolidationType' },
        doc: { $first: '$$ROOT' },
      },
    },
    { $replaceRoot: { newRoot: '$doc' } },
    { $limit: 100 },
  ];

  const financials = await QuarterlyFinancial.aggregate(pipeline);

  const results: FinancialMetrics[] = [];
  const processed = new Set<string>();

  for (const f of financials) {
    if (processed.has(f.symbol)) continue;
    processed.add(f.symbol);

    const result = await computeMetrics(f.symbol);
    if (result?.latest) {
      results.push(result.latest);
    }
  }

  return results.slice(0, options?.limit || 100);
}

export async function searchStocksByMetrics(criteria: {
  minRoe?: number;
  maxRoe?: number;
  minRoce?: number;
  maxRoce?: number;
  minNetMargin?: number;
  maxNetMargin?: number;
  minDebtToEquity?: number;
  maxDebtToEquity?: number;
  minCurrentRatio?: number;
  minDividendYield?: number;
  maxPe?: number;
  minRevenue?: number;
  limit?: number;
}): Promise<FinancialMetrics[]> {
  const match: any = {};

  const financials = await QuarterlyFinancial.find({
    consolidationType: 'Standalone',
    quarterEndDate: { $exists: true },
  })
    .sort({ quarterEndDate: -1 })
    .limit(criteria.limit || 100)
    .lean();

  const results: FinancialMetrics[] = [];
  const processed = new Set<string>();

  for (const f of financials) {
    const key = f.symbol;
    if (processed.has(key)) continue;
    processed.add(key);

    const result = await computeMetrics(f.symbol);
    if (!result?.latest) continue;

    const m = result.latest;

    if (criteria.minRoe !== undefined && (m.roe === null || m.roe < criteria.minRoe)) continue;
    if (criteria.maxRoe !== undefined && (m.roe === null || m.roe > criteria.maxRoe)) continue;
    if (criteria.minRoce !== undefined && (m.roce === null || m.roce < criteria.minRoce)) continue;
    if (criteria.maxRoce !== undefined && (m.roce === null || m.roce > criteria.maxRoce)) continue;
    if (criteria.minNetMargin !== undefined && (m.netMargin === null || m.netMargin < criteria.minNetMargin)) continue;
    if (criteria.maxNetMargin !== undefined && (m.netMargin === null || m.netMargin > criteria.maxNetMargin)) continue;
    if (criteria.minDebtToEquity !== undefined && (m.debtToEquity === null || m.debtToEquity < criteria.minDebtToEquity)) continue;
    if (criteria.maxDebtToEquity !== undefined && (m.debtToEquity === null || m.debtToEquity > criteria.maxDebtToEquity)) continue;
    if (criteria.minCurrentRatio !== undefined && (m.currentRatio === null || m.currentRatio < criteria.minCurrentRatio)) continue;
    if (criteria.minRevenue !== undefined && (m.revenueFromOperations === null || m.revenueFromOperations < criteria.minRevenue)) continue;

    results.push(m);

    if (criteria.limit && results.length >= criteria.limit) break;
  }

  return results;
}