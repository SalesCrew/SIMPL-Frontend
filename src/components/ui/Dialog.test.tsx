import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Dialog } from "./Dialog";

// Only the portal needs replacing for server-rendered structure checks.
// Keep the actual Radix content, title, description and close semantics.
vi.mock("@radix-ui/react-dialog", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@radix-ui/react-dialog")>();
  return {
    ...original,
    Portal: ({ children }: { children: ReactNode }) => children,
  };
});

describe("Dialog scroll containment", () => {
  it.each([false, true])(
    "keeps the header outside the scroll body (wide=%s)",
    (wide) => {
      const html = renderToStaticMarkup(
        <Dialog title="Karte" onClose={() => {}} wide={wide}>
          <form>
            <input aria-label="Titel" />
          </form>
        </Dialog>,
      );
      expect(html).toContain(`class="modal ${wide ? "wide" : ""}"`);
      expect(html).toContain('role="dialog"');
      expect(html).toContain(
        '</header><div class="modal-body"><form><input aria-label="Titel"/>',
      );
      expect(html).toContain('aria-label="Schließen"');
      // Radix connects these IDs to the dialog after hydration.
      expect(html).toMatch(/<h2 id="[^"]+">Karte<\/h2>/);
      expect(html).toMatch(
        /<p id="[^"]+">Details bearbeiten und gemeinsam weiterarbeiten\.<\/p>/,
      );
    },
  );

  it("keeps closing disabled while work is pending", () => {
    const html = renderToStaticMarkup(
      <Dialog title="Karte" onClose={() => {}} preventClose>
        <p>Wird hochgeladen</p>
      </Dialog>,
    );
    expect(html).toMatch(/aria-label="Schließen"[^>]*disabled=""/);
    expect(html).toContain('<div class="modal-body"><p>Wird hochgeladen</p>');
  });
});
