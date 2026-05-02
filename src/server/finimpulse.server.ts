// Shared Finimpulse API client + indicator helpers + region detection.
// Kept server-only (.server.ts is import-protected from client bundles).

import { fetchWithRetry } from "./http.server";
import { yahooChart, yahooSummary } from "./yahoo.server";
import { stooqQuote } from "./stooq.server";
import { fmpQuote } from "./fmp.server";
import { cachedSWR } from "./cache.server";

const FI_BASE = "https://api.finimpulse.com/v1";

function key() {
  const k = process.env.FINIMPULSE_API_KEY;
  if (!k) throw new Error("FINIMPULSE_API_KEY not configured");
  return k;
}

export async function fi<T = any>(path: string, body: Record<string, unknown>): Promise<T | null> {
  try {
    const res = await fetchWithRetry(`${FI_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key()}` },
      body: JSON.stringify(body),
      label: `finimpulse${path}`,
    });
    if (!res.ok) return null;
    const json = (await res.json()) as any;
    if (json && typeof json === "object" && "result" in json) return json.result as T;
    return json as T;
  } catch {
    return null;
  }
}


// ---------- indicators ----------
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

// ---------- region thresholds ----------
export type RegionKey = "US" | "IN" | "EU" | "JP" | "HK" | "KR" | "TW" | "AU" | "SG" | "CN" | "OTHER";
export type Filter = { minPrice: number; minVolume: number; minMcapUsd: number; currency: string };
export const REGIONAL_FILTERS: Record<RegionKey, Filter> = {
  US: { minPrice: 5,     minVolume: 500_000, minMcapUsd: 2e9, currency: "USD" },
  IN: { minPrice: 100,   minVolume: 500_000, minMcapUsd: 2e9, currency: "INR" },
  EU: { minPrice: 5,     minVolume: 100_000, minMcapUsd: 2e9, currency: "EUR" },
  JP: { minPrice: 500,   minVolume: 300_000, minMcapUsd: 2e9, currency: "JPY" },
  HK: { minPrice: 5,     minVolume: 500_000, minMcapUsd: 2e9, currency: "HKD" },
  KR: { minPrice: 5000,  minVolume: 100_000, minMcapUsd: 2e9, currency: "KRW" },
  TW: { minPrice: 50,    minVolume: 100_000, minMcapUsd: 2e9, currency: "TWD" },
  AU: { minPrice: 2,     minVolume: 100_000, minMcapUsd: 2e9, currency: "AUD" },
  SG: { minPrice: 1,     minVolume: 100_000, minMcapUsd: 1e9, currency: "SGD" },
  CN: { minPrice: 5,     minVolume: 500_000, minMcapUsd: 2e9, currency: "CNY" },
  OTHER: { minPrice: 0,  minVolume: 0,       minMcapUsd: 1e9, currency: "USD" },
};

// ---------- mock fallback (deterministic per-symbol pseudo data) ----------
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
}
function pseudo(symbol: string, salt: string): number {
  return (hash(symbol + ":" + salt) % 10000) / 10000;
}

export type ScreenerRow = {
  symbol: string;
  name: string;
  exchange: string;
  country: string;
  region: RegionKey;
  currency: string;
  sector: string;
  industry: string;
  price: number | null;
  marketCap: number | null;
  marketCapUsd: number | null;
  avgVolume: number | null;
  pe: number | null;
  pb: number | null;
  dividendYield: number | null; // percent (e.g. 2.5 = 2.5%)
  high52: number | null;
  low52: number | null;
  pctFromLow: number | null;
  pctFromHigh: number | null;
  perf5d: number | null;
  rsi14: number | null;
  roc14: number | null;
  roc21: number | null;
  ma20: number | null;
  ma50: number | null;
  ma200: number | null;
  closes: number[]; // last ~30 closes for sparkline
  isMock: boolean;
  source: string;
  retrievedAt: string;
};

