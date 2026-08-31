import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { InitialPassword, validateInitialPassword } from "./InitialPassword";

vi.mock("../data", () => ({ changeInitialPassword: vi.fn() }));

describe("First-login password form", () => {
  it("has only two password fields, no workspace and no dismissal", () => {
    const html = renderToStaticMarkup(<InitialPassword email="private@example.invalid" complete={async () => {}} />);
    expect(html).toContain('class="password-gate"');
    expect(html.match(/type="password"/g)).toHaveLength(2);
    expect(html.match(/autoComplete="new-password"/g)).toHaveLength(2);
    expect(html).toContain("Neues Passwort");
    expect(html).toContain("Passwort wiederholen");
    expect(html).toContain("Passwort speichern");
    expect(html).not.toContain("private@example.invalid");
    expect(html).not.toMatch(/Dialog schließen|Überspringen|Taskboard|sidebar/);
  });
  it("validates length and exact confirmation without trimming passwords", () => {
    expect(validateInitialPassword("short", "short")).toContain("12 bis 128");
    expect(validateInitialPassword("a".repeat(129), "a".repeat(129))).toContain("12 bis 128");
    expect(validateInitialPassword("long-new-password", "different-password")).toContain("nicht überein");
    expect(validateInitialPassword(" long-password ", "long-password")).toContain("nicht überein");
    expect(validateInitialPassword("long-new-password", "long-new-password")).toBe("");
  });
});
