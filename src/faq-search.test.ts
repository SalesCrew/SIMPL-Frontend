import { describe, expect, it } from "vitest";
import { faqGroups } from "./components/Docs";
import { findFaqMatches } from "./faq-search";

const questions = (query: string) => findFaqMatches(faqGroups, query).map((result) => result.question);

describe("semantic Q&A search", () => {
  it.each([
    ["Wie komme ich in mein Konto rein?", "Wie melde ich mich an?"],
    ["Kann ich beim neuen Ticket eine Aufgabenliste machen?", "Kann ich neue Checklisten erstellen?"],
    ["Wo sind die alten erledigten Sachen?", "Wo finde ich alte Karten?"],
    ["Wie kann ich ein PDF hochladen?", "Welche Dateien kann ich anhängen?"],
    ["Wer hat den Task eigentlich angelegt?", "Was zeigt der Kreis unten rechts auf einer Karte?"],
  ])("understands paraphrases: %s", (query, expected) => {
    expect(questions(query)).toContain(expected);
  });

  it("tolerates a small typo and returns no invented answer", () => {
    expect(questions("Wie sende ich einen Komentar?")).toContain("Wie sende ich einen Kommentar?");
    expect(findFaqMatches(faqGroups, "Quantenraketenantrieb")).toEqual([]);
  });
});
