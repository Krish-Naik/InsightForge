import type { Metadata, Viewport } from 'next';
import dynamic from 'next/dynamic';
import { IBM_Plex_Mono, Public_Sans, Space_Grotesk } from 'next/font/google';
import './globals.css';
import { ChartProvider } from '@/lib/contexts/ChartContext';
import { MarketStreamProvider } from '@/lib/hooks/useMarketStream';
import { Header }        from '@/components/layout/Header';
import { Sidebar }       from '@/components/layout/Sidebar';
import { MarketTicker }  from '@/components/layout/MarketTicker';

const ChartModal = dynamic(
  () => import('@/components/charts/ChartModal').then(m => ({ default: m.ChartModal }))
);

const displayFont = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
});

const bodyFont = Public_Sans({
  subsets: ['latin'],
  variable: '--font-body',
});

const monoFont = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title:       'InsightForge — Intelligent Trading Companion',
  description: 'Decision-first market companion for Indian retail traders — ranked opportunities, market narratives, sector rotation, and watchlists.',
  keywords:    'NSE, BSE, Indian stocks, trading companion, stock stories, market narratives, sector rotation, watchlist',
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
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var theme = localStorage.getItem('theme');
                if (theme) document.documentElement.setAttribute('data-theme', theme);
              })();
            `,
          }}
        />
      </head>
      <body className={`${displayFont.variable} ${bodyFont.variable} ${monoFont.variable}`}>
        <MarketStreamProvider>
          <ChartProvider>
            <div className="app-shell">
              <Header />
              <MarketTicker />
              <div className="app-body">
                <Sidebar />
                <main className="app-main scrollbar-thin">
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