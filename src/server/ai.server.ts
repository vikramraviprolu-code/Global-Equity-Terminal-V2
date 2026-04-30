/**
 * Lovable AI Gateway helpers (server-only).
 * Used for the ⌘K co-pilot (NL → screener filters / navigation) and
 * the narrative thesis on the terminal page.
 */
import { fetchWithRetry } from "./http.server";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-3-flash-preview";

function key() {
  const k = process.env.LOVABLE_API_KEY;
  if (!k) throw new Error("LOVABLE_API_KEY not configured");
  return k;
}

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function chat(opts: {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  tools?: any[];
  tool_choice?: any;
  response_format?: any;
}): Promise<any> {
  const res = await fetchWithRetry(GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model ?? DEFAULT_MODEL,
      messages: opts.messages,
      temperature: opts.temperature ?? 0.2,
      ...(opts.tools ? { tools: opts.tools } : {}),
      ...(opts.tool_choice ? { tool_choice: opts.tool_choice } : {}),
      ...(opts.response_format ? { response_format: opts.response_format } : {}),
    }),
    // AI calls are slower — give them more headroom per attempt.
    timeoutMs: 30_000,
    label: "ai-gateway",
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`AI gateway ${res.status}: ${txt.slice(0, 200)}`);
  }
  return await res.json();
}
