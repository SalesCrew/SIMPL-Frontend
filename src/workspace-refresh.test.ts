import { describe, expect, it } from "vitest";
import { workspaceRefreshFailure } from "./workspace-refresh";

describe("workspace refresh recovery", () => {
  it("keeps a loaded workspace visible while a transient request is retried", () => {
    expect(workspaceRefreshFailure(true)).toEqual({
      preserveBoard: true,
      passwordGate: "ready",
      message:
        "Verbindung kurz unterbrochen. Deine Ansicht bleibt erhalten; SIMPL verbindet sich automatisch neu.",
    });
  });

  it("keeps the security gate closed when the initial access check fails", () => {
    expect(workspaceRefreshFailure(false)).toEqual({
      preserveBoard: false,
      passwordGate: "checking",
      message:
        "Zugriffsrechte konnten nicht geprüft werden. Bitte Verbindung prüfen und erneut versuchen.",
    });
  });
});
