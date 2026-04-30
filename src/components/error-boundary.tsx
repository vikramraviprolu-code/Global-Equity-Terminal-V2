import { Component, type ReactNode } from "react";
import { logClientError } from "@/lib/error-log";

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches uncaught render errors in any descendant component and shows a
 * recoverable fallback UI instead of a blank white screen.
 *
 * Wraps <Outlet /> in __root.tsx so it covers every route. The router's
 * defaultErrorComponent only catches loader errors — this catches render
 * errors thrown by useQuery callbacks, hooks, and component bodies.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[AppErrorBoundary]", error, info.componentStack);
    // Fire-and-forget — never blocks UI
    logClientError(error, { componentStack: info.componentStack ?? undefined });
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback(this.state.error, this.reset);
      return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
          <div className="max-w-md text-center panel p-6">
            <h1 className="text-xl font-bold text-destructive">Something went wrong</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              The page hit an unexpected error. Try reloading; if it keeps failing, the issue has been logged.
            </p>
            <p className="mt-3 text-xs font-mono text-muted-foreground/80 break-words">
              {this.state.error.message}
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                onClick={this.reset}
                className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                Try again
              </button>
              <a
                href="/"
                className="rounded border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Home
              </a>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
