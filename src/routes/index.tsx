import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchUniverse } from "@/server/screen.functions";
import { scoreAll } from "@/lib/scores";
import { SiteNav } from "@/components/site-nav";
import { LandingHero } from "@/components/landing-hero";
import { LandingProofStrip } from "@/components/landing-proof-strip";
import { LandingAbout } from "@/components/landing-about";
import { LandingAboutStory } from "@/components/landing-about-story";
import { LandingHowItWorks } from "@/components/landing-how-it-works";
import { LandingPersonas } from "@/components/landing-personas";
import { openAuthPopup } from "@/lib/auth-popup";

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
  loader: async ({ context }) => {
    await context.queryClient.prefetchQuery({
      queryKey: ["universe"],
      queryFn: () => fetchUniverse({ data: {} }),
      staleTime: 5 * 60 * 1000,
    });
  },
  component: LandingPage,
});

function LandingPage() {
  const navigate = useNavigate();

  // Note: signed-in users can still view the landing page.
  // Use the "Launch Screener" CTA or nav to enter the workspace.

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
        <LandingHero meta={data?.meta} isLoading={isLoading} />
        <LandingProofStrip rows={scored} />
        <LandingAboutStory />
        <LandingHowItWorks onPickPreset={goToScreener} />
        <LandingAbout />
        <LandingPersonas />
        <section className="bg-card/30">
          <div className="max-w-[1400px] mx-auto px-4 py-16 text-center">
            <h2 className="text-2xl lg:text-3xl font-semibold tracking-tight mb-3">
              Ready when you are.
            </h2>
            <p className="text-sm text-muted-foreground max-w-[55ch] mx-auto mb-7">
              Open the workspace to screen, score and track stocks across 9 markets. Sign in to sync your portfolio, watchlists and alerts.
            </p>
            <div className="flex flex-wrap justify-center items-center gap-5">
              <Link
                to="/app"
                search={{ preset: "all" } as any}
                className="px-6 py-3 bg-primary text-primary-foreground font-mono text-xs uppercase tracking-widest rounded-sm hover:opacity-90"
              >
                Launch Screener →
              </Link>
              <a
                href="/auth?popup=1"
                target="_blank"
                rel="noopener"
                onClick={(e) => { e.preventDefault(); openAuthPopup(); }}
                className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground cursor-pointer"
              >
                Sign in / Sign up →
              </a>
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
          <div className="flex items-center gap-4">
            <span>For research and educational use only.</span>
            <Link to="/legal" className="hover:text-foreground uppercase tracking-widest">
              Legal
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
