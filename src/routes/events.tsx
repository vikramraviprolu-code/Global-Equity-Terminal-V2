import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { fetchEvents, type CalendarEvent, type EventKind } from "@/server/events.functions";
import { SiteNav, Disclaimer } from "@/components/site-nav";
import { useWatchlist } from "@/hooks/use-watchlist";
import { EmptyState, EmptyStateLink, TableSkeleton } from "@/components/feedback-states";

export const Route = createFileRoute("/events")({
  head: () => ({
    meta: [
      { title: "Events Calendar — Global Equity Terminal v2" },
      { name: "description", content: "Upcoming earnings, ex-dividend, and stock-split dates across the curated global universe." },
      { property: "og:title", content: "Events Calendar — Global Equity Terminal v2" },
      { property: "og:description", content: "Upcoming earnings, ex-dividend, and stock-split dates across the curated global universe." },
    ],
    links: [{ rel: "canonical", href: "https://rankaisolutions.tech/events" }],
  }),
  component: EventsPage,
});

const REGIONS = ["US", "IN", "EU", "JP", "HK", "KR", "TW", "AU", "SG", "CN"] as const;
const KINDS: { key: EventKind; label: string; tone: string }[] = [
  { key: "earnings", label: "Earnings", tone: "text-primary border-primary/40" },
  { key: "dividend", label: "Ex-Div",   tone: "text-[color:var(--bull)] border-[color:var(--bull)]/40" },
  { key: "split",    label: "Splits",   tone: "text-[color:var(--bear)] border-[color:var(--bear)]/40" },
];

const RANGES = [
  { key: "7d",  label: "Next 7d",  days: 7 },
  { key: "30d", label: "Next 30d", days: 30 },
  { key: "90d", label: "Next 90d", days: 90 },
  { key: "all", label: "All",      days: 9999 },
] as const;
type RangeKey = (typeof RANGES)[number]["key"];

function EventsPage() {
  const navigate = useNavigate();
  const { items: watchlist, add: addWatch, remove: removeWatch } = useWatchlist();

  const [scope, setScope] = useState<"all" | "watchlist">("all");
  const [range, setRange] = useState<RangeKey>("30d");
  const [region, setRegion] = useState<string>("");
  const [kinds, setKinds] = useState<Set<EventKind>>(new Set(["earnings", "dividend", "split"]));
  const [q, setQ] = useState("");

  const wlActive = scope === "watchlist" && watchlist.length > 0;
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["events", scope, wlActive ? watchlist.join(",") : "all"],
    queryFn: () => fetchEvents({ data: wlActive ? { symbols: watchlist } : {} }),
    staleTime: 10 * 60 * 1000,
  });

  const filtered = useMemo(() => {
    const all = data?.events ?? [];
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    const maxDays = RANGES.find((r) => r.key === range)?.days ?? 30;
    const cutoff = new Date(today); cutoff.setUTCDate(cutoff.getUTCDate() + maxDays);
    const ql = q.trim().toLowerCase();
    return all.filter((e) => {
      if (!kinds.has(e.kind)) return false;
      if (region && e.region !== region) return false;
      const ed = new Date(e.date);
      if (ed < today || ed > cutoff) return false;
      if (ql && !(e.symbol.toLowerCase().includes(ql) || e.name.toLowerCase().includes(ql))) return false;
      return true;
    });
  }, [data, range, region, kinds, q]);

  const groups = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>();
    for (const e of filtered) {
      if (!m.has(e.date)) m.set(e.date, []);
      m.get(e.date)!.push(e);
    }
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const counts = useMemo(() => {
    const c: Record<EventKind, number> = { earnings: 0, dividend: 0, split: 0 };
    for (const e of filtered) c[e.kind]++;
    return c;
  }, [filtered]);

  const toggleKind = (k: EventKind) => {
    const n = new Set(kinds);
    if (n.has(k)) n.delete(k); else n.add(k);
    setKinds(n);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <SiteNav />
      <main className="flex-1 max-w-[1400px] mx-auto px-4 py-6 w-full">
        <div className="flex items-baseline justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Events Calendar</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Upcoming earnings, ex-dividend, and stock-split dates from the curated universe.
            </p>
          </div>
          <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
            {data?.meta && (
              <span>
                {data.meta.eventCount} events · {data.meta.succeeded} symbols ·{" "}
                {new Date(data.meta.retrievedAt).toLocaleString()}{" "}
                {isFetching && <span className="text-primary animate-pulse">· refreshing</span>}
              </span>
            )}
          </div>
        </div>

        {/* Filter bar */}
        <div className="panel mt-4 p-3 flex flex-wrap items-center gap-2 text-xs font-mono">
          <Seg
            options={[
              { k: "all", label: "All Universe" },
              { k: "watchlist", label: `Watchlist (${watchlist.length})` },
            ]}
            value={scope}
            onChange={(v) => setScope(v as "all" | "watchlist")}
          />
          <Divider />
          <Seg
            options={RANGES.map((r) => ({ k: r.key, label: r.label }))}
            value={range}
            onChange={(v) => setRange(v as RangeKey)}
          />
          <Divider />
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="bg-background border border-border rounded px-2 py-1 text-xs font-mono"
          >
            <option value="">All regions</option>
            {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <input
            type="search"
            placeholder="Search ticker / name…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="bg-background border border-border rounded px-2 py-1 text-xs font-mono w-44"
          />
          <Divider />
          {KINDS.map((k) => {
            const on = kinds.has(k.key);
            return (
              <button
                key={k.key}
                onClick={() => toggleKind(k.key)}
                className={`px-2 py-1 rounded border uppercase tracking-wider text-[10px] ${
                  on ? k.tone : "border-border text-muted-foreground/60 line-through"
                }`}
              >
                {k.label} · {counts[k.key]}
              </button>
            );
          })}
          <div className="ml-auto">
            <button
              onClick={() => refetch()}
              className="px-2 py-1 border border-border rounded text-muted-foreground hover:text-primary hover:border-primary/40 uppercase tracking-wider text-[10px]"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* States */}
        {isLoading && (
          <div className="panel mt-4"><TableSkeleton columns={5} rows={6} /></div>
        )}
        {isError && (
          <div className="panel p-6 mt-4 text-center text-xs">
            <div className="text-[color:var(--bear)] font-mono uppercase tracking-wider">Failed to load events</div>
            <button onClick={() => refetch()} className="mt-2 px-3 py-1 border border-primary/40 text-primary rounded font-mono text-[10px]">
              Retry
            </button>
          </div>
        )}
        {!isLoading && !isError && wlActive && watchlist.length === 0 && (
          <EmptyWatchlist />
        )}
        {!isLoading && !isError && groups.length === 0 && !(wlActive && watchlist.length === 0) && (
          <div className="panel mt-4">
            <EmptyState
              title="No events in this window"
              description="Try widening the date range or enabling more event types (earnings, ex-dividend, splits)."
            />
          </div>
        )}

        {/* Grouped event list */}
        {!isLoading && !isError && groups.length > 0 && (
          <div className="mt-4 space-y-3">
            {groups.map(([date, evs]) => (
              <DayGroup
                key={date}
                date={date}
                events={evs}
                watchlist={watchlist}
                onAdd={(s) => addWatch([s])}
                onRemove={removeWatch}
                onOpen={(s) => navigate({ to: "/terminal/$symbol", params: { symbol: s } })}
              />
            ))}
          </div>
        )}

        <Disclaimer />
      </main>
    </div>
  );
}

