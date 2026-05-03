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

// ---------- in-memory response cache (per worker isolate) ----------
// Identical prompts within the TTL reuse the same answer — saves tokens
// when multiple users hit the same ticker / run the same query in quick
// succession. Safe because all our AI features are deterministic-style
// summarization grounded in supplied facts (low temperature).
type CacheEntry = { at: number; value: any };
const CACHE = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const CACHE_MAX = 200;

function cacheKey(payload: unknown): string {
  // Fast non-crypto hash (FNV-1a 32) on JSON — collisions are acceptable
  // because misses just retry the AI call.
  const s = JSON.stringify(payload);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16) + ":" + s.length;
}

function cacheGet(k: string) {
  const e = CACHE.get(k);
  if (!e) return null;
  if (Date.now() - e.at > CACHE_TTL_MS) {
    CACHE.delete(k);
    return null;
  }
  return e.value;
}

function cacheSet(k: string, value: any) {
  if (CACHE.size >= CACHE_MAX) {
    // Drop oldest entry (Map preserves insertion order)
    const first = CACHE.keys().next().value;
    if (first) CACHE.delete(first);
  }
  CACHE.set(k, { at: Date.now(), value });
}

export async function chat(opts: {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  tools?: any[];
  tool_choice?: any;
  response_format?: any;
  max_tokens?: number;
  /** Skip the in-memory response cache (default: cache enabled). */
  noCache?: boolean;
}): Promise<any> {
  const body = {
    model: opts.model ?? DEFAULT_MODEL,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.2,
    ...(opts.tools ? { tools: opts.tools } : {}),
    ...(opts.tool_choice ? { tool_choice: opts.tool_choice } : {}),
    ...(opts.response_format ? { response_format: opts.response_format } : {}),
    ...(typeof opts.max_tokens === "number" ? { max_tokens: opts.max_tokens } : {}),
  };

  const ck = opts.noCache ? null : cacheKey(body);
  if (ck) {
    const hit = cacheGet(ck);
    if (hit) return hit;
  }

  const res = await fetchWithRetry(GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    // AI calls are slower — give them more headroom per attempt.
    timeoutMs: 30_000,
    label: "ai-gateway",
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`AI gateway ${res.status}: ${txt.slice(0, 200)}`);
  }
  const json = await res.json();
  if (ck) cacheSet(ck, json);
  return json;
}
