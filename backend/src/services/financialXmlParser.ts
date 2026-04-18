import { XMLParser } from 'fast-xml-parser';
import axios from 'axios';
import { logger } from '../utils/logger.js';

interface ParsedFinancialData {
  symbol: string;
  companyName: string;
  quarterEndDate: Date;
  filingType: 'Original' | 'Revision';
  auditStatus: 'Audited' | 'Un-Audited';
  consolidationType: 'Consolidated' | 'Standalone';
  xbrlUrl: string;
  detailsUrl: string;
  broadcastDateTime: Date;
  revisedDateTime?: Date;
  revisionRemarks?: string;
  exchangeDisseminationTime?: Date;

  revenueFromOperations: number | null;
  revenueFromOperationsPreviousYear: number | null;
  otherIncome: number | null;
  otherIncomePreviousYear: number | null;
  totalRevenue: number | null;
  totalRevenuePreviousYear: number | null;

  costOfMaterialsConsumed: number | null;
  costOfMaterialsConsumedPreviousYear: number | null;
  changesInInventoriesOfFinishedGoodsWorkInProgressAndStockInTrade: number | null;
  changesInInventoriesOfFinishedGoodsWorkInProgressAndStockInTradePreviousYear: number | null;
  employeeBenefitsExpense: number | null;
  employeeBenefitsExpensePreviousYear: number | null;
  financeCosts: number | null;
  financeCostsPreviousYear: number | null;
  depreciationAndAmortisationExpense: number | null;
  depreciationAndAmortisationExpensePreviousYear: number | null;
  otherExpenses: number | null;
  otherExpensesPreviousYear: number | null;
  totalExpenses: number | null;
  totalExpensesPreviousYear: number | null;

  profitLossBeforeExceptionalItemsAndTax: number | null;
  profitLossBeforeExceptionalItemsAndTaxPreviousYear: number | null;
  exceptionalItems: number | null;
  exceptionalItemsPreviousYear: number | null;
  profitLossBeforeTax: number | null;
  profitLossBeforeTaxPreviousYear: number | null;
  taxExpense: number | null;
  taxExpensePreviousYear: number | null;
  currentTax: number | null;
  currentTaxPreviousYear: number | null;
  deferredTax: number | null;
  deferredTaxPreviousYear: number | null;
  profitLossForPeriodFromContinuingOperations: number | null;
  profitLossForPeriodFromContinuingOperationsPreviousYear: number | null;
  profitLossFromDiscontinuedOperationsBeforeTax: number | null;
  profitLossFromDiscontinuedOperationsBeforeTaxPreviousYear: number | null;
  taxExpenseDiscontinuedOperations: number | null;
  profitLossFromDiscontinuedOperationsAfterTax: number | null;
  profitLossFromDiscontinuedOperationsAfterTaxPreviousYear: number | null;
  profitLossForPeriod: number | null;
  profitLossForPeriodPreviousYear: number | null;
  profitOrLossAttributableToOwnersOfParent: number | null;
  profitOrLossAttributableToOwnersOfParentPreviousYear: number | null;
  profitOrLossAttributableToNonControllingInterests: number | null;
  profitOrLossAttributableToNonControllingInterestsPreviousYear: number | null;
  comprehensiveIncomeForThePeriod: number | null;
  comprehensiveIncomeForThePeriodPreviousYear: number | null;
  comprehensiveIncomeAttributableToOwnersOfParent: number | null;
  comprehensiveIncomeAttributableToNonControllingInterests: number | null;
  totalComprehensiveIncome: number | null;
  totalComprehensiveIncomePreviousYear: number | null;

  basicEarningsPerShareFromContinuingOperations: number | null;
  basicEarningsPerShareFromContinuingOperationsPreviousYear: number | null;
  basicEarningsPerShareFromDiscontinuedOperations: number | null;
  basicEarningsPerShareFromDiscontinuedOperationsPreviousYear: number | null;
  basicEarningsLossPerShareFromContinuingAndDiscontinuedOperations: number | null;
  basicEarningsLossPerShareFromContinuingAndDiscontinuedOperationsPreviousYear: number | null;
  dilutedEarningsPerShareFromContinuingOperations: number | null;
  dilutedEarningsPerShareFromContinuingOperationsPreviousYear: number | null;
  dilutedEarningsPerShareFromDiscontinuedOperations: number | null;
  dilutedEarningsPerShareFromDiscontinuedOperationsPreviousYear: number | null;
  dilutedEarningsLossPerShareFromContinuingAndDiscontinuedOperations: number | null;
  dilutedEarningsLossPerShareFromContinuingAndDiscontinuedOperationsPreviousYear: number | null;

  equityShareCapital: number | null;
  otherEquity: number | null;
  totalEquity: number | null;
  totalEquityPreviousYear: number | null;

  capitalWorkInProgress: number | null;
  biologicalAssetsOtherThanBearerPlants: number | null;
  bearerPlants: number | null;
  propertyPlantAndEquipment: number | null;
  investmentProperty: number | null;
  goodwill: number | null;
  otherIntangibleAssets: number | null;
  intangibleAssetsUnderDevelopment: number | null;
  nonCurrentInvestments: number | null;
  deferredTaxAssets: number | null;
  longTermLoansAndAdvances: number | null;
  otherNonCurrentFinancialAssets: number | null;
  otherNonCurrentAssets: number | null;
  totalNonCurrentAssets: number | null;