export function buildMockRow(u: {
  symbol: string; name: string; exchange: string; country: string; region: RegionKey;
  currency: string; sector: string; industry: string;
}): ScreenerRow {
  const sym = u.symbol;
  // base price by currency typical scale
  const ccyScale: Record<string, number> = { USD: 200, EUR: 150, GBP: 30, CHF: 250, INR: 2500, JPY: 4000, HKD: 200, KRW: 70000, TWD: 600, AUD: 60, SGD: 30, CNY: 80 };
  const base = (ccyScale[u.currency] ?? 100) * (0.6 + pseudo(sym, "p") * 1.6);
  const price = +base.toFixed(2);
  const low52 = +(base * (0.65 + pseudo(sym, "lo") * 0.2)).toFixed(2);
  const high52 = +(base * (1.05 + pseudo(sym, "hi") * 0.4)).toFixed(2);
  const pctFromLow = ((price - low52) / low52) * 100;
  const pctFromHigh = ((price - high52) / high52) * 100;
  const perf5d = (pseudo(sym, "5d") - 0.5) * 12;
  const roc14 = (pseudo(sym, "r14") - 0.5) * 25;
  const roc21 = (pseudo(sym, "r21") - 0.5) * 30;
  const rsi14 = 30 + pseudo(sym, "rsi") * 50;
  const ma20 = +(price * (0.95 + pseudo(sym, "m20") * 0.1)).toFixed(2);
  const ma50 = +(price * (0.92 + pseudo(sym, "m50") * 0.14)).toFixed(2);
  const ma200 = +(price * (0.85 + pseudo(sym, "m200") * 0.25)).toFixed(2);
  const pe = 5 + pseudo(sym, "pe") * 45;
  const pb = +(0.5 + pseudo(sym, "pb") * 6).toFixed(2);
  const dividendYield = +(pseudo(sym, "dy") * 5).toFixed(2);
  const mcapBase = u.region === "US" ? 5e10 : 2e10;
  const marketCapUsd = mcapBase * (0.4 + pseudo(sym, "mc") * 8);
  const fxToUsd: Record<string, number> = { USD: 1, EUR: 1.1, GBP: 1.27, CHF: 1.13, INR: 0.012, JPY: 0.0067, HKD: 0.128, KRW: 0.00073, TWD: 0.031, AUD: 0.66, SGD: 0.74, CNY: 0.14 };
  const marketCap = marketCapUsd / (fxToUsd[u.currency] ?? 1);
  const avgVolume = Math.round(200_000 + pseudo(sym, "vol") * 8_000_000);

  // build a small sparkline ramp
  const closes: number[] = [];
  let p = price * 0.93;
  for (let i = 0; i < 30; i++) {
    p = p * (1 + (pseudo(sym, "c" + i) - 0.49) * 0.02);
    closes.push(+p.toFixed(2));
  }
  closes[closes.length - 1] = price;

  return {
    symbol: sym, name: u.name, exchange: u.exchange, country: u.country, region: u.region,
    currency: u.currency, sector: u.sector, industry: u.industry,
    price, marketCap, marketCapUsd, avgVolume, pe, pb, dividendYield,
    high52, low52,
    pctFromLow: +pctFromLow.toFixed(2), pctFromHigh: +pctFromHigh.toFixed(2),
    perf5d: +perf5d.toFixed(2), rsi14: +rsi14.toFixed(1),
    roc14: +roc14.toFixed(2), roc21: +roc21.toFixed(2),
    ma20, ma50, ma200, closes,
    isMock: true,
    source: "Mock demo data",
    retrievedAt: new Date().toISOString(),
  };
}

function isoDateBack(d: number) { const x = new Date(); x.setUTCDate(x.getUTCDate() - d); return x.toISOString().slice(0, 10); }

async function fetchHistoryCloses(symbol: string): Promise<number[]> {
  const r = await fi<any>("/histories", {
    symbol, types: ["historical_price"], interval: "1d",
    start_date: isoDateBack(300), end_date: isoDateBack(0),
    sort_by: [{ selector: "date", desc: false }],
  });
  const items: any[] = r?.items ?? [];
  const prices = items.filter((x) => !x.type || x.type === "historical_price");
  prices.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return prices.map((x) => x.adj_close ?? x.close).filter((n) => typeof n === "number");
}

async function fetchSearchOne(symbol: string): Promise<any | null> {
  const r = await fi<any>("/search", { symbols: [symbol], limit: 1 });
  return r?.items?.[0] ?? null;
}

async function fetchSummary(symbol: string) { return fi<any>("/summary", { symbol }); }

export async function fetchScreenerRow(u: {
  symbol: string; name: string; exchange: string; country: string; region: RegionKey;
  currency: string; sector: string; industry: string;
}): Promise<ScreenerRow> {
  // Cache rows for 5 min — universe is fairly static and rate-limit pressure
  // comes from many concurrent visitors hitting the same symbols.
  return cachedSWR(`screener:${u.symbol}`, 5 * 60_000, () => fetchScreenerRowUncached(u));
}

