import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AccessLoading } from "./AccessLoading";

describe("Clean access-check loading screen", () => {
  it("shows just the shared logo, subtle indicator and accessible status", () => {
    const html = renderToStaticMarkup(<AccessLoading />);
    expect(html).toContain('aria-label="SIMPL"');
    expect(html).toContain('src="/images/simple-mark.png"');
    expect(html).toContain('class="access-loading-track" aria-hidden="true"');
    expect(html).toContain('role="status" aria-live="polite" aria-atomic="true"');
    expect(html).toContain("Zugriffsrechte werden geprüft");
    expect(html).not.toMatch(/<button|<input|aria-valuenow|sidebar|lucide-loader/);
  });
  it("uses honest error copy and preserves the retry action", () => {
    const html = renderToStaticMarkup(<AccessLoading error="Verbindung nicht verfügbar." retry={async () => {}} />);
    expect(html).toContain('data-state="error"');
    expect(html).toContain("Zugriff konnte nicht geprüft werden");
    expect(html).toContain('role="alert">Verbindung nicht verfügbar.');
    expect(html).toContain('type="button"');
    expect(html).toContain("Erneut versuchen");
  });
});
