// Stooq fallback provider. Free CSV endpoints, no API key required.
// Coverage: US, UK, DE, JP, IN, HK, etc. Symbol format: lower-case with
// market suffix (e.g. aapl.us, vod.uk, 7203.jp, reliance.in, 0700.hk).
//
// Used only for price/history when both Finimpulse and Yahoo fail.

import { fetchWithRetry } from "./http.server";
import { sma, rsi, roc } from "./indicators.server";

function toStooqSymbol(symbol: string): string {
  const s = symbol.toLowerCase();
  if (s.includes(".")) {
    // Map Yahoo-style suffix to Stooq suffix
    const map: Record<string, string> = {
      ".ns": ".in", ".bo": ".in",
      ".l": ".uk",
      ".de": ".de", ".f": ".de",
      ".pa": ".fr",
      ".as": ".nl",
      ".mi": ".it",
      ".mc": ".es",
      ".sw": ".ch",
      ".st": ".se",
      ".he": ".fi",
      ".co": ".dk",
      ".ol": ".no",
      ".t": ".jp",
      ".hk": ".hk",
      ".ks": ".kr", ".kq": ".kr",
      ".tw": ".tw", ".two": ".tw",
      ".si": ".sg",
      ".ax": ".au",
      ".ss": ".cn", ".sz": ".cn",
    };
    const dot = s.lastIndexOf(".");
    const base = s.slice(0, dot);
    const suf = s.slice(dot);
    return base + (map[suf] ?? suf);
  }
  // Plain US ticker
  return `${s}.us`;
}

async function fetchCsv(url: string, label: string): Promise<string | null> {
  try {
    const res = await fetchWithRetry(url, {
      headers: { Accept: "text/csv,*/*" },
      label,
      retries: 1,
      timeoutMs: 8000,
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text || text.toLowerCase().startsWith("no data")) return null;
    return text;
  } catch {
    return null;
  }
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cells = line.split(",");
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = (cells[i] ?? "").trim(); });
    return row;
  });
}

export type StooqQuote = {
  symbol: string;
  closes: number[];
  price: number | null;
  high52: number | null;
  low52: number | null;
  ma20: number | null;
  ma50: number | null;
  ma200: number | null;
  rsi14: number | null;
  roc14: number | null;
  roc21: number | null;
  perf5d: number | null;
};

export async function stooqQuote(symbol: string): Promise<StooqQuote | null> {
  const sq = toStooqSymbol(symbol);
  // Daily history (CSV). `i=d` is daily, no auth.
  const csv = await fetchCsv(
    `https://stooq.com/q/d/l/?s=${encodeURIComponent(sq)}&i=d`,
    "stooq/history",
  );
  if (!csv) return null;
  const rows = parseCsv(csv);
  // Stooq columns: Date,Open,High,Low,Close,Volume
  const closes = rows
    .map((r) => parseFloat(r.close))
    .filter((n) => Number.isFinite(n));
  if (closes.length < 5) return null;
  const recent = closes.slice(-260);
  const price = recent[recent.length - 1];
  const high52 = Math.max(...recent);
  const low52 = Math.min(...recent);
  return {
    symbol,
    closes: recent,
    price,
    high52,
    low52,
    ma20: sma(recent, 20),
    ma50: sma(recent, 50),
    ma200: sma(recent, 200),
    rsi14: rsi(recent, 14),
    roc14: roc(recent, 14),
    roc21: roc(recent, 21),
    perf5d: roc(recent, 5),
  };
}
