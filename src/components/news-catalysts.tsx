import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { aiNewsCatalysts } from "@/server/news.functions";
import { ParagraphSkeleton } from "@/components/feedback-states";

type Recency = "day" | "week" | "month";

/**
 * News & Catalysts panel — answers "what's moving this stock?" with cited
 * sources via Perplexity. User-triggered to avoid burning credits.
 */
export function NewsCatalysts({
  symbol,
  name,
}: {
  symbol: string;
  name?: string;
}) {
  const [text, setText] = useState<string>("");
  const [citations, setCitations] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState<string>("");
  const [recency, setRecency] = useState<Recency>("week");

  const gen = useMutation({
    mutationFn: () =>
      aiNewsCatalysts({
        data: {
          symbol,
          name,
          question: question.trim() || undefined,
          recency,
        },
      }),
    onSuccess: (res: any) => {
      if (res?.error) {
        setError(res.error);
        setText("");
        setCitations([]);
      } else {
        setError(null);
        setText(res?.text ?? "");
        setCitations(Array.isArray(res?.citations) ? res.citations : []);
      }
    },
    onError: (err: any) => setError(err?.message ?? "News request failed"),
  });

  // Reset when symbol changes
  useEffect(() => {
    setText("");
    setCitations([]);
    setError(null);
    setQuestion("");
  }, [symbol]);

  const hostFor = (u: string) => {
    try {
      return new URL(u).hostname.replace(/^www\./, "");
    } catch {
      return u;
    }
  };

  return (
    <div className="panel">
      <div className="panel-header flex items-center justify-between">
        <span>News &amp; Catalysts · {symbol}</span>
        <div className="flex items-center gap-2">
          <select
            value={recency}
            onChange={(e) => setRecency(e.target.value as Recency)}
            className="text-[10px] font-mono uppercase tracking-wider bg-background border border-border text-foreground px-2 py-1 rounded"
            aria-label="Recency"
          >
            <option value="day">24h</option>
            <option value="week">1w</option>
            <option value="month">1m</option>
          </select>
          <button
            onClick={() => gen.mutate()}
            disabled={gen.isPending}
            className="text-[10px] font-mono uppercase tracking-wider border border-primary/50 text-primary px-2 py-1 rounded hover:bg-primary/10 disabled:opacity-50"
          >
            {gen.isPending ? "Searching…" : text ? "Refresh" : "Ask"}
          </button>
        </div>
      </div>
      <div className="p-5 text-sm leading-relaxed max-w-4xl space-y-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !gen.isPending) gen.mutate();
            }}
            placeholder={`e.g. "What's moving ${symbol} this week?" or "Latest analyst actions"`}
            className="flex-1 bg-background border border-border rounded px-3 py-2 text-sm font-mono placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary"
          />
          <button
            onClick={() => gen.mutate()}
            disabled={gen.isPending}
            className="text-xs font-mono uppercase tracking-wider bg-primary/10 border border-primary/50 text-primary px-3 py-2 rounded hover:bg-primary/20 disabled:opacity-50"
          >
            {gen.isPending ? "…" : "Ask"}
          </button>
        </div>

        {!text && !gen.isPending && !error && (
          <p className="text-muted-foreground">
            Ask what&apos;s moving this stock right now — earnings, guidance, deals, analyst actions, sector or macro drivers — answered with cited sources from the live web.{" "}
            <span className="text-[10px] font-mono uppercase tracking-wider text-primary">Powered by Perplexity</span>
          </p>
        )}

        {gen.isPending && (
          <div className="space-y-3">
            <p className="text-primary font-mono text-[10px] uppercase tracking-wider animate-pulse">
              Searching the web for catalysts…
            </p>
            <ParagraphSkeleton lines={6} />
          </div>
        )}

        {error && (
          <p className="text-[color:var(--bear)] font-mono text-xs">{error}</p>
        )}

        {text && (
          <div className="space-y-3 whitespace-pre-wrap">
            {text.split(/\n\n+/).map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        )}

        {citations.length > 0 && (
          <div className="border-t border-border pt-3">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
              Sources
            </div>
            <ol className="space-y-1 text-xs">
              {citations.map((url, i) => (
                <li key={url + i} className="flex gap-2">
                  <span className="text-muted-foreground font-mono w-5 shrink-0">
                    [{i + 1}]
                  </span>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline break-all"
                  >
                    {hostFor(url)}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="text-[10px] text-muted-foreground border-t border-border pt-3 font-mono">
          Live web answers via Perplexity. Verify facts with the cited sources.
          Not investment advice.
        </div>
      </div>
    </div>
  );
}
