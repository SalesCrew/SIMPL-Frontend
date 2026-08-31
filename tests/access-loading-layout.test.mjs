import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

describe("Access loading layout", () => {
  it("keeps a white, responsive surface and disables motion for reduced-motion users", () => {
    const screen = css.slice(css.indexOf(".access-loading {"), css.indexOf(".password-gate {"));
    expect(screen).toContain("min-height: 100dvh;");
    expect(screen).toContain("background: #fff;");
    expect(screen).toContain("width: min(100%, 360px);");
    expect(screen).toContain("font-size: 13px;");
    expect(screen).toContain("@media (prefers-reduced-motion: reduce)");
    expect(screen).toContain(".access-loading-track > span { animation: none; }");
    expect(screen).not.toMatch(/box-shadow:|backdrop-filter:/);
  });
});
