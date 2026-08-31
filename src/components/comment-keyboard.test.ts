import type { KeyboardEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { handleCommentKeyDown } from "./comment-keyboard";

function keyEvent(
  overrides: Partial<KeyboardEvent<HTMLTextAreaElement>> = {},
  nativeOverrides: Partial<globalThis.KeyboardEvent> = {},
) {
  const requestSubmit = vi.fn();
  const preventDefault = vi.fn();
  const event = {
    key: "Enter",
    shiftKey: false,
    repeat: false,
    nativeEvent: { isComposing: false, keyCode: 13, ...nativeOverrides },
    currentTarget: { form: { requestSubmit } },
    preventDefault,
    ...overrides,
  } as unknown as KeyboardEvent<HTMLTextAreaElement>;
  return { event, requestSubmit, preventDefault };
}

describe("comment keyboard shortcuts", () => {
  it("sends through the form on Enter without inserting a newline", () => {
    const key = keyEvent();
    handleCommentKeyDown(key.event);
    expect(key.preventDefault).toHaveBeenCalledOnce();
    expect(key.requestSubmit).toHaveBeenCalledOnce();
  });

  it("leaves Shift+Enter to the textarea for a normal line break", () => {
    const key = keyEvent({ shiftKey: true });
    handleCommentKeyDown(key.event);
    expect(key.preventDefault).not.toHaveBeenCalled();
    expect(key.requestSubmit).not.toHaveBeenCalled();
  });

  it.each([{ isComposing: true }, { keyCode: 229 }])(
    "does not send while confirming composed text (%j)",
    (native) => {
      const key = keyEvent({}, native);
      handleCommentKeyDown(key.event);
      expect(key.preventDefault).not.toHaveBeenCalled();
      expect(key.requestSubmit).not.toHaveBeenCalled();
    },
  );

  it("ignores repeated Enter presses while the key is held down", () => {
    const key = keyEvent({ repeat: true });
    handleCommentKeyDown(key.event);
    expect(key.preventDefault).toHaveBeenCalledOnce();
    expect(key.requestSubmit).not.toHaveBeenCalled();
  });

  it("does not interfere with normal typing", () => {
    const key = keyEvent({ key: "a" });
    handleCommentKeyDown(key.event);
    expect(key.preventDefault).not.toHaveBeenCalled();
    expect(key.requestSubmit).not.toHaveBeenCalled();
  });
});
