import { describe, expect, it } from "vitest";
import { applyDemoAction, orderedCards } from "./domain";
import { createSeed } from "./seed";
import { mergeMoveReceipt, projectCardMoves, sameMoveAccess, type PendingCardMove } from "./optimistic-card-moves";

function fixture() {
  const state = createSeed();
  const actor = state.profiles[0];
  const move: PendingCardMove = { action: { type: "card.move", id: "c1", column_id: "rover", before_id: "c6" },
    actorId: actor.id, startedAt: "2026-08-31T19:00:00.000Z" };
  return { state, actor, move };
}

describe("optimistic card movement", () => {
  it("immediately projects the exact destination slot without altering the saved board", () => {
    const { state, actor, move } = fixture();
    const visible = projectCardMoves(state, actor, [move]);
    expect(orderedCards(visible, "rover").map((c) => c.id)).toEqual(["c5", "c1", "c6", "c7"]);
    expect(state.cards.find((c) => c.id === "c1")?.column_id).toBe("spark");
    expect(visible.cards.find((c) => c.id === "c1")).toMatchObject({ project_id: "spark", updated_at: move.startedAt });
  });
  it("keeps a pending drop in place through polling and preserves newly received comments and edits", () => {
    const { state, actor, move } = fixture();
    const refreshed = structuredClone(state);
    refreshed.cards[0].title = "Updated by another teammate";
    refreshed.comments.push({ ...state.comments[0], id: "new-comment" });
    const visible = projectCardMoves(refreshed, actor, [move]);
    expect(visible.cards[0]).toMatchObject({ column_id: "rover", title: "Updated by another teammate" });
    expect(visible.comments).toHaveLength(state.comments.length + 1);
  });
  it("rolls back only a failed move while another pending move remains visible", () => {
    const { state, actor, move } = fixture();
    const other = { ...move, action: { ...move.action, id: "c2", column_id: "obi", before_id: null } };
    const both = projectCardMoves(state, actor, [move, other]);
    expect(both.cards[0].column_id).toBe("rover");
    const rolledBack = projectCardMoves(state, actor, [other]);
    expect(rolledBack.cards[0].column_id).toBe("spark");
    expect(rolledBack.cards[1].column_id).toBe("obi");
  });
  it("handles same-column reordering and an empty destination", () => {
    const { state, actor, move } = fixture();
    const reordered = projectCardMoves(state, actor, [{ ...move, action: { ...move.action, column_id: "spark", before_id: "c4" } }]);
    expect(orderedCards(reordered, "spark").map((c) => c.id)).toEqual(["c2", "c3", "c1", "c4"]);
    const empty = projectCardMoves(state, actor, [{ ...move, action: { ...move.action, column_id: "obi", before_id: null } }]);
    expect(orderedCards(empty, "obi").map((c) => c.id)).toEqual(["c1"]);
  });
  it("preserves Fertig completion and the original return slot through In Arbeit", () => {
    const { state, actor, move } = fixture();
    const work = projectCardMoves(state, actor, [{ ...move, action: { ...move.action, column_id: "work", before_id: null } }]);
    expect(work.cards[0]).toMatchObject({ completed_at: null, return_column_id: "spark", return_before_id: "c2", return_index: 0 });
    const done = projectCardMoves(work, actor, [{ ...move, action: { ...move.action, column_id: "done", before_id: null } }]);
    expect(done.cards[0]).toMatchObject({ completed_at: move.startedAt, return_column_id: "spark", return_index: 0 });
    const reopened = applyDemoAction(done, actor, { type: "card.complete", id: "c1", completed: false });
    expect(orderedCards(reopened, "spark")[0].id).toBe("c1");
  });
  it("does not restore missing, deleted, archived, cross-workspace or no-longer-authorized data", () => {
    const { state, actor, move } = fixture();
    const missing = { ...state, cards: state.cards.slice(1) };
    expect(projectCardMoves(missing, actor, [move])).toEqual(missing);
    for (const patch of [{ archived_at: move.startedAt }, { deleted_at: move.startedAt }]) {
      const locked = { ...state, cards: state.cards.map((c) => c.id === "c1" ? { ...c, ...patch } : c) };
      expect(projectCardMoves(locked, actor, [move])).toEqual(locked);
    }
    const changedAccess = { ...state, access_revision: { id: actor.id, authorization_version: 2, board_version: 2 } };
    expect(projectCardMoves(changedAccess, actor, [move])).toBe(changedAccess);
    expect(projectCardMoves(state, state.profiles[1], [move])).toBe(state);
    expect(sameMoveAccess(move, null, actor.id)).toBe(false);
    expect(sameMoveAccess(move, changedAccess, actor.id)).toBe(false);
    expect(sameMoveAccess(move, state, actor.id)).toBe(true);
    const foreign = { ...state, columns: state.columns.map((c) => c.id === "rover" ? { ...c, workspace_id: "foreign" } : c) };
    expect(projectCardMoves(foreign, actor, [move])).toBe(foreign);
  });
  it("merges all rebalanced positions and ignores out-of-order older receipts", () => {
    const { state, actor, move } = fixture();
    const saved = projectCardMoves(state, actor, [move]);
    const receipt = orderedCards(saved, "rover").map((c, i) => ({ ...c, position: (i + 1) * 1024, edit_revision: 3 }));
    const merged = mergeMoveReceipt(state, receipt);
    expect(orderedCards(merged, "rover").map((c) => c.id)).toEqual(["c5", "c1", "c6", "c7"]);
    const stale = receipt.map((c) => ({ ...c, column_id: "spark", edit_revision: 2 }));
    expect(mergeMoveReceipt(merged, stale)).toEqual(merged);
    expect(mergeMoveReceipt({ ...state, cards: [] }, receipt).cards).toEqual([]);
  });
});
