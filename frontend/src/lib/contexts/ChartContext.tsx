'use client';
import React, { createContext, useContext, useState, useCallback } from 'react';

interface ChartContextType {
  activeSymbol: string | null;
  exchange: string;
  openChart: (symbol: string, exchange?: string) => void;
  closeChart: () => void;
}

const ChartContext = createContext<ChartContextType>({
  activeSymbol: null,
  exchange: 'NSE',
  openChart: () => {},
  closeChart: () => {},
});

export function ChartProvider({ children }: { children: React.ReactNode }) {
  const [activeSymbol, setActiveSymbol] = useState<string | null>(null);
  const [exchange, setExchange] = useState('NSE');

  const openChart = useCallback((symbol: string, exch = 'NSE') => {
    setActiveSymbol(symbol);
    setExchange(exch);
  }, []);

  const closeChart = useCallback(() => {
    setActiveSymbol(null);
  }, []);

  return (
    <ChartContext.Provider value={{ activeSymbol, exchange, openChart, closeChart }}>
      {children}
    </ChartContext.Provider>
  );
}

export const useChart = () => useContext(ChartContext);
