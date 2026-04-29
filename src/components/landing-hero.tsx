import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import type { ScoredRow } from "@/lib/scores";
import { fmtPriceDisplay, fmtPct, colorFor } from "@/lib/format";
import { useDisplayCurrency } from "@/hooks/use-display-currency";
import { MetricLabel } from "@/components/metric-label";

type Meta = { retrievedAt: string; total: number; mockCount: number; liveCount: number };

const REGIONS: { code: string; label: string }[] = [
  { code: "US", label: "USA" },
  { code: "IN", label: "IND" },
  { code: "EU", label: "EUR" },
  { code: "JP", label: "JPN" },
  { code: "HK", label: "HKG" },
  { code: "KR", label: "KOR" },
  { code: "TW", label: "TWN" },
  { code: "AU", label: "AUS" },
  { code: "SG", label: "SGP" },
];

export function LandingHero({
  meta,
  rows,
  isLoading,
  onPickPreset,
}: {
  meta?: Meta;
  rows: ScoredRow[];
  isLoading: boolean;
  onPickPreset: (id: "valueLow" | "momentum" | "quality" | "breakout") => void;
}) {
  const [ccyMode] = useDisplayCurrency();

  const byRegion = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.region, (m.get(r.region) ?? 0) + 1);
    return m;
  }, [rows]);

  const tapeRows = useMemo(() => {
    return [...rows]
      .filter((r) => r.perf5d != null && r.price != null)
      .sort((a, b) => Math.abs(b.perf5d ?? 0) - Math.abs(a.perf5d ?? 0))
      .slice(0, 6);
  }, [rows]);

  const refreshTime = meta
    ? new Date(meta.retrievedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "—";
  const liveCoverage =
    meta && meta.total ? `${Math.round((meta.liveCount / meta.total) * 100)}%` : "—";

  return (
    <section className="border-b border-border bg-background">
      {/* Status strip */}
      <div className="border-b border-border bg-card/40 overflow-x-auto">
        <div className="max-w-[1400px] mx-auto px-4 h-9 flex items-center gap-6 font-mono text-[10px] uppercase tracking-widest text-muted-foreground whitespace-nowrap">
          <span>
            <MetricLabel term="universe">Universe</MetricLabel>:{" "}
            <span className="text-foreground">{meta?.total ?? "—"}</span>
          </span>
          <span className="border-l border-border pl-6">
            <MetricLabel term="verified">Live</MetricLabel>:{" "}
            <span className="text-[color:var(--bull)]">{meta?.liveCount ?? 0}</span>
          </span>
          <span className="border-l border-border pl-6">
            Last refresh: <span className="text-foreground">{refreshTime}</span>
          </span>
          <span className="ml-auto flex items-center gap-2">
            <span
              className={`size-1.5 rounded-full ${
                isLoading ? "bg-primary animate-pulse" : "bg-[color:var(--bull)]"
              }`}
            />
            <span>{isLoading ? "Syncing" : "System OK"}</span>
          </span>
        </div>
      </div>

      {/* Hero — focused, single CTA */}
      <div className="max-w-[1400px] mx-auto px-4 pt-16 pb-14 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        <div className="lg:col-span-7">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 border border-border bg-card/60 rounded-full mb-6">
            <span className="size-1.5 rounded-full bg-[color:var(--cyan)]" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Quant-grade equity research
            </span>
          </div>
          <h1 className="text-4xl md:text-6xl font-medium tracking-tighter text-balance leading-[1.05]">
            Mathematical certainty for the{" "}
            <span className="text-muted-foreground">global equity landscape.</span>
          </h1>
          <p className="text-base text-muted-foreground max-w-[60ch] mt-6 leading-relaxed">
            Screen, score and dissect names across nine global markets. Every ticker is graded on
            five transparent vectors —{" "}
            <MetricLabel term="valueScore">Value</MetricLabel>,{" "}
            <MetricLabel term="momentumScore">Momentum</MetricLabel>,{" "}
            <MetricLabel term="qualityScore">Quality</MetricLabel>,{" "}
            <MetricLabel term="riskScore">Risk</MetricLabel> and{" "}
            <MetricLabel term="confidence">Confidence</MetricLabel>.
          </p>

          <div className="flex flex-wrap items-center gap-5 mt-9">
            <Link
              to="/app"
              search={{ preset: "all" } as any}
              className="px-6 py-3 bg-foreground text-background font-mono text-xs uppercase tracking-widest rounded-sm hover:opacity-90 transition-opacity"
            >
              Launch Screener →
            </Link>
            <button
              type="button"
              onClick={() =>
                window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))
              }
              className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
            >
              or ask AI
              <span className="flex gap-1">
                <kbd className="inline-flex items-center justify-center min-w-[1.25rem] px-1 py-0 rounded border border-border bg-card font-mono text-[10px]">
                  ⌘
                </kbd>
                <kbd className="inline-flex items-center justify-center min-w-[1.25rem] px-1 py-0 rounded border border-border bg-card font-mono text-[10px]">
                  K
                </kbd>
              </span>
            </button>
          </div>

          <p className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground mt-5">
            Already a member?{" "}
            <Link to="/auth" className="text-foreground hover:text-primary underline-offset-4 hover:underline">
              Sign in
            </Link>
          </p>
        </div>

        {/* Compact stats panel */}
        <div className="lg:col-span-5">
          <div className="panel">
            <div className="flex items-center justify-between border-b border-border px-4 py-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                Network Status
              </span>
              <span className="text-[10px] font-mono uppercase tracking-widest text-[color:var(--cyan)] flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-[color:var(--cyan)] animate-pulse" />
                Live
              </span>
            </div>
            <div className="grid grid-cols-2 divide-x divide-border">
              <Stat label="Symbols" value={meta ? meta.total.toString() : "—"} />
              <Stat label="Live coverage" value={liveCoverage} />
            </div>
            <div className="grid grid-cols-2 divide-x divide-border border-t border-border">
              <Stat label="Markets" value="9" />
              <Stat label="Last refresh" value={refreshTime} />
            </div>
          </div>
        </div>
      </div>

      {/* Live data band: regions + top movers */}
      <div className="border-y border-border bg-card/30">
        <div className="max-w-[1400px] mx-auto grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 divide-x divide-border">
          {REGIONS.map((r) => (
            <div key={r.code} className="px-4 py-3 font-mono">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {r.label}
              </div>
              <div className="text-sm text-foreground mt-0.5 tabular-nums">
                {byRegion.get(r.code) ?? 0}{" "}
                <span className="text-[10px] text-muted-foreground uppercase">tickers</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {tapeRows.length > 0 && (
        <div className="max-w-[1400px] mx-auto px-4 py-10">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Top Movers <span className="text-muted-foreground/60">// 5-day</span>
            </h2>
            <Link
              to="/app"
              search={{ sortBy: "perf5d", sortDir: "desc" } as any}
              className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-primary"
            >
              View All →
            </Link>
          </div>
          <div className="panel divide-y divide-border">
            {tapeRows.map((r) => (
              <Link
                key={r.symbol}
                to="/terminal/$symbol"
                params={{ symbol: r.symbol }}
                className="grid grid-cols-12 items-center gap-3 px-4 py-2.5 font-mono text-xs hover:bg-accent/50 transition-colors"
              >
                <span className="col-span-2 text-primary">{r.symbol}</span>
                <span className="col-span-4 truncate text-foreground" title={r.name}>
                  {r.name}
                </span>
                <span className="col-span-2 text-muted-foreground hidden md:block">{r.region}</span>
                <span className="col-span-2 text-right text-foreground tabular-nums">
                  {fmtPriceDisplay(r.price, r.currency, r.marketCap, r.marketCapUsd, ccyMode)}
                </span>
                <span className={`col-span-1 text-right tabular-nums ${colorFor(r.perf5d)}`}>
                  {fmtPct(r.perf5d)}
                </span>
                <span className="col-span-1 text-right text-[10px] uppercase text-muted-foreground hover:text-primary">
                  Open →
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Section 2: How it works — 3 steps */}
      <div className="max-w-[1400px] mx-auto px-4 py-14 border-t border-border">
        <div className="mb-8">
          <span className="text-[10px] font-mono uppercase tracking-widest text-[color:var(--cyan)]">
            // How it works
          </span>
          <h2 className="text-2xl lg:text-3xl font-semibold tracking-tight mt-2">
            From the global universe to a confident decision — in three steps.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border border border-border">
          <Step
            num="01"
            tag="Screen"
            title="Filter the universe"
            body="Slice thousands of stocks by region, sector, valuation and momentum. Or jump in with a preset strategy."
          >
            <div className="mt-4 flex flex-wrap gap-1.5">
              {[
                { id: "valueLow" as const, label: "Deep Value" },
                { id: "momentum" as const, label: "Velocity" },
                { id: "quality" as const, label: "Quality" },
                { id: "breakout" as const, label: "Breakout" },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => onPickPreset(p.id)}
                  className="px-2 py-1 border border-border bg-card hover:border-primary/40 hover:text-primary text-[10px] font-mono uppercase tracking-wider rounded-sm transition-colors"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </Step>
          <Step
            num="02"
            tag="Analyze"
            title="Score & understand"
            body="Open any ticker for price action, fundamentals, five transparent scores, and an AI thesis with cited news catalysts."
          />
          <Step
            num="03"
            tag="Track"
            title="Watchlist & alerts"
            body="Save names to watchlists, build a live portfolio with P&L, and set price, RSI or momentum alerts that fire server-side."
          />
        </div>
      </div>
    </section>
  );
}

function Step({
  num,
  tag,
  title,
  body,
  children,
}: {
  num: string;
  tag: string;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="bg-card p-6 flex flex-col">
      <div className="flex items-baseline justify-between mb-6">
        <span className="font-mono text-[10px] tracking-widest text-[color:var(--cyan)]">
          {num} // {tag.toUpperCase()}
        </span>
      </div>
      <h3 className="text-lg font-medium mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3">
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="text-2xl font-mono tabular-nums text-foreground mt-1">{value}</div>
    </div>
  );
}
