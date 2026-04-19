#!/usr/bin/env python3
"""
NSE Financial Data Ingestion Pipeline
Fetches XBRL financial data from NSE CSV filings and stores in MongoDB.
"""

import os
import re
import csv
import json
import math
import time
import xml.etree.ElementTree as ET
from datetime import datetime
from typing import Dict, List, Optional, Any, Tuple
from pathlib import Path
from collections import defaultdict

import pandas as pd
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, OperationFailure
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from dotenv import load_dotenv

load_dotenv("backend/.env")

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/stockpulse")
CSV_FOLDER = os.path.join(os.path.dirname(__file__), "..")
BATCH_SIZE = 50
REQUEST_TIMEOUT = 30
MAX_RETRIES = 3
MAX_RECORDS = 5000

MONGO_CLIENT: Optional[MongoClient] = None
REQUEST_SESSION: Optional[requests.Session] = None

FINANCIAL_TAGS = [
    "RevenueFromOperations",
    "TotalRevenue",
    "ProfitLossForThePeriod",
    "ProfitLossBeforeTax",
    "ProfitLossAfterTax",
    "NetProfitLoss",
    "EarningsPerEquityShare",
    "TotalAssets",
    "TotalLiabilities",
    "TotalEquity",
    "CashFromOperations",
    "CashFromInvesting",
    "CashFromFinancing",
]

CONTEXT_PERIODS = {
    "OneD": ("Q1", 1),
    "TwoD": ("Q2", 2),
    "ThreeD": ("Q3", 3),
    "FourD": ("Q4", 4),
    "YTD": ("FY", 5),
}


def init_mongo() -> MongoClient:
    """Initialize MongoDB connection."""
    global MONGO_CLIENT
    if MONGO_CLIENT is None:
        try:
            MONGO_CLIENT = MongoClient(MONGODB_URI)
            MONGO_CLIENT.admin.command("ping")
            print(f"Connected to MongoDB: {MONGODB_URI}")
        except ConnectionFailure as e:
            print(f"Failed to connect to MongoDB: {e}")
            raise
    return MONGO_CLIENT


