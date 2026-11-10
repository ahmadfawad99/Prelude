import { describe, it, expect } from "vitest";
import { canTransition, assertTransition, forwardPath, InvalidTransitionError } from "./state-machine";

describe("state machine transitions", () => {
  it("allows the normal forward pipeline steps", () => {
    expect(canTransition("REQUEST", "UNDERSTANDING")).toBe(true);
    expect(canTransition("ESTIMATES", "REVIEW")).toBe(true);
    expect(canTransition("REVIEW", "HANDOFF")).toBe(true);
  });

  it("rejects the illegal ESTIMATES → HANDOFF hop (the approval-badge bug)", () => {
    expect(canTransition("ESTIMATES", "HANDOFF")).toBe(false);
  });

  it("assertTransition throws on an illegal move", () => {
    expect(() => assertTransition("ESTIMATES", "HANDOFF")).toThrow(InvalidTransitionError);
    expect(() => assertTransition("REQUEST", "UNDERSTANDING")).not.toThrow();
  });

  it("has no outgoing transitions from ARCHIVED", () => {
    expect(canTransition("ARCHIVED", "WON")).toBe(false);
  });
});

describe("forwardPath (one-click approval walk)", () => {
  it("walks ESTIMATES → REVIEW → HANDOFF for plan approval", () => {
    expect(forwardPath("ESTIMATES", "HANDOFF")).toEqual(["REVIEW", "HANDOFF"]);
  });

  it("is a single step when already adjacent", () => {
    expect(forwardPath("REVIEW", "HANDOFF")).toEqual(["HANDOFF"]);
  });

  it("returns [] when already at or past the target (never walks backward)", () => {
    expect(forwardPath("HANDOFF", "HANDOFF")).toEqual([]);
    expect(forwardPath("HANDOFF", "ESTIMATES")).toEqual([]);
  });

  it("returns [] for off-pipeline / terminal statuses", () => {
    expect(forwardPath("WON", "HANDOFF")).toEqual([]);
    expect(forwardPath("LOST", "HANDOFF")).toEqual([]);
  });

  it("every step it returns is itself a legal transition", () => {
    const path = forwardPath("REQUEST", "HANDOFF");
    let cur = "REQUEST" as const;
    for (const next of path) {
      expect(canTransition(cur as never, next)).toBe(true);
      cur = next as never;
    }
    expect(path[path.length - 1]).toBe("HANDOFF");
  });
});
