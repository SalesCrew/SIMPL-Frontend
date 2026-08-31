import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => mock }));
let loadBoard: typeof import("./data").loadBoard;
beforeAll(async () => {
  vi.stubEnv("VITE_SUPABASE_URL", "https://example.invalid");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "test-key");
  loadBoard = (await import("./data")).loadBoard;
});
const context = (version = 1, role = "mitarbeiter") => ({
  data: {
    profile: { id: "me", role },
    workspaces: [{ id: "home" }],
    revision: { id: "me", authorization_version: version, board_version: 1 },
  },
  error: null,
});
beforeEach(() => {
  mock.rpc.mockReset();
  mock.from.mockReset();
  mock.from.mockImplementation((table: string) => ({
    select: () => ({
      order: () => ({
        range: async () => ({
          data: table === "cards" ? [{ id: "allowed-card" }] : [],
          error: null,
        }),
      }),
    }),
  }));
});
describe("Authorization-first loading", () => {
  it("does not request board data before a successful access context", async () => {
    mock.rpc.mockResolvedValue({ data: null, error: new Error("offline") });
    await expect(loadBoard()).rejects.toThrow("offline");
    expect(mock.from).not.toHaveBeenCalled();
  });
  it("returns no business data for a disabled/unprovisioned account", async () => {
    mock.rpc.mockResolvedValue({
      data: { profile: null, workspaces: [], revision: null },
      error: null,
    });
    expect((await loadBoard()).cards).toEqual([]);
    expect(mock.from).not.toHaveBeenCalled();
  });
  it("revalidates permissions after loading and only admins fetch rule configuration", async () => {
    mock.rpc.mockResolvedValue(context());
    const board = await loadBoard();
    expect(board.cards).toHaveLength(1);
    expect(mock.rpc).toHaveBeenCalledTimes(2);
    expect(mock.rpc.mock.invocationCallOrder[0]).toBeLessThan(
      mock.from.mock.invocationCallOrder[0],
    );
    expect(mock.from).not.toHaveBeenCalledWith("workspace_blocks");
    mock.rpc.mockResolvedValue(context(1, "admin"));
    await loadBoard();
    expect(mock.from).toHaveBeenCalledWith("workspace_blocks");
  });
  it("discards a snapshot taken across a rule change and loads again", async () => {
    mock.rpc
      .mockResolvedValueOnce(context(1))
      .mockResolvedValueOnce(context(2))
      .mockResolvedValue(context(2));
    const changed = vi.fn(),
      board = await loadBoard(changed);
    expect(mock.rpc).toHaveBeenCalledTimes(4);
    expect(board.access_revision?.authorization_version).toBe(2);
    expect(changed).toHaveBeenCalledWith(context(2).data.revision);
  });
  it("fails closed if permissions keep changing or a data request fails", async () => {
    let version = 0;
    mock.rpc.mockImplementation(async () => context(++version));
    await expect(loadBoard()).rejects.toThrow("Zugriffsrechte");
    mock.rpc.mockResolvedValue(context());
    mock.from.mockImplementation(() => ({
      select: () => ({
        order: () => ({
          range: async () => ({ data: null, error: new Error("denied") }),
        }),
      }),
    }));
    await expect(loadBoard()).rejects.toThrow("denied");
  });
});
