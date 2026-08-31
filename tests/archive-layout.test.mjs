import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const rule = (selector) => {
  const start = styles.indexOf(`${selector} {`);
  expect(start, `Missing ${selector}`).toBeGreaterThanOrEqual(0);
  return styles.slice(start, styles.indexOf("}", start));
};
const foreground = rule(".board-columns,\n.archive-list");

describe("Archive hero layering", () => {
  it("shares the board foreground and clipping edge, above the image and below controls", () => {
    expect(rule(".board-hero")).toContain("z-index: 1;");
    expect(foreground).toContain("position: relative;");
    expect(foreground).toContain("z-index: 2;");
    expect(rule(".board-controls")).toContain("z-index: 3;");
    expect(foreground).toContain("clip-path: inset(var(--board-clip-top) -24px -24px);");
    expect(foreground).toContain("var(--board-scroll-y) - var(--board-intro-height)");
    expect(foreground).toContain("var(--board-controls-offset) - 3px");
  });

  it("fades only overlapping content, never the image, and leaves the controls unboxed", () => {
    expect(foreground).toContain("clamp(0px, calc(var(--board-clip-top) - 17px), 16px)");
    expect(foreground).toContain("mask-image: linear-gradient(");
    expect(rule(".board-hero::before")).not.toMatch(/(?:backdrop-)?filter:|mask-image:/);
    expect(rule(".board-controls")).not.toMatch(/background(?:-color)?:|box-shadow:|backdrop-filter:/);
    expect(styles).toMatch(/@media \(forced-colors: active\)\s*{\s*\.board-columns,\s*\.archive-list\s*{\s*mask-image: none;/);
  });

  it("keeps the surface below the image without adding a nested scroll area or stacking context", () => {
    expect(rule(".board-content::before")).toContain("z-index: 0;");
    expect(rule(".board-content")).not.toMatch(/z-index:|isolation:|overflow:/);
    expect(rule(".archive-content")).toContain("width: 100%;");
    const archiveLayout = styles.slice(styles.indexOf(".archive-content {"), styles.indexOf(".archive-notice {"));
    expect(archiveLayout).not.toMatch(/overflow(?:-y)?:\s*(auto|scroll)/);
    expect(archiveLayout).toContain("padding-top: 17px;");
  });

  it("preserves board geometry and provides wrapping mobile rows and project controls", () => {
    expect(rule(".board-columns")).toContain("gap: 18px;");
    expect(rule(".board-columns")).toContain("width: max-content;");
    expect(rule(".board-columns")).toContain("padding-top: 17px;");
    expect(rule(".archive-row")).toContain("minmax(0, 1fr)");
    expect(rule(".archive-row b")).toContain("overflow-wrap: anywhere;");
    expect(rule(".archive-toolbar .member-select")).toContain("display: block;");
    expect(rule(".archive-toolbar .member-select")).toContain("grid-row: 2;");
    expect(styles).toContain(".archive-row:not(:disabled) { transition: none; }");
  });
});
