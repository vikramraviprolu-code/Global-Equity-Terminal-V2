import { APP_VERSION, APP_CODENAME } from "@/lib/version";

export function LandingAboutStory() {
  return (
    <section
      className="border-b border-border bg-card/20"
      aria-labelledby="about-heading"
    >
      <div className="max-w-[1400px] mx-auto px-4 py-16 grid lg:grid-cols-12 gap-10">
        <div className="lg:col-span-4">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            About · v{APP_VERSION} "{APP_CODENAME}"
          </span>
          <h2
            id="about-heading"
            className="text-2xl lg:text-3xl font-semibold tracking-tight mt-2 leading-[1.2]"
          >
            Built for investors who want clarity, speed, and an edge.
          </h2>
        </div>

        <div className="lg:col-span-8 space-y-5 text-sm leading-relaxed text-muted-foreground">
          <p>
            <span className="text-foreground font-medium">Global Equity Terminal</span> is
            your all-in-one <span className="text-foreground font-medium">Atlas</span>{" "}
            workspace for discovering, analysing, and tracking stocks across global
            markets. It blends the depth of a professional terminal with a modern,
            intuitive interface — and an AI co-pilot that helps you move from data to
            insight faster.
          </p>
          <p>
            Whether you're scanning opportunities or monitoring positions, everything is
            one keystroke away. Screen thousands of names, drill into a company's
            fundamentals, watch the news that actually matters, and track your portfolio
            with live P&L and allocation breakdowns.
          </p>
          <p>
            Built for flow: keyboard shortcuts, a command palette, and a calm interface
            that keeps you focused. Behind the scenes, it's powered by a modern stack and
            secure infrastructure — so you can spend your time on decisions, not plumbing.
          </p>
          <p className="text-foreground">
            Designed for serious retail and prosumer investors. Cut through the noise,
            understand markets faster, and act with more confidence.
          </p>
        </div>
      </div>
    </section>
  );
}
