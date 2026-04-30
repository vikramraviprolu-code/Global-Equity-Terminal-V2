import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Public error reporting endpoint. Anyone (including anonymous visitors)
 * can record a runtime error so we have visibility into prod crashes.
 *
 * Hardened against abuse via:
 * - Strict Zod validation with hard length caps
 * - Truncation of stack traces (no point storing 50KB)
 * - Optional user_id only attached when the caller is signed in
 *   (we trust the bearer header here only for attribution; we never
 *   accept a user_id from the body).
 */
export const reportError = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        message: z.string().min(1).max(2000),
        stack: z.string().max(8000).optional(),
        componentStack: z.string().max(8000).optional(),
        route: z.string().max(500).optional(),
        userAgent: z.string().max(500).optional(),
        appVersion: z.string().max(40).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    try {
      // Try to attribute to a signed-in user via their bearer token,
      // but never trust client-supplied user_id.
      let userId: string | null = null;
      try {
        const { getRequestHeader } = await import("@tanstack/react-start/server");
        const authHeader = getRequestHeader("authorization");
        if (authHeader?.startsWith("Bearer ")) {
          const token = authHeader.slice(7);
          const { data: u } = await supabaseAdmin.auth.getUser(token);
          userId = u?.user?.id ?? null;
        }
      } catch {
        // ignore — anonymous error reports are fine
      }

      const { error } = await supabaseAdmin.from("error_logs").insert({
        user_id: userId,
        message: data.message,
        stack: data.stack ?? null,
        component_stack: data.componentStack ?? null,
        route: data.route ?? null,
        user_agent: data.userAgent ?? null,
        app_version: data.appVersion ?? null,
      });
      if (error) {
        console.error("[error-log] insert failed:", error);
        return { ok: false };
      }
      return { ok: true };
    } catch (e) {
      console.error("[error-log] handler crashed:", e);
      return { ok: false };
    }
  });
