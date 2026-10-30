export type AppView = "board" | "mine" | "done" | "team" | "archive" | "docs" | "analytics";

const routeViews: Record<string, AppView> = {
  board: "board", mine: "mine", done: "done", team: "team",
  archive: "archive", docs: "docs", insights: "analytics",
};

/** A plain app URL always starts on the taskboard; explicit links survive reloads. */
export function initialAppView(): AppView {
  if (typeof window === "undefined") return "board";
  const value = new URLSearchParams(window.location.search).get("view") || "board";
  return Object.hasOwn(routeViews, value) ? routeViews[value] : "board";
}

export function writeAppViewLocation(view: AppView) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (view === "board") url.searchParams.delete("view");
  else url.searchParams.set("view", view === "analytics" ? "insights" : view);
  if (view !== "analytics") {
    for (const key of ["meeting", "meeting_section", "meeting_reader", "meeting_label"]) {
      url.searchParams.delete(key);
    }
  }
  const next = url.pathname + url.search + url.hash;
  const state = window.history.state;
  const nextState = view !== "analytics" && state && typeof state === "object" && state.personalMeetingDepth
    ? { ...state, personalMeetingDepth: 0 } : state;
  if (next !== window.location.pathname + window.location.search + window.location.hash || nextState !== state) {
    window.history.replaceState(nextState, "", next);
  }
}
