import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ArchiveHeading, ArchiveList, groupArchivedCards } from "./Archive";
import { createSeed } from "../seed";
import type { Attachment, Card } from "../types";

vi.mock("../data", () => ({ demoMode: true, supabase: null }));

function fixture() {
  const state = createSeed();
  const cards: Card[] = [
    { ...state.cards[0], id: "older", title: "Juli-Karte", archived_at: "2026-07-15T12:00:00Z" },
    { ...state.cards[0], id: "newest", title: "Foto <Export>", project_id: "spark", column_id: "done", archived_at: "2026-08-31T10:00:00Z", position: 1 },
    { ...state.cards[0], id: "same-day", title: "Weitere Karte", project_id: null, column_id: "done", archived_at: "2026-08-31T10:00:00Z", position: 2 },
    { ...state.cards[0], id: "live", title: "Aktive Karte", archived_at: null },
  ];
  state.cards = cards;
  state.comments = [{ id: "comment", card_id: "newest", author_id: "kilian", body: "Original", created_at: "2026-08-30T12:00:00Z" }];
  const file: Attachment = {
    id: "file", card_id: "newest", uploaded_by: "kilian", filename: "Export.pdf", mime_type: "application/pdf",
    size_bytes: 1024, object_path: "fixture/Export.pdf", status: "ready", created_at: "2026-08-30T12:00:00Z", expires_at: "2026-09-30T12:00:00Z",
  };
  state.attachments = [file, { ...file, id: "pending", status: "pending" }, { ...file, id: "other-card", card_id: "live" }];
  return { state, cards };
}

describe("Archive list", () => {
  it("has its own concise, read-only heading", () => {
    const html = renderToStaticMarkup(<ArchiveHeading />);
    expect(html).toContain('<h1>Archiv');
    expect(html).toContain("Nur zum Nachlesen");
    expect(html).toContain("Kommentare und Dateien");
    expect(html).not.toContain("Trello nur schöner");
    expect(html).not.toContain("avatar");
  });

  it("groups by archive month, sorts newest first and never mutates source cards", () => {
    const { cards } = fixture();
    const original = structuredClone(cards);
    const groups = groupArchivedCards(cards);
    expect(groups.map((group) => group.label)).toEqual(["August 2026", "Juli 2026"]);
    expect(groups.map((group) => group.cards.map((card) => card.id))).toEqual([["newest", "same-day"], ["older"]]);
    expect(cards).toEqual(original);
  });

  it("uses archive instants instead of timestamp string ordering", () => {
    const { cards } = fixture();
    const groups = groupArchivedCards([
      { ...cards[0], id: "earlier", archived_at: "2026-08-31T15:00:00+03:00" },
      { ...cards[0], id: "later", archived_at: "2026-08-31T13:00:00Z" },
    ]);
    expect(groups[0].cards.map((card) => card.id)).toEqual(["later", "earlier"]);
  });

  it("renders exact titles, project context, archive dates and only ready attachment counts", () => {
    const { cards, state } = fixture();
    const html = renderToStaticMarkup(<ArchiveList cards={cards} state={state} open={vi.fn()} />);
    expect(html).toContain('class="board-content archive-content"');
    expect(html).toContain('class="archive-list" aria-label="Archivierte Karten"');
    expect(html).toContain("Foto &lt;Export&gt;");
    expect(html).not.toContain("Foto <Export>");
    expect(html).toContain("SPARK</span>");
    expect(html).toContain('class="archive-source-column">Fertig</span>');
    expect(html).toContain("Nicht zugeordnet</span>");
    expect(html).toContain('dateTime="2026-08-31T10:00:00Z"');
    expect(html).toContain('aria-label="Archiviert ');
    expect(html).toContain('aria-label="1 Kommentar"');
    expect(html).toContain('aria-label="1 Anhang"');
    expect(html).not.toContain('aria-label="2 Anhänge"');
    expect(html).not.toContain("Aktive Karte");
    expect(html.match(/class="archive-row"/g)).toHaveLength(3);
    expect(html).toContain("2 Karten");
    expect(html).toContain("1 Karte");
  });

  it("keeps unknown original projects unassigned instead of guessing", () => {
    const { cards, state } = fixture();
    const html = renderToStaticMarkup(<ArchiveList cards={[{ ...cards[0], project_id: "missing" }]} state={state} open={vi.fn()} />);
    expect(html).toContain("Nicht zugeordnet</span>");
  });

  it("distinguishes an empty archive from no filter results", () => {
    const { state } = fixture();
    const empty = renderToStaticMarkup(<ArchiveList cards={[]} state={state} open={vi.fn()} />);
    expect(empty).toContain("Das Archiv ist noch leer.");
    expect(empty).not.toContain("Filter zurücksetzen");
    const filtered = renderToStaticMarkup(<ArchiveList cards={[]} state={state} open={vi.fn()} filtered reset={vi.fn()} />);
    expect(filtered).toContain("Keine passenden Karten.");
    expect(filtered).toContain("Filter zurücksetzen");
    expect(filtered.match(/class="archive-empty"/g)).toHaveLength(1);
    expect(filtered).not.toContain("Das Archiv ist noch leer.");
  });
});
