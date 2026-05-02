// Simple in-memory TTL cache. Per-isolate (resets on cold start), but cuts upstream
// load dramatically for repeated requests within the same session/lifetime.
//
// Usage:
//   const data = await cached("screener:AAPL", 5 * 60_000, () => fetchScreenerRow(u));
//
// Concurrent calls for the same key are deduped via in-flight promise tracking.

type Entry<T> = { value: T; expiresAt: number };

const store = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

export async function cached<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && hit.expiresAt > now) return hit.value;

  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const p = (async () => {
    try {
      const value = await loader();
      store.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

/** Stale-while-error: return cached value (even if expired) on loader failure. */
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
      console.warn(`[cache] serving stale "${key}" after loader error:`, (err as Error)?.message);
      return stale.value;
    }
    throw err;
  }
}

export function cacheBust(prefix?: string) {
  if (!prefix) { store.clear(); return; }
  for (const k of [...store.keys()]) if (k.startsWith(prefix)) store.delete(k);
}
