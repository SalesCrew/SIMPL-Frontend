import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const rule = (selector) => {
  const start = styles.indexOf(`${selector} {`);
  expect(start, `Missing ${selector}`).toBeGreaterThanOrEqual(0);
  return styles.slice(start, styles.indexOf("}", start));
};

describe("Minimal login layout", () => {
  it("uses a centered white loading-screen composition", () => {
    const page = rule(".login-page");
    expect(page).toContain("place-items: center;");
    expect(page).toContain("background: #fff;");
    expect(rule(".login-shell")).toContain("width: min(100%, 340px);");
    expect(rule(".login-accent")).toContain("width: 112px;");
    expect(rule(".login-accent > span")).toContain("width: 100%;");
  });

  it("keeps the form compact without a decorative panel", () => {
    expect(rule(".login-form")).toContain("gap: 18px;");
    expect(rule(".login-form .primary")).toContain("min-height: 46px;");
    expect(styles).not.toContain(".login-story {");
  });
});
