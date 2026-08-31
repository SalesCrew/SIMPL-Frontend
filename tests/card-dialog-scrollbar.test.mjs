import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const rule = (selector) => {
  const start = styles.indexOf(`${selector} {`);
  expect(start, `Missing ${selector}`).toBeGreaterThanOrEqual(0);
  return styles.slice(start, styles.indexOf("}", start));
};

describe("card dialog outer scrollbar", () => {
  it("hides only the card window scrollbar and releases its gutter and inset", () => {
    const cardBody = rule(".modal-body:has(> .card-detail)");
    expect(cardBody).toContain("scrollbar-width: none;");
    expect(cardBody).toContain("scrollbar-gutter: auto;");
    expect(cardBody).toContain("margin: 0;");
    expect(cardBody).toContain("border-radius: 0;");
    expect(rule(".modal-body:has(> .card-detail)::-webkit-scrollbar"))
      .toContain("display: none;");
  });

  it("preserves scrolling and the scrollbar treatment of other dialogs", () => {
    const body = rule(".modal-body");
    expect(body).toContain("overflow: auto;");
    expect(body).toContain("scrollbar-gutter: stable;");
    expect(body).toContain("margin: 0 6px 6px 0;");
    expect(rule(".modal-body:has(> .card-detail)")).not.toContain("overflow:");
    expect(rule(".modal")).toContain("overflow: hidden;");
  });

  it("keeps the comments' own scrolling and viewport-height layout", () => {
    const comments = rule(".comment-list");
    expect(comments).toContain("overflow: auto;");
    expect(comments).toContain("scrollbar-gutter: stable;");
    expect(comments).not.toContain("scrollbar-width: none;");
    expect(rule(".comments-panel")).toContain("height: var(--comments-viewport-height,");
    expect(rule(".comments-panel")).toContain("position: sticky;");
  });
});
