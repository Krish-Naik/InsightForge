import axios from 'axios';
import { redisClient } from './redisService.js';

const FMP_API_KEY = process.env.FMP_API_KEY || '';
const FMP_BASE_URL = 'https://financialmodelingprep.com/api/v3';

interface FMPQuote {
  symbol: string;
  price: number;
  changesPercentage: number;
  change: number;
  dayLow: number;
  dayHigh: number;
  yearHigh: number;
  yearLow: number;
  marketCap: number;
  priceAvg50: number;
  priceAvg200: number;
  volume: number;
  avgVolume: number;
  open: number;
  previousClose: number;
  eps: number;
  pe: number;
  earningsAnnouncement: string;
  sharesOutstanding: number;
  timestamp: number;
}

interface IncomeStatement {
  date: string;
  symbol: string;
  reportedCurrency: string;
  cik: string;
  fillingDate: string;
  acceptedDate: string;
  calendarYear: string;
  period: string;
  revenue: number;
  costOfRevenue: number;
  grossProfit: number;
  grossProfitRatio: number;
  researchAndDevelopmentExpenses: number;
  generalAndAdministrativeExpenses: number;
  sellingAndMarketingExpenses: number;
  sellingGeneralAndAdministrativeExpenses: number;
  otherExpenses: number;
  operatingExpenses: number;
  costAndExpenses: number;
  interestIncome: number;
  interestExpense: number;
  depreciationAndAmortization: number;
  ebitda: number;
  ebitdaratio: number;
  operatingIncome: number;
  operatingIncomeRatio: number;
  totalOtherIncomeExpensesNet: number;
  incomeBeforeTax: number;
  incomeBeforeTaxRatio: number;
  incomeTaxExpense: number;
  netIncome: number;
  netIncomeRatio: number;
  eps: number;
  epsdiluted: number;
  weightedAverageShsOut: number;
  weightedAverageShsOutDil: number;
  link: string;
  finalLink: string;
}

interface BalanceSheet {
  date: string;
  symbol: string;
  reportedCurrency: string;
  cik: string;
  fillingDate: string;
  acceptedDate: string;
  calendarYear: string;
  period: string;
  cashAndCashEquivalents: number;
  shortTermInvestments: number;
  cashAndShortTermInvestments: number;
  netReceivables: number;
  inventory: number;
  otherCurrentAssets: number;
  totalCurrentAssets: number;
  propertyPlantEquipmentNet: number;
  goodwill: number;
  intangibleAssets: number;
  goodwillAndIntangibleAssets: number;
  longTermInvestments: number;
  taxAssets: number;
  otherNonCurrentAssets: number;
  totalNonCurrentAssets: number;
  otherAssets: number;
  totalAssets: number;
  accountPayables: number;
  shortTermDebt: number;
  taxPayables: number;
  deferredRevenue: number;
  otherCurrentLiabilities: number;
  totalCurrentLiabilities: number;
  longTermDebt: number;
  deferredRevenueNonCurrent: number;
  deferredTaxLiabilitiesNonCurrent: number;
  otherNonCurrentLiabilities: number;
  totalNonCurrentLiabilities: number;
  otherLiabilities: number;
  capitalLeaseObligations: number;
  totalLiabilities: number;
  preferredStock: number;
  commonStock: number;
  retainedEarnings: number;
  accumulatedOtherComprehensiveIncomeLoss: number;
  othertotalStockholdersEquity: number;
  totalStockholdersEquity: number;
  totalEquity: number;
  totalLiabilitiesAndStockholdersEquity: number;
  minorityInterest: number;
  totalLiabilitiesAndTotalEquity: number;
  totalInvestments: number;
  totalDebt: number;
  netDebt: number;
  link: string;
  finalLink: string;
}

interface CashFlowStatement {
  date: string;
  symbol: string;
  reportedCurrency: string;
  cik: string;
  fillingDate: string;
  acceptedDate: string;
  calendarYear: string;
  period: string;
  netIncome: number;
  depreciationAndAmortization: number;
  deferredIncomeTax: number;
  stockBasedCompensation: number;
  changeInWorkingCapital: number;
  accountsReceivables: number;
  inventory: number;
  accountsPayables: number;
  otherWorkingCapital: number;
  otherNonCashItems: number;
  netCashProvidedByOperatingActivities: number;
  investmentsInPropertyPlantAndEquipment: number;
  acquisitionsNet: number;
  purchasesOfInvestments: number;
  salesMaturitiesOfInvestments: number;
  otherInvestingActivites: number;
  netCashUsedForInvestingActivites: number;
  debtRepayment: number;
  commonStockIssued: number;
  commonStockRepurchased: number;
  dividendsPaid: number;
  otherFinancingActivites: number;
  netCashUsedProvidedByFinancingActivities: number;
  effectOfForexChangesOnCash: number;
  netChangeInCash: number;
  cashAtEndOfPeriod: number;
  cashAtBeginningOfPeriod: number;
  operatingCashFlow: number;
  capitalExpenditure: number;
  freeCashFlow: number;
  link: string;
  finalLink: string;
}

interface FinancialRatios {
  pe: number;
  pb: number;
  roe: number;
  roa: number;
  debtToEquity: number;
  currentRatio: number;
  quickRatio: number;
  eps: number;
  dividendYield: number;
  priceToSales: number;
  evToEbitda: number;
  profitMargin: number;
  operatingMargin: number;
  assetTurnover: number;
}

export class FMPService {
  private static buildUrl(endpoint: string, params: Record<string, string> = {}): string {
    const url = new URL(`${FMP_BASE_URL}${endpoint}`);
    url.searchParams.append('apikey', FMP_API_KEY);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
    return url.toString();
  }

