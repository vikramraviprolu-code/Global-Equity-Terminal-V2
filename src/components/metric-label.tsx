import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { glossaryEntry, type GlossaryKey } from "@/lib/glossary";

/**
 * Drop-in wrapper for any jargon term, metric label, or score badge.
 * Hover/focus shows the glossary entry. Keyboard + screen-reader accessible
 * via aria-describedby (shadcn Tooltip handles that internally).
 *
 * Usage:
 *   <MetricLabel term="rsi">RSI</MetricLabel>
 *   <MetricLabel term="valueScore">Value</MetricLabel>
 */
export function MetricLabel({
  term,
  children,
  className = "",
  asChild = false,
}: {
  term: GlossaryKey;
  children?: React.ReactNode;
  className?: string;
  /** When true, render the trigger inline without the dotted underline affordance. */
  asChild?: boolean;
}) {
  const entry = GLOSSARY[term];
  if (!entry) return <>{children ?? term}</>;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            className={
              asChild
                ? `cursor-help ${className}`
                : `cursor-help underline decoration-dotted decoration-muted-foreground/40 underline-offset-2 hover:decoration-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-sm ${className}`
            }
            aria-label={entry.full ?? entry.term}
          >
            {children ?? entry.term}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1 text-[11px] leading-relaxed">
            <div className="font-mono uppercase tracking-wider text-[10px] text-muted-foreground">
              {entry.full ?? entry.term}
            </div>
            <div className="text-foreground">{entry.definition}</div>
            {entry.hint && <div className="text-muted-foreground italic">{entry.hint}</div>}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
