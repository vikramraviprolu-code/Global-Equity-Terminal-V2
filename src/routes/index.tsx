import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { fetchUniverse } from "@/server/screen.functions";
import { scoreAll } from "@/lib/scores";
import { SiteNav } from "@/components/site-nav";
import { LandingHero } from "@/components/landing-hero";
import { LandingAbout } from "@/components/landing-about";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Global Equity Terminal — AI-Augmented Stock Research" },
      { name: "description", content: "A keyboard-driven, AI-augmented research terminal for global equities. Screen, score, and monitor stocks across 9 markets with transparent Value / Momentum / Quality / Risk scoring." },
      { property: "og:title", content: "Global Equity Terminal — AI-Augmented Stock Research" },
      { property: "og:description", content: "Bloomberg-style data density meets an AI co-pilot. Built for retail and prosumer investors." },
    ],
    links: [{ rel: "canonical", href: "https://rankaisolutions.tech/" }],
  }),
  loader: ({ context }) => {
    context.queryClient.prefetchQuery({
      queryKey: ["universe"],
      queryFn: () => fetchUniverse({ data: {} }),
      staleTime: 5 * 60 * 1000,
    });
  },
  component: LandingPage,
});

function LandingPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();

  // Auto-redirect signed-in users into the app
  useEffect(() => {
    if (!loading && session) {
      navigate({ to: "/app", search: { preset: "all" } as any, replace: true });
    }
  }, [loading, session, navigate]);

  const { data, isLoading } = useQuery({
    queryKey: ["universe"],
    queryFn: () => fetchUniverse({ data: {} }),
    staleTime: 5 * 60 * 1000,
  });

  const scored = data?.rows ? scoreAll(data.rows) : [];

  const goToScreener = (preset: "valueLow" | "momentum" | "quality" | "breakout") => {
    navigate({ to: "/app", search: { preset } as any });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <SiteNav />
      <main className="flex-1">
        <LandingHero meta={data?.meta} rows={scored} isLoading={isLoading} onPickPreset={goToScreener} />
        <LandingAbout />
        <section className="border-b border-border bg-card/30">
          <div className="max-w-[1400px] mx-auto px-4 py-12 text-center">
            <h2 className="text-2xl lg:text-3xl font-semibold tracking-tight mb-3">Ready to screen the global universe?</h2>
            <p className="text-sm text-muted-foreground max-w-[60ch] mx-auto mb-6">
              Open the workspace to filter, score, compare and track stocks across 9 markets — or sign in to sync your portfolio, watchlists and alerts.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                to="/app"
                search={{ preset: "all" } as any}
                className="px-5 py-2.5 bg-primary text-primary-foreground font-mono text-xs uppercase tracking-widest rounded-sm hover:opacity-90"
              >
                Launch Screener →
              </Link>
              <Link
                to="/auth"
                className="px-5 py-2.5 border border-border text-foreground font-mono text-xs uppercase tracking-widest rounded-sm hover:border-primary/40 hover:text-primary"
              >
                Sign in / Sign up
              </Link>
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t border-border">
        <div className="max-w-[1400px] mx-auto px-4 py-6 flex flex-wrap items-center justify-between gap-3 text-[11px] text-muted-foreground font-mono">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-primary rounded-sm" />
            <span>GLOBAL EQUITY TERMINAL</span>
          </div>
          <div>For research and educational use only.</div>
        </div>
      </footer>
    </div>
  );
}
