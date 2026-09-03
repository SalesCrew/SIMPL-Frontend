import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const rule = (selector) => {
  const start = styles.indexOf(`${selector} {`);
  expect(start, `Missing ${selector}`).toBeGreaterThanOrEqual(0);
  return styles.slice(start, styles.indexOf("}", start));
};

describe("Read state and filter styling", () => {
  it("keeps unread card checks quieter than read checks", () => {
    expect(rule(".read-check")).toContain("opacity: 0.38;");
    expect(rule(".read-check.is-read")).toContain("opacity: 1;");
  });

  it("uses a containerless toolbar control with distinct states", () => {
    const control = rule(".read-filter-control");
    expect(control).toContain("border: 0;");
    expect(control).toContain("background: transparent;");
    expect(rule(".read-filter-combined-icon")).toContain("width: 25px;");
    expect(rule(".read-filter-combined-icon")).toContain("border-radius: 50%;");
    expect(rule(".read-filter-control.is-unread")).toContain("opacity: 0.42;");
    expect(rule(".read-filter-control.is-read")).toContain("color: #78a8d2;");
  });
});
