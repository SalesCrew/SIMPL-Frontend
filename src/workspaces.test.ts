import { describe, expect, it } from "vitest";
import { createSeed } from "./seed";
import {
  applyDemoAction,
  restoreFixedBuckets,
  startingWorkspaceId,
  workspaceBoard,
} from "./domain";

const marketing = {
  id: "marketing",
  name: "Marketing",
  color: "lavender" as const,
};
function twoWorkspaces() {
  const seed = createSeed();
  return applyDemoAction(seed, seed.profiles[0], {
    type: "workspace.save",
    workspace: marketing,
  });
}
describe("Multiple shared workspaces", () => {
  it("admins create an independent board with its own project and fixed buckets", () => {
    const state = twoWorkspaces();
    const board = workspaceBoard(state, marketing.id);
    expect(state.workspaces).toHaveLength(2);
    expect(board.columns.map((c) => c.kind)).toEqual([
      "project",
      "work",
      "done",
    ]);
    expect(board.cards).toHaveLength(0);
    expect(workspaceBoard(state, "salescrew").cards).toHaveLength(13);
    expect(board.profiles).toHaveLength(5);
  });
  it("employees cannot create or rename a workspace", () => {
    const state = twoWorkspaces();
    expect(() =>
      applyDemoAction(state, state.profiles[2], {
        type: "workspace.save",
        workspace: marketing,
      }),
    ).toThrow("Administrator");
  });
  it("renaming a workspace preserves its columns and rejects duplicate names", () => {
    const state = twoWorkspaces();
    const renamed = applyDemoAction(state, state.profiles[0], {
      type: "workspace.save",
      workspace: { ...marketing, name: "People & Culture" },
    });
    expect(renamed.columns).toEqual(state.columns);
    expect(() =>
      applyDemoAction(state, state.profiles[0], {
        type: "workspace.save",
        workspace: { ...marketing, name: " salesCREW " },
      }),
    ).toThrow("bereits verwendet");
  });
  it("cards inherit their project workspace; completion uses that workspace's Fertig", () => {
    let state = twoWorkspaces();
    const project = state.columns.find(
      (c) => c.workspace_id === marketing.id && c.kind === "project",
    )!;
    state = applyDemoAction(state, state.profiles[2], {
      type: "card.create",
      title: "Kampagne",
      column_id: project.id,
      project_id: project.id,
    });
    const task = state.cards.at(-1)!;
    expect(task.workspace_id).toBe(marketing.id);
    const done = applyDemoAction(state, state.profiles[2], {
      type: "card.complete",
      id: task.id,
      completed: true,
    });
    expect(done.cards.at(-1)!.column_id).toBe(
      state.columns.find(
        (c) => c.workspace_id === marketing.id && c.kind === "done",
      )!.id,
    );
    expect(workspaceBoard(done, "salescrew").cards).toHaveLength(13);
    expect(workspaceBoard(done, marketing.id).cards).toHaveLength(1);
    expect(
      applyDemoAction(done, state.profiles[2], {
        type: "card.complete",
        id: task.id,
        completed: false,
      }).cards.at(-1)!.column_id,
    ).toBe(project.id);
  });
  it("prevents cross-workspace column moves and mismatched origin projects", () => {
    const state = twoWorkspaces();
    const target = state.columns.find((c) => c.workspace_id === marketing.id)!;
    expect(() =>
      applyDemoAction(state, state.profiles[2], {
        type: "card.move",
        id: "c1",
        column_id: target.id,
      }),
    ).toThrow("Workspace");
    expect(() =>
      applyDemoAction(state, state.profiles[0], {
        type: "column.save",
        column: { ...state.columns[0], workspace_id: marketing.id },
      }),
    ).toThrow("Workspace");
    expect(() =>
      applyDemoAction(state, state.profiles[2], {
        type: "card.create",
        title: "Wrong",
        column_id: target.id,
        project_id: "spark",
      }),
    ).toThrow("Workspace");
  });
  it("a personal start workspace does not restrict visibility of other workspaces", () => {
    const state = twoWorkspaces();
    const member = {
      ...state.profiles[2],
      default_workspace_id: marketing.id,
      default_column_id: null,
    };
    const assigned = applyDemoAction(state, state.profiles[0], {
      type: "profile.save",
      profile: member,
      isNew: false,
    });
    expect(startingWorkspaceId(assigned, member)).toBe(marketing.id);
    expect(workspaceBoard(assigned, "salescrew").cards).toHaveLength(13);
    const done = applyDemoAction(assigned, member, {
      type: "card.complete",
      id: "c1",
      completed: true,
    });
    expect(done.cards[0].column_id).toBe("done");
    expect(() =>
      applyDemoAction(state, state.profiles[0], {
        type: "profile.save",
        profile: { ...member, default_column_id: "spark" },
        isNew: false,
      }),
    ).toThrow("Standardprojekt");
  });
  it("upgrades old demos without losing cards, comments, projects or profile assignments", () => {
    const old = createSeed();
    const legacy = JSON.parse(JSON.stringify(old));
    delete legacy.workspaces;
    legacy.columns.forEach(
      (c: Record<string, unknown>) => delete c.workspace_id,
    );
    legacy.cards.forEach((c: Record<string, unknown>) => delete c.workspace_id);
    legacy.profiles.forEach(
      (p: Record<string, unknown>) => delete p.default_workspace_id,
    );
    expect(restoreFixedBuckets(legacy)).toEqual(old);
  });
});
