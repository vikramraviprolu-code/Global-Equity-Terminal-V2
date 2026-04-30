import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { generateBrief } from "@/server/v16.functions";

/**
 * AI Morning Brief — generates a concise digest over the active watchlist's symbols.
 * On-demand (button) so we don't burn AI credits on every page load.
 */
export function MorningBrief({ symbols }: { symbols: string[] }) {
  const [summary, setSummary] = useState("");
  const [highlights, setHighlights] = useState<Array<{ symbol: string; perf5d: number; rsi14: number | null }>>([]);
  const [error, setError] = useState<string | null>(null);

  const gen = useMutation({
    mutationFn: () => generateBrief({ data: { symbols: symbols.slice(0, 30) } }),
    onSuccess: (res: any) => {
      if (res?.error) {
        setError(res.error);
        setSummary("");
        setHighlights([]);
      } else {
        setError(null);
        setSummary(res.summary ?? "");
        setHighlights(res.highlights ?? []);
      }
    },
    onError: (err: any) => setError(err?.message ?? "Request failed"),
  });

  if (symbols.length === 0) return null;

  return (
    <div className="panel mt-4">
      <div className="panel-header flex items-center justify-between">
        <span>AI Morning Brief · {symbols.length} ticker{symbols.length === 1 ? "" : "s"}</span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-primary">Powered by Lovable AI</span>
          <button
            onClick={() => gen.mutate()}
            disabled={gen.isPending || symbols.length === 0}
            className="text-[10px] font-mono uppercase tracking-wider border border-primary/50 text-primary px-2 py-1 rounded hover:bg-primary/10 disabled:opacity-50"
          >
            {gen.isPending ? "Composing…" : summary ? "Refresh" : "Generate brief"}
          </button>
        </div>
      </div>
      <div className="p-5 text-sm leading-relaxed max-w-4xl">
        {!summary && !gen.isPending && !error && (
          <p className="text-muted-foreground">
            One-paragraph digest of overnight moves across this watchlist — biggest movers, breakouts, and oversold flips, grounded only in the metrics shown.
          </p>
        )}
        {gen.isPending && (
          <p className="text-primary font-mono text-[10px] uppercase tracking-wider animate-pulse">Composing brief…</p>
        )}
        {error && <p className="text-[color:var(--bear)] font-mono text-xs">{error}</p>}
        {summary && (
          <>
            {highlights.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {highlights.map((h) => (
                  <span
                    key={h.symbol}
                    className={`text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded border ${
                      h.perf5d >= 0
                        ? "border-[color:var(--bull)]/40 text-[color:var(--bull)]"
                        : "border-[color:var(--bear)]/40 text-[color:var(--bear)]"
                    }`}
                  >
                    {h.symbol} {h.perf5d >= 0 ? "+" : ""}{h.perf5d.toFixed(1)}%
                  </span>
                ))}
              </div>
            )}
            <div className="space-y-3 whitespace-pre-wrap">
              {summary.split(/\n\n+/).map((p, i) => <p key={i}>{p}</p>)}
            </div>
          </>
        )}
        <div className="text-[10px] text-muted-foreground border-t border-border pt-3 mt-4 font-mono">
          AI-generated from current quotes for your watchlist. Not investment advice.
        </div>
      </div>
    </div>
  );
}
