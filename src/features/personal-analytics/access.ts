// Navigation convenience only; the Express API independently verifies this ID.
export const PERSONAL_ANALYTICS_OWNER_ID = "e68b62cd-06b3-4300-8a16-dc04e20ed75d";
export const canRequestPersonalAnalytics = (id: string | null | undefined) => id === PERSONAL_ANALYTICS_OWNER_ID;
export function initiallyRequestedPersonalAnalytics() {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("view") === "insights";
}
export function writePersonalAnalyticsLocation(active: boolean) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (active) url.searchParams.set("view", "insights");
  else if (url.searchParams.get("view") === "insights") url.searchParams.delete("view");
  window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
}
