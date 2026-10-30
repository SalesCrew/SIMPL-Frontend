import { beforeAll, expect, it, vi } from "vitest";
const rpc = vi.hoisted(() => vi.fn(async () => ({ data: { id: "project", archived_at: "2026-10-30T12:00:00Z" }, error: null })));
const from = vi.hoisted(() => vi.fn());
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ rpc, from }) }));
let runRemote: typeof import("./data").runRemote;
beforeAll(async () => {
  vi.stubEnv("VITE_SUPABASE_URL", "https://example.invalid");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "test-key");
  runRemote = (await import("./data")).runRemote;
});
it("removes projects through the authenticated retention RPC without issuing a row delete", async () => {
  await runRemote({ type: "column.delete", id: "project" });
  expect(rpc).toHaveBeenCalledWith("archive_project", { p_project: "project" });
  expect(from).not.toHaveBeenCalled();
});
