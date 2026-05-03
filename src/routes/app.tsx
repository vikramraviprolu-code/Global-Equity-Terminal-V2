import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Fragment, useMemo, useState, useEffect } from "react";
import { z } from "zod";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { fetchUniverse } from "@/server/screen.functions";
import { scoreAll, scoreRow, type ScoredRow } from "@/lib/scores";
import { fmtNum, fmtPct, fmtMcapUsd, fmtPriceDisplay, fmtVol, colorFor } from "@/lib/format";
import { useDisplayCurrency } from "@/hooks/use-display-currency";
import { useWatchlist } from "@/hooks/use-watchlist";
import { SiteNav } from "@/components/site-nav";
import { SectorHeatmap } from "@/components/sector-heatmap";
import { exportRowsCsv, exportNodeAsPng } from "@/lib/export";
import { Sparkline as SparkLineShared } from "@/components/sparkline";
import { TableSkeleton, EmptyState as SharedEmptyState } from "@/components/feedback-states";
import { onAction } from "@/lib/action-bus";
import { useRef } from "react";
import { ProviderBadge } from "@/components/provider-badge";
import { MetricLabel } from "@/components/metric-label";

const SORTABLE_KEYS = ["symbol", "name", "sector", "price", "marketCapUsd", "pe", "pb", "dividendYield", "pctFromLow", "perf5d", "rsi14", "value", "momentum", "quality", "risk", "confidence"] as const;
type SortKey = (typeof SORTABLE_KEYS)[number];

const MA_CROSS_OPTIONS = ["any", "golden", "death", "above50", "above200"] as const;
type MaCross = (typeof MA_CROSS_OPTIONS)[number];

const searchSchema = z.object({
  preset: fallback(z.enum(["all", "valueLow", "momentum", "quality", "oversold", "breakout", "reliable"]), "all").default("all"),
  region: fallback(z.string(), "").default(""),
  sector: fallback(z.string(), "").default(""),
  q: fallback(z.string(), "").default(""),
  minMcap: fallback(z.number(), 0).default(0),
  minPrice: fallback(z.number(), 0).default(0),
  minVolume: fallback(z.number(), 0).default(0),
  peMax: fallback(z.number().nullable(), null).default(null),
  pbMax: fallback(z.number().nullable(), null).default(null),
  dyMin: fallback(z.number().nullable(), null).default(null),
  rsiMin: fallback(z.number(), 0).default(0),
  rsiMax: fallback(z.number(), 100).default(100),
  near52wLowPct: fallback(z.number().nullable(), null).default(null),
  rocMin: fallback(z.number().nullable(), null).default(null),
  maCross: fallback(z.enum(MA_CROSS_OPTIONS), "any").default("any"),
  minConfidence: fallback(z.number(), 0).default(0),
  excludeMock: fallback(z.boolean(), false).default(false),
  sortBy: fallback(z.enum(SORTABLE_KEYS), "marketCapUsd").default("marketCapUsd"),
  sortDir: fallback(z.enum(["asc", "desc"]), "desc").default("desc"),
  page: fallback(z.number().int().min(1), 1).default(1),
  pageSize: fallback(z.number().int().min(10).max(200), 50).default(50),
  view: fallback(z.enum(["table", "chart", "heatmap"]), "table").default("table"),
  heatMetric: fallback(z.enum(["perf5d", "roc14", "rsi14", "value", "momentum", "quality"]), "perf5d").default("perf5d"),
});

type Filters = z.infer<typeof searchSchema>;

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [
      { title: "Screener — Global Equity Terminal" },
      { name: "description", content: "Screen, score and analyse stocks across US, India, Europe, Japan, Hong Kong, Korea, Taiwan, Singapore and Australia with transparent Value / Momentum / Quality / Risk scoring." },
      { property: "og:title", content: "Screener — Global Equity Terminal" },
      { property: "og:description", content: "Run value, momentum, quality and breakout screens on a curated global universe." },
    ],
    links: [{ rel: "canonical", href: "https://rankaisolutions.tech/app" }],
  }),
  validateSearch: zodValidator(searchSchema),
  loader: ({ context }) => {
    context.queryClient.prefetchQuery({
      queryKey: ["universe"],
      queryFn: () => fetchUniverse({ data: {} }),
      staleTime: 5 * 60 * 1000,
    });
  },
  component: ScreenerPage,
});

// ---------------- presets ----------------
type PresetId = Filters["preset"];
const PRESETS: { id: PresetId; label: string; desc: string }[] = [
  { id: "all", label: "All Stocks", desc: "Entire curated universe with no extra filters" },
  { id: "valueLow", label: "Value Near Lows", desc: "P/E ≤ 10, within 10% of 52W low, large cap, medium+ confidence" },
  { id: "momentum", label: "Momentum Leaders", desc: "Positive 5D, ROC14 & ROC21 positive, RSI 40–70, above 20D & 50D MA" },
  { id: "quality", label: "Quality Large Caps", desc: "Mcap ≥ $10B USD, positive earnings, medium+ confidence" },
  { id: "oversold", label: "Oversold Watchlist", desc: "RSI < 35 and within 20% of 52W low" },
  { id: "breakout", label: "Breakout Candidates", desc: "Above 20D & 50D MA, ROC14 positive, near 52W high" },
  { id: "reliable", label: "Data Reliable Only", desc: "High data confidence (≥85)" },
];

const DEFAULT_FILTERS: Filters = searchSchema.parse({});

