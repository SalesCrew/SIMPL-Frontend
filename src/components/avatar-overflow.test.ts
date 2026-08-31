import { afterEach, describe, expect, it, vi } from "vitest";
import { avatarOverflow, avatarStackWidth, delayedAvatarClose } from "./avatar-overflow";
import { createSeed } from "../seed";

const profiles = (count: number) => Array.from({ length: count }, (_, i) => ({
  ...createSeed().profiles[0], id: `person-${i}`, name: `Person ${i}`, active: true,
}));

describe("Avatar overflow count", () => {
  it.each([[0, 0], [1, 33], [5, 133], [6, 158], [17, 433]])("keeps %s circle slots right-anchored at %s pixels", (slots, width) => {
    expect(avatarStackWidth(slots)).toBe(width);
  });
  it.each([0, 1, 5, 6])("shows all %s people without an unnecessary count circle", (count) => {
    const result = avatarOverflow(profiles(count));
    expect(result.visible).toHaveLength(count);
    expect(result.hidden).toEqual([]);
  });
  it.each([[7, 2], [9, 4], [16, 11], [105, 100]])("reserves one of six slots for %s people", (count, hidden) => {
    const input = profiles(count);
    const snapshot = structuredClone(input);
    const result = avatarOverflow(input);
    expect(result.visible).toEqual(input.slice(0, 5));
    expect(result.hidden).toEqual(input.slice(5));
    expect(result.hidden).toHaveLength(hidden);
    expect(input).toEqual(snapshot);
  });
  it("excludes inactive people before calculating the visible slots and count", () => {
    const input = profiles(7);
    input[2].active = false;
    const result = avatarOverflow(input);
    expect(result.visible).toHaveLength(6);
    expect(result.hidden).toEqual([]);
    expect(result.visible.map((person) => person.id)).not.toContain("person-2");
  });
});

describe("Avatar hover intent", () => {
  afterEach(() => vi.useRealTimers());

  it("stays open while hovering either a circle or its name tooltip, then closes outside the whole range", () => {
    vi.useFakeTimers();
    const close = vi.fn();
    let row = true, tooltip = false;
    const intent = delayedAvatarClose(close, () => row || tooltip);
    intent.schedule();
    vi.advanceTimersByTime(180);
    expect(close).not.toHaveBeenCalled();
    row = false;
    intent.schedule();
    vi.advanceTimersByTime(80);
    tooltip = true;
    intent.cancel();
    vi.advanceTimersByTime(400);
    expect(close).not.toHaveBeenCalled();
    tooltip = false;
    intent.schedule();
    vi.advanceTimersByTime(180);
    expect(close).toHaveBeenCalledOnce();
  });

  it("waits for the pointer to cross into the expanded circles instead of closing immediately", () => {
    vi.useFakeTimers();
    const close = vi.fn();
    const intent = delayedAvatarClose(close, () => false);
    intent.schedule();
    vi.advanceTimersByTime(179);
    expect(close).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(close).toHaveBeenCalledOnce();
  });
  it("cancels the close when re-entering either side of the group", () => {
    vi.useFakeTimers();
    const close = vi.fn();
    const intent = delayedAvatarClose(close, () => false);
    intent.schedule();
    vi.advanceTimersByTime(80);
    intent.cancel();
    vi.advanceTimersByTime(500);
    expect(close).not.toHaveBeenCalled();
  });
  it("does not dismiss while someone is using the keyboard inside the group", () => {
    vi.useFakeTimers();
    const close = vi.fn();
    let focused = false;
    const intent = delayedAvatarClose(close, () => focused);
    intent.schedule();
    focused = true;
    vi.advanceTimersByTime(180);
    expect(close).not.toHaveBeenCalled();
  });
  it("restarts one timer on rapid pointer movements and cleans up on unmount", () => {
    vi.useFakeTimers();
    const close = vi.fn();
    const intent = delayedAvatarClose(close, () => false);
    intent.schedule();
    vi.advanceTimersByTime(100);
    intent.schedule();
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(100);
    expect(close).not.toHaveBeenCalled();
    intent.cancel();
    expect(vi.getTimerCount()).toBe(0);
  });
});
