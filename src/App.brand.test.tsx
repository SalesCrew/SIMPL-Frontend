import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import App from "./App";

vi.mock("./data", () => ({ demoMode: false, supabase: {} }));
vi.mock("./useWorkspace", () => ({
  useWorkspace: () => ({
    authReady: true,
    user: null,
    current: null,
    state: null,
    activeWorkspaceId: "",
  }),
}));

describe("SIMPL login branding", () => {
  it("renders the shared brand and all three company names", () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('aria-label="SIMPL Startseite"');
    expect(html).toContain('src="/images/simple-mark.png"');
    expect(html).toContain('<span class="brand-name">simpl</span>');
    expect(html).not.toContain('aria-label="Simple Startseite"');
    expect(html).toContain("SalesCrew · Inkognito · Merchandizing");
    expect(html).not.toContain("Trello");
  });

  it("preserves the login form and existing team joke", () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('type="email"');
    expect(html).toContain('type="password"');
    expect(html).toContain("Schreiben Sie ihm eine Karte.");
    expect(html).toContain("Zum Workspace");
  });
});
