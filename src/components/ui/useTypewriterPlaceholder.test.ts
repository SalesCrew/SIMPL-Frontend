import { describe, expect, it } from "vitest";
import {
  advanceTypewriter,
  initialTypewriterState,
  typewriterText,
  type TypewriterState,
} from "./useTypewriterPlaceholder";

const messages = ["Kontext", "- Aufgabe"] as const;

describe("typewriter placeholder", () => {
  it("starts with the complete first tip", () => {
    const state = initialTypewriterState(messages);
    expect(state).toEqual({
      messageIndex: 0,
      visibleLength: 7,
      phase: "holding",
    });
    expect(typewriterText(state, messages)).toBe("Kontext");
  });

  it("deletes the current tip before typing the next one", () => {
    let state = advanceTypewriter(initialTypewriterState(messages), messages);
    expect(state.phase).toBe("deleting");
    while (state.visibleLength > 0) state = advanceTypewriter(state, messages);
    state = advanceTypewriter(state, messages);
    expect(state).toEqual({
      messageIndex: 1,
      visibleLength: 0,
      phase: "typing",
    });
    state = advanceTypewriter(state, messages);
    expect(typewriterText(state, messages)).toBe("-");
  });

  it("holds the next complete tip before cycling again", () => {
    let state: TypewriterState = {
      messageIndex: 1,
      visibleLength: messages[1].length,
      phase: "typing",
    };
    state = advanceTypewriter(state, messages);
    expect(state.phase).toBe("holding");
    expect(typewriterText(state, messages)).toBe("- Aufgabe");
  });
});
