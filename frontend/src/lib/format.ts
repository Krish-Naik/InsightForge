/** Format INR currency */
export function formatCurrency(val: number): string {
  if (!val && val !== 0) return '—';
  if (Math.abs(val) >= 1e7) return `₹${(val / 1e7).toFixed(2)}Cr`;
  if (Math.abs(val) >= 1e5) return `₹${(val / 1e5).toFixed(2)}L`;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
}

/** Format percentage with sign */
export function formatPercent(val: number, decimals = 2): string {
  if (val === undefined || val === null) return '—';
  const sign = val >= 0 ? '+' : '';
  return `${sign}${val.toFixed(decimals)}%`;
}

/** Format large numbers (volumes, market caps) */
export function formatLargeNumber(val: number): string {
  if (!val) return '—';
  if (Math.abs(val) >= 1e12) return `${(val / 1e12).toFixed(2)}T`;
  if (Math.abs(val) >= 1e9)  return `${(val / 1e9).toFixed(2)}B`;
  if (Math.abs(val) >= 1e7)  return `${(val / 1e7).toFixed(2)}Cr`;
  if (Math.abs(val) >= 1e5)  return `${(val / 1e5).toFixed(2)}L`;
  if (Math.abs(val) >= 1e3)  return `${(val / 1e3).toFixed(1)}K`;
  return val.toFixed(0);
}

/** Relative time */
export function formatTimeAgo(ts: string | Date): string {
  const d = typeof ts === 'string' ? new Date(ts) : ts;
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60)   return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/** IST time string */
export function formatIST(date = new Date()): string {
  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    timeZone: 'Asia/Kolkata',
  });
}

/** Plain number with commas */
export function formatNumber(val: number, decimals = 2): string {
  if (!val && val !== 0) return '—';
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(val);
}
