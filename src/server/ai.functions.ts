import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { chat } from "./ai.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAuthHeaders } from "./supabase-auth-headers";

// ----- 1. Co-pilot: parse natural-language query into a structured intent -----

const PARSE_TOOL = {
  type: "function",
  function: {
    name: "build_intent",
    description:
      "Map a user's natural-language stock query to either screener filters or a navigation intent.",
    parameters: {
      type: "object",
      properties: {
        kind: {
          type: "string",
          enum: ["screen", "ticker", "navigate", "unknown"],
          description:
            "screen = run screener with filters; ticker = open the analysis terminal for a single symbol; navigate = jump to a known route; unknown = could not interpret.",
        },
        // ticker intent
        symbol: { type: "string", description: "Ticker symbol with exchange suffix when not US (e.g. AAPL, RELIANCE.NS, 7203.T)." },
        // navigate intent
        route: { type: "string", enum: ["/", "/terminal", "/compare", "/watchlist", "/events", "/data-quality", "/sources"] },
        // screen intent — subset of the screener's URL filters
        preset: {
          type: "string",
          enum: ["all", "valueLow", "momentum", "quality", "oversold", "breakout", "reliable"],
        },
        region: {
          type: "string",
          enum: ["", "US", "IN", "EU", "JP", "HK", "KR", "TW", "AU", "SG", "CN"],
          description: "Empty string for all regions.",
        },
        sector: { type: "string", description: 'Free-form sector match e.g. "Technology", "Energy". Empty string if none.' },
        q: { type: "string", description: "Symbol/name search keyword. Empty string if none." },
        minMcap: { type: "number", description: "Min market cap in USD. 0 if none." },
        peMax: { type: ["number", "null"] },
        pbMax: { type: ["number", "null"] },
        dyMin: { type: ["number", "null"], description: "Min dividend yield in percent." },
        rsiMin: { type: "number" },
        rsiMax: { type: "number" },
        near52wLowPct: { type: ["number", "null"], description: "Max % above 52w low." },
        rocMin: { type: ["number", "null"] },
        maCross: { type: "string", enum: ["any", "golden", "death", "above50", "above200"] },
        minConfidence: { type: "number" },
        sortBy: {
          type: "string",
          enum: [
            "symbol", "name", "sector", "price", "marketCapUsd", "pe", "pb", "dividendYield",
            "pctFromLow", "perf5d", "rsi14", "value", "momentum", "quality", "risk", "confidence",
          ],
        },
        sortDir: { type: "string", enum: ["asc", "desc"] },
        explain: {
          type: "string",
          description: "One short sentence (≤ 18 words) that paraphrases the filters back to the user.",
        },
      },
      required: ["kind", "explain"],
      additionalProperties: false,
    },
  },
} as const;

const SYSTEM_PARSE = `You are a finance assistant for a global equity research terminal. Translate the user's free-form request into a structured intent by calling the build_intent tool.

Rules:
- Only call build_intent. Never reply with prose.
- Default to kind="screen" unless the user clearly names ONE ticker (kind="ticker") or asks to go to a specific page (kind="navigate").
- For ticker intent, normalize: NYSE/NASDAQ has no suffix; otherwise add the standard Yahoo-style suffix (.NS India NSE, .BO India BSE, .L London, .DE Xetra, .PA Paris, .AS Amsterdam, .MI Milan, .MC Madrid, .ST Stockholm, .HE Helsinki, .CO Copenhagen, .OL Oslo, .SW Swiss, .T Tokyo, .HK Hong Kong, .KS Korea KOSPI, .KQ Korea KOSDAQ, .TW Taiwan, .AX ASX, .SI Singapore, .SS Shanghai, .SZ Shenzhen).
- For screens, prefer the closest preset and then layer on filters. "small cap" = minMcap up to 2e9; "mid" 2e9-10e9 (still set minMcap=2e9); "large" minMcap=10e9; "mega" 100e9.
- "Cheap / value / undervalued" → preset "valueLow" or peMax≈15.
- "Momentum / breaking out / strong" → preset "momentum" or "breakout".
- "Oversold / beaten down" → preset "oversold" or rsiMax≈35.
- "High dividend / income" → dyMin≈3.
- "Helsinki / Finnish" → region="EU", q ignored. "Indian" → region="IN". "Japanese" → region="JP".
- Always fill "explain" with a friendly paraphrase. Use empty strings ("") not nulls for string fields you don't set; use 0 for unused numbers; use null only where the schema allows null.`;

export const aiParseQuery = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ q: z.string().min(1).max(300) }).parse(d))
  .handler(async ({ data }) => {
    try {
      const resp = await chat({
        messages: [
          { role: "system", content: SYSTEM_PARSE },
          { role: "user", content: data.q },
        ],
        tools: [PARSE_TOOL as any],
        tool_choice: { type: "function", function: { name: "build_intent" } },
        temperature: 0,
      });
      const call = resp?.choices?.[0]?.message?.tool_calls?.[0];
      const args = call?.function?.arguments;
      if (!args) return { kind: "unknown" as const, explain: "Could not interpret that query.", error: null as string | null };
      const parsed = typeof args === "string" ? JSON.parse(args) : args;
      return { ...parsed, error: null as string | null };
    } catch (e: any) {
      const msg: string = e?.message ?? "AI request failed";
      let friendly = "AI assistant is temporarily unavailable.";
      if (msg.includes("429")) friendly = "Rate limit hit — please retry in a few seconds.";
      else if (msg.includes("402")) friendly = "AI credits exhausted. Add credits in Workspace Settings → Usage.";
      return { kind: "unknown" as const, explain: friendly, error: friendly };
    }
  });

// ----- 2. Narrative thesis for an analyzed ticker -----

const SYSTEM_NARRATIVE = `You are a sober, evidence-based equity analyst. Write a concise plain-English thesis for the stock summarized below.

STRICT RULES:
- 110–160 words, 3 short paragraphs.
- Paragraph 1: what this company is and the current setup (price vs MAs, momentum).
- Paragraph 2: valuation (P/E, P/B, dividend, vs 52w range) and quality/risk highlights.
- Paragraph 3: the case FOR and the case AGAINST in one or two sentences each, then the takeaway aligned with the provided recommendation.
- Use ONLY the numbers provided. Never invent metrics, news, or future prices.
- No bullet lists, no headings, no markdown. Plain prose only.
- End with: "Not investment advice."`;

export const aiTickerNarrative = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        symbol: z.string().min(1).max(20),
        facts: z.string().min(1).max(4000), // pre-formatted facts string from caller
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    try {
      const resp = await chat({
        messages: [
          { role: "system", content: SYSTEM_NARRATIVE },
          { role: "user", content: `Stock: ${data.symbol}\n\nFacts:\n${data.facts}` },
        ],
        temperature: 0.3,
      });
      const text = resp?.choices?.[0]?.message?.content?.trim?.() ?? "";
      if (!text) return { text: "", error: "Empty response from AI." };
      return { text, error: null as string | null };
    } catch (e: any) {
      const msg: string = e?.message ?? "AI request failed";
      let friendly = "AI narrative is temporarily unavailable.";
      if (msg.includes("429")) friendly = "Rate limit hit — please retry in a few seconds.";
      else if (msg.includes("402")) friendly = "AI credits exhausted. Add credits in Workspace Settings → Usage.";
      return { text: "", error: friendly };
    }
  });