  currentInvestments: number | null;
  currentLoansAndAdvances: number | null;
  currentFinancialAssets: number | null;
  tradeReceivablesCurrent: number | null;
  cashAndCashEquivalents: number | null;
  bankBalanceOtherThanCashAndCashEquivalents: number | null;
  otherCurrentFinancialAssets: number | null;
  otherCurrentAssets: number | null;
  inventories: number | null;
  totalCurrentAssets: number | null;
  totalAssets: number | null;
  totalAssetsPreviousYear: number | null;

  borrowingsCurrent: number | null;
  borrowingsNonCurrent: number | null;
  tradePayablesCurrent: number | null;
  tradePayablesNonCurrent: number | null;
  totalOutstandingDuesOfMicroEnterpriseAndSmallEnterpriseCurrent: number | null;
  totalOutstandingDuesOfMicroEnterpriseAndSmallEnterpriseNonCurrent: number | null;
  totalOutstandingDuesOfCreditorsOtherThanMicroEnterpriseAndSmallEnterpriseCurrent: number | null;
  totalOutstandingDuesOfCreditorsOtherThanMicroEnterpriseAndSmallEnterpriseNonCurrent: number | null;
  otherCurrentFinancialLiabilities: number | null;
  otherCurrentLiabilities: number | null;
  currentProvisions: number | null;
  currentTaxLiabilities: number | null;
  deferredGovernmentGrants: number | null;
  nonCurrentLiabilities: number | null;
  otherNonCurrentFinancialLiabilities: number | null;
  otherNonCurrentLiabilities: number | null;
  nonCurrentProvisions: number | null;
  longTermProvisions: number | null;
  deferredTaxLiabilities: number | null;
  totalNonCurrentLiabilities: number | null;

  totalCurrentLiabilities: number | null;
  totalLiabilities: number | null;
  totalLiabilitiesPreviousYear: number | null;
  totalEquityAndLiabilities: number | null;
  totalEquityAndLiabilitiesPreviousYear: number | null;

  equityAttributableToOwnersOfParent: number | null;
  nonControllingInterests: number | null;

  cashFlowsFromUsedInOperatingActivities: number | null;
  cashFlowsFromUsedInInvestingActivities: number | null;
  cashFlowsFromUsedInFinancingActivities: number | null;
  netCashFlowsUsedInOperations: number | null;
  netCashFlowsUsedInInvestingActivities: number | null;
  netCashFlowsUsedInFinancingActivities: number | null;
  netIncreaseInCashAndCashEquivalents: number | null;
  cashAndCashEquivalentsAtBeginningOfPeriod: number | null;
  cashAndCashEquivalentsAtEndOfPeriod: number | null;

  dividendPerShare: number | null;
  dividendPerSharePreviousYear: number | null;
  dividendDeclaredPerShare: number | null;

  operatingCashFlow: number | null;
  investingCashFlow: number | null;
  financingCashFlow: number | null;

  freeCashFlow: number | null;

  faceValuePerShare: number | null;
  paidUpCapital: number | null;
  numberOfSharesOutstanding: number | null;
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseAttributeValue: true,
  parseTagValue: true,
  trimValues: true,
  cdataPropName: '__cdata',
});

