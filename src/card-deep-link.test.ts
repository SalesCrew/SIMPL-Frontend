import { describe, expect, it } from "vitest";
import {
  cardDeepLinkTarget,
  cardIdFromUrl,
  withoutCardDeepLink,
} from "./card-deep-link";

const cardId = "40000000-0000-4000-8000-000000000004";

describe("card email deep links", () => {
  it("reads a valid card id from an absolute or relative SIMPL URL", () => {
    expect(cardIdFromUrl(`https://get-simpl.vercel.app/?card=${cardId}`)).toBe(
      cardId,
    );
    expect(cardIdFromUrl(`/?card=${cardId}`)).toBe(cardId);
  });

  it("rejects malformed card ids", () => {
    expect(cardIdFromUrl("/?card=not-a-card")).toBeNull();
    expect(cardIdFromUrl("https://get-simpl.vercel.app/")).toBeNull();
  });

  it("consumes only the card parameter and preserves the rest of the URL", () => {
    expect(
      withoutCardDeepLink(
        `https://get-simpl.vercel.app/?source=email&card=${cardId}#fragen`,
      ),
    ).toBe("/?source=email#fragen");
  });

  it("resolves active and archived cards to their workspace", () => {
    const cards = [
      { id: cardId, workspace_id: "development", archived_at: null },
      {
        id: "50000000-0000-4000-8000-000000000005",
        workspace_id: "samsung",
        archived_at: "2026-09-25T12:00:00.000Z",
      },
    ];
    expect(cardDeepLinkTarget(cards, cardId)).toEqual({
      id: cardId,
      workspaceId: "development",
      archived: false,
    });
    expect(cardDeepLinkTarget(cards, cards[1].id)).toEqual({
      id: cards[1].id,
      workspaceId: "samsung",
      archived: true,
    });
    expect(cardDeepLinkTarget(cards, crypto.randomUUID())).toBeNull();
  });
});
