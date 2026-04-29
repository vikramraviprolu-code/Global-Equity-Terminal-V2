import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAuthHeaders } from "./supabase-auth-headers";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fetchScreenerRow } from "./finimpulse.server";
import { UNIVERSE } from "./universe";

// ---------- Holdings CRUD ----------

const HoldingInput = z.object({
  symbol: z.string().min(1).max(20),
  shares: z.number().positive(),
  costBasis: z.number().nonnegative(),
  currency: z.string().min(1).max(8).default("USD"),
  notes: z.string().max(500).optional().nullable(),
});

export const listHoldings = createServerFn({ method: "GET" })
  .middleware([supabaseAuthHeaders, requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("holdings")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { holdings: data ?? [] };
  });

export const addHolding = createServerFn({ method: "POST" })
  .middleware([supabaseAuthHeaders, requireSupabaseAuth])
  .inputValidator((d) => HoldingInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error, data: row } = await context.supabase
      .from("holdings")
      .insert({
        user_id: context.userId,
        symbol: data.symbol.toUpperCase(),
        shares: data.shares,
        cost_basis: data.costBasis,
        currency: data.currency,
        notes: data.notes ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { holding: row };
  });

export const deleteHolding = createServerFn({ method: "POST" })
  .middleware([supabaseAuthHeaders, requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("holdings").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Portfolio with live valuation ----------

export const getPortfolio = createServerFn({ method: "GET" })
  .middleware([supabaseAuthHeaders, requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: holdings, error } = await context.supabase
      .from("holdings")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    if (!holdings || holdings.length === 0) {
      return { positions: [], totals: { cost: 0, value: 0, pnl: 0, pnlPct: 0 }, allocation: { bySector: [], byRegion: [] } };
    }

    // Quote each unique symbol via the existing Finimpulse pipeline
    const uniq = Array.from(new Set(holdings.map((h: any) => String(h.symbol))));
    const lookup: Record<string, any> = {};
    UNIVERSE.forEach((u) => { lookup[u.symbol] = u; });
    const quotes = await Promise.all(
      uniq.map(async (sym) => {
        const u = lookup[sym] ?? { symbol: sym, name: sym, exchange: "UNKNOWN", country: "Unknown", region: "OTHER" as const, currency: "USD", sector: "Unknown", industry: "Unknown" };
        const row = await fetchScreenerRow(u).catch(() => null);
        return [sym, row] as const;
      })
    );
    const quoteMap = new Map(quotes);

    const positions = holdings.map((h: any) => {
      const q = quoteMap.get(h.symbol);
      const price = q?.price ?? null;
      const shares = Number(h.shares);
      const costBasis = Number(h.cost_basis);
      const cost = shares * costBasis;
      const value = price != null ? shares * price : null;
      const pnl = value != null ? value - cost : null;
      const pnlPct = pnl != null && cost > 0 ? (pnl / cost) * 100 : null;
      return {
        id: h.id,
        symbol: h.symbol,
        name: q?.name ?? h.symbol,
        sector: q?.sector ?? "Unknown",
        region: q?.region ?? "OTHER",
        currency: h.currency,
        shares,
        costBasis,
        cost,
        price,
        value,
        pnl,
        pnlPct,
        rsi14: q?.rsi14 ?? null,
        perf5d: q?.perf5d ?? null,
        isMock: q?.isMock ?? true,
        addedAt: h.created_at,
        notes: h.notes,
      };
    });

    const totalCost = positions.reduce((s, p) => s + p.cost, 0);
    const totalValue = positions.reduce((s, p) => s + (p.value ?? p.cost), 0);
    const totalPnl = totalValue - totalCost;
    const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

    // Allocation by sector / region (using current value when available)
    const bucket = (key: string, p: any, m: Map<string, number>) => {
      m.set(key, (m.get(key) ?? 0) + (p.value ?? p.cost));
    };
    const sectorMap = new Map<string, number>();
    const regionMap = new Map<string, number>();
    positions.forEach((p) => { bucket(p.sector, p, sectorMap); bucket(p.region, p, regionMap); });
    const toArr = (m: Map<string, number>) =>
      Array.from(m.entries())
        .map(([key, v]) => ({ key, value: v, pct: totalValue > 0 ? (v / totalValue) * 100 : 0 }))
        .sort((a, b) => b.value - a.value);

    return {
      positions,
      totals: { cost: totalCost, value: totalValue, pnl: totalPnl, pnlPct: totalPnlPct },
      allocation: { bySector: toArr(sectorMap), byRegion: toArr(regionMap) },
    };
  });
