import { describe, expect, it } from "vitest";
import {
  DESCRIPTION_CHECKLIST_ID,
  checklistFromDescription,
  checklistItemsFromDescription,
  checklistsForNewCard,
} from "./checklist-drafts";

describe("checklists while creating a card", () => {
  it("turns description lines beginning with a hyphen into checklist items", () => {
    expect(checklistItemsFromDescription([
      "Normaler Kontext",
      "-Text ohne Leerzeichen",
      "  - Text mit Einzug",
      "- [x] Bereits erledigt",
      "",
    ].join("\n"))).toEqual([
      { name: "Text ohne Leerzeichen", completed: false },
      { name: "Text mit Einzug", completed: false },
      { name: "Bereits erledigt", completed: true },
    ]);
  });

  it("creates stable item ids and preserves completion when text remains", () => {
    const first = checklistFromDescription("- Angebot prüfen\n- Freigabe holen")!;
    first.items[0].completed = true;
    const next = checklistFromDescription("- Angebot prüfen\n- Text geändert", first)!;
    expect(next.id).toBe(DESCRIPTION_CHECKLIST_ID);
    expect(next.items[0]).toMatchObject({ name: "Angebot prüfen", completed: true });
    expect(next.items[1]).toMatchObject({ name: "Text geändert", completed: false });
  });

  it("combines the automatic list with cleaned manual checklists", () => {
    const result = checklistsForNewCard("- Auto-Aufgabe", [{
      id: "manual",
      name: "  Launch  ",
      items: [
        { id: "one", name: "  Freigabe  ", completed: false },
        { id: "empty", name: "   ", completed: false },
      ],
    }]);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ name: "Aus Beschreibung", items: [{ name: "Auto-Aufgabe" }] });
    expect(result[1]).toEqual({
      id: "manual",
      name: "Launch",
      items: [{ id: "one", name: "Freigabe", completed: false }],
    });
  });
});
