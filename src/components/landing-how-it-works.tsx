type Preset = "valueLow" | "momentum" | "quality" | "breakout";

export function LandingHowItWorks({
  onPickPreset,
}: {
  onPickPreset: (id: Preset) => void;
}) {
  return (
    <section
      aria-labelledby="how-heading"
      className="border-b border-border bg-background"
    >
      <div className="max-w-[1400px] mx-auto px-4 py-14">
        <div className="mb-8">
          <span className="text-[10px] font-mono uppercase tracking-widest text-[color:var(--cyan)]">
            // How it works
          </span>
          <h2
            id="how-heading"
            className="text-2xl lg:text-3xl font-semibold tracking-tight mt-2"
          >
            From the global universe to a confident decision — in three steps.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border border border-border">
          <Step
            num="01"
            tag="Screen"
            title="Filter the universe"
            body="Slice thousands of stocks by region, sector, valuation and momentum. Or jump in with a preset strategy."
          >
            <div className="mt-4 flex flex-wrap gap-1.5">
              {[
                { id: "valueLow" as const, label: "Deep Value" },
                { id: "momentum" as const, label: "Velocity" },
                { id: "quality" as const, label: "Quality" },
                { id: "breakout" as const, label: "Breakout" },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => onPickPreset(p.id)}
                  className="px-2 py-1 border border-border bg-card hover:border-primary/40 hover:text-primary text-[10px] font-mono uppercase tracking-wider rounded-sm transition-colors"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </Step>
          <Step
            num="02"
            tag="Analyze"
            title="Score & understand"
            body="Open any ticker for price action, fundamentals, five transparent scores, and an AI thesis with cited news catalysts."
          />
          <Step
            num="03"
            tag="Track"
            title="Watchlist & alerts"
            body="Save names to watchlists, build a live portfolio with P&L, and set price, RSI or momentum alerts that fire server-side."
          />
        </div>
      </div>
    </section>
  );
}

function Step({
  num,
  tag,
  title,
  body,
  children,
}: {
  num: string;
  tag: string;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="bg-card p-6 flex flex-col">
      <div className="flex items-baseline justify-between mb-6">
        <span className="font-mono text-[10px] tracking-widest text-[color:var(--cyan)]">
          {num} // {tag.toUpperCase()}
        </span>
      </div>
      <h3 className="text-lg font-medium mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
      {children}
    </div>
  );
}
