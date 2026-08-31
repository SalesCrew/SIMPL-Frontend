import { describe, expect, it } from "vitest";
import { cardMatchesMember } from "./card-filters";
import { workspaceBoard } from "./domain";
import { createSeed } from "./seed";

describe("People filter includes creators and assignees", () => {
  it.each([
    ["an unassigned request", "philipp", null, true],
    ["a request assigned to someone else", "philipp", "anna", true],
    ["a card assigned to the selected person", "anna", "philipp", true],
    ["a self-assigned card", "philipp", "philipp", true],
    ["someone else's unassigned card", "anna", null, false],
    ["someone else's assigned card", "anna", "ben", false],
  ])("matches %s correctly", (_label, created_by, assignee_id, matches) => {
    expect(cardMatchesMember({ created_by, assignee_id }, "philipp")).toBe(matches);
  });

  it("includes imported creator-only cards without duplicating self-assigned cards", () => {
    const original = createSeed().cards[0];
    const cards = [
      { ...original, id: "import-1", created_by: "philipp", assignee_id: null },
      { ...original, id: "import-2", created_by: "philipp", assignee_id: null },
      { ...original, id: "assigned", created_by: "anna", assignee_id: "philipp" },
      { ...original, id: "both", created_by: "philipp", assignee_id: "philipp" },
      { ...original, id: "unrelated", created_by: "anna", assignee_id: null },
    ];
    const before = structuredClone(cards);
    expect(cards.filter((card) => cardMatchesMember(card, "philipp")).map((card) => card.id))
      .toEqual(["import-1", "import-2", "assigned", "both"]);
    expect(cards).toEqual(before);
  });

  it("does not change workspace scoping or depend on completion and archive state", () => {
    const state = createSeed();
    const original = state.cards[0];
    state.cards = [
      { ...original, id: "active", created_by: "philipp", assignee_id: null },
      { ...original, id: "done", created_by: "philipp", assignee_id: null, completed_at: "2026-08-31T12:00:00Z" },
      { ...original, id: "archived", created_by: "philipp", assignee_id: null, archived_at: "2026-08-31T12:00:00Z" },
      { ...original, id: "other-workspace", created_by: "philipp", assignee_id: null, workspace_id: "other" },
    ];
    const scoped = workspaceBoard(state, "salescrew").cards;
    expect(scoped.filter((card) => cardMatchesMember(card, "philipp")).map((card) => card.id))
      .toEqual(["active", "done", "archived"]);
  });
});
