// Single source of truth for in-app metric / jargon definitions.
// Hover help everywhere reads from this map. Keep entries tight: one line,
// plain English, with the key threshold or unit if relevant.

export type GlossaryEntry = {
  term: string;        // canonical short label, e.g. "RSI"
  full?: string;       // expanded name, e.g. "Relative Strength Index"
  definition: string;  // one-sentence plain-English meaning
  hint?: string;       // optional reading guide ("> 70 overbought")
  group: "metric" | "score" | "fundamental" | "alert" | "data" | "portfolio";
};

export const GLOSSARY: Record<string, GlossaryEntry> = {
  // ----- Technicals -----
  rsi: {
    term: "RSI",
    full: "Relative Strength Index (14-day)",
    definition: "Momentum oscillator measuring speed and magnitude of recent price moves on a 0–100 scale.",
    hint: "Above 70 = overbought, below 30 = oversold.",
    group: "metric",
  },
  roc: {
    term: "ROC",
    full: "Rate of Change",
    definition: "Percentage change in price over a fixed lookback window.",
    hint: "Positive = uptrend, negative = downtrend.",
    group: "metric",
  },
  maCross: {
    term: "MA Cross",
    full: "Moving Average Cross",
    definition: "Whether the short MA (50d) is above or below the long MA (200d).",
    hint: "Golden cross = bullish, death cross = bearish.",
    group: "metric",
  },
  perf5d: {
    term: "5d Perf",
    definition: "Price performance over the last 5 trading days, in percent.",
    group: "metric",
  },
  pctFromHigh: {
    term: "From 52w High",
    definition: "How far the current price is below the 52-week high, in percent.",
    hint: "Closer to 0% = near peak.",
    group: "metric",
  },
  pctFromLow: {
    term: "From 52w Low",
    definition: "How far the current price is above the 52-week low, in percent.",
    hint: "Closer to 0% = near trough.",
    group: "metric",
  },

  // ----- Fundamentals -----
  peRatio: {
    term: "P/E",
    full: "Price-to-Earnings Ratio",
    definition: "Share price divided by trailing earnings per share.",
    hint: "Lower can mean cheaper — but compare within the same sector.",
    group: "fundamental",
  },
  pbRatio: {
    term: "P/B",
    full: "Price-to-Book Ratio",
    definition: "Share price divided by book value per share.",
    hint: "< 1 can signal undervaluation; very low values often hide quality issues.",
    group: "fundamental",
  },
  dividendYield: {
    term: "Div Yield",
    full: "Dividend Yield",
    definition: "Annual dividend per share divided by price, as a percentage.",
    group: "fundamental",
  },
  marketCap: {
    term: "Market Cap",
    definition: "Total market value of outstanding shares, normalised to USD for comparison.",
    group: "fundamental",
  },

  // ----- Composite scores -----
  valueScore: {
    term: "Value",
    definition: "0–100 composite of P/E, P/B, dividend yield, and discount to 52w high.",
    hint: "Higher = cheaper relative to peers.",
    group: "score",
  },
  momentumScore: {
    term: "Momentum",
    definition: "0–100 composite of 5d/1m/3m returns, RSI, and MA cross.",
    hint: "Higher = stronger recent trend.",
    group: "score",
  },
  qualityScore: {
    term: "Quality",
    definition: "0–100 composite of margin stability, return on equity, and leverage.",
    hint: "Higher = healthier balance sheet and earnings.",
    group: "score",
  },
  riskScore: {
    term: "Risk",
    definition: "0–100 composite of volatility, distance from 52w low, and liquidity.",
    hint: "Lower is safer — this score is shown as 'risk', not 'safety'.",
    group: "score",
  },
  confidence: {
    term: "Confidence",
    definition: "0–100 score combining data freshness, source reliability, and verification depth.",
    hint: "Below 50 = treat as directional only.",
    group: "data",
  },

  // ----- Data quality -----
  mock: {
    term: "Mock",
    definition: "Synthetic placeholder data used when a live source is unavailable.",
    hint: "Use 'Exclude mock' in the screener for live-only results.",
    group: "data",
  },
  freshness: {
    term: "Freshness",
    definition: "How recently the metric was retrieved from its source.",
    group: "data",
  },

  // ----- Alerts -----
  price_above: { term: "Price above", definition: "Fires when last price ≥ threshold.", group: "alert" },
  price_below: { term: "Price below", definition: "Fires when last price ≤ threshold.", group: "alert" },
  rsi_above: { term: "RSI above", definition: "Fires when 14-day RSI ≥ threshold.", group: "alert" },
  rsi_below: { term: "RSI below", definition: "Fires when 14-day RSI ≤ threshold.", group: "alert" },
  near_52w_high: { term: "Near 52w high", definition: "Fires when within X% of the 52-week high.", group: "alert" },
  near_52w_low: { term: "Near 52w low", definition: "Fires when within X% of the 52-week low.", group: "alert" },
  pct_change_above: { term: "5d % above", definition: "Fires when 5-day performance ≥ threshold %.", group: "alert" },
  pct_change_below: { term: "5d % below", definition: "Fires when 5-day performance ≤ threshold %.", group: "alert" },
  cooldown: {
    term: "Cooldown",
    definition: "Minimum interval between consecutive fires of the same alert rule (currently 12 hours).",
    group: "alert",
  },

  // ----- Portfolio -----
  costBasis: {
    term: "Cost Basis",
    definition: "Total amount paid for the position, in the holding's currency.",
    group: "portfolio",
  },
  unrealizedPnl: {
    term: "Unrealized P&L",
    definition: "Current market value minus cost basis for positions still held.",
    group: "portfolio",
  },
  allocation: {
    term: "Allocation",
    definition: "Share of total portfolio value held in a sector, region, or position.",
    group: "portfolio",
  },
};

export type GlossaryKey = keyof typeof GLOSSARY;
export const isGlossaryKey = (k: string): k is GlossaryKey => k in GLOSSARY;
