import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../src/components/docs.css", import.meta.url), "utf8");

describe("Docs hero artwork", () => {
  it("uses the selected dune artwork as its full background", () => {
    expect(css).toMatch(/background-image: url\("\/images\/docs-dune-contours-v1\.png"\)/);
    expect(css).toMatch(/background-position: right center/);
    expect(css).toMatch(/background-size: cover/);
    expect(css).not.toMatch(/\.docs-hero-mark/);
  });
});
