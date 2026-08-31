import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import App from "./App";
import { createSeed } from "./seed";

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useState: (initial: unknown) => actual.useState(initial === "board" ? "docs" : initial) };
});
vi.mock("./data", () => ({ demoMode: false, supabase: {} }));
vi.mock("./useWorkspace", () => ({ useWorkspace: () => {
  const state = createSeed();
  return {
    authReady: true, passwordGate: "ready", user: { id: "kilian" }, current: state.profiles[0], state,
    activeWorkspaceId: "salescrew", busy: false, connected: true, error: "", mutate: vi.fn(),
  };
} }));

describe("Docs in the application shell", () => {
  it("places Docs below the profile and opens the integrated page", () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('class="docs-page"');
    expect(html).toContain('class="nav-item sidebar-docs active"');
    expect(html.indexOf('class="profile-bar"')).toBeLessThan(html.indexOf('aria-label="Docs"'));
    expect(html.indexOf('aria-label="Docs"')).toBeLessThan(html.indexOf('aria-label="Abmelden"'));
    expect(html).toContain("Docs</span>");
    expect(html).not.toContain('class="board-columns"');
  });
});
