import type { Card } from "./types";

// A person's cards include their own requests, even when nobody is assigned yet.
// Keep this definition consistent between the member filter and "Meine Karten".
export function cardMatchesMember(
  card: Pick<Card, "created_by" | "assignee_id">,
  memberId: string,
) {
  return card.created_by === memberId || card.assignee_id === memberId;
}
