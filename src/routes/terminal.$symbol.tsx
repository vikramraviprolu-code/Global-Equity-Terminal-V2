import { createFileRoute, useRouter } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { Card, CardContent } from "@/components/ui/card";

const TerminalPage = lazy(() => import("@/components/terminal/terminal-page").then(m => ({ default: m.TerminalPage })));

export const Route = createFileRoute("/terminal/$symbol")({
  head: ({ params }) => {
    const sym = (params?.symbol ?? "").toUpperCase();
    const title = sym
      ? `${sym} — Stock Analysis · Global Equity Terminal`
      : "Stock Analysis · Global Equity Terminal";
    const description = sym
      ? `Evidence-based Buy/Hold/Avoid analysis for ${sym}: valuation, momentum, fundamentals, and catalysts.`
      : "Data-driven equity research for any US or international stock ticker.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
      ],
      links: sym
        ? [{ rel: "canonical", href: `https://rankaisolutions.tech/terminal/${sym}` }]
        : [],
    };
  },
  component: SymbolTerminalPage,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="p-10 text-center font-mono text-sm text-destructive">
        An unexpected error occurred. Please try again.
        <div className="mt-4">
          <button
            className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground"
            onClick={() => {
              router.invalidate();
              reset();
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  },
  notFoundComponent: () => (
    <div className="p-10 text-center font-mono text-sm text-muted-foreground">
      Symbol not found. Try a different ticker (e.g. AAPL, RELIANCE.NS, 7203.T).
    </div>
  ),
});

function SymbolTerminalPage() {
  const { symbol } = Route.useParams();
  return (
    <Suspense fallback={
      <div className="max-w-[1400px] mx-auto px-4 py-6">
        <Card>
          <CardContent className="p-8">
            <div className="flex items-center justify-center">
              <div className="text-sm font-mono text-muted-foreground">Loading terminal...</div>
            </div>
          </CardContent>
        </Card>
      </div>
    }>
      <TerminalPage key={symbol} initialTicker={symbol} />
    </Suspense>
  );
}