  private static async fetchWithCache<T>(
    cacheKey: string,
    url: string,
    ttl: number = 3600
  ): Promise<T | null> {
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as T;
      }

      const response = await axios.get(url, { timeout: 10000 });
      const data = response.data;

      if (data && (Array.isArray(data) ? data.length > 0 : Object.keys(data).length > 0)) {
        await redisClient.set(cacheKey, JSON.stringify(data), ttl);
      }

      return data;
    } catch (error) {
      console.error(`FMP API Error for ${cacheKey}:`, error);
      return null;
    }
  }

  static async getQuote(symbol: string): Promise<FMPQuote | null> {
    const url = this.buildUrl(`/quote/${symbol}`);
    const data = await this.fetchWithCache<FMPQuote[]>(`fmp:quote:${symbol}`, url, 60);
    return data && data.length > 0 ? data[0] : null;
  }

  static async getIncomeStatement(symbol: string, period: 'annual' | 'quarter' = 'annual', limit: number = 5): Promise<IncomeStatement[]> {
    const url = this.buildUrl(`/income-statement/${symbol}`, { period, limit: limit.toString() });
    const data = await this.fetchWithCache<IncomeStatement[]>(`fmp:income:${symbol}:${period}:${limit}`, url, 86400);
    return data || [];
  }

  static async getBalanceSheet(symbol: string, period: 'annual' | 'quarter' = 'annual', limit: number = 5): Promise<BalanceSheet[]> {
    const url = this.buildUrl(`/balance-sheet-statement/${symbol}`, { period, limit: limit.toString() });
    const data = await this.fetchWithCache<BalanceSheet[]>(`fmp:balance:${symbol}:${period}:${limit}`, url, 86400);
    return data || [];
  }

  static async getCashFlowStatement(symbol: string, period: 'annual' | 'quarter' = 'annual', limit: number = 5): Promise<CashFlowStatement[]> {
    const url = this.buildUrl(`/cash-flow-statement/${symbol}`, { period, limit: limit.toString() });
    const data = await this.fetchWithCache<CashFlowStatement[]>(`fmp:cashflow:${symbol}:${period}:${limit}`, url, 86400);
    return data || [];
  }

  static calculateRatios(
    income: IncomeStatement[],
    balance: BalanceSheet[],
    quote: FMPQuote | null
  ): FinancialRatios | null {
    if (!income.length || !balance.length) return null;

    const latestIncome = income[0];
    const latestBalance = balance[0];
    const price = quote?.price || 0;

    const totalEquity = latestBalance.totalStockholdersEquity || 1;
    const totalAssets = latestBalance.totalAssets || 1;
    const totalDebt = latestBalance.totalDebt || 0;
    const currentAssets = latestBalance.totalCurrentAssets || 0;
    const currentLiabilities = latestBalance.totalCurrentLiabilities || 1;
    const inventory = latestBalance.inventory || 0;
    const revenue = latestIncome.revenue || 1;
    const netIncome = latestIncome.netIncome || 0;
    const eps = latestIncome.eps || 0;

    return {
      pe: eps !== 0 ? price / eps : 0,
      pb: totalEquity !== 0 ? (price * (quote?.sharesOutstanding || 1)) / totalEquity : 0,
      roe: totalEquity !== 0 ? (netIncome / totalEquity) * 100 : 0,
      roa: totalAssets !== 0 ? (netIncome / totalAssets) * 100 : 0,
      debtToEquity: totalEquity !== 0 ? totalDebt / totalEquity : 0,
      currentRatio: currentLiabilities !== 0 ? currentAssets / currentLiabilities : 0,
      quickRatio: currentLiabilities !== 0 ? (currentAssets - inventory) / currentLiabilities : 0,
      eps: eps,
      dividendYield: quote?.pe ? (1 / quote.pe) * 100 : 0,
      priceToSales: revenue !== 0 ? (price * (quote?.sharesOutstanding || 1)) / revenue : 0,
      evToEbitda: latestIncome.ebitda !== 0 ? ((price * (quote?.sharesOutstanding || 1)) + totalDebt - (latestBalance.cashAndCashEquivalents || 0)) / latestIncome.ebitda : 0,
      profitMargin: revenue !== 0 ? (netIncome / revenue) * 100 : 0,
      operatingMargin: latestIncome.operatingIncomeRatio * 100 || 0,
      assetTurnover: totalAssets !== 0 ? revenue / totalAssets : 0,
    };
  }

  static async getFinancials(symbol: string) {
    const [quote, income, balance, cashflow, quarterIncome] = await Promise.all([
      this.getQuote(symbol),
      this.getIncomeStatement(symbol, 'annual', 5),
      this.getBalanceSheet(symbol, 'annual', 5),
      this.getCashFlowStatement(symbol, 'annual', 5),
      this.getIncomeStatement(symbol, 'quarter', 8),
    ]);

    const ratios = this.calculateRatios(income, balance, quote);

    const analysis = income.length >= 2 ? {
      revenueGrowth: income[0].revenue && income[1].revenue 
        ? ((income[0].revenue - income[1].revenue) / income[1].revenue) * 100 
        : 0,
      profitGrowth: income[0].netIncome && income[1].netIncome
        ? ((income[0].netIncome - income[1].netIncome) / income[1].netIncome) * 100
        : 0,
      revenueGrowth5Y: income.length >= 5 && income[0].revenue && income[4].revenue
        ? ((income[0].revenue - income[4].revenue) / income[4].revenue) * 100
        : 0,
      profitGrowth5Y: income.length >= 5 && income[0].netIncome && income[4].netIncome
        ? ((income[0].netIncome - income[4].netIncome) / income[4].netIncome) * 100
        : 0,
    } : null;

    return {
      quote,
      income,
      balance,
      cashflow,
      quarters: quarterIncome,
      ratios,
      analysis,
    };
  }
}