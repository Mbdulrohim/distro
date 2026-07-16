import { describe, it, expect } from "vitest";
import { validateSchedule, formatScheduleForDisplay } from "./validate";
import { MIN_LEAD_SECONDS, MAX_HORIZON_SECONDS, isScheduleEditable } from "./types";

const NOW = 1_800_000_000; // fixed reference point

describe("validateSchedule — execute now", () => {
  it("is always valid and carries no timestamp", () => {
    const r = validateSchedule({ mode: "now" }, NOW);
    expect(r.ok).toBe(true);
    expect(r.executeAt).toBeUndefined();
    expect(r.errors).toHaveLength(0);
  });

  it("ignores any timestamp passed alongside now", () => {
    const r = validateSchedule({ mode: "now", executeAt: NOW - 999 }, NOW);
    expect(r.ok).toBe(true);
    expect(r.executeAt).toBeUndefined();
  });
});

describe("validateSchedule — scheduled", () => {
  it("accepts a time comfortably in the future", () => {
    const at = NOW + 24 * 60 * 60;
    const r = validateSchedule({ mode: "scheduled", executeAt: at }, NOW);
    expect(r.ok).toBe(true);
    expect(r.executeAt).toBe(at);
  });

  it("requires a time", () => {
    const r = validateSchedule({ mode: "scheduled" }, NOW);
    expect(r.ok).toBe(false);
    expect(r.errors[0].code).toBe("missing-time");
  });

  it("rejects a past time", () => {
    const r = validateSchedule({ mode: "scheduled", executeAt: NOW - 60 }, NOW);
    expect(r.ok).toBe(false);
    expect(r.errors.map((e) => e.code)).toContain("in-past");
  });

  it("rejects exactly now (not strictly future)", () => {
    const r = validateSchedule({ mode: "scheduled", executeAt: NOW }, NOW);
    expect(r.ok).toBe(false);
    expect(r.errors.map((e) => e.code)).toContain("in-past");
  });

  it("rejects a time inside the clock-skew floor, distinctly from the past", () => {
    const r = validateSchedule({ mode: "scheduled", executeAt: NOW + 30 }, NOW);
    expect(r.ok).toBe(false);
    expect(r.errors.map((e) => e.code)).toContain("too-soon");
    expect(r.errors.map((e) => e.code)).not.toContain("in-past");
  });

  it("accepts a time exactly at the lead floor", () => {
    const r = validateSchedule({ mode: "scheduled", executeAt: NOW + MIN_LEAD_SECONDS }, NOW);
    expect(r.ok).toBe(true);
  });

  it("rejects a time beyond the one-year horizon (guards a year typo)", () => {
    const r = validateSchedule(
      { mode: "scheduled", executeAt: NOW + MAX_HORIZON_SECONDS + 1 },
      NOW,
    );
    expect(r.ok).toBe(false);
    expect(r.errors.map((e) => e.code)).toContain("too-far");
  });

  it("accepts a time exactly at the horizon", () => {
    const r = validateSchedule({ mode: "scheduled", executeAt: NOW + MAX_HORIZON_SECONDS }, NOW);
    expect(r.ok).toBe(true);
  });

  it.each([
    ["non-integer", NOW + 100.5],
    ["NaN", Number.NaN],
    ["negative", -1],
    ["zero", 0],
  ])("rejects an invalid timestamp: %s", (_label, value) => {
    const r = validateSchedule({ mode: "scheduled", executeAt: value }, NOW);
    expect(r.ok).toBe(false);
    expect(r.errors.map((e) => e.code)).toContain("invalid-time");
  });

  it("never returns a timestamp when invalid", () => {
    const r = validateSchedule({ mode: "scheduled", executeAt: NOW - 1 }, NOW);
    expect(r.executeAt).toBeUndefined();
  });
});

describe("formatScheduleForDisplay", () => {
  it("always includes an explicit UTC echo alongside local", () => {
    const { local, utc } = formatScheduleForDisplay(NOW);
    expect(utc).toMatch(/UTC$/);
    expect(local.length).toBeGreaterThan(0);
  });
});

describe("isScheduleEditable", () => {
  it("allows editing only while a draft — executeAfter is immutable once on-chain", () => {
    expect(isScheduleEditable("draft")).toBe(true);
    for (const status of ["ready", "funded", "executing", "completed", "cancelled"]) {
      expect(isScheduleEditable(status)).toBe(false);
    }
  });
});
