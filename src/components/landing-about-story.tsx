import { APP_VERSION, APP_CODENAME } from "@/lib/version";

export function LandingAboutStory() {
  return (
    <section
      className="border-b border-border bg-card/20"
      aria-labelledby="about-heading"
    >
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-12 sm:py-16 lg:py-20 grid lg:grid-cols-12 gap-8 lg:gap-12">
        <header className="lg:col-span-5 lg:sticky lg:top-24 self-start">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            About · v{APP_VERSION} · &ldquo;{APP_CODENAME}&rdquo;
          </span>
          <h2
            id="about-heading"
            className="mt-3 text-balance text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight leading-[1.15]"
          >
            Built for investors who want clarity, speed, and an edge.
          </h2>
          <div
            aria-hidden="true"
            className="mt-5 h-px w-12 bg-gradient-to-r from-primary/60 to-transparent"
          />
        </header>

        <div className="lg:col-span-7 space-y-5 sm:space-y-6 text-[15px] sm:text-base leading-relaxed text-muted-foreground text-pretty max-w-[65ch]">
          <p>
            <span className="text-foreground font-medium">Global Equity Terminal</span>{" "}
            is your all-in-one{" "}
            <span className="text-foreground font-medium">Atlas</span> workspace for
            discovering, analysing, and tracking stocks across global markets. It
            blends the depth of a professional terminal with a modern, intuitive
            interface&nbsp;— and an AI co-pilot that helps you move from data to
            insight faster.
          </p>
          <p>
            Built for flow: keyboard shortcuts, a command palette, and a calm
            interface that keeps you focused. Designed for serious retail and
            prosumer investors who want to cut through the noise, understand
            markets faster, and act with more confidence.
          </p>
        </div>
      </div>
    </section>
  );
}
