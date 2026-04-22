import { Router } from 'express';
import mongoose from 'mongoose';
import { financialController } from '../controllers/financialController.js';
import { apiLimiter } from '../middleware/rateLimiter.js';
import { QuarterlyFinancial } from '../models/QuarterlyFinancial.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import axios from 'axios';

const router = Router();
router.use(apiLimiter);

router.get('/summary', financialController.getSummary);
router.get('/search', financialController.searchByMetrics);
router.get('/screener', financialController.getScreenerData);
router.post('/screener/run', financialController.runAdvancedScreener);
router.get('/import', financialController.importFinancials);

// Add the missing profile route
router.get('/profile/:symbol', financialController.getFinancialProfile);

router.get('/metrics/:symbol', financialController.getMetrics);
router.get('/metrics/:symbol/:year/:quarter', financialController.getQuarterlyMetrics);

router.get('/:symbol', financialController.getFinancials);
router.get('/:symbol/latest', financialController.getLatestFinancials);

router.get('/insight/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const cacheKey = `financials:insight:${symbol.toUpperCase()}`;
    
    const cachedData = await req.app.locals.redisClient?.get(cacheKey);
    if (cachedData) {
      return res.json(JSON.parse(cachedData));
    }

    const financials = await QuarterlyFinancial.find({ symbol: symbol.toUpperCase() })
      .sort({ year: -1, quarter: -1 })
      .limit(4)
      .lean();

    if (!financials.length) {
      return res.status(404).json({ error: 'No financial data found' });
    }

    const latest = financials[0];
    const financialSummary = {
      revenue: latest.revenueFromOperations,
      netProfit: latest.profitLossForPeriod,
      eps: latest.basicEarningsLossPerShareFromContinuingAndDiscontinuedOperations,
      totalEquity: latest.totalEquity,
      totalAssets: latest.totalAssets,
      roe: latest.totalEquity ? ((latest.profitLossForPeriod || 0) / latest.totalEquity * 100).toFixed(2) : null,
      roce: latest.totalAssets ? (((latest.profitLossBeforeTax || 0) + (latest.financeCosts || 0)) / ((latest.totalAssets - (latest.totalCurrentLiabilities || 0)) || 1) * 100).toFixed(2) : null,
      currentRatio: (latest.totalCurrentLiabilities && latest.totalCurrentAssets) ? (latest.totalCurrentAssets / latest.totalCurrentLiabilities).toFixed(2) : null,
      debtToEquity: latest.totalEquity ? (((latest.borrowingsCurrent || 0) + (latest.borrowingsNonCurrent || 0)) / latest.totalEquity).toFixed(2) : null,
      dividendPerShare: latest.dividendPerShare,
      bookValue: latest.faceValuePerShare,
    };

    let quote = null;
    let marketCap = null;
    let peRatio = null;

    try {
      const { MarketDataService } = await import('../services/marketDataService.js');
      quote = await MarketDataService.getQuote(symbol).catch(() => null);
      marketCap = quote?.marketCap;
      peRatio = quote?.peRatio;
    } catch (err) {
      logger.warn(`Failed to fetch quote for insight: ${(err as Error).message}`);
    }

    if (!config.ai.enabled || !config.ai.apiKey) {
      return res.json({
        summary: 'AI insights not configured. Please set up Grok API key.',
        keyInsights: [],
        quarterlyTrend: null,
      });
    }

    const prompt = `Analyze the following quarterly financial data for ${symbol} and provide investment insights:

Financial Summary:
- Revenue: ₹${financialSummary.revenue?.toLocaleString() || 'N/A'}
- Net Profit: ₹${financialSummary.netProfit?.toLocaleString() || 'N/A'}
- EPS: ₹${financialSummary.eps || 'N/A'}
- Total Equity: ₹${financialSummary.totalEquity?.toLocaleString() || 'N/A'}
- ROE: ${financialSummary.roe || 'N/A'}%
- ROCE: ${financialSummary.roce || 'N/A'}%
- Current Ratio: ${financialSummary.currentRatio || 'N/A'}
- Debt/Equity: ${financialSummary.debtToEquity || 'N/A'}
- Dividend/Share: ₹${financialSummary.dividendPerShare || 'N/A'}

Market Data:
- Market Cap: ₹${marketCap ? (marketCap / 1e7).toFixed(2) + 'Cr' : 'N/A'}
- P/E Ratio: ${peRatio || 'N/A'}

Provide a JSON response with:
{
  "summary": "2-3 sentence investment thesis based on fundamentals",
  "keyInsights": ["insight 1", "insight 2", "insight 3"],
  "quarterlyTrend": "Improving/Stable/Declining",
  "strengths": ["strength 1", "strength 2"],
  "concerns": ["concern 1", "concern 2"],
  "verdict": "Bullish/Bearish/Neutral"
}`;

    const response = await axios.post(
      `${config.ai.baseUrl.replace(/\/$/, '')}/chat/completions`,
      {
        model: config.ai.model,
        temperature: 0.3,
        messages: [
          { role: 'system', content: 'You are a financial analyst specializing in Indian stock markets. Provide data-driven insights from quarterly financial results.' },
          { role: 'user', content: prompt },
        ],
      },
      {
        timeout: config.ai.timeoutMs,
        headers: {
          Authorization: `Bearer ${config.ai.apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const content = response.data?.choices?.[0]?.message?.content;
    let insightData = {
      summary: 'Based on quarterly financial analysis',
      keyInsights: ['Data analysis complete'],
      quarterlyTrend: 'Stable',
      strengths: [],
      concerns: [],
      verdict: 'Neutral',
    };

    if (content) {
      try {
        insightData = { ...insightData, ...JSON.parse(content) };
      } catch (parseError) {
        logger.warn('Failed to parse AI insight response');
      }
    }

    const result = {
      symbol,
      ...insightData,
      financialSummary,
      marketCap,
      peRatio,
      generatedAt: new Date().toISOString(),
    };

    if (req.app.locals.redisClient) {
      await req.app.locals.redisClient.set(cacheKey, JSON.stringify(result), 300);
    }

    res.json(result);
  } catch (error) {
    logger.error(`Error generating financial insight: ${(error as Error).message}`);
    res.status(500).json({ error: 'Failed to generate insight' });
  }
});

router.get('/price-insight/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const cacheKey = `financials:price-insight:${symbol.toUpperCase()}`;
    
    let cachedData = null;
    try {
      cachedData = await req.app.locals.redisClient?.get(cacheKey);
    } catch (redisErr) {
      logger.warn('Redis not available for price insight cache');
    }
    if (cachedData) {
      return res.json(JSON.parse(cachedData));
    }

    if (!config.ai.enabled || !config.ai.apiKey) {
      return res.json({
        summary: 'AI insights not configured. Please set up Grok API key.',
        priceDrivers: [],
        forecast: null,
        catalysts: [],
        riskFactors: [],
        opportunity: '',
      });
    }

    let quote = null;
    let research = null;
    let relatedNews: any[] = [];

    const currentDate = new Date().toISOString().split('T')[0];

    try {
      const { MarketDataService } = await import('../services/marketDataService.js');
      [quote, research] = await Promise.all([
        MarketDataService.getQuote(symbol).catch(() => null),
        MarketDataService.getStockResearch(symbol).catch(() => null),
      ]);
    } catch (serviceErr) {
      logger.warn(`Service error fetching market data: ${(serviceErr as Error).message}`);
    }

    if (!quote) {
      return res.status(404).json({ error: 'Unable to fetch market data for this symbol' });
    }

    try {
      const { NewsService } = await import('../services/news.js');
      const allNews = await NewsService.getCuratedNews('all', undefined, 20);
      relatedNews = allNews.filter(n => 
        n.title.toLowerCase().includes(symbol.toLowerCase()) ||
        (research?.profile?.name && n.title.toLowerCase().includes((research.profile.name as string).toLowerCase().split(' ')[0]))
      ).slice(0, 5);
    } catch (newsErr) {
      logger.warn(`News fetch error: ${(newsErr as Error).message}`);
    }

    const newsText = relatedNews.length > 0 
      ? relatedNews.map(n => `${n.time}: ${n.title}`).join(' | ')
      : 'No recent news found';
    
    const marketContext = {
      currentDate,
      price: quote?.price,
      change: quote?.change,
      changePercent: quote?.changePercent,
      volume: quote?.volume,
      high52w: quote?.high52w,
      low52w: quote?.low52w,
      marketCap: quote?.marketCap,
      peRatio: quote?.peRatio,
      sector: research?.profile?.primarySector,
      momentum: research?.analytics?.momentumScore,
      rsi: research?.analytics?.rsi14,
      trend: research?.analytics?.trend,
      news: newsText,
    };

    const prompt = `Today's date is ${marketContext.currentDate}. Analyze ${symbol} (${research?.profile?.name || ''}) on NSE/BSE and explain WHY the price is moving.

CURRENT MARKET DATA:
- Price: ₹${marketContext.price || 'N/A'}
- Day Change: ₹${marketContext.change || 0} (${marketContext.changePercent || 0}%)
- Volume: ${marketContext.volume?.toLocaleString() || 'N/A'}
- 52W High: ₹${marketContext.high52w || 'N/A'}
- 52W Low: ₹${marketContext.low52w || 'N/A'}
- Market Cap: ₹${marketContext.marketCap ? (marketContext.marketCap / 1e7).toFixed(2) + 'Cr' : 'N/A'}
- P/E Ratio: ${marketContext.peRatio || 'N/A'}
- Sector: ${marketContext.sector || 'N/A'}
- Momentum: ${marketContext.momentum || 'N/A'}/100
- RSI: ${marketContext.rsi || 'N/A'}
- Trend: ${marketContext.trend || 'N/A'}

LATEST NEWS (${marketContext.currentDate}):
${marketContext.news}

Respond ONLY with this JSON (no extra text):
{
  "summary": "WHY price is moving + HOW it's changing (1-2 lines)",
  "priceDrivers": ["Main driver", "Secondary driver", "Market sentiment driver"],
  "catalysts": ["Upcoming event 1", "Upcoming event 2"],
  "forecast": "Bullish/Bearish/Consolidating",
  "riskFactors": ["Risk 1", "Risk 2"],
  "opportunity": "Trading opportunity"
}`;

    let insightData = {
      summary: 'Price movement analysis',
      priceDrivers: [],
      catalysts: [],
      forecast: 'Consolidating',
      riskFactors: [],
      opportunity: '',
    };

    try {
      logger.info(`Calling AI for price insight: ${symbol}`);
      const response = await axios.post(
        `${config.ai.baseUrl.replace(/\/$/, '')}/chat/completions`,
        {
          model: config.ai.model,
          temperature: 0.3,
          messages: [
            { role: 'system', content: 'You are an expert Indian stock market analyst. Explain WHY a stock is moving based on news, technicals, and market sentiment.' },
            { role: 'user', content: prompt },
          ],
        },
        {
          timeout: config.ai.timeoutMs,
          headers: {
            Authorization: `Bearer ${config.ai.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const content = response.data?.choices?.[0]?.message?.content;
      
      if (content) {
        try {
          const parsed = JSON.parse(content);
          insightData = { ...insightData, ...parsed };
          logger.info('Successfully parsed AI price insight response');
        } catch (parseError) {
          logger.warn('Failed to parse AI response, raw: ' + content.substring(0, 300));
          const fallback = { summary: content };
          insightData = { ...insightData, ...fallback };
        }
      } else {
        logger.warn('No content in AI response, full: ' + JSON.stringify(response.data).substring(0, 300));
      }
    } catch (aiError) {
      logger.error(`Grok API call failed: ${(aiError as Error).message}, response: ${(aiError as any).response?.data || 'no response'}`);
      insightData.summary = 'Unable to generate AI insight. Please try again later.';
    }

    const result = {
      symbol,
      priceData: {
        price: quote?.price,
        change: quote?.change,
        changePercent: quote?.changePercent,
        volume: quote?.volume,
        high52w: quote?.high52w,
        low52w: quote?.low52w,
      },
      ...insightData,
      generatedAt: new Date().toISOString(),
    };

    try {
      if (req.app.locals.redisClient) {
        await req.app.locals.redisClient.set(cacheKey, JSON.stringify(result), 180);
      }
    } catch (redisErr) {
      logger.warn('Redis not available for caching price insight');
    }

    res.json(result);
  } catch (error) {
    logger.error(`Error generating price insight: ${(error as Error).message}`);
    res.status(500).json({ error: 'Failed to generate price insight' });
  }
});

export default router;