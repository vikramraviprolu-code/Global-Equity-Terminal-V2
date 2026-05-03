/**
 * v1.6 "Differentiator" server functions:
 *   - askTerminal:    conversational Q&A grounded in the on-screen ticker context
 *   - generateBrief:  AI Morning Brief over a user's watchlist symbols
 *   - upsertThesis / listTheses / deleteThesis / evaluateThesis: thesis tracker
 *
 * All AI calls go through the Lovable AI Gateway (ai.server.ts → chat()).
 * Database access uses the authenticated supabase client provided by the
 * requireSupabaseAuth middleware (RLS scopes everything to the caller).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { chat } from "./ai.server";
import { supabaseAuthHeaders } from "./supabase-auth-headers";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fetchScreenerRow } from "./finimpulse.server";
import { UNIVERSE } from "./universe";

// ===========================================================================
// 1. Ask the Terminal — chat docked to a ticker page
// ===========================================================================

const ASK_SYSTEM = `You are an evidence-based equity research co-pilot embedded in a stock terminal.

CONTEXT: The user is looking at a specific ticker. The "Facts" block below contains the ONLY numbers you may rely on (price, valuation, momentum, recommendation, recent news headlines paraphrased).

STRICT RULES:
- Use ONLY the facts provided. If the user asks something not covered, say so plainly and suggest what they could check.
- Never invent numbers, prices, target prices, future earnings, or unsourced claims.
- Never quote news articles verbatim. Paraphrase only.
- Keep answers tight: 2–6 sentences, plain prose, no headings.
- If asked for advice, decline ("I can't give investment advice") and explain the trade-offs neutrally instead.
- End substantive answers with: "Not investment advice."`;

const askMessage = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(2000),
});

export const askTerminal = createServerFn({ method: "POST" })
  .middleware([supabaseAuthHeaders, requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        symbol: z.string().min(1).max(20),
        facts: z.string().min(1).max(6000),
        history: z.array(askMessage).max(20),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    try {
      const resp = await chat({
        messages: [
          { role: "system", content: ASK_SYSTEM },
          {
            role: "user",
            content: `Ticker: ${data.symbol}\n\nFacts:\n${data.facts}\n\n— The conversation follows. Answer the user's most recent question.`,
          },
          ...data.history.map((m) => ({ role: m.role, content: m.content })),
        ],
        temperature: 0.2,
      });
      const text = resp?.choices?.[0]?.message?.content?.trim?.() ?? "";
      if (!text) return { text: "", error: "Empty response from AI." };
      return { text, error: null as string | null };
    } catch (e: any) {
      const msg: string = e?.message ?? "AI request failed";
      let friendly = "AI assistant is temporarily unavailable.";
      if (msg.includes("429")) friendly = "Rate limit hit — please retry in a few seconds.";
      else if (msg.includes("402")) friendly = "AI credits exhausted. Add credits in Workspace Settings → Usage.";
      return { text: "", error: friendly };
    }
  });

// ===========================================================================
// 2. AI Morning Brief — digest of overnight moves over a watchlist
// ===========================================================================

const BRIEF_SYSTEM = `You are an equity research desk producing a concise morning brief for a watchlist.

STRICT RULES:
- 90–160 words, plain prose, 1–2 short paragraphs.
- Lead with the 2–3 most notable moves (largest 5D % moves, breakouts, oversold flips).
- Mention which tickers look hot, which look weak, and any cluster (e.g. "EU industrials all weak").
- Use ONLY the metrics provided. Never invent news, prices, or guidance.
- Never name news publishers or quote articles verbatim.
- End with: "Not investment advice."`;

export const generateBrief = createServerFn({ method: "POST" })
  .middleware([supabaseAuthHeaders, requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        symbols: z.array(z.string().min(1).max(20)).min(1).max(30),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    try {
      // Fetch fresh quotes for each symbol (cap at 30 to keep latency sane)
      const lookup: Record<string, any> = {};
      UNIVERSE.forEach((u) => { lookup[u.symbol] = u; });
      const rows = await Promise.all(
        data.symbols.map(async (sym) => {
          const u = lookup[sym] ?? { symbol: sym, name: sym, exchange: "UNKNOWN", country: "Unknown", region: "OTHER" as const, currency: "USD", sector: "Unknown", industry: "Unknown" };
          const r = await fetchScreenerRow(u).catch(() => null);
          return r;
        }),
      );
      const live = rows.filter(Boolean) as any[];
      if (live.length === 0) {
        return { summary: "", highlights: [], error: "No live data available for these symbols." };
      }

      // Compact fact block: symbol, name, price, 5D%, RSI, P/E, sector, region
      const facts = live
        .map((r) =>
          `${r.symbol} (${r.name ?? r.symbol}) ${r.region ?? "?"} ${r.sector ?? "?"} | px=${r.price ?? "?"} 5D=${r.perf5d ?? "?"}% RSI=${r.rsi14 ?? "?"} PE=${r.pe ?? "?"}`,
        )
        .join("\n");

      const resp = await chat({
        messages: [
          { role: "system", content: BRIEF_SYSTEM },
          { role: "user", content: `Watchlist snapshot (${live.length} tickers):\n${facts}` },
        ],
        temperature: 0.3,
      });
      const summary = resp?.choices?.[0]?.message?.content?.trim?.() ?? "";
      if (!summary) return { summary: "", highlights: [], error: "Empty response from AI." };

      // Sort top movers (abs 5D %) for highlight chips
      const highlights = [...live]
        .filter((r) => typeof r.perf5d === "number")
        .sort((a, b) => Math.abs(b.perf5d) - Math.abs(a.perf5d))
        .slice(0, 5)
        .map((r) => ({ symbol: r.symbol, perf5d: r.perf5d, rsi14: r.rsi14 ?? null }));

      // Persist for history
      await context.supabase.from("brief_runs").insert({
        user_id: context.userId,
        symbols: data.symbols,
        summary,
        highlights,
      });

      return { summary, highlights, error: null as string | null };
    } catch (e: any) {
      const msg: string = e?.message ?? "AI request failed";
      let friendly = "Morning brief temporarily unavailable.";
      if (msg.includes("429")) friendly = "Rate limit hit — please retry in a few seconds.";
      else if (msg.includes("402")) friendly = "AI credits exhausted. Add credits in Workspace Settings → Usage.";
      return { summary: "", highlights: [], error: friendly };
    }
  });

export const listBriefs = createServerFn({ method: "GET" })
  .middleware([supabaseAuthHeaders, requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("brief_runs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) throw new Error(error.message);
    return { briefs: data ?? [] };
  });

// ===========================================================================
// 3. Thesis Tracker — write a thesis, AI re-evaluates against current setup
// ===========================================================================

const THESIS_SYSTEM = `You are an evidence-based equity analyst evaluating whether an investor's thesis still holds.

STRICT RULES:
- Use ONLY the metrics provided. Never invent news, prices, or guidance.
- Decide one of: "intact" (thesis holds), "monitor" (mostly holding but one signal weak), "breaking" (multiple signals weakening), "broken" (thesis disproved by current setup).
- Then write 2–4 sentences of plain-prose rationale grounded in the numbers.
- Never name news publishers or quote articles verbatim.
- Output a JSON object via the evaluate_thesis tool. No prose outside the tool call.`;

const THESIS_TOOL = {
  type: "function",
  function: {
    name: "evaluate_thesis",
    description: "Evaluate whether an investor's thesis on a stock is still intact based on the provided metrics.",
    parameters: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["intact", "monitor", "breaking", "broken"] },
        rationale: { type: "string", description: "2–4 sentence plain-prose explanation grounded in the metrics." },
      },
      required: ["status", "rationale"],
      additionalProperties: false,
    },
  },
} as const;

const ThesisInput = z.object({
  symbol: z.string().min(1).max(20),
  thesis: z.string().min(10).max(2000),
});

export const upsertThesis = createServerFn({ method: "POST" })
  .middleware([supabaseAuthHeaders, requireSupabaseAuth])
  .inputValidator((d) => ThesisInput.parse(d))
  .handler(async ({ data, context }) => {
    const sym = data.symbol.toUpperCase();
    const { data: row, error } = await context.supabase
      .from("theses")
      .upsert(
        {
          user_id: context.userId,
          symbol: sym,
          thesis: data.thesis,
          status: "unknown",
          rationale: null,
          evaluated_at: null,
        },
        { onConflict: "user_id,symbol" },
      )
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { thesis: row };
  });

export const listTheses = createServerFn({ method: "GET" })
  .middleware([supabaseAuthHeaders, requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("theses")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { theses: data ?? [] };
  });

export const deleteThesis = createServerFn({ method: "POST" })
  .middleware([supabaseAuthHeaders, requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("theses").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const evaluateThesis = createServerFn({ method: "POST" })
  .middleware([supabaseAuthHeaders, requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: t, error: e1 } = await context.supabase
      .from("theses")
      .select("*")
      .eq("id", data.id)
      .single();
    if (e1 || !t) throw new Error(e1?.message ?? "Thesis not found");

    // Fetch a fresh fact snapshot for this ticker
    const u = UNIVERSE.find((x) => x.symbol === t.symbol)
      ?? { symbol: t.symbol, name: t.symbol, exchange: "UNKNOWN", country: "Unknown", region: "OTHER" as const, currency: "USD", sector: "Unknown", industry: "Unknown" };
    const row = await fetchScreenerRow(u).catch(() => null);
    if (!row) {
      return { status: "unknown", rationale: "Live data unavailable for this ticker — could not evaluate.", error: null as string | null };
    }
    const facts = `Symbol: ${row.symbol}\nName: ${row.name ?? row.symbol}\nSector: ${row.sector ?? "?"}\nRegion: ${row.region ?? "?"}\nPrice: ${row.price ?? "?"}\n5D %: ${row.perf5d ?? "?"}\nRSI(14): ${row.rsi14 ?? "?"}\nP/E: ${row.pe ?? "?"}\nP/B: ${row.pb ?? "?"}\nDividend yield: ${row.dividendYield ?? "?"}\n% from 52w low: ${row.pctFromLow ?? "?"}`;

    try {
      const resp = await chat({
        messages: [
          { role: "system", content: THESIS_SYSTEM },
          { role: "user", content: `Investor's thesis on ${t.symbol}:\n"${t.thesis}"\n\nCurrent metrics:\n${facts}` },
        ],
        tools: [THESIS_TOOL as any],
        tool_choice: { type: "function", function: { name: "evaluate_thesis" } },
        temperature: 0.2,
      });
      const call = resp?.choices?.[0]?.message?.tool_calls?.[0];
      const args = call?.function?.arguments;
      if (!args) return { status: "unknown", rationale: "AI did not return a verdict.", error: "Empty AI response." };
      const parsed = typeof args === "string" ? JSON.parse(args) : args;
      const status = parsed.status as string;
      const rationale = parsed.rationale as string;

      await context.supabase
        .from("theses")
        .update({ status, rationale, evaluated_at: new Date().toISOString() })
        .eq("id", t.id);

      // v1.7: Alerts × Theses — auto-fire an alert event when a thesis flips
      // to a breaking/broken state (only on transition from a non-broken
      // prior status, so re-evaluating a still-broken thesis doesn't spam).
      const wasBroken = t.status === "breaking" || t.status === "broken";
      const isBroken = status === "breaking" || status === "broken";
      if (isBroken && !wasBroken) {
        const message = `Thesis on ${t.symbol} is ${status} — ${rationale.slice(0, 200)}`;
        await context.supabase.from("alert_events").insert({
          user_id: context.userId,
          alert_id: t.id, // thesis id (no FK on alert_events.alert_id)
          symbol: t.symbol,
          alert_type: "thesis_break" as any,
          threshold: 0,
          value_at_trigger: 0,
          message,
        });
      }

      return { status, rationale, error: null as string | null };
    } catch (e: any) {
      const msg: string = e?.message ?? "AI request failed";
      let friendly = "Thesis evaluator temporarily unavailable.";
      if (msg.includes("429")) friendly = "Rate limit hit — please retry in a few seconds.";
      else if (msg.includes("402")) friendly = "AI credits exhausted. Add credits in Workspace Settings → Usage.";
      return { status: "unknown", rationale: "", error: friendly };
    }
  });
