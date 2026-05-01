import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useMemo } from "react";
import { SiteNav, Disclaimer } from "@/components/site-nav";
import { APP_VERSION, APP_RELEASE_DATE, APP_CODENAME } from "@/lib/version";
import { CHANGELOG_ENTRIES, type ChangelogEntry } from "@/lib/changelog";

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

// Render minimal inline markdown (`code`, **bold**) inside list items.
// We deliberately keep this tiny — the changelog is the only consumer.
function renderInline(text: string, q: string): React.ReactNode {
  // Tokenize into [code | bold | text] segments first, then highlight q within each text segment.
  const tokens: { kind: "code" | "bold" | "text"; value: string }[] = [];
  const re = /(`[^`]+`|\*\*[^*]+\*\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) tokens.push({ kind: "text", value: text.slice(last, m.index) });
    if (m[0].startsWith("`")) tokens.push({ kind: "code", value: m[0].slice(1, -1) });
    else tokens.push({ kind: "bold", value: m[0].slice(2, -2) });
    last = m.index + m[0].length;
  }
  if (last < text.length) tokens.push({ kind: "text", value: text.slice(last) });

  return tokens.map((t, i) => {
    if (t.kind === "code") {
      return (
        <code key={i} className="font-mono text-[0.85em] bg-muted/60 px-1 py-0.5 rounded text-foreground/90">
          {highlightPlain(t.value, q)}
        </code>
      );
    }
    if (t.kind === "bold") {
      return (
        <strong key={i} className="font-semibold text-foreground">
          {highlightPlain(t.value, q)}
        </strong>
      );
    }
    return <span key={i}>{highlightPlain(t.value, q)}</span>;
  });
}

function highlightPlain(text: string, q: string): React.ReactNode {
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

function entryMatches(e: ChangelogEntry, needle: string): boolean {
  if (!needle) return true;
  if (e.version.toLowerCase().includes(needle)) return true;
  if (e.codename?.toLowerCase().includes(needle)) return true;
  if (e.summary?.toLowerCase().includes(needle)) return true;
  return e.sections.some((s) => s.items.some((it) => it.toLowerCase().includes(needle)));
}

function ChangelogPage() {
  const { v, q } = Route.useSearch();
  const navigate = useNavigate({ from: "/changelog" });

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return CHANGELOG_ENTRIES
      .filter((e) => v === "all" || e.version === v)
      .filter((e) => entryMatches(e, needle));
  }, [v, q]);

  // Top-level filter chips: just the major.minor groups + a few latest patches.
  // Keep it short — full history is still searchable via the keyword input.
  const versionChips = useMemo(() => {
    const seenMinor = new Set<string>();
    const chips: { key: string; label: string }[] = [{ key: "all", label: "All" }];
    for (const e of CHANGELOG_ENTRIES) {
      // Always include the current version
      const isCurrent = e.version === APP_VERSION;
      const minor = e.version.split(".").slice(0, 2).join(".");
      if (isCurrent || !seenMinor.has(minor)) {
        chips.push({ key: e.version, label: `v${e.version}` });
        seenMinor.add(minor);
      }
      if (chips.length > 8) break;
    }
    return chips;
  }, []);

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
          <p className="text-xs text-muted-foreground mt-1">
            {CHANGELOG_ENTRIES.length} releases · sourced from <span className="font-mono">CHANGELOG.md</span>.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-8 pb-4 border-b border-border">
          <div className="flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider flex-wrap">
            <span className="text-muted-foreground mr-1">Version:</span>
            {versionChips.map((opt) => {
              const active = v === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => navigate({ search: (prev: z.infer<typeof searchSchema>) => ({ ...prev, v: opt.key }) })}
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
                navigate({ search: (prev: z.infer<typeof searchSchema>) => ({ ...prev, q: e.target.value }) })
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
                  {e.kind ? (
                    <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border border-border text-muted-foreground">
                      {e.kind}
                    </span>
                  ) : null}
                </header>
                {e.summary ? (
                  <p className="text-sm text-muted-foreground mt-2">{renderInline(e.summary, q)}</p>
                ) : null}
                {e.sections.map((s) => (
                  <section key={s.title} className="mt-4">
                    <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">
                      {s.title}
                    </h3>
                    <ul className="space-y-1.5 text-sm leading-relaxed">
                      {s.items.map((it, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-primary mt-1.5 w-1 h-1 rounded-full bg-primary shrink-0" />
                          <span>{renderInline(it, q)}</span>
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
