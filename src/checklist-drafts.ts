import type { Checklist } from "./types";

export const DESCRIPTION_CHECKLIST_ID = "simpl-description-checklist";

type ParsedItem = { name: string; completed: boolean };
const DESCRIPTION_ITEM_PATTERN = /^\s*-\s*(?:\[([ xX])\]\s*)?(.+?)\s*$/;

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function checklistItemsFromDescription(description: string): ParsedItem[] {
  return description.split(/\r?\n/).flatMap((line) => {
    const match = line.match(DESCRIPTION_ITEM_PATTERN);
    if (!match) return [];
    const name = match[2].trim();
    return name ? [{ name, completed: match[1]?.toLowerCase() === "x" }] : [];
  });
}

export function checklistFromDescription(
  description: string,
  previous?: Checklist,
): Checklist | undefined {
  const occurrences = new Map<string, number>();
  const items = checklistItemsFromDescription(description).slice(0, 200).map((item) => {
    const fingerprint = item.name.trim().toLocaleLowerCase("de-AT");
    const occurrence = (occurrences.get(fingerprint) || 0) + 1;
    occurrences.set(fingerprint, occurrence);
    const id = `simpl-description-${stableHash(fingerprint)}-${occurrence}`;
    return {
      id,
      name: item.name,
      completed:
        previous?.items.find((entry) => entry.id === id)?.completed ??
        item.completed,
    };
  });
  if (!items.length) return undefined;
  return { id: DESCRIPTION_CHECKLIST_ID, name: "Aus Beschreibung", items };
}

export function cleanDraftChecklists(checklists: Checklist[]): Checklist[] {
  return checklists.slice(0, 19).flatMap((checklist) => {
    const items = checklist.items
      .slice(0, 200)
      .flatMap((item) => {
        const name = item.name.trim();
        return name ? [{ ...item, name, completed: !!item.completed }] : [];
      });
    if (!items.length) return [];
    return [{
      ...checklist,
      name: checklist.name.trim() || "Checkliste",
      items,
    }];
  });
}

export function checklistsForNewCard(
  description: string,
  manualChecklists: Checklist[],
): Checklist[] {
  const automatic = checklistFromDescription(description);
  return [...(automatic ? [automatic] : []), ...cleanDraftChecklists(manualChecklists)];
}
