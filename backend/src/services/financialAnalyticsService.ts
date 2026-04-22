import { QuarterlyFinancial } from '../models/QuarterlyFinancial.js';
import { MarketDataService } from './marketDataService.js';
import { logger } from '../utils/logger.js';
import { redisClient } from './redisService.js';

export interface QuarterlyMetric {
  symbol: string;
  companyName: string;
  year: number;
  quarter: string;
  quarterEndDate: Date;
  consolidationType: string;

  revenue: number;
  revenueGrowth: number | null;
  otherIncome: number;
  totalExpenses: number;
  profitBeforeTax: number;
  profitAfterTax: number;
  taxExpense: number;
  effectiveTaxRate: number | null;

  eps: number;
  epsGrowth: number | null;
  profitGrowth: number | null;
  bookValuePerShare: number | null;
  faceValuePerShare: number | null;

  totalAssets: number;
  assetGrowth: number | null;
  totalEquity: number;
  equityGrowth: number | null;
  totalLiabilities: number;
  totalBorrowings: number;

  workingCapital: number | null;
  netFixedAssets: number | null;

  cashFlowFromOperations: number;
  cashFlowFromInvesting: number;
  cashFlowFromFinancing: number;
  freeCashFlow: number;
  operatingCashFlowToRevenue: number | null;

  roe: number | null;
  roce: number | null;
  roa: number | null;
  roic: number | null;

  netMargin: number | null;
  grossMargin: number | null;
  operatingMargin: number | null;
  preTaxMargin: number | null;

  debtToEquity: number | null;
  debtToAssets: number | null;
  currentRatio: number | null;
  quickRatio: number | null;
  cashRatio: number | null;
  interestCoverage: number | null;

  assetTurnover: number | null;
  inventoryTurnover: number | null;
  receivablesTurnover: number | null;
  payablesTurnover: number | null;
  workingCapitalTurnover: number | null;

  dividendPerShare: number | null;
  dividendYield: number | null;
  dividendPayoutRatio: number | null;
  dividendCoverageRatio: number | null;

  earningsYield: number | null;
  cashReturnOnEquity: number | null;

  updatedAt: Date;
}

export interface StockFinancialProfile {
  symbol: string;
  companyName: string;
  latestPrice: number | null;
  marketCap: number | null;
  peRatio: number | null;
  pbRatio: number | null;
  psRatio: number | null;
  evEbitda: number | null;
  evSales: number | null;

  latest: QuarterlyMetric | null;
  previous: QuarterlyMetric | null;
  yearAgo: QuarterlyMetric | null;

  quarters: QuarterlyMetric[];
  annualTrends: {
    revenue: { current: number; previous: number; growth: number | null } | null;
    profit: { current: number; previous: number; growth: number | null } | null;
    equity: { current: number; previous: number; growth: number | null } | null;
    assets: { current: number; previous: number; growth: number | null } | null;
  };

  ratios: {
    profitability: {
      roe: { latest: number | null; avg3Y: number | null; trend: 'improving' | 'declining' | 'stable' | null };
      roce: { latest: number | null; avg3Y: number | null; trend: 'improving' | 'declining' | 'stable' | null };
      roa: { latest: number | null; avg3Y: number | null; trend: 'improving' | 'declining' | 'stable' | null };
      netMargin: { latest: number | null; avg3Y: number | null; trend: 'improving' | 'declining' | 'stable' | null };
      grossMargin: { latest: number | null; avg3Y: number | null; trend: 'improving' | 'declining' | 'stable' | null };
    };
    leverage: {
      debtToEquity: { latest: number | null; trend: 'improving' | 'declining' | 'stable' | null };
      currentRatio: { latest: number | null; trend: 'improving' | 'declining' | 'stable' | null };
      interestCoverage: { latest: number | null; trend: 'improving' | 'declining' | 'stable' | null };
    };
    efficiency: {
      assetTurnover: { latest: number | null; trend: 'improving' | 'declining' | 'stable' | null };
      workingCapitalTurnover: { latest: number | null; trend: 'improving' | 'declining' | 'stable' | null };
    };
    dividend: {
      yield: { latest: number | null; trend: 'improving' | 'declining' | 'stable' | null };
      payout: { latest: number | null; trend: 'improving' | 'declining' | 'stable' | null };
    };
  };

