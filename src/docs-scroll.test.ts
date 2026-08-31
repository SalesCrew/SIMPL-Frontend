import { describe, expect, it } from "vitest";
import { activeDocsSection } from "./docs-scroll";

const sections = [
  { id: "schnellstart", top: 80 },
  { id: "grundprinzip", top: 500 },
  { id: "karten", top: 980 },
  { id: "fragen", top: 2400 },
];

describe("Docs scroll legend", () => {
  it("keeps the first entry active above the first section", () => {
    expect(activeDocsSection(sections, 20)).toBe("schnellstart");
  });

  it("selects the last section that crossed the viewport marker", () => {
    expect(activeDocsSection(sections, 700)).toBe("grundprinzip");
    expect(activeDocsSection(sections, 2400)).toBe("fragen");
  });

  it("handles an empty document safely", () => {
    expect(activeDocsSection([], 100)).toBe("");
  });
});
