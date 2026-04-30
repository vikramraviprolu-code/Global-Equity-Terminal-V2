import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteNav } from "@/components/site-nav";
import { canonical } from "@/lib/seo";

export const Route = createFileRoute("/legal")({
  head: () => ({
    meta: [
      { title: "Legal & Disclaimers — Global Equity Terminal" },
      {
        name: "description",
        content:
          "Disclaimers, data attribution, trademarks, and terms of use for Global Equity Terminal.",
      },
      { property: "og:title", content: "Legal & Disclaimers — Global Equity Terminal" },
      {
        property: "og:description",
        content:
          "Disclaimers, data attribution, trademarks, and terms of use for Global Equity Terminal.",
      },
      { name: "robots", content: "index,follow" },
    ],
    links: [{ rel: "canonical", href: canonical("/legal") }],
  }),
  component: LegalPage,
});

function LegalPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />
      <main className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold tracking-tight mb-2">Legal &amp; Disclaimers</h1>
        <p className="text-xs font-mono text-muted-foreground mb-8">
          Last updated: April 30, 2026
        </p>

        <Section title="Not investment advice">
          <p>
            Global Equity Terminal (the &ldquo;Service&rdquo;) is an independent research
            and educational tool. Nothing displayed in the Service &mdash; including
            screener results, scores, AI-generated narratives, news summaries, alerts,
            backtests, or recommendations &mdash; constitutes investment, financial, tax,
            or legal advice, nor an offer or solicitation to buy or sell any security.
          </p>
          <p>
            All decisions you make based on the Service are solely your own. You should
            consult a qualified, licensed financial advisor before making any investment
            decision. Past performance is not indicative of future results. Investing in
            equities involves risk, including the possible loss of principal.
          </p>
        </Section>

        <Section title="Data sources &amp; accuracy">
          <p>
            Market data, fundamentals, and news are sourced from third-party providers
            and public APIs. Data may be delayed, adjusted, incomplete, stale, or
            unavailable. Quotes are not real-time unless explicitly labelled as such.
            We make no warranty, express or implied, regarding the accuracy,
            completeness, or timeliness of any data displayed.
          </p>
          <p>
            Verify all data independently against official sources (issuer filings,
            exchange feeds, your broker) before acting on it. See the{" "}
            <Link to="/sources" className="text-primary underline-offset-2 hover:underline">
              Sources
            </Link>{" "}
            page for the current attribution list.
          </p>
        </Section>

        <Section title="AI-generated content">
          <p>
            The Service uses large language models to summarize news, generate
            narratives, and produce qualitative commentary. AI output may contain
            factual errors, hallucinations, outdated information, or biased framing.
            Treat AI commentary as a starting point for your own research, not as a
            verified statement of fact.
          </p>
        </Section>

        <Section title="Trademarks">
          <p>
            All ticker symbols, company names, logos, exchange names, and product names
            referenced in the Service are the property of their respective owners and
            are used for identification purposes only. Their use does not imply
            endorsement, affiliation, or sponsorship. &ldquo;Global Equity Terminal&rdquo;
            is not affiliated with, endorsed by, or sponsored by any exchange, data
            vendor, or financial institution.
          </p>
        </Section>

        <Section title="Copyright">
          <p>
            The Service&rsquo;s code, design, scoring methodology, and original written
            content are &copy; {new Date().getFullYear()} the operators of Global Equity
            Terminal. Open-source dependencies are used under their respective licenses
            (MIT, Apache 2.0, ISC, BSD). Third-party data, news headlines, and source
            material remain the property of their original publishers.
          </p>
        </Section>

        <Section title="No warranty &amp; limitation of liability">
          <p>
            The Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;
            without warranty of any kind. To the fullest extent permitted by law, the
            operators of the Service disclaim all liability for any direct, indirect,
            incidental, consequential, or punitive damages arising from your use of, or
            inability to use, the Service or any data, alert, score, or narrative it
            produces.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            For questions about these terms, data attribution, or trademark concerns,
            please reach out via the contact channel listed on the marketing site.
          </p>
        </Section>

        <div className="mt-10 pt-6 border-t border-border">
          <Link
            to="/"
            className="text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground"
          >
            ← Back to home
          </Link>
        </div>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2
        className="text-sm font-mono uppercase tracking-widest text-primary mb-3"
        dangerouslySetInnerHTML={{ __html: title }}
      />
      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}
