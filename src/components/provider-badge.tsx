// Small badge that surfaces which upstream data provider served a row/result.
// Helps users understand data freshness/coverage when fallbacks kick in.

import { cn } from "@/lib/utils";

export type ProviderSource =
  | "Finimpulse"
  | "Yahoo Finance"
  | "Stooq"
  | "Financial Modeling Prep"
  | "Mock demo data"
  | string;

const STYLES: Record<string, { label: string; cls: string; title: string }> = {
  "Finimpulse": {
    label: "FIN",
    cls: "border-[color:var(--bull)]/40 text-[color:var(--bull)] bg-[color:var(--bull)]/5",
    title: "Source: Finimpulse (primary live feed)",
  },
  "Yahoo Finance": {
    label: "YHO",
    cls: "border-primary/40 text-primary bg-primary/5",
    title: "Source: Yahoo Finance (free fallback)",
  },
  "Stooq": {
    label: "STQ",
    cls: "border-cyan-500/40 text-cyan-500 bg-cyan-500/5",
    title: "Source: Stooq (free CSV fallback)",
  },
  "Financial Modeling Prep": {
    label: "FMP",
    cls: "border-violet-500/40 text-violet-500 bg-violet-500/5",
    title: "Source: Financial Modeling Prep (free-tier fallback)",
  },
  "Mock demo data": {
    label: "MOCK",
    cls: "border-[color:var(--bear)]/40 text-[color:var(--bear)] bg-[color:var(--bear)]/5",
    title: "Source: deterministic demo data — not live market data",
  },
};

export function ProviderBadge({
  source,
  className,
  size = "sm",
}: {
  source: ProviderSource | null | undefined;
  className?: string;
  size?: "xs" | "sm";
}) {
  if (!source) return null;
  const s = STYLES[source] ?? {
    label: source.slice(0, 3).toUpperCase(),
    cls: "border-border text-muted-foreground",
    title: `Source: ${source}`,
  };
  return (
    <span
      title={s.title}
      className={cn(
        "inline-flex items-center font-mono uppercase tracking-wider rounded border",
        size === "xs" ? "text-[9px] px-1 py-0 leading-4" : "text-[10px] px-1.5 py-0.5 leading-4",
        s.cls,
        className,
      )}
    >
      {s.label}
    </span>
  );
}