function applyPreset(p: PresetId): Filters {
  const base: Filters = { ...DEFAULT_FILTERS, preset: p };
  switch (p) {
    case "valueLow": return { ...base, peMax: 15, near52wLowPct: 20, minMcap: 1e9, minConfidence: 50 };
    case "momentum": return { ...base, rsiMin: 40, rsiMax: 75, rocMin: 0, maCross: "above50" };
    case "quality":  return { ...base, minMcap: 5e9, minConfidence: 50 };
    case "oversold": return { ...base, rsiMin: 0, rsiMax: 40, near52wLowPct: 25 };
    case "breakout": return { ...base, rsiMin: 50, rsiMax: 80, maCross: "above50", rocMin: 0 };
    case "reliable": return { ...base, minConfidence: 85, excludeMock: true };
    default:         return base;
  }
}

function passes(r: ScoredRow, f: Filters): boolean {
  if (f.region && r.region !== f.region) return false;
  if (f.sector && r.sector !== f.sector) return false;
  if (f.q) {
    const q = f.q.toLowerCase();
    if (!r.symbol.toLowerCase().includes(q) && !r.name.toLowerCase().includes(q)) return false;
  }
  if (f.minMcap > 0 && (r.marketCapUsd ?? 0) < f.minMcap) return false;
  if (f.minPrice > 0 && (r.price ?? 0) < f.minPrice) return false;
  if (f.minVolume > 0 && (r.avgVolume ?? 0) < f.minVolume) return false;
  if (f.peMax != null && (r.pe == null || r.pe <= 0 || r.pe > f.peMax)) return false;
  if (f.pbMax != null && (r.pb == null || r.pb <= 0 || r.pb > f.pbMax)) return false;
  if (f.dyMin != null && (r.dividendYield == null || r.dividendYield < f.dyMin)) return false;
  if (r.rsi14 != null && (r.rsi14 < f.rsiMin || r.rsi14 > f.rsiMax)) return false;
  if (f.near52wLowPct != null && (r.pctFromLow == null || r.pctFromLow > f.near52wLowPct)) return false;
  if (f.rocMin != null) {
    if ((r.roc14 ?? -Infinity) < f.rocMin && (r.roc21 ?? -Infinity) < f.rocMin) return false;
  }
  if (f.maCross !== "any") {
    const { ma50, ma200, price } = r;
    if (f.maCross === "golden" && !(ma50 != null && ma200 != null && ma50 > ma200)) return false;
    if (f.maCross === "death" && !(ma50 != null && ma200 != null && ma50 < ma200)) return false;
    if (f.maCross === "above50" && !(price != null && r.ma50 != null && price > r.ma50)) return false;
    if (f.maCross === "above200" && !(price != null && ma200 != null && price > ma200)) return false;
  }
  if (f.minConfidence > 0 && r.scores.confidence < f.minConfidence) return false;
  if (f.excludeMock && r.isMock) return false;

  // preset-specific extras the simple filters don't capture
  switch (f.preset) {
    case "momentum":
      if ((r.perf5d ?? 0) <= 0 || (r.roc14 ?? 0) <= 0 || (r.roc21 ?? 0) <= 0) return false;
      if (!(r.price && r.ma20 && r.price > r.ma20)) return false;
      if (!(r.price && r.ma50 && r.price > r.ma50)) return false;
      break;
    case "quality":
      if (r.pe == null || r.pe <= 0) return false;
      break;
    case "breakout":
      if (!(r.price && r.ma20 && r.price > r.ma20)) return false;
      if (!(r.price && r.ma50 && r.price > r.ma50)) return false;
      if ((r.roc14 ?? 0) <= 0 || (r.perf5d ?? 0) <= 0) return false;
      if ((r.pctFromHigh ?? -100) < -15) return false;
      break;
  }
  return true;
}

// ---------------- column visibility ----------------
const ALL_COLUMNS = [
  { key: "symbol", label: "Ticker", default: true },
  { key: "name", label: "Company", default: true },
  { key: "region", label: "Region", default: true },
  { key: "sector", label: "Sector", default: true },
  { key: "price", label: "Price", default: true },
  { key: "marketCapUsd", label: "Mcap (USD)", default: true },
  { key: "pe", label: "P/E", default: true },
  { key: "pb", label: "P/B", default: false },
  { key: "dividendYield", label: "Div Yield %", default: false },
  { key: "pctFromLow", label: "From 52W Low", default: true },
  { key: "perf5d", label: "5D %", default: true },
  { key: "rsi14", label: "RSI", default: true },
  { key: "value", label: "Value", default: true },
  { key: "momentum", label: "Mom", default: true },
  { key: "quality", label: "Qual", default: true },
  { key: "risk", label: "Risk", default: true },
  { key: "confidence", label: "Conf", default: true },
] as const;
type ColumnKey = (typeof ALL_COLUMNS)[number]["key"];
const COL_STORAGE = "screener.columns.v2";

function loadCols(): Set<ColumnKey> {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(COL_STORAGE) : null;
    if (raw) return new Set(JSON.parse(raw));
  } catch {}
  return new Set(ALL_COLUMNS.filter((c) => c.default).map((c) => c.key));
}
function saveCols(s: Set<ColumnKey>) {
  try { localStorage.setItem(COL_STORAGE, JSON.stringify([...s])); } catch {}
}

