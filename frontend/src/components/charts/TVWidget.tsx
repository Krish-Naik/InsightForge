'use client';

import React, { useEffect, useRef, memo } from 'react';

interface TVWidgetProps {
  src: string;
  config: Record<string, unknown>;
  className?: string;
  style?: React.CSSProperties;
}

const SCRIPT_MAP: Record<string, string> = {
  'market-overview':      'https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js',
  'technical-analysis':   'https://s3.tradingview.com/external-embedding/embed-widget-technical-analysis.js',
  'symbol-overview':      'https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js',
  'mini-symbol-overview': 'https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js',
  'stock-heatmap':        'https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js',
  'screener':             'https://s3.tradingview.com/external-embedding/embed-widget-screener.js',
  'events':               'https://s3.tradingview.com/external-embedding/embed-widget-events.js',
  'timeline':             'https://s3.tradingview.com/external-embedding/embed-widget-timeline.js',
  'hotlists':             'https://s3.tradingview.com/external-embedding/embed-widget-hotlists.js',
  'forex-cross-rates':    'https://s3.tradingview.com/external-embedding/embed-widget-forex-cross-rates.js',
  'economic-calendar':    'https://s3.tradingview.com/external-embedding/embed-widget-economic-calendar.js',
};

function resolveScriptUrl(src: string): string {
  for (const [key, url] of Object.entries(SCRIPT_MAP)) {
    if (src.includes(key)) return url;
  }
  return src;
}

/**
 * TradingView embed widget loader.
 *
 * ROOT CAUSE FIX: Browsers block script execution when injected via innerHTML
 * (per HTML spec §4.12.1). We MUST use document.createElement('script') +
 * appendChild so the browser parses & runs the external TV loader script.
 *
 * The TV loader reads its widget config from the <script> element's textContent,
 * so we embed the JSON there (not as a separate element).
 */
function TVWidgetInner({ src, config, className = '', style }: TVWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const configKey    = JSON.stringify(config); // stable dep for effect

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Wipe previous widget completely
    container.innerHTML = '';

    // ── Outer wrapper (required by TV embed spec) ─────────────────────────
    const wrapper = document.createElement('div');
    wrapper.className = 'tradingview-widget-container';
    wrapper.style.cssText = 'width:100%;height:100%;';

    // ── Inner widget mount point ──────────────────────────────────────────
    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    widgetDiv.style.cssText = 'width:100%;height:100%;';

    // ── Script element — the only way to make TV widgets execute ──────────
    const script = document.createElement('script');
    script.type    = 'text/javascript';
    script.src     = resolveScriptUrl(src);
    script.async   = true;
    // TV loader reads config from the script tag's text content
    script.textContent = JSON.stringify({
      ...config,
      autosize: true,
      largeChartUrl: '',
    });

    wrapper.appendChild(widgetDiv);
    wrapper.appendChild(script);
    container.appendChild(wrapper);

    return () => {
      if (container) container.innerHTML = '';
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, configKey]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: '100%', height: '100%', minHeight: 100, ...style }}
    />
  );
}

export const TVWidget = memo(TVWidgetInner);
