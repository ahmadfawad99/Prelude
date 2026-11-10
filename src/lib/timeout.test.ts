import { describe, it, expect } from "vitest";
import { withTimeout, TimeoutError } from "./timeout";

describe("withTimeout", () => {
  it("resolves when the promise settles in time", async () => {
    await expect(withTimeout(Promise.resolve("ok"), 100, "x")).resolves.toBe("ok");
  });

  it("rejects with TimeoutError when it takes too long", async () => {
    const slow = new Promise((r) => setTimeout(() => r("late"), 50));
    await expect(withTimeout(slow, 10, "slow op")).rejects.toBeInstanceOf(TimeoutError);
  });

  it("propagates the original rejection", async () => {
    await expect(withTimeout(Promise.reject(new Error("boom")), 100)).rejects.toThrow("boom");
  });
});
