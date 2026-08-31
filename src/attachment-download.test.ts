import { afterEach, describe, expect, it, vi } from "vitest";
import type { Attachment } from "./types";
const session = vi.hoisted(() => vi.fn());
vi.mock("./data", () => ({
  demoMode: false,
  apiRequest: vi.fn(),
  supabase: { auth: { getSession: session } },
}));
import { attachmentBlob } from "./attachments";
const item = {
  id: "file-id",
  object_path: "never-use-direct-storage",
} as Attachment;
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("file download authorization", () => {
  it("uses the live-authorized API and disables caching", async () => {
    session.mockResolvedValue({
      data: { session: { access_token: "user-token" } },
    });
    vi.stubEnv("VITE_API_URL", "https://api.example.test");
    const fetcher = vi.fn(async () => new Response("file bytes"));
    vi.stubGlobal("fetch", fetcher);
    expect(await (await attachmentBlob(item)).text()).toBe("file bytes");
    expect(fetcher).toHaveBeenCalledWith(
      "https://api.example.test/api/attachments/file-id/download",
      expect.objectContaining({
        cache: "no-store",
        headers: { Authorization: "Bearer user-token" },
      }),
    );
  });
  it("does not fall back to Storage when access is revoked", async () => {
    session.mockResolvedValue({
      data: { session: { access_token: "user-token" } },
    });
    const fetcher = vi.fn(async () => new Response("", { status: 403 }));
    vi.stubGlobal("fetch", fetcher);
    await expect(attachmentBlob(item)).rejects.toThrow("Datei nicht verfügbar");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("requires a login before requesting bytes", async () => {
    session.mockResolvedValue({ data: { session: null } });
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(attachmentBlob(item)).rejects.toThrow("Bitte erneut anmelden");
    expect(fetcher).not.toHaveBeenCalled();
  });
});
