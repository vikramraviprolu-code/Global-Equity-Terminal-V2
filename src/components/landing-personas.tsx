import { Link } from "@tanstack/react-router";

const PERSONAS = [
  {
    eyebrow: "For value investors",
    title: "Find mispriced quality",
    body: "Screen by P/E, P/B, and dividend yield, then drill into Quality scores and fundamentals to separate cheap from broken.",
    preset: "valueLow" as const,
    cta: "Open Deep Value preset",
  },
  {
    eyebrow: "For momentum traders",
    title: "Catch the move early",
    body: "Rank by RSI, ROC and proximity to 52-week highs. Set server-side alerts so a breakout never slips past you.",
    preset: "momentum" as const,
    cta: "Open Velocity preset",
  },
  {
    eyebrow: "For portfolio trackers",
    title: "One source of truth",
    body: "Live P&L, allocation by sector and region, watchlists synced across devices, and AI catalysts on the names you actually own.",
    preset: "all" as const,
    cta: "Open the workspace",
  },
];

export function LandingPersonas() {
  return (
    <section
      aria-labelledby="personas-heading"
      className="border-b border-border bg-card/20"
    >
      <div className="max-w-[1400px] mx-auto px-4 py-16">
        <div className="mb-8 max-w-2xl">
          <span className="font-mono text-[10px] uppercase tracking-widest text-[color:var(--cyan)]">
            // Built for the way you invest
          </span>
          <h2
            id="personas-heading"
            className="text-2xl lg:text-3xl font-semibold tracking-tight mt-2 leading-[1.2]"
          >
            One terminal, three workflows.
          </h2>
          <p className="text-sm text-muted-foreground mt-3 max-w-[60ch]">
            Whether you hunt for mispricings, ride momentum, or just want a calm
            view of what you own — the same workspace adapts to your style.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border border border-border rounded-sm overflow-hidden">
          {PERSONAS.map((p) => (
            <div key={p.title} className="bg-background p-6 flex flex-col">
              <div className="font-mono text-[10px] uppercase tracking-widest text-primary mb-2">
                {p.eyebrow}
              </div>
              <h3 className="text-base font-semibold text-foreground mb-2">
                {p.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                {p.body}
              </p>
              <Link
                to="/app"
                search={{ preset: p.preset } as any}
                className="mt-5 font-mono text-[11px] uppercase tracking-widest text-foreground hover:text-primary"
              >
                {p.cta} →
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
