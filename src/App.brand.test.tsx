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
    expect(html).toContain("SalesCrew · Inkognito · Merchandising");
    expect(html).not.toContain("Trello");
  });

  it("uses the same quiet, centered language as the access-loading screen", () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('class="login-shell"');
    expect(html).toContain('class="login-brand"');
    expect(html).toContain('class="login-accent"');
    expect(html).toContain("Anmelden");
    expect(html).not.toContain('class="login-story"');
    expect(html).not.toContain("Gemeinsam");
    expect(html).not.toContain("Projekte und Aufgaben im Überblick.");
    expect(html).not.toContain("Ein Entwickler.");
    expect(html).not.toContain("Tausend");
    expect(html).not.toContain("Kilian zu wenig zu tun");
    expect(html).not.toContain("Schreiben Sie ihm eine Karte.");
  });

  it("keeps the login form without its decorative icon or subtitle", () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain("Anmelden");
    expect(html).not.toContain("welcome-icon");
    expect(html).not.toContain("lucide-lock-keyhole");
    expect(html).not.toContain("Melde dich an und mach gemeinsam weiter.");
    expect(html).toContain('type="email"');
    expect(html).toContain('type="password"');
    expect(html).toContain('autoComplete="username"');
    expect(html).toContain('autoComplete="current-password"');
    expect(html).toContain("Zum Workspace");
    expect(html).toContain("Wende dich an deinen Administrator.");
  });
});