function Seg<T extends string>({ options, value, onChange }: {
  options: { k: T; label: string }[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex border border-border rounded overflow-hidden">
      {options.map((o) => (
        <button
          key={o.k}
          onClick={() => onChange(o.k)}
          className={`px-2.5 py-1 uppercase tracking-wider text-[10px] ${
            value === o.k ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-primary"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Divider() {
  return <span className="h-4 w-px bg-border" />;
}

function relativeDay(date: string): string {
  const d = new Date(date); d.setUTCHours(0, 0, 0, 0);
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff < 7) return `In ${diff} days`;
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function DayGroup({ date, events, watchlist, onAdd, onRemove, onOpen }: {
  date: string;
  events: CalendarEvent[];
  watchlist: string[];
  onAdd: (s: string) => void;
  onRemove: (s: string) => void;
  onOpen: (s: string) => void;
}) {
  const d = new Date(date);
  const long = d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  return (
    <div className="panel">
      <div className="panel-header flex items-center justify-between">
        <span>{long}</span>
        <span className="text-[10px] text-muted-foreground font-mono">
          {relativeDay(date)} · {events.length} {events.length === 1 ? "event" : "events"}
        </span>
      </div>
      <div className="divide-y divide-border">
        {events.map((e, i) => {
          const inWl = watchlist.includes(e.symbol);
          const tone =
            e.kind === "earnings" ? "text-primary"
            : e.kind === "dividend" ? "text-[color:var(--bull)]"
            : "text-[color:var(--bear)]";
          return (
            <div
              key={`${e.symbol}-${e.kind}-${i}`}
              className="px-3 py-2 flex items-center gap-3 hover:bg-primary/5 cursor-pointer"
              onClick={() => onOpen(e.symbol)}
            >
              <span className={`font-mono text-[10px] uppercase tracking-wider w-20 ${tone}`}>{e.label}</span>
              <span className="font-mono text-primary text-sm w-20">{e.symbol}</span>
              <span className="text-sm truncate flex-1" title={e.name}>{e.name}</span>
              <span className="text-[10px] text-muted-foreground font-mono w-12 text-right">{e.region}</span>
              <span className="text-[10px] text-muted-foreground hidden md:inline truncate max-w-[160px]" title={e.sector}>
                {e.sector}
              </span>
              {e.detail && (
                <span className="text-[10px] font-mono text-muted-foreground hidden lg:inline">{e.detail}</span>
              )}
              <button
                onClick={(ev) => { ev.stopPropagation(); inWl ? onRemove(e.symbol) : onAdd(e.symbol); }}
                className={`font-mono text-[10px] px-2 py-1 rounded border ${
                  inWl
                    ? "border-[color:var(--bull)]/50 text-[color:var(--bull)]"
                    : "border-border text-muted-foreground hover:text-primary hover:border-primary/40"
                }`}
              >
                {inWl ? "★" : "+ Watch"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EmptyWatchlist() {
  return (
    <div className="panel mt-4">
      <EmptyState
        title="Your watchlist is empty"
        description="Add tickers from the Screener or any Terminal page to track upcoming earnings, ex-dividend dates, and splits."
        action={<EmptyStateLink to="/app">Open Screener</EmptyStateLink>}
      />
    </div>
  );
}
