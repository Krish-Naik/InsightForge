'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';

interface StreamData {
  type: string;
  indices?: any[];
  gainers?: any[];
  losers?: any[];
  mostActive?: any[];
  [key: string]: any;
}

interface MarketStreamState {
  data: StreamData | null;
  connected: boolean;
  error: string | null;
  lastEventAt: string | null;
}

const defaultState: MarketStreamState = {
  data: null,
  connected: false,
  error: null,
  lastEventAt: null,
};

const MarketStreamContext = createContext<MarketStreamState>(defaultState);

export function MarketStreamProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<StreamData | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastEventAt, setLastEventAt] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const disposedRef = useRef(false);

  useEffect(() => {
    disposedRef.current = false;

    function clearConnection() {
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    }

    function clearReconnectTimer() {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    }

    function scheduleReconnect() {
      if (disposedRef.current || reconnectTimerRef.current !== null) return;

      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null;
        connect();
      }, 5000);
    }

    function connect() {
      if (disposedRef.current) return;

      clearConnection();

      const es = new EventSource('/api/stream/market');
      esRef.current = es;

      es.onopen = () => {
        setConnected(true);
        setError(null);
      };

      es.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as StreamData;
          setData(payload);
          setLastEventAt(new Date().toISOString());
          setError(null);
        } catch {
          setError('Received an invalid live market update.');
        }
      };

      es.onerror = () => {
        setConnected(false);
        setError('Live market stream unavailable.');
        clearConnection();
        scheduleReconnect();
      };
    }

    connect();

    return () => {
      disposedRef.current = true;
      clearReconnectTimer();
      clearConnection();
      setConnected(false);
    };
  }, []);

  return (
    <MarketStreamContext.Provider value={{ data, connected, error, lastEventAt }}>
      {children}
    </MarketStreamContext.Provider>
  );
}

export function useMarketStream(enabled = true) {
  const state = useContext(MarketStreamContext);
  return enabled ? state : defaultState;
}