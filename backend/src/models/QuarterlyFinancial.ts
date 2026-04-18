import mongoose, { Document, Schema } from 'mongoose';

export interface IQuarterlyFinancial extends Document {
  symbol: string;
  companyName: string;
  year: number;
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
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

  importedAt: Date;
  updatedAt: Date;
}

const quarterlyFinancialSchema = new Schema<IQuarterlyFinancial>(
  {
    symbol: { type: String, required: true, index: true },
    companyName: { type: String, required: true },
    year: { type: Number, required: true, index: true },
    quarter: { type: String, enum: ['Q1', 'Q2', 'Q3', 'Q4'], required: true, index: true },
    quarterEndDate: { type: Date, required: true },
    filingType: { type: String, enum: ['Original', 'Revision'], default: 'Original' },
    auditStatus: { type: String, enum: ['Audited', 'Un-Audited'], default: 'Un-Audited' },
    consolidationType: { type: String, enum: ['Consolidated', 'Standalone'], default: 'Standalone' },
    xbrlUrl: { type: String },
    detailsUrl: { type: String },
    broadcastDateTime: { type: Date },
    revisedDateTime: { type: Date },
    revisionRemarks: { type: String },
    exchangeDisseminationTime: { type: Date },

    revenueFromOperations: { type: Number, default: null },
    revenueFromOperationsPreviousYear: { type: Number, default: null },
    otherIncome: { type: Number, default: null },
    otherIncomePreviousYear: { type: Number, default: null },
    totalRevenue: { type: Number, default: null },
    totalRevenuePreviousYear: { type: Number, default: null },

    costOfMaterialsConsumed: { type: Number, default: null },
    costOfMaterialsConsumedPreviousYear: { type: Number, default: null },
    changesInInventoriesOfFinishedGoodsWorkInProgressAndStockInTrade: { type: Number, default: null },
    changesInInventoriesOfFinishedGoodsWorkInProgressAndStockInTradePreviousYear: { type: Number, default: null },
    employeeBenefitsExpense: { type: Number, default: null },
    employeeBenefitsExpensePreviousYear: { type: Number, default: null },
    financeCosts: { type: Number, default: null },
    financeCostsPreviousYear: { type: Number, default: null },
    depreciationAndAmortisationExpense: { type: Number, default: null },
    depreciationAndAmortisationExpensePreviousYear: { type: Number, default: null },
    otherExpenses: { type: Number, default: null },
    otherExpensesPreviousYear: { type: Number, default: null },
    totalExpenses: { type: Number, default: null },
    totalExpensesPreviousYear: { type: Number, default: null },

    profitLossBeforeExceptionalItemsAndTax: { type: Number, default: null },
    profitLossBeforeExceptionalItemsAndTaxPreviousYear: { type: Number, default: null },
    exceptionalItems: { type: Number, default: null },
    exceptionalItemsPreviousYear: { type: Number, default: null },
    profitLossBeforeTax: { type: Number, default: null },
    profitLossBeforeTaxPreviousYear: { type: Number, default: null },
    taxExpense: { type: Number, default: null },
    taxExpensePreviousYear: { type: Number, default: null },
    currentTax: { type: Number, default: null },
    currentTaxPreviousYear: { type: Number, default: null },
    deferredTax: { type: Number, default: null },
    deferredTaxPreviousYear: { type: Number, default: null },
    profitLossForPeriodFromContinuingOperations: { type: Number, default: null },
    profitLossForPeriodFromContinuingOperationsPreviousYear: { type: Number, default: null },
    profitLossFromDiscontinuedOperationsBeforeTax: { type: Number, default: null },
    profitLossFromDiscontinuedOperationsBeforeTaxPreviousYear: { type: Number, default: null },
    taxExpenseDiscontinuedOperations: { type: Number, default: null },
    profitLossFromDiscontinuedOperationsAfterTax: { type: Number, default: null },
    profitLossFromDiscontinuedOperationsAfterTaxPreviousYear: { type: Number, default: null },
    profitLossForPeriod: { type: Number, default: null },
    profitLossForPeriodPreviousYear: { type: Number, default: null },
    profitOrLossAttributableToOwnersOfParent: { type: Number, default: null },
    profitOrLossAttributableToOwnersOfParentPreviousYear: { type: Number, default: null },
    profitOrLossAttributableToNonControllingInterests: { type: Number, default: null },
    profitOrLossAttributableToNonControllingInterestsPreviousYear: { type: Number, default: null },
    comprehensiveIncomeForThePeriod: { type: Number, default: null },
    comprehensiveIncomeForThePeriodPreviousYear: { type: Number, default: null },
    comprehensiveIncomeAttributableToOwnersOfParent: { type: Number, default: null },
    comprehensiveIncomeAttributableToNonControllingInterests: { type: Number, default: null },
    totalComprehensiveIncome: { type: Number, default: null },
    totalComprehensiveIncomePreviousYear: { type: Number, default: null },

    basicEarningsPerShareFromContinuingOperations: { type: Number, default: null },
    basicEarningsPerShareFromContinuingOperationsPreviousYear: { type: Number, default: null },
    basicEarningsPerShareFromDiscontinuedOperations: { type: Number, default: null },
    basicEarningsPerShareFromDiscontinuedOperationsPreviousYear: { type: Number, default: null },
    basicEarningsLossPerShareFromContinuingAndDiscontinuedOperations: { type: Number, default: null },
    basicEarningsLossPerShareFromContinuingAndDiscontinuedOperationsPreviousYear: { type: Number, default: null },
    dilutedEarningsPerShareFromContinuingOperations: { type: Number, default: null },
    dilutedEarningsPerShareFromContinuingOperationsPreviousYear: { type: Number, default: null },
    dilutedEarningsPerShareFromDiscontinuedOperations: { type: Number, default: null },
    dilutedEarningsPerShareFromDiscontinuedOperationsPreviousYear: { type: Number, default: null },
    dilutedEarningsLossPerShareFromContinuingAndDiscontinuedOperations: { type: Number, default: null },
    dilutedEarningsLossPerShareFromContinuingAndDiscontinuedOperationsPreviousYear: { type: Number, default: null },

    equityShareCapital: { type: Number, default: null },
    otherEquity: { type: Number, default: null },
    totalEquity: { type: Number, default: null },
    totalEquityPreviousYear: { type: Number, default: null },

    capitalWorkInProgress: { type: Number, default: null },
    biologicalAssetsOtherThanBearerPlants: { type: Number, default: null },
    bearerPlants: { type: Number, default: null },
    propertyPlantAndEquipment: { type: Number, default: null },
    investmentProperty: { type: Number, default: null },
    goodwill: { type: Number, default: null },
    otherIntangibleAssets: { type: Number, default: null },
    intangibleAssetsUnderDevelopment: { type: Number, default: null },
    nonCurrentInvestments: { type: Number, default: null },
    deferredTaxAssets: { type: Number, default: null },
    longTermLoansAndAdvances: { type: Number, default: null },
    otherNonCurrentFinancialAssets: { type: Number, default: null },
    otherNonCurrentAssets: { type: Number, default: null },
    totalNonCurrentAssets: { type: Number, default: null },

    currentInvestments: { type: Number, default: null },
    currentLoansAndAdvances: { type: Number, default: null },
    currentFinancialAssets: { type: Number, default: null },
    tradeReceivablesCurrent: { type: Number, default: null },
    cashAndCashEquivalents: { type: Number, default: null },
    bankBalanceOtherThanCashAndCashEquivalents: { type: Number, default: null },
    otherCurrentFinancialAssets: { type: Number, default: null },
    otherCurrentAssets: { type: Number, default: null },
    inventories: { type: Number, default: null },
    totalCurrentAssets: { type: Number, default: null },
    totalAssets: { type: Number, default: null },
    totalAssetsPreviousYear: { type: Number, default: null },

    borrowingsCurrent: { type: Number, default: null },
    borrowingsNonCurrent: { type: Number, default: null },
    tradePayablesCurrent: { type: Number, default: null },
    tradePayablesNonCurrent: { type: Number, default: null },
    totalOutstandingDuesOfMicroEnterpriseAndSmallEnterpriseCurrent: { type: Number, default: null },
    totalOutstandingDuesOfMicroEnterpriseAndSmallEnterpriseNonCurrent: { type: Number, default: null },
    totalOutstandingDuesOfCreditorsOtherThanMicroEnterpriseAndSmallEnterpriseCurrent: { type: Number, default: null },
    totalOutstandingDuesOfCreditorsOtherThanMicroEnterpriseAndSmallEnterpriseNonCurrent: { type: Number, default: null },
    otherCurrentFinancialLiabilities: { type: Number, default: null },
    otherCurrentLiabilities: { type: Number, default: null },
    currentProvisions: { type: Number, default: null },
    currentTaxLiabilities: { type: Number, default: null },
    deferredGovernmentGrants: { type: Number, default: null },
    nonCurrentLiabilities: { type: Number, default: null },
    otherNonCurrentFinancialLiabilities: { type: Number, default: null },
    otherNonCurrentLiabilities: { type: Number, default: null },
    nonCurrentProvisions: { type: Number, default: null },
    longTermProvisions: { type: Number, default: null },
    deferredTaxLiabilities: { type: Number, default: null },
    totalNonCurrentLiabilities: { type: Number, default: null },

    totalCurrentLiabilities: { type: Number, default: null },
    totalLiabilities: { type: Number, default: null },
    totalLiabilitiesPreviousYear: { type: Number, default: null },
    totalEquityAndLiabilities: { type: Number, default: null },
    totalEquityAndLiabilitiesPreviousYear: { type: Number, default: null },

    equityAttributableToOwnersOfParent: { type: Number, default: null },
    nonControllingInterests: { type: Number, default: null },

    cashFlowsFromUsedInOperatingActivities: { type: Number, default: null },
    cashFlowsFromUsedInInvestingActivities: { type: Number, default: null },
    cashFlowsFromUsedInFinancingActivities: { type: Number, default: null },
    netCashFlowsUsedInOperations: { type: Number, default: null },
    netCashFlowsUsedInInvestingActivities: { type: Number, default: null },
    netCashFlowsUsedInFinancingActivities: { type: Number, default: null },
    netIncreaseInCashAndCashEquivalents: { type: Number, default: null },
    cashAndCashEquivalentsAtBeginningOfPeriod: { type: Number, default: null },
    cashAndCashEquivalentsAtEndOfPeriod: { type: Number, default: null },

    dividendPerShare: { type: Number, default: null },
    dividendPerSharePreviousYear: { type: Number, default: null },
    dividendDeclaredPerShare: { type: Number, default: null },

    operatingCashFlow: { type: Number, default: null },
    investingCashFlow: { type: Number, default: null },
    financingCashFlow: { type: Number, default: null },

    freeCashFlow: { type: Number, default: null },

    faceValuePerShare: { type: Number, default: null },
    paidUpCapital: { type: Number, default: null },
    numberOfSharesOutstanding: { type: Number, default: null },

    importedAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

quarterlyFinancialSchema.index({ symbol: 1, year: 1, quarter: 1 }, { unique: true });
quarterlyFinancialSchema.index({ symbol: 1, consolidationType: 1 });
quarterlyFinancialSchema.index({ totalRevenue: -1 });
quarterlyFinancialSchema.index({ profitLossForPeriod: -1 });
quarterlyFinancialSchema.index({ totalAssets: -1 });

export const QuarterlyFinancial = mongoose.model<IQuarterlyFinancial>('QuarterlyFinancial', quarterlyFinancialSchema);