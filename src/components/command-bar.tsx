import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { aiParseQuery } from "@/server/ai.functions";

/**
 * AI Co-pilot command palette. Open with ⌘K / Ctrl+K (or "k" when not typing).
 * Sends the user's natural-language query to the AI gateway, which returns
 * a structured intent (screen / ticker / navigate). We then route the user
 * accordingly and show the AI's paraphrase as confirmation.
 */
export function CommandBar() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [explain, setExplain] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const parse = useMutation({
    mutationFn: (query: string) => aiParseQuery({ data: { q: query } }),
  });

  // Global shortcut: ⌘K / Ctrl+K toggles the palette
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      setExplain(null);
      setError(null);
      // focus input after dialog mounts
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = q.trim();
    if (!text) return;
    setError(null);
    setExplain(null);
    try {
      const res: any = await parse.mutateAsync(text);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setExplain(res?.explain ?? null);

      // Route based on the kind
      if (res?.kind === "ticker" && res.symbol) {
        navigate({ to: "/terminal/$symbol", params: { symbol: String(res.symbol).toUpperCase() } });
        setOpen(false);
        return;
      }
      if (res?.kind === "navigate" && res.route) {
        navigate({ to: res.route as any });
        setOpen(false);
        return;
      }
      if (res?.kind === "screen") {
        // Build search object using only fields the screener knows about.
        const search: Record<string, unknown> = { page: 1 };
        const carry = [
          "preset", "region", "sector", "q", "minMcap", "peMax", "pbMax",
          "dyMin", "rsiMin", "rsiMax", "near52wLowPct", "rocMin", "maCross",
          "minConfidence", "sortBy", "sortDir",
        ] as const;
        for (const k of carry) {
          const v = (res as any)[k];
          if (v === undefined) continue;
          if (typeof v === "string" && v === "" && k !== "q" && k !== "sector" && k !== "region") continue;
          search[k] = v;
        }
        navigate({ to: "/app", search: search as any });
        setOpen(false);
        return;
      }
      // unknown — keep dialog open and show explanation
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong.");
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Ask the AI co-pilot (⌘K)"
        aria-label="Open AI co-pilot"
        className="hidden md:inline-flex items-center gap-2 px-2.5 py-1 rounded border border-border bg-input/40 hover:bg-muted hover:border-primary/40 text-[11px] font-mono text-muted-foreground transition-colors"
      >
        <span className="text-primary">✦</span>
        <span>Ask AI…</span>
        <kbd className="ml-1 px-1 py-0.5 rounded border border-border bg-card text-[9px]">⌘K</kbd>
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="AI co-pilot"
      className="fixed inset-0 z-[60] flex items-start justify-center pt-[12vh] bg-background/80 backdrop-blur-sm p-4"
      onClick={() => setOpen(false)}
    >
      <div className="panel w-full max-w-2xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={submit} className="border-b border-border">
          <div className="flex items-center gap-3 px-4 py-3">
            <span className="text-primary font-mono text-sm">✦</span>
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ask anything: 'Helsinki small-caps with RSI under 30', 'Toyota', 'cheap Indian banks', 'go to watchlist'…"
              className="flex-1 bg-transparent outline-none font-mono text-sm placeholder:text-muted-foreground/60"
              maxLength={300}
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="submit"
              disabled={parse.isPending || !q.trim()}
              className="bg-primary text-primary-foreground font-mono text-[10px] uppercase tracking-wider px-3 py-1.5 rounded hover:opacity-90 disabled:opacity-50"
            >
              {parse.isPending ? "Thinking…" : "Run"}
            </button>
          </div>
        </form>
        <div className="px-4 py-3 text-xs">
          {parse.isPending && (
            <div className="text-primary font-mono animate-pulse">AI co-pilot is interpreting your request…</div>
          )}
          {!parse.isPending && error && (
            <div className="text-[color:var(--bear)] font-mono">{error}</div>
          )}
          {!parse.isPending && !error && explain && (
            <div className="text-muted-foreground">
              <span className="text-primary font-mono mr-2">→</span>
              {explain}
            </div>
          )}
          {!parse.isPending && !error && !explain && (
            <div className="text-muted-foreground space-y-1.5">
              <div className="text-[10px] font-mono uppercase tracking-widest text-primary">Try</div>
              {[
                "Show me Japanese small-caps with positive momentum",
                "Cheap European banks with dividend yield above 4%",
                "Open NVDA",
                "Oversold Indian stocks near 52-week lows",
              ].map((s) => (
                <button
                  key={s}
                  type="button"
                  className="block text-left text-foreground/80 hover:text-primary font-mono"
                  onClick={() => {
                    setQ(s);
                    setTimeout(() => inputRef.current?.focus(), 0);
                  }}
                >
                  · {s}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="border-t border-border px-4 py-2 flex items-center justify-between text-[10px] font-mono text-muted-foreground">
          <span>Powered by Lovable AI · interprets your request, never executes trades</span>
          <span>
            <kbd className="px-1 py-0.5 rounded border border-border">Esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}