const FIELD_MAPPING: Record<string, string> = {
  'in-capmkt:RevenueFromOperations': 'revenueFromOperations',
  'in-capmkt:OtherIncome': 'otherIncome',
  'in-capmkt:TotalIncome': 'totalRevenue',
  'in-capmkt:CostOfMaterialsConsumed': 'costOfMaterialsConsumed',
  'in-capmkt:ChangesInInventoriesOfFinishedGoodsWorkInProgressAndStockInTrade': 'changesInInventoriesOfFinishedGoodsWorkInProgressAndStockInTrade',
  'in-capmkt:EmployeeBenefitsExpense': 'employeeBenefitsExpense',
  'in-capmkt:FinanceCosts': 'financeCosts',
  'in-capmkt:DepreciationAndAmortisationExpense': 'depreciationAndAmortisationExpense',
  'in-capmkt:OtherExpenses': 'otherExpenses',
  'in-capmkt:TotalExpenses': 'totalExpenses',
  'in-capmkt:ProfitLossBeforeExceptionalItemsAndTax': 'profitLossBeforeExceptionalItemsAndTax',
  'in-capmkt:ExceptionalItems': 'exceptionalItems',
  'in-capmkt:ProfitBeforeTax': 'profitLossBeforeTax',
  'in-capmkt:ProfitLossBeforeTax': 'profitLossBeforeTax',
  'in-capmkt:TaxExpense': 'taxExpense',
  'in-capmkt:CurrentTax': 'currentTax',
  'in-capmkt:DeferredTax': 'deferredTax',
  'in-capmkt:ProfitLossForPeriodFromContinuingOperations': 'profitLossForPeriodFromContinuingOperations',
  'in-capmkt:ProfitLossFromDiscontinuedOperationsBeforeTax': 'profitLossFromDiscontinuedOperationsBeforeTax',
  'in-capmkt:TaxExpenseDiscontinuedOperations': 'taxExpenseDiscontinuedOperations',
  'in-capmkt:ProfitLossFromDiscontinuedOperationsAfterTax': 'profitLossFromDiscontinuedOperationsAfterTax',
  'in-capmkt:ProfitLossForPeriod': 'profitLossForPeriod',
  'in-capmkt:ProfitOrLossAttributableToOwnersOfParent': 'profitOrLossAttributableToOwnersOfParent',
  'in-capmkt:ProfitOrLossAttributableToNonControllingInterests': 'profitOrLossAttributableToNonControllingInterests',
  'in-capmkt:ComprehensiveIncomeForThePeriod': 'comprehensiveIncomeForThePeriod',
  'in-capmkt:ComprehensiveIncomeAttributableToOwnersOfParent': 'comprehensiveIncomeAttributableToOwnersOfParent',
  'in-capmkt:ComprehensiveIncomeAttributableToNonControllingInterests': 'comprehensiveIncomeAttributableToNonControllingInterests',
  'in-capmkt:TotalComprehensiveIncome': 'totalComprehensiveIncome',
  'in-capmkt:BasicEarningsLossPerShareFromContinuingOperations': 'basicEarningsPerShareFromContinuingOperations',
  'in-capmkt:BasicEarningsLossPerShareFromDiscontinuedOperations': 'basicEarningsPerShareFromDiscontinuedOperations',
  'in-capmkt:BasicEarningsLossPerShareFromContinuingAndDiscontinuedOperations': 'basicEarningsLossPerShareFromContinuingAndDiscontinuedOperations',
  'in-capmkt:DilutedEarningsLossPerShareFromContinuingOperations': 'dilutedEarningsPerShareFromContinuingOperations',
  'in-capmkt:DilutedEarningsLossPerShareFromDiscontinuedOperations': 'dilutedEarningsPerShareFromDiscontinuedOperations',
  'in-capmkt:DilutedEarningsLossPerShareFromContinuingAndDiscontinuedOperations': 'dilutedEarningsLossPerShareFromContinuingAndDiscontinuedOperations',
  'in-capmkt:EquityShareCapital': 'equityShareCapital',
  'in-capmkt:OtherEquity': 'otherEquity',
  'in-capmkt:TotalEquity': 'totalEquity',
  'in-capmkt:CapitalWorkInProgress': 'capitalWorkInProgress',
  'in-capmkt:BiologicalAssetsOtherThanBearerPlants': 'biologicalAssetsOtherThanBearerPlants',
  'in-capmkt:BearerPlants': 'bearerPlants',
  'in-capmkt:PropertyPlantAndEquipment': 'propertyPlantAndEquipment',
  'in-capmkt:InvestmentProperty': 'investmentProperty',
  'in-capmkt:Goodwill': 'goodwill',
  'in-capmkt:OtherIntangibleAssets': 'otherIntangibleAssets',
  'in-capmkt:IntangibleAssetsUnderDevelopment': 'intangibleAssetsUnderDevelopment',
  'in-capmkt:NonCurrentInvestments': 'nonCurrentInvestments',
  'in-capmkt:DeferredTaxAssets': 'deferredTaxAssets',
  'in-capmkt:LongTermLoansAndAdvances': 'longTermLoansAndAdvances',
  'in-capmkt:OtherNonCurrentFinancialAssets': 'otherNonCurrentFinancialAssets',
  'in-capmkt:OtherNonCurrentAssets': 'otherNonCurrentAssets',
  'in-capmkt:TotalNonCurrentAssets': 'totalNonCurrentAssets',
  'in-capmkt:CurrentInvestments': 'currentInvestments',
  'in-capmkt:CurrentLoansAndAdvances': 'currentLoansAndAdvances',
  'in-capmkt:CurrentFinancialAssets': 'currentFinancialAssets',
  'in-capmkt:TradeReceivablesCurrent': 'tradeReceivablesCurrent',
  'in-capmkt:CashAndCashEquivalents': 'cashAndCashEquivalents',
  'in-capmkt:BankBalanceOtherThanCashAndCashEquivalents': 'bankBalanceOtherThanCashAndCashEquivalents',
  'in-capmkt:OtherCurrentFinancialAssets': 'otherCurrentFinancialAssets',
  'in-capmkt:OtherCurrentAssets': 'otherCurrentAssets',
  'in-capmkt:Inventories': 'inventories',
  'in-capmkt:TotalCurrentAssets': 'totalCurrentAssets',
  'in-capmkt:Assets': 'totalAssets',
  'in-capmkt:TotalAssets': 'totalAssets',
  'in-capmkt:BorrowingsCurrent': 'borrowingsCurrent',
  'in-capmkt:BorrowingsNoncurrent': 'borrowingsNonCurrent',
  'in-capmkt:TradePayablesCurrent': 'tradePayablesCurrent',
  'in-capmkt:TradePayablesNoncurrent': 'tradePayablesNonCurrent',
  'in-capmkt:TotalOutstandingDuesOfMicroEnterpriseAndSmallEnterpriseCurrent': 'totalOutstandingDuesOfMicroEnterpriseAndSmallEnterpriseCurrent',
  'in-capmkt:TotalOutstandingDuesOfMicroEnterpriseAndSmallEnterpriseNoncurrent': 'totalOutstandingDuesOfMicroEnterpriseAndSmallEnterpriseNonCurrent',
  'in-capmkt:TotalOutstandingDuesOfCreditorsOtherThanMicroEnterpriseAndSmallEnterpriseCurrent': 'totalOutstandingDuesOfCreditorsOtherThanMicroEnterpriseAndSmallEnterpriseCurrent',
  'in-capmkt:TotalOutstandingDuesOfCreditorsOtherThanMicroEnterpriseAndSmallEnterpriseNoncurrent': 'totalOutstandingDuesOfCreditorsOtherThanMicroEnterpriseAndSmallEnterpriseNonCurrent',
  'in-capmkt:OtherCurrentFinancialLiabilities': 'otherCurrentFinancialLiabilities',
  'in-capmkt:OtherCurrentLiabilities': 'otherCurrentLiabilities',
  'in-capmkt:CurrentProvisions': 'currentProvisions',
  'in-capmkt:CurrentTaxLiabilities': 'currentTaxLiabilities',
  'in-capmkt:DeferredGovernmentGrants': 'deferredGovernmentGrants',
  'in-capmkt:NonCurrentLiabilities': 'nonCurrentLiabilities',
  'in-capmkt:OtherNonCurrentFinancialLiabilities': 'otherNonCurrentFinancialLiabilities',
  'in-capmkt:OtherNonCurrentLiabilities': 'otherNonCurrentLiabilities',
  'in-capmkt:NonCurrentProvisions': 'nonCurrentProvisions',
  'in-capmkt:LongTermProvisions': 'longTermProvisions',
  'in-capmkt:DeferredTaxLiabilities': 'deferredTaxLiabilities',
  'in-capmkt:TotalNonCurrentLiabilities': 'totalNonCurrentLiabilities',
  'in-capmkt:TotalCurrentLiabilities': 'totalCurrentLiabilities',
  'in-capmkt:Liabilities': 'totalLiabilities',
  'in-capmkt:TotalLiabilities': 'totalLiabilities',
  'in-capmkt:EquityAndLiabilities': 'totalEquityAndLiabilities',
  'in-capmkt:TotalEquityAndLiabilities': 'totalEquityAndLiabilities',
  'in-capmkt:EquityAttributableToOwnersOfParent': 'equityAttributableToOwnersOfParent',
  'in-capmkt:NonControllingInterests': 'nonControllingInterests',
  'in-capmkt:CashFlowsFromUsedInOperatingActivities': 'cashFlowsFromUsedInOperatingActivities',
  'in-capmkt:CashFlowsFromUsedInInvestingActivities': 'cashFlowsFromUsedInInvestingActivities',
  'in-capmkt:CashFlowsFromUsedInFinancingActivities': 'cashFlowsFromUsedInFinancingActivities',
  'in-capmkt:NetIncreaseInCashAndCashEquivalents': 'netIncreaseInCashAndCashEquivalents',
  'in-capmkt:CashAndCashEquivalentsAtBeginningOfPeriod': 'cashAndCashEquivalentsAtBeginningOfPeriod',
  'in-capmkt:CashAndCashEquivalentsAtEndOfPeriod': 'cashAndCashEquivalentsAtEndOfPeriod',
  'in-capmkt:DividendPerShare': 'dividendPerShare',
  'in-capmkt:DividendDeclaredPerShare': 'dividendDeclaredPerShare',
  'in-capmkt:FaceValuePerShare': 'faceValuePerShare',
  'in-capmkt:PaidUpCapital': 'paidUpCapital',
};

