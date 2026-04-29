import { Link } from "@tanstack/react-router";
import { APP_VERSION, APP_CODENAME } from "@/lib/version";

const PILLARS = [
  {
    eyebrow: "Discover",
    title: "Screener & Heatmap",
    body: "Filter thousands of stocks by region, sector, valuation, and momentum. Flip to a heatmap to see where money is moving — at a glance.",
  },
  {
    eyebrow: "Analyze",
    title: "Terminal Deep Dive",
    body: "Price action, fundamentals, and five transparent scores in one view. AI explains what's happening and why, with citations.",
  },
  {
    eyebrow: "Stay informed",
    title: "News & Catalysts",
    body: "Curated headlines linked to reliable sources. Compare snapshots over time to watch a company's story evolve, not just its price.",
  },
  {
    eyebrow: "Track",
    title: "Watchlists & Portfolio",
    body: "A live portfolio dashboard with P&L and allocation by sector and region. Watchlists sync across devices.",
  },
  {
    eyebrow: "Never miss",
    title: "Smart Alerts",
    body: "Rule-based alerts on price, RSI, 52-week range, and momentum. Evaluated server-side so you don't have to babysit the screen.",
  },
  {
    eyebrow: "Move fast",
    title: "Built for Flow",
    body: "Keyboard shortcuts, a command palette, and a calm interface. Designed to keep you in the work, not in the menus.",
  },
];

export function LandingAbout() {
  return (
    <section
      className="border-b border-border bg-background"
      aria-labelledby="capabilities-heading"
    >
      <div className="max-w-[1400px] mx-auto px-4 py-16">
        <div className="flex items-end justify-between mb-8 gap-6 flex-wrap">
          <div className="max-w-2xl">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Capabilities · v{APP_VERSION} "{APP_CODENAME}"
            </span>
            <h2
              id="capabilities-heading"
              className="text-2xl lg:text-3xl font-semibold tracking-tight mt-2 leading-[1.2]"
            >
              Everything you need to research global equities, in one workspace.
            </h2>
          </div>
          <p className="text-sm text-muted-foreground max-w-md">
            Press{" "}
            <kbd className="font-mono text-[10px] border border-border rounded px-1.5 py-0.5">
              ?
            </kbd>{" "}
            anywhere in the app for keyboard shortcuts and a glossary of every metric.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border border border-border rounded-sm overflow-hidden">
          {PILLARS.map((p) => (
            <div key={p.title} className="bg-background p-6 flex flex-col">
              <div className="font-mono text-[10px] uppercase tracking-widest text-primary mb-2">
                {p.eyebrow}
              </div>
              <div className="text-sm font-semibold text-foreground mb-2">{p.title}</div>
              <p className="text-xs text-muted-foreground leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link
            to="/app"
            search={{ preset: "all" } as any}
            className="px-5 py-2.5 bg-primary text-primary-foreground font-mono text-[11px] uppercase tracking-widest rounded-sm hover:opacity-90"
          >
            Launch the terminal →
          </Link>
          <Link
            to="/changelog"
            className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
          >
            What's new →
          </Link>
        </div>
      </div>
    </section>
  );
}
