import { describe, expect, it } from "vitest";
import { deadlineForDayIso, toIso } from "../dates";

describe("toIso", () => {
  it("Date -> ISO", () => {
    expect(toIso(new Date("2026-09-23T10:00:00.000Z"))).toBe(
      "2026-09-23T10:00:00.000Z"
    );
  });

  it("null/undefined -> null, мусор -> null", () => {
    expect(toIso(null)).toBeNull();
    expect(toIso(undefined)).toBeNull();
    expect(toIso("not-a-date")).toBeNull();
  });
});

describe("deadlineForDayIso", () => {
  it("сохраняет время суток исходной даты на целевом дне", () => {
    const out = new Date(
      deadlineForDayIso("2026-09-25T14:30:00", new Date(2026, 8, 23))
    );
    expect([out.getFullYear(), out.getMonth(), out.getDate()]).toEqual([
      2026, 8, 23,
    ]);
    expect([out.getHours(), out.getMinutes()]).toEqual([14, 30]);
  });

  it("без исходной даты — полдень целевого дня", () => {
    for (const src of [null, undefined, "garbage"]) {
      const out = new Date(deadlineForDayIso(src, new Date(2026, 8, 23)));
      expect([out.getFullYear(), out.getMonth(), out.getDate()]).toEqual([
        2026, 8, 23,
      ]);
      expect([out.getHours(), out.getMinutes()]).toEqual([12, 0]);
    }
  });
});
