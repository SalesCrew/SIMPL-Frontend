import type { Card } from "./types";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function cardIdFromUrl(value: string) {
  try {
    const cardId = new URL(value, "https://get-simpl.vercel.app").searchParams.get(
      "card",
    );
    return cardId && uuidPattern.test(cardId) ? cardId : null;
  } catch {
    return null;
  }
}

export function initialCardDeepLink() {
  return typeof window === "undefined" ? null : cardIdFromUrl(window.location.href);
}

export function withoutCardDeepLink(value: string) {
  const url = new URL(value, "https://get-simpl.vercel.app");
  url.searchParams.delete("card");
  return `${url.pathname}${url.search}${url.hash}`;
}

export function cardDeepLinkTarget(
  cards: Pick<Card, "id" | "workspace_id" | "archived_at">[],
  cardId: string,
) {
  const card = cards.find((entry) => entry.id === cardId);
  return card
    ? {
        id: card.id,
        workspaceId: card.workspace_id,
        archived: !!card.archived_at,
      }
    : null;
}