function parseNumber(value: string | number | undefined, exponent: number | undefined): number | null {
  if (value === undefined || value === null || value === '') return null;
  const num = typeof value === 'number' ? value : parseFloat(value.replace(/,/g, ''));
  if (isNaN(num)) return null;
  if (exponent !== undefined) {
    return num * Math.pow(10, exponent);
  }
  return num;
}

function extractValueFromContext(
  parsed: any,
  fieldName: string,
  contextRefs: Map<string, string[]>,
  contextMap: Map<string, { start?: string; end?: string; instant?: string }>
): { current: number | null; previous: number | null } {
  const tagName = `in-capmkt:${fieldName}`;
  const element = parsed['xbrli:xbrl']?.[tagName];
  if (!element) return { current: null, previous: null };

  let currentValue: number | null = null;
  let previousValue: number | null = null;

  if (typeof element === 'string' || typeof element === 'number') {
    const attrs = (element as any)['@_'];
    const value = parseNumber(typeof element === 'object' ? (element as any)['#text'] : element, attrs?.decimals ? parseInt(attrs.decimals) : undefined);
    const contextId = attrs?.contextRef || attrs?.contextref;

    if (contextId) {
      const contextType = contextRefs.get(contextId);
      if (contextType?.includes('PY')) {
        previousValue = value;
      } else {
        currentValue = value;
      }
    } else {
      currentValue = value;
    }
  } else if (Array.isArray(element)) {
    for (const item of element) {
      if (item) {
        const attrs = item['@_'] || {};
        const value = parseNumber(item['#text'], attrs.decimals ? parseInt(attrs.decimals) : undefined);
        const contextId = attrs.contextRef || attrs.contextref;

        if (contextId) {
          const contextType = contextRefs.get(contextId);
          if (contextType?.includes('PY')) {
            previousValue = value;
          } else if (contextType?.includes('OneD') || contextType?.includes('FourD')) {
            currentValue = value;
          } else {
            currentValue = value;
          }
        }
      }
    }
  } else if (typeof element === 'object') {
    for (const [key, val] of Object.entries(element)) {
      if (key.startsWith('@_')) continue;
      const attrs = (val as any)?.['@_'] || {};
      const value = parseNumber((val as any)?.['#text'], attrs.decimals ? parseInt(attrs.decimals) : undefined);
      const contextId = attrs.contextRef || attrs.contextref;

      if (contextId) {
        const contextType = contextRefs.get(contextId);
        if (contextType?.includes('PY')) {
          previousValue = value;
        } else {
          currentValue = value;
        }
      }
    }
  }

  return { current: currentValue, previous: previousValue };
}

