import { describe, expect, it, vi } from "vitest";
import { appendCardDraftFiles, CardCreationDraft } from "./card-creation-draft";
import type { Attachment } from "./types";
import type { Action } from "./domain";

const action = {
  type: "card.create" as const,
  title: "Anhänge direkt anfügen",
  description: "Kontext",
  column_id: "project",
  project_id: "project",
};
const file = (name = "Screenshot.png") => new File(["original bytes"], name);
function setup() {
  const draft = new CardCreationDraft();
  const files = appendCardDraftFiles([], [file(), file("Angebot.xlsx")]);
  const mutate = vi.fn<(action: Action) => Promise<boolean>>(async () => true);
  const upload = vi.fn(
    async (cardId: string, source: File) =>
      ({
        id: crypto.randomUUID(),
        card_id: cardId,
        filename: source.name,
        status: "ready",
      }) as Attachment,
  );
  const abort = new AbortController();
  const options = {
    mutate,
    upload,
    signal: abort.signal,
    progress: vi.fn(),
    saved: vi.fn(),
  };
  return { draft, files, mutate, upload, abort, options };
}

describe("new-card attachment staging", () => {
  it("keeps original files locally, accepts opaque formats and enforces the existing limits", () => {
    const original = file("design.psd");
    const files = appendCardDraftFiles([], [original]);
    expect(files[0].file).toBe(original);
    expect(
      appendCardDraftFiles(
        files,
        Array.from({ length: 19 }, () => file()),
      ),
    ).toHaveLength(20);
    expect(() =>
      appendCardDraftFiles(
        files,
        Array.from({ length: 20 }, () => file()),
      ),
    ).toThrow("20");
    expect(() =>
      appendCardDraftFiles(files, [new File([], "empty.txt")]),
    ).toThrow("1 Byte");
    expect(() =>
      appendCardDraftFiles(files, [file("unsafe/path.txt")]),
    ).toThrow("Dateinamen");
    expect(files).toHaveLength(1);
  });

  it("does not persist a card or file merely by preparing a draft", () => {
    const { draft, files, mutate, upload } = setup();
    expect(files).toHaveLength(2);
    expect(draft.created).toBe(false);
    expect(mutate).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });

  it("waits for the accepted card before uploading every original file to its ID", async () => {
    const { draft, files, mutate, upload, options } = setup();
    expect(await draft.save(action, files, options)).toBe(true);
    expect(mutate.mock.calls[0]).toEqual([{ ...action, id: draft.id }]);
    expect(upload.mock.invocationCallOrder[0]).toBeGreaterThan(
      mutate.mock.invocationCallOrder[0],
    );
    expect(upload.mock.calls.map(([id, source]) => [id, source])).toEqual(
      files.map(({ file }) => [draft.id, file]),
    );
    expect(draft.saved.size).toBe(2);
    expect(options.saved).toHaveBeenCalledTimes(2);
    expect(mutate).toHaveBeenCalledTimes(3);
  });

  it("does not start uploads if card creation fails and retains the same identity on retry", async () => {
    const { draft, files, mutate, upload, options } = setup();
    mutate.mockResolvedValueOnce(false);
    expect(await draft.save(action, files, options)).toBe(false);
    expect(upload).not.toHaveBeenCalled();
    expect(draft.created).toBe(false);
    expect(await draft.save(action, files, options)).toBe(true);
    expect(mutate.mock.calls[0]).toEqual(mutate.mock.calls[1]);
  });

  it("retries failed uploads without duplicating the card or completed files", async () => {
    const { draft, files, mutate, upload, options } = setup();
    upload
      .mockImplementationOnce(
        async (cardId, source) =>
          ({
            id: "first",
            card_id: cardId,
            filename: source.name,
          }) as Attachment,
      )
      .mockRejectedValueOnce(new Error("Connection interrupted"));
    await expect(draft.save(action, files, options)).rejects.toThrow(
      "Connection interrupted",
    );
    expect(draft.created).toBe(true);
    expect([...draft.saved]).toEqual([files[0].id]);
    expect(await draft.save(action, files, options)).toBe(true);
    expect(upload).toHaveBeenCalledTimes(3);
    expect(
      mutate.mock.calls.filter(([a]) => a.type === "card.create"),
    ).toHaveLength(1);
    expect(draft.saved.size).toBe(2);
  });

  it("reuses a completed upload when the metadata refresh fails", async () => {
    const { draft, files, mutate, upload, options } = setup();
    mutate.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await expect(
      draft.save(action, files.slice(0, 1), options),
    ).rejects.toThrow("bestätigt");
    expect(draft.saved.size).toBe(0);
    expect(draft.hasUpload(files[0].id)).toBe(true);
    expect(await draft.save(action, files.slice(0, 1), options)).toBe(true);
    expect(upload).toHaveBeenCalledOnce();
    expect(mutate.mock.calls[1]).toEqual(mutate.mock.calls[2]);
  });

  it("prevents overlapping submissions and uploading after the dialog unmounts", async () => {
    const { draft, files, mutate, upload, abort, options } = setup();
    let finish!: (ok: boolean) => void;
    mutate.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          finish = resolve;
        }),
    );
    const pending = draft.save(action, files, options);
    expect(await draft.save(action, files, options)).toBe(false);
    abort.abort();
    finish(true);
    await expect(pending).rejects.toThrow();
    expect(mutate).toHaveBeenCalledOnce();
    expect(upload).not.toHaveBeenCalled();
  });

  it("preserves the successful text-only creation flow", async () => {
    const { draft, mutate, upload, options } = setup();
    expect(await draft.save(action, [], options)).toBe(true);
    expect(mutate).toHaveBeenCalledOnce();
    expect(upload).not.toHaveBeenCalled();
  });
});
