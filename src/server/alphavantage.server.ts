// Alpha Vantage fallback provider. Free tier with 500 requests/day, 25 requests/minute.
// No API key required for basic functionality, but enhanced features need a key.
// Provides global equity data, forex, and cryptocurrency data.
// Used as additional fallback when Yahoo and Stooq fail.

import { fetchWithRetry } from "./http.server";
import { sma, rsi, roc } from "./indicators.server";

const AV_BASE = "https://www.alphavantage.co/query";

function key(): string | null {
  const k = process.env.ALPHAVANTAGE_API_KEY;
  if (!k) return "demo"; // Alpha Vantage provides a demo key
  return k;
}

async function av<T = any>(params: Record<string, string>, label: string): Promise<T | null> {
  try {
    const k = key();
    const url = `${AV_BASE}?${new URLSearchParams({ ...params, apikey: k }).toString()}`;
    const res = await fetchWithRetry(url, {
      headers: { Accept: "application/json" },
      label,
      retries: 1,
      timeoutMs: 10000,
    });
    if (!res.ok) return null;
    const json = (await res.json()) as any;
    
    // Alpha Vantage returns error messages in a specific format
    if (json?.["Error Message"]) return null;
    if (json?.["Note"]) return null; // Rate limit message
    if (json?.["Information"]) return null; // API call information
    
    return json as T;
  } catch {
    return null;
  }
}

export type AlphaVantageQuote = {
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
  avgVolume: number | null;
  dividendYield: number | null;
  sector: string | null;
  industry: string | null;
  closes: number[];
  volumes: number[];
};

export async function alphaVantageQuote(symbol: string): Promise<AlphaVantageQuote | null> {
  try {
    // Get quote overview
    const overview = await av<any>(
      { function: "OVERVIEW", symbol: symbol.toUpperCase() },
      "av/overview"
    );

    // Get daily historical data
    const history = await av<any>(
      { function: "TIME_SERIES_DAILY", symbol: symbol.toUpperCase(), outputsize: "compact" },
      "av/history"
    );

    if (!overview && !history) return null;

    const timeSeries = history?.["Time Series (Daily)"] || {};
    const dates = Object.keys(timeSeries).sort();
    
    const closes: number[] = [];
    const volumes: number[] = [];

    for (const date of dates.slice(-260)) { // Last 260 trading days
      const entry = timeSeries[date];
      if (entry) {
        const close = parseFloat(entry["4. close"]);
        const volume = parseFloat(entry["5. volume"]);
        if (!isNaN(close) && close > 0) closes.push(close);
        if (!isNaN(volume) && volume > 0) volumes.push(volume);
      }
    }

    if (closes.length < 5) return null;

    const latest = dates[dates.length - 1];
    const latestData = timeSeries[latest];

    return {
      symbol: symbol.toUpperCase(),
      name: overview?.["Name"] || null,
      exchange: overview?.["Exchange"] || null,
      currency: overview?.["Currency"] || "USD",
      price: parseFloat(latestData?.["4. close"]) || closes[closes.length - 1] || null,
      marketCap: overview?.["MarketCapitalization"] ? parseFloat(overview["MarketCapitalization"]) : null,
      pe: overview?.["PERatio"] && overview["PERRatio"] !== "None" ? parseFloat(overview["PERatio"]) : null,
      pb: overview?.["PriceToBookRatio"] && overview["PriceToBookRatio"] !== "None" ? parseFloat(overview["PriceToBookRatio"]) : null,
      high52: overview?.["52WeekHigh"] ? parseFloat(overview["52WeekHigh"]) : Math.max(...closes),
      low52: overview?.["52WeekLow"] ? parseFloat(overview["52WeekLow"]) : Math.min(...closes),
      avgVolume: volumes.length > 0 ? volumes.reduce((a, b) => a + b, 0) / volumes.length : null,
      dividendYield: overview?.["DividendYield"] ? parseFloat(overview["DividendYield"]) : null,
      sector: overview?.["Sector"] || null,
      industry: overview?.["Industry"] || null,
      closes,
      volumes,
    };
  } catch {
    return null;
  }
}

export async function alphaVantageSearch(query: string): Promise<any[]> {
  try {
    const result = await av<any>(
      { function: "SYMBOL_SEARCH", keywords: query },
      "av/search"
    );

    if (!result?.["bestMatches"]) return [];

    return result["bestMatches"].map((match: any) => ({
      symbol: match["1. symbol"],
      name: match["2. name"],
      type: match["3. type"],
      region: match["4. region"],
      marketOpen: match["5. marketOpen"],
      marketClose: match["6. marketClose"],
      timezone: match["7. timezone"],
      currency: match["8. currency"],
      matchScore: match["9. matchScore"],
    }));
  } catch {
    return [];
  }
}
