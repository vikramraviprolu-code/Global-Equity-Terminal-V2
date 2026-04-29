import { useEffect, useState, useRef, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { fireAction } from "@/lib/action-bus";
import { glossaryEntries, type GlossaryEntry } from "@/lib/glossary";

type Shortcut = { keys: string; label: string };
const SHORTCUTS: { group: string; items: Shortcut[] }[] = [
  {
    group: "Navigation",
    items: [
      { keys: "g s", label: "Go to Screener" },
      { keys: "g t", label: "Go to Analysis Terminal" },
      { keys: "g w", label: "Go to Watchlists" },
      { keys: "g c", label: "Go to Compare" },
      { keys: "g e", label: "Go to Events" },
      { keys: "g q", label: "Go to Data Quality" },
    ],
  },
  {
    group: "Actions",
    items: [
      { keys: "⌘ K", label: "Open AI co-pilot (or Ctrl+K)" },
      { keys: "/", label: "Focus search / ticker input" },
      { keys: "e", label: "Export / download current view" },
      { keys: "?", label: "Show this overlay" },
      { keys: "Esc", label: "Close overlay" },
    ],
  },
];

const GLOSSARY_GROUP_ORDER: Array<{ key: string; label: string }> = [
  { key: "metric", label: "Technicals" },
  { key: "fundamental", label: "Fundamentals" },
  { key: "score", label: "Scores" },
  { key: "recommendation", label: "Recommendation" },
  { key: "data", label: "Data Quality" },
  { key: "alert", label: "Alerts" },
  { key: "portfolio", label: "Portfolio" },
  { key: "market", label: "Market Structure" },
  { key: "navigation", label: "App Concepts" },
];

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  return false;
}

export function KeyboardShortcuts() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"shortcuts" | "glossary">("shortcuts");
  const [query, setQuery] = useState("");
  const gPending = useRef<number | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "Escape" && open) {
        setOpen(false);
        return;
      }

      if (isTypingTarget(e.target)) return;

      if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }

      if (e.key === "/") {
        const input = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
          'input[type="search"], input[type="text"], input:not([type])',
        );
        if (input) {
          e.preventDefault();
          input.focus();
          input.select?.();
        }
        return;
      }

      if (e.key === "e") {
        if (fireAction("export")) e.preventDefault();
        return;
      }

      if (e.key === "g") {
        if (gPending.current) window.clearTimeout(gPending.current);
        gPending.current = window.setTimeout(() => {
          gPending.current = null;
        }, 900);
        return;
      }
      if (gPending.current) {
        window.clearTimeout(gPending.current);
        gPending.current = null;
        const map: Record<string, string> = {
          s: "/",
          t: "/terminal",
          w: "/watchlist",
          c: "/compare",
          e: "/events",
          q: "/data-quality",
        };
        const dest = map[e.key.toLowerCase()];
        if (dest) {
          e.preventDefault();
          navigate({ to: dest as any });
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, navigate]);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out: Record<string, Array<{ key: string; entry: GlossaryEntry }>> = {};
    glossaryEntries().forEach(([key, entry]) => {
      if (q) {
        const hay = `${entry.term} ${entry.full ?? ""} ${entry.definition}`.toLowerCase();
        if (!hay.includes(q)) return;
      }
      (out[entry.group] ||= []).push({ key, entry });
    });
    return out;
  }, [query]);

  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Help and shortcuts"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="panel w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
          <div className="flex items-center gap-4">
            <div>
              <div className="text-xs font-mono uppercase tracking-widest text-primary">Help</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">Press <Kbd>?</Kbd> any time</div>
            </div>
            <div className="flex gap-1 ml-2">
              <TabBtn active={tab === "shortcuts"} onClick={() => setTab("shortcuts")}>Shortcuts</TabBtn>
              <TabBtn active={tab === "glossary"} onClick={() => setTab("glossary")}>Glossary</TabBtn>
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            ESC ✕
          </button>
        </div>

        <div className="overflow-y-auto pr-1">
          {tab === "shortcuts" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {SHORTCUTS.map((g) => (
                <div key={g.group}>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">{g.group}</div>
                  <ul className="space-y-1.5">
                    {g.items.map((s) => (
                      <li key={s.keys} className="flex items-center justify-between text-xs">
                        <span className="text-foreground">{s.label}</span>
                        <span className="flex gap-1">
                          {s.keys.split(" ").map((k, i) => (
                            <Kbd key={i}>{k}</Kbd>
                          ))}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-5">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search terms…"
                className="w-full bg-muted/50 border border-border rounded px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-ring"
                autoFocus
              />
              {GLOSSARY_GROUP_ORDER.map(({ key, label }) => {
                const items = grouped[key];
                if (!items || items.length === 0) return null;
                return (
                  <div key={key}>
                    <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">{label}</div>
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
                      {items.map(({ key: k, entry }) => (
                        <div key={k} className="text-xs">
                          <dt className="font-mono text-foreground">
                            {entry.term}
                            {entry.full && <span className="text-muted-foreground font-normal"> · {entry.full}</span>}
                          </dt>
                          <dd className="text-muted-foreground leading-snug mt-0.5">
                            {entry.definition}
                            {entry.hint && <span className="italic"> {entry.hint}</span>}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                );
              })}
              {Object.keys(grouped).length === 0 && (
                <div className="text-xs text-muted-foreground text-center py-6">No matches.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest rounded border ${
        active ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[1.5rem] px-1.5 py-0.5 rounded border border-border bg-muted font-mono text-[10px] text-foreground">
      {children}
    </kbd>
  );
}
