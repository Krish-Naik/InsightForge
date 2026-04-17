declare module 'screener-scraper-pro' {
  interface ScreenerData {
    analysis: {
      pros: string[];
      cons: string[];
    };
    quarters: {
      headers: string[];
      rows: Record<string, any>[];
      annualReports: Record<string, any>[];
    };
    ratios: Record<string, any>;
    peers: Record<string, any>[];
    financials: {
      profitAndLoss: any;
      balanceSheet: any;
      cashFlow: any;
    };
  }
  export function ScreenerScraperPro(url: string): Promise<ScreenerData>;
  export default function ScreenerScraperPro(url: string): Promise<ScreenerData>;
}