// ---------------- COMPONENT ----------------
function ScreenerPage() {
  const navigate = useNavigate();
  const filters = Route.useSearch();
  const { items: watchlist, add: addWatch, remove: removeWatch } = useWatchlist();

  const setFilters = (next: Partial<Filters>) =>
    navigate({ to: "/app", search: ((prev: Filters) => ({ ...prev, ...next, page: next.page ?? 1 })) as any });
  const replaceFilters = (next: Filters) =>
    navigate({ to: "/app", search: { ...next, page: 1 } });

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [columns, setColumns] = useState<Set<ColumnKey>>(() => loadCols());
  const [colMenuOpen, setColMenuOpen] = useState(false);
  const snapshotRef = useRef<HTMLDivElement>(null);
  const toggleCol = (k: ColumnKey) => {
    const next = new Set(columns);
    if (next.has(k)) next.delete(k); else next.add(k);
    setColumns(next); saveCols(next);
  };

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["universe"],
    queryFn: () => fetchUniverse({ data: {} }),
    staleTime: 5 * 60 * 1000,
  });

  const scored = useMemo(() => (data?.rows ? scoreAll(data.rows) : []), [data]);
  const filtered = useMemo(() => scored.filter((r) => passes(r, filters)), [scored, filters]);
  const sorted = useMemo(() => {
    const arr = [...filtered];
    const key = filters.sortBy;
    arr.sort((a, b) => {
      const av = key in a.scores ? (a.scores as any)[key] : (a as any)[key];
      const bv = key in b.scores ? (b.scores as any)[key] : (b as any)[key];
      const an = av == null ? -Infinity : av;
      const bn = bv == null ? -Infinity : bv;
      if (typeof an === "string" || typeof bn === "string") {
        return filters.sortDir === "asc" ? String(an).localeCompare(String(bn)) : String(bn).localeCompare(String(an));
      }
      return filters.sortDir === "asc" ? an - bn : bn - an;
    });
    return arr;
  }, [filtered, filters.sortBy, filters.sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / filters.pageSize));
  const page = Math.min(filters.page, totalPages);
  const pageStart = (page - 1) * filters.pageSize;
  const pageRows = sorted.slice(pageStart, pageStart + filters.pageSize);

  const toggleSort = (k: SortKey) => {
    if (filters.sortBy === k) setFilters({ sortDir: filters.sortDir === "asc" ? "desc" : "asc" });
    else setFilters({ sortBy: k, sortDir: "desc" });
  };

  const toggleSelect = (sym: string) => {
    const next = new Set(selected);
    if (next.has(sym)) next.delete(sym); else next.add(sym);
    setSelected(next);
  };
  const toggleExpand = (sym: string) => {
    const next = new Set(expanded);
    if (next.has(sym)) next.delete(sym); else next.add(sym);
    setExpanded(next);
  };

  const onPickPreset = (p: PresetId) => replaceFilters(applyPreset(p));

  const sectors = useMemo(() => Array.from(new Set(scored.map((r) => r.sector))).sort(), [scored]);

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => { setHydrated(true); }, []);

  // Press "e" to export current filtered results as CSV
  useEffect(() => {
    return onAction("export", () => {
      if (sorted.length === 0) return;
      exportRowsCsv(sorted, `screener-${filters.preset}-${new Date().toISOString().slice(0,10)}.csv`);
    });
  }, [sorted, filters.preset]);

  return (
    <div className="min-h-screen flex flex-col">
      <SiteNav right={<button onClick={() => refetch()} disabled={isFetching} className="bg-primary text-primary-foreground px-3 py-1.5 rounded hover:opacity-90 disabled:opacity-50">{isFetching ? "Refreshing…" : "Refresh"}</button>} />
      <main className="flex-1">
        <ScreenerIntro meta={data?.meta} isLoading={isLoading} />
        {/* Render FilterBar only after mount to avoid hydration mismatches caused by
            browser extensions that rewrite native <select> elements (e.g. form-styling
            extensions injecting bb-customSelect containers). */}
        {hydrated ? (
          <FilterBar filters={filters} setFilters={setFilters} sectors={sectors} onReset={() => replaceFilters(DEFAULT_FILTERS)} />
        ) : (
          <div className="border-b border-border bg-card/30">
            <div className="max-w-[1400px] mx-auto px-4 py-3 h-[58px]" />
          </div>
        )}
        <PresetBar current={filters.preset} onPick={onPickPreset} />

        <div className="max-w-[1400px] mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-border">
          <div className="text-xs font-mono text-muted-foreground">
            <span className="text-foreground">{sorted.length}</span> of <span className="text-foreground">{scored.length}</span> stocks ·
            <span className="ml-2">Mock: <span className="text-primary">{data?.meta?.mockCount ?? 0}</span></span> ·
            <span className="ml-2">Live: <span className="text-[color:var(--bull)]">{data?.meta?.liveCount ?? 0}</span></span>
            {sorted.length > 0 && (
              <span className="ml-2">· Page <span className="text-foreground">{page}</span>/{totalPages}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {selected.size > 0 && (
              <button
                onClick={() => { addWatch([...selected]); setSelected(new Set()); }}
                className="font-mono text-[10px] uppercase tracking-wider border border-primary/50 text-primary px-3 py-1.5 rounded hover:bg-primary/10"
              >
                + Add {selected.size} to watchlist
              </button>
            )}
            <button
              onClick={() => exportRowsCsv(sorted, `screener-${filters.preset}-${new Date().toISOString().slice(0,10)}.csv`)}
              disabled={sorted.length === 0}
              className="font-mono text-[10px] uppercase tracking-wider border border-border px-3 py-1.5 rounded text-muted-foreground hover:text-foreground hover:border-primary/40 disabled:opacity-40"
              title="Export current filtered results as CSV"
            >
              ⇩ CSV ({sorted.length})
            </button>
            <button
              onClick={() => { if (snapshotRef.current) exportNodeAsPng(snapshotRef.current, `screener-${filters.view}-${Date.now()}.png`); }}
              disabled={sorted.length === 0}
              className="font-mono text-[10px] uppercase tracking-wider border border-border px-3 py-1.5 rounded text-muted-foreground hover:text-foreground hover:border-primary/40 disabled:opacity-40"
              title="Snapshot current view as PNG"
            >
              ⇩ PNG
            </button>
            {filters.view === "table" && (
              <ColumnMenu open={colMenuOpen} setOpen={setColMenuOpen} columns={columns} toggleCol={toggleCol} />
            )}
            <ViewToggle view={filters.view} setView={(v) => setFilters({ view: v })} />
          </div>
        </div>

        <div className="max-w-[1400px] mx-auto px-4 py-4">
          {isLoading && <LoadingState />}
          {isError && <ErrorState onRetry={refetch} />}
          {!isLoading && !isError && sorted.length === 0 && <EmptyState onReset={() => replaceFilters(DEFAULT_FILTERS)} />}
          {!isLoading && !isError && sorted.length > 0 && (
            <div ref={snapshotRef}>
              {filters.view === "table" && (
                <>
                  <ResultsTable
                    rows={pageRows} columns={columns}
                    sortBy={filters.sortBy} sortDir={filters.sortDir} onSort={toggleSort}
                    selected={selected} toggleSelect={toggleSelect}
                    expanded={expanded} toggleExpand={toggleExpand}
                    watchlist={watchlist} onAddOne={(s) => addWatch([s])} onRemoveOne={removeWatch}
                    onOpen={(s) => navigate({ to: "/terminal/$symbol", params: { symbol: s } })}
                  />
                  <Pager page={page} totalPages={totalPages} pageSize={filters.pageSize} total={sorted.length}
                    onPage={(p) => setFilters({ page: p })} onPageSize={(s) => setFilters({ pageSize: s, page: 1 })} />
                </>
              )}
              {filters.view === "chart" && (
                <>
                  <ResultsCards
                    rows={pageRows}
                    watchlist={watchlist} onAddOne={(s) => addWatch([s])} onRemoveOne={removeWatch}
                    onOpen={(s) => navigate({ to: "/terminal/$symbol", params: { symbol: s } })}
                  />
                  <Pager page={page} totalPages={totalPages} pageSize={filters.pageSize} total={sorted.length}
                    onPage={(p) => setFilters({ page: p })} onPageSize={(s) => setFilters({ pageSize: s, page: 1 })} />
                </>
              )}
              {filters.view === "heatmap" && (
                <SectorHeatmap rows={sorted} metric={filters.heatMetric} onMetric={(m) => setFilters({ heatMetric: m })} />
              )}
            </div>
          )}
        </div>

        <Disclaimer />
      </main>
      <Footer />
    </div>
  );
}



function PresetBar({ current, onPick }: { current: PresetId; onPick: (p: PresetId) => void }) {
  return (
    <div className="border-b border-border bg-background">
      <div className="max-w-[1400px] mx-auto px-4 py-3 overflow-x-auto">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mr-1">Presets:</span>
          {PRESETS.map((p) => (
            <button
              key={p.id} onClick={() => onPick(p.id)} title={p.desc}
              className={`whitespace-nowrap font-mono text-[11px] uppercase tracking-wider px-3 py-1.5 rounded border transition-colors ${
                current === p.id
                  ? "border-primary text-primary bg-primary/10"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function FilterBar({ filters, setFilters, sectors, onReset }: {
  filters: Filters; setFilters: (next: Partial<Filters>) => void; sectors: string[]; onReset: () => void;
}) {
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setFilters({ [k]: v } as Partial<Filters>);
  return (
    <div className="border-b border-border bg-card/30">
      <div className="max-w-[1400px] mx-auto px-4 py-3 flex flex-wrap items-end gap-3">
        <Field label="Search">
          <input value={filters.q} onChange={(e) => set("q", e.target.value)} placeholder="Ticker or company"
            className="bg-input border border-border rounded px-2 py-1 text-xs font-mono w-44 focus:border-primary outline-none" />
        </Field>
        <Field label="Region">
          <select value={filters.region} onChange={(e) => set("region", e.target.value)}
            className="bg-input border border-border rounded px-2 py-1 text-xs font-mono w-28 focus:border-primary outline-none">
            <option value="">All</option>
            {["US", "IN", "EU", "JP", "HK", "KR", "TW", "AU", "SG", "CN"].map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>
        <Field label="Sector">
          <select value={filters.sector} onChange={(e) => set("sector", e.target.value)}
            className="bg-input border border-border rounded px-2 py-1 text-xs font-mono w-44 focus:border-primary outline-none">
            <option value="">All</option>
            {sectors.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Min Mcap (USD)">
          <select value={filters.minMcap} onChange={(e) => set("minMcap", Number(e.target.value))}
            className="bg-input border border-border rounded px-2 py-1 text-xs font-mono w-28 focus:border-primary outline-none">
            <option value={0}>Any</option>
            <option value={2e9}>$2B+</option>
            <option value={10e9}>$10B+</option>
            <option value={50e9}>$50B+</option>
            <option value={2e11}>$200B+</option>
          </select>
        </Field>
        <Field label="P/E max">
          <input type="number" value={filters.peMax ?? ""} onChange={(e) => set("peMax", e.target.value === "" ? null : Number(e.target.value))} placeholder="—"
            className="bg-input border border-border rounded px-2 py-1 text-xs font-mono w-20 focus:border-primary outline-none" />
        </Field>
        <Field label="P/B max">
          <input type="number" step="0.1" value={filters.pbMax ?? ""} onChange={(e) => set("pbMax", e.target.value === "" ? null : Number(e.target.value))} placeholder="—"
            className="bg-input border border-border rounded px-2 py-1 text-xs font-mono w-20 focus:border-primary outline-none" />
        </Field>
        <Field label="Div Yield ≥ %">
          <input type="number" step="0.1" value={filters.dyMin ?? ""} onChange={(e) => set("dyMin", e.target.value === "" ? null : Number(e.target.value))} placeholder="—"
            className="bg-input border border-border rounded px-2 py-1 text-xs font-mono w-20 focus:border-primary outline-none" />
        </Field>
        <Field label={`RSI ${filters.rsiMin}-${filters.rsiMax}`}>
          <div className="flex items-center gap-1">
            <input type="number" min={0} max={100} value={filters.rsiMin} onChange={(e) => set("rsiMin", Math.max(0, Math.min(100, Number(e.target.value))))}
              className="bg-input border border-border rounded px-2 py-1 text-xs font-mono w-14 focus:border-primary outline-none" />
            <span className="text-muted-foreground text-xs">–</span>
            <input type="number" min={0} max={100} value={filters.rsiMax} onChange={(e) => set("rsiMax", Math.max(0, Math.min(100, Number(e.target.value))))}
              className="bg-input border border-border rounded px-2 py-1 text-xs font-mono w-14 focus:border-primary outline-none" />
          </div>
        </Field>
        <Field label="ROC min %">
          <input type="number" value={filters.rocMin ?? ""} onChange={(e) => set("rocMin", e.target.value === "" ? null : Number(e.target.value))} placeholder="—"
            className="bg-input border border-border rounded px-2 py-1 text-xs font-mono w-20 focus:border-primary outline-none" />
        </Field>
        <Field label="MA cross">
          <select value={filters.maCross} onChange={(e) => set("maCross", e.target.value as MaCross)}
            className="bg-input border border-border rounded px-2 py-1 text-xs font-mono w-32 focus:border-primary outline-none">
            <option value="any">Any</option>
            <option value="golden">Golden (50&gt;200)</option>
            <option value="death">Death (50&lt;200)</option>
            <option value="above50">Price &gt; 50D</option>
            <option value="above200">Price &gt; 200D</option>
          </select>
        </Field>
        <Field label="≤ % from 52W low">
          <input type="number" value={filters.near52wLowPct ?? ""} onChange={(e) => set("near52wLowPct", e.target.value === "" ? null : Number(e.target.value))} placeholder="—"
            className="bg-input border border-border rounded px-2 py-1 text-xs font-mono w-20 focus:border-primary outline-none" />
        </Field>
        <Field label="Min confidence">
          <select value={filters.minConfidence} onChange={(e) => set("minConfidence", Number(e.target.value))}
            className="bg-input border border-border rounded px-2 py-1 text-xs font-mono w-24 focus:border-primary outline-none">
            <option value={0}>Any</option>
            <option value={60}>Med+</option>
            <option value={85}>High</option>
          </select>
        </Field>
        <label className="flex items-center gap-2 text-xs font-mono text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={filters.excludeMock} onChange={(e) => set("excludeMock", e.target.checked)} />
          Exclude mock
        </label>
        <button onClick={onReset}
          className="ml-auto font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground border border-border px-3 py-1.5 rounded">
          Reset
        </button>
      </div>
    </div>
  );
}

function ColumnMenu({ open, setOpen, columns, toggleCol }: {
  open: boolean; setOpen: (b: boolean) => void; columns: Set<ColumnKey>; toggleCol: (k: ColumnKey) => void;
}) {
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}
        className="font-mono text-[10px] uppercase tracking-wider border border-border px-3 py-1.5 rounded hover:text-foreground text-muted-foreground">
        Columns ({columns.size})
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 z-20 panel p-2 w-56 max-h-80 overflow-y-auto">
            {ALL_COLUMNS.map((c) => (
              <label key={c.key} className="flex items-center gap-2 px-2 py-1 text-xs hover:bg-primary/5 cursor-pointer rounded">
                <input type="checkbox" checked={columns.has(c.key)} onChange={() => toggleCol(c.key)} />
                <span>{c.label}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Pager({ page, totalPages, pageSize, total, onPage, onPageSize }: {
  page: number; totalPages: number; pageSize: number; total: number;
  onPage: (p: number) => void; onPageSize: (s: number) => void;
}) {
  if (total === 0) return null;
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 px-1 text-xs font-mono text-muted-foreground">
      <div>Showing <span className="text-foreground">{(page - 1) * pageSize + 1}</span>–<span className="text-foreground">{Math.min(page * pageSize, total)}</span> of <span className="text-foreground">{total}</span></div>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1">
          <span>Per page</span>
          <select value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))}
            className="bg-input border border-border rounded px-2 py-1 focus:border-primary outline-none">
            {[25, 50, 100, 200].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <button disabled={page <= 1} onClick={() => onPage(1)} className="border border-border px-2 py-1 rounded disabled:opacity-30 hover:text-foreground">«</button>
        <button disabled={page <= 1} onClick={() => onPage(page - 1)} className="border border-border px-2 py-1 rounded disabled:opacity-30 hover:text-foreground">‹ Prev</button>
        <span className="text-foreground">{page} / {totalPages}</span>
        <button disabled={page >= totalPages} onClick={() => onPage(page + 1)} className="border border-border px-2 py-1 rounded disabled:opacity-30 hover:text-foreground">Next ›</button>
        <button disabled={page >= totalPages} onClick={() => onPage(totalPages)} className="border border-border px-2 py-1 rounded disabled:opacity-30 hover:text-foreground">»</button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function ViewToggle({ view, setView }: { view: "table" | "chart" | "heatmap"; setView: (v: "table" | "chart" | "heatmap") => void }) {
  return (
    <div className="flex border border-border rounded overflow-hidden">
      {(["table", "chart", "heatmap"] as const).map((v) => (
        <button key={v} onClick={() => setView(v)}
          className={`font-mono text-[10px] uppercase tracking-wider px-3 py-1.5 ${view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          {v}
        </button>
      ))}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="panel">
      <div className="px-4 pt-4 text-[10px] font-mono uppercase tracking-wider text-primary animate-pulse">
        Syncing universe… ~150 tickers across global markets, can take 15–30s on first load.
      </div>
      <TableSkeleton columns={9} rows={10} />
    </div>
  );
}
function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="panel p-10 text-center border-destructive/50">
      <div className="font-mono text-sm text-destructive">FAILED TO LOAD UNIVERSE</div>
      <button onClick={onRetry} className="mt-4 font-mono text-xs border border-border px-4 py-2 rounded hover:bg-muted">Retry</button>
    </div>
  );
}
function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="panel">
      <SharedEmptyState
        title="No stocks match your filters"
        description="Your current combination of region, sector, market-cap, valuation and momentum filters returned zero results. Loosen any of them to see more matches."
        action={
          <button onClick={onReset} className="font-mono text-[10px] uppercase tracking-wider border border-primary/50 text-primary px-4 py-2 rounded hover:bg-primary/10">
            Reset filters
          </button>
        }
      />
    </div>
  );
}

