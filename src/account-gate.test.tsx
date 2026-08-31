import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { createSeed } from "./seed";

const gate = vi.hoisted(() => ({ value: "checking", authReady: true, hasBoard: true, error: "" }));
vi.mock("./data", () => ({ demoMode: false, supabase: {}, changeInitialPassword: vi.fn() }));
vi.mock("./useWorkspace", () => ({ useWorkspace: () => {
  const state = createSeed();
  return { authReady: gate.authReady, user: { id: "kilian", email: "private@example.invalid" },
    passwordGate: gate.value, state: gate.hasBoard ? state : null, current: state.profiles[0], activeWorkspaceId: "salescrew",
    refresh: async () => {}, error: gate.error };
} }));

beforeEach(() => Object.assign(gate, { value: "checking", authReady: true, hasBoard: true, error: "" }));

describe("Account gate before all board rendering", () => {
  it.each(["checking", "required", "reauthenticate", "unavailable"])("hides even a cached board when %s", (value) => {
    gate.value = value;
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain(value === "checking" ? 'class="access-loading"' : 'class="password-gate"');
    expect(html).not.toContain('class="sidebar"');
    expect(html).not.toContain("Dashboard – Mitbewerb");
    expect(html).not.toContain("Neue Karte");
    expect(html.match(/type="password"/g) || []).toHaveLength(value === "required" ? 2 : 0);
  });
  it("uses the same quiet loading surface for session and workspace checks without exposing cached data", () => {
    for (const stage of ["session", "workspace"]) {
      gate.value = "ready";
      gate.authReady = stage !== "session";
      gate.hasBoard = stage === "session";
      const html = renderToStaticMarkup(<App />);
      expect(html).toContain('class="access-loading"');
      expect(html).toContain(stage === "session" ? "Workspace wird geladen" : "Zugriffsrechte werden geprüft");
      expect(html).not.toContain('class="sidebar"');
      expect(html).not.toContain("Dashboard – Mitbewerb");
      expect(html).not.toContain("private@example.invalid");
    }
  });
  it("retains error recovery while keeping the workspace blocked", () => {
    gate.error = "Bitte Verbindung prüfen.";
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('data-state="error"');
    expect(html).toContain('role="alert">Bitte Verbindung prüfen.');
    expect(html).toContain("Erneut versuchen");
    expect(html).not.toContain('class="sidebar"');
  });
});
