import { applyDemoAction, type Action } from "./domain";
import type { BoardState, Card, Profile } from "./types";

export type CardCreateAction = Extract<Action, { type: "card.create" }>;

export function projectCardCreate(
  state: BoardState,
  actor: Profile,
  action: CardCreateAction,
): { state: BoardState; card: Card } {
  const existing = new Set(state.cards.map((card) => card.id));
  const projected = applyDemoAction(state, actor, action);
  const card = projected.cards.find((candidate) => !existing.has(candidate.id));
  if (!card) throw new Error("Die neue Karte konnte nicht vorbereitet werden.");
  return {
    state: { ...state, cards: [...state.cards, card] },
    card,
  };
}

export function mergeCardCreateReceipt(
  state: BoardState,
  receipt: Card,
): BoardState {
  const exists = state.cards.some((card) => card.id === receipt.id);
  return {
    ...state,
    cards: exists
      ? state.cards.map((card) => (card.id === receipt.id ? receipt : card))
      : [...state.cards, receipt],
  };
}

export function removeOptimisticCard(
  state: BoardState,
  cardId: string,
): BoardState {
  return {
    ...state,
    cards: state.cards.filter((card) => card.id !== cardId),
  };
}
