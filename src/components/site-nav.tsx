import { Link } from "@tanstack/react-router";
import { CurrencyToggle } from "@/components/currency-toggle";
import { AuthNav } from "@/components/auth-nav";
import { APP_VERSION } from "@/lib/version";

type NavItem = { to: string; label: string; exact?: boolean };
const NAV: NavItem[] = [
  { to: "/", label: "Screener", exact: true },
  { to: "/terminal", label: "Analysis" },
  { to: "/compare", label: "Compare" },
  { to: "/watchlist", label: "Watchlists" },
  { to: "/portfolio", label: "Portfolio" },
  { to: "/alerts", label: "Alerts" },
  { to: "/events", label: "Events" },
  { to: "/data-quality", label: "Data Quality" },
  { to: "/sources", label: "Sources" },
  { to: "/settings", label: "Settings" },
];

export function SiteNav({ right }: { right?: React.ReactNode }) {
  return (
    <header className="border-b border-border bg-card sticky top-0 z-20 backdrop-blur supports-[backdrop-filter]:bg-card/85">
      <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center gap-4 flex-wrap">
        <Link to="/" className="flex items-center gap-2 hover:opacity-90">
          <div className="w-2 h-2 bg-primary rounded-sm" />
          <span className="font-mono text-sm tracking-widest text-primary">GLOBAL&nbsp;EQUITY&nbsp;TERMINAL</span>
          <Link
            to="/changelog"
            title={`Version ${APP_VERSION} — view changelog`}
            className="font-mono text-[10px] text-muted-foreground hover:text-foreground tracking-widest"
          >
            v{APP_VERSION}
          </Link>
        </Link>
        <nav className="ml-auto flex items-center gap-0.5 text-xs font-mono uppercase tracking-wider flex-wrap">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to as any}
              activeProps={{ className: "text-primary bg-primary/10" }}
              activeOptions={n.exact ? { exact: true } : undefined}
              className="px-2.5 py-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              {n.label}
            </Link>
          ))}
          <div className="ml-2 flex items-center gap-2">
            <CurrencyToggle />
            <button
              type="button"
              title="Keyboard shortcuts (press ?)"
              aria-label="Show keyboard shortcuts"
              onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "?" }))}
              className="hidden sm:inline-flex items-center justify-center w-6 h-6 rounded border border-border text-[11px] font-mono text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              ?
            </button>
            {right ?? <AuthNav />}
          </div>
        </nav>
      </div>
    </header>
  );
}

export function Disclaimer() {
  return (
    <p className="mt-8 mb-4 text-[11px] text-muted-foreground border-t border-border pt-4 max-w-3xl mx-auto text-center leading-relaxed px-4">
      This analysis is for informational purposes only and is not financial advice. Free-source market data may be delayed,
      incomplete, adjusted, stale, or unavailable. Investors should verify all data independently or consult a qualified
      financial advisor before making investment decisions.
    </p>
  );
}
