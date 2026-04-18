import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { XMLParser } from 'fast-xml-parser';
import { QuarterlyFinancial } from '../models/QuarterlyFinancial.js';
import { connectDB, isDbConnected } from '../config/database.js';
import { logger } from '../utils/logger.js';

const require = createRequire(import.meta.url);
const https = require('https');

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
        if (!data) { resolve(null); return; }
        
        try {
          const parsed = xmlParser.parse(data);
          const xbrl = parsed['xbrli:xbrl'];
          if (!xbrl) { resolve(null); return; }

          const getValue = (tag: string) => {
            const element = xbrl[tag];
            if (!element) return null;
            
            let value = null;
            let decimals = null;
            
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

async function fetchFinancialData() {
  console.log('\n=== Fetching Financial Data from XML ===\n');

  const totalRecords = await QuarterlyFinancial.countDocuments();
  console.log(`Total records in database: ${totalRecords}`);

  const recordsNeedingData = await QuarterlyFinancial.find({
    $or: [
      { revenueFromOperations: null },
      { revenueFromOperations: { $exists: false } }
    ]
  }).limit(8862);

  console.log(`Records needing data: ${recordsNeedingData.length}`);

  if (recordsNeedingData.length === 0) {
    const withData = await QuarterlyFinancial.countDocuments({ revenueFromOperations: { $gt: 0 } });
    console.log(`Records with financial data: ${withData}`);
    console.log('\nAll records already have financial data!');
    return;
  }

  let processed = 0;
  let success = 0;
  let failed = 0;

  for (const record of recordsNeedingData) {
    if (!record.xbrlUrl) {
      failed++;
      continue;
    }

    console.log(`Processing: ${record.symbol} ${record.quarter} FY${record.year}...`);

    try {
      const xmlData = await fetchAndParseFinancialXML(record.xbrlUrl);
      
      if (xmlData) {
        await QuarterlyFinancial.updateOne(
          { _id: record._id },
          { $set: { ...xmlData } }
        );
        success++;
        console.log(`  ✓ Fetched: Revenue: ${xmlData.revenueFromOperations}, Profit: ${xmlData.profitLossForPeriod}`);
      } else {
        failed++;
        console.log(`  ✗ Failed to parse XML`);
      }
    } catch (e) {
      failed++;
      console.log(`  ✗ Error: ${(e as Error).message}`);
    }

    processed++;
    
    if (processed % 10 === 0) {
      console.log(`\nProgress: ${processed} processed, ${success} success, ${failed} failed\n`);
    }
  }

  console.log(`\n=== Complete ===`);
  console.log(`Processed: ${processed}`);
  console.log(`Success: ${success}`);
  console.log(`Failed: ${failed}`);
}

async function main() {
  if (!isDbConnected()) {
    console.log('Connecting to MongoDB...');
    await connectDB();
  }
  
  await fetchFinancialData();
  
  process.exit(0);
}

(async () => {
  await main();
})();