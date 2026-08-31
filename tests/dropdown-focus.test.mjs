import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const rules = [...styles.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)];
const bodyFor = (selector) => rules.find(([, selectors]) => selectors.trim() === selector)?.[2];
const dropdowns = ":is(.select-trigger, button[aria-haspopup], .workspace-popover button, .filter-panel button, select)";

describe("Dropdowns have no focus strokes", () => {
  it("overrides both browser outlines and shared button rings for all dropdown surfaces", () => {
    const rule = bodyFor(`${dropdowns}:is(:focus, :focus-visible)`);
    expect(rule).toContain("outline: none");
    expect(rule).toContain("outline-offset: 0");
    expect(rule).toContain("box-shadow: none");
  });

  it("removes the extra open-state stroke from field, toolbar and filter selects", () => {
    const open = bodyFor('.select-trigger[data-state="open"]');
    expect(open).toContain("box-shadow: none");
    expect(open).not.toContain("border-color");
    const field = bodyFor('.select-field:not(:disabled):is(:focus, [data-state="open"])');
    expect(field).toContain("border-color: var(--field-border)");
    expect(field).toContain("box-shadow: none");
    expect(field).not.toContain("--field-focus");
  });

  it("keeps keyboard navigation visible through background highlights", () => {
    expect(bodyFor(`${dropdowns}:focus-visible`)).toContain("background-color: #eaf1e3");
    expect(bodyFor(".select-option[data-highlighted]")).toContain("background: #eaf1e3");
    expect(bodyFor(".workspace-option:focus-visible")).not.toContain("outline");
  });

  it("preserves the existing text input and comment composer focus treatment", () => {
    expect(bodyFor(".field :is(input, textarea):focus")).toContain("box-shadow: var(--field-focus-shadow)");
    expect(bodyFor(".comment-composer:focus-within")).toContain("border-color: var(--field-focus-border)");
    expect(bodyFor(".field select:focus")).toContain("border-color: var(--field-border)");
  });
});
