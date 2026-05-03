import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { fetchWithRetry } from "./http.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { optionalSupabaseAuth } from "@/integrations/supabase/optional-auth-middleware";
import { supabaseAuthHeaders } from "./supabase-auth-headers";
import { enforceRateLimit } from "./rate-limit.server";
import { yahooChart, yahooSummary, yahooSearch } from "./yahoo.server";
import { stooqQuote } from "./stooq.server";
import { fmpQuote, fmpSearch } from "./fmp.server";
import { cachedSWR } from "./cache.server";
import { UNIVERSE } from "./universe";

// Lookup curated metadata for a symbol so we always have at least
// sector/industry/exchange/region even when upstream profile endpoints
// (Yahoo quoteSummary, FMP profile) are blocked or rate-limited.
function universeMeta(sym: string) {
  const u = UNIVERSE.find((x) => x.symbol.toUpperCase() === sym.toUpperCase());
  return u ?? null;
}

const FI_BASE = "https://api.finimpulse.com/v1";

function key() {
  const k = process.env.FINIMPULSE_API_KEY;
  if (!k) throw new Error("FINIMPULSE_API_KEY not configured");
  return k;
}

async function fi<T = any>(path: string, body: Record<string, unknown>): Promise<T | null> {
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
function sma(vals: number[], period: number): number | null {
  if (vals.length < period) return null;
  const s = vals.slice(-period);
  return s.reduce((a, b) => a + b, 0) / period;
}
function rsi(closes: number[], period = 14): number | null {
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
function roc(closes: number[], period: number): number | null {
  if (closes.length < period + 1) return null;
  const c = closes[closes.length - 1], p = closes[closes.length - 1 - period];
  if (!p) return null;
  return ((c - p) / p) * 100;
}
function pctPerf(closes: number[], days: number): number | null { return roc(closes, days); }

// ---------- region / exchange mapping ----------
type RegionKey = "US" | "IN" | "EU" | "JP" | "HK" | "KR" | "TW" | "AU" | "SG" | "CN" | "OTHER";

const SUFFIX_TO_EXCHANGE: Record<string, { exchange: string; country: string; region: RegionKey; currency: string }> = {
  // India
  ".NS": { exchange: "NSE", country: "India", region: "IN", currency: "INR" },
  ".BO": { exchange: "BSE", country: "India", region: "IN", currency: "INR" },
  // Europe
  ".L": { exchange: "LSE", country: "United Kingdom", region: "EU", currency: "GBP" },
  ".PA": { exchange: "Euronext Paris", country: "France", region: "EU", currency: "EUR" },
  ".AS": { exchange: "Euronext Amsterdam", country: "Netherlands", region: "EU", currency: "EUR" },
  ".BR": { exchange: "Euronext Brussels", country: "Belgium", region: "EU", currency: "EUR" },
  ".LS": { exchange: "Euronext Lisbon", country: "Portugal", region: "EU", currency: "EUR" },
  ".IR": { exchange: "Euronext Dublin", country: "Ireland", region: "EU", currency: "EUR" },
  ".DE": { exchange: "Xetra", country: "Germany", region: "EU", currency: "EUR" },
  ".F": { exchange: "Frankfurt", country: "Germany", region: "EU", currency: "EUR" },
  ".SW": { exchange: "SIX", country: "Switzerland", region: "EU", currency: "CHF" },
  ".MI": { exchange: "Borsa Italiana", country: "Italy", region: "EU", currency: "EUR" },
  ".MC": { exchange: "Bolsa de Madrid", country: "Spain", region: "EU", currency: "EUR" },
  ".ST": { exchange: "Nasdaq Stockholm", country: "Sweden", region: "EU", currency: "SEK" },
  ".HE": { exchange: "Nasdaq Helsinki", country: "Finland", region: "EU", currency: "EUR" },
  ".CO": { exchange: "Nasdaq Copenhagen", country: "Denmark", region: "EU", currency: "DKK" },
  ".OL": { exchange: "Oslo", country: "Norway", region: "EU", currency: "NOK" },
  // Asia-Pacific
  ".T": { exchange: "Tokyo", country: "Japan", region: "JP", currency: "JPY" },
  ".HK": { exchange: "HKSE", country: "Hong Kong", region: "HK", currency: "HKD" },
  ".KS": { exchange: "KRX", country: "South Korea", region: "KR", currency: "KRW" },
  ".KQ": { exchange: "KOSDAQ", country: "South Korea", region: "KR", currency: "KRW" },
  ".TW": { exchange: "TWSE", country: "Taiwan", region: "TW", currency: "TWD" },
  ".TWO": { exchange: "TPEx", country: "Taiwan", region: "TW", currency: "TWD" },
  ".SI": { exchange: "SGX", country: "Singapore", region: "SG", currency: "SGD" },
  ".AX": { exchange: "ASX", country: "Australia", region: "AU", currency: "AUD" },
  ".SS": { exchange: "Shanghai", country: "China", region: "CN", currency: "CNY" },
  ".SZ": { exchange: "Shenzhen", country: "China", region: "CN", currency: "CNY" },
};

function detectFromSymbol(symbol: string) {
  const dot = symbol.lastIndexOf(".");
  if (dot >= 0) {
    const sfx = symbol.slice(dot);
    const m = SUFFIX_TO_EXCHANGE[sfx];
    if (m) return m;
  }
  return { exchange: "US", country: "United States", region: "US" as RegionKey, currency: "USD" };
}

function regionFromMarketRegion(mr: string | null | undefined, currency: string | null | undefined, fallback: RegionKey): RegionKey {
  const c = (currency ?? "").toUpperCase();
  if (mr === "US" || c === "USD") return "US";
  if (mr === "IN" || c === "INR") return "IN";
  if (mr === "JP" || c === "JPY") return "JP";
  if (mr === "HK" || c === "HKD") return "HK";
  if (mr === "KR" || c === "KRW") return "KR";
  if (mr === "TW" || c === "TWD") return "TW";
  if (mr === "AU" || c === "AUD") return "AU";
  if (mr === "SG" || c === "SGD") return "SG";
  if (mr === "CN" || c === "CNY") return "CN";
  if (["EUR", "GBP", "CHF", "SEK", "NOK", "DKK"].includes(c)) return "EU";
  return fallback;
}

// ---------- regional filter thresholds ----------
type Filter = { minPrice: number; minVolume: number; minMcapUsd: number; currency: string };
const REGIONAL_FILTERS: Record<RegionKey, Filter> = {
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

// ---------- types ----------
export type Listing = {
  symbol: string;
  companyName: string;
  exchange: string | null;
  fullExchange: string | null;
  country: string | null;
  region: RegionKey;
  currency: string;
  sector: string | null;
  industry: string | null;
  marketCap: number | null;
  marketCapUsd: number | null;
  listingType: string | null;
};

export type StockMetrics = Listing & {
  price: number | null;
  priceUsd: number | null;
  avgVolume: number | null;
  pe: number | null;
  high52: number | null;
  low52: number | null;
  pctFromLow: number | null;
  perf5d: number | null;
  rsi14: number | null;
  roc14: number | null;
  roc21: number | null;
  ma20: number | null;
  ma50: number | null;
  ma200: number | null;
  earningsDate: string | null;
  dataMissing: string[];
  filter: Filter;
  closes: number[];
  source: string;
};

function isoDateBack(d: number) { const x = new Date(); x.setUTCDate(x.getUTCDate() - d); return x.toISOString().slice(0, 10); }

async function fetchHistoryCloses(symbol: string): Promise<number[]> {
  const r = await fi<any>("/histories", {
    symbol, types: ["historical_price"], interval: "1d",
    start_date: isoDateBack(400), end_date: isoDateBack(0),
    sort_by: [{ selector: "date", desc: false }],
  });
  const items: any[] = r?.items ?? [];
  const prices = items.filter((x) => !x.type || x.type === "historical_price");
  prices.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return prices.map((x) => x.adj_close ?? x.close).filter((n) => typeof n === "number");
}

async function fetchSummary(symbol: string) { return fi<any>("/summary", { symbol }); }

// Use /search with `symbols:[]` to fetch rich profile (currency/region/exchange/mcap_usd)
async function fetchListingsBySymbols(symbols: string[]): Promise<any[]> {
  if (!symbols.length) return [];
  const r = await fi<any>("/search", { symbols, limit: symbols.length });
  return r?.items ?? [];
}

function listingFromItem(it: any): Listing {
  const sym = it.symbol as string;
  const fb = detectFromSymbol(sym);
  const currency = (it.currency ?? fb.currency) as string;
  const region = regionFromMarketRegion(it.market_region, currency, fb.region);
  const country = it.market_region ?? fb.country;
  return {
    symbol: sym,
    companyName: it.long_name ?? it.short_name ?? it.display_name ?? sym,
    exchange: it.exchange ?? fb.exchange ?? null,
    fullExchange: it.full_exchange_name ?? null,
    country,
    region,
    currency,
    sector: it.sector ?? null,
    industry: it.industry ?? null,
    marketCap: it.amount ?? null,
    marketCapUsd: it.amount_usd ?? null,
    listingType: it.quote_type ?? "stock",
  };
}

async function fetchMetrics(symbol: string, prefetched?: any): Promise<StockMetrics | null> {
  const sym = symbol.trim();
  // Cache analyze results for 2 min — same ticker is often re-analyzed during a session.
  // Don't cache when prefetched is supplied (peer enrichment uses already-resolved data).
  if (prefetched) return fetchMetricsUncached(sym, prefetched);
  return cachedSWR(`analyze:${sym}`, 2 * 60_000, () => fetchMetricsUncached(sym));
}

async function fetchMetricsUncached(symbol: string, prefetched?: any): Promise<StockMetrics | null> {
  const sym = symbol.trim();
  // Try Finimpulse
  const [searchItem, summary, closes] = await Promise.all([
    prefetched ? Promise.resolve(prefetched) : fetchListingsBySymbols([sym]).then((a) => a[0] ?? null).catch(() => null),
    fetchSummary(sym).catch(() => null),
    fetchHistoryCloses(sym).catch(() => [] as number[]),
  ]);

  if (searchItem || summary || closes.length) {
    const listing: Listing = searchItem
      ? listingFromItem(searchItem)
      : { ...listingFromItem({ symbol: sym }), companyName: summary?.long_name ?? summary?.short_name ?? sym, sector: summary?.sector ?? null, industry: summary?.industry ?? null, marketCap: summary?.market_cap ?? null, marketCapUsd: null };

    const filter = REGIONAL_FILTERS[listing.region] ?? REGIONAL_FILTERS.OTHER;
    const price = searchItem?.regular_market_price ?? summary?.current_price ?? summary?.regular_market_price ?? (closes.length ? closes[closes.length - 1] : null);
    const priceUsd = searchItem?.regular_market_price_usd ?? null;
    const high52 = searchItem?.fifty_two_week_high ?? summary?.fifty_two_week_high ?? null;
    const low52 = searchItem?.fifty_two_week_low ?? summary?.fifty_two_week_low ?? null;
    const pctFromLow = price && low52 ? ((price - low52) / low52) * 100 : null;
    const ma50 = searchItem?.fifty_day_average ?? summary?.fifty_day_average ?? sma(closes, 50);
    const ma200 = searchItem?.two_hundred_day_average ?? summary?.two_hundred_day_average ?? sma(closes, 200);
    const ma20 = sma(closes, 20);

    const missing: string[] = [];
    if (!closes.length) missing.push("price history");
    if (price == null) missing.push("price");
    if (summary?.trailing_pe == null) missing.push("P/E");

    return {
      ...listing,
      marketCap: listing.marketCap ?? summary?.market_cap ?? null,
      price, priceUsd,
      avgVolume: searchItem?.average_daily_volume_3_month ?? searchItem?.average_daily_volume_10_day ?? summary?.average_volume ?? summary?.average_daily_volume_10_day ?? null,
      pe: summary?.trailing_pe ?? null,
      high52, low52, pctFromLow,
      perf5d: pctPerf(closes, 5),
      rsi14: rsi(closes, 14),
      roc14: roc(closes, 14),
      roc21: roc(closes, 21),
      ma20, ma50, ma200,
      earningsDate: summary?.earnings_date ?? null,
      dataMissing: missing,
      filter,
      closes: closes.slice(-260),
      source: "Finimpulse",
    };
  }

  // Fallback chain: Yahoo → FMP → Stooq
  const yahoo = await fetchMetricsFromYahoo(sym);
  if (yahoo) return yahoo;
  const fmp = await fetchMetricsFromFmp(sym);
  if (fmp) return fmp;
  return fetchMetricsFromStooq(sym);
}

async function fetchMetricsFromYahoo(sym: string): Promise<StockMetrics | null> {
  const [chart, summary] = await Promise.all([
    yahooChart(sym, "2y").catch(() => null),
    yahooSummary(sym).catch(() => null),
  ]);
  if (!chart && !summary) return null;
  const closes = chart?.closes ?? [];
  const fb = detectFromSymbol(sym);
  const currency = chart?.currency ?? summary?.currency ?? fb.currency;
  const region = regionFromMarketRegion(chart?.marketRegion ?? null, currency, fb.region);
  // If Yahoo quoteSummary is blocked, enrich with FMP profile + curated universe metadata
  const fmpFallback = !summary ? await fmpQuote(sym).catch(() => null) : null;
  const um = universeMeta(sym);
  const listing: Listing = {
    symbol: sym,
    companyName: summary?.longName ?? summary?.shortName ?? fmpFallback?.name ?? um?.name ?? sym,
    exchange: chart?.exchangeName ?? summary?.exchange ?? fmpFallback?.exchange ?? fb.exchange ?? um?.exchange ?? null,
    fullExchange: chart?.fullExchangeName ?? summary?.fullExchangeName ?? null,
    country: summary?.country ?? um?.country ?? fb.country,
    region,
    currency,
    sector: summary?.sector ?? fmpFallback?.sector ?? um?.sector ?? null,
    industry: summary?.industry ?? fmpFallback?.industry ?? um?.industry ?? null,
    marketCap: summary?.marketCap ?? fmpFallback?.marketCap ?? null,
    marketCapUsd: null,
    listingType: "stock",
  };
  const filter = REGIONAL_FILTERS[region] ?? REGIONAL_FILTERS.OTHER;
  const price = chart?.regularMarketPrice ?? (closes.length ? closes[closes.length - 1] : null);
  const high52 = chart?.fiftyTwoWeekHigh ?? null;
  const low52 = chart?.fiftyTwoWeekLow ?? null;
  const pctFromLow = price && low52 ? ((price - low52) / low52) * 100 : null;
  const ma50 = chart?.fiftyDayAverage ?? sma(closes, 50);
  const ma200 = chart?.twoHundredDayAverage ?? sma(closes, 200);
  const ma20 = sma(closes, 20);
  const missing: string[] = [];
  if (!closes.length) missing.push("price history");
  if (price == null) missing.push("price");
  if (summary?.trailingPE == null) missing.push("P/E");
  return {
    ...listing,
    price,
    priceUsd: null,
    avgVolume: chart?.averageDailyVolume3Month ?? chart?.averageDailyVolume10Day ?? fmpFallback?.avgVolume ?? null,
    pe: summary?.trailingPE ?? fmpFallback?.pe ?? null,
    high52, low52, pctFromLow,
    perf5d: pctPerf(closes, 5),
    rsi14: rsi(closes, 14),
    roc14: roc(closes, 14),
    roc21: roc(closes, 21),
    ma20, ma50, ma200,
    earningsDate: summary?.earningsDate ?? null,
    dataMissing: missing,
    filter,
    closes: closes.slice(-260),
    source: summary ? "Yahoo Finance" : (fmpFallback ? "Yahoo + FMP" : "Yahoo Finance"),
  };
}

async function fetchMetricsFromFmp(sym: string): Promise<StockMetrics | null> {
  const f = await fmpQuote(sym).catch(() => null);
  if (!f || (f.price == null && f.closes.length === 0)) return null;
  const closes = f.closes;
  const fb = detectFromSymbol(sym);
  const currency = f.currency ?? fb.currency;
  const region = regionFromMarketRegion(null, currency, fb.region);
  const listing: Listing = {
    symbol: sym,
    companyName: f.name ?? sym,
    exchange: f.exchange ?? fb.exchange ?? null,
    fullExchange: null,
    country: fb.country,
    region,
    currency,
    sector: f.sector ?? null,
    industry: f.industry ?? null,
    marketCap: f.marketCap ?? null,
    marketCapUsd: null,
    listingType: "stock",
  };
  const filter = REGIONAL_FILTERS[region] ?? REGIONAL_FILTERS.OTHER;
  const price = f.price ?? (closes.length ? closes[closes.length - 1] : null);
  const high52 = f.high52 ?? (closes.length ? Math.max(...closes) : null);
  const low52 = f.low52 ?? (closes.length ? Math.min(...closes) : null);
  const pctFromLow = price && low52 ? ((price - low52) / low52) * 100 : null;
  const missing: string[] = [];
  if (!closes.length) missing.push("price history");
  if (price == null) missing.push("price");
  if (f.pe == null) missing.push("P/E");
  return {
    ...listing,
    price,
    priceUsd: null,
    avgVolume: f.avgVolume ?? null,
    pe: f.pe ?? null,
    high52, low52, pctFromLow,
    perf5d: pctPerf(closes, 5),
    rsi14: rsi(closes, 14),
    roc14: roc(closes, 14),
    roc21: roc(closes, 21),
    ma20: sma(closes, 20),
    ma50: f.ma50 ?? sma(closes, 50),
    ma200: f.ma200 ?? sma(closes, 200),
    earningsDate: null,
    dataMissing: missing,
    filter,
    closes: closes.slice(-260),
    source: "Financial Modeling Prep",
  };
}

async function fetchMetricsFromStooq(sym: string): Promise<StockMetrics | null> {
  const s = await stooqQuote(sym).catch(() => null);
  if (!s) return null;
  const fb = detectFromSymbol(sym);
  const region = fb.region;
  const listing: Listing = {
    symbol: sym,
    companyName: sym,
    exchange: fb.exchange ?? null,
    fullExchange: null,
    country: fb.country,
    region,
    currency: fb.currency,
    sector: null,
    industry: null,
    marketCap: null,
    marketCapUsd: null,
    listingType: "stock",
  };
  const filter = REGIONAL_FILTERS[region] ?? REGIONAL_FILTERS.OTHER;
  const price = s.price;
  const pctFromLow = price && s.low52 ? ((price - s.low52) / s.low52) * 100 : null;
  const missing: string[] = ["P/E", "market cap", "fundamentals"];
  return {
    ...listing,
    price,
    priceUsd: null,
    avgVolume: null,
    pe: null,
    high52: s.high52, low52: s.low52, pctFromLow,
    perf5d: s.perf5d,
    rsi14: s.rsi14, roc14: s.roc14, roc21: s.roc21,
    ma20: s.ma20, ma50: s.ma50, ma200: s.ma200,
    earningsDate: null,
    dataMissing: missing,
    filter,
    closes: s.closes.slice(-260),
    source: "Stooq",
  };
}

function passesGlobal(m: StockMetrics): boolean {
  const f = m.filter;
  return (m.price ?? 0) >= f.minPrice
    && (m.avgVolume ?? 0) >= f.minVolume
    && (m.marketCapUsd ?? m.marketCap ?? 0) >= f.minMcapUsd;
}
function passesValue(m: StockMetrics): boolean {
  if (!passesGlobal(m)) return false;
  if (m.pctFromLow == null || m.pctFromLow > 10) return false;
  if (m.pe == null || m.pe <= 0 || m.pe > 10) return false;
  return true;
}

// ---------- peers via /search with sector/industry + region/country preference ----------
async function searchPeers(opts: {
  sector?: string | null; industry?: string | null;
  marketRegion?: string | null;
  excludeSymbol: string; limit: number;
}): Promise<any[]> {
  const { sector, industry, marketRegion, excludeSymbol, limit } = opts;
  if (!sector && !industry) return [];
  const conds: any[] = [["quote_type", "eq", "stock"]];
  if (industry) conds.push(["industry", "eq", industry]);
  else if (sector) conds.push(["sector", "eq", sector]);
  if (marketRegion) conds.push(["market_region", "eq", marketRegion]);
  // combine as nested AND
  let combined: any = conds[0];
  for (let i = 1; i < conds.length; i++) combined = ["and", combined, conds[i]];
  const r = await fi<any>("/search", {
    quote_types: ["stock"], filters: combined,
    sort_by: [{ selector: "amount_usd", desc: true }], limit,
  });
  const items: any[] = r?.items ?? [];
  return items.filter((x) => x.symbol && x.symbol !== excludeSymbol);
}

const REGION_TO_COUNTRIES: Record<RegionKey, string[]> = {
  US: ["US"], IN: ["IN"], EU: ["GB", "DE", "FR", "NL", "CH", "IT", "ES", "SE", "FI", "DK", "NO", "BE", "PT", "IE"],
  JP: ["JP"], HK: ["HK"], KR: ["KR"], TW: ["TW"], AU: ["AU"], SG: ["SG"], CN: ["CN"], OTHER: [],
};

async function fetchPeerCandidates(target: Listing, max = 25): Promise<any[]> {
  // Tier 1: same industry + same country
  let pool = await searchPeers({ industry: target.industry, marketRegion: target.country ?? null, excludeSymbol: target.symbol, limit: 40 });
  if (pool.length >= 8) return pool.slice(0, max);

  // Tier 2: same industry + same region (multi-country)
  const seen = new Set(pool.map((x) => x.symbol));
  const regionCountries = REGION_TO_COUNTRIES[target.region].filter((c) => c !== target.country);
  for (const c of regionCountries) {
    if (pool.length >= max) break;
    const more = await searchPeers({ industry: target.industry, marketRegion: c, excludeSymbol: target.symbol, limit: 20 });
    for (const m of more) if (!seen.has(m.symbol)) { seen.add(m.symbol); pool.push(m); }
  }
  if (pool.length >= 8) return pool.slice(0, max);

  // Tier 3: same sector + same country
  if (target.sector) {
    const more = await searchPeers({ sector: target.sector, marketRegion: target.country ?? null, excludeSymbol: target.symbol, limit: 30 });
    for (const m of more) if (!seen.has(m.symbol)) { seen.add(m.symbol); pool.push(m); }
  }
  if (pool.length >= 8) return pool.slice(0, max);

  // Tier 4: same sector + region
  if (target.sector) {
    for (const c of regionCountries) {
      if (pool.length >= max) break;
      const more = await searchPeers({ sector: target.sector, marketRegion: c, excludeSymbol: target.symbol, limit: 15 });
      for (const m of more) if (!seen.has(m.symbol)) { seen.add(m.symbol); pool.push(m); }
    }
  }
  if (pool.length >= 5) return pool.slice(0, max);

  // Tier 5: global same-industry fallback
  const fallback = await searchPeers({ industry: target.industry ?? undefined, sector: target.industry ? undefined : target.sector ?? undefined, excludeSymbol: target.symbol, limit: 30 });
  for (const m of fallback) if (!seen.has(m.symbol)) { seen.add(m.symbol); pool.push(m); }
  return pool.slice(0, max);
}

// ---------- scoring (unchanged shape) ----------
function classifyMomentum(m: StockMetrics) {
  const above20 = m.price != null && m.ma20 != null && m.price > m.ma20;
  const above50 = m.price != null && m.ma50 != null && m.price > m.ma50;
  const above200 = m.price != null && m.ma200 != null && m.price > m.ma200;
  const r = m.rsi14 ?? 50;
  const r14p = (m.roc14 ?? 0) > 0, r21p = (m.roc21 ?? 0) > 0, p5p = (m.perf5d ?? 0) > 0;
  let signal = "Mixed signal";
  if (p5p && r14p && r21p && r < 70 && above20 && above50) signal = "Momentum continuation";
  else if (p5p && (r > 70 || (m.roc14 ?? 0) < (m.roc21 ?? 0))) signal = "Potential reversal";
  let s = 0;
  if (p5p) s++; if (r14p) s++; if (r21p) s++; if (above20) s++; if (above50) s++; if (above200) s++;
  if (r >= 40 && r <= 70) s++; if (r > 70) s--; if (r < 30) s--;
  let outlook = "Neutral"; if (s >= 5) outlook = "Bullish"; else if (s <= 2) outlook = "Bearish";
  let confidence = "Medium";
  const conf = [p5p, r14p, r21p, above20, above50, above200].filter(Boolean).length;
  if (conf >= 5 && r < 75) confidence = "High"; else if (conf <= 2) confidence = "Low";
  if (m.dataMissing.length) confidence = "Low";
  const reason = `RSI ${r.toFixed(0)}, 5D ${(m.perf5d ?? 0).toFixed(1)}%, ${[above20 ? "↑20D" : "↓20D", above50 ? "↑50D" : "↓50D", above200 ? "↑200D" : "↓200D"].join(" ")}.`;
  return { signal, outlook, confidence, reason };
}
function rsiLabel(r: number | null) { if (r == null) return "N/A"; if (r > 70) return "Overbought"; if (r < 30) return "Oversold"; return "Neutral"; }
function valueScore(m: StockMetrics) {
  let s = 0;
  if (m.pctFromLow != null && m.pctFromLow <= 10) s++;
  if (m.pe != null && m.pe > 0 && m.pe <= 10) s++;
  if ((m.marketCapUsd ?? m.marketCap ?? 0) >= m.filter.minMcapUsd) s++;
  return s;
}
function momentumScore(m: StockMetrics) {
  let s = 0, p = 0;
  if ((m.perf5d ?? 0) > 0) s++; if ((m.roc14 ?? 0) > 0) s++; if ((m.roc21 ?? 0) > 0) s++;
  if (m.rsi14 != null && m.rsi14 >= 40 && m.rsi14 <= 70) s++;
  if (m.price != null && m.ma20 != null && m.price > m.ma20) s++;
  if (m.price != null && m.ma50 != null && m.price > m.ma50) s++;
  if (m.price != null && m.ma200 != null && m.price > m.ma200) s++;
  if ((m.rsi14 ?? 0) > 70) p++;
  if (m.price != null && m.ma200 != null && m.price < m.ma200) p++;
  if ((m.roc14 ?? 0) < 0 && (m.roc21 ?? 0) < 0) p++;
  return { score: s, penalties: p };
}
function buildRecommendation(m: StockMetrics) {
  const v = valueScore(m); const mm = momentumScore(m);
  const net = v + mm.score - mm.penalties;
  let rec: "Buy" | "Watch" | "Avoid" = "Watch";
  if (net >= 7 && mm.penalties <= 1) rec = "Buy";
  else if (net <= 2 || !passesGlobal(m)) rec = "Avoid";
  let confidence: "Low" | "Medium" | "High" = "Medium";
  if (m.dataMissing.length) confidence = "Low";
  else if (Math.abs(net - 5) >= 3) confidence = "High";
  const horizon = mm.score >= v ? "Short-term" : "Medium-term";
  return { rec, confidence, horizon, valueScore: v, momentumScore: mm.score, penalties: mm.penalties, net };
}

// ============== SEARCH / DISAMBIGUATE ==============
export const searchTickers = createServerFn({ method: "POST" })
  .middleware([supabaseAuthHeaders, optionalSupabaseAuth])
  .inputValidator(z.object({ q: z.string().min(1).max(80) }))
  .handler(async ({ data, context }) => {
    if (context.userId) await enforceRateLimit(context.userId, "analyze.searchTickers", 120, 3600);
    const q = data.q.trim();
    return cachedSWR(`search:${q.toLowerCase()}`, 5 * 60_000, async () => {
      const looksLikeSymbol = /^[A-Za-z0-9.\-]{1,15}$/.test(q);
      const results: Listing[] = [];

      if (looksLikeSymbol) {
        const [bySym, byName] = await Promise.all([
          fetchListingsBySymbols([q.toUpperCase()]).catch(() => [] as any[]),
          fi<any>("/search", { search_text: q, quote_types: ["stock"], sort_by: [{ selector: "amount_usd", desc: true }], limit: 12 }).then((r) => r?.items ?? []).catch(() => [] as any[]),
        ]);
        for (const it of bySym) results.push(listingFromItem(it));
        const seen = new Set(results.map((r) => r.symbol));
        for (const it of byName) {
          if (!seen.has(it.symbol)) { seen.add(it.symbol); results.push(listingFromItem(it)); }
        }
      } else {
        const r = await fi<any>("/search", { search_text: q, quote_types: ["stock"], sort_by: [{ selector: "amount_usd", desc: true }], limit: 15 }).catch(() => null);
        for (const it of (r?.items ?? [])) results.push(listingFromItem(it));
      }

      // Yahoo Finance fallback if Finimpulse returned nothing
      if (results.length === 0) {
        const yahoo = await yahooSearch(q, 15).catch(() => []);
        const seen = new Set<string>();
        for (const it of yahoo) {
          if (seen.has(it.symbol)) continue;
          seen.add(it.symbol);
          const fb = detectFromSymbol(it.symbol);
          results.push({
            symbol: it.symbol,
            companyName: it.longname ?? it.shortname ?? it.symbol,
            exchange: it.exchange ?? fb.exchange,
            fullExchange: it.exchDisp ?? null,
            country: fb.country,
            region: fb.region,
            currency: fb.currency,
            sector: it.sector ?? null,
            industry: it.industry ?? null,
            marketCap: null,
            marketCapUsd: null,
            listingType: "stock",
          });
        }
      }

      // FMP fallback if still nothing (only fires when FMP_API_KEY is set)
      if (results.length === 0) {
        const fmp = await fmpSearch(q, 15).catch(() => []);
        const seen = new Set<string>();
        for (const it of fmp) {
          if (seen.has(it.symbol)) continue;
          seen.add(it.symbol);
          const fb = detectFromSymbol(it.symbol);
          results.push({
            symbol: it.symbol,
            companyName: it.name ?? it.symbol,
            exchange: it.exchange ?? fb.exchange,
            fullExchange: null,
            country: fb.country,
            region: fb.region,
            currency: it.currency ?? fb.currency,
            sector: null,
            industry: null,
            marketCap: null,
            marketCapUsd: null,
            listingType: "stock",
          });
        }
      }

      return { matches: results.slice(0, 15) } as const;
    });
  });

// ============== ANALYZE ==============
export const analyzeTicker = createServerFn({ method: "POST" })
  .middleware([supabaseAuthHeaders, requireSupabaseAuth])
  .inputValidator(z.object({ ticker: z.string().min(1).max(20).regex(/^[A-Za-z0-9.\-]+$/) }))
  .handler(async ({ data, context }) => {
    await enforceRateLimit(context.userId, "analyze.analyzeTicker", 60, 3600);
    const symbol = data.ticker.trim();
    const target = await fetchMetrics(symbol);
    if (!target) {
      return { error: `Symbol "${symbol}" not found. Try the search box with a company name, or use exchange suffixes (e.g. RELIANCE.NS, 7203.T, BMW.DE).` } as const;
    }

    const peerItems = await fetchPeerCandidates(target, 25);
    const peerSymbols = peerItems.map((p) => p.symbol).filter((s) => s !== symbol);
    const peerResults = await Promise.all(
      peerSymbols.map((s, i) => fetchMetrics(s, peerItems[i]).catch(() => null))
    );
    const peers = peerResults.filter((x): x is StockMetrics => x !== null);

    const valueQualifiers = peers.filter(passesValue);
    const targetPassesValue = passesValue(target);

    const momentumPool = peers.filter(passesGlobal).filter((p) => p.perf5d != null);
    momentumPool.sort((a, b) => (b.perf5d ?? 0) - (a.perf5d ?? 0));
    const momentumTop = momentumPool.slice(0, 10).map((m) => ({
      ...m, ...classifyMomentum(m), rsiLabel: rsiLabel(m.rsi14),
    }));

    const valueSet = new Set(valueQualifiers.map((v) => v.symbol));
    const momSet = new Set(momentumTop.map((v) => v.symbol));
    const overlap = [...valueSet].filter((s) => momSet.has(s));

    const targetMomentum = classifyMomentum(target);
    const targetRec = buildRecommendation(target);

    return {
      target: {
        ...target, ...targetMomentum,
        rsiLabel: rsiLabel(target.rsi14),
        passesGlobal: passesGlobal(target),
        passesValue: targetPassesValue,
        recommendation: targetRec,
      },
      peers, valueQualifiers, momentumTop, overlap,
      filters: target.filter,
    } as const;
  });
