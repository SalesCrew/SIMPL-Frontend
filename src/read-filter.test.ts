import { describe, expect, it } from "vitest";
import { cardMatchesReadFilter, nextReadFilter, type ReadFilter } from "./read-filter";

describe("Read filter", () => {
  it("cycles all → unread → read → all", () => {
    let value: ReadFilter = "";
    value = nextReadFilter(value);
    expect(value).toBe("unread");
    value = nextReadFilter(value);
    expect(value).toBe("read");
    value = nextReadFilter(value);
    expect(value).toBe("");
  });

  it.each([
    ["", null, true],
    ["", "2026-09-03T10:00:00Z", true],
    ["unread", null, true],
    ["unread", "2026-09-03T10:00:00Z", false],
    ["read", null, false],
    ["read", "2026-09-03T10:00:00Z", true],
  ] as const)("matches %s against %s", (filter, reviewed_at, expected) => {
    expect(cardMatchesReadFilter({ reviewed_at }, filter)).toBe(expected);
  });
});
