import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { askTerminal } from "@/server/v16.functions";
import { useAuth } from "@/hooks/use-auth";

type Msg = { role: "user" | "assistant"; content: string };

/**
 * Ask the Terminal — a docked Q&A panel grounded in the current ticker's facts.
 * Non-streaming (single round-trip per turn) to keep parity with existing AI helpers.
 */
export function AskTerminal({ symbol, facts }: { symbol: string; facts: string }) {
  const { user } = useAuth();
  const signedIn = !!user;
  const [history, setHistory] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reset on symbol change
  useEffect(() => {
    setHistory([]);
    setInput("");
    setError(null);
  }, [symbol]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [history]);

  const ask = useMutation({
    mutationFn: (next: Msg[]) => askTerminal({ data: { symbol, facts, history: next } }),
  });

  const handleSend = async () => {
    const q = input.trim();
    if (!q || ask.isPending) return;
    const next: Msg[] = [...history, { role: "user", content: q }];
    setHistory(next);
    setInput("");
    setError(null);
    try {
      const res = await ask.mutateAsync(next);
      if (res?.error) {
        setError(res.error);
        setHistory(next); // keep user message; no assistant reply
      } else {
        setHistory([...next, { role: "assistant", content: res.text }]);
      }
    } catch (e: any) {
      setError(e?.message ?? "Request failed");
    }
  };

  const suggestions = [
    "What is the current setup?",
    "What are the bull and bear cases?",
    "How does valuation compare to the trend?",
    "What would change my mind?",
  ];

  return (
    <div className="panel">
      <div className="panel-header flex items-center justify-between">
        <span>Ask the Terminal · {symbol}</span>
        <span className="text-[10px] font-mono uppercase tracking-wider text-primary">Powered by Lovable AI</span>
      </div>
      <div className="p-5">
        <div ref={scrollRef} className="max-h-[360px] overflow-y-auto space-y-3 mb-3">
          {history.length === 0 && !ask.isPending && (
            <div className="text-sm text-muted-foreground">
              Ask anything about <span className="text-primary font-mono">{symbol}</span> grounded in the metrics on this page.
              <div className="mt-3 flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => setInput(s)}
                    className="text-[11px] font-mono border border-border px-2 py-1 rounded hover:border-primary hover:text-primary"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {history.map((m, i) => (
            <div
              key={i}
              className={`text-sm leading-relaxed ${
                m.role === "user" ? "text-foreground" : "text-foreground/90"
              }`}
            >
              <div className="text-[10px] font-mono uppercase tracking-wider mb-1 text-muted-foreground">
                {m.role === "user" ? "You" : "Terminal"}
              </div>
              <div className={m.role === "assistant" ? "border-l-2 border-primary/40 pl-3 whitespace-pre-wrap" : "whitespace-pre-wrap"}>
                {m.content}
              </div>
            </div>
          ))}
          {ask.isPending && (
            <div className="text-[11px] font-mono uppercase tracking-wider text-primary animate-pulse">Thinking…</div>
          )}
          {error && <div className="text-xs font-mono text-[color:var(--bear)]">{error}</div>}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={`Ask about ${symbol}…`}
            className="flex-1 bg-background border border-border rounded px-3 py-2 text-sm font-mono focus:border-primary outline-none"
            maxLength={500}
            disabled={ask.isPending || !signedIn}
          />
          <button
            onClick={handleSend}
            disabled={ask.isPending || !input.trim() || !signedIn}
            title={signedIn ? "" : "Sign in to use AI"}
            className="text-[10px] font-mono uppercase tracking-wider bg-primary text-primary-foreground px-3 py-2 rounded hover:opacity-90 disabled:opacity-40"
          >
            Send
          </button>
        </div>
        {!signedIn && (
          <p className="text-xs text-muted-foreground mt-2">
            <Link to="/auth" className="text-primary underline">Sign in</Link> to chat with the AI.
          </p>
        )}
        <div className="text-[10px] text-muted-foreground border-t border-border pt-3 mt-4 font-mono">
          AI-generated answers grounded in the metrics on this page. No external news or forecasts. Not investment advice.
        </div>
      </div>
    </div>
  );
}
