import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CardTextField } from "./ui/CardTextField";
import { CardChangeDiff, CardUndoToast } from "./CardUndoToast";
import { createSeed } from "../seed";

describe("card editing controls", () => {
  it("distinguishes previous and current values with accessible diff lines", () => {
    const html = renderToStaticMarkup(<CardChangeDiff before="Vorhanden" after="Gelöscht" />);
    expect(html).toContain('class="undo-diff-line is-before" role="group" aria-label="Vorher"');
    expect(html).toContain('class="undo-diff-line is-after" role="group" aria-label="Nachher"');
    expect(html).toContain('aria-hidden="true">−</span>');
    expect(html).toContain('aria-hidden="true">+</span>');
    expect(html.indexOf("Vorhanden")).toBeLessThan(html.indexOf("Gelöscht"));
    expect(html).not.toContain("<svg");
  });
  it("preserves multiline text and empty placeholders while escaping user content", () => {
    const html = renderToStaticMarkup(<CardChangeDiff before="—" after={'Zeile 1\n<script>alert(1)</script>'} />);
    expect(html).toContain('class="undo-diff-value">—</span>');
    expect(html).toContain("Zeile 1\n&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>");
  });
  it("shows no save control before a text field changes", () => {
    const html = renderToStaticMarkup(
      <CardTextField
        label="Titel"
        value="Same"
        savedValue="Same"
        onChange={() => {}}
        onSave={async () => true}
        maxLength={180}
      />,
    );
    expect(html).not.toContain('class="field-save');
    expect(html).not.toContain("has-save-control");
  });
  it.each([false, true])(
    "puts an explicit, non-submit save button inside the changed field (description=%s)",
    (multiline) => {
      const label = multiline ? "Beschreibung" : "Titel";
      const html = renderToStaticMarkup(
        <CardTextField
          label={label}
          multiline={multiline}
          value="New"
          savedValue="Old"
          onChange={() => {}}
          onSave={async () => true}
          maxLength={multiline ? 20000 : 180}
        />,
      );
      expect(html).toContain(`aria-label="${label} speichern"`);
      expect(html).toContain('type="button"');
      expect(html).toContain("card-text-control is-dirty");
      expect(html).toContain("has-save-control");
      expect(html).toContain('role="status"');
    },
  );
  it("does not add edit-save buttons to the new-card creation form", () => {
    const html = renderToStaticMarkup(
      <CardTextField
        label="Titel"
        value="New card"
        onChange={() => {}}
        maxLength={180}
      />,
    );
    expect(html).not.toContain('class="field-save');
    expect(html).not.toContain("has-save-control");
  });
  it.each([false, true])(
    "releases the reserved space when the value is saved (description=%s)",
    (multiline) => {
      const props = {
        label: multiline ? "Beschreibung" : "Titel",
        multiline,
        value: "Updated text",
        onChange: () => {},
        onSave: async () => true,
        maxLength: multiline ? 20000 : 180,
      };
      const dirty = renderToStaticMarkup(
        <CardTextField {...props} savedValue="Original text" />,
      );
      const saved = renderToStaticMarkup(
        <CardTextField {...props} savedValue="Updated text" />,
      );
      expect(dirty).toContain("has-save-control");
      expect(saved).not.toContain("has-save-control");
      expect(saved).not.toContain('class="field-save');
      expect(saved).toContain("Updated text");
    },
  );
  it("keeps the undo offer compact and exposes expansion accessibly", () => {
    const offer = {
      id: "s",
      card_id: "c",
      title: "My card",
      opened_at: "now",
      events: [{ field: "title", before: "A", after: "B", at: "now" }],
    };
    const html = renderToStaticMarkup(
      <CardUndoToast
        offer={offer}
        state={createSeed()}
        update={async () => offer}
        remove={() => {}}
      />,
    );
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("Letzte Änderungen rückgängig");
    expect(html).not.toContain("<ol>");
    expect(html).toContain("Änderungen behalten und Hinweis schließen");
  });
});
