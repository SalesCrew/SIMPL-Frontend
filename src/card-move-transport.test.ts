import { beforeAll, afterEach, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ auth }) }));
let moveCardRemote: typeof import("./data").moveCardRemote;
beforeAll(async () => {
  vi.stubEnv("VITE_SUPABASE_URL", "https://example.invalid");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "test-key");
  moveCardRemote = (await import("./data")).moveCardRemote;
});
afterEach(() => vi.unstubAllGlobals());
const action = { type: "card.move" as const, id: "card-id", column_id: "target-id", before_id: "before-id" };
it("sends a small authenticated keepalive request to the backend, not a browser-owned RPC", async () => {
  auth.getSession.mockResolvedValue({ data: { session: { access_token: "test-session" } } });
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ cards: [{ id: action.id }] })));
  vi.stubGlobal("fetch", fetcher);
  expect(await moveCardRemote(action)).toEqual([{ id: action.id }]);
  const [url, options] = fetcher.mock.calls[0];
  expect(url).toContain("/api/cards/card-id/move");
  expect(options).toMatchObject({ method: "POST", keepalive: true, headers: { Authorization: "Bearer test-session" } });
  expect(JSON.parse(options.body)).toEqual({ column_id: "target-id", before_id: "before-id" });
});
it("requires a session and a receipt containing the moved card", async () => {
  auth.getSession.mockResolvedValueOnce({ data: { session: null } });
  await expect(moveCardRemote(action)).rejects.toThrow("anmelden");
  auth.getSession.mockResolvedValue({ data: { session: { access_token: "test-session" } } });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ cards: [] }))));
  await expect(moveCardRemote(action)).rejects.toThrow("bestätigt");
});
it("surfaces denied or failed saves instead of claiming success", async () => {
  auth.getSession.mockResolvedValue({ data: { session: { access_token: "test-session" } } });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "No access" }), { status: 403 })));
  await expect(moveCardRemote(action)).rejects.toThrow("No access");
});
