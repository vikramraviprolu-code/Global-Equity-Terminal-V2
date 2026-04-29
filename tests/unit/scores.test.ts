import { describe, it, expect } from "vitest";
import { scoreRow } from "@/lib/scores";
import type { ScreenerRow } from "@/server/finimpulse.server";

function row(overrides: Partial<ScreenerRow> = {}): ScreenerRow {
  return {
    symbol: "TST",
    companyName: "Test Co",
    exchange: "NMS",
    fullExchange: "NASDAQ",
    country: "US",
    currency: "USD",
    sector: "Tech",
    industry: "Software",
    price: 100,
    marketCap: 50e9,
    marketCapUsd: 50e9,
    pe: 15,
    pb: 2,
    dividendYield: 1,
    perf5d: 1,
    perf1m: 3,
    perf6m: 8,
    perf52w: 12,
    week52High: 110,
    week52Low: 80,
    pctFromLow: 25,
    pctFromHigh: -9,
    rsi14: 55,
    rsi: 55,
    volume: 1_000_000,
    avgVolume: 1_000_000,
    closes: Array.from({ length: 60 }, (_, i) => 80 + i * 0.3),
    isMock: false,
    ...(overrides as object),
  } as ScreenerRow;
}

describe("scores.scoreRow", () => {
  it("clamps every score to 0-100 and bucketizes labels", () => {
    const s = scoreRow(row());
    for (const k of ["value", "momentum", "quality", "risk", "confidence"] as const) {
      expect(s[k]).toBeGreaterThanOrEqual(0);
      expect(s[k]).toBeLessThanOrEqual(100);
    }
    expect(typeof s.valueLabel).toBe("string");
    expect(typeof s.confidenceLabel).toBe("string");
  });

  it("rewards cheap P/E and proximity to 52w low for value", () => {
    const cheap = scoreRow(row({ pe: 8, pctFromLow: 5 }));
    const rich = scoreRow(row({ pe: 50, pctFromLow: 90 }));
    expect(cheap.value).toBeGreaterThan(rich.value);
  });

  it("includes at least one human-readable reason", () => {
    const s = scoreRow(row());
    expect(s.valueReasons.length).toBeGreaterThan(0);
    expect(s.momentumReasons.length).toBeGreaterThan(0);
  });
});
