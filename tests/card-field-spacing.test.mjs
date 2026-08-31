import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("../src/card-editing.css", import.meta.url), "utf8");

describe("card field save-button spacing", () => {
  it("reserves button space only while a save control is visible", () => {
    const paddingRules = [...styles.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter(([, , body]) => /padding-(right|bottom):\s*(122|52)px/.test(body));
    expect(paddingRules).toHaveLength(2);
    for (const [, selector] of paddingRules) {
      expect(selector).toContain(".card-text-control.has-save-control");
    }
  });
});
