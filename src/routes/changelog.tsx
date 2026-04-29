import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useMemo } from "react";
import { SiteNav, Disclaimer } from "@/components/site-nav";
import { APP_VERSION, APP_RELEASE_DATE, APP_CODENAME } from "@/lib/version";

const searchSchema = z.object({
  v: fallback(z.string(), "all").default("all"),
  q: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/changelog")({
  validateSearch: zodValidator(searchSchema),
  component: ChangelogPage,
  head: () => ({
    meta: [
      { title: "Changelog · Global Equity Terminal" },
      { name: "description", content: "Release notes and version history for Global Equity Terminal." },
    ],
  }),
});

type Entry = {
  version: string;
  date: string;
  codename?: string;
  summary?: string;
  sections: { title: string; items: string[] }[];
};

const ENTRIES: Entry[] = [
  {
    version: "1.0.0",
    date: "2026-04-29",
    codename: "Atlas",
    summary:
      "First stable release. Research, monitoring, and personal portfolio tracking covered end-to-end.",
    sections: [
      {
        title: "Added",
        items: [
          "Portfolio mode — holdings, live valuation, unrealized P&L, allocation by sector and region.",
          "Alerts engine — price, RSI, 52w range, 5d momentum rules with server-side evaluation.",
          "In-app notifications — AlertBell with unread badge and toast delivery.",
          "Authentication — Email/password + Google OAuth via Lovable Cloud.",
          "News & Catalysts — AI-curated catalysts per ticker with cited sources.",
          "Landing refresh — 6-capability Intelligence Layer grid + Portfolio CTA.",
          "Versioning — version.ts source of truth, CHANGELOG, footer build tag, semver.",
        ],
      },
      {
        title: "Infrastructure",
        items: [
          "Lovable Cloud enabled with holdings, alerts, alert_events tables and RLS.",
          "Server functions: portfolio, alerts, news.",
        ],
      },
    ],
  },
  {
    version: "0.x",
    date: "Pre-release",
    summary:
      "Screener, terminal analysis, compare, watchlists, events, AI narrative, diff mode, sector heatmap, data quality, sources, currency toggle, command palette, PDF export.",
    sections: [],
  },
];

function highlight(text: string, q: string) {
  if (!q) return text;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark className="bg-primary/25 text-foreground rounded-sm px-0.5">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

function ChangelogPage() {
  const { v, q } = Route.useSearch();
  const navigate = useNavigate({ from: "/changelog" });

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return ENTRIES
      .filter((e) => v === "all" || e.version === v)
      .map((e) => {
        if (!needle) return e;
        const matchHeader =
          e.version.toLowerCase().includes(needle) ||
          e.codename?.toLowerCase().includes(needle) ||
          e.summary?.toLowerCase().includes(needle);
        const sections = e.sections
          .map((s) => ({ ...s, items: s.items.filter((it) => it.toLowerCase().includes(needle)) }))
          .filter((s) => s.items.length > 0);
        if (!matchHeader && sections.length === 0) return null;
        return { ...e, sections: matchHeader && sections.length === 0 ? e.sections : sections };
      })
      .filter((e): e is Entry => e !== null);
  }, [v, q]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />
      <main className="max-w-3xl mx-auto px-4 py-10">
        <div className="mb-6">
          <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Release notes</p>
          <h1 className="text-3xl font-semibold mt-1">Changelog</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Currently running <span className="font-mono text-foreground">v{APP_VERSION}</span>
            {APP_CODENAME ? <> · "{APP_CODENAME}"</> : null} · released {APP_RELEASE_DATE}.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-8 pb-4 border-b border-border">
          <div className="flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider">
            <span className="text-muted-foreground mr-1">Version:</span>
            {[{ key: "all", label: "All" }, ...ENTRIES.map((e) => ({ key: e.version, label: `v${e.version}` }))].map((opt) => {
              const active = v === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => navigate({ search: (prev) => ({ ...prev, v: opt.key }) })}
                  className={
                    "px-2 py-1 rounded border transition-colors " +
                    (active
                      ? "border-primary text-primary bg-primary/10"
                      : "border-border text-muted-foreground hover:text-foreground hover:bg-muted")
                  }
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <div className="ml-auto flex items-center gap-2 flex-1 min-w-[200px] max-w-sm">
            <input
              type="search"
              value={q}
              onChange={(e) =>
                navigate({ search: (prev) => ({ ...prev, q: e.target.value }) })
              }
              placeholder="Filter by keyword (e.g. portfolio, RSI, OAuth)"
              className="w-full bg-card border border-border rounded px-3 py-1.5 text-sm font-mono placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary"
            />
            {(q || v !== "all") && (
              <button
                type="button"
                onClick={() => navigate({ search: () => ({ v: "all", q: "" }) })}
                className="text-[11px] font-mono uppercase text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground font-mono">No entries match those filters.</p>
        ) : (
          <div className="space-y-10">
            {filtered.map((e) => (
              <article key={e.version} className="border-l-2 border-border pl-5">
                <header className="flex items-baseline gap-3 flex-wrap">
                  <h2 className="font-mono text-lg text-primary">v{e.version}</h2>
                  <span className="text-xs text-muted-foreground">{e.date}</span>
                  {e.codename ? (
                    <span className="text-xs font-mono text-muted-foreground">"{e.codename}"</span>
                  ) : null}
                </header>
                {e.summary ? <p className="text-sm text-muted-foreground mt-2">{highlight(e.summary, q)}</p> : null}
                {e.sections.map((s) => (
                  <section key={s.title} className="mt-4">
                    <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">
                      {s.title}
                    </h3>
                    <ul className="space-y-1.5 text-sm leading-relaxed">
                      {s.items.map((it, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-primary mt-1.5 w-1 h-1 rounded-full bg-primary shrink-0" />
                          <span>{highlight(it, q)}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </article>
            ))}
          </div>
        )}

        <p className="mt-10 text-xs text-muted-foreground">
          <Link to="/app" className="hover:text-foreground">← Back to terminal</Link>
        </p>
        <Disclaimer />
      </main>
    </div>
  );
}
