import { describe, it, expect } from "vitest";
import {
  fmtNum,
  fmtPct,
  fmtPrice,
  fmtMcap,
  fmtMcapUsd,
  ccySym,
} from "@/lib/format";

describe("format", () => {
  it("fmtNum renders em-dash for null/NaN/Infinity", () => {
    expect(fmtNum(null)).toBe("—");
    expect(fmtNum(undefined)).toBe("—");
    expect(fmtNum(Number.NaN)).toBe("—");
    expect(fmtNum(Number.POSITIVE_INFINITY)).toBe("—");
  });

  it("fmtNum rounds to fixed digits", () => {
    expect(fmtNum(1234.5678, 2)).toBe("1,234.57");
    expect(fmtNum(0, 0)).toBe("0");
  });

  it("fmtPct adds explicit + sign for positive", () => {
    expect(fmtPct(2.5)).toBe("+2.50%");
    expect(fmtPct(-1.2345, 2)).toBe("-1.23%");
    expect(fmtPct(0)).toBe("0.00%");
    expect(fmtPct(null)).toBe("—");
  });

  it("ccySym maps known currencies", () => {
    expect(ccySym("USD")).toBe("$");
    expect(ccySym("EUR")).toBe("€");
    expect(ccySym("JPY")).toBe("¥");
    expect(ccySym(null)).toBe("$");
    expect(ccySym("XYZ")).toBe("XYZ ");
  });

  it("fmtPrice strips fractional digits for JPY/KRW", () => {
    expect(fmtPrice(1234.56, "USD")).toBe("$1,234.56");
    expect(fmtPrice(1234.56, "JPY")).toBe("¥1,235");
    expect(fmtPrice(1234.56, "KRW")).toBe("₩1,235");
    expect(fmtPrice(null, "USD")).toBe("—");
  });

  it("fmtMcap scales to T/B/M with currency symbol", () => {
    expect(fmtMcap(2.5e12, "USD")).toBe("$2.50T");
    expect(fmtMcap(7.5e9, "USD")).toBe("$7.50B");
    expect(fmtMcap(4.2e6, "USD")).toBe("$4.20M");
    expect(fmtMcap(null)).toBe("—");
  });

  it("fmtMcapUsd is fmtMcap with USD", () => {
    expect(fmtMcapUsd(1e9)).toBe(fmtMcap(1e9, "USD"));
  });
});
