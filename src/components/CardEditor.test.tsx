import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CardEditor } from "./Editors";
import { TooltipProvider } from "./ui/Tooltip";
import { createSeed } from "../seed";
import { timestamp, type BoardState, type Card } from "../types";

vi.mock("../data", () => ({ demoMode: true, supabase: null }));
// Render the real dialog header and editor, only bypassing its browser portal.
vi.mock("@radix-ui/react-dialog", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@radix-ui/react-dialog")>();
  return {
    ...original,
    Portal: ({ children }: { children: ReactNode }) => children,
  };
});

const fixture = () => {
  const state = createSeed();
  state.comments = [];
  state.attachments = [];
  const card: Card = {
    ...state.cards[0],
    title: "Dashboard – Mitbewerb",
    created_by: "anna",
    assignee_id: "david",
    created_at: "2026-08-31T16:22:00.000Z",
    updated_at: "2026-09-01T09:10:00.000Z",
  };
  return { state, card };
};

function renderEditor(state: BoardState, card?: Card, profileIndex = 0, busy = false) {
  return renderToStaticMarkup(
    <TooltipProvider>
      <CardEditor
        state={state}
        current={state.profiles[profileIndex]}
        card={card}
        workspaceId="salescrew"
        busy={busy}
        mutate={async () => true}
        close={() => {}}
        editLabels={() => {}}
      />
    </TooltipProvider>,
  );
}

describe("CardEditor creation header", () => {
  it.each([0, 2])("lets every role archive from the detailed card view (profile=%s)", (index) => {
    const { state, card } = fixture();
    const html = renderEditor(state, card, index);
    const button = html.match(/<button[^>]*aria-label="Karte archivieren"[^>]*>[\s\S]*?<\/button>/)?.[0];
    expect(button).toBeTruthy();
    expect(button).not.toContain("disabled");
    expect(button).toContain("Archivieren");
    expect(button).toContain("lucide-archive");

    const pending = renderEditor(state, card, index, true);
    expect(pending).toMatch(/<button[^>]*aria-label="Karte archivieren"[^>]*disabled=""/);
  });

  it.each([0, 2])("allows acknowledgement on and off for each role (profile=%s)", (index) => {
    const { state, card } = fixture();
    for (const reviewed of [false, true]) {
      card.reviewed_at = reviewed ? card.created_at : null;
      card.reviewed_by = reviewed ? "ben" : null;
      const html = renderEditor(state, card, index);
      const button = html.match(/<button[^>]*aria-label="(?:Von [^"]+ gelesen\. Gelesen-Markierung entfernen|Karte als gelesen markieren)"[^>]*>[\s\S]*?<\/button>/)?.[0];
      expect(button).toBeTruthy();
      expect(button).not.toContain("disabled");
      expect(button).toContain(`aria-pressed="${reviewed}"`);
      expect(button).toContain(reviewed ? "Von Ben Wagner gelesen" : "Noch nicht gelesen");
      expect(html).not.toContain("Vom Admin gelesen");
      const pending = renderEditor(state, card, index, true);
      expect(pending).toMatch(/<button[^>]*disabled=""[^>]*aria-label="(?:Von [^"]+ gelesen\. Gelesen-Markierung entfernen|Karte als gelesen markieren)"/);
    }
  });
  it("uses the saved reader, not the creator, assignee or current viewer", () => {
    const { state, card } = fixture();
    card.reviewed_at = card.created_at;
    card.reviewed_by = "ben";
    state.profiles.find((profile) => profile.id === "ben")!.active = false;
    const html = renderEditor(state, card);
    expect(html).toContain("Von Ben Wagner gelesen");
    expect(html).not.toContain("Von Kilian gelesen");
    expect(html).not.toContain("Von Anna Leitner gelesen");
    expect(html).not.toContain("Von David Lang gelesen");
  });

  it("does not invent a reader when their profile is unavailable", () => {
    const { state, card } = fixture();
    card.reviewed_at = card.created_at;
    card.reviewed_by = "missing-profile";
    expect(renderEditor(state, card)).toContain("Von einem Mitglied gelesen");
  });

  it("renders reader names safely as text", () => {
    const { state, card } = fixture();
    card.reviewed_at = card.created_at;
    card.reviewed_by = "ben";
    state.profiles.find((profile) => profile.id === "ben")!.name = "<img src=x>";
    const html = renderEditor(state, card);
    expect(html).toContain("Von &lt;img src=x&gt; gelesen");
    expect(html).not.toContain("<img src=x>");
  });
  it("shows the card title and creator with the original date and time in the header", () => {
    const { state, card } = fixture();
    const html = renderEditor(state, card);
    const header = html.slice(0, html.indexOf("</header>"));
    expect(header).toMatch(/<h2[^>]*>Dashboard – Mitbewerb<\/h2>/);
    expect(header).toContain("Erstellt von Anna Leitner · ");
    expect(header).toContain(
      `<time dateTime="${card.created_at}">${timestamp(card.created_at)}</time>`,
    );
    expect(header).not.toContain("David Lang");
    expect(header).not.toContain("Kilian");
    expect(header).not.toContain(timestamp(card.updated_at));
    expect(html).not.toContain("Ein guter nächster Schritt.");
    expect(html).not.toContain("Karte in ");
    expect(html).not.toContain("detail-created");
    expect(html.match(/Erstellt von/g)).toHaveLength(1);
  });

  it("keeps the creator and creation time after a card is edited or moved", () => {
    const { state, card } = fixture();
    const html = renderEditor(state, {
      ...card,
      title: "Aktualisierte Karte",
      column_id: "done",
      updated_at: "2026-09-02T12:30:00.000Z",
    });
    const header = html.slice(0, html.indexOf("</header>"));
    expect(header).toContain("Aktualisierte Karte</h2>");
    expect(header).toContain("Erstellt von Anna Leitner");
    expect(header).toContain(timestamp(card.created_at));
  });

  it("keeps inactive creators identifiable", () => {
    const { state, card } = fixture();
    state.profiles.find((p) => p.id === card.created_by)!.active = false;
    expect(renderEditor(state, card)).toContain("Erstellt von Anna Leitner");
  });

  it("uses a neutral fallback if the creator profile is unavailable", () => {
    const { state, card } = fixture();
    state.profiles = state.profiles.filter((p) => p.id !== card.created_by);
    const html = renderEditor(state, card);
    expect(html).toContain("Erstellt von Unbekanntes Mitglied");
    expect(html).toContain(timestamp(card.created_at));
  });

  it("preserves the new-card header without inventing creation metadata", () => {
    const { state } = fixture();
    const html = renderEditor(state);
    expect(html).toContain("Was steht als Nächstes an?");
    expect(html).toContain("Eine Idee, eine Aufgabe – und ein klarer Platz dafür.");
    expect(html).not.toContain("Erstellt von");
  });

  it("offers checklist creation and explains automatic description items", () => {
    const { state } = fixture();
    const html = renderEditor(state);
    expect(html).toContain('aria-label="Checklisten erstellen"');
    expect(html).toContain("Füge Punkte direkt hinzu");
    expect(html).toContain("Hinzufügen");
  });

  it("renders long titles and member names as plain text", () => {
    const { state, card } = fixture();
    card.title = "<script>alert(1)</script>" + "A".repeat(140);
    state.profiles.find((p) => p.id === card.created_by)!.name = "<img src=x>";
    const html = renderEditor(state, card);
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("Erstellt von &lt;img src=x&gt;");
    expect(html).not.toContain("<script>");
  });
});
