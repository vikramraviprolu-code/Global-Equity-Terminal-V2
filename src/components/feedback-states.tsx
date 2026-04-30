import { Link } from "@tanstack/react-router";
import { Skeleton } from "@/components/ui/skeleton";
import type { ReactNode } from "react";

/**
 * Shared loading + empty state primitives. Keep visual language consistent
 * across portfolio, alerts, watchlist, compare, events and panel-style views.
 */

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="p-10 text-center flex flex-col items-center gap-3">
      {icon && <div className="text-muted-foreground/60 mb-1">{icon}</div>}
      <div className="font-mono text-xs uppercase tracking-widest text-foreground">{title}</div>
      {description && (
        <p className="text-sm text-muted-foreground max-w-md">{description}</p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

export function EmptyStateLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-block font-mono text-[10px] uppercase tracking-wider border border-primary/50 text-primary px-4 py-2 rounded hover:bg-primary/10"
    >
      {children}
    </Link>
  );
}

/** Skeleton table — renders shimmering placeholder rows that match column count. */
export function TableSkeleton({ columns = 6, rows = 6 }: { columns?: number; rows?: number }) {
  return (
    <div className="p-3 space-y-2" aria-busy="true" aria-label="Loading data">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3 items-center">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton
              key={c}
              className="h-3.5"
              style={{ width: c === 0 ? "12%" : c === 1 ? "22%" : `${Math.max(8, 14 - c)}%` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Skeleton block for stat cards / KPI tiles. */
export function StatGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded border border-border bg-card px-4 py-3 space-y-2">
          <Skeleton className="h-2.5 w-20" />
          <Skeleton className="h-5 w-28" />
        </div>
      ))}
    </div>
  );
}

/** Multi-paragraph text skeleton for narrative / news panels. */
export function ParagraphSkeleton({ lines = 5 }: { lines?: number }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Loading content">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-3"
          style={{ width: `${85 - (i % 3) * 12}%` }}
        />
      ))}
    </div>
  );
}