def init_requests_session() -> requests.Session:
    """Initialize requests session with retry logic."""
    global REQUEST_SESSION
    if REQUEST_SESSION is None:
        REQUEST_SESSION = requests.Session()
        retry_strategy = Retry(
            total=MAX_RETRIES,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        REQUEST_SESSION.mount("http://", adapter)
        REQUEST_SESSION.mount("https://", adapter)
    return REQUEST_SESSION


def clean_column_name(col: str) -> str:
    """Clean column name by removing extra spaces and quotes."""
    return col.strip().replace('"', "").replace("\n", "")


def parse_quarter_date(date_str: str) -> Tuple[str, int]:
    """
    Parse quarter end date to extract quarter and year.
    Examples: '31-MAR-2025' -> ('Q4', 2025), '30-JUN-2025' -> ('Q2', 2025)
    """
    if not date_str or not isinstance(date_str, str):
        return ("Unknown", 0)
    
    date_str = date_str.strip().upper()
    month_map = {
        "MAR": ("Q4", 1), "JUN": ("Q2", 2), "SEP": ("Q3", 3), "DEC": ("Q4", 4)
    }
    
    match = re.match(r"(\d{1,2})[-/](JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[-/](\d{4})", date_str)
    if match:
        day, month, year = match.groups()
        year = int(year)
        
        if month in month_map:
            q, q_num = month_map[month]
            return (q, year)
        
        month_num = {"JAN": 1, "FEB": 2, "MAR": 3, "APR": 4, "MAY": 5, "JUN": 6,
                  "JUL": 7, "AUG": 8, "SEP": 9, "OCT": 10, "NOV": 11, "DEC": 12}.get(month, 0)
        
        if month_num <= 3:
            return ("Q4", year - 1)
        elif month_num <= 6:
            return ("Q1", year)
        elif month_num <= 9:
            return ("Q2", year)
        else:
            return ("Q3", year)
    
    return ("Unknown", 0)


def parse_number(value: Any) -> Optional[float]:
    """Parse number from string, handling various formats."""
    if value is None or (isinstance(value, str) and not value.strip()):
        return None
    
    if isinstance(value, (int, float)):
        return float(value)
    
    value_str = str(value).strip()
    
    if value_str in ["-", "NA", "N/A", "", "Nil", "NONE"]:
        return None
    
    is_negative = False
    if value_str.startswith("(") and value_str.endswith(")"):
        is_negative = True
        value_str = value_str[1:-1]
    
    value_str = value_str.replace(",", "").replace(" ", "")
    
    try:
        result = float(value_str)
        return -result if is_negative else result
    except ValueError:
        return None


def parse_xbrl_value(element: ET.Element, tag: str, context_ref: str) -> Optional[float]:
    """Parse XBRL value from XML element with given tag and context."""
    ns_tag = f"{{http://www.sebi.gov.in/xbrl/IntegratedFinance_IndAS/2026-01-31/in-capmkt/in-capmkt-ent}}{tag}"
    
    for elem in element.findall(ns_tag):
        if elem.get("contextRef") == context_ref:
            value = elem.text
            if value:
                decimals = elem.get("decimals", "0")
                return parse_number_with_scale(value, decimals)
    return None


def parse_number_with_scale(value: str, decimals: str) -> Optional[float]:
    """Parse number considering the decimals scale."""
    try:
        num = parse_number(value)
        if num is None:
            return None
        
        if decimals and decimals != "INF":
            scale = int(decimals)
            return num * (10 ** abs(scale))
        return num
    except (ValueError, TypeError):
        return None


def extract_financials_from_xbrl(xml_content: str, year: int, quarter: str) -> Dict[str, Any]:
    """Extract financial metrics from XBRL XML content using regex."""
    financials = {
        "revenue": None,
        "profit": None,
        "profitBeforeTax": None,
        "eps": None,
        "totalAssets": None,
        "totalLiabilities": None,
        "totalEquity": None,
        "cashFromOperations": None,
        "cashFromInvesting": None,
        "cashFromFinancing": None,
    }
    
    if not xml_content:
        return financials
    
    import re
    
    patterns = {
        "revenue": r'in-capmkt:(?:RevenueFromOperations|TotalRevenue) contextRef="(?:OneD|FourD)" decimals="([^"]+)" unitRef="INR">([^<]+)',
        "profitBeforeTax": r'in-capmkt:ProfitLossBeforeTax contextRef="(?:OneD|FourD)" decimals="([^"]+)" unitRef="INR">([^<]+)',
        "profit": r'in-capmkt:(?:ProfitLossForPeriod|NetProfitLoss) contextRef="(?:OneD|FourD)" decimals="([^"]+)" unitRef="INR">([^<]+)',
        "eps": r'in-capmkt:EarningsPerEquityShare contextRef="(?:OneD|FourD)" decimals="([^"]+)" unitRef="INR">([^<]+)',
        "totalAssets": r'in-capmkt:TotalAssets contextRef="(?:OneI|FourI)" decimals="([^"]+)" unitRef="INR">([^<]+)',
        "totalLiabilities": r'in-capmkt:TotalLiabilities contextRef="(?:OneI|FourI)" decimals="([^"]+)" unitRef="INR">([^<]+)',
        "totalEquity": r'in-capmkt:TotalEquity contextRef="(?:OneI|FourI)" decimals="([^"]+)" unitRef="INR">([^<]+)',
        "cashFromOperations": r'in-capmkt:CashFlowFromOperations contextRef="(?:OneD|FourD)" decimals="([^"]+)" unitRef="INR">([^<]+)',
        "cashFromInvesting": r'in-capmkt:CashFlowFromInvestingActivities contextRef="(?:OneD|FourD)" decimals="([^"]+)" unitRef="INR">([^<]+)',
        "cashFromFinancing": r'in-capmkt:CashFlowFromFinancingActivities contextRef="(?:OneD|FourD)" decimals="([^"]+)" unitRef="INR">([^<]+)',
    }
    
    try:
        for field, pattern in patterns.items():
            matches = re.findall(pattern, xml_content, re.IGNORECASE)
            if matches:
                decimals, value = matches[0]
                parsed = parse_number_with_scale(value.strip(), decimals)
                if parsed is not None:
                    financials[field] = parsed
    except Exception as e:
        print(f"Error extracting {field}: {e}")
    
    return financials


def fetch_xbrl_data(url: str) -> Optional[str]:
    """Fetch XBRL XML data from URL."""
    if not url:
        return None
    
    session = init_requests_session()
    
    try:
        response = session.get(url, timeout=REQUEST_TIMEOUT, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        })
        
        if response.status_code == 200:
            return response.text
        else:
            print(f"Failed to fetch {url}: HTTP {response.status_code}")
            return None
            
    except requests.RequestException as e:
        print(f"Request error for {url}: {e}")
        return None


