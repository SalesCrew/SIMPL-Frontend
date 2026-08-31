import { describe, expect, it } from "vitest";
import { createSeed } from "./seed";
import {
  applyDemoAction,
  movePosition,
  orderedCards,
  orderedColumns,
  restoreFixedBuckets,
} from "./domain";
describe("Shared board behavior", () => {
  it.each(["spark", "rover", "obi", "nespresso", "work"])(
    "the green check always sends a card from %s to Fertig",
    (origin) => {
      const s = createSeed();
      const moved = applyDemoAction(s, s.profiles[2], {
        type: "card.move",
        id: "c1",
        column_id: origin,
      });
      const done = applyDemoAction(moved, s.profiles[2], {
        type: "card.complete",
        id: "c1",
        completed: true,
      });
      expect(done.cards[0]).toMatchObject({
        column_id: "done",
        project_id: "spark",
        reviewed_at: s.cards[0].reviewed_at,
      });
      expect(done.cards[0].completed_at).toBeTruthy();
      const repeated = applyDemoAction(done, s.profiles[2], {
        type: "card.complete",
        id: "c1",
        completed: true,
      });
      expect(repeated).toEqual(done);
      const reopened = applyDemoAction(done, s.profiles[2], {
        type: "card.complete",
        id: "c1",
        completed: false,
      });
      expect(reopened.cards[0]).toMatchObject({
        column_id: origin === "work" ? "spark" : origin,
        project_id: "spark",
        completed_at: null,
      });
    },
  );
  it("In Arbeit is manual and does not mark cards completed", () => {
    const s = createSeed();
    const work = applyDemoAction(s, s.profiles[0], {
      type: "card.move",
      id: "c1",
      column_id: "work",
    });
    expect(work.cards[0]).toMatchObject({
      column_id: "work",
      completed_at: null,
    });
    expect(
      applyDemoAction(work, s.profiles[0], {
        type: "card.complete",
        id: "c1",
        completed: false,
      }),
    ).toEqual(work);
  });
  it.each(["work", "done"])(
    "locks the %s bucket, even when empty, without locking its tasks",
    (id) => {
      const s = createSeed();
      const fixed = s.columns.find((c) => c.id === id)!;
      for (const patch of [
        { name: "Anders" },
        { color: "mint" as const },
        { position: 0 },
        { kind: "project" as const },
      ]) {
        expect(() =>
          applyDemoAction(s, s.profiles[0], {
            type: "column.save",
            column: { ...fixed, ...patch },
          }),
        ).toThrow("feste Spalten");
      }
      const empty = { ...s, cards: [] };
      expect(() =>
        applyDemoAction(empty, s.profiles[0], { type: "column.delete", id }),
      ).toThrow("feste Spalten");
      expect(() =>
        applyDemoAction(s, s.profiles[0], {
          type: "column.save",
          column: { ...fixed, id: "duplicate" },
        }),
      ).toThrow("feste Spalten");
      const moved = applyDemoAction(s, s.profiles[0], {
        type: "card.move",
        id: "c1",
        column_id: id,
      });
      const edited = applyDemoAction(moved, s.profiles[0], {
        type: "card.update",
        id: "c1",
        patch: { title: "Weiter bearbeitbar" },
      });
      expect(edited.cards[0].title).toBe("Weiter bearbeitbar");
      expect(() =>
        applyDemoAction(s, s.profiles[0], {
          type: "card.create",
          title: "Direkt",
          column_id: id,
          project_id: "spark",
        }),
      ).toThrow("gültiges Projekt");
    },
  );
  it("keeps normal projects editable but reserves status names and types", () => {
    const s = createSeed();
    const project = s.columns[0];
    for (const name of ["Fertig", " in ARBEIT "]) {
      expect(() =>
        applyDemoAction(s, s.profiles[0], {
          type: "column.save",
          column: { ...project, name },
        }),
      ).toThrow("reserviert");
    }
    expect(() =>
      applyDemoAction(s, s.profiles[0], {
        type: "column.save",
        column: { ...project, kind: "work" },
      }),
    ).toThrow("feste Spalten");
    const next = applyDemoAction(s, s.profiles[0], {
      type: "column.save",
      column: { ...project, name: "Neues Projekt", color: "mint" },
    });
    expect(next.columns.find((c) => c.id === project.id)).toMatchObject({
      name: "Neues Projekt",
      color: "mint",
    });
  });
  it("keeps status buckets after every project, regardless of project position", () => {
    const s = createSeed();
    s.columns[0].position = 999;
    expect(
      orderedColumns(s.columns)
        .slice(-2)
        .map((c) => c.kind),
    ).toEqual(["work", "done"]);
  });
  it("repairs missing or renamed fixed demo buckets without resetting user data", () => {
    const s = createSeed();
    s.columns = s.columns.filter((c) => c.kind !== "work");
    s.columns.find((c) => c.kind === "done")!.name = "Alter Name";
    const repaired = restoreFixedBuckets(s);
    expect(repaired.columns.find((c) => c.kind === "work")?.name).toBe(
      "In Arbeit",
    );
    expect(repaired.columns.find((c) => c.kind === "done")).toMatchObject({
      id: "done",
      name: "Fertig",
    });
    expect(repaired.cards).toEqual(s.cards);
    expect(repaired.comments).toEqual(s.comments);
    expect(repaired.profiles).toEqual(s.profiles);
    expect(s.columns.find((c) => c.kind === "done")!.name).toBe("Alter Name");
  });
  it("creates a task in its chosen/default project without mutating previous state", () => {
    const s = createSeed();
    const user = s.profiles[2];
    const next = applyDemoAction(s, user, {
      type: "card.create",
      title: "  Neue Idee  ",
      column_id: user.default_column_id!,
      project_id: user.default_column_id!,
    });
    expect(next.cards.at(-1)).toMatchObject({
      title: "Neue Idee",
      column_id: "spark",
      project_id: "spark",
      created_by: user.id,
      assignee_id: user.id,
    });
    expect(s.cards).toHaveLength(13);
  });
  it("retains original project when moved and synchronizes completion with the done column", () => {
    const s = createSeed();
    const done = applyDemoAction(s, s.profiles[2], {
      type: "card.move",
      id: "c1",
      column_id: "done",
    });
    expect(done.cards[0].completed_at).toBeTruthy();
    expect(done.cards[0].project_id).toBe("spark");
    const reopened = applyDemoAction(done, s.profiles[2], {
      type: "card.move",
      id: "c1",
      column_id: "spark",
    });
    expect(reopened.cards[0].completed_at).toBeNull();
  });
  it("orders cards before the selected target and at the end of empty columns", () => {
    const s = createSeed();
    const moved = applyDemoAction(s, s.profiles[0], {
      type: "card.move",
      id: "c1",
      column_id: "rover",
      before_id: "c6",
    });
    expect(orderedCards(moved, "rover").map((c) => c.id)).toEqual([
      "c5",
      "c1",
      "c6",
      "c7",
    ]);
    expect(movePosition(s, "c1", "obi")).toBe(1024);
  });
  it("only permits admins to change read receipts", () => {
    const s = createSeed();
    expect(() =>
      applyDemoAction(s, s.profiles[2], {
        type: "card.review",
        id: "c1",
        reviewed: false,
      }),
    ).toThrow("Administrator");
    const next = applyDemoAction(s, s.profiles[0], {
      type: "card.review",
      id: "c2",
      reviewed: true,
    });
    expect(next.cards[1].reviewed_by).toBe("kilian");
    expect(next.cards[1].completed_at).toBeNull();
  });
  it("notifies creators, assignees and previous commenters once, excluding the actor", () => {
    const s = createSeed();
    const next = applyDemoAction(s, s.profiles[0], {
      type: "comment.create",
      card_id: "c1",
      body: "Ein Update",
    });
    const added = next.notifications.filter((n) => n.body === "Ein Update");
    expect(added.map((n) => n.recipient_id).sort()).toEqual(["anna", "philip"]);
  });
  it("marks only the current recipient’s news as seen", () => {
    const s = createSeed();
    s.notifications.push({
      ...s.notifications[0],
      id: "private-news",
      recipient_id: "anna",
    });
    const next = applyDemoAction(s, s.profiles[0], {
      type: "notifications.seen",
    });
    expect(
      next.notifications
        .filter((n) => n.recipient_id === "kilian")
        .every((n) => n.seen_at),
    ).toBe(true);
    expect(
      next.notifications.find((n) => n.id === "private-news")!.seen_at,
    ).toBeNull();
  });
  it("rejects deleting referenced projects and employee administration", () => {
    const s = createSeed();
    expect(() =>
      applyDemoAction(s, s.profiles[0], { type: "column.delete", id: "spark" }),
    ).toThrow("verwendet");
    expect(() =>
      applyDemoAction(s, s.profiles[2], { type: "column.delete", id: "obi" }),
    ).toThrow("Administrator");
  });
  it("prevents self-demotion and duplicate email accounts", () => {
    const s = createSeed();
    expect(() =>
      applyDemoAction(s, s.profiles[0], {
        type: "profile.save",
        profile: { ...s.profiles[0], active: false },
        isNew: false,
      }),
    ).toThrow("eigenen");
    expect(() =>
      applyDemoAction(s, s.profiles[0], {
        type: "profile.save",
        profile: { ...s.profiles[2], email: s.profiles[1].email },
        isNew: false,
      }),
    ).toThrow("E-Mail");
  });
  it("rejects inactive members and invalid target projects", () => {
    const s = createSeed();
    expect(() =>
      applyDemoAction(
        s,
        { ...s.profiles[0], active: false },
        { type: "card.delete", id: "c1" },
      ),
    ).toThrow("deaktiviert");
    expect(() =>
      applyDemoAction(s, s.profiles[0], {
        type: "card.create",
        title: "Test",
        column_id: "done",
        project_id: "done",
      }),
    ).toThrow("gültiges Projekt");
  });
});
