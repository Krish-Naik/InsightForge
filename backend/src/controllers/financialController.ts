import { Request, Response } from 'express';
import { QuarterlyFinancial } from '../models/QuarterlyFinancial.js';
import { computeMetrics, searchStocksByMetrics } from '../services/financialMetricsService.js';
import { asyncHandler, AppError } from '../utils/helpers.js';
import { logger } from '../utils/logger.js';

export const financialController = {
  // Get all financials for a symbol
  getFinancials: asyncHandler(async (req: Request, res: Response) => {
    const { symbol } = req.params;
    const { year, quarter, consolidationType = 'Standalone' } = req.query;

    const query: any = {
      symbol: symbol.toUpperCase(),
      consolidationType: consolidationType as string,
    };

    if (year) query.year = parseInt(year as string);
    if (quarter) query.quarter = quarter as string;

    const financials = await QuarterlyFinancial.find(query)
      .sort({ year: -1, quarter: -1 })
      .limit(20)
      .lean();

    res.json({ success: true, data: financials });
  }),

  // Get latest financial data for a symbol
  getLatestFinancials: asyncHandler(async (req: Request, res: Response) => {
    const { symbol } = req.params;
    const { consolidationType = 'Standalone' } = req.query;

    const latest = await QuarterlyFinancial.findOne({
      symbol: symbol.toUpperCase(),
      consolidationType: consolidationType as string,
    })
      .sort({ year: -1, quarter: -1 })
      .lean();

    if (!latest) {
      throw new AppError('No financial data found for this symbol', 404);
    }

    res.json({ success: true, data: latest });
  }),

  // Get comprehensive metrics for a symbol
  getMetrics: asyncHandler(async (req: Request, res: Response) => {
    const { symbol } = req.params;
    const { year, consolidationType = 'Standalone' } = req.query;

    const metrics = await computeMetrics(
      symbol,
      year ? parseInt(year as string) : undefined,
      consolidationType as 'Standalone' | 'Consolidated'
    );

    if (!metrics) {
      throw new AppError('No metrics available for this symbol', 404);
    }

    res.json({ success: true, data: metrics });
  }),

  // Get quarterly metrics for a specific quarter
  getQuarterlyMetrics: asyncHandler(async (req: Request, res: Response) => {
    const { symbol, year, quarter } = req.params;
    const { consolidationType = 'Standalone' } = req.query;

    const financial = await QuarterlyFinancial.findOne({
      symbol: symbol.toUpperCase(),
      year: parseInt(year),
      quarter,
      consolidationType: consolidationType as string,
    }).lean();

    if (!financial) {
      throw new AppError('No data found for this quarter', 404);
    }

    // Get full metrics including price data
    const metrics = await computeMetrics(
      symbol,
      parseInt(year),
      consolidationType as 'Standalone' | 'Consolidated'
    );

    const quarterMetrics = metrics?.quarters.find(
      q => q.year === parseInt(year) && q.quarter === quarter
    );

    res.json({ success: true, data: quarterMetrics || financial });
  }),

  // Get financial profile (comprehensive data for stock story page)
  getFinancialProfile: asyncHandler(async (req: Request, res: Response) => {
    const { symbol } = req.params;
    const { consolidationType = 'Standalone' } = req.query;

    const metrics = await computeMetrics(
      symbol,
      undefined,
      consolidationType as 'Standalone' | 'Consolidated'
    );

    if (!metrics) {
      throw new AppError('No financial profile available for this symbol', 404);
    }

    // Format for stock story page
    const profile = {
      symbol: metrics.symbol,
      companyName: metrics.companyName,
      latest: metrics.latest,
      annual: metrics.annual,
      quarters: metrics.quarters.slice(0, 4), // Last 4 quarters
      
      // Summary metrics
      summary: {
        currentPrice: metrics.latest?.currentPrice,
        marketCap: metrics.latest?.marketCap,
        peRatio: metrics.latest?.peRatio,
        pbRatio: metrics.latest?.pbRatio,
        dividendYield: metrics.latest?.dividendYield,
        
        profitability: {
          roe: metrics.latest?.roe,
          roce: metrics.latest?.roce,
          roa: metrics.latest?.roa,
          netMargin: metrics.latest?.netMargin,
          grossMargin: metrics.latest?.grossMargin,
        },
        
        leverage: {
          debtToEquity: metrics.latest?.debtToEquity,
          currentRatio: metrics.latest?.currentRatio,
          quickRatio: metrics.latest?.quickRatio,
          interestCoverage: metrics.latest?.interestCoverage,
        },
        
        growth: {
          revenueGrowth: metrics.latest?.revenueGrowth,
          profitGrowth: metrics.latest?.profitGrowth,
          epsGrowth: metrics.latest?.epsYoYGrowth,
        },
        
        cashFlow: {
          operatingCashFlow: metrics.latest?.operatingCashFlow,
          freeCashFlow: metrics.latest?.freeCashFlow,
          cashConversion: metrics.latest?.cashConversion,
        },
      },
    };

    res.json({ success: true, data: profile });
  }),

  // Search by metrics (legacy endpoint)
  searchByMetrics: asyncHandler(async (req: Request, res: Response) => {
    const { minRoe, maxRoe, minRevenue, limit = '50' } = req.query;

    const criteria: any = { limit: parseInt(limit as string) };
    if (minRoe) criteria.minRoe = parseFloat(minRoe as string);
    if (maxRoe) criteria.maxRoe = parseFloat(maxRoe as string);
    if (minRevenue) criteria.minRevenue = parseFloat(minRevenue as string);

    const results = await searchStocksByMetrics(criteria);

    res.json({ success: true, data: results });
  }),

  // Get screener data (legacy endpoint)
  getScreenerData: asyncHandler(async (_req: Request, res: Response) => {
    const results = await searchStocksByMetrics({ limit: 100 });
    res.json({ success: true, data: results });
  }),

  // Run advanced screener with filter criteria
  runAdvancedScreener: asyncHandler(async (req: Request, res: Response) => {
    const filters = req.body;
    const criteria: any = { limit: filters.limit || 200 };
    
    if (filters.minPe) criteria.minPeRatio = filters.minPe;
    if (filters.maxPe) criteria.maxPeRatio = filters.maxPe;
    if (filters.minPb) criteria.minPbRatio = filters.minPb;
    if (filters.maxPb) criteria.maxPbRatio = filters.maxPb;
    if (filters.minRoe) criteria.minRoe = filters.minRoe;
    if (filters.maxRoe) criteria.maxRoe = filters.maxRoe;
    if (filters.minRoce) criteria.minRoce = filters.minRoce;
    if (filters.minRoa) criteria.minRoa = filters.minRoa;
    if (filters.minNetMargin) criteria.minNetMargin = filters.minNetMargin;
    if (filters.maxNetMargin) criteria.maxNetMargin = filters.maxNetMargin;
    if (filters.minGrossMargin) criteria.minGrossMargin = filters.minGrossMargin;
    if (filters.minDebtToEquity) criteria.minDebtToEquity = filters.minDebtToEquity;
    if (filters.maxDebtToEquity) criteria.maxDebtToEquity = filters.maxDebtToEquity;
    if (filters.minCurrentRatio) criteria.minCurrentRatio = filters.minCurrentRatio;
    if (filters.maxCurrentRatio) criteria.maxCurrentRatio = filters.maxCurrentRatio;
    if (filters.minInterestCoverage) criteria.minInterestCoverage = filters.minInterestCoverage;
    if (filters.minRevenueGrowth) criteria.minRevenueGrowth = filters.minRevenueGrowth;
    if (filters.minProfitGrowth) criteria.minProfitGrowth = filters.minProfitGrowth;
    if (filters.minEpsGrowth) criteria.minEpsGrowth = filters.minEpsGrowth;
    if (filters.minDividendYield) criteria.minDividendYield = filters.minDividendYield;
    if (filters.minMarketCap) criteria.minMarketCap = filters.minMarketCap;
    if (filters.maxMarketCap) criteria.maxMarketCap = filters.maxMarketCap;

    const results = await searchStocksByMetrics(criteria);
    res.json({ success: true, data: results });
  }),

  // Get summary statistics
  getSummary: asyncHandler(async (_req: Request, res: Response) => {
    const stats = await QuarterlyFinancial.aggregate([
      { $match: { consolidationType: 'Standalone' } },
      { $sort: { year: -1, quarter: -1 } },
      {
        $group: {
          _id: '$symbol',
          latest: { $first: '$$ROOT' },
        },
      },
      {
        $group: {
          _id: null,
          totalStocks: { $sum: 1 },
          avgRevenue: { $avg: '$latest.revenueFromOperations' },
          avgProfit: { $avg: '$latest.profitLossForPeriod' },
          totalRevenue: { $sum: '$latest.revenueFromOperations' },
        },
      },
    ]);

    res.json({ success: true, data: stats[0] || {} });
  }),

  // Import financials (placeholder)
  importFinancials: asyncHandler(async (_req: Request, res: Response) => {
    res.json({
      success: true,
      message: 'Import endpoint - not implemented in this version',
    });
  }),
};