def read_csv_files(folder_path: str) -> List[Dict[str, str]]:
    """Read all CSV files from folder and return records."""
    records = []
    folder = Path(folder_path)
    
    if not folder.exists():
        print(f"Folder not found: {folder_path}")
        return records
    
    csv_files = list(folder.glob("*.csv"))
    
    for csv_file in csv_files:
        print(f"Reading: {csv_file.name}")
        try:
            with open(csv_file, "r", encoding="utf-8-sig", errors="replace") as f:
                reader = csv.reader(f)
                headers = next(reader)
                
                headers = [clean_column_name(h) for h in headers]
                
                symbol_idx = None
                company_idx = None
                quarter_date_idx = None
                xbrl_idx = None
                consolidated_idx = None
                
                for i, h in enumerate(headers):
                    if "SYMBOL" in h:
                        symbol_idx = i
                    elif "COMPANY" in h and "NAME" in h:
                        company_idx = i
                    elif "QUARTER" in h and "DATE" in h:
                        quarter_date_idx = i
                    elif h == "XBRL":
                        xbrl_idx = i
                    elif "CONSOLIDATED" in h:
                        consolidated_idx = i
                
                for row in reader:
                    if len(row) > max(filter(None, [symbol_idx, company_idx, quarter_date_idx, xbrl_idx])):
                        record = {
                            "symbol": clean_column_name(row[symbol_idx]) if symbol_idx is not None and symbol_idx < len(row) else "",
                            "companyName": clean_column_name(row[company_idx]) if company_idx is not None and company_idx < len(row) else "",
                            "quarterEndDate": clean_column_name(row[quarter_date_idx]) if quarter_date_idx is not None and quarter_date_idx < len(row) else "",
                            "xbrlUrl": clean_column_name(row[xbrl_idx]) if xbrl_idx is not None and xbrl_idx < len(row) else "",
                            "consolidated": clean_column_name(row[consolidated_idx]) if consolidated_idx is not None and consolidated_idx < len(row) else "Standalone",
                        }
                        
                        if record["symbol"] and record["xbrlUrl"]:
                            records.append(record)
                            
        except Exception as e:
            print(f"Error reading {csv_file}: {e}")
    
    print(f"Total records extracted: {len(records)}")
    return records


