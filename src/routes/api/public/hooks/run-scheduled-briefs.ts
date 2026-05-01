/**
 * Scheduled Morning Brief runner — invoked hourly by pg_cron.
 *
 * For every brief_schedules row where:
 *   - enabled = true
 *   - hour_utc = current UTC hour
 *   - last_run_at is null OR before today (UTC)
 * generate a one-paragraph AI brief over the row's symbols and persist it
 * to brief_runs (so the user sees it in-app on their next visit).
 *
 * Public route (/api/public/*) — no auth needed; uses service-role client.
 * Idempotent: runs at most once per user per UTC day thanks to the
 * last_run_at gate.
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { chat } from "@/server/ai.server";
import { fetchScreenerRow } from "@/server/finimpulse.server";
import { UNIVERSE } from "@/server/universe";

const BRIEF_SYSTEM = `You are an equity research desk producing a concise morning brief for a watchlist.

STRICT RULES:
- 90–160 words, plain prose, 1–2 short paragraphs.
- Lead with the 2–3 most notable moves (largest 5D % moves, breakouts, oversold flips).
- Mention which tickers look hot, which look weak, and any cluster (e.g. "EU industrials all weak").
- Use ONLY the metrics provided. Never invent news, prices, or guidance.
- Never name news publishers or quote articles verbatim.
- End with: "Not investment advice."`;

async function generateOne(symbols: string[]) {
  if (symbols.length === 0) return null;
  const lookup: Record<string, any> = {};
  UNIVERSE.forEach((u) => { lookup[u.symbol] = u; });
  const rows = await Promise.all(
    symbols.slice(0, 30).map(async (sym) => {
      const u = lookup[sym] ?? { symbol: sym, name: sym, exchange: "UNKNOWN", country: "Unknown", region: "OTHER" as const, currency: "USD", sector: "Unknown", industry: "Unknown" };
      return await fetchScreenerRow(u).catch(() => null);
    }),
  );
  const live = rows.filter(Boolean) as any[];
  if (live.length === 0) return null;

  const facts = live
    .map((r) => `${r.symbol} (${r.name ?? r.symbol}) ${r.region ?? "?"} ${r.sector ?? "?"} | px=${r.price ?? "?"} 5D=${r.perf5d ?? "?"}% RSI=${r.rsi14 ?? "?"} PE=${r.pe ?? "?"}`)
    .join("\n");

  const resp = await chat({
    messages: [
      { role: "system", content: BRIEF_SYSTEM },
      { role: "user", content: `Watchlist snapshot (${live.length} tickers):\n${facts}` },
    ],
    temperature: 0.3,
  });
  const summary = resp?.choices?.[0]?.message?.content?.trim?.() ?? "";
  if (!summary) return null;

  const highlights = [...live]
    .filter((r) => typeof r.perf5d === "number")
    .sort((a, b) => Math.abs(b.perf5d) - Math.abs(a.perf5d))
    .slice(0, 5)
    .map((r) => ({ symbol: r.symbol, perf5d: r.perf5d, rsi14: r.rsi14 ?? null }));

  return { summary, highlights };
}

export const Route = createFileRoute("/api/public/hooks/run-scheduled-briefs")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const now = new Date();
        const hourUtc = now.getUTCHours();
        const todayUtcStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();

        const { data: schedules, error } = await supabaseAdmin
          .from("brief_schedules")
          .select("*")
          .eq("enabled", true)
          .eq("hour_utc", hourUtc);

        if (error) {
          console.error("[scheduled-briefs] load error", error);
          return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
        }

        const due = (schedules ?? []).filter((s: any) => !s.last_run_at || new Date(s.last_run_at).toISOString() < todayUtcStart);
        let processed = 0;
        let failed = 0;

        for (const s of due) {
          try {
            const symbols: string[] = Array.isArray(s.symbols) ? s.symbols : [];
            if (symbols.length === 0) {
              await supabaseAdmin.from("brief_schedules").update({ last_run_at: now.toISOString() }).eq("id", s.id);
              continue;
            }
            const res = await generateOne(symbols);
            if (!res) {
              failed += 1;
              continue;
            }
            await supabaseAdmin.from("brief_runs").insert({
              user_id: s.user_id,
              symbols,
              summary: res.summary,
              highlights: res.highlights,
            });
            await supabaseAdmin.from("brief_schedules").update({ last_run_at: now.toISOString() }).eq("id", s.id);
            processed += 1;

            // v1.8 — optional email delivery
            if (s.email_enabled) {
              try {
                let recipient: string | null = s.email_to ?? null;
                if (!recipient) {
                  const { data: userResp } = await supabaseAdmin.auth.admin.getUserById(s.user_id);
                  recipient = userResp?.user?.email ?? null;
                }
                if (recipient) {
                  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
                  const origin = new URL(request.url).origin;
                  const sendUrl = `${origin}/lovable/email/transactional/send`;
                  const dateStr = new Date(now).toISOString().slice(0, 10);
                  const r = await fetch(sendUrl, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${serviceKey}`,
                    },
                    body: JSON.stringify({
                      templateName: "morning-brief",
                      recipientEmail: recipient,
                      idempotencyKey: `brief-${s.user_id}-${dateStr}`,
                      templateData: {
                        date: dateStr,
                        symbols,
                        summary: res.summary,
                        highlights: res.highlights,
                      },
                    }),
                  });
                  if (!r.ok) {
                    console.warn("[scheduled-briefs] email send failed", s.user_id, r.status, await r.text().catch(() => ""));
                  }
                }
              } catch (mailErr: any) {
                console.warn("[scheduled-briefs] email error", s.user_id, mailErr?.message ?? mailErr);
              }
            }
          } catch (e: any) {
            console.error("[scheduled-briefs] user error", s.user_id, e?.message ?? e);
            failed += 1;
          }
        }

        return new Response(
          JSON.stringify({ ok: true, hourUtc, candidates: schedules?.length ?? 0, processed, failed }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
