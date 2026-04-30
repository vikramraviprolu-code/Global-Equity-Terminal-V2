import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { SiteNav, Disclaimer } from "@/components/site-nav";
import { listTheses, upsertThesis, evaluateThesis, deleteThesis } from "@/server/v16.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/theses")({
  head: () => ({
    meta: [
      { title: "Thesis Tracker — Global Equity Terminal" },
      { name: "description", content: "Write a one-paragraph thesis on any stock. The terminal re-evaluates it against live metrics and flags when the thesis is breaking." },
      { property: "og:title", content: "Thesis Tracker — Global Equity Terminal" },
      { property: "og:description", content: "Write a one-paragraph thesis on any stock. AI re-evaluates against live metrics and flags when it's breaking." },
    ],
    links: [{ rel: "canonical", href: "https://rankaisolutions.tech/theses" }],
  }),
  component: ThesesPage,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="p-10 text-center font-mono text-sm text-destructive">
        Failed to load theses: {error.message}
        <div className="mt-4">
          <button className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground" onClick={() => { router.invalidate(); reset(); }}>
            Retry
          </button>
        </div>
      </div>
    );
  },
  notFoundComponent: () => <div className="p-10 text-center font-mono text-sm text-muted-foreground">Page not found.</div>,
});

const STATUS_COLORS: Record<string, string> = {
  intact: "text-[color:var(--bull)] border-[color:var(--bull)]/40",
  monitor: "text-primary border-primary/40",
  breaking: "text-[color:var(--warn)] border-[color:var(--warn)]/40",
  broken: "text-[color:var(--bear)] border-[color:var(--bear)]/40",
  unknown: "text-muted-foreground border-border",
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] ?? STATUS_COLORS.unknown;
  return (
    <span className={`text-[10px] font-mono uppercase tracking-wider border px-2 py-0.5 rounded ${cls}`}>
      {status}
    </span>
  );
}

function ThesesPage() {
  const qc = useQueryClient();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [symbol, setSymbol] = useState("");
  const [thesis, setThesis] = useState("");

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => { if (mounted) setAuthed(!!data.session); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setAuthed(!!s));
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["theses"],
    queryFn: () => listTheses(),
    enabled: authed === true,
    staleTime: 30_000,
  });

  const save = useMutation({
    mutationFn: () => upsertThesis({ data: { symbol: symbol.toUpperCase(), thesis } }),
    onSuccess: () => { setSymbol(""); setThesis(""); qc.invalidateQueries({ queryKey: ["theses"] }); },
  });
  const evalNow = useMutation({
    mutationFn: (id: string) => evaluateThesis({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["theses"] }),
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteThesis({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["theses"] }),
  });

  if (authed === false) {
    return (
      <div className="min-h-screen flex flex-col">
        <SiteNav />
        <main className="flex-1 max-w-[900px] mx-auto px-4 py-12 w-full">
          <h1 className="text-xl font-semibold tracking-tight">Thesis Tracker</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Write a one-paragraph thesis on any stock. The terminal re-evaluates it against live metrics and flags when it's breaking.
          </p>
          <div className="panel mt-6 p-6">
            <p className="text-sm">Sign in to start tracking your investment theses.</p>
            <Link to="/auth" className="inline-block mt-3 text-[11px] font-mono uppercase tracking-wider bg-primary text-primary-foreground px-3 py-1.5 rounded hover:opacity-90">
              Sign in
            </Link>
          </div>
          <Disclaimer />
        </main>
      </div>
    );
  }

  const theses = data?.theses ?? [];

  return (
    <div className="min-h-screen flex flex-col">
      <SiteNav />
      <main className="flex-1 max-w-[1100px] mx-auto px-4 py-6 w-full">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Thesis Tracker</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Write your investment thesis. Re-evaluate any time — AI checks it against current metrics and flags when it's breaking.
          </p>
        </div>

        <div className="panel mt-6">
          <div className="panel-header">New thesis</div>
          <div className="p-5 grid gap-3 md:grid-cols-[180px_1fr_auto] items-start">
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder="Ticker (e.g. AAPL)"
              className="bg-background border border-border rounded px-3 py-2 text-sm font-mono focus:border-primary outline-none"
              maxLength={20}
            />
            <textarea
              value={thesis}
              onChange={(e) => setThesis(e.target.value)}
              placeholder="In one paragraph: why do you own / want to own this? What would make you sell?"
              className="bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none min-h-[80px]"
              maxLength={2000}
            />
            <button
              onClick={() => save.mutate()}
              disabled={save.isPending || !symbol.trim() || thesis.trim().length < 10}
              className="text-[10px] font-mono uppercase tracking-wider bg-primary text-primary-foreground px-3 py-2 rounded hover:opacity-90 disabled:opacity-40 whitespace-nowrap"
            >
              {save.isPending ? "Saving…" : "Save thesis"}
            </button>
          </div>
        </div>

        <div className="mt-6">
          <h2 className="text-sm font-semibold mb-3">Your theses</h2>
          {isLoading ? (
            <div className="text-xs font-mono text-muted-foreground">Loading…</div>
          ) : theses.length === 0 ? (
            <div className="panel p-6 text-sm text-muted-foreground">
              No theses yet. Write one above to start tracking.
            </div>
          ) : (
            <div className="space-y-3">
              {theses.map((t: any) => (
                <div key={t.id} className="panel p-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <Link to="/terminal/$symbol" params={{ symbol: t.symbol }} className="text-primary font-mono text-sm hover:underline">
                        {t.symbol}
                      </Link>
                      <StatusBadge status={t.status} />
                      {t.evaluated_at && (
                        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                          evaluated {new Date(t.evaluated_at).toLocaleString()}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => evalNow.mutate(t.id)}
                        disabled={evalNow.isPending}
                        className="text-[10px] font-mono uppercase tracking-wider border border-primary/50 text-primary px-2 py-1 rounded hover:bg-primary/10 disabled:opacity-50"
                      >
                        {evalNow.isPending && evalNow.variables === t.id ? "Evaluating…" : "Re-evaluate"}
                      </button>
                      <button
                        onClick={() => { if (confirm(`Delete thesis on ${t.symbol}?`)) del.mutate(t.id); }}
                        className="text-[10px] font-mono uppercase tracking-wider border border-border px-2 py-1 rounded hover:border-destructive hover:text-destructive"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <p className="text-sm mt-3 leading-relaxed whitespace-pre-wrap">{t.thesis}</p>
                  {t.rationale && (
                    <div className="mt-3 border-l-2 border-primary/40 pl-3 text-sm leading-relaxed text-foreground/90">
                      <div className="text-[10px] font-mono uppercase tracking-wider text-primary mb-1">AI verdict</div>
                      {t.rationale}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <Disclaimer />
      </main>
    </div>
  );
}
