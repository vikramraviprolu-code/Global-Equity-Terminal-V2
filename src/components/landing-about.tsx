import { Link } from "@tanstack/react-router";
import { APP_VERSION, APP_CODENAME } from "@/lib/version";

const PILLARS = [
  {
    eyebrow: "Discover",
    title: "Screener & Heatmap",
    body: "Filter thousands of stocks by region, sector, valuation, and momentum. Flip to a visual heatmap to spot where money is moving — at a glance.",
  },
  {
    eyebrow: "Analyze",
    title: "Terminal Deep Dive",
    body: "Price action, fundamentals, and multi-factor scores in one view. AI explains what's happening and why, with citations you can trust.",
  },
  {
    eyebrow: "Stay informed",
    title: "News & Catalysts",
    body: "Curated headlines linked to reliable sources. Compare snapshots over time to watch a company's story evolve, not just its price.",
  },
  {
    eyebrow: "Track",
    title: "Watchlists & Portfolio",
    body: "A live portfolio dashboard with performance, P&L, and allocation by sector and region. Watchlists sync to your account across devices.",
  },
  {
    eyebrow: "Never miss",
    title: "Smart Alerts",
    body: "Rule-based alerts on price, RSI, 52-week range, and momentum shifts. Evaluated server-side so you don't have to babysit the screen.",
  },
  {
    eyebrow: "Move fast",
    title: "Built for Flow",
    body: "Keyboard shortcuts, a command palette, and a calm, focused interface. Designed to keep you in the work, not in the menus.",
  },
];

export function LandingAbout() {
  return (
    <section className="border-b border-border bg-background" aria-labelledby="about-heading">
      <div className="max-w-[1400px] mx-auto px-4 py-16">
        {/* Lede */}
        <div className="max-w-3xl mb-14">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4">
            About · v{APP_VERSION} "{APP_CODENAME}"
          </div>
          <h2
            id="about-heading"
            className="text-3xl lg:text-4xl font-semibold tracking-tight mb-6 leading-[1.15]"
          >
            One workspace to discover, analyze, and track stocks across global
            markets — built for clarity, speed, and an edge.
          </h2>
          <p className="text-base text-muted-foreground leading-relaxed mb-4">
            Global Equity Terminal combines the depth of a professional terminal
            with a modern, intuitive interface and an AI co-pilot that helps you
            move from data to insight faster. Whether you're scanning new
            opportunities or monitoring positions, every screen is designed to
            keep you in flow.
          </p>
          <p className="text-base text-muted-foreground leading-relaxed">
            Designed for serious retail and prosumer investors, Atlas helps you
            cut through the noise, understand markets faster, and make more
            confident decisions.
          </p>
        </div>

        {/* Capability grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border border border-border rounded-sm overflow-hidden mb-12">
          {PILLARS.map((p) => (
            <div key={p.title} className="bg-background p-6 flex flex-col">
              <div className="font-mono text-[10px] uppercase tracking-widest text-primary mb-2">
                {p.eyebrow}
              </div>
              <div className="text-sm font-semibold text-foreground mb-2">
                {p.title}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {p.body}
              </p>
            </div>
          ))}
        </div>

        {/* Closing strip + CTAs */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 pt-8 border-t border-border">
          <p className="text-sm text-muted-foreground max-w-2xl">
            Press{" "}
            <kbd className="font-mono text-[10px] border border-border rounded px-1.5 py-0.5">
              ?
            </kbd>{" "}
            anywhere in the app for shortcuts and a full glossary of every
            metric and score.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/app"
              className="font-mono text-[10px] uppercase tracking-wider bg-primary text-primary-foreground px-4 py-2.5 rounded hover:opacity-90"
            >
              Launch the terminal
            </Link>
            <Link
              to="/changelog"
              className="font-mono text-[10px] uppercase tracking-wider border border-border text-muted-foreground px-4 py-2.5 rounded hover:text-foreground hover:border-primary/40"
            >
              What's new
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
