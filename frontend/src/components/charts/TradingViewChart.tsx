'use client';

import { useEffect, useRef, useState } from 'react';

interface TradingViewWidgetProps {
  symbol: string;
  interval?: 'D' | 'W' | 'M';
  theme?: 'light' | 'dark';
  height?: number;
}

export function TradingViewChart({ 
  symbol, 
  interval = 'D', 
  theme = 'dark',
  height = 400 
}: TradingViewWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!containerRef.current || !mounted) return;

    const container = containerRef.current;
    const containerId = `tv_${symbol.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;
    container.id = containerId;
    container.innerHTML = '';

    if (!(window as any).TradingView) {
      const script = document.createElement('script');
      script.src = 'https://s3.tradingview.com/tv.js';
      script.async = true;
      script.onload = () => initWidget(containerId);
      document.head.appendChild(script);
    } else {
      initWidget(containerId);
    }

    function initWidget(cid: string) {
      if ((window as any).TradingView && containerRef.current) {
        new (window as any).TradingView.widget({
          container_id: cid,
          symbol: symbol,
          interval: interval,
          theme: theme,
          style: '1',
          locale: 'en',
          width: '100%',
          height: height,
          hide_top_toolbar: false,
          hide_legend: false,
          save_image: false,
          toolbar_bg: theme === 'dark' ? '#1a1a2e' : '#f1f3f6',
          studies: ['MASimple@tv-basicstudies'],
          show_popup_button: true,
          popup_width: '1000',
          popup_height: '650',
        });
      }
    }
  }, [symbol, interval, theme, height, mounted]);

  return (
    <div 
      ref={containerRef}
      style={{ width: '100%', height, minHeight: 300 }}
    />
  );
}