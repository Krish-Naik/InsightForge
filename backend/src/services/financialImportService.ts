import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { XMLParser } from 'fast-xml-parser';
import { QuarterlyFinancial } from '../models/QuarterlyFinancial.js';
import { determineQuarter } from './financialXmlParser.js';
import { logger } from '../utils/logger.js';

const require = createRequire(import.meta.url);
const https = require('https');

interface CsvRow {
  [key: string]: string;
}

function parseCSV(content: string): CsvRow[] {
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 15) return [];

  const headerNames = ['symbol', 'companyname', 'quarterenddate', 'typeofsubmission', 'auditedunaudited', 'consolidatedstandalone', 'details', 'xbrl', 'broadcastdatetime', 'reviseddatetime', 'revisionremarks', 'exchangedisseminationtime', 'timetaken'];

  const rows: CsvRow[] = [];
  const startIndex = 15;

  for (let i = startIndex; i < lines.length; i++) {
    let line = lines[i];
    if (!line.trim()) continue;

    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    let prevChar = '';

    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"' && prevChar !== '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.replace(/^"|"$/g, '').trim());
        current = '';
        prevChar = char;
        continue;
      }
      current += char;
      prevChar = char;
    }
    values.push(current.replace(/^"|"$/g, '').trim());

    if (values.length < 8) continue;

    const row: any = {};
    headerNames.forEach((header: string, index: number) => {
      row[header] = values[index] || '';
    });

    const xbrl = String(row.xbrl || '');
    if (row.symbol && xbrl.includes('nsearchives')) {
      rows.push(row as CsvRow);
    }
  }

  return rows;
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseAttributeValue: true,
  parseTagValue: true,
  trimValues: true,
});

function parseNumber(value: any, decimals: any): number | null {
  if (value === undefined || value === null || value === '') return null;
  const num = typeof value === 'number' ? value : parseFloat(String(value).replace(/,/g, ''));
  if (isNaN(num)) return null;
  if (decimals !== undefined) {
    const dec = parseInt(decimals);
    if (!isNaN(dec)) return num * Math.pow(10, dec);
  }
  return num;
}

