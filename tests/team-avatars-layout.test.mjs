import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const component = readFileSync(new URL("../src/components/TeamAvatars.tsx", import.meta.url), "utf8");
const rule = (selector) => {
  const start = styles.indexOf(`${selector} {`);
  expect(start, `Missing ${selector}`).toBeGreaterThanOrEqual(0);
  return styles.slice(start, styles.indexOf("}", start));
};

describe("Avatar expansion presentation", () => {
  it("expands in a portal to the left without resizing the in-flow header stack", () => {
    expect(component).toContain("<Popover.Portal>");
    expect(component).toContain('side="left"');
    expect(component).toContain("collisionBoundary=");
    expect(component).toContain("hideWhenDetached");
    expect(rule(".avatar-stack .avatar")).toContain("width: 33px;");
    expect(rule(".team-avatar-group")).not.toContain("width:");
    expect(rule(".team-overflow-popover")).toContain("var(--radix-popover-content-available-width)");
  });
  it("wraps long teams and keeps any scrolling inside rounded edges", () => {
    expect(rule(".team-overflow-list")).toContain("flex-wrap: wrap;");
    expect(rule(".team-overflow-list")).toContain("overflow-y: auto;");
    expect(rule(".team-overflow-popover")).toContain("overflow: hidden;");
    expect(rule(".team-overflow-popover")).toContain("var(--radix-popover-content-available-height)");
  });
  it("reveals from right to left and respects reduced motion", () => {
    expect(styles).toContain("clip-path: inset(-12px -24px -12px 100% round 23px)");
    expect(styles).toContain("animation-delay: var(--avatar-delay)");
    expect(styles).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*{\s*\.team-overflow-popover,\s*\.team-overflow-person\s*{ animation: none !important;/);
  });
  it("supports touch activation and dismisses when the header scrolls away", () => {
    expect(component).toContain('event.pointerType !== "touch"');
    expect(component).toContain('document.addEventListener("scroll", dismiss, { capture: true, passive: true })');
    expect(component).toContain('document.removeEventListener("scroll", dismiss, true)');
    expect(component).toContain("skipFocusRestore.current = true");
    expect(rule(".team-overflow-popover[data-state=\"closed\"]")).toContain("pointer-events: none;");
  });
});
