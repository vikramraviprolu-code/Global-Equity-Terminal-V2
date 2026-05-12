import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAuthHeaders } from "./supabase-auth-headers";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fetchScreenerRow } from "./finimpulse.server";
import { UNIVERSE } from "./universe";

const ALERT_TYPES = [
  "price_above", "price_below",
  "rsi_above", "rsi_below",
  "near_52w_high", "near_52w_low",
  "pct_change_above", "pct_change_below",
] as const;
export type AlertType = (typeof ALERT_TYPES)[number];

const AlertInput = z.object({
  symbol: z.string().min(1).max(20),
  alertType: z.enum(ALERT_TYPES),
  threshold: z.number().finite(),
  taskId: z.string().uuid().optional().nullable(),
});

export const listAlerts = createServerFn({ method: "GET" })
  .middleware([supabaseAuthHeaders, requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("alerts").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { alerts: data ?? [] };
  });

export const addAlert = createServerFn({ method: "POST" })
  .middleware([supabaseAuthHeaders, requireSupabaseAuth])
  .inputValidator((d) => AlertInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error, data: row } = await context.supabase
      .from("alerts")
      .insert({
        user_id: context.userId,
        symbol: data.symbol.toUpperCase(),
        alert_type: data.alertType,
        threshold: data.threshold,
        active: true,
        task_id: data.taskId || null,
      })
      .select().single();
    if (error) throw new Error(error.message);
    return { alert: row };
  });

