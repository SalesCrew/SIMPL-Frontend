import { describe, expect, it } from "vitest";
import { isNearCommentEnd, shouldRevealLatestComment } from "./useCommentViewport";

describe("comment viewport following", () => {
  it("follows short threads and a reader already near the newest message", () => {
    expect(isNearCommentEnd({ scrollHeight: 200, clientHeight: 300, scrollTop: 0 })).toBe(true);
    expect(isNearCommentEnd({ scrollHeight: 1000, clientHeight: 300, scrollTop: 681.5 })).toBe(true);
    expect(isNearCommentEnd({ scrollHeight: 1000, clientHeight: 300, scrollTop: 120 })).toBe(false);
  });

  const previous = { cardId: "card-a", commentId: "old" };
  const incoming = { cardId: "card-a", commentId: "new", authorId: "teammate" };

  it("shows the newest message when switching cards", () => {
    expect(shouldRevealLatestComment(previous, { ...incoming, cardId: "card-b" }, false, "me")).toBe(true);
  });

  it("does not pull a reader away from older comments", () => {
    expect(shouldRevealLatestComment(previous, incoming, false, "me")).toBe(false);
    expect(shouldRevealLatestComment(previous, incoming, true, "me")).toBe(true);
  });

  it("reveals my own newly sent comment even if I had scrolled up", () => {
    expect(shouldRevealLatestComment(previous, { ...incoming, authorId: "me" }, false, "me")).toBe(true);
  });

  it("does not reset reading position on unrelated card updates", () => {
    expect(shouldRevealLatestComment(previous, { ...previous, authorId: "me" }, false, "me")).toBe(false);
  });
});
