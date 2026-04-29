import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteNav, Disclaimer } from "@/components/site-nav";
import { APP_VERSION, APP_RELEASE_DATE, APP_CODENAME } from "@/lib/version";

export const Route = createFileRoute("/changelog")({
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

function ChangelogPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />
      <main className="max-w-3xl mx-auto px-4 py-10">
        <div className="mb-8">
          <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Release notes</p>
          <h1 className="text-3xl font-semibold mt-1">Changelog</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Currently running <span className="font-mono text-foreground">v{APP_VERSION}</span>
            {APP_CODENAME ? <> · "{APP_CODENAME}"</> : null} · released {APP_RELEASE_DATE}.
          </p>
        </div>

        <div className="space-y-10">
          {ENTRIES.map((e) => (
            <article key={e.version} className="border-l-2 border-border pl-5">
              <header className="flex items-baseline gap-3 flex-wrap">
                <h2 className="font-mono text-lg text-primary">v{e.version}</h2>
                <span className="text-xs text-muted-foreground">{e.date}</span>
                {e.codename ? (
                  <span className="text-xs font-mono text-muted-foreground">"{e.codename}"</span>
                ) : null}
              </header>
              {e.summary ? <p className="text-sm text-muted-foreground mt-2">{e.summary}</p> : null}
              {e.sections.map((s) => (
                <section key={s.title} className="mt-4">
                  <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">
                    {s.title}
                  </h3>
                  <ul className="space-y-1.5 text-sm leading-relaxed">
                    {s.items.map((it, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-primary mt-1.5 w-1 h-1 rounded-full bg-primary shrink-0" />
                        <span>{it}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </article>
          ))}
        </div>

        <p className="mt-10 text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground">← Back to terminal</Link>
        </p>
        <Disclaimer />
      </main>
    </div>
  );
}
