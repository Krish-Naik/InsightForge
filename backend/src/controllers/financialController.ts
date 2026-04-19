import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { QuarterlyFinancial } from '../models/QuarterlyFinancial.js';
import { computeMetrics, computeQuarterlyMetrics, searchStocksByMetrics, type StockMetricsSummary, type FinancialMetrics } from '../services/financialMetricsService.js';
import { importAllQuarterlyFinancials, getFinancialSummary } from '../services/financialImportService.js';
import { logger } from '../utils/logger.js';

export const financialController = {
  async getFinancials(req: Request, res: Response) {
    try {
      const { symbol, year, quarter, consolidationType } = req.query;

      if (!symbol) {
        return res.status(400).json({ error: 'Symbol is required' });
      }

      const query: any = { symbol: (symbol as string).toUpperCase() };
      if (year) query.year = parseInt(year as string);
      if (quarter) query.quarter = quarter;
      if (consolidationType) query.consolidationType = consolidationType;

      const financials = await QuarterlyFinancial.find(query)
        .sort({ year: -1, quarter: -1 })
        .lean();

      res.json(financials);
    } catch (error) {
      logger.error(`Error getting financials: ${(error as Error).message}`);
      res.status(500).json({ error: 'Failed to fetch financials' });
    }
  },

  async getLatestFinancials(req: Request, res: Response) {
    try {
      const { symbol, consolidationType = 'Standalone' } = req.query;

      if (!symbol) {
        return res.status(400).json({ error: 'Symbol is required' });
      }

      const financials = await QuarterlyFinancial.findOne({
        symbol: (symbol as string).toUpperCase(),
        consolidationType,
      })
        .sort({ year: -1, quarter: -1 })
        .lean();

      res.json(financials);
    } catch (error) {
      logger.error(`Error getting latest financials: ${(error as Error).message}`);
      res.status(500).json({ error: 'Failed to fetch latest financials' });
    }
  },

  async getMetrics(req: Request, res: Response) {
    try {
      const { symbol: pathSymbol } = req.params;
      const { year, consolidationType = 'Standalone' } = req.query;

      if (!pathSymbol) {
        return res.status(400).json({ error: 'Symbol is required' });
      }

      const symbol = pathSymbol.toUpperCase();

      let metrics = await computeMetrics(
        symbol,
        year ? parseInt(year as string) : undefined,
        'Standalone'
      );

      if (!metrics) {
        metrics = await computeMetrics(
          symbol,
          year ? parseInt(year as string) : undefined,
          'Consolidated'
        );
      }

      if (!metrics) {
        return res.status(404).json({ error: 'No financial data found for symbol' });
      }

      res.json(metrics);
    } catch (error) {
      logger.error(`Error getting metrics: ${(error as Error).message}`, { stack: (error as Error).stack });
      res.status(500).json({ error: 'Failed to compute metrics' });
    }
  },

  async getQuarterlyMetrics(req: Request, res: Response) {
    try {
      const { symbol: pathSymbol, year, quarter } = req.params;
      const { consolidationType = 'Standalone' } = req.query;

      if (!pathSymbol || !year || !quarter) {
        return res.status(400).json({ error: 'Symbol, year, and quarter are required' });
      }

      const metrics = await computeQuarterlyMetrics(
        pathSymbol,
        parseInt(year),
        quarter,
        consolidationType as 'Standalone' | 'Consolidated'
      );

      if (!metrics) {
        return res.status(404).json({ error: 'No financial data found' });
      }

      res.json(metrics);
    } catch (error) {
      logger.error(`Error getting quarterly metrics: ${(error as Error).message}`);
      res.status(500).json({ error: 'Failed to compute quarterly metrics' });
    }
  },

  async searchByMetrics(req: Request, res: Response) {
    try {
      const criteria = req.query;
      const limit = criteria.limit ? parseInt(criteria.limit as string) : 50;

      const results = await searchStocksByMetrics({
        minRoe: criteria.minRoe ? parseFloat(criteria.minRoe as string) : undefined,
        maxRoe: criteria.maxRoe ? parseFloat(criteria.maxRoe as string) : undefined,
        minRoce: criteria.minRoce ? parseFloat(criteria.minRoce as string) : undefined,
        maxRoce: criteria.maxRoce ? parseFloat(criteria.maxRoce as string) : undefined,
        minNetMargin: criteria.minNetMargin ? parseFloat(criteria.minNetMargin as string) : undefined,
        maxNetMargin: criteria.maxNetMargin ? parseFloat(criteria.maxNetMargin as string) : undefined,
        minDebtToEquity: criteria.minDebtToEquity ? parseFloat(criteria.minDebtToEquity as string) : undefined,
        maxDebtToEquity: criteria.maxDebtToEquity ? parseFloat(criteria.maxDebtToEquity as string) : undefined,
        minCurrentRatio: criteria.minCurrentRatio ? parseFloat(criteria.minCurrentRatio as string) : undefined,
        minDividendYield: criteria.minDividendYield ? parseFloat(criteria.minDividendYield as string) : undefined,
        maxPe: criteria.maxPe ? parseFloat(criteria.maxPe as string) : undefined,
        minRevenue: criteria.minRevenue ? parseFloat(criteria.minRevenue as string) : undefined,
        limit,
      });

      res.json(results);
    } catch (error) {
      logger.error(`Error searching by metrics: ${(error as Error).message}`);
      res.status(500).json({ error: 'Failed to search stocks' });
    }
  },

  async importFinancials(req: Request, res: Response) {
    try {
      const { dataDir, limit, skipExisting = true, dryRun = false } = req.body;

      if (!dataDir) {
        return res.status(400).json({ error: 'dataDir is required' });
      }

      const result = await importAllQuarterlyFinancials(dataDir, {
        limit: limit ? parseInt(limit) : undefined,
        skipExisting,
        dryRun,
      });

      res.json(result);
    } catch (error) {
      logger.error(`Error importing financials: ${(error as Error).message}`);
      res.status(500).json({ error: 'Failed to import financials' });
    }
  },

  async getSummary(req: Request, res: Response) {
    try {
      const summary = await getFinancialSummary();
      res.json(summary);
    } catch (error) {
      logger.error(`Error getting summary: ${(error as Error).message}`);
      res.status(500).json({ error: 'Failed to get summary' });
    }
  },

  async getScreenerData(req: Request, res: Response) {
    try {
      const { symbols, filters, limit = 100 } = req.body;

      const match: any = {
        consolidationType: 'Standalone',
      };

      if (symbols && symbols.length > 0) {
        match.symbol = { $in: symbols };
      }

      const financials = await QuarterlyFinancial.aggregate([
        { $match: match },
        { $sort: { year: -1, quarter: -1 } },
        {
          $group: {
            _id: { symbol: '$symbol' },
            doc: { $first: '$$ROOT' },
          },
        },
        { $replaceRoot: { newRoot: '$doc' } },
        { $limit: parseInt(limit) + 100 },
      ]);

      const results: any[] = [];
      const processed = new Set<string>();

      for (const f of financials) {
        if (processed.has(f.symbol)) continue;
        processed.add(f.symbol);

        const metrics = await computeMetrics(f.symbol);
        if (!metrics?.latest) continue;

        let pass = true;
        if (filters) {
          for (const filter of filters) {
            const metricValue = metrics.latest[filter.metric as keyof typeof metrics.latest];
            const numValue = typeof metricValue === 'number' ? metricValue : (metricValue ? parseFloat(String(metricValue)) : null);
            if (numValue === null || isNaN(numValue)) {
              pass = false;
              break;
            }

            const filterNum = parseFloat(filter.value);
            switch (filter.operator) {
              case '>':
                pass = numValue > filterNum;
                break;
              case '<':
                pass = numValue < filterNum;
                break;
              case '>=':
                pass = numValue >= filterNum;
                break;
              case '<=':
                pass = numValue <= filterNum;
                break;
              case '=':
                pass = numValue === filterNum;
                break;
            }

            if (!pass) break;
          }
        }

        if (pass) {
          const entry: any = { ...metrics.latest };
          results.push(entry);
        }

        if (results.length >= parseInt(limit)) break;
      }

      res.json(results.slice(0, parseInt(limit)));
    } catch (error) {
      logger.error(`Error getting screener data: ${(error as Error).message}`);
      res.status(500).json({ error: 'Failed to get screener data' });
    }
  },
};