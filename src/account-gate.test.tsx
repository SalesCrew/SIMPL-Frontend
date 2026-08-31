import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import App from "./App";
import { createSeed } from "./seed";

const gate = vi.hoisted(() => ({ value: "checking" }));
vi.mock("./data", () => ({ demoMode: false, supabase: {}, changeInitialPassword: vi.fn() }));
vi.mock("./useWorkspace", () => ({ useWorkspace: () => {
  const state = createSeed();
  return { authReady: true, user: { id: "kilian", email: "private@example.invalid" },
    passwordGate: gate.value, state, current: state.profiles[0], activeWorkspaceId: "salescrew",
    refresh: async () => {}, error: "" };
} }));

describe("Account gate before all board rendering", () => {
  it.each(["checking", "required", "reauthenticate", "unavailable"])("hides even a cached board when %s", (value) => {
    gate.value = value;
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('class="password-gate"');
    expect(html).not.toContain('class="sidebar"');
    expect(html).not.toContain("Dashboard – Mitbewerb");
    expect(html).not.toContain("Neue Karte");
    expect(html.match(/type="password"/g) || []).toHaveLength(value === "required" ? 2 : 0);
  });
});
