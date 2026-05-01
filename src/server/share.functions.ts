/**
 * v1.9 — Watchlist sharing.
 *
 * Owner-side: createShare / listShares / revokeShare (auth-gated, RLS-scoped).
 * Public-side: getSharedWatchlist (token-gated, increments view counter via
 * the SECURITY DEFINER RPC using the service role).
 *
 * Tokens are 22-char base64url strings (~132 bits of entropy) — unguessable.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAuthHeaders } from "./supabase-auth-headers";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function makeToken(): string {
  // 16 random bytes → 22 char base64url
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  let s = "";
  for (const b of buf) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const CreateInput = z.object({
  name: z.string().min(1).max(60),
  symbols: z.array(z.string().min(1).max(20)).min(1).max(50),
  expiresInDays: z.number().int().min(1).max(365).optional().nullable(),
});

export const createShare = createServerFn({ method: "POST" })
  .middleware([supabaseAuthHeaders, requireSupabaseAuth])
  .inputValidator((v) => CreateInput.parse(v))
  .handler(async ({ data, context }) => {
    const token = makeToken();
    const expires_at = data.expiresInDays
      ? new Date(Date.now() + data.expiresInDays * 86400_000).toISOString()
      : null;

    const { data: row, error } = await context.supabase
      .from("shared_watchlists")
      .insert({
        user_id: context.userId,
        token,
        name: data.name,
        symbols: data.symbols,
        expires_at,
      })
      .select("id, token, name, symbols, view_count, expires_at, created_at")
      .single();

    if (error) throw new Error(error.message);
    return row;
  });

export const listShares = createServerFn({ method: "GET" })
  .middleware([supabaseAuthHeaders, requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("shared_watchlists")
      .select("id, token, name, symbols, view_count, expires_at, revoked_at, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const revokeShare = createServerFn({ method: "POST" })
  .middleware([supabaseAuthHeaders, requireSupabaseAuth])
  .inputValidator((v) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("shared_watchlists")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Public read of a shared watchlist by token. No auth required.
 * Bumps view_count via the locked-down SECURITY DEFINER RPC (service role).
 */
export const getSharedWatchlist = createServerFn({ method: "GET" })
  .inputValidator((v) => z.object({ token: z.string().min(8).max(64) }).parse(v))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("shared_watchlists")
      .select("name, symbols, view_count, expires_at, revoked_at, created_at")
      .eq("token", data.token)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!row) return { found: false as const };
    if (row.revoked_at) return { found: false as const, reason: "revoked" as const };
    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      return { found: false as const, reason: "expired" as const };
    }

    // Fire-and-forget view counter; failure must not block the read.
    void supabaseAdmin.rpc("bump_shared_watchlist_view", { _token: data.token });

    return {
      found: true as const,
      name: row.name,
      symbols: row.symbols as string[],
      viewCount: row.view_count,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    };
  });
