import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Postgres-backed sliding-window rate limit.
 * Calls public.check_rate_limit() which atomically counts recent calls and
 * inserts a new row if under the limit.
 *
 * Throws a 429 Response if the user exceeds the limit. Fails open if the DB
 * is unreachable so a transient outage doesn't break the app.
 */
export async function enforceRateLimit(
  userId: string,
  endpoint: string,
  maxCalls: number,
  windowSeconds: number,
): Promise<void> {
  try {
    const { data, error } = await supabaseAdmin.rpc("check_rate_limit", {
      _user_id: userId,
      _endpoint: endpoint,
      _max_calls: maxCalls,
      _window_seconds: windowSeconds,
    });
    if (error) {
      console.error(`[rate-limit] DB error for ${endpoint}:`, error.message);
      return; // fail open
    }
    if (data === false) {
      throw new Response(
        `Rate limit exceeded for ${endpoint}. Try again in a few minutes.`,
        { status: 429 },
      );
    }
  } catch (e) {
    if (e instanceof Response) throw e;
    console.error(`[rate-limit] Unexpected error for ${endpoint}:`, e);
    // fail open
  }
}
