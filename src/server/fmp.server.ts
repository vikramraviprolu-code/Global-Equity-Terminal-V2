// Financial Modeling Prep fallback. Free tier is rate-limited but works for
// US tickers. Only enabled if FMP_API_KEY env var is set.

import { fetchWithRetry } from "./http.server";

function key(): string | null {
  return process.env.FMP_API_KEY ?? null;
}

async function fj<T = any>(url: string, label: string): Promise<T | null> {
  try {
    const res = await fetchWithRetry(url, {
      headers: { Accept: "application/json" },
      label,
      retries: 1,
      timeoutMs: 8000,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export type FmpQuote = {
  symbol: string;
  name: string | null;
  exchange: string | null;
  currency: string | null;
  price: number | null;
  marketCap: number | null;
  pe: number | null;
  pb: number | null;
  high52: number | null;
  low52: number | null;
  ma50: number | null;
  ma200: number | null;
  avgVolume: number | null;
  dividendYield: number | null;
  sector: string | null;
  industry: string | null;
  closes: number[];
};

export async function fmpQuote(symbol: string): Promise<FmpQuote | null> {
  const k = key();
  if (!k) return null;
  const [quote, profile, hist] = await Promise.all([
    fj<any[]>(`https://financialmodelingprep.com/api/v3/quote/${encodeURIComponent(symbol)}?apikey=${k}`, "fmp/quote"),
    fj<any[]>(`https://financialmodelingprep.com/api/v3/profile/${encodeURIComponent(symbol)}?apikey=${k}`, "fmp/profile"),
    fj<any>(`https://financialmodelingprep.com/api/v3/historical-price-full/${encodeURIComponent(symbol)}?serietype=line&timeseries=260&apikey=${k}`, "fmp/history"),
  ]);
  const q = Array.isArray(quote) ? quote[0] : null;
  const p = Array.isArray(profile) ? profile[0] : null;
  if (!q && !p) return null;
  const histArr: any[] = hist?.historical ?? [];
  const closes = histArr
    .slice()
    .reverse()
    .map((x) => Number(x.close))
    .filter((n) => Number.isFinite(n));
  return {
    symbol,
    name: q?.name ?? p?.companyName ?? null,
    exchange: q?.exchange ?? p?.exchangeShortName ?? null,
    currency: p?.currency ?? null,
    price: q?.price ?? (closes.length ? closes[closes.length - 1] : null),
    marketCap: q?.marketCap ?? p?.mktCap ?? null,
    pe: q?.pe ?? null,
    pb: null,
    high52: q?.yearHigh ?? null,
    low52: q?.yearLow ?? null,
    ma50: q?.priceAvg50 ?? null,
    ma200: q?.priceAvg200 ?? null,
    avgVolume: q?.avgVolume ?? null,
    dividendYield: p?.lastDiv && q?.price ? +((p.lastDiv / q.price) * 100).toFixed(2) : null,
    sector: p?.sector ?? null,
    industry: p?.industry ?? null,
    closes,
  };
}

export async function fmpSearch(q: string, limit = 12): Promise<Array<{
  symbol: string; name: string; exchange: string | null; currency: string | null;
}>> {
  const k = key();
  if (!k) return [];
  const r = await fj<any[]>(
    `https://financialmodelingprep.com/api/v3/search?query=${encodeURIComponent(q)}&limit=${limit}&apikey=${k}`,
    "fmp/search",
  );
  if (!Array.isArray(r)) return [];
  return r.map((x) => ({
    symbol: x.symbol,
    name: x.name,
    exchange: x.exchangeShortName ?? x.stockExchange ?? null,
    currency: x.currency ?? null,
  }));
}
