import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { z } from "zod";
import { fetchUniverse } from "@/server/screen.functions";
import { scoreAll } from "@/lib/scores";
import { fmtNum, fmtPct, fmtMcapUsd, fmtPriceDisplay, colorFor } from "@/lib/format";
import { useDisplayCurrency } from "@/hooks/use-display-currency";
import { useWatchlistNamed, WATCHLIST_NAMES, readAllWatchlists, type WatchlistName } from "@/hooks/use-watchlist";
import { SiteNav, Disclaimer } from "@/components/site-nav";
import { Sparkline } from "@/components/sparkline";

export const Route = createFileRoute("/watchlist")({
  validateSearch: (s: Record<string, unknown>) => z.object({ list: z.string().optional() }).parse(s),
  head: () => ({
    meta: [
      { title: "Watchlists — Global Equity Terminal v2" },
      { name: "description", content: "Track shortlisted global stocks across multiple watchlists with live scores, momentum, and value signals." },
    ],
    links: [{ rel: "canonical", href: "https://rankaisolutions.tech/watchlist" }],
  }),
  component: WatchlistPage,
});

function isValidName(s: string | undefined): s is WatchlistName {
  return !!s && (WATCHLIST_NAMES as string[]).includes(s);
}

function WatchlistPage() {
  const navigate = useNavigate();
  const { list } = Route.useSearch();
  const active: WatchlistName = isValidName(list) ? list : "My Watchlist";
  const { items, remove, clear } = useWatchlistNamed(active);
  const [ccyMode] = useDisplayCurrency();

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["universe"],
    queryFn: () => fetchUniverse({ data: {} }),
    staleTime: 5 * 60 * 1000,
  });

  const all = useMemo(() => (data?.rows ? scoreAll(data.rows) : []), [data]);
  const rows = useMemo(() => all.filter((r) => items.includes(r.symbol)), [all, items]);
  const counts = useMemo(() => readAllWatchlists(), [items]); // re-evaluates when active list mutates

  const compareUrl = items.length >= 2
    ? { to: "/compare" as const, search: { s: items.join(",") } as any }
    : null;

  return (
    <div className="min-h-screen flex flex-col">
      <SiteNav />
      <main className="flex-1 max-w-[1400px] mx-auto px-4 py-6 w-full">
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Watchlists</h1>
            <p className="text-xs text-muted-foreground mt-1">Stored locally in your browser. Three default lists per the PRD.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => refetch()} disabled={isFetching} className="font-mono text-[10px] uppercase tracking-wider border border-border px-3 py-1.5 rounded hover:border-primary disabled:opacity-50">
              {isFetching ? "Refreshing…" : "Refresh all"}
            </button>
            {compareUrl && (
              <Link {...compareUrl} className="font-mono text-[10px] uppercase tracking-wider bg-primary text-primary-foreground px-3 py-1.5 rounded hover:opacity-90">
                Compare {items.length}
              </Link>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-1 border-b border-border overflow-x-auto">
          {WATCHLIST_NAMES.map((n) => {
            const isActive = n === active;
            return (
              <button
                key={n}
                onClick={() => navigate({ to: "/watchlist", search: { list: n } as any, replace: true })}
                className={`whitespace-nowrap px-4 py-2 text-xs font-mono uppercase tracking-wider border-b-2 transition-colors ${
                  isActive ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {n} <span className="opacity-60">({counts[n]?.length ?? 0})</span>
              </button>
            );
          })}
        </div>

        {items.length === 0 ? (
          <div className="panel p-10 text-center mt-6">
            <div className="font-mono text-sm text-muted-foreground">"{active}" is empty.</div>
            <Link to="/app" className="inline-block mt-4 font-mono text-[10px] uppercase tracking-wider border border-primary/50 text-primary px-4 py-2 rounded hover:bg-primary/10">
              Browse the screener
            </Link>
          </div>
        ) : isLoading ? (
          <div className="panel p-10 text-center mt-6 font-mono text-sm text-primary animate-pulse">LOADING…</div>
        ) : (
          <>
            <div className="panel overflow-x-auto mt-4">
              <table className="term">
                <thead>
                  <tr>
                    <th>Ticker</th><th>Company</th><th>Region</th>
                    <th className="text-right">Price</th>
                    <th className="text-right">Mcap (USD)</th>
                    <th className="text-right">P/E</th>
                    <th>Trend</th>
                    <th className="text-right">5D %</th>
                    <th className="text-right">RSI</th>
                    <th className="text-right">Value</th>
                    <th className="text-right">Mom</th>
                    <th className="text-right">Risk</th>
                    <th className="text-right">Conf</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.symbol} className="hover:bg-primary/5 cursor-pointer" onClick={() => navigate({ to: "/terminal/$symbol", params: { symbol: r.symbol } })}>
                      <td className="text-primary font-mono">{r.symbol}</td>
                      <td>{r.name}</td>
                      <td className="text-muted-foreground">{r.region}</td>
                      <td className="num">{fmtPriceDisplay(r.price, r.currency, r.marketCap, r.marketCapUsd, ccyMode)}</td>
                      <td className="num">{fmtMcapUsd(r.marketCapUsd)}</td>
                      <td className="num">{fmtNum(r.pe, 1)}</td>
                      <td><Sparkline closes={r.closes} width={72} height={20} /></td>
                      <td className={`num ${colorFor(r.perf5d)}`}>{fmtPct(r.perf5d)}</td>
                      <td className="num">{fmtNum(r.rsi14, 0)}</td>
                      <td className="num font-mono">{r.scores.value}</td>
                      <td className="num font-mono">{r.scores.momentum}</td>
                      <td className="num font-mono">{r.scores.risk}</td>
                      <td className="num font-mono">{r.scores.confidence}{r.isMock && <span className="text-[9px] text-primary ml-1">mock</span>}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => remove(r.symbol)} className="font-mono text-[10px] border border-border px-2 py-1 rounded hover:border-destructive hover:text-destructive">
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 text-right">
              <button onClick={clear} className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-destructive">
                Clear "{active}"
              </button>
            </div>
          </>
        )}
        <Disclaimer />
      </main>
    </div>
  );
}
