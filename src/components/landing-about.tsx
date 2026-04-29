import { Link } from "@tanstack/react-router";
import { APP_VERSION, APP_CODENAME } from "@/lib/version";

const PILLARS = [
  {
    title: "Screener & Heatmap",
    body: "Filter a global universe by region, sector, valuation (P/E, P/B, yield), momentum (RSI, ROC, MA cross), and 52-week range proximity. Switch between table, cards, and sector heatmap.",
  },
  {
    title: "Terminal Deep Dive",
    body: "Per-ticker page with price chart, technicals, fundamentals, transparent Value / Momentum / Quality / Risk / Confidence scores, AI narrative, news catalysts with citations, and diff mode.",
  },
  {
    title: "Compare & Watchlists",
    body: "Side-by-side comparison of up to several tickers and persistent watchlists synced to your account.",
  },
  {
    title: "Portfolio",
    body: "Track holdings with live valuation, unrealized P&L, and allocation breakdown by sector and region. Auth-gated and protected by row-level security.",
  },
  {
    title: "Alerts",
    body: "Rule-based alerts on price, RSI, 52-week range proximity, and 5-day momentum. Evaluated server-side with in-app notifications and 12h cooldown per rule.",
  },
  {
    title: "Research Toolkit",
    body: "Events calendar, data quality view, sources panel, PDF export, currency toggle, command palette, keyboard shortcuts, and a full glossary of every metric.",
  },
];

export function LandingAbout() {
  return (
    <section className="border-b border-border bg-background" aria-labelledby="about-heading">
      <div className="max-w-[1400px] mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-4">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
              About · v{APP_VERSION} "{APP_CODENAME}"
            </div>
            <h2 id="about-heading" className="text-2xl lg:text-3xl font-semibold tracking-tight mb-4">
              A keyboard-driven, AI-augmented terminal for global equities.
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Global Equity Terminal blends Bloomberg-style data density with an AI co-pilot layer. It's
              built for retail and prosumer investors who want fast research, transparent scoring, and
              live monitoring across US, India, Europe, Japan, Hong Kong, Korea, Taiwan, Singapore, and
              Australia.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed mb-6">
              Every metric is defined in the in-app glossary. Press <kbd className="font-mono text-[10px] border border-border rounded px-1.5 py-0.5">?</kbd> anywhere to open shortcuts and definitions.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/portfolio"
                className="font-mono text-[10px] uppercase tracking-wider bg-primary text-primary-foreground px-3 py-2 rounded hover:opacity-90"
              >
                Open Portfolio
              </Link>
              <Link
                to="/changelog"
                className="font-mono text-[10px] uppercase tracking-wider border border-border text-muted-foreground px-3 py-2 rounded hover:text-foreground hover:border-primary/40"
              >
                What's new
              </Link>
            </div>
          </div>
          <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-px bg-border border border-border rounded-sm overflow-hidden">
            {PILLARS.map((p) => (
              <div key={p.title} className="bg-background p-5">
                <div className="font-mono text-[10px] uppercase tracking-widest text-primary mb-2">
                  {p.title}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
