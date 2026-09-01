import { describe, expect, it } from "vitest";
import { notificationAction } from "./notification-copy";

describe("workspace activity copy", () => {
  it("describes comments, card actions and files", () => {
    expect(notificationAction("comment.created")).toBe("hat kommentiert");
    expect(notificationAction("card.moved")).toBe("hat eine Karte verschoben");
    expect(notificationAction("attachment.added")).toBe("hat eine Datei angehängt");
  });
});
