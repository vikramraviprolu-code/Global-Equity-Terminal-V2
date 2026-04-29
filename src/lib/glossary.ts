// Single source of truth for in-app metric / jargon definitions.
// Hover help everywhere reads from this map. Keep entries tight: one line,
// plain English, with the key threshold or unit if relevant.

export type GlossaryEntry = {
  term: string;        // canonical short label, e.g. "RSI"
  full?: string;       // expanded name, e.g. "Relative Strength Index"
  definition: string;  // one-sentence plain-English meaning
  hint?: string;       // optional reading guide ("> 70 overbought")
  group:
    | "metric"        // technicals
    | "score"         // composite scores
    | "fundamental"   // valuation / earnings
    | "alert"
    | "data"
    | "portfolio"
    | "recommendation"
    | "navigation"    // app concepts (screener, terminal, presets…)
    | "market";       // market structure (region, exchange, sector…)
};

export const GLOSSARY = {
  // =========================================================================
  // TECHNICALS
  // =========================================================================
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
  roc14: {
    term: "ROC14",
    full: "Rate of Change (14-day)",
    definition: "Percentage change in price over the last 14 trading days.",
    group: "metric",
  },
  roc21: {
    term: "ROC21",
    full: "Rate of Change (21-day)",
    definition: "Percentage change in price over the last 21 trading days.",
    group: "metric",
  },
  ma20: {
    term: "MA20",
    full: "20-Day Moving Average",
    definition: "Average closing price over the last 20 trading days. Tracks short-term trend.",
    group: "metric",
  },
  ma50: {
    term: "MA50",
    full: "50-Day Moving Average",
    definition: "Average closing price over the last 50 trading days. Common medium-term trend marker.",
    group: "metric",
  },
  ma200: {
    term: "MA200",
    full: "200-Day Moving Average",
    definition: "Average closing price over the last 200 trading days. Standard long-term trend reference.",
    hint: "Price above MA200 is generally treated as a bullish primary trend.",
    group: "metric",
  },
  maCross: {
    term: "MA Cross",
    full: "Moving Average Cross",
    definition: "Whether the short MA (50d) is above or below the long MA (200d).",
    hint: "Golden cross = bullish, death cross = bearish.",
    group: "metric",
  },
  goldenCross: {
    term: "Golden Cross",
    definition: "When the 50-day MA crosses above the 200-day MA — a classic bullish signal.",
    group: "metric",
  },
  deathCross: {
    term: "Death Cross",
    definition: "When the 50-day MA crosses below the 200-day MA — a classic bearish signal.",
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
  high52w: {
    term: "52W High",
    definition: "Highest closing price in the trailing 52 weeks.",
    group: "metric",
  },
  low52w: {
    term: "52W Low",
    definition: "Lowest closing price in the trailing 52 weeks.",
    group: "metric",
  },
  volatility: {
    term: "Volatility",
    definition: "How much the price swings around its average — higher means bigger gains and losses.",
    group: "metric",
  },
  drawdown: {
    term: "Drawdown",
    definition: "Peak-to-trough decline during a specific period, expressed as a percentage.",
    hint: "Used to size downside risk.",
    group: "metric",
  },
  signal: {
    term: "Signal",
    definition: "Net read of the technical setup (e.g. Bullish, Neutral, Bearish) combining RSI, ROC, and MA position.",
    group: "metric",
  },
  outlook: {
    term: "Outlook",
    definition: "Short, qualitative summary of where momentum and trend are pointing next.",
    group: "metric",
  },

  // =========================================================================
  // FUNDAMENTALS
  // =========================================================================
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
  eps: {
    term: "EPS",
    full: "Earnings Per Share",
    definition: "Net income divided by outstanding shares — how much profit each share earned.",
    group: "fundamental",
  },
  avgVol: {
    term: "Avg Vol",
    full: "Average Daily Volume",
    definition: "Average number of shares traded per day, used as a liquidity proxy.",
    group: "fundamental",
  },
  liquidity: {
    term: "Liquidity",
    definition: "How easily the stock can be bought or sold at a fair price — driven by volume and float.",
    group: "fundamental",
  },

  // =========================================================================
  // COMPOSITE SCORES
  // =========================================================================
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
  netScore: {
    term: "Net Score",
    definition: "Final composite score (Value + Momentum − Penalty) used to derive the recommendation.",
    group: "score",
  },
  penalty: {
    term: "Penalty",
    definition: "Points deducted from the composite for high-risk or low-quality signals (e.g. broken trend, overbought).",
    group: "score",
  },

  // =========================================================================
  // RECOMMENDATIONS
  // =========================================================================
  recommendation: {
    term: "Recommendation",
    definition: "Final call (Buy / Accumulate / Hold / Trim / Avoid) derived from the net score and risk profile.",
    group: "recommendation",
  },
  buy: { term: "Buy", definition: "Strong setup across value and momentum with limited downside risk.", group: "recommendation" },
  accumulate: { term: "Accumulate", definition: "Constructive setup; build position over time rather than all at once.", group: "recommendation" },
  hold: { term: "Hold", definition: "Mixed signals — wait for clearer confirmation before adding or trimming.", group: "recommendation" },
  trim: { term: "Trim", definition: "Reduce exposure; risk indicators are starting to outweigh the bull case.", group: "recommendation" },
  avoid: { term: "Avoid", definition: "Risk indicators dominate; the setup does not meet entry criteria.", group: "recommendation" },
  bullCase: { term: "Bull Case", definition: "Conditions that would drive the stock higher (multiple expansion, earnings beats, sector tailwinds).", group: "recommendation" },
  bearCase: { term: "Bear Case", definition: "Conditions that would drive the stock lower (margin compression, derating, broken trend).", group: "recommendation" },
  thesis: { term: "Thesis", definition: "Concise summary of why the stock is interesting and what would invalidate that view.", group: "recommendation" },
  horizon: { term: "Horizon", definition: "Suggested holding period for the recommendation (short / medium / long term).", group: "recommendation" },
  catalyst: { term: "Catalyst", definition: "Upcoming event or news item likely to materially move the price (earnings, regulator, M&A, macro print).", group: "recommendation" },
  peer: { term: "Peer", definition: "Another company in the same sector/industry used for relative comparison.", group: "recommendation" },

  // =========================================================================
  // DATA QUALITY
  // =========================================================================
  confidence: {
    term: "Confidence",
    definition: "0–100 score combining data freshness, source reliability, and verification depth.",
    hint: "Below 50 = treat as directional only.",
    group: "data",
  },
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
  stale: {
    term: "Stale",
    definition: "Data older than the freshness threshold for its category — treat with caution.",
    group: "data",
  },
  verified: {
    term: "Verified",
    definition: "Metric whose value matches across two or more independent sources.",
    group: "data",
  },
  provenance: {
    term: "Provenance",
    definition: "Origin metadata for a value: source name, retrieval timestamp, freshness, and confidence.",
    group: "data",
  },

  // =========================================================================
  // ALERTS
  // =========================================================================
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
  alertEvent: {
    term: "Alert Event",
    definition: "A single recorded firing of an alert rule, with the value at trigger and a timestamp.",
    group: "alert",
  },

  // =========================================================================
  // PORTFOLIO
  // =========================================================================
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
  holding: {
    term: "Holding",
    definition: "A single position: symbol, shares owned, cost basis, currency, and notes.",
    group: "portfolio",
  },

  // =========================================================================
  // MARKET STRUCTURE
  // =========================================================================
  ticker: {
    term: "Ticker",
    definition: "Short symbol identifying a listed security (e.g. AAPL, RELIANCE.NS).",
    group: "market",
  },
  exchange: {
    term: "Exchange",
    definition: "The venue where the security is listed (e.g. NASDAQ, NSE, LSE).",
    group: "market",
  },
  sector: {
    term: "Sector",
    definition: "Broad industry classification (e.g. Technology, Energy, Financials).",
    group: "market",
  },
  industry: {
    term: "Industry",
    definition: "More specific grouping inside a sector (e.g. Semiconductors inside Technology).",
    group: "market",
  },
  region: {
    term: "Region",
    definition: "Geographic grouping used in this app: US, India, EU, APAC, OTHER.",
    group: "market",
  },
  currency: {
    term: "Currency",
    definition: "The currency a security trades and reports in. Display can be toggled to USD or local.",
    group: "market",
  },
  fx: {
    term: "FX",
    full: "Foreign Exchange",
    definition: "Conversion rate used to normalise local-currency values to USD for cross-region comparison.",
    group: "market",
  },
  universe: {
    term: "Universe",
    definition: "The full set of ~150 curated global tickers covered by the terminal across US, India, EU, APAC.",
    group: "market",
  },

  // =========================================================================
  // APP CONCEPTS
  // =========================================================================
  navGroups: {
    term: "Nav Groups",
    definition: "Top nav is grouped into 4 dropdown menus: Research (Screener, Analysis, Compare), Workspace (Watchlists, Portfolio, Alerts), Market (Events), and System (Data Quality, Sources, Settings).",
    group: "navigation",
  },
  screener: {
    term: "Screener",
    definition: "Default landing page for filtering the universe by region, sector, valuation, and momentum metrics. Lives under the Research menu.",
    group: "navigation",
  },
  terminal: {
    term: "Terminal",
    definition: "Per-ticker analysis page with snapshot, chart, scores, news, sources, and recommendation tabs.",
    group: "navigation",
  },
  preset: {
    term: "Preset",
    definition: "Saved combination of screener filters (e.g. Value Near Lows, Momentum Breakouts).",
    group: "navigation",
  },
  watchlist: {
    term: "Watchlist",
    definition: "User-curated list of tickers. Three local lists: My, Value Candidates, Momentum Candidates.",
    group: "navigation",
  },
  compare: {
    term: "Compare",
    definition: "Side-by-side view of up to 6 tickers with best/worst highlighting on every metric.",
    group: "navigation",
  },
  diffMode: {
    term: "Diff Mode",
    definition: "Highlights metric changes between two snapshots in Compare so deltas stand out.",
    group: "navigation",
  },
  heatmap: {
    term: "Heatmap",
    definition: "Sector tree-map showing relative weight and recent performance at a glance.",
    group: "navigation",
  },
  sparkline: {
    term: "Sparkline",
    definition: "Tiny inline chart showing recent price trend without axes or labels.",
    group: "navigation",
  },
  narrative: {
    term: "AI Narrative",
    definition: "AI-generated plain-English summary of a ticker's setup, drawn from the underlying metrics.",
    group: "navigation",
  },
  copilot: {
    term: "AI Co-pilot",
    definition: "Command bar (⌘K) that answers questions about tickers and jumps to routes.",
    group: "navigation",
  },
  backtest: {
    term: "Backtest",
    definition: "Replay of how a strategy or screener preset would have performed over historical data.",
    group: "navigation",
  },
} as const satisfies Record<string, GlossaryEntry>;

export type GlossaryKey = keyof typeof GLOSSARY;
// Indexed accessor returning the broad GlossaryEntry shape (so `full`/`hint` stay optional).
export const glossaryEntry = (k: GlossaryKey): GlossaryEntry => GLOSSARY[k] as GlossaryEntry;
export const glossaryEntries = (): Array<[GlossaryKey, GlossaryEntry]> =>
  (Object.entries(GLOSSARY) as Array<[GlossaryKey, GlossaryEntry]>);
export const isGlossaryKey = (k: string): k is GlossaryKey => k in GLOSSARY;
