import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { fetchWithRetry } from "./http.server";

/**
 * News & Catalysts via Perplexity — answers "what's moving this stock?"
 * with grounded web search and citations. Falls back gracefully when the
 * key is missing or upstream errors out.
 */

const SYSTEM = `You are a sober equity-market news analyst. Given a ticker (and optional company name) and a user question, summarize what is currently moving the stock based on the most recent news.

STRICT RULES:
- 120–200 words total, plain prose, no markdown headings.
- Lead with the 1–3 most important catalysts (earnings, guidance, M&A, regulatory, macro, sector rotation) with dates when available.
- Be specific: cite numbers (EPS beat/miss %, price moves, deal size) when sources mention them.
- Distinguish facts from analyst opinion ("analysts at X said…").
- Paraphrase in your own words. Do NOT quote source articles verbatim. Do NOT reproduce headlines, sentences, or paragraphs from the underlying sources — summarize the substance only. Keep any unavoidable proper-noun phrases short (≤7 consecutive words).
- Do not name specific publishers in the body of the summary; the citation list shows sources separately.
- If little is happening, say so plainly — do not invent catalysts.
- End with a single line: "Not investment advice."`;

export const aiNewsCatalysts = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        symbol: z.string().min(1).max(20),
        name: z.string().max(120).optional(),
        question: z.string().max(300).optional(),
        recency: z.enum(["day", "week", "month"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) {
      console.error("News service misconfigured: PERPLEXITY_API_KEY is not set");
      return {
        text: "",
        citations: [] as string[],
        error: "News service is not currently available.",
      };
    }

    const who = data.name ? `${data.symbol} (${data.name})` : data.symbol;
    const userPrompt =
      (data.question?.trim() ||
        `What is moving ${who} stock right now? Summarize the latest catalysts, news, earnings, guidance, analyst actions, and any sector/macro drivers.`) +
      `\n\nFocus on the ticker ${data.symbol}. Use reputable financial sources. Paraphrase only — do not quote source text verbatim.`;

    try {
      const resp = await fetchWithRetry("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "sonar",
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.2,
          search_recency_filter: data.recency ?? "week",
        }),
        timeoutMs: 30_000,
        label: "perplexity-news",
      });

      if (!resp.ok) {
        const body = await resp.text().catch(() => "");
        console.error(`Perplexity API error [${resp.status}]: ${body.slice(0, 500)}`);
        let friendly = "News service is temporarily unavailable.";
        if (resp.status === 401) friendly = "News service authentication failed.";
        else if (resp.status === 429) friendly = "News rate limit hit — please retry in a moment.";
        else if (resp.status === 402) friendly = "News service credits exhausted.";
        return { text: "", citations: [] as string[], error: friendly };
      }

      const json: any = await resp.json();
      const text: string = json?.choices?.[0]?.message?.content?.trim?.() ?? "";
      const citations: string[] = Array.isArray(json?.citations)
        ? json.citations.filter((u: any) => typeof u === "string")
        : [];

      if (!text) {
        return { text: "", citations: [], error: "Empty response from news service." };
      }
      return { text, citations, error: null as string | null };
    } catch (e: any) {
      console.error("Perplexity request failed:", e?.message ?? e);
      return {
        text: "",
        citations: [] as string[],
        error: "News service request failed. Please retry.",
      };
    }
  });
