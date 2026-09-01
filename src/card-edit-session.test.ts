import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CardEditSession,
  type EditReceipt,
  type EditTransport,
} from "./card-edit-session";
import { DemoCardSessions } from "./demo-card-sessions";
import { createSeed } from "./seed";

afterEach(() => vi.useRealTimers());
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
const receipt: EditReceipt = {
  id: "s",
  card_id: "c",
  title: "Test",
  opened_at: "now",
  events: [{ field: "title", before: "A", after: "B", at: "now" }],
};
describe("card edit controller", () => {
  it("snapshots before accepting edits and closes the UI without waiting", async () => {
    vi.useFakeTimers();
    const opened = deferred<EditReceipt>();
    const calls: string[] = [];
    const transport: EditTransport = async (_id, operation) => {
      calls.push(operation);
      return operation === "begin" ? opened.promise : receipt;
    };
    const done = vi.fn();
    const session = new CardEditSession("c", transport, done, vi.fn());
    const saved = session.mutate({
      type: "card.update",
      id: "c",
      patch: { title: "B" },
    });
    expect(session.close()).toBeUndefined();
    expect(calls).toEqual(["begin"]);
    opened.resolve(receipt);
    expect(await saved).toBe(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toEqual(["begin", "mutate", "close"]);
    expect(done).toHaveBeenCalledOnce();
    session.close();
    await vi.advanceTimersByTimeAsync(60000);
    expect(calls).toEqual(["begin", "mutate", "close"]);
  });
  it("finishes an upload and its final save before closing the server session", async () => {
    vi.useFakeTimers();
    const bytes = deferred<void>();
    const calls: string[] = [];
    const done = vi.fn();
    const session = new CardEditSession(
      "c",
      async (_id, op) => {
        calls.push(op);
        return receipt;
      },
      done,
      vi.fn(),
    );
    const upload = session.upload(async () => {
      await bytes.promise;
      return session.mutate({
        type: "card.update",
        id: "c",
        patch: { description: "Uploaded" },
      });
    });
    session.close();
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toEqual(["begin"]);
    bytes.resolve();
    await upload;
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toEqual(["begin", "mutate", "close"]);
    expect(done).toHaveBeenCalledOnce();
  });
  it("does not offer undo for a card that was only opened", async () => {
    vi.useFakeTimers();
    const done = vi.fn();
    const session = new CardEditSession(
      "c",
      async () => ({ ...receipt, events: [] }),
      done,
      vi.fn(),
    );
    session.close();
    await vi.advanceTimersByTimeAsync(0);
    expect(done).not.toHaveBeenCalled();
  });
  it("reports failed saves, drains the queue, and never reports false success", async () => {
    vi.useFakeTimers();
    const report = vi.fn();
    const session = new CardEditSession(
      "c",
      async (_id, op) => {
        if (op === "mutate") throw new Error("Offline");
        return { ...receipt, events: [] };
      },
      vi.fn(),
      report,
    );
    expect(
      await session.mutate({
        type: "card.update",
        id: "c",
        patch: { title: "B" },
      }),
    ).toBe(false);
    session.close();
    await vi.advanceTimersByTimeAsync(0);
    expect(report).toHaveBeenCalledWith("Offline");
  });
});

describe("demo edit-session parity", () => {
  function fixture() {
    const store = new DemoCardSessions();
    let state = createSeed();
    const actor = state.profiles.find((p) => p.role === "admin")!;
    const card = state.cards[0];
    const operate = (
      op: Parameters<DemoCardSessions["operate"]>[3],
      action?: Parameters<DemoCardSessions["operate"]>[5],
    ) => {
      const result = store.operate(
        state,
        actor,
        "session",
        op,
        card.id,
        action,
      );
      state = result.state;
      return result;
    };
    operate("begin");
    return {
      store,
      actor,
      card,
      operate,
      get state() {
        return state;
      },
    };
  }
  it("restores saved text, labels, status and comments, leaving other cards untouched", () => {
    const f = fixture();
    const original = structuredClone(f.state);
    f.operate("mutate", {
      type: "card.update",
      id: f.card.id,
      patch: {
        title: "Saved",
        description: "Saved description",
        label_ids: [],
      },
    });
    f.operate("mutate", {
      type: "card.complete",
      id: f.card.id,
      completed: true,
    });
    f.operate("mutate", {
      type: "comment.create",
      card_id: f.card.id,
      body: "Session comment",
    });
    expect(f.operate("close").receipt.events.length).toBeGreaterThan(3);
    f.operate("undo");
    expect(f.state.cards.find((c) => c.id === f.card.id)).toMatchObject({
      ...f.card,
      updated_at: expect.any(String),
    });
    expect(f.state.cards.filter((c) => c.id !== f.card.id)).toEqual(
      original.cards.filter((c) => c.id !== f.card.id),
    );
    expect(
      [...f.state.comments].sort((a, b) => a.id.localeCompare(b.id)),
    ).toEqual([...original.comments].sort((a, b) => a.id.localeCompare(b.id)));
    expect(f.store.sessions.size).toBe(0);
  });
  it("retains committed edits when the undo offer is discarded", () => {
    const f = fixture();
    f.operate("mutate", {
      type: "card.update",
      id: f.card.id,
      patch: { title: "Keep me" },
    });
    f.operate("close");
    f.operate("discard");
    expect(f.state.cards.find((c) => c.id === f.card.id)?.title).toBe(
      "Keep me",
    );
    expect(f.store.sessions.size).toBe(0);
  });
  it("restores a deleted card and its original comments", () => {
    const f = fixture();
    const comments = f.state.comments.filter((c) => c.card_id === f.card.id);
    f.operate("mutate", { type: "card.delete", id: f.card.id });
    expect(f.state.cards.some((c) => c.id === f.card.id)).toBe(false);
    f.operate("close");
    f.operate("undo");
    expect(f.state.cards.some((c) => c.id === f.card.id)).toBe(true);
    expect(f.state.comments.filter((c) => c.card_id === f.card.id)).toEqual(
      comments,
    );
  });
  it("restores an archived card and retracts its activity on undo", () => {
    const f = fixture();
    const original = structuredClone(f.card);
    const baselineNotificationIds = new Set(
      f.state.notifications.map((item) => item.id),
    );
    const archived = f.operate("mutate", {
      type: "card.archive",
      id: f.card.id,
    });
    expect(
      archived.state.cards.find((card) => card.id === f.card.id)?.archived_at,
    ).toBeTruthy();
    expect(
      archived.receipt.events.some((event) => event.field === "archived_at"),
    ).toBe(true);
    expect(
      archived.state.notifications.some(
        (item) =>
          !baselineNotificationIds.has(item.id) &&
          item.event_type === "card.archived",
      ),
    ).toBe(true);

    f.operate("close");
    f.operate("undo");
    expect(f.state.cards.find((card) => card.id === f.card.id)).toMatchObject({
      ...original,
      updated_at: expect.any(String),
    });
    expect(
      f.state.notifications.filter((item) => !baselineNotificationIds.has(item.id)),
    ).toEqual([]);
  });
  it("refuses undo when another editor changed the card", () => {
    const f = fixture();
    f.operate("mutate", {
      type: "card.update",
      id: f.card.id,
      patch: { title: "Mine" },
    });
    f.operate("close");
    f.state.cards.find((c) => c.id === f.card.id)!.title =
      "Another person's edit";
    expect(() => f.operate("undo")).toThrow("anderweitig");
    expect(f.state.cards.find((c) => c.id === f.card.id)!.title).toBe(
      "Another person's edit",
    );
  });
});
