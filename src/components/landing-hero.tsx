import { Link } from "@tanstack/react-router";
import { useMemo, type ReactNode } from "react";
import type { ScoredRow } from "@/lib/scores";
import { fmtPriceDisplay, fmtPct, colorFor } from "@/lib/format";
import { useDisplayCurrency } from "@/hooks/use-display-currency";
import { MetricLabel } from "@/components/metric-label";
import type { GlossaryKey } from "@/lib/glossary";

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

const PRESET_CARDS: {
  id: "valueLow" | "momentum" | "quality" | "breakout";
  num: string;
  tag: string;
  title: string;
  desc: ReactNode;
}[] = [
  {
    id: "valueLow",
    num: "01",
    tag: "VALUE",
    title: "Deep Value",
    desc: (
      <>
        Cheap multiples within reach of <MetricLabel term="low52w">52-week lows</MetricLabel>.
      </>
    ),
  },
  {
    id: "momentum",
    num: "02",
    tag: "MOMENTUM",
    title: "Velocity Leaders",
    desc: (
      <>
        Positive <MetricLabel term="roc">ROC</MetricLabel>,{" "}
        <MetricLabel term="rsi">RSI</MetricLabel> 40–70, trading above{" "}
        <MetricLabel term="ma50">50-day MA</MetricLabel>.
      </>
    ),
  },
  {
    id: "quality",
    num: "03",
    tag: "QUALITY",
    title: "Capital Compounders",
    desc: (
      <>
        Large caps with positive earnings and high{" "}
        <MetricLabel term="confidence">confidence</MetricLabel>.
      </>
    ),
  },
  {
    id: "breakout",
    num: "04",
    tag: "BREAKOUT",
    title: "Breakout Candidates",
    desc: (
      <>
        Above key <MetricLabel term="ma50">MAs</MetricLabel> with positive{" "}
        <MetricLabel term="roc">ROC</MetricLabel>, near{" "}
        <MetricLabel term="high52w">52-week highs</MetricLabel>.
      </>
    ),
  },
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

  // Top 5 movers (by abs perf5d) for the live tape preview
  const tapeRows = useMemo(() => {
    return [...rows]
      .filter((r) => r.perf5d != null && r.price != null)
      .sort((a, b) => Math.abs(b.perf5d ?? 0) - Math.abs(a.perf5d ?? 0))
      .slice(0, 6);
  }, [rows]);

  const refreshTime = meta ? new Date(meta.retrievedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";

  return (
    <section className="border-b border-border bg-background">
      {/* Ticker tape strip — universe meta */}
      <div className="border-b border-border bg-card/40 overflow-x-auto">
        <div className="max-w-[1400px] mx-auto px-4 h-9 flex items-center gap-6 font-mono text-[10px] uppercase tracking-widest text-muted-foreground whitespace-nowrap">
          <span><MetricLabel term="universe">Universe</MetricLabel>: <span className="text-foreground">{meta?.total ?? "—"}</span></span>
          <span className="border-l border-border pl-6"><MetricLabel term="verified">Live</MetricLabel>: <span className="text-[color:var(--bull)]">{meta?.liveCount ?? 0}</span></span>
          <span><MetricLabel term="mock">Mock</MetricLabel>: <span className="text-primary">{meta?.mockCount ?? 0}</span></span>
          <span className="border-l border-border pl-6">Last refresh: <span className="text-foreground">{refreshTime}</span></span>
          <span className="ml-auto flex items-center gap-2">
            <span className={`size-1.5 rounded-full ${isLoading ? "bg-primary animate-pulse" : "bg-[color:var(--bull)]"}`} />
            <span>{isLoading ? "Syncing" : "System OK"}</span>
          </span>
        </div>
      </div>

      {/* Hero — split: headline left, live stats panel right */}
      <div className="max-w-[1400px] mx-auto px-4 pt-12 pb-10 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        <div className="lg:col-span-7">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 border border-border bg-card/60 rounded-full mb-6">
            <span className="size-1.5 rounded-full bg-[color:var(--cyan)]" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Quant-grade equity research</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-medium tracking-tighter text-balance leading-[1.05]">
            Mathematical certainty for the{" "}
            <span className="text-muted-foreground">global equity landscape.</span>
          </h1>
          <p className="text-base text-muted-foreground max-w-[60ch] mt-6 leading-relaxed">
            Screen, score and dissect names across nine global markets. Every ticker is graded on five
            transparent vectors —{" "}
            <MetricLabel term="valueScore">Value</MetricLabel>,{" "}
            <MetricLabel term="momentumScore">Momentum</MetricLabel>,{" "}
            <MetricLabel term="qualityScore">Quality</MetricLabel>,{" "}
            <MetricLabel term="riskScore">Risk</MetricLabel> and{" "}
            <MetricLabel term="confidence">Confidence</MetricLabel>{" "}
            — built from raw fundamentals.
          </p>
          <div className="flex flex-wrap gap-3 mt-8">
            <Link
              to="/app"
              search={{ preset: "all" } as any}
              className="px-5 py-2.5 bg-foreground text-background font-mono text-xs uppercase tracking-widest rounded-sm hover:opacity-90 transition-opacity"
            >
              Browse Screener →
            </Link>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
              className="px-5 py-2.5 border border-primary/40 bg-primary/10 text-primary font-mono text-xs uppercase tracking-widest rounded-sm hover:bg-primary/20 transition-colors flex items-center gap-2"
              title="Open the AI co-pilot"
            >
              <span>Ask AI</span>
              <span className="flex gap-1">
                <kbd className="inline-flex items-center justify-center min-w-[1.25rem] px-1 py-0 rounded border border-primary/40 bg-background/40 font-mono text-[10px] text-primary">⌘</kbd>
                <kbd className="inline-flex items-center justify-center min-w-[1.25rem] px-1 py-0 rounded border border-primary/40 bg-background/40 font-mono text-[10px] text-primary">K</kbd>
              </span>
            </button>
            <button
              onClick={() => onPickPreset("quality")}
              className="px-5 py-2.5 border border-border bg-card/40 text-foreground font-mono text-xs uppercase tracking-widest rounded-sm hover:border-primary/40 hover:text-primary transition-colors"
            >
              Try a Preset
            </button>
            <Link
              to="/portfolio"
              className="px-5 py-2.5 text-muted-foreground font-mono text-xs uppercase tracking-widest hover:text-foreground transition-colors"
            >
              Portfolio →
            </Link>
            <Link
              to="/sources"
              className="px-5 py-2.5 text-muted-foreground font-mono text-xs uppercase tracking-widest hover:text-foreground transition-colors"
            >
              Data Sources →
            </Link>
          </div>
          <p className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground mt-4">
            Try: <span className="text-foreground/80">"cheap Indian banks with yield &gt; 4%"</span>
          </p>
        </div>

        {/* Live stats panel */}
        <div className="lg:col-span-5">
          <div className="panel">
            <div className="flex items-center justify-between border-b border-border px-4 py-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Network Status</span>
              <span className="text-[10px] font-mono uppercase tracking-widest text-[color:var(--cyan)] flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-[color:var(--cyan)] animate-pulse" />
                Live Replication
              </span>
            </div>
            <div className="grid grid-cols-2 divide-x divide-border">
              <Stat label="Symbols" value={meta ? meta.total.toString() : "—"} />
              <Stat label="Live Coverage" value={meta && meta.total ? `${Math.round((meta.liveCount / meta.total) * 100)}%` : "—"} />
            </div>
            <div className="grid grid-cols-2 divide-x divide-border border-t border-border">
              <Stat label="Last Refresh" value={refreshTime} />
              <Stat label="Markets" value="9" />
            </div>
          </div>
        </div>
      </div>

      {/* Region strip — 9 markets */}
      <div className="border-y border-border bg-card/30">
        <div className="max-w-[1400px] mx-auto grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 divide-x divide-border">
          {REGIONS.map((r) => (
            <div key={r.code} className="px-4 py-3 font-mono">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{r.label}</div>
              <div className="text-sm text-foreground mt-0.5 tabular-nums">
                {byRegion.get(r.code) ?? 0} <span className="text-[10px] text-muted-foreground uppercase">tickers</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Live tape preview */}
      {tapeRows.length > 0 && (
        <div className="max-w-[1400px] mx-auto px-4 py-8">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Top Movers <span className="text-muted-foreground/60">// 5-day</span>
            </h2>
            <Link to="/app" search={{ sortBy: "perf5d", sortDir: "desc" } as any} className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-primary">
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
                <span className="col-span-4 truncate text-foreground" title={r.name}>{r.name}</span>
                <span className="col-span-2 text-muted-foreground hidden md:block">{r.region}</span>
                <span className="col-span-2 text-right text-foreground tabular-nums">{fmtPriceDisplay(r.price, r.currency, r.marketCap, r.marketCapUsd, ccyMode)}</span>
                <span className={`col-span-1 text-right tabular-nums ${colorFor(r.perf5d)}`}>{fmtPct(r.perf5d)}</span>
                <span className="col-span-1 text-right text-[10px] uppercase text-muted-foreground hover:text-primary">Open →</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Capabilities — new AI + visual layer */}
      <div className="max-w-[1400px] mx-auto px-4 pb-2">
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-[color:var(--cyan)]">// New</span>
            <h2 className="text-xl font-medium tracking-tight mt-1">Intelligence layer</h2>
          </div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Powered by Lovable AI</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-border border border-border mb-10">
          <Capability
            num="A1"
            tag="PORTFOLIO"
            title="Track real holdings"
            desc="Add cost basis and shares; get live P&L, allocation by sector and region, and currency-aware valuation. Synced to your account."
          />
          <Capability
            num="A2"
            tag="ALERTS"
            title="Rule-based alerts"
            desc="Set price, RSI, 52-week range or momentum thresholds. Server-side evaluation with in-app toast and bell notifications."
          />
          <Capability
            num="A3"
            tag="NEWS"
            title="News & catalysts"
            desc="Ask what's moving any ticker. AI-curated answers with cited sources, right inside the terminal page."
          />
          <Capability
            num="A4"
            tag="CO-PILOT"
            title="Ask in plain English"
            desc="Press ⌘K and describe what you want. The AI translates natural-language queries into filters and navigation."
          />
          <Capability
            num="A5"
            tag="NARRATIVE"
            title="AI analyst thesis"
            desc="Every ticker gets a 3-paragraph thesis grounded in its specific fundamentals, momentum and risk metrics."
          />
          <Capability
            num="A6"
            tag="DIFF"
            title="Compare diff mode"
            desc="On the Compare page, hide identical rows and highlight metric divergence to surface what actually differs."
          />
        </div>
      </div>

      {/* Featured presets */}
      <div className="max-w-[1400px] mx-auto px-4 pb-10">
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Calibration Presets</span>
            <h2 className="text-xl font-medium tracking-tight mt-1">Start with a strategy</h2>
          </div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">7 presets available</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-border border border-border">
          {PRESET_CARDS.map((p) => (
            <button
              key={p.id}
              onClick={() => onPickPreset(p.id)}
              className="bg-card hover:bg-accent/40 transition-colors p-5 text-left group"
            >
              <div className="flex items-start justify-between mb-10">
                <span className="font-mono text-[10px] text-muted-foreground tracking-widest">{p.num} // {p.tag}</span>
                <span className="text-muted-foreground group-hover:text-primary transition-colors">→</span>
              </div>
              <h3 className="text-base font-medium mb-1.5">{p.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{p.desc}</p>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function Capability({ num, tag, title, desc }: { num: string; tag: string; title: string; desc: string }) {
  return (
    <div className="bg-card p-5">
      <div className="flex items-start justify-between mb-10">
        <span className="font-mono text-[10px] text-[color:var(--cyan)] tracking-widest">{num} // {tag}</span>
        <span className="size-1.5 rounded-full bg-[color:var(--cyan)]" />
      </div>
      <h3 className="text-base font-medium mb-1.5">{title}</h3>
      <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3">
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="text-2xl font-mono tabular-nums text-foreground mt-1">{value}</div>
    </div>
  );
}
