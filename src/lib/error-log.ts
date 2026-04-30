import { reportError } from "@/server/error-log.functions";
import { supabase } from "@/integrations/supabase/client";
import { APP_VERSION } from "@/lib/version";

/**
 * Best-effort client → server error reporter.
 *
 * - Dedupes the same message within a 60s window so a render loop doesn't
 *   spam the table.
 * - Always swallows its own failures; reporting must never crash the app.
 * - Attaches the bearer token if the user is signed in so the server can
 *   attribute the log to their user_id (verified server-side).
 */
const recent = new Map<string, number>();
const DEDUPE_MS = 60_000;

export async function logClientError(
  error: Error | unknown,
  info?: { componentStack?: string; route?: string },
) {
  try {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;

    // Dedupe identical messages within DEDUPE_MS
    const key = message.slice(0, 200);
    const now = Date.now();
    const last = recent.get(key);
    if (last && now - last < DEDUPE_MS) return;
    recent.set(key, now);
    // Trim map periodically
    if (recent.size > 50) {
      for (const [k, t] of recent) if (now - t > DEDUPE_MS) recent.delete(k);
    }

    let headers: HeadersInit | undefined;
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) headers = { Authorization: `Bearer ${token}` };
    } catch {
      // anonymous report is fine
    }

    await reportError({
      data: {
        message: message.slice(0, 2000),
        stack: stack?.slice(0, 8000),
        componentStack: info?.componentStack?.slice(0, 8000),
        route: info?.route ?? (typeof window !== "undefined" ? window.location.pathname : undefined),
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : undefined,
        appVersion: APP_VERSION,
      },
      headers,
    });
  } catch {
    // Reporting must never throw
  }
}
