import { describe, expect, it } from "vitest";
import { applyDemoAction } from "./domain";
import { createSeed } from "./seed";
import { DemoCardSessions } from "./demo-card-sessions";
import { isPreviewImage, validateFile } from "./attachment-files";
import type { Attachment } from "./types";

const original = createSeed();
const actor = original.profiles[0];
const card = original.cards[0];
const file: Attachment = {
  id: "message-file",
  card_id: card.id,
  uploaded_by: actor.id,
  filename: "Forecast.xlsx",
  mime_type: validateFile("Forecast.xlsx", 200),
  size_bytes: 200,
  object_path: "fixture/file",
  status: "ready",
  comment_draft_id: "draft",
  created_at: "",
  expires_at: "",
};
const action = {
  type: "comment.create" as const,
  card_id: card.id,
  body: "Hier die Übersicht",
  attachments: [file],
};
describe("message attachments", () => {
  it("publishes text and owned files together, attached to the exact message", () => {
    const next = applyDemoAction(original, actor, action);
    const comment = next.comments.at(-1)!;
    expect(comment.body).toBe(action.body);
    expect(comment.attachment_ids).toEqual([file.id]);
    expect(next.attachments[0]).toMatchObject({
      comment_id: comment.id,
      comment_draft_id: null,
    });
    expect(original.attachments).toHaveLength(0);
  });
  it("supports attachment-only messages and a useful notification", () => {
    const next = applyDemoAction(original, actor, { ...action, body: " " });
    expect(next.comments.at(-1)?.body).toBe("");
    expect(next.attachments).toHaveLength(1);
    next.notifications
      .filter((n) => n.comment_id === next.comments.at(-1)?.id)
      .forEach((n) => expect(n.body).toBe("1 Datei angehängt"));
  });
  it.each([
    { uploaded_by: "someone-else" },
    { card_id: "other-card" },
    { comment_id: "already-published" },
    { comment_draft_id: null },
    { status: "pending" as const },
  ])("rejects unavailable or forged file links %j", (patch) => {
    expect(() =>
      applyDemoAction(original, actor, {
        ...action,
        attachments: [{ ...file, ...patch }],
      }),
    ).toThrow();
  });
  it("rejects empty messages, duplicate links and batches above ten", () => {
    expect(() =>
      applyDemoAction(original, actor, {
        ...action,
        body: "",
        attachments: [],
      }),
    ).toThrow();
    expect(() =>
      applyDemoAction(original, actor, {
        ...action,
        attachments: [file, file],
      }),
    ).toThrow();
    expect(() =>
      applyDemoAction(original, actor, {
        ...action,
        attachments: Array.from({ length: 11 }, (_, i) => ({
          ...file,
          id: String(i),
        })),
      }),
    ).toThrow();
  });
  it("undo removes the message and tracks its blobs for cleanup", () => {
    const sessions = new DemoCardSessions();
    sessions.operate(original, actor, "session", "begin", card.id);
    const saved = sessions.operate(
      original,
      actor,
      "session",
      "mutate",
      card.id,
      action,
    );
    sessions.operate(saved.state, actor, "session", "close", card.id);
    const undone = sessions.operate(
      saved.state,
      actor,
      "session",
      "undo",
      card.id,
    );
    expect(undone.state.attachments).toEqual(original.attachments);
    expect(undone.state.comments).toHaveLength(original.comments.length);
    expect(undone.garbage).toContain(file.id);
  });
  it("previews only known raster images, never arbitrary active content", () => {
    expect(isPreviewImage("image/png")).toBe(true);
    for (const name of [
      "vector.svg",
      "page.html",
      "script.js",
      "old.xls",
      "unknown.bin",
    ])
      expect(isPreviewImage(validateFile(name, 10))).toBe(false);
  });
});
