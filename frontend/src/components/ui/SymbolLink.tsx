'use client';
import type { ButtonHTMLAttributes, MouseEvent, ReactNode } from 'react';
import { useChart } from '@/lib/contexts/ChartContext';

interface SymbolLinkProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  symbol: string;
  exchange?: string;
  children: ReactNode;
}

/**
 * Clicking a symbol opens the in-app chart modal — never redirects to TradingView.
 */
export function SymbolLink({ symbol, exchange = 'NSE', children, className, style, onClick, ...buttonProps }: SymbolLinkProps) {
  const { openChart } = useChart();

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    onClick?.(e);
    openChart(symbol, exchange);
  };

  return (
    <button type="button" onClick={handleClick} className={className} style={style} title={`View ${symbol} chart`} {...buttonProps}>
      {children}
    </button>
  );
}