  scores: {
    quality: number;
    growth: number;
    value: number;
    safety: number;
    overall: number;
  };

  updatedAt: Date;
}

export interface ScreenerStock {
  symbol: string;
  name: string;
  sector: string;
  currentPrice: number;
  marketCap: number;
  changePercent: number;

  price: number;
  volume: number;

  peRatio: number | null;
  pbRatio: number | null;
  psRatio: number | null;
  dividendYield: number | null;
  beta: number | null;

  eps: number | null;
  bookValuePerShare: number | null;
  revenue: number | null;
  profit: number | null;
  assets: number | null;
  equity: number | null;

  roe: number | null;
  roce: number | null;
  roa: number | null;
  netMargin: number | null;
  grossMargin: number | null;

  debtToEquity: number | null;
  currentRatio: number | null;
  quickRatio: number | null;
  interestCoverage: number | null;

  revenueGrowth: number | null;
  profitGrowth: number | null;
  epsGrowth: number | null;
  equityGrowth: number | null;

  dividendPayoutRatio: number | null;
  operatingCashFlow: number | null;
  freeCashFlow: number | null;

  score: number;
  lastUpdated: string;
}

function safeDivide(a: number | null, b: number | null, multiplier = 1): number | null {
  if (a === null || b === null || b === 0) return null;
  return (a / b) * multiplier;
}

function safeDiff(a: number | null, b: number | null): number | null {
  if (a === null || b === null) return null;
  return a - b;
}

