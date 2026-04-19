#!/usr/bin/env python3
import csv
import re
import time
import requests
from datetime import datetime
from pymongo import MongoClient

def clean_column_name(col):
    return col.strip().replace('"', '').replace('\n', '')

def parse_quarter_date(date_str):
    if not date_str or not isinstance(date_str, str):
        return ('Unknown', 0)
    date_str = date_str.strip().upper()
    match = re.match(r'(\d{1,2})[-/](JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[-/](\d{4})', date_str)
    if match:
        day, month, year = match.groups()
        month_map = {'MAR': 'Q4', 'JUN': 'Q2', 'SEP': 'Q3', 'DEC': 'Q4'}
        if month in month_map:
            return (month_map[month], int(year))
    return ('Unknown', 0)

def parse_number(value):
    if value is None or (isinstance(value, str) and not value.strip()):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    value_str = str(value).strip()
    if value_str in ['-', 'NA', 'N/A', '', 'Nil', 'NONE']:
        return None
    is_negative = False
    if value_str.startswith('(') and value_str.endswith(')'):
        is_negative = True
        value_str = value_str[1:-1]
    value_str = value_str.replace(',', '').replace(' ', '')
    try:
        result = float(value_str)
        return -result if is_negative else result
    except ValueError:
        return None

def parse_number_with_scale(value, decimals):
    try:
        num = parse_number(value)
        if num is None:
            return None
        if decimals and decimals != 'INF':
            scale = int(decimals)
            return num * (10 ** abs(scale))
        return num
    except:
        return None

def extract_financials_from_xbrl(xml_content):
    financials = {'revenue': None, 'profit': None, 'profitBeforeTax': None, 'eps': None}
    if not xml_content:
        return financials
    patterns = {
        'revenue': r'in-capmkt:(?:RevenueFromOperations|TotalRevenue) contextRef="(?:OneD|FourD)" decimals="([^"]+)" unitRef="INR">([^<]+)',
        'profitBeforeTax': r'in-capmkt:ProfitLossBeforeTax contextRef="(?:OneD|FourD)" decimals="([^"]+)" unitRef="INR">([^<]+)',
        'profit': r'in-capmkt:(?:ProfitLossForPeriod|NetProfitLoss) contextRef="(?:OneD|FourD)" decimals="([^"]+)" unitRef="INR">([^<]+)',
        'eps': r'in-capmkt:EarningsPerEquityShare contextRef="(?:OneD|FourD)" decimals="([^"]+)" unitRef="INR">([^<]+)',
    }
    for field, pattern in patterns.items():
        matches = re.findall(pattern, xml_content, re.IGNORECASE)
        if matches:
            decimals, value = matches[0]
            parsed = parse_number_with_scale(value.strip(), decimals)
            if parsed is not None:
                financials[field] = parsed
    return financials

# Find TCS records
csv_folder = '.'
records = []
for csv_file in ['../CF-Integrated-Filing-equities-Integrated Filing- Financials-18-Apr-2026.csv']:
    try:
        with open(csv_file, 'r', encoding='utf-8-sig', errors='replace') as f:
            reader = csv.reader(f)
            headers = next(reader)
            headers = [clean_column_name(h) for h in headers]
            symbol_idx = next((i for i, h in enumerate(headers) if 'SYMBOL' in h), None)
            company_idx = next((i for i, h in enumerate(headers) if 'COMPANY' in h and 'NAME' in h), None)
            quarter_date_idx = next((i for i, h in enumerate(headers) if 'QUARTER' in h and 'DATE' in h), None)
            xbrl_idx = next((i for i, h in enumerate(headers) if h == 'XBRL'), None)
            for row in reader:
                if len(row) > max(filter(None, [symbol_idx, company_idx, quarter_date_idx, xbrl_idx])):
                    symbol = clean_column_name(row[symbol_idx]) if symbol_idx is not None and symbol_idx < len(row) else ''
                    if symbol == 'TCS':
                        record = {
                            'symbol': symbol,
                            'companyName': clean_column_name(row[company_idx]) if company_idx is not None and company_idx < len(row) else '',
                            'quarterEndDate': clean_column_name(row[quarter_date_idx]) if quarter_date_idx is not None and quarter_date_idx < len(row) else '',
                            'xbrlUrl': clean_column_name(row[xbrl_idx]) if xbrl_idx is not None and xbrl_idx < len(row) else '',
                        }
                        if record['symbol'] and record['xbrlUrl']:
                            records.append(record)
    except Exception as e:
        print(f'Error: {e}')

print(f'Found {len(records)} TCS records')

client = MongoClient('mongodb://localhost:27017/stockpulse')
db = client['stockpulse']
collection = db['companies']

for record in records[:4]:
    print(f"Processing {record['quarterEndDate']}...")
    quarter, year = parse_quarter_date(record['quarterEndDate'])
    print(f"Quarter: {quarter} {year}")

    try:
        resp = requests.get(record['xbrlUrl'], timeout=30)
        if resp.status_code == 200:
            financials = extract_financials_from_xbrl(resp.text)
            print(f"Revenue: {financials['revenue']}, Profit: {financials['profit']}, EPS: {financials['eps']}")

            quarter_data = {
                'quarter': quarter,
                'year': year,
                'revenue': financials.get('revenue'),
                'profit': financials.get('profit'),
                'eps': financials.get('eps'),
                'profitMargin': financials.get('profit') / financials.get('revenue') if financials.get('revenue') and financials.get('profit') else None,
            }

            collection.update_one(
                {'symbol': 'TCS'},
                {
                    '$set': {
                        'symbol': 'TCS',
                        'companyName': record['companyName'],
                        'financials': {'quarterly': [quarter_data]},
                        'lastUpdated': datetime.utcnow()
                    }
                },
                upsert=True
            )
            print('Upserted!')
    except Exception as e:
        print(f'Error: {e}')
    time.sleep(0.5)