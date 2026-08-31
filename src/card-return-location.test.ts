import { describe, expect, it } from "vitest";
import { applyDemoAction, orderedCards, type Action } from "./domain";
import { createSeed } from "./seed";
import { DemoCardSessions } from "./demo-card-sessions";

function fixture() {
  let state = createSeed();
  const sample = state.cards[0];
  state.cards = ["a", "b", "c", "d"].map((id, i) => ({
    ...sample,
    id,
    column_id: "spark",
    project_id: "spark",
    completed_at: null,
    position: (i + 1) * 1024,
  }));
  const act = (action: Action) => {
    state = applyDemoAction(state, state.profiles[0], action);
  };
  const move = (id: string, column_id: string, before_id?: string) =>
    act({ type: "card.move", id, column_id, before_id });
  const complete = (id: string, completed: boolean) =>
    act({ type: "card.complete", id, completed });
  return {
    state: () => state,
    act,
    move,
    complete,
    order: (column = "spark") => orderedCards(state, column).map((c) => c.id),
  };
}
describe("returning completed cards", () => {
  it.each(["a", "b", "d"])("restores %s to the same visible slot", (id) => {
    const f = fixture();
    f.complete(id, true);
    f.complete(id, false);
    expect(f.order()).toEqual(["a", "b", "c", "d"]);
  });
  it("ignores In Arbeit and status-bucket reordering", () => {
    const f = fixture();
    f.move("b", "work");
    f.move("b", "work");
    f.complete("b", true);
    f.move("b", "done");
    f.complete("b", false);
    expect(f.order()).toEqual(["a", "b", "c", "d"]);
    expect(f.state().cards.find((c) => c.id === "b")?.completed_at).toBeNull();
  });
  it("remembers the most recent project, not the creation project", () => {
    const f = fixture();
    f.move("a", "rover");
    f.move("b", "rover");
    f.move("c", "rover");
    f.move("b", "work");
    f.complete("b", true);
    f.complete("b", false);
    expect(f.order("rover")).toEqual(["a", "b", "c"]);
    expect(f.state().cards.find((c) => c.id === "b")?.project_id).toBe("rover");
  });
  it("uses neighboring cards after positions are changed or rebalanced", () => {
    const f = fixture();
    f.complete("b", true);
    f.move("d", "spark", "a");
    f.complete("b", false);
    expect(f.order()).toEqual(["d", "a", "b", "c"]);
  });
  it("falls back to the previous neighbor, then the index if neighbors disappear", () => {
    const f = fixture();
    f.complete("b", true);
    f.act({ type: "card.delete", id: "c" });
    f.complete("b", false);
    expect(f.order()).toEqual(["a", "b", "d"]);
    f.complete("b", true);
    f.act({ type: "card.delete", id: "a" });
    f.act({ type: "card.delete", id: "d" });
    f.complete("b", false);
    expect(f.order()).toEqual(["b"]);
  });
  it("captures the new position on each trip and keeps repeated checks idempotent", () => {
    const f = fixture();
    f.complete("b", true);
    const saved = f.state();
    f.complete("b", true);
    expect(f.state()).toEqual(saved);
    f.complete("b", false);
    f.move("b", "spark", "a");
    f.complete("b", true);
    f.complete("b", false);
    expect(f.order()).toEqual(["b", "a", "c", "d"]);
  });
  it("keeps the saved origin when undoing an uncheck", () => {
    const f = fixture();
    f.move("b", "work");
    f.complete("b", true);
    const sessions = new DemoCardSessions(),
      actor = f.state().profiles[0];
    let state = f.state();
    state = sessions.operate(state, actor, "test", "begin", "b").state;
    state = sessions.operate(state, actor, "test", "mutate", "b", {
      type: "card.complete",
      id: "b",
      completed: false,
    }).state;
    state = sessions.operate(state, actor, "test", "close", "b").state;
    state = sessions.operate(state, actor, "test", "undo", "b").state;
    state = applyDemoAction(state, actor, {
      type: "card.complete",
      id: "b",
      completed: false,
    });
    expect(orderedCards(state, "spark").map((c) => c.id)).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
  });
  it("falls back safely for old finished cards without saved origin metadata", () => {
    const f = fixture();
    f.state().cards[1].column_id = "done";
    f.complete("b", false);
    expect(f.order()).toEqual(["a", "c", "d", "b"]);
  });
});
