import { describe, expect, it } from "vitest";
import { createSeed } from "./seed";
import { applyDemoAction, restoreFixedBuckets, workspaceBoard } from "./domain";
import {
  fileSize,
  validateFile,
  MAX_FILE_SIZE,
  MAX_PREVIEW_SIZE,
} from "./attachment-files";
import type { Attachment } from "./types";
describe("card attachments", () => {
  const original = createSeed();
  const actor = original.profiles[0];
  const item: Attachment = {
    id: "test-file",
    card_id: original.cards[0].id,
    uploaded_by: actor.id,
    filename: "Screenshot.png",
    mime_type: "image/png",
    size_bytes: 1024,
    object_path: "demo/file",
    status: "ready",
    created_at: "",
    expires_at: "",
  };
  it("adds, scopes and removes attachment metadata without losing cards", () => {
    const next = applyDemoAction(original, actor, {
      type: "attachment.add",
      attachment: item,
    });
    expect(next.attachments).toHaveLength(1);
    expect(original.attachments).toHaveLength(0);
    expect(workspaceBoard(next, "missing").attachments).toHaveLength(0);
    expect(
      applyDemoAction(next, actor, { type: "attachment.delete", id: item.id })
        .attachments,
    ).toHaveLength(0);
  });
  it("clears attachments on card deletion", () => {
    const next = applyDemoAction(original, actor, {
      type: "attachment.add",
      attachment: item,
    });
    expect(
      applyDemoAction(next, actor, { type: "card.delete", id: item.card_id })
        .attachments,
    ).toHaveLength(0);
  });
  it("requires active accounts, existing cards and supported files", () => {
    expect(() =>
      applyDemoAction(
        original,
        { ...actor, active: false },
        { type: "attachment.add", attachment: item },
      ),
    ).toThrow();
    expect(() =>
      applyDemoAction(original, actor, {
        type: "attachment.add",
        attachment: { ...item, card_id: "missing" },
      }),
    ).toThrow();
    expect(validateFile("drawing.svg", 100)).toBe("application/octet-stream");
    expect(() => validateFile("image.png", MAX_FILE_SIZE + 1)).toThrow();
  });
  it("accepts exactly 500 MB and keeps large files download-only", () => {
    expect(MAX_FILE_SIZE).toBe(500 * 1024 * 1024);
    expect(validateFile("image.png", MAX_PREVIEW_SIZE)).toBe("image/png");
    expect(validateFile("image.png", MAX_PREVIEW_SIZE + 1)).toBe(
      "application/octet-stream",
    );
    expect(validateFile("file.xlsx", MAX_FILE_SIZE)).toBe(
      "application/octet-stream",
    );
  });
  it("enforces 20 files and makes completion idempotent", () => {
    let next = original;
    for (let i = 0; i < 20; i++)
      next = applyDemoAction(next, actor, {
        type: "attachment.add",
        attachment: { ...item, id: String(i) },
      });
    expect(() =>
      applyDemoAction(next, actor, {
        type: "attachment.add",
        attachment: item,
      }),
    ).toThrow();
    expect(
      applyDemoAction(next, actor, {
        type: "attachment.add",
        attachment: { ...item, id: "0" },
      }).attachments,
    ).toHaveLength(20);
  });
  it("upgrades old device caches without losing cards", () => {
    const old = structuredClone(original);
    delete (old as Partial<typeof old>).attachments;
    expect(restoreFixedBuckets(old).attachments).toEqual([]);
    expect(restoreFixedBuckets(old).cards).toEqual(original.cards);
  });
  it("formats file sizes", () => {
    expect(fileSize(1024)).toBe("1 KB");
    expect(fileSize(1048576)).toBe("1 MB");
  });
});
