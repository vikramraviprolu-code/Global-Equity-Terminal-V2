import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { aiTickerNarrative } from "@/server/ai.functions";
import { ParagraphSkeleton } from "@/components/feedback-states";

/**
 * AI Narrative panel — generates a 3-paragraph plain-English thesis grounded
 * strictly in the metrics we already computed. The user clicks a button so
 * we don't burn AI credits on every page load.
 */
export function AiNarrative({
  symbol,
  facts,
}: {
  symbol: string;
  facts: string;
}) {
  const [text, setText] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const gen = useMutation({
    mutationFn: () => aiTickerNarrative({ data: { symbol, facts } }),
    onSuccess: (res: any) => {
      if (res?.error) setError(res.error);
      else {
        setError(null);
        setText(res?.text ?? "");
      }
    },
    onError: (err: any) => setError(err?.message ?? "AI request failed"),
  });

  // Reset when the symbol changes
  useEffect(() => {
    setText("");
    setError(null);
  }, [symbol]);

  return (
    <div className="panel">
      <div className="panel-header flex items-center justify-between">
        <span>AI Narrative · {symbol}</span>
        <button
          onClick={() => gen.mutate()}
          disabled={gen.isPending}
          className="text-[10px] font-mono uppercase tracking-wider border border-primary/50 text-primary px-2 py-1 rounded hover:bg-primary/10 disabled:opacity-50"
        >
          {gen.isPending ? "Generating…" : text ? "Regenerate" : "Generate"}
        </button>
      </div>
      <div className="p-5 text-sm leading-relaxed max-w-4xl">
        {!text && !gen.isPending && !error && (
          <p className="text-muted-foreground">
            Generate a plain-English thesis grounded in the metrics shown on this page — what the
            setup looks like today, valuation context, and the bull / bear case.{" "}
            <span className="text-[10px] font-mono uppercase tracking-wider text-primary">Powered by Lovable AI</span>
          </p>
        )}
        {gen.isPending && (
          <div className="space-y-3">
            <p className="text-primary font-mono text-[10px] uppercase tracking-wider animate-pulse">Composing narrative…</p>
            <ParagraphSkeleton lines={6} />
          </div>
        )}
        {error && <p className="text-[color:var(--bear)] font-mono text-xs">{error}</p>}
        {text && (
          <div className="space-y-3 whitespace-pre-wrap">
            {text.split(/\n\n+/).map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        )}
        <div className="text-[10px] text-muted-foreground border-t border-border pt-3 mt-4 font-mono">
          AI-generated from the metrics on this page. Numbers reflect those provided to the model;
          no external news or forecasts. Not investment advice.
        </div>
      </div>
    </div>
  );
}
