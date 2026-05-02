import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { CurrencyToggle } from "@/components/currency-toggle";
import { AuthNav } from "@/components/auth-nav";
import { APP_VERSION } from "@/lib/version";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NavLeaf = { to: string; label: string };
type NavGroup = { id: string; label: string; items: NavLeaf[] };

const NAV_GROUPS: NavGroup[] = [
  {
    id: "research",
    label: "Research",
    items: [
      { to: "/app", label: "Screener" },
      { to: "/terminal", label: "Analysis" },
      { to: "/compare", label: "Compare" },
    ],
  },
  {
    id: "workspace",
    label: "Workspace",
    items: [
      { to: "/watchlist", label: "Watchlists" },
      { to: "/portfolio", label: "Portfolio" },
      { to: "/theses", label: "Theses" },
      { to: "/alerts", label: "Alerts" },
    ],
  },
  {
    id: "market",
    label: "Market",
    items: [{ to: "/events", label: "Events" }],
  },
  {
    id: "system",
    label: "System",
    items: [
      { to: "/system/guide", label: "User Guide" },
      { to: "/data-quality", label: "Data Quality" },
      { to: "/sources", label: "Sources" },
      { to: "/settings", label: "Settings" },
    ],
  },
];

function NavGroupMenu({ group, currentPath }: { group: NavGroup; currentPath: string }) {
  const isActive = group.items.some((i) => currentPath === i.to || currentPath.startsWith(i.to + "/"));
  const tooltip = `${group.label}: ${group.items.map((i) => i.label).join(" · ")}`;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        title={tooltip}
        className={`h-full px-3 flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider transition-colors outline-none ${
          isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        {group.label}
        <ChevronDown className="h-3 w-3 opacity-50" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={0}
        className="min-w-[12rem] rounded-none border-x border-b border-border bg-card/95 backdrop-blur p-1 font-mono"
      >
        {group.items.map((item) => {
          const active = currentPath === item.to || currentPath.startsWith(item.to + "/");
          return (
            <DropdownMenuItem key={item.to} asChild>
              <Link
                to={item.to as any}
                className={`flex items-center justify-between px-3 py-2 text-[11px] uppercase tracking-widest cursor-pointer rounded-sm ${
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <span>{item.label}</span>
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SiteNav({ right }: { right?: React.ReactNode }) {
  const currentPath = useRouterState({ select: (s) => s.location.pathname });
  const versionLabel = `v${APP_VERSION}`;
  const versionTitle = `Version ${APP_VERSION} — view changelog`;
  return (
    <header className="border-b border-border bg-card sticky top-0 z-20 backdrop-blur supports-[backdrop-filter]:bg-card/85">
      <div className="max-w-[1400px] mx-auto px-4 h-12 flex items-center gap-4">
        <Link to="/" className="flex items-center gap-2 hover:opacity-90 shrink-0">
          <div className="w-2 h-2 bg-primary rounded-sm shadow-[0_0_8px_hsl(var(--primary)/0.4)]" />
          <span className="font-mono text-[11px] tracking-[0.2em] text-primary font-bold uppercase hidden sm:inline">
            Global&nbsp;Equity&nbsp;Terminal
          </span>
          <span className="font-mono text-[11px] tracking-[0.2em] text-primary font-bold uppercase sm:hidden">
            GET
          </span>
        </Link>
        <Link
          to="/changelog"
          title={versionTitle}
          className="font-mono text-[10px] text-muted-foreground hover:text-foreground tracking-widest -ml-2 hidden md:inline"
        >
          {versionLabel}
        </Link>

        <nav className="ml-2 flex items-center h-full">
          {NAV_GROUPS.map((g) => (
            <NavGroupMenu key={g.id} group={g} currentPath={currentPath} />
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3 shrink-0">
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
      </div>
    </header>
  );
}

export function Disclaimer() {
  return (
    <div className="mt-8 mb-4 max-w-3xl mx-auto px-4 border-t border-border pt-4 space-y-2 text-center">
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        This analysis is for informational purposes only and is not financial advice. Free-source market data may be delayed,
        incomplete, adjusted, stale, or unavailable. Investors should verify all data independently or consult a qualified
        financial advisor before making investment decisions.
      </p>
      <p className="text-[10px] text-muted-foreground/80 leading-relaxed">
        Data sources: Finimpulse, Yahoo Finance, Financial Modeling Prep, Stooq. Each row is tagged with its provider badge.
        Data is shown for individual research only and may be delayed by 15+ minutes; redistribution is not permitted.
        All trademarks belong to their respective owners.
      </p>
    </div>
  );
}