async function fetchScreenerRowUncached(u: {
  symbol: string; name: string; exchange: string; country: string; region: RegionKey;
  currency: string; sector: string; industry: string;
}): Promise<ScreenerRow> {
  const sym = u.symbol;
  // 1. Try Finimpulse
  try {
    const [searchItem, summary, closes] = await Promise.all([
      fetchSearchOne(sym).catch(() => null),
      fetchSummary(sym).catch(() => null),
      fetchHistoryCloses(sym).catch(() => [] as number[]),
    ]);
    if (searchItem || summary || closes.length) {
      const price: number | null = searchItem?.regular_market_price ?? summary?.current_price ?? summary?.regular_market_price ?? (closes.length ? closes[closes.length - 1] : null);
      const high52: number | null = searchItem?.fifty_two_week_high ?? summary?.fifty_two_week_high ?? null;
      const low52: number | null = searchItem?.fifty_two_week_low ?? summary?.fifty_two_week_low ?? null;
      const pctFromLow = price && low52 ? ((price - low52) / low52) * 100 : null;
      const pctFromHigh = price && high52 ? ((price - high52) / high52) * 100 : null;
      const ma20 = sma(closes, 20);
      const ma50 = searchItem?.fifty_day_average ?? summary?.fifty_day_average ?? sma(closes, 50);
      const ma200 = searchItem?.two_hundred_day_average ?? summary?.two_hundred_day_average ?? sma(closes, 200);

      return {
        symbol: sym, name: searchItem?.long_name ?? searchItem?.short_name ?? u.name,
        exchange: searchItem?.full_exchange_name ?? searchItem?.exchange ?? u.exchange,
        country: searchItem?.market_region ?? u.country, region: u.region,
        currency: searchItem?.currency ?? u.currency,
        sector: searchItem?.sector ?? u.sector, industry: searchItem?.industry ?? u.industry,
        price,
        marketCap: searchItem?.amount ?? summary?.market_cap ?? null,
        marketCapUsd: searchItem?.amount_usd ?? null,
        avgVolume: searchItem?.average_daily_volume_3_month ?? searchItem?.average_daily_volume_10_day ?? summary?.average_volume ?? null,
        pe: summary?.trailing_pe ?? null,
        pb: summary?.price_to_book ?? null,
        dividendYield: summary?.dividend_yield != null ? +(Number(summary.dividend_yield) * 100).toFixed(2) : (summary?.trailing_annual_dividend_yield != null ? +(Number(summary.trailing_annual_dividend_yield) * 100).toFixed(2) : null),
        high52, low52,
        pctFromLow: pctFromLow != null ? +pctFromLow.toFixed(2) : null,
        pctFromHigh: pctFromHigh != null ? +pctFromHigh.toFixed(2) : null,
        perf5d: roc(closes, 5),
        rsi14: rsi(closes, 14),
        roc14: roc(closes, 14),
        roc21: roc(closes, 21),
        ma20, ma50, ma200,
        closes: closes.slice(-30),
        isMock: false,
        source: "Finimpulse",
        retrievedAt: new Date().toISOString(),
      };
    }
  } catch {
    // fall through to Yahoo
  }

  // 2. Try Yahoo Finance
  const yahoo = await fetchScreenerRowFromYahoo(u);
  if (yahoo) return yahoo;

  // 3. Try Financial Modeling Prep (only if FMP_API_KEY is set; mainly US)
  const fmp = await fetchScreenerRowFromFmp(u);
  if (fmp) return fmp;

  // 4. Try Stooq (free CSV, no key, global coverage but price-only)
  const stooq = await fetchScreenerRowFromStooq(u);
  if (stooq) return stooq;

  // 5. Last resort — deterministic mock so UI never breaks
  return buildMockRow(u);
}

async function fetchScreenerRowFromFmp(u: {
  symbol: string; name: string; exchange: string; country: string; region: RegionKey;
  currency: string; sector: string; industry: string;
}): Promise<ScreenerRow | null> {
  const sym = u.symbol;
  const f = await fmpQuote(sym).catch(() => null);
  if (!f || (f.price == null && f.closes.length === 0)) return null;
  const closes = f.closes;
  const price = f.price ?? (closes.length ? closes[closes.length - 1] : null);
  const high52 = f.high52 ?? (closes.length ? Math.max(...closes) : null);
  const low52 = f.low52 ?? (closes.length ? Math.min(...closes) : null);
  const pctFromLow = price && low52 ? ((price - low52) / low52) * 100 : null;
  const pctFromHigh = price && high52 ? ((price - high52) / high52) * 100 : null;
  return {
    symbol: sym,
    name: f.name ?? u.name,
    exchange: f.exchange ?? u.exchange,
    country: u.country, region: u.region,
    currency: f.currency ?? u.currency,
    sector: f.sector ?? u.sector,
    industry: f.industry ?? u.industry,
    price,
    marketCap: f.marketCap ?? null,
    marketCapUsd: null,
    avgVolume: f.avgVolume ?? null,
    pe: f.pe ?? null,
    pb: f.pb ?? null,
    dividendYield: f.dividendYield ?? null,
    high52, low52,
    pctFromLow: pctFromLow != null ? +pctFromLow.toFixed(2) : null,
    pctFromHigh: pctFromHigh != null ? +pctFromHigh.toFixed(2) : null,
    perf5d: roc(closes, 5),
    rsi14: rsi(closes, 14),
    roc14: roc(closes, 14),
    roc21: roc(closes, 21),
    ma20: sma(closes, 20),
    ma50: f.ma50 ?? sma(closes, 50),
    ma200: f.ma200 ?? sma(closes, 200),
    closes: closes.slice(-30),
    isMock: false,
    source: "Financial Modeling Prep",
    retrievedAt: new Date().toISOString(),
  };
}

