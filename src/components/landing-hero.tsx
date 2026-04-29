import { Link } from "@tanstack/react-router";
import { MetricLabel } from "@/components/metric-label";
import { openAuthPopup } from "@/lib/auth-popup";

type Meta = { retrievedAt: string; total: number; mockCount: number; liveCount: number };

export function LandingHero({
  meta,
  isLoading,
}: {
  meta?: Meta;
  isLoading: boolean;
}) {
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
            <a
              href="/auth?popup=1"
              target="_blank"
              rel="noopener"
              onClick={(e) => { e.preventDefault(); openAuthPopup(); }}
              className="text-foreground hover:text-primary underline-offset-4 hover:underline cursor-pointer"
            >
              Sign in
            </a>
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
    </section>
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
