import { supabase } from "../../../data";
import { canRequestPersonalAnalytics } from "../access";
import { PersonalAnalyticsError } from "../api";
import type { MeetingCatalogue, MeetingDetail, MeetingProtocol } from "./types";
export async function meetingRequest<T>(path: string, signal: AbortSignal): Promise<T> {
  const session = supabase ? (await supabase.auth.getSession()).data.session : null;
  if (!session || !canRequestPersonalAnalytics(session.user.id)) throw new PersonalAnalyticsError("Dieser Bereich ist nicht verfügbar.", session ? 404 : 401);
  const response = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/personal-analytics/meetings${path}`, { headers: { Authorization: `Bearer ${session.access_token}`, Accept: "application/json" }, cache: "no-store", signal });
  if (!response.ok) throw new PersonalAnalyticsError(response.status === 404 ? "Meeting in dieser Auswahl nicht verfügbar." : "Meetingkontext konnte nicht geladen werden.", response.status);
  return response.json() as Promise<T>;
}
export async function loadMeetingCatalogue(signal: AbortSignal): Promise<MeetingCatalogue> {
  const contract = await meetingRequest<{ ready: boolean; schema_version: string }>("/contract", signal);
  if (!contract.ready || contract.schema_version !== "salescrew.meeting.v1") throw new PersonalAnalyticsError("Die Meeting-Schnittstelle ist noch nicht bereit.", 503);
  const result: MeetingCatalogue = { schema_version: contract.schema_version, meetings: [], projects: [], labels: [] }, seen = new Set<string>(); let after = "";
  for (let page = 0; page < 100; page++) {
    const part = await meetingRequest<MeetingCatalogue & { next: string | null }>(after ? `?after=${encodeURIComponent(after)}` : "", signal);
    if (!Array.isArray(part.meetings) || !Array.isArray(part.projects) || !Array.isArray(part.labels)) throw new PersonalAnalyticsError("Ungültige Meetingdaten.", 502);
    result.meetings.push(...part.meetings); result.projects = part.projects; result.labels = part.labels;
    if (!part.next) return result;
    if (seen.has(part.next)) throw new PersonalAnalyticsError("Unvollständiger Meetingabruf.", 502);
    seen.add(part.next); after = part.next;
  }
  throw new PersonalAnalyticsError("Zu viele Meetingdaten für einen vollständigen Abruf.", 409);
}
export const loadMeetingDetail = (id: string, project: string | null, signal: AbortSignal) => meetingRequest<MeetingDetail>(`/${encodeURIComponent(id)}${project ? `?label_id=${encodeURIComponent(project)}` : ""}`, signal);
export const loadMeetingProtocol = (id: string, section: string, project: string | null, signal: AbortSignal) => meetingRequest<MeetingProtocol>(`/${encodeURIComponent(id)}/protocol/${encodeURIComponent(section)}${project ? `?label_id=${encodeURIComponent(project)}` : ""}`, signal);
