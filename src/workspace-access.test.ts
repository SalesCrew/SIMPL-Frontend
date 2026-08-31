import { describe, it, expect } from "vitest";
import { createSeed } from "./seed";
import {
  applyDemoAction,
  canAccessWorkspace,
  visibleBoardForActor,
  workspaceBoard,
  restoreFixedBuckets,
} from "./domain";

function setup() {
  let state = createSeed();
  for (const id of ["b", "c", "shared"])
    state = applyDemoAction(state, state.profiles[0], {
      type: "workspace.save",
      workspace: { id, name: id, color: "sage" },
    });
  state.profiles[3].default_workspace_id = "b";
  state.profiles[3].default_column_id = null;
  state.profiles[4].default_workspace_id = "c";
  state.profiles[4].default_column_id = null;
  state = applyDemoAction(state, state.profiles[0], {
    type: "workspace.save",
    workspace: state.workspaces.find((w) => w.id === "salescrew")!,
    blocked_ids: ["b"],
  });
  state = applyDemoAction(state, state.profiles[0], {
    type: "workspace.save",
    workspace: {
      ...state.workspaces.find((w) => w.id === "c")!,
      isolated: true,
    },
  });
  return state;
}
describe("Workspace confidentiality", () => {
  it("blocks selected pairs both ways, without allowing a shared-board bridge", () => {
    const s = setup(),
      a = s.profiles[2],
      b = s.profiles[3];
    expect(canAccessWorkspace(s, a, "b")).toBe(false);
    expect(canAccessWorkspace(s, b, "salescrew")).toBe(false);
    expect(canAccessWorkspace(s, a, "shared")).toBe(true);
    expect(
      workspaceBoard(visibleBoardForActor(s, a), "shared").workspaces.map(
        (w) => w.id,
      ),
    ).not.toContain("b");
    expect(a.default_workspace_id).toBe("salescrew");
  });
  it("fully isolates in both directions but never restricts admins", () => {
    const s = setup();
    expect(
      visibleBoardForActor(s, s.profiles[4]).workspaces.map((w) => w.id),
    ).toEqual(["c"]);
    expect(canAccessWorkspace(s, s.profiles[2], "c")).toBe(false);
    expect(visibleBoardForActor(s, s.profiles[0]).workspaces).toHaveLength(4);
  });
  it("hides profiles, comments, notifications, labels and attachments with cards", () => {
    const s = setup(),
      b = s.profiles[3];
    s.attachments.push({
      id: "secret-file",
      card_id: s.cards[0].id,
      uploaded_by: s.profiles[2].id,
      filename: "nda.txt",
      mime_type: "text/plain",
      size_bytes: 1,
      object_path: "private",
      status: "ready",
      created_at: new Date().toISOString(),
      expires_at: new Date().toISOString(),
    });
    const visible = visibleBoardForActor(s, b);
    expect(visible.cards).toEqual([]);
    expect(visible.comments).toEqual([]);
    expect(visible.notifications).toEqual([]);
    expect(visible.attachments).toEqual([]);
    expect(visible.labels.some((l) => l.workspace_id === "salescrew")).toBe(
      false,
    );
    expect(visible.profiles.some((p) => p.id === s.profiles[2].id)).toBe(false);
    expect(visible.workspace_blocks).toEqual([]);
  });
  it("prevents hidden card mutations and employee rule editing in the local preview", () => {
    const s = setup(),
      b = s.profiles[3];
    for (const type of ["card.delete", "card.complete"] as const)
      expect(() =>
        applyDemoAction(s, b, { type, id: s.cards[0].id, completed: true }),
      ).toThrow();
    expect(() =>
      applyDemoAction(s, b, {
        type: "card.review",
        id: s.cards[0].id,
        reviewed: true,
      }),
    ).toThrow("Kein Zugriff");
    expect(() =>
      applyDemoAction(s, { ...s.profiles[2], active: false }, {
        type: "card.review",
        id: s.cards[0].id,
        reviewed: true,
      }),
    ).toThrow("deaktiviert");
    expect(() =>
      applyDemoAction(s, b, {
        type: "workspace.save",
        workspace: s.workspaces[0],
      }),
    ).toThrow();
    expect(() =>
      applyDemoAction(s, b, {
        type: "label.save",
        label: {
          id: "new",
          name: "forged",
          color: "green",
          workspace_id: "salescrew",
        },
      }),
    ).toThrow();
  });
  it("opening either endpoint removes a symmetric pair", () => {
    let s = setup();
    s = applyDemoAction(s, s.profiles[0], {
      type: "workspace.save",
      workspace: s.workspaces.find((w) => w.id === "b")!,
      blocked_ids: [],
    });
    expect(canAccessWorkspace(s, s.profiles[2], "b")).toBe(true);
    expect(canAccessWorkspace(s, s.profiles[3], "salescrew")).toBe(true);
  });
  it("home reassignment immediately changes visibility and inactive users have no boards", () => {
    const s = setup(),
      person = { ...s.profiles[2], default_workspace_id: "c" };
    expect(visibleBoardForActor(s, person).workspaces.map((w) => w.id)).toEqual(
      ["c"],
    );
    expect(
      visibleBoardForActor(s, { ...person, active: false }).workspaces,
    ).toEqual([]);
  });
  it("upgrades shared legacy labels without losing card associations or copying unused secrets", () => {
    const s = setup(),
      card = structuredClone(s.cards[0]);
    card.id = "legacy-b";
    card.workspace_id = "b";
    s.cards.push(card);
    s.labels.forEach((l) => {
      if (l.workspace_id === "salescrew") delete l.workspace_id;
    });
    const restored = restoreFixedBuckets(s),
      moved = restored.cards.find((c) => c.id === card.id)!;
    expect(
      moved.label_ids.every(
        (id) => restored.labels.find((l) => l.id === id)?.workspace_id === "b",
      ),
    ).toBe(true);
    expect(restored.cards[0].label_ids).toEqual(s.cards[0].label_ids);
    expect(restoreFixedBuckets(restored)).toEqual(restored);
  });
});
