import { describe, expect, it } from "vitest";
import { applyDemoAction, canAccessWorkspace, orderedColumns, restoreFixedBuckets, workspaceBoard } from "./domain";
import { createSeed } from "./seed";

function emptyProject() {
  const state = createSeed();
  for (const card of state.cards) if (card.column_id === "spark") card.column_id = "work";
  return state;
}

describe("workspace accounts and retained projects", () => {
  it("removes a project from active columns without deleting any historical records or access", () => {
    const state = emptyProject();
    const next = applyDemoAction(state, state.profiles[0], { type: "column.delete", id: "spark" });
    expect(next.columns.find((column) => column.id === "spark")).toMatchObject({ name: "SPARK", archived_at: expect.any(String) });
    expect(orderedColumns(next.columns).some((column) => column.id === "spark")).toBe(false);
    expect(workspaceBoard(next, "salescrew").columns.some((column) => column.id === "spark")).toBe(true);
    for (const key of ["cards", "comments", "attachments", "profiles", "notifications"] as const) expect(next[key]).toEqual(state[key]);
    expect(next.profiles.map((profile) => canAccessWorkspace(next, profile, "salescrew")))
      .toEqual(state.profiles.map((profile) => canAccessWorkspace(state, profile, "salescrew")));
  });

  it("retains archived cards even when their current column is removed", () => {
    const state = emptyProject();
    const historical = state.cards[0];
    historical.column_id = historical.project_id = "spark";
    historical.archived_at = "2026-09-01T12:00:00Z";
    historical.completed_at = historical.archived_at;
    const next = applyDemoAction(state, state.profiles[0], { type: "column.delete", id: "spark" });
    expect(next.cards).toEqual(state.cards);
    expect(next.columns.find((column) => column.id === historical.project_id)?.name).toBe("SPARK");
  });

  it("requires active cards to leave the project column first and keeps fixed columns", () => {
    const state = createSeed();
    expect(() => applyDemoAction(state, state.profiles[0], { type: "column.delete", id: "spark" })).toThrow("aktiven Karten");
    expect(() => applyDemoAction(state, state.profiles[0], { type: "column.delete", id: "work" })).toThrow("feste Spalten");
    expect(() => applyDemoAction(state, state.profiles[2], { type: "column.delete", id: "obi" })).toThrow();
  });

  it("prevents new tasks and moves into a removed project", () => {
    const state = emptyProject();
    const next = applyDemoAction(state, state.profiles[0], { type: "column.delete", id: "spark" });
    expect(() => applyDemoAction(next, next.profiles[0], { type: "card.create", title: "New", column_id: "spark", project_id: "spark" })).toThrow("gültiges Projekt");
    expect(() => applyDemoAction(next, next.profiles[0], { type: "card.move", id: next.cards[0].id, column_id: "spark" })).toThrow("entfernt");
  });

  it("reopens completed tasks in the visible work bucket while retaining their historical project", () => {
    const state = emptyProject();
    state.cards[0].column_id = "done";
    state.cards[0].completed_at = "2026-09-01T12:00:00Z";
    state.cards[0].return_column_id = "spark";
    const hidden = applyDemoAction(state, state.profiles[0], { type: "column.delete", id: "spark" });
    const next = applyDemoAction(hidden, hidden.profiles[0], { type: "card.complete", id: state.cards[0].id, completed: false });
    expect(next.cards[0]).toMatchObject({ column_id: "work", project_id: "spark", completed_at: null });
  });

  it("upgrades old project preferences without changing account identity, role or workspace access", () => {
    const state = createSeed();
    state.profiles[2].default_column_id = "spark";
    const upgraded = restoreFixedBuckets(state);
    expect(upgraded.profiles[2]).toEqual({ ...state.profiles[2], default_column_id: null });
    expect(upgraded.cards).toEqual(state.cards);
    expect(upgraded.comments).toEqual(state.comments);
    expect(upgraded.profiles.map((profile) => canAccessWorkspace(upgraded, profile, "salescrew")))
      .toEqual(state.profiles.map((profile) => canAccessWorkspace(state, profile, "salescrew")));
  });
});
