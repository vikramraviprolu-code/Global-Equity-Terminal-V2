import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getPublicUniverseCacheStats } from "@/server/screen.functions";
import { isCurrentUserAdmin } from "@/server/admin-emails.functions";
import { useAuth } from "@/hooks/use-auth";
import { SiteNav } from "@/components/site-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/admin/cache")({
  head: () => ({
    meta: [
      { title: "Cache Observability — Admin" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminCachePage,
});

function fmtMs(ms: number | null) {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

function AdminCachePage() {
  const { user, loading } = useAuth();

  const adminCheck = useQuery({
    queryKey: ["isAdmin", user?.id],
    queryFn: () => isCurrentUserAdmin(),
    enabled: !!user,
  });
  const isAdmin = !!adminCheck.data?.isAdmin;

  const cache = useQuery({
    queryKey: ["publicUniverseCacheStats"],
    queryFn: () => getPublicUniverseCacheStats(),
    enabled: isAdmin,
    refetchInterval: 15_000,
  });

  if (loading || adminCheck.isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <SiteNav />
        <div className="max-w-[1200px] mx-auto px-4 py-12 text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <SiteNav />
        <div className="max-w-[1200px] mx-auto px-4 py-12">
          <Card className="max-w-md">
            <CardHeader><CardTitle>Sign in required</CardTitle></CardHeader>
            <CardContent><Link to="/auth" className="text-primary underline">Go to sign in</Link></CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <SiteNav />
        <div className="max-w-[1200px] mx-auto px-4 py-12">
          <Card className="max-w-md border-destructive/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <ShieldAlert className="h-4 w-4" /> Admins only
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              This page exposes internal cache observability data.
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const stats = cache.data?.stats ?? [];
  const lastBuild = cache.data?.lastBuild;

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main className="max-w-[1200px] mx-auto px-4 py-8 space-y-6">
        <header>
          <h1 className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">Admin · Cache Observability</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Per-isolate counters for the public universe snapshot cache. Resets on cold start. Refreshes every 15s.
          </p>
        </header>

        {lastBuild && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Most recent rebuild — upstream</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1">
              <div>Upstream errors: <span className="font-mono">{lastBuild.upstreamErrors}</span></div>
              {lastBuild.upstreamErrorSamples?.length > 0 && (
                <ul className="font-mono text-[11px] text-muted-foreground list-disc pl-5">
                  {lastBuild.upstreamErrorSamples.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle className="text-sm">Cache keys (prefix: public:universe)</CardTitle></CardHeader>
          <CardContent>
            {stats.length === 0 ? (
              <p className="text-sm text-muted-foreground">No cache activity recorded yet on this isolate.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono">
                  <thead className="text-muted-foreground">
                    <tr className="text-left border-b border-border">
                      <th className="py-2 pr-3">Key</th>
                      <th className="py-2 pr-3 text-right">Hits</th>
                      <th className="py-2 pr-3 text-right">Misses</th>
                      <th className="py-2 pr-3 text-right">Errors</th>
                      <th className="py-2 pr-3 text-right">Stale serves</th>
                      <th className="py-2 pr-3 text-right">Last rebuild</th>
                      <th className="py-2 pr-3 text-right">Value age</th>
                      <th className="py-2 pr-3 text-right">Expires in</th>
                      <th className="py-2 pr-3">Last error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.map((s) => (
                      <tr key={s.key} className="border-b border-border/50">
                        <td className="py-2 pr-3">{s.key}</td>
                        <td className="py-2 pr-3 text-right">{s.hits}</td>
                        <td className="py-2 pr-3 text-right">{s.misses}</td>
                        <td className={`py-2 pr-3 text-right ${s.errors > 0 ? "text-destructive" : ""}`}>{s.errors}</td>
                        <td className={`py-2 pr-3 text-right ${s.staleServes > 0 ? "text-amber-500" : ""}`}>{s.staleServes}</td>
                        <td className="py-2 pr-3 text-right">{fmtMs(s.lastRebuildMs)}</td>
                        <td className="py-2 pr-3 text-right">{fmtMs(s.valueAgeMs)}</td>
                        <td className="py-2 pr-3 text-right">{fmtMs(s.expiresInMs)}</td>
                        <td className="py-2 pr-3 text-destructive truncate max-w-[260px]" title={s.lastError ?? ""}>{s.lastError ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
