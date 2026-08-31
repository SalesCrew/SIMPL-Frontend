import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DetailedError,
  type HttpRequest,
  type HttpResponse,
} from "tus-js-client";
import {
  storageUploadEndpoint,
  uploadResumable,
  UPLOAD_CHUNK_SIZE,
} from "./resumable-upload";
import type { Attachment } from "./types";

const mock = vi.hoisted(() => ({
  instances: [] as {
    options: Record<string, any>;
    start: ReturnType<typeof vi.fn>;
    abort: ReturnType<typeof vi.fn>;
  }[],
}));
vi.mock("tus-js-client", async (original) => ({
  ...(await original<typeof import("tus-js-client")>()),
  Upload: class {
    start = vi.fn();
    abort = vi.fn().mockResolvedValue(undefined);
    constructor(
      _file: File,
      public options: Record<string, any>,
    ) {
      mock.instances.push(this);
    }
  },
}));
function begin(signal = new AbortController().signal) {
  const progress = vi.fn();
  const accessToken = vi.fn().mockResolvedValue("short-lived-token");
  const done = uploadResumable({
    item: {
      object_path: "card/id",
      mime_type: "application/octet-stream",
    } as Attachment,
    file: new File(["test"], "file.xlsx"),
    signal,
    progress,
    accessToken,
    supabaseUrl: "https://example.supabase.co",
    publishableKey: "public-key",
  });
  return { done, progress, accessToken, upload: mock.instances.at(-1)! };
}
const response = (status: number) =>
  ({ getStatus: () => status }) as HttpResponse;
function detailed(status: number) {
  const error = new DetailedError("headers contain a secret");
  error.originalResponse = response(status);
  return error;
}
describe("resumable uploads", () => {
  beforeEach(() => {
    mock.instances.length = 0;
  });
  it("uses direct storage on hosted projects and keeps local endpoints", () => {
    expect(storageUploadEndpoint("https://abc.supabase.co")).toBe(
      "https://abc.storage.supabase.co/storage/v1/upload/resumable",
    );
    expect(storageUploadEndpoint("https://abc.storage.supabase.co")).toBe(
      "https://abc.storage.supabase.co/storage/v1/upload/resumable",
    );
    expect(storageUploadEndpoint("http://127.0.0.1:54321")).toBe(
      "http://127.0.0.1:54321/storage/v1/upload/resumable",
    );
  });
  it("uses 6 MB chunks, immutable uploads, and no persisted fingerprints", async () => {
    const { done, upload, progress, accessToken } = begin();
    expect(upload.start).toHaveBeenCalledOnce();
    expect(upload.options.chunkSize).toBe(UPLOAD_CHUNK_SIZE);
    expect(UPLOAD_CHUNK_SIZE).toBe(6 * 1024 * 1024);
    expect(upload.options.headers["x-upsert"]).toBe("false");
    expect(upload.options.storeFingerprintForResuming).toBe(false);
    expect(upload.options.metadata.contentType).toBe(
      "application/octet-stream",
    );
    const setHeader = vi.fn();
    await upload.options.onBeforeRequest({
      setHeader,
    } as unknown as HttpRequest);
    accessToken.mockResolvedValueOnce("refreshed-token");
    await upload.options.onBeforeRequest({
      setHeader,
    } as unknown as HttpRequest);
    expect(setHeader).toHaveBeenLastCalledWith(
      "Authorization",
      "Bearer refreshed-token",
    );
    upload.options.onProgress(100, 100);
    expect(progress).toHaveBeenLastCalledWith(99);
    upload.options.onSuccess();
    await expect(done).resolves.toBeUndefined();
  });
  it("only retries transient failures, never authorization or size failures", async () => {
    const { done, upload } = begin();
    for (const status of [0, 408, 409, 423, 429, 500, 503])
      expect(upload.options.onShouldRetry(detailed(status))).toBe(true);
    for (const status of [400, 401, 403, 404, 413])
      expect(upload.options.onShouldRetry(detailed(status))).toBe(false);
    upload.options.onSuccess();
    await done;
  });
  it("stops on cancellation and ignores late callbacks", async () => {
    const controller = new AbortController();
    const { done, upload, progress } = begin(controller.signal);
    const check = expect(done).rejects.toMatchObject({ name: "AbortError" });
    controller.abort();
    await check;
    expect(upload.abort).toHaveBeenCalledOnce();
    upload.options.onProgress(1, 2);
    upload.options.onSuccess();
    expect(progress).not.toHaveBeenCalled();
    expect(upload.options.onShouldRetry(detailed(503))).toBe(false);
  });
  it("rejects before upload when already cancelled", () => {
    expect(() => begin(AbortSignal.abort())).toThrow();
    expect(mock.instances).toHaveLength(0);
  });
  it.each([413, 403, 500, null])(
    "sanitizes failure %s without leaking credentials",
    async (status) => {
      const { done, upload } = begin();
      const check = expect(done).rejects.not.toThrow("secret");
      upload.options.onError(
        status === null ? new Error("secret") : detailed(status),
      );
      await check;
    },
  );
  it("does not send another request after the session expires", async () => {
    const { done, upload, accessToken } = begin();
    accessToken.mockRejectedValueOnce(new Error("Session expired"));
    const setHeader = vi.fn();
    await expect(upload.options.onBeforeRequest({ setHeader })).rejects.toThrow(
      "Session expired",
    );
    expect(setHeader).not.toHaveBeenCalled();
    upload.options.onSuccess();
    await done;
  });
});