function buildContextMap(parsed: any): Map<string, string[]> {
  const contexts = parsed['xbrli:xbrl']?.['xbrli:context'] || [];
  const contextMap = new Map<string, string[]>();

  const contextList = Array.isArray(contexts) ? contexts : [contexts];
  for (const ctx of contextList) {
    if (ctx) {
      const id = ctx['@_id'] || ctx.id;
      const entity = ctx['xbrli:entity'];
      const identifier = entity?.['xbrli:identifier'];
      const period = ctx['xbrli:period'];
      const periodType = period ? (period['xbrli:startDate'] ? 'D' : 'I') : '';

      contextMap.set(id, [periodType, identifier?.['#text'] || identifier || '']);
    }
  }

  return contextMap;
}

export async function parseFinancialXml(
  xmlUrl: string,
  metadata: {
    symbol: string;
    companyName: string;
    quarterEndDate: string;
    filingType: string;
    auditStatus: string;
    consolidationType: string;
    detailsUrl: string;
    broadcastDateTime: string;
    revisedDateTime?: string;
    revisionRemarks?: string;
    exchangeDisseminationTime?: string;
  }
): Promise<ParsedFinancialData | null> {
  try {
    const response = await axios.get(xmlUrl, { timeout: 60000 });
    const xmlText = response.data;

    const parsed = xmlParser.parse(xmlText);

    const contextRefs = buildContextMap(parsed);
    const xbrl = parsed['xbrli:xbrl'];
    if (!xbrl) {
      logger.warn(`No XBRL data found in ${xmlUrl}`);
      return null;
    }

    const data: ParsedFinancialData = {
      symbol: metadata.symbol,
      companyName: metadata.companyName,
      quarterEndDate: new Date(metadata.quarterEndDate),
      filingType: metadata.filingType as 'Original' | 'Revision',
      auditStatus: metadata.auditStatus as 'Audited' | 'Un-Audited',
      consolidationType: metadata.consolidationType as 'Consolidated' | 'Standalone',
      xbrlUrl: xmlUrl,
      detailsUrl: metadata.detailsUrl,
      broadcastDateTime: new Date(metadata.broadcastDateTime),
      revisedDateTime: metadata.revisedDateTime ? new Date(metadata.revisedDateTime) : undefined,
      revisionRemarks: metadata.revisionRemarks,
      exchangeDisseminationTime: metadata.exchangeDisseminationTime ? new Date(metadata.exchangeDisseminationTime) : undefined,

      revenueFromOperations: null,
      revenueFromOperationsPreviousYear: null,
      otherIncome: null,
      otherIncomePreviousYear: null,
      totalRevenue: null,
      totalRevenuePreviousYear: null,

      costOfMaterialsConsumed: null,
      costOfMaterialsConsumedPreviousYear: null,
      changesInInventoriesOfFinishedGoodsWorkInProgressAndStockInTrade: null,
      changesInInventoriesOfFinishedGoodsWorkInProgressAndStockInTradePreviousYear: null,
      employeeBenefitsExpense: null,
      employeeBenefitsExpensePreviousYear: null,
      financeCosts: null,
      financeCostsPreviousYear: null,
      depreciationAndAmortisationExpense: null,
      depreciationAndAmortisationExpensePreviousYear: null,
      otherExpenses: null,
      otherExpensesPreviousYear: null,
      totalExpenses: null,
      totalExpensesPreviousYear: null,

      profitLossBeforeExceptionalItemsAndTax: null,
      profitLossBeforeExceptionalItemsAndTaxPreviousYear: null,
      exceptionalItems: null,
      exceptionalItemsPreviousYear: null,
      profitLossBeforeTax: null,
      profitLossBeforeTaxPreviousYear: null,
      taxExpense: null,
      taxExpensePreviousYear: null,
      currentTax: null,
      currentTaxPreviousYear: null,
      deferredTax: null,
      deferredTaxPreviousYear: null,
      profitLossForPeriodFromContinuingOperations: null,
      profitLossForPeriodFromContinuingOperationsPreviousYear: null,
      profitLossFromDiscontinuedOperationsBeforeTax: null,
      profitLossFromDiscontinuedOperationsBeforeTaxPreviousYear: null,
      taxExpenseDiscontinuedOperations: null,
      profitLossFromDiscontinuedOperationsAfterTax: null,
      profitLossFromDiscontinuedOperationsAfterTaxPreviousYear: null,
      profitLossForPeriod: null,
      profitLossForPeriodPreviousYear: null,
      profitOrLossAttributableToOwnersOfParent: null,
      profitOrLossAttributableToOwnersOfParentPreviousYear: null,
      profitOrLossAttributableToNonControllingInterests: null,
      profitOrLossAttributableToNonControllingInterestsPreviousYear: null,
      comprehensiveIncomeForThePeriod: null,
      comprehensiveIncomeForThePeriodPreviousYear: null,
      comprehensiveIncomeAttributableToOwnersOfParent: null,
      comprehensiveIncomeAttributableToNonControllingInterests: null,
      totalComprehensiveIncome: null,
      totalComprehensiveIncomePreviousYear: null,

      basicEarningsPerShareFromContinuingOperations: null,
      basicEarningsPerShareFromContinuingOperationsPreviousYear: null,
      basicEarningsPerShareFromDiscontinuedOperations: null,
      basicEarningsPerShareFromDiscontinuedOperationsPreviousYear: null,
      basicEarningsLossPerShareFromContinuingAndDiscontinuedOperations: null,
      basicEarningsLossPerShareFromContinuingAndDiscontinuedOperationsPreviousYear: null,
      dilutedEarningsPerShareFromContinuingOperations: null,
      dilutedEarningsPerShareFromContinuingOperationsPreviousYear: null,
      dilutedEarningsPerShareFromDiscontinuedOperations: null,
      dilutedEarningsPerShareFromDiscontinuedOperationsPreviousYear: null,
      dilutedEarningsLossPerShareFromContinuingAndDiscontinuedOperations: null,
      dilutedEarningsLossPerShareFromContinuingAndDiscontinuedOperationsPreviousYear: null,

      equityShareCapital: null,
      otherEquity: null,
      totalEquity: null,
      totalEquityPreviousYear: null,

      capitalWorkInProgress: null,
      biologicalAssetsOtherThanBearerPlants: null,
      bearerPlants: null,
      propertyPlantAndEquipment: null,
      investmentProperty: null,
      goodwill: null,
      otherIntangibleAssets: null,
      intangibleAssetsUnderDevelopment: null,
      nonCurrentInvestments: null,
      deferredTaxAssets: null,
      longTermLoansAndAdvances: null,
      otherNonCurrentFinancialAssets: null,
      otherNonCurrentAssets: null,
      totalNonCurrentAssets: null,

      currentInvestments: null,
      currentLoansAndAdvances: null,
      currentFinancialAssets: null,
      tradeReceivablesCurrent: null,
      cashAndCashEquivalents: null,
      bankBalanceOtherThanCashAndCashEquivalents: null,
      otherCurrentFinancialAssets: null,
      otherCurrentAssets: null,
      inventories: null,
      totalCurrentAssets: null,
      totalAssets: null,
      totalAssetsPreviousYear: null,

      borrowingsCurrent: null,
      borrowingsNonCurrent: null,
      tradePayablesCurrent: null,
      tradePayablesNonCurrent: null,
      totalOutstandingDuesOfMicroEnterpriseAndSmallEnterpriseCurrent: null,
      totalOutstandingDuesOfMicroEnterpriseAndSmallEnterpriseNonCurrent: null,
      totalOutstandingDuesOfCreditorsOtherThanMicroEnterpriseAndSmallEnterpriseCurrent: null,
      totalOutstandingDuesOfCreditorsOtherThanMicroEnterpriseAndSmallEnterpriseNonCurrent: null,
      otherCurrentFinancialLiabilities: null,
      otherCurrentLiabilities: null,
      currentProvisions: null,
      currentTaxLiabilities: null,
      deferredGovernmentGrants: null,
      nonCurrentLiabilities: null,
      otherNonCurrentFinancialLiabilities: null,
      otherNonCurrentLiabilities: null,
      nonCurrentProvisions: null,
      longTermProvisions: null,
      deferredTaxLiabilities: null,
      totalNonCurrentLiabilities: null,

      totalCurrentLiabilities: null,
      totalLiabilities: null,
      totalLiabilitiesPreviousYear: null,
      totalEquityAndLiabilities: null,
      totalEquityAndLiabilitiesPreviousYear: null,

      equityAttributableToOwnersOfParent: null,
      nonControllingInterests: null,

      cashFlowsFromUsedInOperatingActivities: null,
      cashFlowsFromUsedInInvestingActivities: null,
      cashFlowsFromUsedInFinancingActivities: null,
      netCashFlowsUsedInOperations: null,
      netCashFlowsUsedInInvestingActivities: null,
      netCashFlowsUsedInFinancingActivities: null,
      netIncreaseInCashAndCashEquivalents: null,
      cashAndCashEquivalentsAtBeginningOfPeriod: null,
      cashAndCashEquivalentsAtEndOfPeriod: null,

      dividendPerShare: null,
      dividendPerSharePreviousYear: null,
      dividendDeclaredPerShare: null,

      operatingCashFlow: null,
      investingCashFlow: null,
      financingCashFlow: null,

      freeCashFlow: null,

      faceValuePerShare: null,
      paidUpCapital: null,
      numberOfSharesOutstanding: null,
    };

    for (const [xmlField, dbField] of Object.entries(FIELD_MAPPING)) {
      const element = xbrl[xmlField];
      if (!element) continue;

      let currentValue: number | null = null;
      let previousValue: number | null = null;

      const extractValues = (item: any) => {
        if (!item) return { current: null, previous: null };
        const attrs = item['@_'] || {};
        const value = parseNumber(item['#text'], attrs.decimals ? parseInt(attrs.decimals) : undefined);
        const contextId = attrs.contextRef || attrs.contextref;

        if (!contextId) return { current: value, previous: null };

        const contextType = contextRefs.get(contextId);
        if (!contextType) return { current: value, previous: null };

        if (contextType[0] === 'I' && contextType[1].includes('PY')) {
          return { current: null, previous: value };
        } else if (contextType[0] === 'I') {
          return { current: value, previous: null };
        } else if (contextType[1].includes('PY')) {
          return { current: null, previous: value };
        }
        return { current: value, previous: null };
      };

      if (typeof element === 'string' || typeof element === 'number') {
        const result = extractValues({ '@_': {}, '#text': element });
        currentValue = result.current;
        previousValue = result.previous;
      } else if (Array.isArray(element)) {
        for (const item of element) {
          const result = extractValues(item);
          if (result.current !== null) currentValue = result.current;
          if (result.previous !== null) previousValue = result.previous;
        }
      } else if (typeof element === 'object') {
        for (const [key, val] of Object.entries(element)) {
          if (key.startsWith('@_')) continue;
          const result = extractValues(val);
          if (result.current !== null) currentValue = result.current;
          if (result.previous !== null) previousValue = result.previous;
        }
      }

      (data as any)[dbField] = currentValue;
      const previousField = `${dbField}PreviousYear`;
      if ((data as any)[previousField] !== undefined) {
        (data as any)[previousField] = previousValue;
      }
    }

    if (data.totalAssets && data.totalEquity !== null && data.totalLiabilities === null) {
      data.totalLiabilities = data.totalAssets - data.totalEquity;
    }
    if (data.totalAssetsPreviousYear && data.totalEquityPreviousYear !== null && data.totalLiabilitiesPreviousYear === null) {
      data.totalLiabilitiesPreviousYear = data.totalAssetsPreviousYear - data.totalEquityPreviousYear;
    }

    if (data.profitLossForPeriod === null && data.profitOrLossAttributableToOwnersOfParent !== null) {
      data.profitLossForPeriod = data.profitOrLossAttributableToOwnersOfParent;
    }

    if (data.totalEquity !== null && data.equityShareCapital !== null && data.equityShareCapital > 0) {
      data.numberOfSharesOutstanding = data.equityShareCapital * 10000000;
    }

    return data;
  } catch (error) {
    logger.error(`Error parsing XML ${xmlUrl}: ${(error as Error).message}`);
    return null;
  }
}

