const https = require('https');
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

const url = 'https://nsearchives.nseindia.com/corporate/xbrl/INTEGRATED_FILING_INDAS_1653607_17042026071354_WEB.xml';
const urlObj = new URL(url);

const options = {
  hostname: urlObj.hostname,
  path: urlObj.pathname,
  method: 'GET',
  timeout: 20000,
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('Data length:', data.length);
    const parsed = xmlParser.parse(data);
    const xbrl = parsed['xbrli:xbrl'];
    console.log('xbrl exists:', !!xbrl);
    
    if (!xbrl) {
      console.log('parsed keys:', Object.keys(parsed));
      return;
    }
    
    const element = xbrl['in-capmkt:RevenueFromOperations'];
    console.log('Revenue element:', element);
    console.log('Type:', typeof element);
    
    if (element) {
      const attrs = element['@_'] || {};
      const value = element['#text'] ?? element;
      console.log('attrs:', attrs);
      console.log('value:', value);
      console.log('parsed number:', parseNumber(value, attrs?.decimals));
    }
  });
});
req.on('error', console.error);
req.end();