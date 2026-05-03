// Simple in-memory TTL cache. Per-isolate (resets on cold start), but cuts upstream
// load dramatically for repeated requests within the same session/lifetime.
//
// Usage:
//   const data = await cached("screener:AAPL", 5 * 60_000, () => fetchScreenerRow(u));
//
// Concurrent calls for the same key are deduped via in-flight promise tracking.

type Entry<T> = { value: T; expiresAt: number; storedAt: number };

const store = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

// ---- Observability ---------------------------------------------------------
//
// Per-key counters survive only as long as the Worker isolate (cold starts
// reset them). Good enough for spot-checks via the admin view + worker logs.
export type CacheStat = {
  key: string;
  hits: number;
  misses: number;
  errors: number;
  staleServes: number;
  lastRebuildMs: number | null;
  lastRebuildAt: string | null;
  lastError: string | null;
  lastErrorAt: string | null;
  hasValue: boolean;
  valueAgeMs: number | null;
  expiresInMs: number | null;
};

const stats = new Map<string, Omit<CacheStat, "key" | "hasValue" | "valueAgeMs" | "expiresInMs">>();

function statsFor(key: string) {
  let s = stats.get(key);
  if (!s) {
    s = {
      hits: 0, misses: 0, errors: 0, staleServes: 0,
      lastRebuildMs: null, lastRebuildAt: null,
      lastError: null, lastErrorAt: null,
    };
    stats.set(key, s);
  }
  return s;
}

export function getCacheStats(prefix?: string): CacheStat[] {
  const now = Date.now();
  const out: CacheStat[] = [];
  for (const [key, s] of stats) {
    if (prefix && !key.startsWith(prefix)) continue;
    const entry = store.get(key);
    out.push({
      key,
      ...s,
      hasValue: !!entry,
      valueAgeMs: entry ? now - entry.storedAt : null,
      expiresInMs: entry ? entry.expiresAt - now : null,
    });
  }
  return out.sort((a, b) => a.key.localeCompare(b.key));
}

export async function cached<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const s = statsFor(key);
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && hit.expiresAt > now) {
    s.hits++;
    return hit.value;
  }

  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  s.misses++;
  const startedAt = Date.now();
  const p = (async () => {
    try {
      const value = await loader();
      const finishedAt = Date.now();
      store.set(key, { value, expiresAt: finishedAt + ttlMs, storedAt: finishedAt });
      s.lastRebuildMs = finishedAt - startedAt;
      s.lastRebuildAt = new Date(finishedAt).toISOString();
      return value;
    } catch (err) {
      s.errors++;
      s.lastError = (err as Error)?.message?.slice(0, 500) ?? String(err);
      s.lastErrorAt = new Date().toISOString();
      console.error(`[cache] rebuild failed for "${key}":`, s.lastError);
      throw err;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

/**
 * Stale-while-error: return cached value (even if expired) on loader failure.
 * Tags the returned object (when it is a plain object) with `_stale: true` and
 * `_staleSince` so callers can surface a "data may be outdated" indicator.
 */
export async function cachedSWR<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<T> {
  try {
    return await cached(key, ttlMs, loader);
  } catch (err) {
    const stale = store.get(key) as Entry<T> | undefined;
    if (stale) {
      const s = statsFor(key);
      s.staleServes++;
      console.warn(
        `[cache] serving stale "${key}" (age ${Date.now() - stale.storedAt}ms) after loader error:`,
        (err as Error)?.message,
      );
      // Best-effort tag on object values; leave primitives untouched.
      if (stale.value && typeof stale.value === "object" && !Array.isArray(stale.value)) {
        return { ...(stale.value as object), _stale: true, _staleSince: new Date(stale.storedAt).toISOString() } as T;
      }
      return stale.value;
    }
    throw err;
  }
}

export function cacheBust(prefix?: string) {
  if (!prefix) { store.clear(); return; }
  for (const k of [...store.keys()]) if (k.startsWith(prefix)) store.delete(k);
}