function calculateYoYGrowth(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function calculateTrend(values: (number | null)[], threshold = 2): 'improving' | 'declining' | 'stable' | null {
  const valid = values.filter((v): v is number => v !== null);
  if (valid.length < 3) return null;

  const recent = valid.slice(0, 3);
  const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const change = recent[recent.length - 1] - recent[0];

  if (Math.abs(change) < threshold) return 'stable';
  return change > 0 ? 'improving' : 'declining';
}

function calculateQuarterlyMetrics(doc: any, prevDoc: any, yearAgoDoc: any): QuarterlyMetric {
  const revenue = doc.revenueFromOperations || 0;
  const prevRevenue = prevDoc?.revenueFromOperations || null;
  const yearAgoRevenue = yearAgoDoc?.revenueFromOperations || null;

  const profitAfterTax = doc.profitLossForPeriod || 0;
  const prevProfit = prevDoc?.profitLossForPeriod || null;
  const yearAgoProfit = yearAgoDoc?.profitLossForPeriod || null;

  const totalEquity = doc.totalEquity || 0;
  const prevEquity = prevDoc?.totalEquity || null;
  const yearAgoEquity = yearAgoDoc?.totalEquity || null;

  const totalAssets = doc.totalAssets || 0;
  const prevAssets = prevDoc?.totalAssets || null;
  const yearAgoAssets = yearAgoDoc?.totalAssets || null;

  const totalLiabilities = doc.totalLiabilities || 0;
  const totalBorrowings = (doc.borrowingsCurrent || 0) + (doc.borrowingsNonCurrent || 0);
  const totalCurrentAssets = doc.totalCurrentAssets || 0;
  const totalCurrentLiabilities = doc.totalCurrentLiabilities || 0;

  const sharesOutstanding = doc.numberOfSharesOutstanding;
  const faceValue = doc.faceValuePerShare;
  const basicEps = doc.basicEarningsLossPerShareFromContinuingAndDiscontinuedOperations;
  const prevEps = prevDoc?.basicEarningsLossPerShareFromContinuingAndDiscontinuedOperations || null;
  const yearAgoEps = yearAgoDoc?.basicEarningsLossPerShareFromContinuingAndDiscontinuedOperations || null;

  const profitBeforeTax = doc.profitLossBeforeTax || 0;
  const taxExpense = doc.taxExpense || 0;
  const financeCosts = doc.financeCosts || 0;

  const inventories = doc.inventories || 0;
  const tradeReceivables = doc.tradeReceivablesCurrent || 0;
  const tradePayables = doc.tradePayablesCurrent || 0;
  const costOfMaterials = doc.costOfMaterialsConsumed || 0;

  const cashFlowOps = doc.cashFlowsFromUsedInOperatingActivities || doc.netCashFlowsUsedInOperations || 0;
  const cashFlowInv = doc.cashFlowsFromUsedInInvestingActivities || doc.netCashFlowsUsedInInvestingActivities || 0;
  const cashFlowFin = doc.cashFlowsFromUsedInFinancingActivities || doc.netCashFlowsUsedInFinancingActivities || 0;
  const freeCashFlow = doc.freeCashFlow || (cashFlowOps + cashFlowInv);
  const dividendPerShare = doc.dividendPerShare || 0;

  const otherIncome = doc.otherIncome || 0;
  const totalExpenses = doc.totalExpenses || 0;

  const ebit = profitBeforeTax + financeCosts;
  const capitalEmployed = totalAssets - totalCurrentLiabilities;
  const investedCapital = totalEquity + totalBorrowings;

  return {
    symbol: doc.symbol,
    companyName: doc.companyName,
    year: doc.year,
    quarter: doc.quarter,
    quarterEndDate: doc.quarterEndDate,
    consolidationType: doc.consolidationType,

    revenue,
    revenueGrowth: calculateYoYGrowth(revenue, prevRevenue),
    otherIncome,
    totalExpenses,
    profitBeforeTax,
    profitAfterTax,
    taxExpense,
    effectiveTaxRate: safeDivide(taxExpense, profitBeforeTax),

    eps: basicEps || 0,
    epsGrowth: calculateYoYGrowth(basicEps, prevEps),
    profitGrowth: calculateYoYGrowth(profitAfterTax, prevProfit),
    bookValuePerShare: safeDivide(totalEquity, sharesOutstanding),
    faceValuePerShare: faceValue,

    totalAssets,
    assetGrowth: calculateYoYGrowth(totalAssets, prevAssets),
    totalEquity,
    equityGrowth: calculateYoYGrowth(totalEquity, prevEquity),
    totalLiabilities,
    totalBorrowings,

    workingCapital: safeDiff(totalCurrentAssets, totalCurrentLiabilities),
    netFixedAssets: doc.propertyPlantAndEquipment || null,

    cashFlowFromOperations: cashFlowOps,
    cashFlowFromInvesting: cashFlowInv,
    cashFlowFromFinancing: cashFlowFin,
    freeCashFlow,
    operatingCashFlowToRevenue: safeDivide(cashFlowOps, revenue, 100),

    roe: safeDivide(profitAfterTax, totalEquity, 100),
    roce: safeDivide(ebit, capitalEmployed, 100),
    roa: safeDivide(profitAfterTax, totalAssets, 100),
    roic: safeDivide(profitAfterTax, investedCapital, 100),

    netMargin: safeDivide(profitAfterTax, revenue, 100),
    grossMargin: safeDivide(revenue - costOfMaterials, revenue, 100),
    operatingMargin: safeDivide(ebit, revenue, 100),
    preTaxMargin: safeDivide(profitBeforeTax, revenue, 100),

    debtToEquity: safeDivide(totalBorrowings, totalEquity),
    debtToAssets: safeDivide(totalBorrowings, totalAssets),
    currentRatio: safeDivide(totalCurrentAssets, totalCurrentLiabilities),
    quickRatio: safeDivide(totalCurrentAssets - inventories, totalCurrentLiabilities),
    cashRatio: safeDivide(doc.cashAndCashEquivalents, totalCurrentLiabilities),
    interestCoverage: safeDivide(ebit, financeCosts),

    assetTurnover: safeDivide(revenue, totalAssets),
    inventoryTurnover: safeDivide(costOfMaterials, inventories),
    receivablesTurnover: safeDivide(revenue, tradeReceivables),
    payablesTurnover: safeDivide(costOfMaterials, tradePayables),
    workingCapitalTurnover: safeDivide(revenue, totalCurrentAssets - totalCurrentLiabilities),

    dividendPerShare,
    dividendYield: null,
    dividendPayoutRatio: safeDivide(dividendPerShare, basicEps, 100),
    dividendCoverageRatio: safeDivide(basicEps, dividendPerShare),

    earningsYield: safeDivide(basicEps, 1, 100),
    cashReturnOnEquity: safeDivide(cashFlowOps, totalEquity, 100),

    updatedAt: doc.updatedAt,
  };
}

export class FinancialAnalyticsService {
  private static async getQuoteWithFallback(symbol: string) {
    try {
      return await MarketDataService.getQuote(symbol);
    } catch {
      return null;
    }
  }

  static async getStockFinancialProfile(
    symbol: string,
    consolidationType?: 'Standalone' | 'Consolidated'
  ): Promise<StockFinancialProfile | null> {
    const effectiveType = consolidationType || 'Standalone';
    const cacheKey = `financial:profile:${symbol}:${effectiveType}`;
    
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err) {
      logger.warn(`Redis cache read failed for ${symbol}: ${(err as Error).message}`);
    }

    try {
      const financials = await QuarterlyFinancial.find({
        symbol: symbol.toUpperCase(),
        consolidationType: effectiveType,
      })
        .sort({ year: -1, quarter: -1 })
        .limit(8)
        .lean();

if (financials.length === 0) {
          if (consolidationType === undefined) {
            const altType = effectiveType === 'Standalone' ? 'Consolidated' : 'Standalone';
            const altFinancials = await QuarterlyFinancial.find({
              symbol: symbol.toUpperCase(),
              consolidationType: altType,
            })
              .sort({ year: -1, quarter: -1 })
              .limit(8)
              .lean();

            if (altFinancials.length > 0) {
              const profile = this.buildProfile(symbol, altFinancials);
              try {
                await redisClient.set(cacheKey, JSON.stringify(profile), 3600);
              } catch (err) {
                logger.warn(`Redis cache write failed for ${symbol}: ${(err as Error).message}`);
              }
              return profile;
            }
          }
          return null;
        }

        const quote = await this.getQuoteWithFallback(symbol);
        const profile = this.buildProfile(symbol, financials, quote);
        try {
          await redisClient.set(cacheKey, JSON.stringify(profile), 3600);
        } catch (err) {
          logger.warn(`Redis cache write failed for ${symbol}: ${(err as Error).message}`);
        }

        return profile;
    } catch (error) {
      logger.error(`Error in getStockFinancialProfile for ${symbol}: ${(error as Error).message}`);
      return null;
    }
  }

  private static buildProfile(symbol: string, financials: any[], quote: any = null): StockFinancialProfile {
    const quarters: QuarterlyMetric[] = [];

    for (let i = 0; i < financials.length; i++) {
      const doc = financials[i];
      const prevDoc = financials[i + 1] || null;
      const yearAgoDoc = i + 4 < financials.length ? financials[i + 4] : null;
      quarters.push(calculateQuarterlyMetrics(doc, prevDoc, yearAgoDoc));
    }

    const latest = quarters[0] || null;
    const previous = quarters[1] || null;
    const yearAgo = quarters[4] || null;

    const quoteMetrics = quote ? {
      price: quote.price,
      marketCap: quote.marketCap,
      peRatio: quote.peRatio ?? null,
      pbRatio: quote.priceToBook ?? null,
    } : null;

    const annualTrends = {
      revenue: latest && previous ? {
        current: latest.revenue,
        previous: previous.revenue,
        growth: calculateYoYGrowth(latest.revenue, previous.revenue),
      } : null,
      profit: latest && previous ? {
        current: latest.profitAfterTax,
        previous: previous.profitAfterTax,
        growth: calculateYoYGrowth(latest.profitAfterTax, previous.profitAfterTax),
      } : null,
      equity: latest && previous ? {
        current: latest.totalEquity,
        previous: previous.totalEquity,
        growth: calculateYoYGrowth(latest.totalEquity, previous.totalEquity),
      } : null,
      assets: latest && previous ? {
        current: latest.totalAssets,
        previous: previous.totalAssets,
        growth: calculateYoYGrowth(latest.totalAssets, previous.totalAssets),
      } : null,
    };

    const roeValues = quarters.slice(0, 4).map(q => q.roe).filter((v): v is number => v !== null);
    const roceValues = quarters.slice(0, 4).map(q => q.roce).filter((v): v is number => v !== null);
    const roaValues = quarters.slice(0, 4).map(q => q.roa).filter((v): v is number => v !== null);
    const netMarginValues = quarters.slice(0, 4).map(q => q.netMargin).filter((v): v is number => v !== null);
    const grossMarginValues = quarters.slice(0, 4).map(q => q.grossMargin).filter((v): v is number => v !== null);

    const debtToEquityValues = quarters.slice(0, 4).map(q => q.debtToEquity).filter((v): v is number => v !== null);
    const currentRatioValues = quarters.slice(0, 4).map(q => q.currentRatio).filter((v): v is number => v !== null);
    const interestCoverageValues = quarters.slice(0, 4).map(q => q.interestCoverage).filter((v): v is number => v !== null);

    const scores = this.calculateScores(latest, previous, yearAgo, quoteMetrics);

    return {
      symbol: symbol.toUpperCase(),
      companyName: financials[0].companyName,
      latestPrice: quote?.price || null,
      marketCap: quote?.marketCap || null,
      peRatio: quote?.peRatio || null,
      pbRatio: quote?.priceToBook || null,
      psRatio: quote?.marketCap && latest?.revenue ? quote.marketCap / latest.revenue : null,
      evEbitda: null,
      evSales: null,
      latest,
      previous,
      yearAgo,
      quarters,
      annualTrends,
      ratios: {
        profitability: {
          roe: { latest: latest?.roe || null, avg3Y: roeValues.length >= 3 ? roeValues.reduce((a, b) => a + b, 0) / roeValues.length : null, trend: calculateTrend(roeValues) },
          roce: { latest: latest?.roce || null, avg3Y: roceValues.length >= 3 ? roceValues.reduce((a, b) => a + b, 0) / roceValues.length : null, trend: calculateTrend(roceValues) },
          roa: { latest: latest?.roa || null, avg3Y: roaValues.length >= 3 ? roaValues.reduce((a, b) => a + b, 0) / roaValues.length : null, trend: calculateTrend(roaValues) },
          netMargin: { latest: latest?.netMargin || null, avg3Y: netMarginValues.length >= 3 ? netMarginValues.reduce((a, b) => a + b, 0) / netMarginValues.length : null, trend: calculateTrend(netMarginValues) },
          grossMargin: { latest: latest?.grossMargin || null, avg3Y: grossMarginValues.length >= 3 ? grossMarginValues.reduce((a, b) => a + b, 0) / grossMarginValues.length : null, trend: calculateTrend(grossMarginValues) },
        },
        leverage: {
          debtToEquity: { latest: latest?.debtToEquity || null, trend: calculateTrend(debtToEquityValues, 0.1) },
          currentRatio: { latest: latest?.currentRatio || null, trend: calculateTrend(currentRatioValues, 0.1) },
          interestCoverage: { latest: latest?.interestCoverage || null, trend: calculateTrend(interestCoverageValues, 5) },
        },
        efficiency: {
          assetTurnover: { latest: latest?.assetTurnover || null, trend: null },
          workingCapitalTurnover: { latest: latest?.workingCapitalTurnover || null, trend: null },
        },
        dividend: {
          yield: { latest: latest?.dividendYield || null, trend: null },
          payout: { latest: latest?.dividendPayoutRatio || null, trend: null },
        },
      },
      scores,
      updatedAt: new Date(),
    };
  }

  private static calculateScores(
    latest: QuarterlyMetric | null,
    previous: QuarterlyMetric | null,
    yearAgo: QuarterlyMetric | null,
    quote: { price: number; marketCap: number; peRatio: number | null; pbRatio: number | null } | null
  ): { quality: number; growth: number; value: number; safety: number; overall: number } {
    let quality = 50;
    let growth = 50;
    let value = 50;
    let safety = 50;

    if (latest) {
      if (latest.roe && latest.roe > 20) quality += 20;
      else if (latest.roe && latest.roe > 15) quality += 10;
      else if (latest.roe && latest.roe < 10) quality -= 15;

      if (latest.roce && latest.roce > 20) quality += 10;
      if (latest.currentRatio && latest.currentRatio > 1.5) safety += 10;
      else if (latest.currentRatio && latest.currentRatio < 1) safety -= 10;

      if (latest.debtToEquity !== null && latest.debtToEquity < 0.5) safety += 15;
      else if (latest.debtToEquity !== null && latest.debtToEquity > 1) safety -= 15;

      if (latest.interestCoverage !== null && latest.interestCoverage > 5) safety += 10;
      else if (latest.interestCoverage !== null && latest.interestCoverage < 2) safety -= 15;

      if (latest.revenueGrowth && latest.revenueGrowth > 15) growth += 20;
      else if (latest.revenueGrowth && latest.revenueGrowth > 10) growth += 10;
      else if (latest.revenueGrowth && latest.revenueGrowth < 0) growth -= 10;

      if (latest.profitGrowth && latest.profitGrowth > 15) growth += 15;
      else if (latest.profitGrowth && latest.profitGrowth > 10) growth += 10;
      else if (latest.profitGrowth && latest.profitGrowth < 0) growth -= 10;

      if (latest.epsGrowth && latest.epsGrowth > 15) growth += 10;
    }

    if (quote) {
      if (quote.peRatio !== null && quote.peRatio < 15) value += 20;
      else if (quote.peRatio !== null && quote.peRatio < 20) value += 10;
      else if (quote.peRatio !== null && quote.peRatio > 40) value -= 15;

      if (quote.pbRatio !== null && quote.pbRatio < 2) value += 15;
      else if (quote.pbRatio !== null && quote.pbRatio > 5) value -= 10;
    }

    quality = Math.max(0, Math.min(100, quality));
    growth = Math.max(0, Math.min(100, growth));
    value = Math.max(0, Math.min(100, value));
    safety = Math.max(0, Math.min(100, safety));

    const overall = Math.round((quality * 0.3 + growth * 0.25 + value * 0.2 + safety * 0.25));

    return { quality, growth, value, safety, overall };
  }

  static async runScreener(filters: {
    minPrice?: number;
    maxPrice?: number;
    minMarketCap?: number;
    maxMarketCap?: number;
    minPe?: number;
    maxPe?: number;
    minPb?: number;
    maxPb?: number;
    minRoe?: number;
    maxRoe?: number;
    minRoce?: number;
    minRoa?: number;
    minNetMargin?: number;
    maxNetMargin?: number;
    minGrossMargin?: number;
    minDebtToEquity?: number;
    maxDebtToEquity?: number;
    minCurrentRatio?: number;
    maxCurrentRatio?: number;
    minInterestCoverage?: number;
    minRevenueGrowth?: number;
    minProfitGrowth?: number;
    minEpsGrowth?: number;
    minDividendYield?: number;
    minDividendPayout?: number;
    minOperatingCashFlow?: number;
    sector?: string;
    limit?: number;
  }): Promise<ScreenerStock[]> {
    const { MarketUniverseService } = await import('./marketUniverseService.js');
    
    let symbols: string[] = [];
    
    if (filters.sector && filters.sector !== 'all') {
      const sectorStocks = await MarketUniverseService.getStocksBySector(filters.sector, 200);
      symbols = sectorStocks.map(s => s.symbol);
    } else {
      const universe = await MarketUniverseService.getUniverse();
      symbols = universe.slice(0, 500).map(s => s.symbol);
    }

    const results: ScreenerStock[] = [];
    const quotes = await MarketDataService.getQuotes(symbols.slice(0, 100));
    const quoteMap = new Map(quotes.map(q => [q.symbol, q]));

    const symbolsWithFinancials = await QuarterlyFinancial.distinct('symbol', {});
    const financialSymbols = new Set(symbolsWithFinancials.map(s => s.toString()));

    const filteredSymbols = symbols.filter(s => financialSymbols.has(s.toUpperCase())).slice(0, filters.limit || 100);

    const profilePromises = filteredSymbols.map(async (symbol) => {
      try {
        const profile = await this.getStockFinancialProfile(symbol);
        if (!profile) return null;

        const quote = quoteMap.get(symbol.toUpperCase());
        const latest = profile.latest;

        if (!latest) return null;

        if (filters.minPrice && (!quote || quote.price < filters.minPrice)) return null;
        if (filters.maxPrice && (!quote || quote.price > filters.maxPrice)) return null;
        if (filters.minMarketCap && (!quote || !quote.marketCap || quote.marketCap < filters.minMarketCap)) return null;
        if (filters.maxMarketCap && (!quote || !quote.marketCap || quote.marketCap > filters.maxMarketCap)) return null;

        if (filters.minPe && (profile.peRatio === null || profile.peRatio > filters.minPe)) return null;
        if (filters.maxPe && (profile.peRatio === null || profile.peRatio < filters.maxPe)) return null;
        if (filters.minPb && (profile.pbRatio === null || profile.pbRatio > filters.minPb)) return null;
        if (filters.maxPb && (profile.pbRatio === null || profile.pbRatio < filters.maxPb)) return null;

        if (filters.minRoe && (latest.roe === null || latest.roe < filters.minRoe)) return null;
        if (filters.maxRoe && (latest.roe === null || latest.roe > filters.maxRoe)) return null;
        if (filters.minRoce && (latest.roce === null || latest.roce < filters.minRoce)) return null;
        if (filters.minRoa && (latest.roa === null || latest.roa < filters.minRoa)) return null;

        if (filters.minNetMargin && (latest.netMargin === null || latest.netMargin < filters.minNetMargin)) return null;
        if (filters.maxNetMargin && (latest.netMargin === null || latest.netMargin > filters.maxNetMargin)) return null;
        if (filters.minGrossMargin && (latest.grossMargin === null || latest.grossMargin < filters.minGrossMargin)) return null;

        if (filters.minDebtToEquity && (latest.debtToEquity === null || latest.debtToEquity < filters.minDebtToEquity)) return null;
        if (filters.maxDebtToEquity && (latest.debtToEquity === null || latest.debtToEquity > filters.maxDebtToEquity)) return null;
        if (filters.minCurrentRatio && (latest.currentRatio === null || latest.currentRatio < filters.minCurrentRatio)) return null;
        if (filters.maxCurrentRatio && (latest.currentRatio === null || latest.currentRatio > filters.maxCurrentRatio)) return null;

        if (filters.minInterestCoverage && (latest.interestCoverage === null || latest.interestCoverage < filters.minInterestCoverage)) return null;

        if (filters.minRevenueGrowth && (latest.revenueGrowth === null || latest.revenueGrowth < filters.minRevenueGrowth)) return null;
        if (filters.minProfitGrowth && (latest.profitGrowth === null || latest.profitGrowth < filters.minProfitGrowth)) return null;
        if (filters.minEpsGrowth && (latest.epsGrowth === null || latest.epsGrowth < filters.minEpsGrowth)) return null;

        if (filters.minDividendYield && (latest.dividendYield === null || latest.dividendYield < filters.minDividendYield)) return null;
        if (filters.minDividendPayout && (latest.dividendPayoutRatio === null || latest.dividendPayoutRatio < filters.minDividendPayout)) return null;

        if (filters.minOperatingCashFlow && (latest.cashFlowFromOperations === null || latest.cashFlowFromOperations < filters.minOperatingCashFlow)) return null;

        const screenerStock: ScreenerStock = {
          symbol: profile.symbol,
          name: profile.companyName,
          sector: 'NSE',
          currentPrice: quote?.price || 0,
          marketCap: quote?.marketCap || 0,
          changePercent: quote?.changePercent || 0,

          price: quote?.price || 0,
          volume: quote?.volume || 0,

          peRatio: profile.peRatio,
          pbRatio: profile.pbRatio,
          psRatio: profile.psRatio,
          dividendYield: latest.dividendYield,
          beta: null,

          eps: latest.eps,
          bookValuePerShare: latest.bookValuePerShare,
          revenue: latest.revenue,
          profit: latest.profitAfterTax,
          assets: latest.totalAssets,
          equity: latest.totalEquity,

          roe: latest.roe,
          roce: latest.roce,
          roa: latest.roa,
          netMargin: latest.netMargin,
          grossMargin: latest.grossMargin,

          debtToEquity: latest.debtToEquity,
          currentRatio: latest.currentRatio,
          quickRatio: latest.quickRatio,
          interestCoverage: latest.interestCoverage,

          revenueGrowth: latest.revenueGrowth,
          profitGrowth: latest.profitGrowth,
          epsGrowth: latest.epsGrowth,
          equityGrowth: latest.equityGrowth,

          dividendPayoutRatio: latest.dividendPayoutRatio,
          operatingCashFlow: latest.cashFlowFromOperations,
          freeCashFlow: latest.freeCashFlow,

          score: profile.scores.overall,
          lastUpdated: profile.updatedAt.toISOString(),
        };

        return screenerStock;
      } catch (error) {
        logger.warn(`Error processing ${symbol} in screener: ${(error as Error).message}`);
        return null;
      }
    });

    const screenerResults = await Promise.all(profilePromises);
    
    for (const stock of screenerResults) {
      if (stock) {
        results.push(stock);
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, filters.limit || 100);
  }

  static async getAvailableSectors(): Promise<string[]> {
    const sectors = await QuarterlyFinancial.distinct('symbol');
    return Array.from(sectors);
  }
}
