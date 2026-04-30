import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { fetchUniverse } from "@/server/screen.functions";
import { scoreAll } from "@/lib/scores";
import { SiteNav, Disclaimer } from "@/components/site-nav";
import { StatGridSkeleton, TableSkeleton } from "@/components/feedback-states";

export const Route = createFileRoute("/data-quality")({
  head: () => ({
    meta: [
      { title: "Data Quality Command Center — Global Equity Terminal v2" },
      { name: "description", content: "Source freshness, missing-metric warnings, and per-ticker confidence across the curated global universe." },
      { property: "og:title", content: "Data Quality Command Center — Global Equity Terminal v2" },
      { property: "og:description", content: "Source freshness, missing-metric warnings, and per-ticker confidence across the curated global universe." },
    ],
    links: [{ rel: "canonical", href: "https://rankaisolutions.tech/data-quality" }],
  }),
  component: DataQualityPage,
});

function DataQualityPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["universe"],
    queryFn: () => fetchUniverse({ data: {} }),
    staleTime: 5 * 60 * 1000,
  });

  const scored = useMemo(() => (data?.rows ? scoreAll(data.rows) : []), [data]);
  const stats = useMemo(() => {
    if (!scored.length) return null;
    const live = scored.filter((r) => !r.isMock).length;
    const mock = scored.length - live;
    const high = scored.filter((r) => r.scores.confidence >= 85).length;
    const med = scored.filter((r) => r.scores.confidence >= 60 && r.scores.confidence < 85).length;
    const low = scored.filter((r) => r.scores.confidence < 60).length;
    const missingPe = scored.filter((r) => r.pe == null).length;
    const missingHist = scored.filter((r) => r.closes.length < 20).length;
    const missing52w = scored.filter((r) => r.high52 == null || r.low52 == null).length;
    return { total: scored.length, live, mock, high, med, low, missingPe, missingHist, missing52w };
  }, [scored]);

  const lowConf = useMemo(() => scored.filter((r) => r.scores.confidence < 60).slice(0, 50), [scored]);

  return (
    <div className="min-h-screen flex flex-col">
      <SiteNav />
      <main className="flex-1 max-w-[1400px] mx-auto px-4 py-6 w-full">
        <h1 className="text-xl font-semibold tracking-tight">Data Quality Command Center</h1>
        <p className="text-xs text-muted-foreground mt-1">Per-ticker source freshness, missing-metric warnings, and confidence scoring.</p>

        {isLoading || !stats ? (
          <div className="mt-4 space-y-3">
            <StatGridSkeleton count={4} />
            <div className="panel"><TableSkeleton columns={6} rows={8} /></div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
              <Stat label="Universe" value={stats.total} />
              <Stat label="Live data" value={stats.live} cls="text-[color:var(--bull)]" />
              <Stat label="Mock fallback" value={stats.mock} cls="text-primary" />
              <Stat label="High-confidence" value={stats.high} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
              <Bar label="High (≥85)" value={stats.high} total={stats.total} color="var(--bull)" />
              <Bar label="Medium (60–84)" value={stats.med} total={stats.total} color="var(--primary)" />
              <Bar label="Low (<60)" value={stats.low} total={stats.total} color="var(--bear)" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
              <Stat label="Missing P/E" value={stats.missingPe} cls="text-[color:var(--bear)]" />
              <Stat label="Sparse history (<20 closes)" value={stats.missingHist} cls="text-[color:var(--bear)]" />
              <Stat label="Missing 52W bands" value={stats.missing52w} cls="text-[color:var(--bear)]" />
            </div>

            <div className="panel mt-6">
              <div className="panel-header">Low-Confidence Tickers ({lowConf.length})</div>
              <div className="overflow-x-auto">
                <table className="term">
                  <thead>
                    <tr><th>Ticker</th><th>Region</th><th>Source</th><th className="text-right">Confidence</th><th>Reasons</th><th></th></tr>
                  </thead>
                  <tbody>
                    {lowConf.length === 0 && <tr><td colSpan={6} className="text-center text-muted-foreground py-8">All tickers have medium or higher confidence.</td></tr>}
                    {lowConf.map((r) => (
                      <tr key={r.symbol}>
                        <td className="text-primary font-mono">{r.symbol}</td>
                        <td className="text-muted-foreground">{r.region}</td>
                        <td className="text-muted-foreground">{r.source}{r.isMock && <span className="text-primary"> (mock)</span>}</td>
                        <td className="num">{r.scores.confidence}</td>
                        <td className="text-muted-foreground text-xs">{r.scores.confidenceReasons.join(" · ")}</td>
                        <td><Link to="/terminal/$symbol" params={{ symbol: r.symbol }} className="font-mono text-[10px] text-primary border border-primary/40 px-2 py-1 rounded hover:bg-primary/10">Analyze</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        <Disclaimer />
      </main>
    </div>
  );
}

function Stat({ label, value, cls = "" }: { label: string; value: number; cls?: string }) {
  return (
    <div className="panel p-4">
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`text-2xl font-mono mt-1 ${cls}`}>{value}</div>
    </div>
  );
}
function Bar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="panel p-4">
      <div className="flex items-baseline justify-between text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        <span>{label}</span><span style={{ color }}>{value} ({pct}%)</span>
      </div>
      <div className="mt-2 h-2 bg-muted rounded overflow-hidden">
        <div className="h-full rounded" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}
