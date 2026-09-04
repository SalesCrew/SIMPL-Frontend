import { describe, expect, it } from "vitest";
import type { Action } from "./domain";
import { emailEventForAction } from "./data";

function event(action: Partial<Action> & { type: Action["type"] }) {
  return emailEventForAction(action as Action);
}

describe("workspace email action mapping", () => {
  it("maps every supported committed action", () => {
    expect(event({ type: "card.create" })).toBe("card.created");
    expect(event({ type: "comment.create" })).toBe("comment.created");
    expect(event({ type: "card.review", reviewed: true })).toBe("card.reviewed");
    expect(event({ type: "card.complete", completed: true })).toBe("card.completed");
    expect(event({ type: "card.archive" })).toBe("card.archived");
  });

  it("does not send read or completed mail when those states are removed", () => {
    expect(event({ type: "card.review", reviewed: false })).toBeNull();
    expect(event({ type: "card.complete", completed: false })).toBeNull();
    expect(event({ type: "card.update" })).toBeNull();
  });
});
