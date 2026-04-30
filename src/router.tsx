import { createRouter, useRouter } from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { routeTree } from "./routeTree.gen";
import { logClientError } from "@/lib/error-log";

function DefaultErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error("Router error:", error);
  const router = useRouter();
  // Fire-and-forget remote logging. Effect (not render) so it only fires once.
  useEffect(() => {
    logClientError(error, { route: typeof window !== "undefined" ? window.location.pathname : undefined });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center panel p-6">
        <h1 className="text-xl font-bold text-destructive">System error</h1>
        <p className="mt-2 text-sm text-muted-foreground">An unexpected error occurred. Please try again.</p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button onClick={() => { router.invalidate(); reset(); }} className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">Retry</button>
          <a href="/" className="rounded border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-accent">Home</a>
        </div>
      </div>
    </div>
  );
}

/**
 * Centralized React Query defaults — keeps every route consistent.
 *
 * - staleTime 60s: matches our slowest data refresh cadence; avoids
 *   thrashing the universe API on focus changes.
 * - gcTime 5min: free memory for routes the user no longer visits.
 * - retry: skip 401 (auth) and 4xx (validation), retry transient errors once.
 *   Server-side fetches already retry inside fetchWithRetry (v1.4.2).
 * - refetchOnWindowFocus disabled by default: financial data already polls
 *   on its own schedule; refocus thrash is annoying not helpful.
 * - networkMode "online": don't fire requests when the browser reports
 *   offline; the router error boundary will recover when back online.
 */
export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        networkMode: "online",
        retry: (failureCount, error: any) => {
          const msg = String(error?.message ?? error ?? "");
          // Don't retry auth or validation failures — they're deterministic
          if (/\b(401|403|404|400|422)\b/.test(msg)) return false;
          if (/unauthorized|forbidden|not.?found/i.test(msg)) return false;
          return failureCount < 1;
        },
      },
      mutations: {
        // Mutations should never silently retry — they're side-effecting.
        retry: false,
      },
    },
  });
  return createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: DefaultErrorComponent,
  });
};
