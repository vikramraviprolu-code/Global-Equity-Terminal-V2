import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { UNIVERSE } from "./universe";
import { fi } from "./finimpulse.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAuthHeaders } from "./supabase-auth-headers";

export type EventKind = "earnings" | "dividend" | "split";

export type CalendarEvent = {
  symbol: string;
  name: string;
  region: string;
  exchange: string;
  sector: string;
  kind: EventKind;
  date: string;        // ISO yyyy-mm-dd
  label: string;       // "Earnings", "Ex-Dividend", "Split"
  detail?: string;     // e.g. "$0.24 / share" or "2-for-1"
  source: string;
};

function toIsoDate(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "number") {
    // Yahoo-style epoch in seconds
    const ms = v < 1e12 ? v * 1000 : v;
    const d = new Date(ms);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  }
  if (typeof v === "string") {
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    // try yyyy-mm-dd already
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  }
  return null;
}

function pickFirst(obj: any, keys: string[]): any {
  for (const k of keys) if (obj?.[k] != null) return obj[k];
  return null;
}

async function fetchEventsFor(u: typeof UNIVERSE[number]): Promise<CalendarEvent[]> {
  const summary = await fi<any>("/summary", { symbol: u.symbol }).catch(() => null);
  if (!summary) return [];
  const out: CalendarEvent[] = [];

  const earnings = toIsoDate(pickFirst(summary, [
    "earnings_date", "earnings_timestamp", "earnings_call_timestamp_start",
    "earnings_timestamp_start", "next_earnings_date",
  ]));
  if (earnings) {
    out.push({
      symbol: u.symbol, name: u.name, region: u.region, exchange: u.exchange, sector: u.sector,
      kind: "earnings", date: earnings, label: "Earnings",
      source: "Finimpulse",
    });
  }

  const exDiv = toIsoDate(pickFirst(summary, [
    "ex_dividend_date", "ex_div_date", "exdividend_date",
  ]));
  if (exDiv) {
    const amt = pickFirst(summary, ["last_dividend_value", "dividend_rate", "trailing_annual_dividend_rate"]);
    out.push({
      symbol: u.symbol, name: u.name, region: u.region, exchange: u.exchange, sector: u.sector,
      kind: "dividend", date: exDiv, label: "Ex-Dividend",
      detail: amt != null ? `${u.currency} ${Number(amt).toFixed(2)} / share` : undefined,
      source: "Finimpulse",
    });
  }

  const splitDate = toIsoDate(pickFirst(summary, ["last_split_date", "split_date"]));
  const splitFactor = pickFirst(summary, ["last_split_factor", "split_factor"]);
  if (splitDate) {
    out.push({
      symbol: u.symbol, name: u.name, region: u.region, exchange: u.exchange, sector: u.sector,
      kind: "split", date: splitDate, label: "Stock Split",
      detail: splitFactor ? String(splitFactor) : undefined,
      source: "Finimpulse",
    });
  }

  return out;
}

export const fetchEvents = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    regions: z.array(z.string()).optional(),
    symbols: z.array(z.string()).optional(),
  }).optional().default({}))
  .handler(async ({ data }) => {
    let pool = UNIVERSE;
    if (data?.symbols?.length) {
      const set = new Set(data.symbols);
      pool = pool.filter((u) => set.has(u.symbol));
    } else if (data?.regions?.length) {
      const set = new Set(data.regions);
      pool = pool.filter((u) => set.has(u.region));
    }

    const CHUNK = 20;
    const out: CalendarEvent[] = [];
    let succeeded = 0;
    let failed = 0;
    for (let i = 0; i < pool.length; i += CHUNK) {
      const chunk = pool.slice(i, i + CHUNK);
      const results = await Promise.all(chunk.map((u) =>
        fetchEventsFor(u).then((evs) => { succeeded++; return evs; }).catch(() => { failed++; return [] as CalendarEvent[]; })
      ));
      for (const arr of results) out.push(...arr);
    }
    out.sort((a, b) => a.date.localeCompare(b.date));

    return {
      events: out,
      meta: {
        retrievedAt: new Date().toISOString(),
        scanned: pool.length,
        succeeded,
        failed,
        eventCount: out.length,
      },
    } as const;
  });
