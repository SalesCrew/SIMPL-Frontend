import { describe, expect, it } from "vitest";
import { createSeed } from "./seed";
import {
  mergeCardCreateReceipt,
  projectCardCreate,
  removeOptimisticCard,
} from "./optimistic-card-creates";

describe("optimistic card creation", () => {
  it("projects a new card immediately without changing the server snapshot", () => {
    const state = createSeed();
    const action = {
      type: "card.create" as const,
      id: "new-card",
      title: "Sofort sichtbar",
      column_id: "spark",
      project_id: "spark",
      assignee_id: "kilian",
      label_ids: [],
    };

    const projected = projectCardCreate(state, state.profiles[0], action);

    expect(projected.card).toMatchObject({
      id: "new-card",
      title: "Sofort sichtbar",
      column_id: "spark",
    });
    expect(projected.state.cards).toHaveLength(state.cards.length + 1);
    expect(state.cards.some((card) => card.id === "new-card")).toBe(false);
  });

  it("reconciles the optimistic card with the database row and can roll it back", () => {
    const state = createSeed();
    const projected = projectCardCreate(state, state.profiles[0], {
      type: "card.create",
      id: "new-card",
      title: "Sofort sichtbar",
      column_id: "spark",
      project_id: "spark",
    });
    const receipt = {
      ...projected.card,
      position: 4096,
      updated_at: "2026-09-03T12:00:00.000Z",
    };

    const reconciled = mergeCardCreateReceipt(projected.state, receipt);
    expect(reconciled.cards.find((card) => card.id === receipt.id)).toEqual(receipt);
    expect(reconciled.cards.filter((card) => card.id === receipt.id)).toHaveLength(1);
    expect(removeOptimisticCard(reconciled, receipt.id).cards).toEqual(state.cards);
  });
});
