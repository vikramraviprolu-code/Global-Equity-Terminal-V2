import { describe, it, expect } from "vitest";
import { computeHistoricalReturns } from "@/lib/backtest";

describe("backtest.computeHistoricalReturns", () => {
  it("returns null windows when series is too short", () => {
    const r = computeHistoricalReturns([100, 101, 102]);
    expect(r.observations).toBe(3);
    expect(r.startPrice).toBe(100);
    expect(r.endPrice).toBe(102);
    for (const w of r.windows) expect(w.returnPct).toBeNull();
  });

  it("computes 1M return correctly when there are enough observations", () => {
    // 22 closes — last index 21, day 21-21=0 is the past for 21-day window
    const closes = Array.from({ length: 22 }, (_, i) => 100 + i);
    const r = computeHistoricalReturns(closes);
    const oneM = r.windows.find((w) => w.label === "1M")!;
    // (121 - 100) / 100 * 100 = 21
    expect(oneM.returnPct).toBeCloseTo(21, 5);
  });

  it("handles empty input safely", () => {
    const r = computeHistoricalReturns([]);
    expect(r.observations).toBe(0);
    expect(r.startPrice).toBeNull();
    expect(r.endPrice).toBeNull();
  });
});
