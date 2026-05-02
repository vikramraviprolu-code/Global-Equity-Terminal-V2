import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteNav, Disclaimer } from "@/components/site-nav";
import { ProviderBadge } from "@/components/provider-badge";

export const Route = createFileRoute("/system/guide")({
  head: () => ({
    meta: [
      { title: "User Guide — Global Equity Terminal" },
      { name: "description", content: "Step-by-step guide to using the Global Equity Terminal: screener, ticker analysis, watchlists, scoring, and data sources." },
    ],
  }),
  component: GuidePage,
});

function GuidePage() {
  return (
    <div className="min-h-screen">
      <SiteNav />
      <main className="max-w-3xl mx-auto px-4 py-10 text-sm leading-relaxed">
        <header className="mb-8">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">System · Guide</div>
          <h1 className="text-3xl font-semibold">How to use the Global Equity Terminal</h1>
          <p className="text-muted-foreground mt-2">
            A practical walkthrough — no jargon. Five minutes end to end.
          </p>
        </header>

        <Toc />

        <Section id="overview" title="1. What this app is">
          <p>
            The terminal is a research tool for <strong>publicly listed stocks</strong> across nine global markets
            (USA, India, Europe, Japan, Hong Kong, Korea, Taiwan, Singapore, Australia, plus Greater China).
            It pulls live market data, computes technical and value indicators, and produces a structured
            <em> Buy / Watch / Avoid </em> recommendation backed by transparent reasoning.
          </p>
          <p className="mt-2">
            It is <strong>not</strong> financial advice and not a brokerage. You use it to <em>research ideas</em> —
            execution happens elsewhere.
          </p>
        </Section>

        <Section id="screener" title="2. The Screener (Workspace → Screener)">
          <p>Start here. The screener loads ~143 curated global tickers and lets you filter, sort, and score them.</p>
          <Steps>
            <li><strong>Presets</strong> at the top (e.g. <em>Value Near Lows</em>, <em>Momentum Leaders</em>) one-click apply common filter combinations.</li>
            <li><strong>Filters</strong> below — region, sector, market cap, P/E, P/B, dividend yield, RSI, ROC, MA-cross, % from 52W low, and minimum confidence.</li>
            <li>Switch between <strong>Table</strong>, <strong>Chart</strong>, and <strong>Heatmap</strong> views (top right).</li>
            <li>Click any row to open the full <strong>Terminal</strong> analysis for that stock.</li>
            <li>Use the checkbox column to multi-select, then add to your <strong>Watchlist</strong> in bulk.</li>
            <li>Export results to <strong>CSV</strong> or save the visible chart/table as <strong>PNG</strong>.</li>
          </Steps>
          <Callout>
            Tip: press <Kbd>⌘K</Kbd> (or <Kbd>Ctrl K</Kbd>) anywhere to ask the terminal a question in plain English,
            and <Kbd>?</Kbd> for keyboard shortcuts.
          </Callout>
        </Section>

        <Section id="terminal" title="3. The Terminal (single-stock analysis)">
          <p>
            Search a ticker (<Code>AAPL</Code>, <Code>RELIANCE.NS</Code>, <Code>7203.T</Code>) or a company name
            (<Code>Tencent</Code>) at the top. If multiple listings match, you'll see a picker to choose the right exchange.
          </p>
          <p className="mt-2">The result has nine tabs:</p>
          <ul className="mt-2 space-y-1 list-disc pl-5">
            <li><strong>Overview</strong> — snapshot of price, market cap, 52W range, P/E, momentum signals.</li>
            <li><strong>Chart</strong> — interactive price chart with MA20/50/200 overlays.</li>
            <li><strong>Scores</strong> — five vectors (Value, Momentum, Quality, Risk, Confidence), each with reasons.</li>
            <li><strong>Value Screen</strong> — does this stock pass the regional value filter, and why.</li>
            <li><strong>Momentum</strong> — RSI, ROC, MA-cross, 5-day performance breakdown.</li>
            <li><strong>Peers</strong> — same-industry comparables with side-by-side metrics.</li>
            <li><strong>Cross-Analysis</strong> — overlap between value-qualifiers and momentum leaders.</li>
            <li><strong>Scenario</strong> — historical backtest of MA-cross on this ticker.</li>
            <li><strong>Final Recommendation</strong> — Buy / Watch / Avoid with horizon and confidence.</li>
          </ul>
          <p className="mt-3">
            Press <Kbd>E</Kbd> on any analyzed page to download a <strong>PDF report</strong>.
            Click <em>☆ Add to Watchlist</em> in the header to track the stock.
          </p>
        </Section>

        <Section id="scores" title="4. The 5 scoring vectors (out of 100)">
          <ul className="space-y-2 list-disc pl-5">
            <li><strong>Value</strong> — how cheap the stock looks on P/E, P/B, dividend yield, and proximity to 52W low.</li>
            <li><strong>Momentum</strong> — direction and strength of recent price action (RSI, ROC, MA stack).</li>
            <li><strong>Quality</strong> — size, liquidity, and stability proxies (market cap, average volume).</li>
            <li><strong>Risk</strong> — drawdown distance from 52W high, overbought RSI, MA200 break (lower is safer).</li>
            <li><strong>Confidence</strong> — completeness and freshness of the underlying data.</li>
          </ul>
          <p className="mt-3">
            Hover any score in the table for the per-metric reasoning. Scores never become "advice" — they are inputs you weigh yourself.
          </p>
        </Section>

        <Section id="data" title="5. Where the data comes from">
          <p>Every row and analysis is tagged with a small badge indicating the source:</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <ProviderBadge source="Finimpulse" /> <ProviderBadge source="Yahoo Finance" />{" "}
            <ProviderBadge source="Financial Modeling Prep" /> <ProviderBadge source="Stooq" />{" "}
            <ProviderBadge source="Mock demo data" />
          </div>
          <p className="mt-3">
            The app tries Finimpulse first; if it's unavailable or rate-limited, it automatically falls back to Yahoo,
            then Financial Modeling Prep, then Stooq. As a last resort you'll see <em>MOCK</em> rows — clearly labeled,
            never live data.
          </p>
          <p className="mt-2 text-muted-foreground text-xs">
            Free-source data may be delayed by 15+ minutes and is for individual research only — not for redistribution.
          </p>
        </Section>

        <Section id="other" title="6. Other workspaces">
          <ul className="space-y-2 list-disc pl-5">
            <li><strong>Watchlist</strong> — your saved tickers, with live mini-snapshots.</li>
            <li><strong>Compare</strong> — line up to 5 tickers side-by-side across every metric.</li>
            <li><strong>Portfolio</strong> — track positions and aggregate exposure (sign-in required).</li>
            <li><strong>Alerts</strong> — set price / RSI / score triggers and receive in-app notifications.</li>
            <li><strong>Theses</strong> — write and timestamp your investment rationale per ticker.</li>
            <li><strong>Events</strong> — upcoming earnings and macro data calendar.</li>
            <li><strong>Sources</strong> — full data-provider transparency report.</li>
            <li><strong>Data Quality</strong> — coverage and freshness across the universe.</li>
          </ul>
        </Section>

        <Section id="shortcuts" title="7. Keyboard shortcuts">
          <ul className="space-y-1 list-disc pl-5">
            <li><Kbd>⌘K</Kbd> / <Kbd>Ctrl K</Kbd> — open the Ask AI command bar</li>
            <li><Kbd>?</Kbd> — show all shortcuts</li>
            <li><Kbd>E</Kbd> — export current view (PDF on terminal, CSV on screener)</li>
            <li><Kbd>R</Kbd> — refresh the current data view</li>
            <li><Kbd>/</Kbd> — focus the search bar</li>
          </ul>
        </Section>

        <Section id="faq" title="8. Common questions">
          <Q q="Why does a ticker say 'Symbol not found'?">
            The free upstream APIs occasionally rate-limit. Wait 30 seconds and retry, or use the company-name search
            (e.g. type <Code>apple</Code> instead of <Code>AAPL</Code>). For non-US listings always include the
            exchange suffix: <Code>RELIANCE.NS</Code>, <Code>7203.T</Code>, <Code>BMW.DE</Code>.
          </Q>
          <Q q="Why is P/E or Market Cap blank for some rows?">
            The fallback providers don't always return fundamentals — only price history. The Provider Badge tells
            you which source served the row; rows tagged <ProviderBadge source="Stooq" size="xs" /> won't have P/E.
          </Q>
          <Q q="Is the data real-time?">
            No — assume 15-minute delay. Real-time US market data requires paid exchange licensing.
          </Q>
          <Q q="Can I use this for trading decisions?">
            This is a research tool, not advice. Verify all data independently and consult a qualified financial
            advisor before making investment decisions.
          </Q>
        </Section>

        <div className="mt-10 border-t border-border pt-6 text-center">
          <Link to="/app" className="font-mono text-xs uppercase tracking-wider text-primary hover:underline">
            ← Back to the screener
          </Link>
        </div>

        <Disclaimer />
      </main>
    </div>
  );
}

