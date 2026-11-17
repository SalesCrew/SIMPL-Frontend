export const LIVE_REFRESH_INTERVAL_MS = 60_000;

/** Keep an open report current without polling hidden tabs or overlapping reads. */
export function startLiveRefresh(refresh: () => void, isLoading: () => boolean,
  page: Pick<Document, "visibilityState" | "addEventListener" | "removeEventListener"> = document,
  browser: Pick<Window, "addEventListener" | "removeEventListener"> = window) {
  let lastRefresh = -Infinity;
  const update = () => {
    if (page.visibilityState === "hidden" || isLoading() || Date.now() - lastRefresh < 1_000) return;
    lastRefresh = Date.now();
    refresh();
  };
  const timer = setInterval(update, LIVE_REFRESH_INTERVAL_MS);
  page.addEventListener("visibilitychange", update);
  browser.addEventListener("focus", update);
  browser.addEventListener("online", update);
  return () => {
    clearInterval(timer);
    page.removeEventListener("visibilitychange", update);
    browser.removeEventListener("focus", update);
    browser.removeEventListener("online", update);
  };
}
