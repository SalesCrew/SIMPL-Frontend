import { describe, expect, it } from "vitest";
import { colors, colorNames } from "./types";
import { applyDemoAction } from "./domain";
import { createSeed } from "./seed";

describe("Shared pastel palette", () => {
  it("provides 16 distinct colors with German names", () => {
    expect(colors).toHaveLength(16);
    expect(new Set(colors).size).toBe(16);
    expect(new Set(colors.map((color) => colorNames[color])).size).toBe(16);
    expect(colors.every((color) => colorNames[color].length > 0)).toBe(true);
  });
  it("preserves every color on labels, projects and profiles", () => {
    const state = createSeed();
    const admin = state.profiles[0];
    for (const color of colors) {
      const labels = applyDemoAction(state, admin, {
        type: "label.save",
        label: { id: "palette-check", name: "Pastell", color },
      });
      expect(
        labels.labels.find((label) => label.id === "palette-check")?.color,
      ).toBe(color);
      const columns = applyDemoAction(state, admin, {
        type: "column.save",
        column: { ...state.columns[0], color },
      });
      expect(
        columns.columns.find((column) => column.id === state.columns[0].id)
          ?.color,
      ).toBe(color);
      const profiles = applyDemoAction(state, admin, {
        type: "profile.save",
        profile: { ...admin, color },
        isNew: false,
      });
      expect(
        profiles.profiles.find((profile) => profile.id === admin.id)?.color,
      ).toBe(color);
    }
  });
});
