import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAuthHeaders } from "./supabase-auth-headers";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { chat } from "@/server/ai.server";
import { fetchScreenerRow } from "@/server/finimpulse.server";
import { UNIVERSE } from "@/server/universe";
import { render as renderAsync } from "@react-email/components";
import * as React from "react";
import { TEMPLATES } from "@/lib/email-templates/registry";

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

const BRIEF_SYSTEM = `You are an equity research desk producing a concise morning brief for a watchlist.
STRICT RULES:
- 90–160 words, plain prose, 1–2 short paragraphs.
- Lead with the 2–3 most notable moves.
- Use ONLY the metrics provided. Never invent news.
- End with: "Not investment advice."`;

const TestBriefInput = z.object({
  symbols: z.array(z.string()).min(1).max(20),
  recipient: z.string().email().optional(),
});

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const triggerTestMorningBrief = createServerFn({ method: "POST" })
  .middleware([supabaseAuthHeaders, requireSupabaseAuth])
  .inputValidator((d) => TestBriefInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);

    // Determine recipient
    let recipient = data.recipient;
    if (!recipient) {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(context.userId);
      recipient = u?.user?.email ?? undefined;
    }
    if (!recipient) throw new Error("No recipient available");

    // Build facts
    const lookup: Record<string, any> = {};
    UNIVERSE.forEach((u) => { lookup[u.symbol] = u; });
    const rows = await Promise.all(
      data.symbols.map(async (sym) => {
        const u = lookup[sym] ?? { symbol: sym, name: sym, exchange: "UNKNOWN", country: "Unknown", region: "OTHER" as const, currency: "USD", sector: "Unknown", industry: "Unknown" };
        return await fetchScreenerRow(u).catch(() => null);
      }),
    );
    const live = rows.filter(Boolean) as any[];
    const facts = live
      .map((r) => `${r.symbol} px=${r.price ?? "?"} 5D=${r.perf5d ?? "?"}% RSI=${r.rsi14 ?? "?"}`)
      .join("\n");

    let summary = "Test morning brief delivery from admin panel. Markets are quiet across the watchlist; no extreme moves to flag. Not investment advice.";
    try {
      const resp = await chat({
        messages: [
          { role: "system", content: BRIEF_SYSTEM },
          { role: "user", content: `Watchlist snapshot:\n${facts || "(no live data)"}` },
        ],
        temperature: 0.3,
      });
      summary = resp?.choices?.[0]?.message?.content?.trim?.() || summary;
    } catch (e: any) {
      console.warn("[test-brief] AI failed, using fallback", e?.message);
    }

    const highlights = live
      .filter((r) => typeof r.perf5d === "number")
      .sort((a, b) => Math.abs(b.perf5d) - Math.abs(a.perf5d))
      .slice(0, 5)
      .map((r) => ({ symbol: r.symbol, perf5d: r.perf5d, rsi14: r.rsi14 ?? null }));

    // Persist brief_run
    await supabaseAdmin.from("brief_runs").insert({
      user_id: context.userId,
      symbols: data.symbols,
      summary,
      highlights,
    });

    // Render and enqueue
    const tpl = TEMPLATES["morning-brief"];
    if (!tpl) throw new Error("morning-brief template not registered");

    const dateStr = new Date().toISOString().slice(0, 10);
    const templateData = { date: dateStr, symbols: data.symbols, summary, highlights };
    const element = React.createElement(tpl.component, templateData);
    const html = await renderAsync(element);
    const text = await renderAsync(element, { plainText: true });
    const subject = typeof tpl.subject === "function" ? tpl.subject(templateData) : tpl.subject;

    const messageId = crypto.randomUUID();
    const idempotencyKey = `brief-test-${context.userId}-${Date.now()}`;

    // Suppression check
    const { data: suppressed } = await supabaseAdmin
      .from("suppressed_emails").select("id").eq("email", recipient.toLowerCase()).maybeSingle();
    if (suppressed) {
      await supabaseAdmin.from("email_send_log").insert({
        message_id: messageId, template_name: "morning-brief", recipient_email: recipient, status: "suppressed",
      });
      return { ok: false, reason: "suppressed", messageId };
    }

    // Unsub token
    let unsubscribeToken = generateToken();
    await supabaseAdmin.from("email_unsubscribe_tokens")
      .upsert({ token: unsubscribeToken, email: recipient.toLowerCase() }, { onConflict: "email", ignoreDuplicates: true });
    const { data: stored } = await supabaseAdmin.from("email_unsubscribe_tokens")
      .select("token").eq("email", recipient.toLowerCase()).maybeSingle();
    if (stored?.token) unsubscribeToken = stored.token;

    await supabaseAdmin.from("email_send_log").insert({
      message_id: messageId, template_name: "morning-brief", recipient_email: recipient, status: "pending",
    });

    const { error: enqueueError } = await supabaseAdmin.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        message_id: messageId,
        to: recipient,
        from: `Global Equity Terminal <noreply@rankaisolutions.tech>`,
        sender_domain: "notify.rankaisolutions.tech",
        subject,
        html,
        text,
        purpose: "transactional",
        label: "morning-brief",
        idempotency_key: idempotencyKey,
        unsubscribe_token: unsubscribeToken,
        queued_at: new Date().toISOString(),
      },
    });

    if (enqueueError) {
      await supabaseAdmin.from("email_send_log").insert({
        message_id: messageId, template_name: "morning-brief", recipient_email: recipient,
        status: "failed", error_message: enqueueError.message,
      });
      throw new Error("enqueue failed: " + enqueueError.message);
    }

    return { ok: true, messageId, recipient, summaryPreview: summary.slice(0, 120) };
  });

const TestAuthInput = z.object({
  templates: z.array(z.enum(["signup", "magiclink", "recovery", "invite", "email_change", "reauthentication"])).min(1),
  email: z.string().email(),
});

export const triggerTestAuthEmails = createServerFn({ method: "POST" })
  .middleware([supabaseAuthHeaders, requireSupabaseAuth])
  .inputValidator((d) => TestAuthInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);

    const SUPABASE_URL = process.env.SUPABASE_URL!;
    const ANON = process.env.SUPABASE_PUBLISHABLE_KEY!;
    const results: Array<{ template: string; ok: boolean; status: number; body?: string }> = [];

    const post = async (path: string, body: any) => {
      const r = await fetch(`${SUPABASE_URL}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${ANON}` },
        body: JSON.stringify(body),
      });
      return { status: r.status, body: await r.text().catch(() => "") };
    };

    for (const t of data.templates) {
      try {
        let res;
        switch (t) {
          case "magiclink":
          case "signup":
            res = await post("/auth/v1/magiclink", { email: data.email });
            break;
          case "recovery":
            res = await post("/auth/v1/recover", { email: data.email });
            break;
          case "invite":
            res = await post("/auth/v1/invite", { email: data.email });
            break;
          case "reauthentication":
          case "email_change":
            // These require an authenticated session; skip with note
            results.push({ template: t, ok: false, status: 0, body: "requires authenticated session — trigger from app" });
            continue;
        }
        if (res) results.push({ template: t, ok: res.status < 400, status: res.status, body: res.body.slice(0, 200) });
      } catch (e: any) {
        results.push({ template: t, ok: false, status: 0, body: e?.message ?? "error" });
      }
    }

    return { ok: true, results };
  });
