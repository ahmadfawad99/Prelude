import { describe, it, expect } from "vitest";
import { asStr, asComplexity, asPriority, asDate, fmtDate } from "./coerce";

describe("asStr", () => {
  it("trims and returns non-empty strings, else undefined", () => {
    expect(asStr("  hi ")).toBe("hi");
    expect(asStr("")).toBeUndefined();
    expect(asStr("   ")).toBeUndefined();
    expect(asStr(42)).toBeUndefined();
    expect(asStr(null)).toBeUndefined();
  });
});

describe("asComplexity / asPriority", () => {
  it("accepts only valid enum values", () => {
    expect(asComplexity("LOW")).toBe("LOW");
    expect(asComplexity("MEDIUM")).toBe("MEDIUM");
    expect(asComplexity("HIGH")).toBeUndefined(); // not a complexity
    expect(asComplexity("low")).toBeUndefined(); // case-sensitive
    expect(asPriority("HIGH")).toBe("HIGH");
    expect(asPriority("LOW_MEDIUM")).toBeUndefined(); // not a priority
  });
});

describe("asDate (UTC-midnight, TZ-safe)", () => {
  it("parses a plain YYYY-MM-DD as UTC midnight — no off-by-one in +UTC zones", () => {
    const d = asDate("2026-11-10");
    expect(d).toBeInstanceOf(Date);
    // The bug: parsing as local then formatting UTC drifted to 2026-11-09.
    expect(d!.toISOString()).toBe("2026-11-10T00:00:00.000Z");
    expect(fmtDate(d)).toBe("2026-11-10");
  });

  it("round-trips through fmtDate on the same calendar day", () => {
    expect(fmtDate(asDate("2026-12-01"))).toBe("2026-12-01");
    expect(fmtDate(asDate("2027-01-31"))).toBe("2027-01-31");
  });

  it("accepts full ISO timestamps too", () => {
    expect(asDate("2026-11-10T08:30:00Z")!.toISOString()).toBe("2026-11-10T08:30:00.000Z");
  });

  it("returns undefined for empty / invalid input", () => {
    expect(asDate("")).toBeUndefined();
    expect(asDate("not a date")).toBeUndefined();
    expect(asDate(undefined)).toBeUndefined();
  });
});

describe("fmtDate", () => {
  it("formats null/undefined as 'not set'", () => {
    expect(fmtDate(null)).toBe("not set");
    expect(fmtDate(undefined)).toBe("not set");
  });
});