def process_records(records: List[Dict[str, str]], limit: int = None) -> Dict[str, Dict]:
    """Process records and group by company."""
    companies = defaultdict(lambda: {
        "symbol": "",
        "companyName": "",
        "financials": {"quarterly": []},
        "metadata": {},
        "lastUpdated": datetime.utcnow()
    })
    
    processed = 0
    failed = 0
    
    if limit:
        records = records[:limit]
    
    for record in records:
        symbol = record.get("symbol", "").upper().strip()
        company_name = record.get("companyName", "")
        quarter_date = record.get("quarterEndDate", "")
        xbrl_url = record.get("xbrlUrl", "")
        consolidated = record.get("consolidated", "Standalone")
        
        if not symbol or not xbrl_url:
            continue
        
        quarter, year = parse_quarter_date(quarter_date)
        
        if symbol not in companies:
            companies[symbol]["symbol"] = symbol
            companies[symbol]["companyName"] = company_name
        
        existing_quarters = {q["quarter"]: q["year"] for q in companies[symbol]["financials"]["quarterly"]}
        if year in existing_quarters.values():
            existing_year = [y for q, y in existing_quarters.items() if y == year]
            if existing_year:
                continue
        
        print(f"Fetching: {symbol} - {quarter} {year} from {xbrl_url[:50]}...")
        
        xml_content = fetch_xbrl_data(xbrl_url)
        
        if xml_content:
            financials = extract_financials_from_xbrl(xml_content, year, quarter)
            
            quarter_data = {
                "quarter": quarter,
                "year": year,
                "revenue": financials.get("revenue"),
                "profit": financials.get("profit"),
                "profitBeforeTax": financials.get("profitBeforeTax"),
                "eps": financials.get("eps"),
                "totalAssets": financials.get("totalAssets"),
                "totalLiabilities": financials.get("totalLiabilities"),
                "totalEquity": financials.get("totalEquity"),
                "cashFromOperations": financials.get("cashFromOperations"),
                "cashFromInvesting": financials.get("cashFromInvesting"),
                "cashFromFinancing": financials.get("cashFromFinancing"),
                "source": "NSE",
                "consolidated": consolidated == "Consolidated",
                "filingDate": datetime.utcnow().isoformat(),
            }
            
            revenue = quarter_data.get("revenue")
            profit = quarter_data.get("profit")
            
            if revenue and profit is not None and revenue != 0:
                quarter_data["profitMargin"] = profit / revenue
            else:
                quarter_data["profitMargin"] = None
            
            companies[symbol]["financials"]["quarterly"].append(quarter_data)
            processed += 1
        else:
            failed += 1
        
        time.sleep(0.2)
    
    for symbol in companies:
        quarterly = companies[symbol]["financials"]["quarterly"]
        quarterly.sort(key=lambda x: (x.get("year", 0), {"Q1": 1, "Q2": 2, "Q3": 3, "Q4": 4, "FY": 5}.get(x.get("quarter", ""), 0)), reverse=True)
        
        for i, q in enumerate(quarterly):
            if i < len(quarterly) - 1:
                prev = quarterly[i + 1]
                curr_rev = q.get("revenue")
                prev_rev = prev.get("revenue")
                
                if curr_rev and prev_rev and prev_rev != 0:
                    q["revenueGrowthQoQ"] = ((curr_rev - prev_rev) / prev_rev) * 100
                else:
                    q["revenueGrowthQoQ"] = None
            else:
                q["revenueGrowthQoQ"] = None
    
    print(f"Processed: {processed}, Failed: {failed}")
    return dict(companies)


def upsert_companies(companies: Dict[str, Dict]) -> int:
    """Insert or update company documents in MongoDB."""
    client = init_mongo()
    db_name = "stockpulse"
    db = client[db_name]
    collection = db["companies"]
    
    collection.create_index("symbol", unique=True)
    collection.create_index("financials.quarterly.year")
    
    upserted = 0
    
    for symbol, data in companies.items():
        if not data.get("symbol"):
            continue
        
        try:
            result = collection.update_one(
                {"symbol": data["symbol"]},
                {
                    "$set": {
                        "symbol": data["symbol"],
                        "companyName": data["companyName"],
                        "financials": data["financials"],
                        "metadata": data["metadata"],
                        "lastUpdated": datetime.utcnow()
                    }
                },
                upsert=True
            )
            
            if result.upserted_id or result.modified_count > 0:
                upserted += 1
                print(f"Upserted: {symbol}")
                
        except OperationFailure as e:
            print(f"MongoDB error for {symbol}: {e}")
        except Exception as e:
            print(f"Error upserting {symbol}: {e}")
    
    return upserted


def main():
    """Main function to run the ingestion pipeline."""
    print("=" * 60)
    print("NSE Financial Data Ingestion Pipeline")
    print("=" * 60)
    
    csv_folder = CSV_FOLDER
    print(f"\nCSV Folder: {csv_folder}")
    
    print("\n[1/4] Reading CSV files...")
    records = read_csv_files(csv_folder)
    
    if not records:
        print("No records found. Exiting.")
        return
    
    print("\n[2/4] Processing records and fetching XBRL data...")
    companies = process_records(records, limit=MAX_RECORDS)
    
    if not companies:
        print("No company data processed. Exiting.")
        return
    
    print("\n[3/4] Upserting to MongoDB...")
    upserted = upsert_companies(companies)
    
    print("\n[4/4] Done!")
    print(f"Total companies: {len(companies)}")
    print(f"Upserted: {upserted}")
    print("=" * 60)


if __name__ == "__main__":
    main()