export const toggleAlert = createServerFn({ method: "POST" })
  .middleware([supabaseAuthHeaders, requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("alerts").update({ active: data.active }).eq("id", data.id).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAlert = createServerFn({ method: "POST" })
  .middleware([supabaseAuthHeaders, requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("alerts").delete().eq("id", data.id).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Alert events (notifications) ----------

export const listAlertEvents = createServerFn({ method: "GET" })
  .middleware([supabaseAuthHeaders, requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("alert_events").select("*").order("created_at", { ascending: false }).limit(50);
    if (error) throw new Error(error.message);
    const unreadCount = (data ?? []).filter((e: any) => !e.read).length;
    return { events: data ?? [], unreadCount };
  });

export const markAlertEventsRead = createServerFn({ method: "POST" })
  .middleware([supabaseAuthHeaders, requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("alert_events").update({ read: true }).eq("user_id", context.userId).eq("read", false);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Evaluation ----------

const TYPE_LABEL: Record<AlertType, (sym: string, t: number, v: number) => string> = {
  price_above: (s, t, v) => `${s} crossed above ${t.toFixed(2)} (now ${v.toFixed(2)})`,
  price_below: (s, t, v) => `${s} dropped below ${t.toFixed(2)} (now ${v.toFixed(2)})`,
  rsi_above: (s, t, v) => `${s} RSI ${v.toFixed(1)} crossed above ${t.toFixed(0)}`,
  rsi_below: (s, t, v) => `${s} RSI ${v.toFixed(1)} dropped below ${t.toFixed(0)}`,
  near_52w_high: (s, t, v) => `${s} is within ${t.toFixed(1)}% of 52w high (now ${v.toFixed(2)}%)`,
  near_52w_low: (s, t, v) => `${s} is within ${t.toFixed(1)}% of 52w low (now ${v.toFixed(2)}%)`,
  pct_change_above: (s, t, v) => `${s} 5d perf ${v.toFixed(2)}% crossed above ${t.toFixed(1)}%`,
  pct_change_below: (s, t, v) => `${s} 5d perf ${v.toFixed(2)}% dropped below ${t.toFixed(1)}%`,
};

function evaluate(type: AlertType, threshold: number, q: any): { fires: boolean; value: number } | null {
  if (!q) return null;
  switch (type) {
    case "price_above": return q.price != null ? { fires: q.price >= threshold, value: q.price } : null;
    case "price_below": return q.price != null ? { fires: q.price <= threshold, value: q.price } : null;
    case "rsi_above": return q.rsi14 != null ? { fires: q.rsi14 >= threshold, value: q.rsi14 } : null;
    case "rsi_below": return q.rsi14 != null ? { fires: q.rsi14 <= threshold, value: q.rsi14 } : null;
    case "near_52w_high": return q.pctFromHigh != null ? { fires: Math.abs(q.pctFromHigh) <= threshold, value: q.pctFromHigh } : null;
    case "near_52w_low": return q.pctFromLow != null ? { fires: q.pctFromLow <= threshold, value: q.pctFromLow } : null;
    case "pct_change_above": return q.perf5d != null ? { fires: q.perf5d >= threshold, value: q.perf5d } : null;
    case "pct_change_below": return q.perf5d != null ? { fires: q.perf5d <= threshold, value: q.perf5d } : null;
  }
}

/**
 * Evaluate the current user's active alerts against fresh quotes.
 * Re-fires each at most once per 12h (last_fired_at gate).
 */
export const evaluateMyAlerts = createServerFn({ method: "POST" })
  .middleware([supabaseAuthHeaders, requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: alerts, error } = await context.supabase
      .from("alerts").select("*").eq("active", true);
    if (error) throw new Error(error.message);
    if (!alerts || alerts.length === 0) return { fired: 0 };

    const symbols = Array.from(new Set(alerts.map((a: any) => a.symbol)));
    const lookup: Record<string, any> = {};
    UNIVERSE.forEach((u) => { lookup[u.symbol] = u; });
    const entries = await Promise.all(symbols.map(async (s) => {
      const u = lookup[s] ?? { symbol: s, name: s, exchange: "UNKNOWN", country: "Unknown", region: "OTHER" as const, currency: "USD", sector: "Unknown", industry: "Unknown" };
      return [s, await fetchScreenerRow(u).catch(() => null)] as const;
    }));
    const quotes = new Map(entries);

    const COOLDOWN_MS = 12 * 60 * 60 * 1000;
    const now = Date.now();
    const toFire: Array<{ alert: any; value: number; message: string }> = [];

    for (const a of alerts) {
      if (a.last_fired_at && now - new Date(a.last_fired_at).getTime() < COOLDOWN_MS) continue;
      const q = quotes.get(a.symbol);
      const r = evaluate(a.alert_type as AlertType, Number(a.threshold), q);
      if (!r || !r.fires) continue;
      const message = TYPE_LABEL[a.alert_type as AlertType](a.symbol, Number(a.threshold), r.value);
      toFire.push({ alert: a, value: r.value, message });
    }

    if (toFire.length === 0) return { fired: 0 };

    const events = toFire.map(({ alert, value, message }) => ({
      user_id: context.userId,
      alert_id: alert.id,
      symbol: alert.symbol,
      alert_type: alert.alert_type,
      threshold: alert.threshold,
      value_at_trigger: value,
      message,
    }));
    const { error: insErr } = await context.supabase.from("alert_events").insert(events);
    if (insErr) throw new Error(insErr.message);

    // Mark last_fired_at
    await Promise.all(toFire.map(({ alert }) =>
      context.supabase.from("alerts").update({ last_fired_at: new Date().toISOString() }).eq("id", alert.id)
    ));

    return { fired: toFire.length };
  });

// ---------- Task-Alert Linking ----------

export const linkAlertToTask = createServerFn({ method: "POST" })
  .middleware([supabaseAuthHeaders, requireSupabaseAuth])
  .inputValidator((d) => z.object({
    alertId: z.string().uuid(),
    taskId: z.string().uuid(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    // Verify both belong to the user
    const { data: alert, error: alertError } = await context.supabase
      .from("alerts")
      .select("id")
      .eq("id", data.alertId)
      .eq("user_id", context.userId)
      .single();

    if (alertError || !alert) throw new Error("Alert not found");

    const { data: task, error: taskError } = await context.supabase
      .from("tasks")
      .select("id")
      .eq("id", data.taskId)
      .eq("user_id", context.userId)
      .single();

    if (taskError || !task) throw new Error("Task not found");

    // Link the alert to the task
    const { error: updateError } = await context.supabase
      .from("alerts")
      .update({ task_id: data.taskId })
      .eq("id", data.alertId)
      .eq("user_id", context.userId);

    if (updateError) throw new Error(updateError.message);

    return { ok: true };
  });

export const unlinkAlertFromTask = createServerFn({ method: "POST" })
  .middleware([supabaseAuthHeaders, requireSupabaseAuth])
  .inputValidator((d) => z.object({ alertId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("alerts")
      .update({ task_id: null })
      .eq("id", data.alertId)
      .eq("user_id", context.userId);

    if (error) throw new Error(error.message);

    return { ok: true };
  });

export const getAlertsForTask = createServerFn({ method: "GET" })
  .middleware([supabaseAuthHeaders, requireSupabaseAuth])
  .inputValidator((d) => z.object({ taskId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: alerts, error } = await context.supabase
      .from("alerts")
      .select("*")
      .eq("task_id", data.taskId)
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    return { alerts: alerts ?? [] };
  });

export const disableAlertsForTask = createServerFn({ method: "POST" })
  .middleware([supabaseAuthHeaders, requireSupabaseAuth])
  .inputValidator((d) => z.object({ taskId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("alerts")
      .update({ active: false })
      .eq("task_id", data.taskId)
      .eq("user_id", context.userId);

    if (error) throw new Error(error.message);

    return { ok: true };
  });
