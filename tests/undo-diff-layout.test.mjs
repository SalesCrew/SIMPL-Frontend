import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../src/card-editing.css", import.meta.url), "utf8");
const rule = (selector) => {
  const start = css.indexOf(`${selector} {`);
  expect(start, `Missing ${selector}`).toBeGreaterThanOrEqual(0);
  return css.slice(start, css.indexOf("}", start));
};

describe("Minimal undo change diff", () => {
  it("uses soft red for previous values and soft green for current values", () => {
    expect(rule(".undo-diff-line.is-before")).toContain("background: #fff1f0;");
    expect(rule(".undo-diff-line.is-before")).toContain("color: #954c48;");
    expect(rule(".undo-diff-line.is-after")).toContain("background: #eff7ec;");
    expect(rule(".undo-diff-line.is-after")).toContain("color: #3e6b43;");
  });
  it("stacks full-width lines, keeps markers aligned and preserves long descriptions", () => {
    expect(rule(".undo-diff")).toContain("gap: 2px;");
    expect(rule(".undo-diff")).not.toMatch(/grid-template-columns:|box-shadow:|font-family:/);
    expect(rule(".undo-diff-line")).toContain("grid-template-columns: 12px minmax(0, 1fr);");
    expect(rule(".undo-diff-marker")).toContain("user-select: none;");
    expect(rule(".undo-diff-value")).toContain("white-space: pre-wrap;");
    expect(rule(".undo-diff-value")).toContain("overflow-wrap: anywhere;");
    expect(rule(".undo-diff-value")).toContain("overflow: auto;");
  });
});