// ---------------- helpers ----------------
function Toc() {
  const items: Array<[string, string]> = [
    ["overview", "What this app is"],
    ["screener", "The Screener"],
    ["terminal", "The Terminal"],
    ["scores", "The 5 scoring vectors"],
    ["data", "Where data comes from"],
    ["other", "Other workspaces"],
    ["shortcuts", "Keyboard shortcuts"],
    ["faq", "FAQ"],
  ];
  return (
    <nav className="panel p-4 mb-8 text-xs">
      <div className="font-mono uppercase tracking-wider text-muted-foreground mb-2">Contents</div>
      <ol className="grid grid-cols-1 sm:grid-cols-2 gap-y-1 list-decimal pl-5">
        {items.map(([id, label]) => (
          <li key={id}>
            <a href={`#${id}`} className="text-primary hover:underline">{label}</a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-10 scroll-mt-20">
      <h2 className="text-xl font-semibold mb-3 border-b border-border pb-2">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Steps({ children }: { children: React.ReactNode }) {
  return <ol className="mt-2 space-y-2 list-decimal pl-5">{children}</ol>;
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 border-l-2 border-primary/60 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
      {children}
    </div>
  );
}

function Q({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <div className="font-medium text-foreground">{q}</div>
      <div className="text-muted-foreground mt-1">{children}</div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="font-mono text-[10px] border border-border rounded px-1.5 py-0.5 bg-muted">{children}</kbd>;
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="font-mono text-[12px] text-primary">{children}</code>;
}
