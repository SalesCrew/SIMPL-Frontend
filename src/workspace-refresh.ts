export type WorkspaceRefreshFailure = {
  preserveBoard: boolean;
  passwordGate: "checking" | "ready";
  message: string;
};

export function workspaceRefreshFailure(
  hasLoadedBoard: boolean,
): WorkspaceRefreshFailure {
  return hasLoadedBoard
    ? {
        preserveBoard: true,
        passwordGate: "ready",
        message:
          "Verbindung kurz unterbrochen. Deine Ansicht bleibt erhalten; SIMPL verbindet sich automatisch neu.",
      }
    : {
        preserveBoard: false,
        passwordGate: "checking",
        message:
          "Zugriffsrechte konnten nicht geprüft werden. Bitte Verbindung prüfen und erneut versuchen.",
      };
}
