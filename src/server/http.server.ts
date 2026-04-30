/**
 * Hardened fetch with timeout + exponential backoff.
 * Server-only. Used for all outbound API calls (Finimpulse, Perplexity, AI gateway).
 *
 * Retry policy:
 *  - Network errors / aborts / TimeoutError  → retry
 *  - HTTP 408, 425, 429, 5xx                 → retry
 *  - All other HTTP responses                → return immediately (caller decides)
 *
 * Default backoff: 250ms, 1s, 4s (3 attempts total).
 * Default per-attempt timeout: 12s.
 */

export interface FetchWithRetryOptions extends RequestInit {
  /** Number of attempts INCLUDING the first one. Default 3. */
  retries?: number;
  /** Per-attempt timeout in ms. Default 12_000. */
  timeoutMs?: number;
  /** Base backoff delay in ms; doubled on subsequent attempts. Default 250. */
  backoffMs?: number;
  /** Optional label for log lines. */
  label?: string;
}

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchWithRetry(
  url: string,
  init: FetchWithRetryOptions = {},
): Promise<Response> {
  const {
    retries = 3,
    timeoutMs = 12_000,
    backoffMs = 250,
    label = url,
    ...fetchInit
  } = init;

  let lastErr: unknown;
  for (let attempt = 1; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(new Error(`timeout after ${timeoutMs}ms`)), timeoutMs);
    try {
      const res = await fetch(url, { ...fetchInit, signal: ctrl.signal });
      clearTimeout(timer);

      if (!RETRYABLE_STATUS.has(res.status)) return res;

      // Retryable status — exhaust budget then return final response.
      if (attempt === retries) return res;
      const wait = backoffMs * 2 ** (attempt - 1);
      console.warn(`[fetchWithRetry] ${label} → ${res.status}, retry ${attempt}/${retries - 1} in ${wait}ms`);
      await sleep(wait);
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      if (attempt === retries) break;
      const wait = backoffMs * 2 ** (attempt - 1);
      console.warn(`[fetchWithRetry] ${label} threw "${(err as Error)?.message ?? err}", retry ${attempt}/${retries - 1} in ${wait}ms`);
      await sleep(wait);
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error(`fetchWithRetry failed: ${label}`);
}