export function determineQuarter(quarterEndDate: string): { year: number; quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4' } {
  let month = 0;
  let year = 2025;

  if (quarterEndDate.includes('-')) {
    const parts = quarterEndDate.split('-');
    if (parts.length >= 3) {
      const monthStr = parts[1].toUpperCase();
      const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
      month = monthNames.indexOf(monthStr);
      year = parseInt(parts[2]);
    }
  } else {
    const date = new Date(quarterEndDate);
    month = date.getMonth();
    year = date.getFullYear();
  }

  if (month >= 0 && month <= 2) return { year: year - 1, quarter: 'Q4' };
  if (month >= 3 && month <= 5) return { year, quarter: 'Q1' };
  if (month >= 6 && month <= 8) return { year, quarter: 'Q2' };
  if (month >= 9 && month <= 11) return { year, quarter: 'Q3' };
  return { year, quarter: 'Q4' };
}

export function createEmptyFinancialData(metadata: {
  symbol: string;
  companyName: string;
  quarterEndDate: string;
  filingType: string;
  auditStatus: string;
  consolidationType: string;
  detailsUrl: string;
  broadcastDateTime: string;
  revisedDateTime?: string;
  revisionRemarks?: string;
  exchangeDisseminationTime?: string;
}): ParsedFinancialData {
  return {
    symbol: metadata.symbol,
    companyName: metadata.companyName,
    quarterEndDate: new Date(metadata.quarterEndDate),
    filingType: metadata.filingType as 'Original' | 'Revision',
    auditStatus: metadata.auditStatus as 'Audited' | 'Un-Audited',
    consolidationType: metadata.consolidationType as 'Consolidated' | 'Standalone',
    xbrlUrl: '',
    detailsUrl: metadata.detailsUrl,
    broadcastDateTime: new Date(metadata.broadcastDateTime),
    revisedDateTime: metadata.revisedDateTime ? new Date(metadata.revisedDateTime) : undefined,
    revisionRemarks: metadata.revisionRemarks,
    exchangeDisseminationTime: metadata.exchangeDisseminationTime ? new Date(metadata.exchangeDisseminationTime) : undefined,

    revenueFromOperations: null,
    revenueFromOperationsPreviousYear: null,
    otherIncome: null,
    otherIncomePreviousYear: null,
    totalRevenue: null,
    totalRevenuePreviousYear: null,
    costOfMaterialsConsumed: null,
    costOfMaterialsConsumedPreviousYear: null,
    changesInInventoriesOfFinishedGoodsWorkInProgressAndStockInTrade: null,
    changesInInventoriesOfFinishedGoodsWorkInProgressAndStockInTradePreviousYear: null,
    employeeBenefitsExpense: null,
    employeeBenefitsExpensePreviousYear: null,
    financeCosts: null,
    financeCostsPreviousYear: null,
    depreciationAndAmortisationExpense: null,
    depreciationAndAmortisationExpensePreviousYear: null,
    otherExpenses: null,
    otherExpensesPreviousYear: null,
    totalExpenses: null,
    totalExpensesPreviousYear: null,
    profitLossBeforeExceptionalItemsAndTax: null,
    profitLossBeforeExceptionalItemsAndTaxPreviousYear: null,
    exceptionalItems: null,
    exceptionalItemsPreviousYear: null,
    profitLossBeforeTax: null,
    profitLossBeforeTaxPreviousYear: null,
    taxExpense: null,
    taxExpensePreviousYear: null,
    currentTax: null,
    currentTaxPreviousYear: null,
    deferredTax: null,
    deferredTaxPreviousYear: null,
    profitLossForPeriodFromContinuingOperations: null,
    profitLossForPeriodFromContinuingOperationsPreviousYear: null,
    profitLossFromDiscontinuedOperationsBeforeTax: null,
    profitLossFromDiscontinuedOperationsBeforeTaxPreviousYear: null,
    taxExpenseDiscontinuedOperations: null,
    profitLossFromDiscontinuedOperationsAfterTax: null,
    profitLossFromDiscontinuedOperationsAfterTaxPreviousYear: null,
    profitLossForPeriod: null,
    profitLossForPeriodPreviousYear: null,
    profitOrLossAttributableToOwnersOfParent: null,
    profitOrLossAttributableToOwnersOfParentPreviousYear: null,
    profitOrLossAttributableToNonControllingInterests: null,
    profitOrLossAttributableToNonControllingInterestsPreviousYear: null,
    comprehensiveIncomeForThePeriod: null,
    comprehensiveIncomeForThePeriodPreviousYear: null,
    comprehensiveIncomeAttributableToOwnersOfParent: null,
    comprehensiveIncomeAttributableToNonControllingInterests: null,
    totalComprehensiveIncome: null,
    totalComprehensiveIncomePreviousYear: null,

    basicEarningsPerShareFromContinuingOperations: null,
    basicEarningsPerShareFromContinuingOperationsPreviousYear: null,
    basicEarningsPerShareFromDiscontinuedOperations: null,
    basicEarningsPerShareFromDiscontinuedOperationsPreviousYear: null,
    basicEarningsLossPerShareFromContinuingAndDiscontinuedOperations: null,
    basicEarningsLossPerShareFromContinuingAndDiscontinuedOperationsPreviousYear: null,
    dilutedEarningsPerShareFromContinuingOperations: null,
    dilutedEarningsPerShareFromContinuingOperationsPreviousYear: null,
    dilutedEarningsPerShareFromDiscontinuedOperations: null,
    dilutedEarningsPerShareFromDiscontinuedOperationsPreviousYear: null,
    dilutedEarningsLossPerShareFromContinuingAndDiscontinuedOperations: null,
    dilutedEarningsLossPerShareFromContinuingAndDiscontinuedOperationsPreviousYear: null,

    equityShareCapital: null,
    otherEquity: null,
    totalEquity: null,
    totalEquityPreviousYear: null,

    capitalWorkInProgress: null,
    biologicalAssetsOtherThanBearerPlants: null,
    bearerPlants: null,
    propertyPlantAndEquipment: null,
    investmentProperty: null,
    goodwill: null,
    otherIntangibleAssets: null,
    intangibleAssetsUnderDevelopment: null,
    nonCurrentInvestments: null,
    deferredTaxAssets: null,
    longTermLoansAndAdvances: null,
    otherNonCurrentFinancialAssets: null,
    otherNonCurrentAssets: null,
    totalNonCurrentAssets: null,

    currentInvestments: null,
    currentLoansAndAdvances: null,
    currentFinancialAssets: null,
    tradeReceivablesCurrent: null,
    cashAndCashEquivalents: null,
    bankBalanceOtherThanCashAndCashEquivalents: null,
    otherCurrentFinancialAssets: null,
    otherCurrentAssets: null,
    inventories: null,
    totalCurrentAssets: null,
    totalAssets: null,
    totalAssetsPreviousYear: null,

    borrowingsCurrent: null,
    borrowingsNonCurrent: null,
    tradePayablesCurrent: null,
    tradePayablesNonCurrent: null,
    totalOutstandingDuesOfMicroEnterpriseAndSmallEnterpriseCurrent: null,
    totalOutstandingDuesOfMicroEnterpriseAndSmallEnterpriseNonCurrent: null,
    totalOutstandingDuesOfCreditorsOtherThanMicroEnterpriseAndSmallEnterpriseCurrent: null,
    totalOutstandingDuesOfCreditorsOtherThanMicroEnterpriseAndSmallEnterpriseNonCurrent: null,
    otherCurrentFinancialLiabilities: null,
    otherCurrentLiabilities: null,
    currentProvisions: null,
    currentTaxLiabilities: null,
    deferredGovernmentGrants: null,
    nonCurrentLiabilities: null,
    otherNonCurrentFinancialLiabilities: null,
    otherNonCurrentLiabilities: null,
    nonCurrentProvisions: null,
    longTermProvisions: null,
    deferredTaxLiabilities: null,
    totalNonCurrentLiabilities: null,

    totalCurrentLiabilities: null,
    totalLiabilities: null,
    totalLiabilitiesPreviousYear: null,
    totalEquityAndLiabilities: null,
    totalEquityAndLiabilitiesPreviousYear: null,

    equityAttributableToOwnersOfParent: null,
    nonControllingInterests: null,

    cashFlowsFromUsedInOperatingActivities: null,
    cashFlowsFromUsedInInvestingActivities: null,
    cashFlowsFromUsedInFinancingActivities: null,
    netCashFlowsUsedInOperations: null,
    netCashFlowsUsedInInvestingActivities: null,
    netCashFlowsUsedInFinancingActivities: null,
    netIncreaseInCashAndCashEquivalents: null,
    cashAndCashEquivalentsAtBeginningOfPeriod: null,
    cashAndCashEquivalentsAtEndOfPeriod: null,

    dividendPerShare: null,
    dividendPerSharePreviousYear: null,
    dividendDeclaredPerShare: null,

    operatingCashFlow: null,
    investingCashFlow: null,
    financingCashFlow: null,

    freeCashFlow: null,

    faceValuePerShare: null,
    paidUpCapital: null,
    numberOfSharesOutstanding: null,
  };
}

export type { ParsedFinancialData };