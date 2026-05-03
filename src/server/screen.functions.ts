import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { UNIVERSE } from "./universe";
import { fetchScreenerRow, type ScreenerRow } from "./finimpulse.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAuthHeaders } from "./supabase-auth-headers";
import { cached } from "./cache.server";

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
const PUBLIC_UNIVERSE_TTL_MS = 15 * 60 * 1000; // 15 minutes
export const fetchPublicUniverseSnapshot = createServerFn({ method: "POST" })
  .handler(async () => {
    return cached("public:universe:all", PUBLIC_UNIVERSE_TTL_MS, () => buildUniverse());
  });
