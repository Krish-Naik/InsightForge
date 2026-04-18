const { XMLParser } = require('fast-xml-parser');

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseAttributeValue: true,
  parseTagValue: true,
  trimValues: true,
});

function parseNumber(value, decimals) {
  if (value === undefined || value === null || value === '') return null;
  const num = typeof value === 'number' ? value : parseFloat(String(value).replace(/,/g, ''));
  if (isNaN(num)) return null;
  if (decimals !== undefined) {
    const dec = parseInt(decimals);
    if (!isNaN(dec)) return num * Math.pow(10, dec);
  }
  return num;
}

const https = require('https');

async function fetchAndParseFinancialXML(xmlUrl) {
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

    const req = https.request(options, (res) => {
      if (res.statusCode !== 200) {
        resolve(null);
        return;
      }
      
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (!data) { resolve(null); return; }
        
        try {
          const parsed = xmlParser.parse(data);
          const xbrl = parsed['xbrli:xbrl'];
          if (!xbrl) { resolve(null); return; }

          const getValue = (tag) => {
            const element = xbrl[tag];
            if (!element) return null;
            const attrs = element['@_'] || {};
            const value = element['#text'] ?? element;
            return parseNumber(value, attrs?.decimals);
          };

          resolve({
            revenueFromOperations: getValue('in-capmkt:RevenueFromOperations'),
            profitLossForPeriod: getValue('in-capmkt:ProfitLossForPeriod'),
            totalAssets: getValue('in-capmkt:Assets') || getValue('in-capmkt:TotalAssets'),
            totalEquity: getValue('in-capmkt:TotalEquity'),
            profitLossBeforeTax: getValue('in-capmkt:ProfitLossBeforeTax') || getValue('in-capmkt:ProfitBeforeTax'),
            equityShareCapital: getValue('in-capmkt:EquityShareCapital') || getValue('in-capmkt:PaidUpValueOfEquityShareCapital'),
            basicEarningsLossPerShareFromContinuingAndDiscontinuedOperations: getValue('in-capmkt:BasicEarningsLossPerShareFromContinuingAndDiscontinuedOperations'),
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

async function test() {
  const url = 'https://nsearchives.nseindia.com/corporate/xbrl/INTEGRATED_FILING_INDAS_1653607_17042026071354_WEB.xml';
  console.log('Fetching XML...');
  const result = await fetchAndParseFinancialXML(url);
  console.log('Result:', JSON.stringify(result, null, 2));
}

test().then(() => process.exit(0)).catch(e => { console.log(e); process.exit(1); });