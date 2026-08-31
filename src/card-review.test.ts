import { describe, expect, it } from "vitest";
import { cardReadLabel } from "./card-review";
import { applyDemoAction } from "./domain";
import { createSeed } from "./seed";

describe("card reader attribution", () => {
  it("follows the saved account through mark, reload, clear and mark by someone else", () => {
    const seed = createSeed();
    const marked = applyDemoAction(seed, seed.profiles[2], {
      type: "card.review", id: "c2", reviewed: true,
    });
    const reloaded = JSON.parse(JSON.stringify(marked)) as typeof marked;
    expect(cardReadLabel(reloaded.cards[1], reloaded.profiles)).toBe("Von Anna Leitner gelesen");
    const cleared = applyDemoAction(reloaded, seed.profiles[0], {
      type: "card.review", id: "c2", reviewed: false,
    });
    expect(cardReadLabel(cleared.cards[1], cleared.profiles)).toBe("Noch nicht gelesen");
    const remarked = applyDemoAction(cleared, seed.profiles[0], {
      type: "card.review", id: "c2", reviewed: true,
    });
    expect(cardReadLabel(remarked.cards[1], remarked.profiles)).toBe("Von Kilian gelesen");
  });

  it("resolves an account's updated display name without changing stored attribution", () => {
    const state = createSeed();
    const card = { ...state.cards[0], reviewed_at: state.cards[0].created_at, reviewed_by: "kilian" };
    state.profiles[0].name = "Kilian Sternath";
    expect(cardReadLabel(card, state.profiles)).toBe("Von Kilian Sternath gelesen");
  });

  it("does not show a stale reviewer when the card is unread", () => {
    const state = createSeed();
    expect(cardReadLabel({ ...state.cards[0], reviewed_at: null, reviewed_by: "kilian" }, state.profiles)).toBe("Noch nicht gelesen");
  });

  it.each([null, "unknown"])("handles unavailable reviewer IDs (%s) without guessing", (reviewed_by) => {
    const state = createSeed();
    expect(cardReadLabel({ ...state.cards[0], reviewed_at: state.cards[0].created_at, reviewed_by }, state.profiles)).toBe("Von einem Mitglied gelesen");
  });
});