async function fetchAndParseFinancialXML(xmlUrl: string): Promise<any> {
  return new Promise((resolve) => {
    const urlObj = new URL(xmlUrl);
    
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'GET',
      timeout: 20000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/xml, text/xml, */*',
        'Accept-Encoding': 'gzip, deflate',
      }
    };

    const req = https.request(options, (res: any) => {
      if (res.statusCode !== 200) {
        resolve(null);
        return;
      }
      
      let data = '';
      res.on('data', (chunk: any) => { data += chunk; });
      res.on('end', () => {
        if (!data || data.includes('INTERNAL_ERROR')) {
          resolve(null);
          return;
        }
        
        try {
          const parsed = xmlParser.parse(data);
          const xbrl = parsed['xbrli:xbrl'];
          if (!xbrl) {
            resolve(null);
            return;
          }

          const getValue = (tag: string) => {
            const element = xbrl[tag];
            if (!element) return null;
            
            let value: any = null;
            let decimals: any = null;
            
            if (Array.isArray(element)) {
              const item = element[0];
              value = item?.['#text'] ?? item;
              decimals = item?.['@_decimals'];
            } else {
              value = (element as any)?.['#text'] ?? element;
              decimals = (element as any)?.['@_decimals'];
            }
            
            return parseNumber(value, decimals);
          };

          resolve({
            revenueFromOperations: getValue('in-capmkt:RevenueFromOperations'),
            otherIncome: getValue('in-capmkt:OtherIncome'),
            totalRevenue: getValue('in-capmkt:Income'),
            costOfMaterialsConsumed: getValue('in-capmkt:CostOfMaterialsConsumed'),
            changesInInventoriesOfFinishedGoodsWorkInProgressAndStockInTrade: getValue('in-capmkt:ChangesInInventoriesOfFinishedGoodsWorkInProgressAndStockInTrade'),
            employeeBenefitsExpense: getValue('in-capmkt:EmployeeBenefitExpense') || getValue('in-capmkt:EmployeeBenefitsExpense'),
            financeCosts: getValue('in-capmkt:FinanceCosts'),
            depreciationAndAmortisationExpense: getValue('in-capmkt:DepreciationDepletionAndAmortisationExpense') || getValue('in-capmkt:DepreciationAndAmortisationExpense'),
            otherExpenses: getValue('in-capmkt:OtherExpenses'),
            totalExpenses: getValue('in-capmkt:Expenses'),
            profitLossBeforeExceptionalItemsAndTax: getValue('in-capmkt:ProfitBeforeExceptionalItemsAndTax'),
            exceptionalItems: getValue('in-capmkt:ExceptionalItemsBeforeTax'),
            profitLossBeforeTax: getValue('in-capmkt:ProfitBeforeTax') || getValue('in-capmkt:ProfitLossBeforeTax'),
            currentTax: getValue('in-capmkt:CurrentTax'),
            deferredTax: getValue('in-capmkt:DeferredTax'),
            taxExpense: getValue('in-capmkt:TaxExpense'),
            profitLossForPeriodFromContinuingOperations: getValue('in-capmkt:ProfitLossForPeriodFromContinuingOperations'),
            profitLossForPeriod: getValue('in-capmkt:ProfitLossForPeriod'),
            profitOrLossAttributableToOwnersOfParent: getValue('in-capmkt:ProfitOrLossAttributableToOwnersOfParent'),
            profitOrLossAttributableToNonControllingInterests: getValue('in-capmkt:ProfitOrLossAttributableToNonControllingInterests'),
            comprehensiveIncomeForThePeriod: getValue('in-capmkt:ComprehensiveIncomeForThePeriod'),
            basicEarningsPerShareFromContinuingOperations: getValue('in-capmkt:BasicEarningsLossPerShareFromContinuingOperations'),
            basicEarningsPerShareFromDiscontinuedOperations: getValue('in-capmkt:BasicEarningsLossPerShareFromDiscontinuedOperations'),
            basicEarningsLossPerShareFromContinuingAndDiscontinuedOperations: getValue('in-capmkt:BasicEarningsLossPerShareFromContinuingAndDiscontinuedOperations'),
            dilutedEarningsPerShareFromContinuingOperations: getValue('in-capmkt:DilutedEarningsLossPerShareFromContinuingOperations'),
            dilutedEarningsLossPerShareFromContinuingAndDiscontinuedOperations: getValue('in-capmkt:DilutedEarningsLossPerShareFromContinuingAndDiscontinuedOperations'),
            equityShareCapital: getValue('in-capmkt:PaidUpValueOfEquityShareCapital') || getValue('in-capmkt:EquityShareCapital'),
            faceValuePerShare: getValue('in-capmkt:FaceValueOfEquityShareCapital'),
          });
        } catch (e) {
          resolve(null);
        }
      });
    });

    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.end();
  });
}

export async function importQuarterlyFinancials(
  csvFilePath: string,
  options: {
    limit?: number;
    skipExisting?: boolean;
    dryRun?: boolean;
    fetchXML?: boolean;
  } = {}
): Promise<{ imported: number; skipped: number; errors: number; fetched: number }> {
  const { limit, skipExisting = true, dryRun = false, fetchXML = false } = options;

  if (!fs.existsSync(csvFilePath)) {
    throw new Error(`CSV file not found: ${csvFilePath}`);
  }

  const csvContent = fs.readFileSync(csvFilePath, 'utf-8');
  const rows = parseCSV(csvContent);
  const fileName = path.basename(csvFilePath);

  logger.info(`Processing ${rows.length} rows from ${fileName}`);

  let imported = 0;
  let skipped = 0;
  let errors = 0;
  let fetched = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    if (limit && i >= limit) break;

    try {
      const rowSymbol = String(row.symbol || '').trim().toUpperCase();
      const xbrl = String(row.xbrl || '');
      
      if (!xbrl.includes('nsearchives')) {
        skipped++;
        continue;
      }

      const qdateStr = String(row.quarterenddate || '');
      const quarterResult = determineQuarter(qdateStr);
      const year = quarterResult.year;
      const quarter = quarterResult.quarter;
      
      const consolidationType = String(row.consolidatedstandalone || '').toLowerCase().includes('consolidated')
        ? 'Consolidated' : 'Standalone';
      const auditStatus = String(row.auditedunaudited || '').toLowerCase().includes('audited')
        ? 'Audited' : 'Un-Audited';
      const filingType = String(row.typeofsubmission || '').toLowerCase().includes('revision')
        ? 'Revision' : 'Original';

      if (skipExisting) {
        const existing = await QuarterlyFinancial.findOne({
          symbol: rowSymbol,
          year,
          quarter,
          consolidationType,
        });
        if (existing && existing.revenueFromOperations !== null) {
          skipped++;
          continue;
        }
      }

      let financialData: any = {};
      try {
        const xmlData = await fetchAndParseFinancialXML(xbrl);
        if (xmlData) {
          financialData = xmlData;
          fetched++;
        }
      } catch (xmlError) {
        // Continue with empty if XML fails
      }

      const doc: any = {
        symbol: rowSymbol,
        companyName: String(row.companyname || '').trim() || rowSymbol,
        year,
        quarter,
        quarterEndDate: new Date(qdateStr),
        filingType,
        auditStatus,
        consolidationType,
        xbrlUrl: xbrl,
        detailsUrl: String(row.details || ''),
        broadcastDateTime: row.broadcastdatetime ? new Date(String(row.broadcastdatetime)) : new Date(),
        revisedDateTime: row.reviseddatetime ? new Date(String(row.reviseddatetime)) : undefined,
        revisionRemarks: String(row.revisionremarks || ''),
        exchangeDisseminationTime: row.exchangedisseminationtime ? new Date(String(row.exchangedisseminationtime)) : undefined,

        revenueFromOperations: financialData.revenueFromOperations,
        revenueFromOperationsPreviousYear: null,
        otherIncome: financialData.otherIncome,
        otherIncomePreviousYear: null,
        totalRevenue: financialData.totalRevenue || financialData.revenueFromOperations,
        totalRevenuePreviousYear: null,
        costOfMaterialsConsumed: financialData.costOfMaterialsConsumed,
        costOfMaterialsConsumedPreviousYear: null,
        changesInInventoriesOfFinishedGoodsWorkInProgressAndStockInTrade: financialData.changesInInventoriesOfFinishedGoodsWorkInProgressAndStockInTrade,
        changesInInventoriesOfFinishedGoodsWorkInProgressAndStockInTradePreviousYear: null,
        employeeBenefitsExpense: financialData.employeeBenefitsExpense,
        employeeBenefitsExpensePreviousYear: null,
        financeCosts: financialData.financeCosts,
        financeCostsPreviousYear: null,
        depreciationAndAmortisationExpense: financialData.depreciationAndAmortisationExpense,
        depreciationAndAmortisationExpensePreviousYear: null,
        otherExpenses: financialData.otherExpenses,
        otherExpensesPreviousYear: null,
        totalExpenses: financialData.totalExpenses,
        totalExpensesPreviousYear: null,
        profitLossBeforeExceptionalItemsAndTax: financialData.profitLossBeforeExceptionalItemsAndTax,
        profitLossBeforeExceptionalItemsAndTaxPreviousYear: null,
        exceptionalItems: financialData.exceptionalItems,
        exceptionalItemsPreviousYear: null,
        profitLossBeforeTax: financialData.profitLossBeforeTax,
        profitLossBeforeTaxPreviousYear: null,
        taxExpense: financialData.taxExpense,
        taxExpensePreviousYear: null,
        currentTax: financialData.currentTax,
        currentTaxPreviousYear: null,
        deferredTax: financialData.deferredTax,
        deferredTaxPreviousYear: null,
        profitLossForPeriodFromContinuingOperations: financialData.profitLossForPeriodFromContinuingOperations,
        profitLossForPeriodFromContinuingOperationsPreviousYear: null,
        profitLossFromDiscontinuedOperationsBeforeTax: null,
        profitLossFromDiscontinuedOperationsBeforeTaxPreviousYear: null,
        taxExpenseDiscontinuedOperations: null,
        profitLossFromDiscontinuedOperationsAfterTax: null,
        profitLossFromDiscontinuedOperationsAfterTaxPreviousYear: null,
        profitLossForPeriod: financialData.profitLossForPeriod,
        profitLossForPeriodPreviousYear: null,
        profitOrLossAttributableToOwnersOfParent: financialData.profitOrLossAttributableToOwnersOfParent,
        profitOrLossAttributableToOwnersOfParentPreviousYear: null,
        profitOrLossAttributableToNonControllingInterests: financialData.profitOrLossAttributableToNonControllingInterests,
        profitOrLossAttributableToNonControllingInterestsPreviousYear: null,
        comprehensiveIncomeForThePeriod: financialData.comprehensiveIncomeForThePeriod,
        comprehensiveIncomeForThePeriodPreviousYear: null,
        comprehensiveIncomeAttributableToOwnersOfParent: null,
        comprehensiveIncomeAttributableToNonControllingInterests: null,
        totalComprehensiveIncome: financialData.comprehensiveIncomeForThePeriod,
        totalComprehensiveIncomePreviousYear: null,

        basicEarningsPerShareFromContinuingOperations: financialData.basicEarningsPerShareFromContinuingOperations,
        basicEarningsPerShareFromDiscontinuedOperations: financialData.basicEarningsPerShareFromDiscontinuedOperations,
        basicEarningsLossPerShareFromContinuingAndDiscontinuedOperations: financialData.basicEarningsLossPerShareFromContinuingAndDiscontinuedOperations,
        dilutedEarningsPerShareFromContinuingOperations: financialData.dilutedEarningsPerShareFromContinuingOperations,
        dilutedEarningsLossPerShareFromContinuingAndDiscontinuedOperations: financialData.dilutedEarningsLossPerShareFromContinuingAndDiscontinuedOperations,
        faceValuePerShare: financialData.faceValuePerShare,
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

        dividendPerShare: financialData.dividendPerShare,
        dividendPerSharePreviousYear: null,
        dividendDeclaredPerShare: null,

        operatingCashFlow: financialData.cashFlowsFromUsedInOperatingActivities,
        investingCashFlow: financialData.cashFlowsFromUsedInInvestingActivities,
        financingCashFlow: financialData.cashFlowsFromUsedInFinancingActivities,

        freeCashFlow: null,

        paidUpCapital: financialData.equityShareCapital,
        numberOfSharesOutstanding: null,
      };

      if (!dryRun) {
        await QuarterlyFinancial.updateOne(
          { symbol: rowSymbol, year, quarter, consolidationType },
          { $set: doc },
          { upsert: true }
        );
      }

      imported++;
      
      if (imported % 50 === 0) {
        logger.info(`Progress: ${imported} imported, ${fetched} with XML data`);
      }

    } catch (error) {
      errors++;
      if (errors < 5) {
        logger.error(`Error: ${(error as Error).message}`);
      }
    }
  }

  logger.info(`Import complete: ${imported} imported, ${skipped} skipped, ${errors} errors, ${fetched} with XML`);
  return { imported, skipped, errors, fetched };
}

export async function importAllQuarterlyFinancials(
  dataDir: string,
  options: {
    limit?: number;
    skipExisting?: boolean;
    dryRun?: boolean;
  } = {}
): Promise<{ total: number; imported: number; skipped: number; errors: number; fetched: number }> {
  const csvFiles = fs.readdirSync(dataDir).filter(f => f.endsWith('.csv'));

  let totalImported = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  let totalFetched = 0;

  for (const csvFile of csvFiles) {
    const filePath = path.join(dataDir, csvFile);
    if (!fs.existsSync(filePath)) continue;

    logger.info(`\n=== Processing ${csvFile} ===`);
    const result = await importQuarterlyFinancials(filePath, options);

    totalImported += result.imported;
    totalSkipped += result.skipped;
    totalErrors += result.errors;
    totalFetched += result.fetched;
  }

  return {
    total: totalImported + totalSkipped + totalErrors,
    imported: totalImported,
    skipped: totalSkipped,
    errors: totalErrors,
    fetched: totalFetched,
  };
}

export async function getFinancialSummary() {
  const totalRecords = await QuarterlyFinancial.countDocuments();

  const byQuarter: Record<string, number> = {};
  const byConsolidation: Record<string, number> = {};

  const quarterCounts = await QuarterlyFinancial.aggregate([
    { $group: { _id: { quarter: '$quarter', year: '$year' }, count: { $sum: 1 } } },
  ]);

  for (const item of quarterCounts) {
    const key = `${item._id.quarter} FY${item._id.year}`;
    byQuarter[key] = item.count;
  }

  const consolidationCounts = await QuarterlyFinancial.aggregate([
    { $group: { _id: '$consolidationType', count: { $sum: 1 } } },
  ]);

  for (const item of consolidationCounts) {
    byConsolidation[item._id || 'Unknown'] = item.count;
  }

  const withData = await QuarterlyFinancial.countDocuments({ revenueFromOperations: { $gt: 0 } });

  return {
    totalRecords,
    byQuarter,
    byConsolidation,
    withFinancialData: withData,
  };
}