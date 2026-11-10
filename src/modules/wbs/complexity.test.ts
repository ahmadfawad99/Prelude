import { describe, it, expect } from "vitest";
import { spFor, engineersFor, averageComplexity, COMPLEXITY_SP, COMPLEXITY_ENGINEERS, COMPLEXITY_LABEL, COMPLEXITY_VALUES } from "./complexity";

describe("complexity → effort model", () => {
  it("maps each complexity to the agreed story points", () => {
    expect(COMPLEXITY_SP).toEqual({ LOW: 3, LOW_MEDIUM: 5, MEDIUM: 13 });
  });

  it("maps each complexity to the agreed engineer count", () => {
    expect(COMPLEXITY_ENGINEERS).toEqual({ LOW: 1, LOW_MEDIUM: 1, MEDIUM: 2 });
  });

  it("spFor returns points for a complexity and null otherwise", () => {
    expect(spFor("LOW")).toBe(3);
    expect(spFor("LOW_MEDIUM")).toBe(5);
    expect(spFor("MEDIUM")).toBe(13);
    expect(spFor(null)).toBeNull();
    expect(spFor(undefined)).toBeNull();
  });

  it("engineersFor returns engineers for a complexity and null otherwise", () => {
    expect(engineersFor("LOW")).toBe(1);
    expect(engineersFor("LOW_MEDIUM")).toBe(1);
    expect(engineersFor("MEDIUM")).toBe(2);
    expect(engineersFor(null)).toBeNull();
  });

  it("labels and values stay in sync", () => {
    expect(COMPLEXITY_LABEL).toEqual({ LOW: "Low", LOW_MEDIUM: "Low-Medium", MEDIUM: "Medium" });
    expect(COMPLEXITY_VALUES).toEqual(["LOW", "LOW_MEDIUM", "MEDIUM"]);
  });

  it("averages complexity across an epic's features (rounded to nearest level)", () => {
    expect(averageComplexity(["LOW", "MEDIUM"])).toBe("LOW_MEDIUM"); // (1+3)/2 = 2
    expect(averageComplexity(["LOW", "LOW", "MEDIUM"])).toBe("LOW_MEDIUM"); // 5/3 ≈ 1.67 → 2
    expect(averageComplexity(["MEDIUM", "MEDIUM", "LOW_MEDIUM"])).toBe("MEDIUM"); // 8/3 ≈ 2.67 → 3
    expect(averageComplexity(["LOW", "LOW"])).toBe("LOW");
    expect(averageComplexity([null, "MEDIUM"])).toBe("MEDIUM"); // ignores unset
    expect(averageComplexity([null, undefined])).toBeNull();
    expect(averageComplexity([])).toBeNull();
  });

  it("totals a realistic mix exactly (1×Low + 6×Low-Med + 9×Med)", () => {
    const mix = [
      ...Array(1).fill("LOW"),
      ...Array(6).fill("LOW_MEDIUM"),
      ...Array(9).fill("MEDIUM"),
    ] as const;
    const sp = mix.reduce((a, c) => a + (spFor(c) ?? 0), 0);
    const eng = mix.reduce((a, c) => a + (engineersFor(c) ?? 0), 0);
    expect(sp).toBe(1 * 3 + 6 * 5 + 9 * 13); // 150
    expect(eng).toBe(1 * 1 + 6 * 1 + 9 * 2); // 25
  });
});
