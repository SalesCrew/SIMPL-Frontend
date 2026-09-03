import type { Card } from "./types";

export type ReadFilter = "" | "unread" | "read";

export function nextReadFilter(value: ReadFilter): ReadFilter {
  if (value === "") return "unread";
  if (value === "unread") return "read";
  return "";
}

export function cardMatchesReadFilter(
  card: Pick<Card, "reviewed_at">,
  filter: ReadFilter,
) {
  if (!filter) return true;
  return filter === "read" ? !!card.reviewed_at : !card.reviewed_at;
}
