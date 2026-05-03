import { useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { getRouteApi } from "@tanstack/react-router";
import { analyzeTicker, searchTickers } from "@/server/analyze";
import { fmtNum, fmtPct, fmtMcap, fmtMcapUsd, fmtVol, fmtPrice, fmtPriceDisplay, fmtMcapDisplay, colorFor, trendArrow, vsMA } from "@/lib/format";
import { useDisplayCurrency } from "@/hooks/use-display-currency";
import { SiteNav, Disclaimer as SharedDisclaimer } from "@/components/site-nav";
import { PriceChart } from "@/components/price-chart";
import { useWatchlist } from "@/hooks/use-watchlist";
import { scoreRow } from "@/lib/scores";
import { backtestMaCross, computeHistoricalReturns } from "@/lib/backtest";
import { SourcedCell } from "@/components/sourced-value";
import { provenanceFor } from "@/lib/sourced";
import { downloadTerminalPdf } from "@/lib/pdf-report";
import { onAction } from "@/lib/action-bus";
import { AiNarrative } from "@/components/ai-narrative";
import { AskTerminal } from "@/components/ask-terminal";
import { NewsCatalysts } from "@/components/news-catalysts";
import { MetricLabel } from "@/components/metric-label";
import { ProviderBadge } from "@/components/provider-badge";

const routeApi = getRouteApi("/terminal");


type AnalysisResult = Awaited<ReturnType<typeof analyzeTicker>>;
type Success = Extract<AnalysisResult, { target: any }>;
type SearchResult = Awaited<ReturnType<typeof searchTickers>>;
type Match = SearchResult["matches"][number];

export function TerminalPage({ initialTicker: initialTickerProp }: { initialTicker?: string } = {}) {
  // When mounted from /terminal/$symbol, the prop wins. When mounted from /terminal,
  // fall back to the ?t= search param. Wrap useSearch in a try so the route api
  // doesn't throw when this component is rendered outside the /terminal route.
  let searchTicker: string | undefined;
  try { searchTicker = (routeApi.useSearch() as { t?: string }).t; } catch { searchTicker = undefined; }
  const initialTicker = initialTickerProp ?? searchTicker;
  const [query, setQuery] = useState(initialTicker ?? "");
  const [tab, setTab] = useState<"overview" | "chart" | "scores" | "value" | "momentum" | "peers" | "cross" | "scenario" | "final">("overview");

  const search = useMutation({ mutationFn: (q: string) => searchTickers({ data: { q } }) });
  const analyze = useMutation({ mutationFn: (t: string) => analyzeTicker({ data: { ticker: t } }) });

  const lastAutoRan = useRef<string | null>(null);
  useEffect(() => {
    if (initialTicker && lastAutoRan.current !== initialTicker) {
      lastAutoRan.current = initialTicker;
      analyze.mutate(initialTicker);
    }
  }, [initialTicker, analyze]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setTab("overview");
    analyze.reset();
    search.reset();
    // Fast-path only for inputs that clearly look like a ticker:
    //  - contains an exchange suffix dot (e.g. RELIANCE.NS, 7203.T)
    //  - contains a digit (e.g. 7203, 005930.KS)
    //  - is short ALL-CAPS letters (e.g. AAPL, MSFT) — typed deliberately
    // Plain lowercase words like "adani" or "reliance" must go through search
    // so we can disambiguate to the right exchange listing.
    const looksLikeSymbol =
      /^[A-Za-z0-9.\-]{1,15}$/.test(q) &&
      (q.includes(".") || /\d/.test(q) || (/^[A-Z]{1,6}$/.test(q)));
    if (looksLikeSymbol) {
      analyze.mutate(q.toUpperCase());
    } else {
      search.mutate(q, {
        onSuccess: (res) => {
          const m = res?.matches ?? [];
          if (m.length === 0) {
            // No name matches — try analyzing the raw query as a symbol fallback.
            analyze.mutate(q.toUpperCase());
          } else if (m.length === 1) {
            analyze.mutate(m[0].symbol);
          }
        },
      });
    }
  };

  const onPickMatch = (sym: string) => {
    setTab("overview");
    analyze.mutate(sym);
  };

  const matches = search.data?.matches ?? [];
  const showPicker = !analyze.isPending && !analyze.data && matches.length > 1;
  const data = analyze.data;
  const isError = data && "error" in data;
  const result = data && !("error" in data) ? data : null;

  // Press "e" to download the PDF report when a result is loaded
  useEffect(() => {
    if (!result) return;
    return onAction("export", () => downloadTerminalPdf(result));
  }, [result]);

  return (
    <div className="min-h-screen">
      <SiteNav />
      <SubHeader query={query} setQuery={setQuery} onSubmit={onSubmit} loading={search.isPending || analyze.isPending} />

      <main className="max-w-[1400px] mx-auto px-4 py-6">
        {!search.data && !analyze.data && !search.isPending && !analyze.isPending && <EmptyState />}
        {(search.isPending || analyze.isPending) && <LoadingState label={analyze.isPending ? "Analyzing" : "Searching"} value={query} />}
        {search.isError && <ErrorPanel message="Search failed. Please try again." />}
        {analyze.isError && <ErrorPanel message="Analysis failed. Please try again." />}
        {isError && <ErrorPanel message={(data as any).error} />}

        {showPicker && (
          <DisambiguationPanel matches={matches} onPick={onPickMatch} query={query} />
        )}

        {result && (
          <>
            <SnapshotBar r={result} />
            <Tabs tab={tab} setTab={setTab} />
            <div className="mt-4">
              {tab === "overview" && <OverviewSection r={result} />}
              {tab === "chart" && <ChartSection r={result} />}
              {tab === "scores" && <ScoresSection r={result} />}
              {tab === "value" && <ValueSection r={result} />}
              {tab === "momentum" && <MomentumSection r={result} />}
              {tab === "peers" && <PeersSection r={result} />}
              {tab === "cross" && <CrossSection r={result} />}
              {tab === "scenario" && <ScenarioSection r={result} />}
              {tab === "final" && <FinalSection r={result} />}
            </div>
            <SharedDisclaimer />
          </>
        )}
      </main>
    </div>
  );
}

function SubHeader({ query, setQuery, onSubmit, loading }: { query: string; setQuery: (s: string) => void; onSubmit: (e: React.FormEvent) => void; loading: boolean }) {
  return (
    <div className="border-b border-border bg-card/50">
      <div className="max-w-[1400px] mx-auto px-4 py-2">
        <form onSubmit={onSubmit} className="flex items-center gap-2 max-w-3xl">
          <div className="flex items-center gap-2 flex-1 bg-input border border-border rounded px-3 py-1.5 focus-within:border-primary">
            <span className="text-xs text-muted-foreground font-mono">{">"}</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="TICKER OR COMPANY (AAPL · RELIANCE.NS · 7203.T · BMW.DE · Tencent)"
              maxLength={80}
              className="flex-1 bg-transparent outline-none font-mono text-sm placeholder:text-muted-foreground/60"
            />
          </div>
          <button type="submit" disabled={loading} className="bg-primary text-primary-foreground font-mono text-xs px-4 py-2 rounded hover:opacity-90 disabled:opacity-50 uppercase tracking-wider">
            {loading ? "Running…" : "Analyze"}
          </button>
        </form>
      </div>
    </div>
  );
}

function EmptyState() {
  const examples = [
    ["AAPL", "Apple — NASDAQ"],
    ["RELIANCE.NS", "Reliance — NSE"],
    ["7203.T", "Toyota — Tokyo"],
    ["0700.HK", "Tencent — HKEX"],
    ["BMW.DE", "BMW — Xetra"],
    ["BHP.AX", "BHP — ASX"],
    ["005930.KS", "Samsung — KRX"],
    ["TSM", "TSMC ADR — NYSE"],
  ];
  return (
    <div className="panel p-10 mt-12">
      <div className="text-center">
        <h2 className="text-lg font-mono text-primary tracking-wider">GLOBAL EQUITY RESEARCH TERMINAL</h2>
        <p className="text-sm text-muted-foreground mt-3 max-w-2xl mx-auto">
          Search by ticker or company name across <span className="text-foreground">USA, India, Europe, Japan, Hong Kong, Korea, Taiwan, Singapore, Australia,</span> and Greater China. Run value screens, momentum analysis, and evidence-based recommendations against region-aware peer groups.
        </p>
      </div>
      <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-3xl mx-auto">
        {examples.map(([t, l]) => (
          <div key={t} className="border border-border rounded p-2 text-center">
            <div className="font-mono text-primary text-xs">{t}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{l}</div>
          </div>
        ))}
      </div>
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-3 text-left max-w-3xl mx-auto text-xs">
        {[
          ["Regional Filters", "Per-market thresholds for price, volume, and USD-equivalent market cap"],
          ["Local Currency", "Always shown in native currency; market cap normalized to USD for comparison"],
          ["Smart Peers", "Same industry → country → region → global fallback"],
        ].map(([h, d]) => (
          <div key={h} className="border border-border rounded p-3">
            <div className="text-primary font-mono uppercase tracking-wider">{h}</div>
            <div className="text-muted-foreground mt-1">{d}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LoadingState({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel p-10 mt-8 text-center">
      <div className="font-mono text-sm text-primary animate-pulse">{label.toUpperCase()} · {value}</div>
      <div className="text-xs text-muted-foreground mt-3">Resolving listing · fetching peers · computing indicators…</div>
    </div>
  );
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <div className="panel mt-8 border-destructive/50">
      <div className="panel-header text-destructive">Error</div>
      <div className="p-6 text-sm">
        <p>{message}</p>
        <ul className="mt-4 text-xs text-muted-foreground list-disc pl-5 space-y-1">
          <li>Use exchange suffix for non-US listings (e.g. <span className="font-mono">RELIANCE.NS</span>, <span className="font-mono">7203.T</span>, <span className="font-mono">BMW.DE</span>)</li>
          <li>Try a company name search instead of a ticker</li>
          <li>ETFs, funds, and warrants are not supported</li>
        </ul>
      </div>
    </div>
  );
}

function DisambiguationPanel({ matches, onPick, query }: { matches: Match[]; onPick: (s: string) => void; query: string }) {
  // If single exact match, auto-pick by user clicking. We always show picker so user confirms exchange.
  return (
    <div className="panel mt-6">
      <div className="panel-header">Select Listing · {matches.length} match{matches.length === 1 ? "" : "es"} for "{query}"</div>
      <div className="overflow-x-auto">
        <table className="term">
          <thead>
            <tr><th>Company</th><th>Ticker</th><th>Exchange</th><th>Country</th><th>Currency</th><th>Sector</th><th>Industry</th><th>Mcap (USD)</th><th></th></tr>
          </thead>
          <tbody>
            {matches.map((m) => (
              <tr key={m.symbol} className="hover:bg-primary/5 cursor-pointer" onClick={() => onPick(m.symbol)}>
                <td>{m.companyName}</td>
                <td className="text-primary">{m.symbol}</td>
                <td>{m.fullExchange ?? m.exchange ?? "—"}</td>
                <td className="text-muted-foreground">{m.country ?? "—"}</td>
                <td className="text-muted-foreground">{m.currency}</td>
                <td className="text-muted-foreground">{m.sector ?? "—"}</td>
                <td className="text-muted-foreground">{m.industry ?? "—"}</td>
                <td className="num">{fmtMcapUsd(m.marketCapUsd)}</td>
                <td>
                  <button onClick={(e) => { e.stopPropagation(); onPick(m.symbol); }}
                    className="font-mono text-[10px] uppercase tracking-wider border border-primary/50 text-primary px-2 py-1 rounded hover:bg-primary/10">
                    Analyze
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 text-[11px] text-muted-foreground border-t border-border">
        Multiple listings of the same company may trade in different currencies and exchanges. Select the one you want to analyze.
      </div>
    </div>
  );
}

function SnapshotBar({ r }: { r: Success }) {
  const t = r.target;
  const wl = useWatchlist();
  const inList = wl.has(t.symbol);
  return (
    <div className="panel mb-4">
      <div className="p-4 flex flex-wrap items-baseline gap-x-6 gap-y-2 border-b border-border">
        <div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider">{t.sector ?? "—"} · {t.industry ?? "—"}</div>
          <div className="flex items-baseline gap-3 mt-1 flex-wrap">
            <span className="font-mono text-2xl text-primary font-semibold">{t.symbol}</span>
            <span className="text-sm text-muted-foreground">{t.companyName}</span>
            <span className="text-[10px] font-mono uppercase border border-border rounded px-1.5 py-0.5 text-muted-foreground">
              {t.fullExchange ?? t.exchange ?? "—"} · {t.country ?? t.region} · {t.currency}
            </span>
            <ProviderBadge source={t.source} />
            <button
              onClick={() => (inList ? wl.remove(t.symbol) : wl.add([t.symbol]))}
              className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded border transition-colors ${inList ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground hover:text-foreground"}`}
            >
              {inList ? "★ In Watchlist" : "☆ Add to Watchlist"}
            </button>
            <button
              onClick={() => downloadTerminalPdf(r)}
              title="Download PDF report (press E)"
              className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              ⬇ Download Report
            </button>
          </div>
        </div>
        <SnapshotStats t={t} />
      </div>
      <div className="px-4 py-2 flex flex-wrap gap-3 text-xs font-mono">
        <Pill ok={t.passesGlobal} label={`Liquidity (${t.region}): ${t.passesGlobal ? "PASS" : "FAIL"}`} />
        <Pill ok={t.passesValue} label={`Value Screen: ${t.passesValue ? "PASS" : "FAIL"}`} />
        <Pill ok={t.recommendation.rec === "Buy"} warn={t.recommendation.rec === "Watch"} label={`Rec: ${t.recommendation.rec}`} />
        <span className="text-muted-foreground">Outlook: <span className="text-foreground">{t.outlook}</span> · Conf: {t.confidence}</span>
      </div>
    </div>
  );
}

function SnapshotStats({ t }: { t: any }) {
  const [mode] = useDisplayCurrency();
  return (
    <div className="ml-auto flex items-baseline gap-6 font-mono">
      <Stat
        label="PRICE"
        value={fmtPriceDisplay(t.price, t.currency, t.marketCap, t.marketCapUsd, mode)}
        sub={mode === "USD" && (t.currency ?? "").toUpperCase() !== "USD" ? fmtPrice(t.price, t.currency) : undefined}
      />
      <Stat label="5D" value={fmtPct(t.perf5d)} cls={colorFor(t.perf5d)} />
      <Stat label="RSI" value={fmtNum(t.rsi14, 1)} cls={t.rsi14 == null ? "" : t.rsi14 > 70 ? "text-[color:var(--bear)]" : t.rsi14 < 30 ? "text-[color:var(--bull)]" : ""} />
      <Stat
        label="MCAP"
        value={fmtMcapDisplay(t.marketCap, t.marketCapUsd, t.currency, mode)}
        sub={mode === "local" && t.marketCapUsd ? fmtMcapUsd(t.marketCapUsd) : undefined}
      />
    </div>
  );
}

function Stat({ label, value, cls = "", sub }: { label: string; value: string; cls?: string; sub?: string }) {
  return (
    <div className="text-right">
      <div className="text-[10px] text-muted-foreground tracking-wider">{label}</div>
      <div className={`text-sm ${cls}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground">≈ {sub}</div>}
    </div>
  );
}

function Pill({ ok, warn, label }: { ok?: boolean; warn?: boolean; label: string }) {
  const cls = ok ? "border-[color:var(--bull)]/50 text-[color:var(--bull)]"
    : warn ? "border-primary/50 text-primary"
    : "border-[color:var(--bear)]/50 text-[color:var(--bear)]";
  return <span className={`px-2 py-0.5 rounded border ${cls}`}>{label}</span>;
}

function Tabs({ tab, setTab }: { tab: string; setTab: (t: any) => void }) {
  const tabs: Array<[string, string]> = [
    ["overview", "Overview"],
    ["chart", "Chart"],
    ["scores", "Scores"],
    ["value", "Value Screen"],
    ["momentum", "Momentum"],
    ["peers", "Peers"],
    ["cross", "Cross-Analysis"],
    ["scenario", "Scenario"],
    ["final", "Final Recommendation"],
  ];
  return (
    <div className="flex border-b border-border overflow-x-auto">
      {tabs.map(([k, l]) => (
        <button key={k} onClick={() => setTab(k)}
          className={`px-4 py-2 text-xs font-mono uppercase tracking-wider whitespace-nowrap border-b-2 transition-colors ${tab === k ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
          {l}
        </button>
      ))}
    </div>
  );
}

function OverviewSection({ r }: { r: Success }) {
  const t = r.target;
  const f = t.filter;
  // Treat analyze target as live data (analyze never returns mock).
  const provRow = { isMock: false, source: t.source ?? "Finimpulse", retrievedAt: new Date().toISOString(), closes: t.closes };
  const sv = (field: Parameters<typeof provenanceFor>[1], value: number | null) => provenanceFor(provRow, field, value);
  type Row = { k: string; v: React.ReactNode };
  const rows: Row[] = [
    { k: "Company", v: t.companyName },
    { k: "Exchange", v: `${t.fullExchange ?? t.exchange ?? "—"}` },
    { k: "Country / Region", v: `${t.country ?? "—"} · ${t.region}` },
    { k: "Currency", v: t.currency },
    { k: "Sector", v: t.sector ?? "—" },
    { k: "Industry", v: t.industry ?? "—" },
    { k: "Price", v: <SourcedCell provenance={sv("price", t.price)}>{fmtPrice(t.price, t.currency)}</SourcedCell> },
    { k: "Market Cap (Local)", v: <SourcedCell provenance={sv("marketCap", t.marketCap)}>{fmtMcap(t.marketCap, t.currency)}</SourcedCell> },
    { k: "Market Cap (USD)", v: <SourcedCell provenance={sv("marketCapUsd", t.marketCapUsd)}>{fmtMcapUsd(t.marketCapUsd)}</SourcedCell> },
    { k: "Avg Daily Volume", v: <SourcedCell provenance={sv("avgVolume", t.avgVolume)}>{fmtVol(t.avgVolume)}</SourcedCell> },
    { k: "52W Low", v: <SourcedCell provenance={sv("low52", t.low52)}>{fmtPrice(t.low52, t.currency)}</SourcedCell> },
    { k: "52W High", v: <SourcedCell provenance={sv("high52", t.high52)}>{fmtPrice(t.high52, t.currency)}</SourcedCell> },
    { k: "% From 52W Low", v: <SourcedCell provenance={sv("pctFromLow", t.pctFromLow)}>{fmtPct(t.pctFromLow)}</SourcedCell> },
    { k: "Trailing P/E", v: <SourcedCell provenance={sv("pe", t.pe)}>{fmtNum(t.pe)}</SourcedCell> },
    { k: "5D Performance", v: <SourcedCell provenance={sv("perf5d", t.perf5d)}>{fmtPct(t.perf5d)}</SourcedCell> },
    { k: "RSI 14D", v: <SourcedCell provenance={sv("rsi14", t.rsi14)}>{fmtNum(t.rsi14, 1)} ({t.rsiLabel})</SourcedCell> },
    { k: "ROC 14D", v: <SourcedCell provenance={sv("roc14", t.roc14)}>{fmtPct(t.roc14)}</SourcedCell> },
    { k: "ROC 21D", v: <SourcedCell provenance={sv("roc21", t.roc21)}>{fmtPct(t.roc21)}</SourcedCell> },
    { k: "Price vs 20D MA", v: <SourcedCell provenance={sv("ma20", t.ma20)}>{vsMA(t.price, t.ma20).label} ({fmtPrice(t.ma20, t.currency)})</SourcedCell> },
    { k: "Price vs 50D MA", v: <SourcedCell provenance={sv("ma50", t.ma50)}>{vsMA(t.price, t.ma50).label} ({fmtPrice(t.ma50, t.currency)})</SourcedCell> },
    { k: "Price vs 200D MA", v: <SourcedCell provenance={sv("ma200", t.ma200)}>{vsMA(t.price, t.ma200).label} ({fmtPrice(t.ma200, t.currency)})</SourcedCell> },
    { k: "Earnings Date", v: t.earningsDate ? new Date(t.earningsDate).toLocaleDateString() : "—" },
  ];
  // Compact, factual snapshot to feed the AI narrative — only fields the user
  // can already see on the page. No external data, no forward-looking metrics.
  const facts = [
    `Company: ${t.companyName} (${t.symbol})`,
    `Sector / Industry: ${t.sector ?? "—"} / ${t.industry ?? "—"}`,
    `Listing: ${t.fullExchange ?? t.exchange ?? "—"} · ${t.country ?? t.region} · ${t.currency}`,
    `Price: ${fmtPrice(t.price, t.currency)}`,
    `Market Cap (USD): ${fmtMcapUsd(t.marketCapUsd)}`,
    `52W range: ${fmtPrice(t.low52, t.currency)} – ${fmtPrice(t.high52, t.currency)} (${fmtPct(t.pctFromLow)} from low)`,
    `Trailing P/E: ${fmtNum(t.pe)}`,
    `5D performance: ${fmtPct(t.perf5d)}`,
    `RSI 14: ${fmtNum(t.rsi14, 1)} (${t.rsiLabel})`,
    `ROC 14 / 21: ${fmtPct(t.roc14)} / ${fmtPct(t.roc21)}`,
    `vs MA20 / MA50 / MA200: ${vsMA(t.price, t.ma20).label} / ${vsMA(t.price, t.ma50).label} / ${vsMA(t.price, t.ma200).label}`,
    `Recommendation: ${t.recommendation.rec} · Outlook: ${t.outlook} · Confidence: ${t.confidence}`,
    `Passes regional liquidity filter: ${t.passesGlobal ? "yes" : "no"} · Passes value screen: ${t.passesValue ? "yes" : "no"}`,
    t.dataMissing.length > 0 ? `Missing data: ${t.dataMissing.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="panel lg:col-span-2">
          <div className="panel-header flex items-center justify-between">
            <span>Snapshot · {t.symbol}</span>
            <span className="text-[10px] font-normal normal-case tracking-normal text-muted-foreground flex items-center gap-2">
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[color:var(--bull)]" />High</span>
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-primary" />Med</span>
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[color:var(--bear)]" />Low</span>
              <span className="text-muted-foreground/60">· hover for source</span>
            </span>
          </div>
          <table className="term">
            <tbody>
              {rows.map(({ k, v }) => (
                <tr key={k}><td className="text-muted-foreground w-1/2">{k}</td><td className="num">{v}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-4">
          <div className="panel">
            <div className="panel-header">Regional Filter · {t.region}</div>
            <div className="p-4 text-xs space-y-1 font-mono">
              <Indicator label="Min Price" value={`${fmtPrice(f.minPrice, t.currency)}`} />
              <Indicator label="Min Volume" value={fmtVol(f.minVolume)} />
              <Indicator label="Min Mcap" value={`${fmtMcapUsd(f.minMcapUsd)} equivalent`} />
              <Indicator label="Status" value={t.passesGlobal ? "✅ Passes" : "❌ Fails"} />
            </div>
          </div>
          <div className="panel">
            <div className="panel-header">Visual Indicators</div>
            <div className="p-4 font-mono text-xs space-y-2">
              <Indicator label="Trend" value={`${trendArrow(t.perf5d)} ${t.perf5d != null && t.perf5d > 0 ? "Positive" : t.perf5d != null && t.perf5d < 0 ? "Negative" : "Flat"}`} />
              <Indicator label="Value Screen" value={`${t.passesValue ? "✅" : "❌"} ${t.passesValue ? "Qualifies" : "Does not qualify"}`} />
              <Indicator label="RSI" value={`${t.rsi14 != null && (t.rsi14 > 70 || t.rsi14 < 30) ? "⚠️" : "→"} ${t.rsiLabel}`} />
              <Indicator label="MA 20D" value={`${t.price && t.ma20 && t.price > t.ma20 ? "↑" : "↓"} ${vsMA(t.price, t.ma20).label}`} />
              <Indicator label="MA 50D" value={`${t.price && t.ma50 && t.price > t.ma50 ? "↑" : "↓"} ${vsMA(t.price, t.ma50).label}`} />
              <Indicator label="MA 200D" value={`${t.price && t.ma200 && t.price > t.ma200 ? "↑" : "↓"} ${vsMA(t.price, t.ma200).label}`} />
            </div>
          </div>
          <div className="panel">
            <div className="panel-header">Peer Universe</div>
            <div className="p-4 text-xs space-y-1">
              <div className="text-muted-foreground">Identified <span className="text-primary font-mono">{r.peers.length}</span> peers in {t.industry || t.sector || "sector"} (region-aware).</div>
              <div className="text-muted-foreground">Value qualifiers: <span className="text-[color:var(--bull)] font-mono">{r.valueQualifiers.length}</span></div>
              <div className="text-muted-foreground">Momentum top: <span className="text-primary font-mono">{r.momentumTop.length}</span></div>
              <div className="text-muted-foreground">Cross-screen overlap: <span className="text-primary font-mono">{r.overlap.length}</span></div>
            </div>
          </div>
          {t.dataMissing.length > 0 && (
            <div className="panel border-primary/30">
              <div className="panel-header text-primary">⚠ Data Unavailable</div>
              <div className="p-4 text-xs text-muted-foreground">Missing: {t.dataMissing.join(", ")}</div>
            </div>
          )}
        </div>
      </div>
      <AiNarrative symbol={t.symbol} facts={facts} />
      <AskTerminal symbol={t.symbol} facts={facts} />
      <NewsCatalysts symbol={t.symbol} name={(t as any).companyName ?? undefined} />
    </div>
  );
}

function Indicator({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-4"><span className="text-muted-foreground">{label}</span><span>{value}</span></div>;
}

function ValueSection({ r }: { r: Success }) {
  const rows = r.valueQualifiers;
  const includeTarget = r.target.passesValue;
  return (
    <div className="space-y-4">
      <div className="panel">
        <div className="panel-header">Value Screen · Qualifying Peers ({rows.length})</div>
        <div className="overflow-x-auto">
          <table className="term">
            <thead>
              <tr><th>Company</th><th>Ticker</th><th>Exch</th><th>Ccy</th><th>Price</th><th>52W Low</th><th><MetricLabel term="pctFromLow">% From Low</MetricLabel></th><th><MetricLabel term="peRatio">P/E</MetricLabel></th><th><MetricLabel term="marketCap">Mcap (USD)</MetricLabel></th><th>Avg Vol</th><th>Industry</th></tr>
            </thead>
            <tbody>
              {includeTarget && <ValueRow m={r.target} highlight />}
              {rows.length === 0 && !includeTarget && (
                <tr><td colSpan={11} className="text-center text-muted-foreground py-8">No peers passed the value screen.</td></tr>
              )}
              {rows.map((m) => <ValueRow key={m.symbol} m={m} />)}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">Commentary</div>
        <div className="p-5 text-sm space-y-3 max-w-4xl">
          <p><span className="text-muted-foreground">Input stock status:</span> <span className={r.target.passesValue ? "text-[color:var(--bull)]" : "text-[color:var(--bear)]"}>{r.target.passesValue ? "✅ Qualifies" : "❌ Does not qualify"}</span> for the value screen.</p>
          {rows.length > 0 ? (
            <p>Qualifying peers trade within 10% of their 52-week low with trailing P/E ≤ 10. {rows.length >= 3 ? "Multiple peers clearing the screen suggests a sector-wide valuation reset." : "The small number of qualifiers points to a more company-specific drawdown rather than a broad sector move."}</p>
          ) : (
            <p>No peers cleared the value screen. The sector is either trading near highs, or earnings/multiples don't satisfy the strict P/E ≤ 10 + near-low constraint.</p>
          )}
          <div className="text-xs text-muted-foreground border-t border-border pt-3">
            <strong>Caveats:</strong> low P/E can signal value traps, declining margins, secular decline, cyclical earnings peaks, or pending earnings revisions. Cross-currency price comparisons are avoided — only USD-equivalent market cap is used for sizing comparisons.
          </div>
        </div>
      </div>
    </div>
  );
}

function ValueRow({ m, highlight = false }: { m: any; highlight?: boolean }) {
  return (
    <tr className={highlight ? "bg-primary/5" : ""}>
      <td>{highlight && "▶ "}{m.companyName}</td>
      <td className="text-primary">{m.symbol}</td>
      <td className="text-muted-foreground">{m.exchange ?? "—"}</td>
      <td className="text-muted-foreground">{m.currency}</td>
      <td className="num">{fmtPrice(m.price, m.currency)}</td>
      <td className="num">{fmtPrice(m.low52, m.currency)}</td>
      <td className={`num ${colorFor(-(m.pctFromLow ?? 0))}`}>{fmtPct(m.pctFromLow)}</td>
      <td className="num">{fmtNum(m.pe)}</td>
      <td className="num">{fmtMcapUsd(m.marketCapUsd)}</td>
      <td className="num">{fmtVol(m.avgVolume)}</td>
      <td className="text-muted-foreground">{m.industry ?? "—"}</td>
    </tr>
  );
}

function MomentumSection({ r }: { r: Success }) {
  const rows = r.momentumTop;
  return (
    <div className="space-y-4">
      <div className="panel">
        <div className="panel-header">Momentum · Top {rows.length} Peers by 5D Performance</div>
        <div className="overflow-x-auto">
          <table className="term">
            <thead>
              <tr><th>#</th><th>Company</th><th>Ticker</th><th>Exch</th><th><MetricLabel term="perf5d">5D %</MetricLabel></th><th><MetricLabel term="roc">ROC14</MetricLabel></th><th><MetricLabel term="roc">ROC21</MetricLabel></th><th><MetricLabel term="rsi">RSI</MetricLabel></th><th>RSI Label</th><th>20D</th><th>50D</th><th>200D</th><th>Signal</th><th>Outlook</th><th><MetricLabel term="confidence">Conf</MetricLabel></th></tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={15} className="text-center text-muted-foreground py-8">No peers qualified for momentum ranking.</td></tr>}
              {rows.map((m, i) => {
                const v20 = vsMA(m.price, m.ma20);
                const v50 = vsMA(m.price, m.ma50);
                const v200 = vsMA(m.price, m.ma200);
                return (
                  <tr key={m.symbol}>
                    <td className="text-muted-foreground">{i + 1}</td>
                    <td>{m.companyName}</td>
                    <td className="text-primary">{m.symbol}</td>
                    <td className="text-muted-foreground">{m.exchange ?? "—"}</td>
                    <td className={`num ${colorFor(m.perf5d)}`}>{fmtPct(m.perf5d)}</td>
                    <td className={`num ${colorFor(m.roc14)}`}>{fmtPct(m.roc14)}</td>
                    <td className={`num ${colorFor(m.roc21)}`}>{fmtPct(m.roc21)}</td>
                    <td className="num">{fmtNum(m.rsi14, 1)}</td>
                    <td className={m.rsiLabel === "Overbought" ? "text-[color:var(--bear)]" : m.rsiLabel === "Oversold" ? "text-[color:var(--bull)]" : "text-muted-foreground"}>{m.rsiLabel}</td>
                    <td className={v20.cls}>{v20.label}</td>
                    <td className={v50.cls}>{v50.label}</td>
                    <td className={v200.cls}>{v200.label}</td>
                    <td className={m.signal === "Momentum continuation" ? "text-[color:var(--bull)]" : m.signal === "Potential reversal" ? "text-primary" : "text-muted-foreground"}>{m.signal}</td>
                    <td className={m.outlook === "Bullish" ? "text-[color:var(--bull)]" : m.outlook === "Bearish" ? "text-[color:var(--bear)]" : ""}>{m.outlook}</td>
                    <td className="text-muted-foreground">{m.confidence}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="panel">
        <div className="panel-header">Methodology</div>
        <div className="p-5 text-xs text-muted-foreground space-y-2 max-w-3xl">
          <p>Universe filtered using region-specific liquidity thresholds, then ranked by 5-day price performance.</p>
          <p><span className="text-foreground">Continuation:</span> positive 5D + ROC14/21 positive + RSI &lt; 70 + price above 20D &amp; 50D MAs.</p>
          <p><span className="text-foreground">Potential reversal:</span> strong recent move but RSI &gt; 70 or weakening ROC.</p>
          <p><span className="text-foreground">Mixed:</span> indicator confluence is unclear or conflicting.</p>
        </div>
      </div>
    </div>
  );
}

function CrossSection({ r }: { r: Success }) {
  const overlap = r.overlap;
  const detail = r.valueQualifiers.filter((v) => overlap.includes(v.symbol)).map((v) => {
    const m = r.momentumTop.find((x) => x.symbol === v.symbol);
    return { ...v, momentum: m };
  });
  return (
    <div className="panel">
      <div className="panel-header">Cross-Analysis · Value ∩ Momentum</div>
      <div className="p-5">
        {overlap.length === 0 ? (
          <p className="text-sm text-muted-foreground">No peer passed both the value screen and the momentum top-10. This is common when sectors are either deeply oversold (no momentum) or trading near highs (no value qualifiers).</p>
        ) : (
          <div className="space-y-4">
            <p className="text-sm">{overlap.length} ticker{overlap.length > 1 ? "s" : ""} appear in both screens — these combine compressed valuation with improving short-term price action and may represent higher-conviction setups.</p>
            {detail.map((d) => (
              <div key={d.symbol} className="border border-border rounded p-4">
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span className="font-mono text-primary text-lg">{d.symbol}</span>
                  <span className="text-sm">{d.companyName}</span>
                  <span className="text-[10px] font-mono uppercase border border-border rounded px-1.5 py-0.5 text-muted-foreground">{d.exchange} · {d.currency}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{d.industry}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
                  <div><span className="text-muted-foreground">P/E </span>{fmtNum(d.pe)}</div>
                  <div><span className="text-muted-foreground">% from low </span>{fmtPct(d.pctFromLow)}</div>
                  <div><span className="text-muted-foreground">5D </span><span className={colorFor(d.perf5d)}>{fmtPct(d.perf5d)}</span></div>
                  <div><span className="text-muted-foreground">RSI </span>{fmtNum(d.rsi14, 1)}</div>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">Notable: undervalued by P/E and proximity to 52W low, yet exhibiting strong 5D performance among screened peers — a constructive setup for mean reversion. <span className="text-foreground">Risks:</span> the bounce may be short-lived; confirm with volume, earnings stability, and watch for breakdowns below 50D/200D MAs as invalidation triggers.</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FinalSection({ r }: { r: Success }) {
  const t = r.target;
  const rec = t.recommendation;
  const recColor = rec.rec === "Buy" ? "text-[color:var(--bull)] border-[color:var(--bull)]"
    : rec.rec === "Avoid" ? "text-[color:var(--bear)] border-[color:var(--bear)]"
    : "text-primary border-primary";
  const above200 = t.price && t.ma200 && t.price > t.ma200;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className={`panel lg:col-span-1 border-2 ${recColor.split(" ")[1]}`}>
        <div className="panel-header">Final Recommendation</div>
        <div className="p-6 text-center">
          <div className={`font-mono text-5xl font-semibold ${recColor.split(" ")[0]}`}>{rec.rec.toUpperCase()}</div>
          <div className="mt-3 text-xs font-mono text-muted-foreground">CONFIDENCE: <span className="text-foreground">{rec.confidence}</span></div>
          <div className="text-xs font-mono text-muted-foreground">HORIZON: <span className="text-foreground">{rec.horizon}</span></div>
          <div className="mt-5 grid grid-cols-3 gap-2 text-xs font-mono border-t border-border pt-4">
            <div><div className="text-muted-foreground"><MetricLabel term="valueScore">Value</MetricLabel></div><div className="text-[color:var(--bull)] text-lg">{rec.valueScore}/3</div></div>
            <div><div className="text-muted-foreground"><MetricLabel term="momentumScore">Mom.</MetricLabel></div><div className="text-primary text-lg">{rec.momentumScore}/7</div></div>
            <div><div className="text-muted-foreground"><MetricLabel term="riskScore">Penalty</MetricLabel></div><div className="text-[color:var(--bear)] text-lg">−{rec.penalties}</div></div>
          </div>
          <p className="mt-5 text-xs text-left">
            {t.companyName} ({t.symbol}) on {t.fullExchange ?? t.exchange} currently {t.passesGlobal ? "meets" : "fails"} {t.region} liquidity/size filters and {t.passesValue ? "qualifies" : "does not qualify"} as a value candidate. Momentum is <span className="text-foreground">{t.outlook.toLowerCase()}</span> with {t.signal.toLowerCase()} signals. Net composite score is {rec.net}/10. {rec.rec === "Buy" ? "Setup combines favorable risk/reward across both screens." : rec.rec === "Avoid" ? "Risk indicators outweigh constructive signals." : "Mixed signals warrant patience for clearer confirmation."}
          </p>
        </div>
      </div>

      <div className="lg:col-span-2 space-y-4">
        <div className="panel">
          <div className="panel-header">Investment Thesis</div>
          <div className="p-5 text-sm space-y-4">
            <Thesis title="Bull Case" cls="text-[color:var(--bull)]">
              {t.passesValue && "Trades near 52W low with single-digit P/E — pricing in significant pessimism. "}
              {(t.perf5d ?? 0) > 0 && "Recent 5D price action is positive, suggesting accumulation. "}
              {above200 && "Price above 200D MA confirms primary uptrend. "}
              Sector ({t.sector ?? "—"}) tailwinds, multiple expansion, or earnings beats could re-rate the stock.
            </Thesis>
            <Thesis title="Bear Case" cls="text-[color:var(--bear)]">
              {(t.rsi14 ?? 0) > 70 && "RSI in overbought territory raises near-term pullback risk. "}
              {!above200 && "Price below 200D MA indicates broken long-term trend. "}
              {(t.roc14 ?? 0) < 0 && (t.roc21 ?? 0) < 0 && "Negative ROC across both windows signals deteriorating momentum. "}
              Risks include margin compression, weakening guidance, sector derating, FX headwinds, and macro shocks.
            </Thesis>
            <Thesis title="Base Case" cls="text-primary">
              Range-bound trading as the market awaits the next catalyst. Indicator confluence is {t.confidence.toLowerCase()}, suggesting a wait-and-see posture is appropriate until valuation, momentum, or fundamentals decisively shift.
            </Thesis>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="panel">
            <div className="panel-header">Catalysts</div>
            <ul className="p-5 text-xs space-y-2 text-muted-foreground list-disc pl-8">
              <li>Next earnings release {t.earningsDate ? `(${new Date(t.earningsDate).toLocaleDateString()})` : "(date TBD)"}</li>
              <li>Forward guidance revisions</li>
              <li>{t.sector ?? "Sector"} demand and pricing trends</li>
              <li>Macro: rates, inflation, FX ({t.currency})</li>
              <li>Regulatory developments and product launches</li>
            </ul>
          </div>
          <div className="panel">
            <div className="panel-header">Risks</div>
            <ul className="p-5 text-xs space-y-2 text-muted-foreground list-disc pl-8">
              <li><span className="text-foreground">Fundamental:</span> revenue decline, margin compression, leverage, value-trap risk</li>
              <li><span className="text-foreground">Technical:</span> {(t.rsi14 ?? 0) > 70 ? "overbought RSI" : "RSI within range"}, {above200 ? "trend intact" : "broken 200D MA"}, breakdown below {t.ma50 ? `${fmtPrice(t.ma50, t.currency)} (50D)` : "key MA"}</li>
              <li>Liquidity: {t.passesGlobal ? "passes" : "FAILS"} {t.region} thresholds</li>
              <li>Currency: returns subject to {t.currency}/USD FX moves for non-local investors</li>
              {t.dataMissing.length > 0 && <li className="text-primary">Data quality: missing {t.dataMissing.join(", ")} — confidence reduced</li>}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function Thesis({ title, cls, children }: { title: string; cls: string; children: React.ReactNode }) {
  return (
    <div>
      <div className={`text-xs font-mono uppercase tracking-wider ${cls}`}>{title}</div>
      <p className="mt-1 text-sm">{children}</p>
    </div>
  );
}

// ---------------- Chart Section ----------------
function ChartSection({ r }: { r: Success }) {
  const t = r.target;
  return (
    <div className="space-y-4">
      <PriceChart
        closes={t.closes ?? []}
        ma20={t.ma20}
        ma50={t.ma50}
        ma200={t.ma200}
        high52={t.high52}
        low52={t.low52}
        rsi={t.rsi14}
        currency={t.currency}
      />
      <div className="panel">
        <div className="panel-header">Technical Summary</div>
        <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
          <Indicator label="Price" value={fmtPrice(t.price, t.currency)} />
          <Indicator label="52W Low" value={fmtPrice(t.low52, t.currency)} />
          <Indicator label="52W High" value={fmtPrice(t.high52, t.currency)} />
          <Indicator label="% From Low" value={fmtPct(t.pctFromLow)} />
          <Indicator label="MA 20" value={fmtPrice(t.ma20, t.currency)} />
          <Indicator label="MA 50" value={fmtPrice(t.ma50, t.currency)} />
          <Indicator label="MA 200" value={fmtPrice(t.ma200, t.currency)} />
          <Indicator label="RSI 14" value={`${fmtNum(t.rsi14, 1)} (${t.rsiLabel})`} />
        </div>
      </div>
    </div>
  );
}

// ---------------- Scores Section ----------------
function ScoresSection({ r }: { r: Success }) {
  const t = r.target;
  // Adapt StockMetrics to ScreenerRow-like shape for scoreRow
  const scoreInput = useMemo(() => ({
    symbol: t.symbol, name: t.companyName, exchange: t.exchange ?? "",
    country: t.country ?? "", region: t.region, currency: t.currency,
    sector: t.sector ?? "", industry: t.industry ?? "",
    price: t.price, marketCap: t.marketCap, marketCapUsd: t.marketCapUsd,
    avgVolume: t.avgVolume, pe: t.pe, high52: t.high52, low52: t.low52,
    pctFromLow: t.pctFromLow, pctFromHigh: null,
    perf5d: t.perf5d, rsi14: t.rsi14, roc14: t.roc14, roc21: t.roc21,
    ma20: t.ma20, ma50: t.ma50, ma200: t.ma200,
    closes: t.closes ?? [], isMock: false, source: t.source ?? "Finimpulse",
    retrievedAt: new Date().toISOString(),
  }), [t]);
  const s = scoreRow(scoreInput as any);

  const cards = [
    { label: "Value", val: s.value, b: s.valueLabel, reasons: s.valueReasons, color: "var(--bull)" },
    { label: "Momentum", val: s.momentum, b: s.momentumLabel, reasons: s.momentumReasons, color: "var(--primary)" },
    { label: "Quality", val: s.quality, b: s.qualityLabel, reasons: s.qualityReasons, color: "var(--cyan)" },
    { label: "Risk", val: s.risk, b: s.riskLabel, reasons: s.riskReasons, color: "var(--bear)" },
    { label: "Confidence", val: s.confidence, b: s.confidenceLabel, reasons: s.confidenceReasons, color: "var(--primary)" },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="panel">
          <div className="panel-header flex items-center justify-between">
            <span>{c.label}</span>
            <span className="text-xs text-muted-foreground">{c.b}</span>
          </div>
          <div className="p-4">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-3xl" style={{ color: c.color }}>{c.val}</span>
              <span className="text-xs text-muted-foreground">/100</span>
            </div>
            <div className="mt-2 h-1.5 w-full bg-muted rounded overflow-hidden">
              <div className="h-full" style={{ width: `${c.val}%`, background: c.color }} />
            </div>
            <ul className="mt-3 text-[11px] text-muted-foreground space-y-1 list-disc pl-4">
              {c.reasons.slice(0, 5).map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------- Peers Section ----------------
function PeersSection({ r }: { r: Success }) {
  const t = r.target;
  const peers = r.peers;
  if (!peers.length) {
    return (
      <div className="panel p-10 text-center">
        <div className="font-mono text-xs text-muted-foreground">No peers identified for {t.industry || t.sector || "this stock"}.</div>
      </div>
    );
  }

  const all = [t, ...peers];
  type Dir = "high" | "low";
  const metrics: Array<{ key: string; label: string; get: (m: any) => number | null; dir: Dir; fmt: (m: any) => string }> = [
    { key: "pe", label: "P/E", get: (m) => m.pe, dir: "low", fmt: (m) => fmtNum(m.pe, 1) },
    { key: "pctFromLow", label: "% From Low", get: (m) => m.pctFromLow, dir: "low", fmt: (m) => fmtPct(m.pctFromLow) },
    { key: "perf5d", label: "5D %", get: (m) => m.perf5d, dir: "high", fmt: (m) => fmtPct(m.perf5d) },
    { key: "roc14", label: "ROC14", get: (m) => m.roc14, dir: "high", fmt: (m) => fmtPct(m.roc14) },
    { key: "roc21", label: "ROC21", get: (m) => m.roc21, dir: "high", fmt: (m) => fmtPct(m.roc21) },
    { key: "rsi14", label: "RSI", get: (m) => m.rsi14, dir: "high", fmt: (m) => fmtNum(m.rsi14, 0) },
    { key: "marketCapUsd", label: "Mcap (USD)", get: (m) => m.marketCapUsd, dir: "high", fmt: (m) => fmtMcapUsd(m.marketCapUsd) },
    { key: "avgVolume", label: "Avg Vol", get: (m) => m.avgVolume, dir: "high", fmt: (m) => fmtVol(m.avgVolume) },
  ];
  const winners: Record<string, { best?: string; worst?: string }> = {};
  for (const mt of metrics) {
    let best: string | undefined, worst: string | undefined, bv = -Infinity, wv = Infinity;
    for (const m of all) {
      const v = mt.get(m);
      if (v == null || !isFinite(v)) continue;
      const sc = mt.dir === "high" ? v : -v;
      if (sc > bv) { bv = sc; best = m.symbol; }
      if (sc < wv) { wv = sc; worst = m.symbol; }
    }
    winners[mt.key] = { best, worst };
  }
  const cls = (k: string, sym: string) => {
    const w = winners[k]; if (!w) return "";
    if (w.best === sym) return "text-[color:var(--bull)] font-semibold";
    if (w.worst === sym && all.length > 2) return "text-[color:var(--bear)]";
    return "";
  };

  return (
    <div className="space-y-4">
      <div className="panel">
        <div className="panel-header">Peer Matrix · {t.industry ?? t.sector ?? "Sector"} ({peers.length} peers, region-aware)</div>
        <div className="overflow-x-auto">
          <table className="term">
            <thead>
              <tr>
                <th>Ticker</th><th>Company</th><th>Exch</th>
                {metrics.map((m) => <th key={m.key} className="text-right">{m.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {all.map((m, i) => (
                <tr key={m.symbol} className={i === 0 ? "bg-primary/5" : "hover:bg-muted/30"}>
                  <td className="text-primary font-mono">{i === 0 ? "▶ " : ""}{m.symbol}</td>
                  <td>{m.companyName}</td>
                  <td className="text-muted-foreground text-xs">{m.exchange ?? "—"}</td>
                  {metrics.map((mt) => (
                    <td key={mt.key} className={`num ${cls(mt.key, m.symbol)}`}>{mt.fmt(m)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="panel">
        <div className="panel-header">Reading the Matrix</div>
        <div className="p-5 text-xs text-muted-foreground space-y-2 max-w-3xl">
          <p><span className="text-[color:var(--bull)]">Green bold</span> = best in cohort for that metric. <span className="text-[color:var(--bear)]">Red</span> = worst (when ≥3 peers).</p>
          <p>Lower-is-better for P/E and % from 52W low; higher-is-better for momentum, RSI, mcap, and volume.</p>
          <p>{t.symbol} is highlighted as the target row. Peers are sourced via industry → country → region → global fallback.</p>
        </div>
      </div>
    </div>
  );
}

// ---------------- Scenario Recommendation ----------------
function ScenarioSection({ r }: { r: Success }) {
  const t = r.target;
  const above20 = !!(t.price && t.ma20 && t.price > t.ma20);
  const above50 = !!(t.price && t.ma50 && t.price > t.ma50);
  const above200 = !!(t.price && t.ma200 && t.price > t.ma200);
  const rsi = t.rsi14 ?? 50;
  const valueOk = t.passesValue;
  const mom = t.recommendation.momentumScore;
  const pen = t.recommendation.penalties;

  type Action = "Buy" | "Accumulate" | "Hold" | "Trim" | "Avoid";
  let action: Action = "Hold";
  let rationale = "";
  if (valueOk && mom >= 5 && pen <= 1 && above50) {
    action = "Buy"; rationale = "Value qualifier with confirmed momentum (above 50D MA, low penalties).";
  } else if (mom >= 5 && above200 && rsi < 70 && pen <= 1) {
    action = "Accumulate"; rationale = "Strong primary trend with healthy RSI; scale in on dips.";
  } else if (rsi > 75 && above20 && t.recommendation.rec === "Buy") {
    action = "Trim"; rationale = "Overbought RSI on top of large gains — trim into strength to lock partial profits.";
  } else if (!above200 && pen >= 2 && mom <= 3) {
    action = "Avoid"; rationale = "Below 200D MA with multiple negative momentum signals; trend is broken.";
  } else if (mom <= 2 || rsi > 80 || !t.passesGlobal) {
    action = "Avoid"; rationale = !t.passesGlobal ? "Fails regional liquidity/size filters." : "Weak momentum or extreme RSI — wait for cleaner setup.";
  } else {
    action = "Hold"; rationale = "Mixed signals — neither valuation nor momentum offers a high-conviction edge.";
  }

  const colors: Record<Action, string> = {
    Buy: "text-[color:var(--bull)] border-[color:var(--bull)]",
    Accumulate: "text-[color:var(--bull)] border-[color:var(--bull)]/60",
    Hold: "text-primary border-primary",
    Trim: "text-primary border-primary",
    Avoid: "text-[color:var(--bear)] border-[color:var(--bear)]",
  };

  const entry = t.ma20 ? +(t.ma20 * 1.005).toFixed(2) : t.price;
  const stop = t.ma50 ? +(t.ma50 * 0.97).toFixed(2) : (t.price ? +(t.price * 0.92).toFixed(2) : null);
  const target1 = t.high52 ?? (t.price ? +(t.price * 1.15).toFixed(2) : null);
  const target2 = t.high52 ? +(t.high52 * 1.10).toFixed(2) : (t.price ? +(t.price * 1.30).toFixed(2) : null);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className={`panel border-2 ${colors[action].split(" ").slice(1).join(" ")}`}>
        <div className="panel-header">Scenario Action</div>
        <div className="p-6 text-center">
          <div className={`font-mono text-5xl font-semibold ${colors[action].split(" ")[0]}`}>{action.toUpperCase()}</div>
          <div className="mt-3 text-xs font-mono text-muted-foreground">CONFIDENCE: <span className="text-foreground">{t.recommendation.confidence}</span></div>
          <div className="text-xs font-mono text-muted-foreground">HORIZON: <span className="text-foreground">{t.recommendation.horizon}</span></div>
          <p className="mt-5 text-xs text-left">{rationale}</p>
        </div>
      </div>

      <div className="lg:col-span-2 space-y-4">
        <div className="panel">
          <div className="panel-header">Trade Plan · Levels</div>
          <table className="term">
            <tbody>
              <tr><td className="text-muted-foreground">Suggested entry zone</td><td className="num">{fmtPrice(entry, t.currency)} <span className="text-[10px] text-muted-foreground">(near 20D MA)</span></td></tr>
              <tr><td className="text-muted-foreground">Stop / invalidation</td><td className="num text-[color:var(--bear)]">{fmtPrice(stop, t.currency)} <span className="text-[10px] text-muted-foreground">(below 50D MA)</span></td></tr>
              <tr><td className="text-muted-foreground">Target 1</td><td className="num text-[color:var(--bull)]">{fmtPrice(target1, t.currency)} <span className="text-[10px] text-muted-foreground">(52W high)</span></td></tr>
              <tr><td className="text-muted-foreground">Target 2</td><td className="num text-[color:var(--bull)]">{fmtPrice(target2, t.currency)} <span className="text-[10px] text-muted-foreground">(stretch)</span></td></tr>
              <tr><td className="text-muted-foreground">Position sizing hint</td><td>{action === "Buy" ? "Full size" : action === "Accumulate" ? "Scale in 1/3rds" : action === "Trim" ? "Reduce 25–50%" : action === "Hold" ? "No change" : "Zero / exit"}</td></tr>
            </tbody>
          </table>
          <div className="px-4 py-2 text-[10px] text-muted-foreground border-t border-border">
            Levels are derived heuristics from MAs and 52W range — not professional trade signals.
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="panel">
            <div className="panel-header text-[color:var(--bull)]">Bullish Triggers</div>
            <ul className="p-5 text-xs space-y-2 list-disc pl-8 text-muted-foreground">
              <li>Close above 50D MA on rising volume</li>
              <li>RSI cross above 50 from below</li>
              <li>Earnings beat with raised guidance</li>
              <li>Sector rotation into {t.sector ?? "the sector"}</li>
            </ul>
          </div>
          <div className="panel">
            <div className="panel-header text-[color:var(--bear)]">Bearish Triggers</div>
            <ul className="p-5 text-xs space-y-2 list-disc pl-8 text-muted-foreground">
              <li>Close below 200D MA → trend break</li>
              <li>RSI {">"} 80 with negative price/RSI divergence</li>
              <li>Earnings miss or guide-down</li>
              <li>Sector-wide derating or FX headwind ({t.currency})</li>
            </ul>
          </div>
        </div>

        <BacktestPanel closes={t.closes ?? []} symbol={t.symbol} />
      </div>
    </div>
  );
}

// ---------------- Historical Performance + MA Cross Backtest ----------------
function BacktestPanel({ closes, symbol }: { closes: number[]; symbol: string }) {
  const hist = useMemo(() => computeHistoricalReturns(closes), [closes]);
  const bt = useMemo(() => backtestMaCross(closes, 50, 200), [closes]);

  const fmtSigned = (n: number | null, digits = 1) => {
    if (n == null || !Number.isFinite(n)) return "—";
    const s = n >= 0 ? "+" : "";
    return `${s}${n.toFixed(digits)}%`;
  };
  const cls = (n: number | null) => (n == null ? "" : n >= 0 ? "text-[color:var(--bull)]" : "text-[color:var(--bear)]");

  return (
    <>
      <div className="panel">
        <div className="panel-header">Historical Performance · {symbol}</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border">
          {hist.windows.map((w) => (
            <div key={w.label} className="bg-card p-4 text-center">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{w.label} return</div>
              <div className={`font-mono text-lg mt-1 ${cls(w.returnPct)}`}>{fmtSigned(w.returnPct)}</div>
            </div>
          ))}
        </div>
        <div className="px-4 py-2 text-[10px] text-muted-foreground border-t border-border">
          Computed from {hist.observations} daily closes (adjusted). Windows that exceed available history show "—".
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">Backtest · 50D/200D MA Cross (Long-Only)</div>
        {bt.insufficientData ? (
          <div className="p-5 text-xs text-muted-foreground">
            Need at least ~210 daily closes to evaluate the 50/200 cross. Currently have {bt.observations}.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-border">
              <Metric label="Strategy total return" value={fmtSigned(bt.totalReturnPct)} cls={cls(bt.totalReturnPct)} />
              <Metric label="Annualized" value={fmtSigned(bt.annualizedReturnPct)} cls={cls(bt.annualizedReturnPct)} />
              <Metric label="Max drawdown" value={fmtSigned(bt.maxDrawdownPct)} cls="text-[color:var(--bear)]" />
              <Metric label="Win rate" value={bt.winRatePct == null ? "—" : `${bt.winRatePct.toFixed(0)}%`} />
              <Metric label="Avg trade" value={fmtSigned(bt.avgTradeReturnPct)} cls={cls(bt.avgTradeReturnPct)} />
              <Metric label="Time in market" value={bt.exposurePct == null ? "—" : `${bt.exposurePct.toFixed(0)}%`} />
            </div>
            <div className="border-t border-border p-4 text-xs">
              <div className="font-mono uppercase tracking-wider text-muted-foreground mb-2">Buy &amp; hold reference</div>
              <div className="grid grid-cols-3 gap-3 font-mono">
                <div><span className="text-muted-foreground">Total: </span><span className={cls(bt.buyHoldReturnPct)}>{fmtSigned(bt.buyHoldReturnPct)}</span></div>
                <div><span className="text-muted-foreground">Annualized: </span><span className={cls(bt.buyHoldAnnualizedPct)}>{fmtSigned(bt.buyHoldAnnualizedPct)}</span></div>
                <div><span className="text-muted-foreground">Max DD: </span><span className="text-[color:var(--bear)]">{fmtSigned(bt.buyHoldMaxDrawdownPct)}</span></div>
              </div>
            </div>
            {bt.trades.length > 0 && (
              <div className="border-t border-border overflow-x-auto">
                <table className="term">
                  <thead>
                    <tr><th>#</th><th>Entry idx</th><th>Entry</th><th>Exit idx</th><th>Exit</th><th>Bars</th><th>Return</th></tr>
                  </thead>
                  <tbody>
                    {bt.trades.map((tr, i) => (
                      <tr key={i}>
                        <td>{i + 1}</td>
                        <td className="num text-muted-foreground">{tr.entryIdx}</td>
                        <td className="num">{tr.entryPrice.toFixed(2)}</td>
                        <td className="num text-muted-foreground">{tr.exitIdx}</td>
                        <td className="num">{tr.exitPrice.toFixed(2)}</td>
                        <td className="num">{tr.bars}</td>
                        <td className={`num ${cls(tr.returnPct)}`}>{fmtSigned(tr.returnPct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="px-4 py-2 text-[10px] text-muted-foreground border-t border-border">
              Long-only. Enter on 50D MA crossing above 200D MA; exit on cross-down. No fees, no slippage, no compounding across cash periods. Indicative only.
            </div>
          </>
        )}
      </div>
    </>
  );
}

function Metric({ label, value, cls = "" }: { label: string; value: string; cls?: string }) {
  return (
    <div className="bg-card p-4 text-center">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-mono text-base mt-1 ${cls}`}>{value}</div>
    </div>
  );
}

