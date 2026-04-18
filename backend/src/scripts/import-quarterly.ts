import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import { QuarterlyFinancial } from '../models/QuarterlyFinancial.js';
import { determineQuarter } from '../services/financialXmlParser.js';
import { connectDB, isDbConnected } from '../config/database.js';

function parseCSV(content: string) {
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 15) return [];

  const headerNames = ['symbol', 'companyname', 'quarterenddate', 'typeofsubmission', 'auditedunaudited', 'consolidatedstandalone', 'details', 'xbrl', 'broadcastdatetime', 'reviseddatetime', 'revisionremarks', 'exchangedisseminationtime', 'timetaken'];

  const rows = [];
  for (let i = 15; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"' && line[j-1] !== '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.replace(/^"|"$/g, '').trim());
        current = '';
        continue;
      }
      current += char;
    }
    values.push(current.replace(/^"|"$/g, '').trim());

    if (values.length < 8) continue;

    const row: any = {};
    headerNames.forEach((h, idx) => row[h] = values[idx] || '');

    if (row.symbol && row.xbrl && row.xbrl.includes('nsearchives')) {
      rows.push(row);
    }
  }
  return rows;
}

async function main() {
  const dataDir = path.join(process.cwd());
  const csvFiles = fs.readdirSync(dataDir).filter(f => f.endsWith('.csv'));

  console.log('=== Quarterly Financials Metadata Import ===\n');
  console.log(`Found ${csvFiles.length} CSV files\n`);

  let totalProcessed = 0;
  let totalImported = 0;
  let totalSkipped = 0;

  for (const csvFile of csvFiles) {
    const csvPath = path.join(dataDir, csvFile);
    console.log(`Processing ${csvFile}...`);
    
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const rows = parseCSV(csvContent);
    console.log(`  Found ${rows.length} stocks`);

    let imported = 0;
    let skipped = 0;

    for (const row of rows) {
      const symbol = String(row.symbol || '').toUpperCase().trim();
      const xbrl = String(row.xbrl || '');
      const qdate = String(row.quarterenddate || '');
      const ct = String(row.consolidatedstandalone || '').toLowerCase().includes('consolidated') ? 'Consolidated' : 'Standalone';
      const audit = String(row.auditedunaudited || '').toLowerCase().includes('audited') ? 'Audited' : 'Un-Audited';
      const filing = String(row.typeofsubmission || '').toLowerCase().includes('revision') ? 'Revision' : 'Original';
      
      const q = determineQuarter(qdate);
      
      // Check existing
      const existing = await QuarterlyFinancial.findOne({ symbol, year: q.year, quarter: q.quarter, consolidationType: ct });
      if (existing) {
        skipped++;
        continue;
      }

      const doc = {
        symbol,
        companyName: String(row.companyname || '') || symbol,
        year: q.year,
        quarter: q.quarter,
        quarterEndDate: new Date(qdate),
        filingType: filing,
        auditStatus: audit,
        consolidationType: ct,
        xbrlUrl: xbrl,
        detailsUrl: String(row.details || ''),
        broadcastDateTime: row.broadcastdatetime ? new Date(String(row.broadcastdatetime)) : new Date(),
        
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

      try {
        await QuarterlyFinancial.create(doc);
        imported++;
      } catch (e) {
        if ((e as any).code !== 11000) {
          console.log('Error:', (e as any).message);
        }
        skipped++;
      }
    }

    console.log(`  Imported: ${imported}, Skipped: ${skipped}\n`);
    totalImported += imported;
    totalSkipped += skipped;
    totalProcessed += rows.length;
  }

  // Summary
  const total = await QuarterlyFinancial.countDocuments();
  
  console.log('=== Import Complete ===');
  console.log(`Total processed: ${totalProcessed}`);
  console.log(`Imported: ${totalImported}`);
  console.log(`Skipped (duplicates): ${totalSkipped}`);
  console.log(`Total in database: ${total}`);
  
  process.exit(0);
}

(async () => {
  if (!isDbConnected()) {
    console.log('Connecting to MongoDB...');
    await connectDB();
  }
  await main();
})();
