import type { Metadata, Viewport } from 'next';
import dynamic from 'next/dynamic';
import './globals.css';
import { ChartProvider } from '@/lib/contexts/ChartContext';
import { MarketStreamProvider } from '@/lib/hooks/useMarketStream';
import { Header }        from '@/components/layout/Header';
import { Sidebar }       from '@/components/layout/Sidebar';
import { MarketTicker }  from '@/components/layout/MarketTicker';

const ChartModal = dynamic(
  () => import('@/components/charts/ChartModal').then(m => ({ default: m.ChartModal }))
);

export const metadata: Metadata = {
  title:       'StockPulse — Indian Markets',
  description: 'Professional real-time stock market terminal for NSE & BSE — live quotes, charts, portfolio & news.',
  keywords:    'NSE, BSE, Indian stocks, NIFTY, SENSEX, stock charts, portfolio tracker',
};

export const viewport: Viewport = {
  width:        'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="preconnect" href="https://s3.tradingview.com" />
        <link rel="dns-prefetch" href="https://s3.tradingview.com" />
      </head>
      <body>
        <MarketStreamProvider>
          <ChartProvider>
            <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
              <Header />
              <MarketTicker />
              <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                <Sidebar />
                <main
                  style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}
                  className="scrollbar-thin"
                >
                  {children}
                </main>
              </div>
            </div>
            <ChartModal />
          </ChartProvider>
        </MarketStreamProvider>
      </body>
    </html>
  );
}