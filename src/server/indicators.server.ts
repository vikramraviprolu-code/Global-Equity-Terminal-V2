// Shared technical indicator helpers. Pure functions, no I/O.

export function sma(vals: number[], period: number): number | null {
  if (vals.length < period) return null;
  const s = vals.slice(-period);
  return s.reduce((a, b) => a + b, 0) / period;
}

export function rsi(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  let g = 0, l = 0;
  for (let i = 1; i <= period; i++) { const d = closes[i] - closes[i - 1]; if (d >= 0) g += d; else l -= d; }
  let aG = g / period, aL = l / period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    aG = (aG * (period - 1) + (d > 0 ? d : 0)) / period;
    aL = (aL * (period - 1) + (d < 0 ? -d : 0)) / period;
  }
  if (aL === 0) return 100;
  return 100 - 100 / (1 + aG / aL);
}

export function roc(closes: number[], period: number): number | null {
  if (closes.length < period + 1) return null;
  const c = closes[closes.length - 1], p = closes[closes.length - 1 - period];
  if (!p) return null;
  return ((c - p) / p) * 100;
}
