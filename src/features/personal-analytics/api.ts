import { supabase } from "../../data";
import { canRequestPersonalAnalytics } from "./access";
import type { PersonalAnalyticsPayload } from "./types";
export class PersonalAnalyticsError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}
export async function fetchPersonalAnalytics(signal: AbortSignal): Promise<PersonalAnalyticsPayload> {
  if (!supabase) throw new PersonalAnalyticsError("Bitte erneut anmelden.", 401);
  const session = (await supabase.auth.getSession()).data.session;
  if (!session) throw new PersonalAnalyticsError("Bitte erneut anmelden.", 401);
  if (!canRequestPersonalAnalytics(session.user.id)) throw new PersonalAnalyticsError("Nicht gefunden.", 404);
  const response = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/personal-analytics`, { method: "GET", headers: { Authorization: `Bearer ${session.access_token}`, Accept: "application/json" }, cache: "no-store", signal });
  if (!response.ok) throw new PersonalAnalyticsError(response.status === 401 ? "Bitte erneut anmelden." : response.status === 403 || response.status === 404 ? "Dieser Bereich ist nicht verfügbar." : "Die Auswertung konnte nicht geladen werden. Bitte erneut versuchen.", response.status);
  const value: unknown = await response.json();
  if (!value || typeof value !== "object") throw new PersonalAnalyticsError("Ungültiger Datenstand.", 502);
  const payload = value as PersonalAnalyticsPayload;
  if (!payload.meta || !Number.isFinite(Date.parse(payload.meta.snapshot_at)) || !/^\d{4}-\d{2}-\d{2}$/.test(payload.meta.first_date) || !payload.coverage || !Array.isArray(payload.tasks) || !Array.isArray(payload.flow_tasks) || !payload.tasks.every(t => typeof t.id === "string" && Array.isArray(t.labels)) || !payload.flow_tasks.every(t => typeof t.id === "string" && Array.isArray(t.labels))) throw new PersonalAnalyticsError("Ungültiger Datenstand.", 502);
  return payload;
}
