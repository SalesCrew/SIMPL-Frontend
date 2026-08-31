import type { KeyboardEvent } from "react";

export function handleCommentKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
  if (
    event.key !== "Enter" ||
    event.shiftKey ||
    event.nativeEvent.isComposing ||
    event.nativeEvent.keyCode === 229
  )
    return;

  event.preventDefault();
  // Holding Enter must not submit another comment when the first send finishes.
  if (!event.repeat) event.currentTarget.form?.requestSubmit();
}
