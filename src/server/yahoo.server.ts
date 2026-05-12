// Yahoo Finance fallback provider. Uses public query1/query2 endpoints — no API
// key required, works in Cloudflare Workers (pure fetch). Provides search,
// quote/summary, and historical closes. Used when Finimpulse fails or rate-limits.

import { fetchWithRetry } from "./http.server";

const UA = "Mozilla/5.0 (compatible; GlobalEquityTerminal/1.0)";

async function yj<T = any>(url: string, label: string): Promise<T | null> {
  try {
    const res = await fetchWithRetry(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      label,
      retries: 2,
      timeoutMs: 8000,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// ---------- search ----------
export type YahooSearchHit = {
  symbol: string;
  shortname?: string;
  longname?: string;
  exchDisp?: string;
  exchange?: string;
  quoteType?: string;
  sector?: string;
  industry?: string;
};

export async function yahooSearch(q: string, limit = 15): Promise<YahooSearchHit[]> {
  const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=${limit}&newsCount=0`;
  const r = await yj<{ quotes: YahooSearchHit[] }>(url, `yahoo/search`);
  if (!r?.quotes) return [];
  return r.quotes.filter((x) => x.symbol && (x.quoteType ?? "EQUITY") === "EQUITY");
}

// ---------- chart (price + history) ----------
export type YahooChart = {
  symbol: string;
  currency: string | null;
  exchangeName: string | null;
  fullExchangeName: string | null;
  marketRegion: string | null;
  regularMarketPrice: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  fiftyDayAverage: number | null;
  twoHundredDayAverage: number | null;
  averageDailyVolume3Month: number | null;
  averageDailyVolume10Day: number | null;
  closes: number[];
  volumes: number[];
};

export async function yahooChart(symbol: string, range = "1y"): Promise<YahooChart | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${range}&includePrePost=false`;
  const r = await yj<any>(url, `yahoo/chart`);
  const result = r?.chart?.result?.[0];
  if (!result) return null;
  const meta = result.meta ?? {};
  const adj: number[] = result.indicators?.adjclose?.[0]?.adjclose ?? [];
  const raw: number[] = result.indicators?.quote?.[0]?.close ?? [];
  const volume: number[] = result.indicators?.volume?.[0]?.volume ?? [];
  const series = (adj.length ? adj : raw).filter((n: any) => typeof n === "number" && Number.isFinite(n));
  const volumeSeries = volume.filter((n: any) => typeof n === "number" && Number.isFinite(n) && n > 0);
  return {
    symbol,
    currency: meta.currency ?? null,
    exchangeName: meta.exchangeName ?? null,
    fullExchangeName: meta.fullExchangeName ?? null,
    marketRegion: meta.region ?? null,
    regularMarketPrice: meta.regularMarketPrice ?? null,
    fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ?? null,
    fiftyTwoWeekLow: meta.fiftyTwoWeekLow ?? null,
    fiftyDayAverage: meta.fiftyDayAverage ?? null,
    twoHundredDayAverage: meta.twoHundredDayAverage ?? null,
    averageDailyVolume3Month: meta.averageDailyVolume3Month ?? null,
    averageDailyVolume10Day: meta.averageDailyVolume10Day ?? null,
    closes: series,
    volumes: volumeSeries,
  };
}

// ---------- quoteSummary (fundamentals) ----------
export type YahooSummary = {
  longName: string | null;
  shortName: string | null;
  sector: string | null;
  industry: string | null;
  currency: string | null;
  exchange: string | null;
  fullExchangeName: string | null;
  country: string | null;
  marketCap: number | null;
  trailingPE: number | null;
  priceToBook: number | null;
  dividendYield: number | null; // percent
  earningsDate: string | null;
};

export async function yahooSummary(symbol: string): Promise<YahooSummary | null> {
  const modules = ["price", "summaryDetail", "defaultKeyStatistics", "assetProfile", "calendarEvents"].join(",");
  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}`;
  const r = await yj<any>(url, `yahoo/summary`);
  const res = r?.quoteSummary?.result?.[0];
  if (!res) return null;
  const price = res.price ?? {};
  const sd = res.summaryDetail ?? {};
  const ap = res.assetProfile ?? {};
  const ce = res.calendarEvents ?? {};
  const num = (x: any) => (typeof x === "object" && x !== null ? x.raw ?? null : (typeof x === "number" ? x : null));
  const earn = ce.earnings?.earningsDate?.[0];
  return {
    longName: price.longName ?? null,
    shortName: price.shortName ?? null,
    sector: ap.sector ?? null,
    industry: ap.industry ?? null,
    currency: price.currency ?? null,
    exchange: price.exchangeName ?? null,
    fullExchangeName: price.fullExchangeName ?? null,
    country: ap.country ?? null,
    marketCap: num(price.marketCap) ?? num(sd.marketCap),
    trailingPE: num(sd.trailingPE),
    priceToBook: num(res.defaultKeyStatistics?.priceToBook),
    dividendYield: num(sd.dividendYield) != null ? +(num(sd.dividendYield)! * 100).toFixed(2) : null,
    earningsDate: earn ? new Date((typeof earn === "object" ? earn.raw : earn) * 1000).toISOString().slice(0, 10) : null,
  };
}
