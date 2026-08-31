import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { createSeed } from "./seed";

const selectedView = vi.hoisted(() => ({ value: "archive" }));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useState: (initial: unknown) => actual.useState(initial === "board" ? selectedView.value : initial),
  };
});
vi.mock("./data", () => ({ demoMode: false, supabase: {} }));
vi.mock("./useWorkspace", () => ({ useWorkspace: () => {
  const state = createSeed();
  state.cards[0] = { ...state.cards[0], title: "Archival original", archived_at: "2026-08-31T12:00:00Z" };
  state.cards[1] = { ...state.cards[1], title: "Live original" };
  return {
    authReady: true, passwordGate: "ready", user: { id: "kilian" }, current: state.profiles[0], state,
    activeWorkspaceId: "salescrew", busy: false, connected: true, error: "", mutate: vi.fn(),
  };
} }));

describe("Archive in the app", () => {
  beforeEach(() => { selectedView.value = "archive"; });

  it("uses archive-specific heading, project controls and foreground rows", () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('class="board-heading archive-heading"');
    expect(html).toContain('class="board-toolbar archive-toolbar"');
    expect(html).toContain('aria-label="Archiv nach Projekt filtern"');
    expect(html).toContain('class="view-tab selected archive-view-label"');
    expect(html).toContain('class="board-content archive-content"');
    expect(html).toContain("Archival original");
    expect(html).not.toContain("Live original");
    expect(html).not.toContain("Trello nur schöner");
    expect(html).not.toContain("Neue Karte");
    expect(html).not.toContain('class="secondary label-manage"');
    expect(html.match(/class="board-scroll"/g)).toHaveLength(1);
  });

  it("leaves the taskboard controls and live card rendering intact", () => {
    selectedView.value = "board";
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain("Neue Karte");
    expect(html).toContain('aria-label="Nach Mitglied filtern"');
    expect(html).toContain('class="secondary label-manage"');
    expect(html).toContain('class="board-columns"');
    expect(html).toContain("Live original");
    expect(html).not.toContain("Archival original");
    expect(html).not.toContain('class="board-heading archive-heading"');
  });
});
