import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { getSharedWatchlist } from "@/server/share.functions";
import { fetchUniverse } from "@/server/screen.functions";
import { scoreAll } from "@/lib/scores";
import { fmtNum, fmtPct, fmtMcapUsd, fmtPriceDisplay, colorFor } from "@/lib/format";
import { useDisplayCurrency } from "@/hooks/use-display-currency";
import { SiteNav, Disclaimer } from "@/components/site-nav";
import { Sparkline } from "@/components/sparkline";
import { TableSkeleton } from "@/components/feedback-states";
import { APP_VERSION } from "@/lib/version";

export const Route = createFileRoute("/w/$token")({
  loader: async ({ params }) => {
    const share = await getSharedWatchlist({ data: { token: params.token } });
    if (!share.found) throw notFound();
    return share;
  },
  head: ({ loaderData, params }) => {
    const name = loaderData?.found ? loaderData.name : "Shared Watchlist";
    const count = loaderData?.found ? loaderData.symbols.length : 0;
    const title = `${name} — Shared Watchlist · Global Equity Terminal`;
    const description = count
      ? `${count} ticker${count === 1 ? "" : "s"} curated and shared on Global Equity Terminal — live scores, momentum, and value signals.`
      : "A shared watchlist on Global Equity Terminal.";
    const url = `https://rankaisolutions.tech/w/${params.token}`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: url },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  notFoundComponent: () => (
    <div className="min-h-screen flex flex-col">
      <SiteNav />
      <main className="flex-1 max-w-[800px] mx-auto px-4 py-16 w-full text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Share unavailable</h1>
        <p className="text-sm text-muted-foreground mt-3">
          This shared watchlist link is invalid, has been revoked by its owner, or has expired.
        </p>
        <Link to="/" className="inline-block mt-6 font-mono text-[11px] uppercase tracking-wider border border-primary/50 text-primary px-4 py-2 rounded hover:bg-primary/10">
          Go to homepage
        </Link>
      </main>
      <Disclaimer />
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="min-h-screen flex flex-col">
      <SiteNav />
      <main className="flex-1 max-w-[800px] mx-auto px-4 py-16 w-full text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Couldn't load this share</h1>
        <p className="text-sm text-muted-foreground mt-3">{error?.message ?? "Unknown error."}</p>
      </main>
    </div>
  ),
  component: SharedWatchlistPage,
});

function SharedWatchlistPage() {
  const share = Route.useLoaderData();
  const [ccyMode] = useDisplayCurrency();

  const { data: universe, isLoading } = useQuery({
    queryKey: ["universe"],
    queryFn: () => fetchUniverse({ data: {} }),
    staleTime: 5 * 60 * 1000,
  });

  const rows = useMemo(() => {
    if (!universe?.rows || !share.found) return [];
    const all = scoreAll(universe.rows);
    const set = new Set(share.symbols);
    return all.filter((r) => set.has(r.symbol));
  }, [universe, share]);

  if (!share.found) return null;

  const createdAt = new Date(share.createdAt).toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric",
  });

  return (
    <div className="min-h-screen flex flex-col">
      <SiteNav />
      <main className="flex-1 max-w-[1400px] mx-auto px-4 py-6 w-full">
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-primary mb-1">
              Shared watchlist · read-only
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">{share.name}</h1>
            <p className="text-xs text-muted-foreground mt-1">
              {share.symbols.length} ticker{share.symbols.length === 1 ? "" : "s"} · shared {createdAt} · {share.viewCount} view{share.viewCount === 1 ? "" : "s"}
            </p>
          </div>
          <Link
            to="/"
            className="font-mono text-[10px] uppercase tracking-wider bg-primary text-primary-foreground px-3 py-1.5 rounded hover:opacity-90"
          >
            Build your own watchlist →
          </Link>
        </div>

        {isLoading ? (
          <div className="panel mt-6"><TableSkeleton columns={8} rows={Math.min(share.symbols.length, 8)} /></div>
        ) : rows.length === 0 ? (
          <div className="panel mt-6 p-8 text-center text-sm text-muted-foreground">
            None of the {share.symbols.length} shared tickers are currently in our universe.
          </div>
        ) : (
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
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.symbol}>
                    <td className="text-primary font-mono">
                      <Link to="/terminal/$symbol" params={{ symbol: r.symbol }} className="hover:underline">{r.symbol}</Link>
                    </td>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-6 text-[11px] text-muted-foreground">
          This is a static snapshot of someone else's watchlist on{" "}
          <Link to="/" className="text-primary hover:underline">Global Equity Terminal</Link> v{APP_VERSION}.
          Live metrics shown above update every refresh.
        </div>
        <Disclaimer />
      </main>
    </div>
  );
}
