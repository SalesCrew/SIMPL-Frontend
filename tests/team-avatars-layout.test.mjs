import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const component = readFileSync(new URL("../src/components/TeamAvatars.tsx", import.meta.url), "utf8");
const tooltip = readFileSync(new URL("../src/components/ui/Tooltip.tsx", import.meta.url), "utf8");
const rule = (selector) => {
  const start = styles.indexOf(selector + " {");
  expect(start, "Missing " + selector).toBeGreaterThanOrEqual(0);
  return styles.slice(start, styles.indexOf("}", start));
};

describe("Inline avatar expansion presentation", () => {
  it("anchors the count at the right and lets circle widths push the original avatars left", () => {
    expect(component).not.toContain("Popover");
    expect(component).not.toContain("Portal");
    expect(component.indexOf("visible.map")).toBeLessThan(component.indexOf("hidden.map"));
    expect(component.indexOf("hidden.map")).toBeLessThan(component.indexOf('className="avatar avatar-more"'));
    expect(rule(".team-avatar-row")).toContain("position: absolute;");
    expect(rule(".team-avatar-row")).toContain("right: 0;");
    expect(rule(".team-avatar-group")).toContain("width: var(--avatar-collapsed-width);");
    expect(rule(".team-avatar-person.is-overflow")).toContain("width: 0;");
    expect(rule('.team-avatar-group[data-state="open"] .is-overflow')).toContain("width: 25px;");
  });
  it("has no separate panel, pill, backdrop or wrapping layout", () => {
    expect(styles).not.toContain(".team-overflow-popover");
    expect(styles).not.toContain(".team-overflow-list");
    for (const selector of [".team-avatar-row", ".team-avatar-viewport", ".team-avatar-people"]) {
      expect(rule(selector)).not.toMatch(/background:|box-shadow:|border:|border-radius:|flex-wrap:/);
    }
  });
  it("keeps long rows reachable without moving the count or covering the title", () => {
    expect(rule(".team-avatar-row")).toContain("max-width: var(--avatar-available-width");
    expect(rule(".team-avatar-viewport")).toContain("overflow-x: auto;");
    expect(rule(".team-avatar-viewport")).toContain("scrollbar-width: none;");
    expect(rule(".team-avatar-viewport::-webkit-scrollbar")).toContain("display: none;");
    expect(rule(".team-avatar-viewport::-webkit-scrollbar")).toContain("height: 0;");
    expect(rule(".team-avatar-viewport")).toContain("min-width: 0;");
    expect(rule(".team-avatar-row")).toContain("align-items: flex-start;");
    expect(rule(".team-avatar-group .avatar-more")).toContain("margin: 6px 0 0 -8px;");
    expect(component).toContain("title || heading");
    expect(component).toContain("new ResizeObserver(measure)");
  });
  it("animates the circles from their count anchor and makes collapsed members inert", () => {
    expect(rule(".team-avatar-person.is-overflow")).toContain("translateX(8px) scale(0.65)");
    expect(rule(".team-avatar-person.is-overflow")).toContain("pointer-events: none;");
    expect(rule('.team-avatar-group[data-state="open"] .is-overflow')).toContain("transition-delay: var(--avatar-delay)");
    expect(component).toContain("inert={collapsed || undefined}");
    expect(component).toContain("focusable={!collapsed}");
    expect(styles).toContain(".team-avatar-person.is-overflow { transition: none !important; }");
  });
  it("bridges hover to name tooltips and supports keyboard, touch and outside dismissal", () => {
    expect(component).toContain("pointerInside.current || tooltipInside.current");
    expect(component).toContain('onPointerEnter: () => { tooltipInside.current = true; closeDelay.cancel(); }');
    expect(tooltip).toContain("{...contentProps}");
    expect(component).toContain('event.pointerType !== "touch"');
    expect(component).toContain('event.key === "Escape"');
    expect(component).toContain("focus({ preventScroll: true })");
    expect(component).toContain('document.addEventListener("pointerdown", dismiss)');
    expect(component).toContain('document.removeEventListener("pointerdown", dismiss)');
    expect(component).toContain('document.addEventListener("scroll", dismiss, { capture: true, passive: true })');
    expect(component).toContain('document.removeEventListener("scroll", dismiss, true)');
  });
});
