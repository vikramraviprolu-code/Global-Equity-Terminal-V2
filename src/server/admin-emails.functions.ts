import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAuthHeaders } from "./supabase-auth-headers";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

const FilterInput = z.object({
  rangeHours: z.number().int().min(1).max(24 * 60).default(168),
  template: z.string().optional(),
  status: z.enum(["all", "sent", "failed", "dlq", "suppressed", "pending"]).default("all"),
  limit: z.number().int().min(1).max(500).default(100),
});

export const getEmailDashboard = createServerFn({ method: "POST" })
  .middleware([supabaseAuthHeaders, requireSupabaseAuth])
  .inputValidator((d) => FilterInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);

    const sinceIso = new Date(Date.now() - data.rangeHours * 3600 * 1000).toISOString();
    const admin = supabaseAdmin;

    // Pull all rows in window (bounded by 7d default), then dedupe by message_id in JS.
    const { data: rows, error } = await admin
      .from("email_send_log")
      .select("id, message_id, template_name, recipient_email, status, error_message, created_at")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) throw new Error(error.message);

    type Row = NonNullable<typeof rows>[number];
    const all = (rows ?? []) as Row[];

    // Latest row per message_id (rows ordered desc, so first wins)
    const latestByMsg = new Map<string, Row>();
    // Also count attempts (rows per message_id) to surface retry counts
    const attemptsByMsg = new Map<string, number>();
    // First-pending timestamp per message_id for queue latency
    const firstPendingByMsg = new Map<string, string>();
    for (const r of all) {
      const key = r.message_id ?? r.id;
      if (!latestByMsg.has(key)) latestByMsg.set(key, r);
      attemptsByMsg.set(key, (attemptsByMsg.get(key) ?? 0) + 1);
      if (r.status === "pending") firstPendingByMsg.set(key, r.created_at);
    }

    const latest = Array.from(latestByMsg.values());

    // Stats over latest rows
    const totalUnique = latest.length;
    const counts: Record<string, number> = { sent: 0, failed: 0, dlq: 0, suppressed: 0, pending: 0, bounced: 0, complained: 0 };
    for (const r of latest) counts[r.status] = (counts[r.status] ?? 0) + 1;

    // Queue latency: pending -> sent/dlq/failed for messages we have both rows for
    const latencies: number[] = [];
    for (const [msg, finalRow] of latestByMsg) {
      if (finalRow.status === "pending") continue;
      const startIso = firstPendingByMsg.get(msg);
      if (!startIso) continue;
      const ms = new Date(finalRow.created_at).getTime() - new Date(startIso).getTime();
      if (ms >= 0 && ms < 60 * 60 * 1000) latencies.push(ms);
    }
    latencies.sort((a, b) => a - b);
    const pct = (p: number) => (latencies.length ? latencies[Math.floor((latencies.length - 1) * p)] : 0);
    const latency = {
      count: latencies.length,
      p50_ms: pct(0.5),
      p95_ms: pct(0.95),
      max_ms: latencies[latencies.length - 1] ?? 0,
    };

    // Retry stats
    const retryCounts = Array.from(attemptsByMsg.values()).map((n) => Math.max(0, n - 1));
    const retried = retryCounts.filter((n) => n > 0).length;
    const totalRetries = retryCounts.reduce((a, b) => a + b, 0);
    const maxRetries = retryCounts.reduce((a, b) => Math.max(a, b), 0);

    // Build filtered rows for the table
    const filtered = latest
      .filter((r) => (data.template ? r.template_name === data.template : true))
      .filter((r) => {
        if (data.status === "all") return true;
        if (data.status === "failed") return r.status === "failed" || r.status === "dlq" || r.status === "bounced";
        return r.status === data.status;
      })
      .slice(0, data.limit)
      .map((r) => ({
        id: r.id,
        messageId: r.message_id,
        template: r.template_name,
        recipient: r.recipient_email,
        status: r.status,
        error: r.error_message,
        createdAt: r.created_at,
        attempts: attemptsByMsg.get(r.message_id ?? r.id) ?? 1,
      }));

    // Distinct templates for filter dropdown
    const templates = Array.from(new Set(latest.map((r) => r.template_name))).sort();

    // Recent failures (last 24h) for alerting badge
    const last24 = new Date(Date.now() - 24 * 3600 * 1000).getTime();
    const recentFailures = latest.filter(
      (r) => new Date(r.created_at).getTime() >= last24 && (r.status === "failed" || r.status === "dlq" || r.status === "bounced"),
    ).length;

    return {
      stats: {
        totalUnique,
        sent: counts.sent ?? 0,
        failed: (counts.failed ?? 0) + (counts.dlq ?? 0) + (counts.bounced ?? 0),
        dlq: counts.dlq ?? 0,
        suppressed: counts.suppressed ?? 0,
        pending: counts.pending ?? 0,
        recentFailures,
      },
      latency,
      retries: { retried, totalRetries, maxRetries, totalMessages: totalUnique },
      templates,
      rows: filtered,
    };
  });

export const isCurrentUserAdmin = createServerFn({ method: "GET" })
  .middleware([supabaseAuthHeaders, requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    return { isAdmin: !!data };
  });
