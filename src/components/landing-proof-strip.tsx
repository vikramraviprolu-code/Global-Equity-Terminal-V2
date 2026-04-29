import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import type { ScoredRow } from "@/lib/scores";
import { fmtPriceDisplay, fmtPct, colorFor } from "@/lib/format";
import { useDisplayCurrency } from "@/hooks/use-display-currency";

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

export function LandingProofStrip({ rows }: { rows: ScoredRow[] }) {
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

  return (
    <section
      aria-labelledby="proof-heading"
      className="border-b border-border bg-card/30"
    >
      <h2 id="proof-heading" className="sr-only">
        Live coverage and top movers
      </h2>

      {/* Region coverage band */}
      <div className="max-w-[1400px] mx-auto grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 divide-x divide-border border-b border-border">
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

      {tapeRows.length > 0 && (
        <div className="max-w-[1400px] mx-auto px-4 py-10">
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Top Movers <span className="text-muted-foreground/60">// 5-day</span>
            </h3>
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
    </section>
  );
}