// ---------------- table view ----------------
function ResultsTable({ rows, columns, sortBy, sortDir, onSort, selected, toggleSelect, expanded, toggleExpand, watchlist, onAddOne, onRemoveOne, onOpen }: {
  rows: ScoredRow[];
  columns: Set<ColumnKey>;
  sortBy: any; sortDir: "asc" | "desc"; onSort: (k: any) => void;
  selected: Set<string>; toggleSelect: (s: string) => void;
  expanded: Set<string>; toggleExpand: (s: string) => void;
  watchlist: string[]; onAddOne: (s: string) => void; onRemoveOne: (s: string) => void;
  onOpen: (s: string) => void;
}) {
  const has = (k: ColumnKey) => columns.has(k);
  const [ccyMode] = useDisplayCurrency();
  const Th = ({ k, label, num, colKey, term }: { k: string; label: string; num?: boolean; colKey?: ColumnKey; term?: Parameters<typeof MetricLabel>[0]["term"] }) => {
    if (colKey && !has(colKey)) return null;
    const content = term ? <MetricLabel term={term} asChild>{label}</MetricLabel> : label;
    return (
      <th className={num ? "text-right" : "text-left"}>
        <button onClick={() => onSort(k)} className="font-medium hover:text-primary inline-flex items-center gap-1">
          {content}
          {sortBy === k && <span className="text-primary">{sortDir === "asc" ? "▲" : "▼"}</span>}
        </button>
      </th>
    );
  };
  // count visible columns for expanded-row colspan
  const visibleCount = 3 /* checkbox + expand + watch */ + 1 /* trend sparkline */ + ALL_COLUMNS.filter((c) => has(c.key)).length;
  return (
    <div className="panel overflow-x-auto">
      <table className="term">
        <thead>
          <tr>
            <th></th>
            <th></th>
            <Th k="symbol" label="Ticker" colKey="symbol" />
            <Th k="name" label="Company" colKey="name" />
            {has("region") && <th>Region</th>}
            <Th k="sector" label="Sector" colKey="sector" term="sector" />
            <Th k="price" label="Price" num colKey="price" />
            <Th k="marketCapUsd" label="Mcap (USD)" num colKey="marketCapUsd" term="marketCap" />
            <Th k="pe" label="P/E" num colKey="pe" term="peRatio" />
            <Th k="pb" label="P/B" num colKey="pb" term="pbRatio" />
            <Th k="dividendYield" label="Div %" num colKey="dividendYield" term="dividendYield" />
            <Th k="pctFromLow" label="From 52W Low" num colKey="pctFromLow" term="pctFromLow" />
            <th className="text-left">Trend</th>
            <Th k="perf5d" label="5D %" num colKey="perf5d" term="perf5d" />
            <Th k="rsi14" label="RSI" num colKey="rsi14" term="rsi" />
            <Th k="value" label="Value" num colKey="value" term="valueScore" />
            <Th k="momentum" label="Mom" num colKey="momentum" term="momentumScore" />
            <Th k="quality" label="Qual" num colKey="quality" term="qualityScore" />
            <Th k="risk" label="Risk" num colKey="risk" term="riskScore" />
            <Th k="confidence" label="Conf" num colKey="confidence" term="confidence" />
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const inWl = watchlist.includes(r.symbol);
            const isOpen = expanded.has(r.symbol);
            return (
              <Fragment key={r.symbol}>
                <tr className="hover:bg-primary/5 cursor-pointer" onClick={() => onOpen(r.symbol)}>
                  <td onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(r.symbol)} onChange={() => toggleSelect(r.symbol)} />
                  </td>
                  <td onClick={(e) => { e.stopPropagation(); toggleExpand(r.symbol); }}>
                    <button className="font-mono text-[10px] text-muted-foreground hover:text-primary w-5">
                      {isOpen ? "▾" : "▸"}
                    </button>
                  </td>
                  {has("symbol") && (
                    <td className="text-primary font-mono">
                      <span className="inline-flex items-center gap-1.5">
                        {r.symbol}
                        <ProviderBadge source={r.source} size="xs" />
                      </span>
                    </td>
                  )}
                  {has("name") && <td className="max-w-[160px] truncate" title={r.name}>{r.name}</td>}
                  {has("region") && <td className="text-muted-foreground">{r.region}</td>}
                  {has("sector") && <td className="text-muted-foreground max-w-[140px] truncate" title={r.sector}>{r.sector}</td>}
                  {has("price") && <td className="num">{fmtPriceDisplay(r.price, r.currency, r.marketCap, r.marketCapUsd, ccyMode)}</td>}
                  {has("marketCapUsd") && <td className="num">{fmtMcapUsd(r.marketCapUsd)}</td>}
                  {has("pe") && <td className="num">{fmtNum(r.pe, 1)}</td>}
                  {has("pb") && <td className="num">{fmtNum(r.pb, 2)}</td>}
                  {has("dividendYield") && <td className="num">{r.dividendYield == null ? "—" : `${r.dividendYield.toFixed(2)}%`}</td>}
                  {has("pctFromLow") && (
                    <td className={`num ${(r.pctFromLow ?? 99) <= 15 ? "text-[color:var(--bull)]" : ""}`}>
                      {r.pctFromLow == null ? "—" : `+${r.pctFromLow.toFixed(1)}%`}
                    </td>
                  )}
                  <td className="px-1"><SparkLineShared closes={r.closes} width={72} height={20} /></td>
                  {has("perf5d") && <td className={`num ${colorFor(r.perf5d)}`}>{fmtPct(r.perf5d)}</td>}
                  {has("rsi14") && (
                    <td className={`num ${r.rsi14 == null ? "" : r.rsi14 > 70 ? "text-[color:var(--bear)]" : r.rsi14 < 30 ? "text-[color:var(--bull)]" : ""}`}>
                      {fmtNum(r.rsi14, 0)}
                    </td>
                  )}
                  {has("value") && <td className="num"><ScoreCell n={r.scores.value} /></td>}
                  {has("momentum") && <td className="num"><ScoreCell n={r.scores.momentum} /></td>}
                  {has("quality") && <td className="num"><ScoreCell n={r.scores.quality} /></td>}
                  {has("risk") && <td className="num"><ScoreCell n={r.scores.risk} invert /></td>}
                  {has("confidence") && (
                    <td className="num">
                      <span className={`font-mono ${r.scores.confidence >= 85 ? "text-[color:var(--bull)]" : r.scores.confidence >= 60 ? "text-primary" : "text-[color:var(--bear)]"}`}>
                        {r.scores.confidence}
                      </span>
                      {r.isMock && <div className="text-[9px] text-primary uppercase">mock</div>}
                    </td>
                  )}
                  <td onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => inWl ? onRemoveOne(r.symbol) : onAddOne(r.symbol)}
                      className={`font-mono text-[10px] px-2 py-1 rounded border ${inWl ? "border-[color:var(--bull)]/50 text-[color:var(--bull)]" : "border-border text-muted-foreground hover:text-primary hover:border-primary/40"}`}>
                      {inWl ? "★" : "+ Watch"}
                    </button>
                  </td>
                </tr>
                {isOpen && (
                  <tr className="bg-muted/20">
                    <td colSpan={visibleCount} className="px-4 py-3">
                      <ScoreExplain r={r} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ScoreExplain({ r }: { r: ScoredRow }) {
  const Block = ({ title, items, tone }: { title: string; items: string[]; tone: string }) => (
    <div>
      <div className={`font-mono text-[10px] uppercase mb-1 ${tone}`}>{title}</div>
      <ul className="text-xs space-y-0.5 text-muted-foreground">
        {items.length === 0 ? <li className="opacity-60">—</li> : items.map((s, i) => <li key={i}>• {s}</li>)}
      </ul>
    </div>
  );
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      <Block title={`Value ${r.scores.value}`} items={r.scores.valueReasons} tone="text-primary" />
      <Block title={`Momentum ${r.scores.momentum}`} items={r.scores.momentumReasons} tone="text-primary" />
      <Block title={`Quality ${r.scores.quality}`} items={r.scores.qualityReasons} tone="text-primary" />
      <Block title={`Risk ${r.scores.risk}`} items={r.scores.riskReasons} tone="text-[color:var(--bear)]" />
      <Block title={`Confidence ${r.scores.confidence}`} items={r.scores.confidenceReasons} tone="text-muted-foreground" />
    </div>
  );
}

function ScoreCell({ n, invert }: { n: number; invert?: boolean }) {
  const good = invert ? n < 40 : n >= 65;
  const bad = invert ? n >= 65 : n < 40;
  const cls = good ? "text-[color:var(--bull)]" : bad ? "text-[color:var(--bear)]" : "text-foreground";
  return <span className={`font-mono ${cls}`}>{n}</span>;
}

// ---------------- card view ----------------
function ResultsCards({ rows, watchlist, onAddOne, onRemoveOne, onOpen }: {
  rows: ScoredRow[]; watchlist: string[]; onAddOne: (s: string) => void; onRemoveOne: (s: string) => void; onOpen: (s: string) => void;
}) {
  const [ccyMode] = useDisplayCurrency();
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {rows.map((r) => {
        const inWl = watchlist.includes(r.symbol);
        return (
          <div key={r.symbol} className="panel p-3 hover:border-primary/40 transition-colors cursor-pointer flex flex-col gap-2"
            onClick={() => onOpen(r.symbol)}>
            <div className="flex items-baseline justify-between gap-2">
              <div className="min-w-0">
                <div className="font-mono text-primary text-sm flex items-center gap-1.5">{r.symbol} <ProviderBadge source={r.source} size="xs" /></div>
                <div className="text-xs text-muted-foreground truncate" title={r.name}>{r.name}</div>
              </div>
              <div className="text-right">
                <div className="font-mono text-sm">{fmtPriceDisplay(r.price, r.currency, r.marketCap, r.marketCapUsd, ccyMode)}</div>
                <div className={`font-mono text-[10px] ${colorFor(r.perf5d)}`}>{fmtPct(r.perf5d)}</div>
              </div>
            </div>
            <Sparkline closes={r.closes} />
            <div className="grid grid-cols-3 gap-1 text-[10px] font-mono">
              <Mini label="P/E" v={fmtNum(r.pe, 1)} />
              <Mini label="RSI" v={fmtNum(r.rsi14, 0)} />
              <Mini label="Mcap" v={fmtMcapUsd(r.marketCapUsd)} />
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-mono">
              <Badge label={`V ${r.scores.value}`} tone={r.scores.value >= 65 ? "good" : r.scores.value < 40 ? "bad" : "n"} />
              <Badge label={`M ${r.scores.momentum}`} tone={r.scores.momentum >= 65 ? "good" : r.scores.momentum < 40 ? "bad" : "n"} />
              <Badge label={`Q ${r.scores.quality}`} tone={r.scores.quality >= 65 ? "good" : r.scores.quality < 40 ? "bad" : "n"} />
              <Badge label={r.isMock ? "MOCK" : `C ${r.scores.confidence}`} tone={r.isMock ? "warn" : r.scores.confidence >= 85 ? "good" : "n"} />
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground border-t border-border pt-2">
              <span>{r.region} · {r.exchange}</span>
              <button onClick={(e) => { e.stopPropagation(); inWl ? onRemoveOne(r.symbol) : onAddOne(r.symbol); }}
                className={`font-mono px-2 py-0.5 rounded border ${inWl ? "border-[color:var(--bull)]/50 text-[color:var(--bull)]" : "border-border hover:text-primary hover:border-primary/40"}`}>
                {inWl ? "★ Watching" : "+ Watch"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Mini({ label, v }: { label: string; v: string }) {
  return (
    <div className="border border-border rounded px-1.5 py-1">
      <div className="text-muted-foreground text-[9px]">{label}</div>
      <div>{v}</div>
    </div>
  );
}
function Badge({ label, tone }: { label: string; tone: "good" | "bad" | "warn" | "n" }) {
  const cls = tone === "good" ? "border-[color:var(--bull)]/50 text-[color:var(--bull)]"
    : tone === "bad" ? "border-[color:var(--bear)]/50 text-[color:var(--bear)]"
    : tone === "warn" ? "border-primary/50 text-primary"
    : "border-border text-muted-foreground";
  return <span className={`px-1.5 py-0.5 rounded border ${cls}`}>{label}</span>;
}

function Sparkline({ closes }: { closes: number[] }) {
  if (!closes || closes.length < 2) {
    return <div className="h-10 flex items-center justify-center text-[10px] text-muted-foreground border border-dashed border-border rounded">No price history</div>;
  }
  const w = 240, h = 40;
  const min = Math.min(...closes), max = Math.max(...closes);
  const range = max - min || 1;
  const step = w / (closes.length - 1);
  const pts = closes.map((c, i) => `${(i * step).toFixed(1)},${(h - ((c - min) / range) * h).toFixed(1)}`).join(" ");
  const up = closes[closes.length - 1] >= closes[0];
  const stroke = up ? "var(--bull)" : "var(--bear)";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-10">
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth={1.5} />
    </svg>
  );
}

function Disclaimer() {
  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6 text-[11px] text-muted-foreground space-y-2">
      <p>
        This analysis is for informational purposes only and is not financial advice. Free-source market data may be delayed, incomplete, adjusted, stale, or unavailable. Mock demo data is clearly labeled and is not live market data. Verify all data independently or consult a qualified financial advisor before making investment decisions.
      </p>
      <p className="text-[10px] text-muted-foreground/80">
        Data sources: Finimpulse, Yahoo Finance, Financial Modeling Prep, Stooq. Each row is tagged with its provider badge.
        Data is shown for individual research only and may be delayed by 15+ minutes; redistribution is not permitted.
        All trademarks belong to their respective owners.
      </p>
    </div>
  );
}

function ScreenerIntro({ meta, isLoading }: { meta?: { total: number; mockCount: number; liveCount: number; retrievedAt: string }; isLoading: boolean }) {
  const refreshTime = meta ? new Date(meta.retrievedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
  return (
    <section className="border-b border-border bg-card/30">
      <div className="max-w-[1400px] mx-auto px-4 py-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Workspace · Screener</div>
          <h1 className="text-xl font-medium tracking-tight">Global Equity Screener</h1>
          <p className="text-xs text-muted-foreground mt-1 max-w-[60ch]">
            Filter, sort and score the curated global universe. Press <kbd className="font-mono text-[10px] border border-border rounded px-1.5 py-0.5">⌘K</kbd> to ask in plain English, or <kbd className="font-mono text-[10px] border border-border rounded px-1.5 py-0.5">?</kbd> for shortcuts.
          </p>
        </div>
        <div className="flex items-center gap-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          <span>Universe: <span className="text-foreground">{meta?.total ?? "—"}</span></span>
          <span>Live: <span className="text-[color:var(--bull)]">{meta?.liveCount ?? 0}</span></span>
          <span>Mock: <span className="text-primary">{meta?.mockCount ?? 0}</span></span>
          <span className="flex items-center gap-1.5">
            <span className={`size-1.5 rounded-full ${isLoading ? "bg-primary animate-pulse" : "bg-[color:var(--bull)]"}`} />
            <span>{isLoading ? "Syncing" : refreshTime}</span>
          </span>
        </div>
      </div>
    </section>
  );
}
function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="max-w-[1400px] mx-auto px-4 py-6 flex flex-wrap items-center justify-between gap-3 text-[11px] text-muted-foreground font-mono">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-primary rounded-sm" />
          <span>GLOBAL EQUITY TERMINAL · v2</span>
        </div>
        <div>For research and educational use only.</div>
      </div>
    </footer>
  );
}
