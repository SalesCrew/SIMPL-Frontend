import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DocsPage } from "./Docs";

describe("SIMPL documentation", () => {
  const html = renderToStaticMarkup(<DocsPage />);

  it("covers the complete user journey on one semantic page", () => {
    for (const id of ["schnellstart", "grundprinzip", "karten", "zusammenarbeit", "finden", "zugriff", "kurzbefehle", "fragen"])
      expect(html).toContain(`id="${id}"`);
    expect(html).toContain("Vier Schritte bis zur ersten Aufgabe");
    expect(html).toContain("Von der Idee bis „Fertig“");
    expect(html).toContain("Sichtbarkeit wird im Workspace geregelt");
  });

  it("documents important behavior precisely", () => {
    expect(html).toContain("500 MB pro Datei");
    expect(html).toContain("Enter sendet");
    expect(html).toContain("Checklisten direkt mitplanen");
    expect(html).toContain("Aus Beschreibung");
    expect(html).toContain("Er zeigt die Person, die die Karte erstellt hat");
    expect(html).toContain("an ihre zuletzt gemerkte Position");
    expect(html).toContain("schreibgeschützt");
  });

  it("provides a broad accessible Q&A", () => {
    expect(html.match(/<details>/g)).toHaveLength(29);
    expect(html.match(/<summary>/g)).toHaveLength(29);
    expect(html).toContain("Wie melde ich mich an?");
    expect(html).toContain("Wie filtere ich nach einer Person?");
    expect(html).toContain("Wie erstelle ich eine Checkliste aus der Beschreibung?");
    expect(html).toContain("Was mache ich, wenn etwas fehlt oder nicht lädt?");
  });

  it("filters Q&A into expandable results", () => {
    const filtered = renderToStaticMarkup(<DocsPage search="PDF hochladen" />);
    expect(filtered).toContain('type="search"');
    expect(filtered).toContain("Passende Antworten");
    expect(filtered).toContain("Welche Dateien kann ich anhängen?");
    expect(filtered).toContain("Treffer");
    expect(filtered.match(/<details>/g)?.length).toBeLessThan(29);
  });
});
