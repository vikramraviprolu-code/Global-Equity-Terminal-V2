import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { UNIVERSE } from "./universe";
import { fetchScreenerRow, type ScreenerRow } from "./finimpulse.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAuthHeaders } from "./supabase-auth-headers";
import { cached, cachedSWR, getCacheStats } from "./cache.server";

async function buildUniverse(regions?: string[]) {
  const filtered = regions?.length
    ? UNIVERSE.filter((u) => regions.includes(u.region))
    : UNIVERSE;

  const CHUNK = 20;
  const out: ScreenerRow[] = [];
  for (let i = 0; i < filtered.length; i += CHUNK) {
    const chunk = filtered.slice(i, i + CHUNK);
    const rows = await Promise.all(chunk.map((u) => fetchScreenerRow(u).catch(() => null)));
    for (const r of rows) if (r) out.push(r);
  }

  const mockCount = out.filter((r) => r.isMock).length;
  return {
    rows: out,
    meta: {
      retrievedAt: new Date().toISOString(),
      total: out.length,
      mockCount,
      liveCount: out.length - mockCount,
      universeSize: filtered.length,
    },
  } as const;
}

// Authenticated full-universe fetcher (used by signed-in workspace pages).
export const fetchUniverse = createServerFn({ method: "POST" })
  .middleware([supabaseAuthHeaders, requireSupabaseAuth])
  .inputValidator(z.object({ regions: z.array(z.string()).optional() }).optional().default({}))
  .handler(async ({ data }) => {
    return buildUniverse(data?.regions);
  });

// Public, heavily-cached snapshot for unauthenticated surfaces (landing page,
// shared watchlist read-only view). Uses a long TTL so anonymous traffic cannot
// drive paid-API fan-out: only the first request after the TTL elapses fans
// out, every subsequent caller is served the cached JSON.
//
// Resilience: uses cachedSWR so if the rebuild fails (upstream API outage), we
// keep serving the last known good snapshot — tagged with `_stale: true`. If
// no cached value exists yet (cold isolate + upstream down), we return an
// empty rows array with `unavailable: true` so the UI can show a friendly
// "Data unavailable" state instead of crashing.
export const PUBLIC_UNIVERSE_CACHE_KEY = "public:universe:all";
const PUBLIC_UNIVERSE_TTL_MS = 15 * 60 * 1000; // 15 minutes

export const fetchPublicUniverseSnapshot = createServerFn({ method: "POST" })
  .handler(async () => {
    try {
      return await cachedSWR(PUBLIC_UNIVERSE_CACHE_KEY, PUBLIC_UNIVERSE_TTL_MS, () => buildUniverse());
    } catch (err) {
      console.error("[public-universe] no cache + rebuild failed:", (err as Error)?.message);
      return {
        rows: [],
        meta: {
          retrievedAt: new Date().toISOString(),
          total: 0,
          mockCount: 0,
          liveCount: 0,
          universeSize: 0,
        },
        unavailable: true as const,
        error: "Data unavailable. Please try again shortly.",
      };
    }
  });

// Admin-only: expose cache stats for the public universe snapshot (and any
// other keys with the same prefix). Read by the admin observability view.
export const getPublicUniverseCacheStats = createServerFn({ method: "GET" })
  .middleware([supabaseAuthHeaders, requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Inline admin check (avoid importing admin-emails to prevent cycles)
    const { data: roleRow } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw new Error("Forbidden: admin only");
    return { stats: getCacheStats("public:universe") };
  });