async function fetchScreenerRowFromStooq(u: {
  symbol: string; name: string; exchange: string; country: string; region: RegionKey;
  currency: string; sector: string; industry: string;
}): Promise<ScreenerRow | null> {
  const sym = u.symbol;
  const s = await stooqQuote(sym).catch(() => null);
  if (!s) return null;
  const price = s.price;
  const pctFromLow = price && s.low52 ? ((price - s.low52) / s.low52) * 100 : null;
  const pctFromHigh = price && s.high52 ? ((price - s.high52) / s.high52) * 100 : null;
  return {
    symbol: sym,
    name: u.name,
    exchange: u.exchange,
    country: u.country, region: u.region,
    currency: u.currency,
    sector: u.sector, industry: u.industry,
    price,
    marketCap: null,
    marketCapUsd: null,
    avgVolume: null,
    pe: null, pb: null, dividendYield: null,
    high52: s.high52, low52: s.low52,
    pctFromLow: pctFromLow != null ? +pctFromLow.toFixed(2) : null,
    pctFromHigh: pctFromHigh != null ? +pctFromHigh.toFixed(2) : null,
    perf5d: s.perf5d,
    rsi14: s.rsi14, roc14: s.roc14, roc21: s.roc21,
    ma20: s.ma20, ma50: s.ma50, ma200: s.ma200,
    closes: s.closes.slice(-30),
    isMock: false,
    source: "Stooq",
    retrievedAt: new Date().toISOString(),
  };
}

async function fetchScreenerRowFromYahoo(u: {
  symbol: string; name: string; exchange: string; country: string; region: RegionKey;
  currency: string; sector: string; industry: string;
}): Promise<ScreenerRow | null> {
  const sym = u.symbol;
  const [chart, summary] = await Promise.all([
    yahooChart(sym, "1y").catch(() => null),
    yahooSummary(sym).catch(() => null),
  ]);
  if (!chart && !summary) return null;
  const closes = chart?.closes ?? [];
  const price = chart?.regularMarketPrice ?? (closes.length ? closes[closes.length - 1] : null);
  const high52 = chart?.fiftyTwoWeekHigh ?? null;
  const low52 = chart?.fiftyTwoWeekLow ?? null;
  const pctFromLow = price && low52 ? ((price - low52) / low52) * 100 : null;
  const pctFromHigh = price && high52 ? ((price - high52) / high52) * 100 : null;
  const ma50 = chart?.fiftyDayAverage ?? sma(closes, 50);
  const ma200 = chart?.twoHundredDayAverage ?? sma(closes, 200);
  const ma20 = sma(closes, 20);

  return {
    symbol: sym,
    name: summary?.longName ?? summary?.shortName ?? u.name,
    exchange: chart?.fullExchangeName ?? chart?.exchangeName ?? summary?.fullExchangeName ?? summary?.exchange ?? u.exchange,
    country: summary?.country ?? u.country,
    region: u.region,
    currency: chart?.currency ?? summary?.currency ?? u.currency,
    sector: summary?.sector ?? u.sector,
    industry: summary?.industry ?? u.industry,
    price,
    marketCap: summary?.marketCap ?? null,
    marketCapUsd: null,
    avgVolume: chart?.averageDailyVolume3Month ?? chart?.averageDailyVolume10Day ?? null,
    pe: summary?.trailingPE ?? null,
    pb: summary?.priceToBook ?? null,
    dividendYield: summary?.dividendYield ?? null,
    high52, low52,
    pctFromLow: pctFromLow != null ? +pctFromLow.toFixed(2) : null,
    pctFromHigh: pctFromHigh != null ? +pctFromHigh.toFixed(2) : null,
    perf5d: roc(closes, 5),
    rsi14: rsi(closes, 14),
    roc14: roc(closes, 14),
    roc21: roc(closes, 21),
    ma20, ma50, ma200,
    closes: closes.slice(-30),
    isMock: false,
    source: "Yahoo Finance",
    retrievedAt: new Date().toISOString(),
  };
}

