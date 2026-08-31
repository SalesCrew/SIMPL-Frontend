import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path) => readFileSync(resolve(process.cwd(), path), "utf8");
const styles = read("src/styles.css");
const faces = read("src/fonts.css");
const editing = read("src/card-editing.css");
const rule = (selector) => {
  const start = styles.indexOf(`${selector} {`);
  expect(start, `Missing ${selector}`).toBeGreaterThanOrEqual(0);
  return styles.slice(start, styles.indexOf("}", start));
};

describe("verified Trello typography", () => {
  it("uses the actual font everywhere, with no old display or body families", () => {
    expect(styles).toContain('@import "./fonts.css"');
    expect(styles + editing).not.toMatch(/DM Sans|Manrope|Georgia|fonts\.googleapis/);
    expect(faces).toContain('--font-ui: "Atlassian Sans"');
    expect(faces).toContain("--font-weight-bold: 653");
    expect(faces).toContain("--font-tracking-popover: -0.003em");
    expect(styles + editing).not.toMatch(/font-weight:\s*\d/);
  });

  it("ships all normal and true-italic subsets with their font license", () => {
    const directory = resolve(process.cwd(), "public/fonts/atlassian-sans-v4");
    const files = readdirSync(directory).filter((file) => file.endsWith(".woff2"));
    expect(files).toHaveLength(14);
    expect(faces.match(/@font-face/g)).toHaveLength(14);
    expect(faces.match(/font-style: italic/g)).toHaveLength(7);
    expect(faces.match(/font-weight: 100 900/g)).toHaveLength(14);
    for (const file of files) {
      expect(faces).toContain(`/fonts/atlassian-sans-v4/${file}`);
      expect(readFileSync(resolve(directory, file)).subarray(0, 4).toString()).toBe("wOF2");
    }
    const license = read("public/fonts/atlassian-sans-v4/OFL.txt");
    expect(license).toContain("Portions Copyright 2025 Atlassian Pty Ltd.");
    expect(license).toContain("SIL OPEN FONT LICENSE Version 1.1");
    expect(createHash("sha256").update(readFileSync(resolve(directory, "AtlassianSans-latin.woff2"))).digest("hex"))
      .toBe("bc3232bfe6fa003ed8537db7f1a0bc8d399a3e9767ecdd73030b73a3b0842b72");
    expect(read("index.html")).toContain('rel="preload" href="/fonts/atlassian-sans-v4/AtlassianSans-latin.woff2"');
  });

  it("removes only the requested eyebrow and reserves its measured space", () => {
    const app = read("src/App.tsx");
    expect(app).not.toContain("ALLES AN EINEM ORT");
    expect(app).toContain('className="board-eyebrow-space" aria-hidden="true"');
    expect(app).toContain("GUTE ARBEIT IST TEAMARBEIT");
    expect(rule(".board-eyebrow-space")).toContain("height: 10.4px");
    expect(rule(".board-eyebrow-space")).toContain("margin-bottom: 11px");
    expect(rule(".board-heading")).toContain("padding: 38px 38px 32px");
    expect(rule(".board-heading h1")).toContain("font-size: 34px");
    expect(rule(".board-heading h1")).toContain("line-height: 1.3");
    expect(rule(".board-heading p")).toContain("line-height: 14.4px");
    expect(rule(".board-heading p")).toContain("margin-top: 9px");
    expect(rule(".team-copy")).toContain("line-height: 11.2px");
  });

  it("retains the existing compact type sizes and mobile icon-only controls", () => {
    expect(rule(".task-card h3")).toContain("font-size: 12px");
    expect(rule(".modal-heading h2")).toContain("font-size: 19px");
    expect(rule(".select-option")).toContain("font-size: 12px");
    expect(rule(".comment p")).toContain("font-size: 12px");
    expect(styles.match(/font-size: 0;/g)).toHaveLength(4);
    expect(styles).toContain(".card-text-field.is-title input,");
    expect(styles).toContain(".card-text-field.is-description > label,");
  });
});
