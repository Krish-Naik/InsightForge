# NSE Financial Data Ingestion Pipeline

## Overview
This script reads NSE financial filing CSVs, fetches XBRL data from the URLs, extracts financial metrics, and stores them in MongoDB in a company-wise structure.

## Usage

```bash
# Run with default settings (500 records)
python scripts/ingest_nse_financials.py

# Run all records (set MAX_RECORDS in script)
```

## Environment Variables
- `MONGODB_URI` - MongoDB connection string (default: mongodb://localhost:27017/insightforge)
- `CSV_FOLDER` - Path to CSV files (default: backend folder)

## MongoDB Schema

```json
{
  "symbol": "TCS",
  "companyName": "Tata Consultancy Services",
  "financials": {
    "quarterly": [
      {
        "quarter": "Q4",
        "year": 2025,
        "revenue": 269320000000000,
        "profit": 23280000000000,
        "profitBeforeTax": null,
        "eps": null,
        "profitMargin": 0.0864,
        "revenueGrowthQoQ": null
      }
    ]
  },
  "metadata": {},
  "lastUpdated": "2026-04-18T09:59:10.739000"
}
```

## Extracted Fields
- `revenue` - Revenue from operations (INR)
- `profit` - Net profit/loss (INR)
- `profitBeforeTax` - Profit before tax (INR)
- `eps` - Earnings per share (INR)
- `totalAssets`, `totalLiabilities`, `totalEquity` - Balance sheet items
- `cashFromOperations`, `cashFromInvesting`, `cashFromFinancing` - Cash flow
- `profitMargin` - profit / revenue (percentage)
- `revenueGrowthQoQ` - Revenue growth vs previous quarter (%)

## Features
- Fetches XBRL XML from NSE URLs
- Handles scale/decimals in XBRL (e.g., -3 = thousands, -5 = lakhs)
- Deduplicates quarters (latest submission wins)
- Computes profit margin and QoQ growth
- Upserts to avoid duplicates across runs

## Running Full Ingestion
Edit `MAX_RECORDS` in the script to process all records:
```python
MAX_RECORDS = None  # Process all records
```