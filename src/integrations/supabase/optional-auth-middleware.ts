// Optional auth middleware: validates a token if present and exposes
// `userId` (string | null) + an authenticated supabase client when signed in.
// Unlike requireSupabaseAuth, anonymous callers are allowed through.
import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export const optionalSupabaseAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

  let userId: string | null = null;
  let supabase: SupabaseClient<Database> | null = null;
  let ip: string | null = null;

  try {
    const request = getRequest();
    if (request?.headers) {
      ip =
        request.headers.get("cf-connecting-ip") ??
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        request.headers.get("x-real-ip") ??
        null;
      const auth = request.headers.get("authorization");
      const token = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
      if (token && SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY) {
        const c = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });
        const { data, error } = await c.auth.getClaims(token);
        if (!error && data?.claims?.sub) {
          userId = data.claims.sub as string;
          supabase = c;
        }
      }
    }
  } catch (e) {
    // Fail open — anonymous request
  }

  return next({ context: { userId, supabase, ip } });
});
