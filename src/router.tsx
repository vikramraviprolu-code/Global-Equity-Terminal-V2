import { createRouter, useRouter } from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";
import { routeTree } from "./routeTree.gen";

function DefaultErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error("Router error:", error);
  const router = useRouter();
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

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        retry: (failureCount, error: any) => {
          // Don't retry auth failures (401) — they're expected when signed out
          const msg = String(error?.message ?? error ?? "");
          if (msg.includes("401") || msg.toLowerCase().includes("unauthorized")) return false;
          return failureCount < 1;
        },
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
