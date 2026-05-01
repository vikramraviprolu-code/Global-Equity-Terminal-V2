/**
 * v1.7 server functions:
 *   - getBriefSchedule / upsertBriefSchedule:
 *     per-user opt-in to a daily AI Morning Brief generation.
 *
 * v1.8 adds optional email delivery (emailEnabled + emailTo).
 *
 * The actual generation runs on the server route at
 *   /api/public/hooks/run-scheduled-briefs
 * triggered hourly by pg_cron. RLS scopes user reads/writes here.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAuthHeaders } from "./supabase-auth-headers";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ScheduleInput = z.object({
  enabled: z.boolean(),
  hourUtc: z.number().int().min(0).max(23),
  symbols: z.array(z.string().min(1).max(20)).max(30),
  emailEnabled: z.boolean().optional(),
  emailTo: z.string().email().max(200).optional().nullable(),
});

export const getBriefSchedule = createServerFn({ method: "GET" })
  .middleware([supabaseAuthHeaders, requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("brief_schedules")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { schedule: data ?? null };
  });

export const upsertBriefSchedule = createServerFn({ method: "POST" })
  .middleware([supabaseAuthHeaders, requireSupabaseAuth])
  .inputValidator((d) => ScheduleInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("brief_schedules")
      .upsert(
        {
          user_id: context.userId,
          enabled: data.enabled,
          hour_utc: data.hourUtc,
          symbols: data.symbols.map((s) => s.toUpperCase()),
          email_enabled: data.emailEnabled ?? false,
          email_to: data.emailTo ?? null,
        },
        { onConflict: "user_id" },
      )
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { schedule: row };
  });
