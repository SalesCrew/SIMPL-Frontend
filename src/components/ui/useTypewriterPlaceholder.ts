import { useEffect, useState } from "react";

export type TypewriterState = {
  messageIndex: number;
  visibleLength: number;
  phase: "holding" | "deleting" | "typing";
};

export function initialTypewriterState(
  messages: readonly string[],
): TypewriterState {
  return {
    messageIndex: 0,
    visibleLength: messages[0]?.length || 0,
    phase: "holding",
  };
}

export function advanceTypewriter(
  state: TypewriterState,
  messages: readonly string[],
): TypewriterState {
  if (!messages.length) return initialTypewriterState(messages);

  if (state.phase === "holding") {
    return { ...state, phase: "deleting" };
  }

  if (state.phase === "deleting") {
    if (state.visibleLength > 0) {
      return { ...state, visibleLength: state.visibleLength - 1 };
    }
    return {
      messageIndex: (state.messageIndex + 1) % messages.length,
      visibleLength: 0,
      phase: "typing",
    };
  }

  const message = messages[state.messageIndex] || "";
  if (state.visibleLength < message.length) {
    return { ...state, visibleLength: state.visibleLength + 1 };
  }
  return { ...state, phase: "holding" };
}

export function typewriterText(
  state: TypewriterState,
  messages: readonly string[],
) {
  return (messages[state.messageIndex] || "").slice(0, state.visibleLength);
}

export function useTypewriterPlaceholder(
  messages: readonly string[] | undefined,
  active: boolean,
) {
  const [state, setState] = useState(() =>
    initialTypewriterState(messages || []),
  );
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    if (!messages?.length || typeof window.matchMedia !== "function") return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(preference.matches);
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, [messages]);

  useEffect(() => {
    if (!messages?.length) return;
    if (!active) {
      setState((current) => {
        const initial = initialTypewriterState(messages);
        return current.messageIndex === initial.messageIndex &&
          current.visibleLength === initial.visibleLength &&
          current.phase === initial.phase
          ? current
          : initial;
      });
      return;
    }
    if (reduceMotion || messages.length < 2) return;

    const delay =
      state.phase === "holding" ? 5000 : state.phase === "deleting" ? 18 : 34;
    const timer = window.setTimeout(
      () => setState((current) => advanceTypewriter(current, messages)),
      delay,
    );
    return () => window.clearTimeout(timer);
  }, [active, messages, reduceMotion, state]);

  if (!messages?.length) return "";
  if (reduceMotion) return messages[0];
  return typewriterText(state, messages);
}
