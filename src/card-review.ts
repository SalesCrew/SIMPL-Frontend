import type { Card, Profile } from "./types";

export function cardReadLabel(card: Card, profiles: Profile[]): string {
  if (!card.reviewed_at) return "Noch nicht gelesen";
  const reviewer = profiles.find((profile) => profile.id === card.reviewed_by);
  return `Von ${reviewer?.name.trim() || "einem Mitglied"} gelesen`;
}
