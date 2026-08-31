import { applyDemoAction, type Action } from "./domain";
import type { BoardState, Card, Profile } from "./types";

export type CardMove = Extract<Action, { type: "card.move" }>;
export interface PendingCardMove {
  action: CardMove;
  actorId: string;
  authorizationVersion?: number;
  startedAt: string;
}

export function projectCardMoves(state: BoardState, actor: Profile, pending: PendingCardMove[]): BoardState {
  return pending.reduce((visible, move) => {
    if (move.actorId !== actor.id || move.authorizationVersion !== state.access_revision?.authorization_version)
      return visible;
    const card = visible.cards.find((c) => c.id === move.action.id);
    const target = visible.columns.find((c) => c.id === move.action.column_id);
    // An optimistic overlay may never restore data removed by a fresh access check.
    if (!card || card.archived_at || card.deleted_at || !target || target.workspace_id !== card.workspace_id)
      return visible;
    const next = applyDemoAction(visible, actor, move.action);
    const moved = next.cards.find((c) => c.id === card.id)!;
    moved.updated_at = move.startedAt;
    if (moved.completed_at && !card.completed_at) moved.completed_at = move.startedAt;
    return next;
  }, state);
}

/** Receipts include every rebalanced destination card, not just the dragged card.
 * Only merge rows still visible locally; a delayed response must not resurrect a
 * deleted/hidden card or overwrite a newer edit from a different request. */
export function mergeMoveReceipt(state: BoardState, cards: Card[]): BoardState {
  const received = new Map(cards.map((card) => [card.id, card]));
  return {
    ...state,
    cards: state.cards.map((card) => {
      const incoming = received.get(card.id);
      return incoming && incoming.workspace_id === card.workspace_id &&
        !card.deleted_at && !card.archived_at &&
        (incoming.edit_revision ?? 0) >= (card.edit_revision ?? 0) ? incoming : card;
    }),
  };
}

export function sameMoveAccess(move: PendingCardMove, state: BoardState | null, actorId?: string): boolean {
  return Boolean(state && actorId === move.actorId &&
    state.access_revision?.authorization_version === move.authorizationVersion);
}
