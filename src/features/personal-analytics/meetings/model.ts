import type { MeetingCatalogue, MeetingChartLayout, MeetingKindFilter, MeetingSummary } from "./types";
const dayMs = (day: string) => Date.parse(day + "T12:00:00Z");
export function monday(day: string) { const d = new Date(dayMs(day)); d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7); return d.toISOString().slice(0, 10); }
export function filterMeetings(catalogue: MeetingCatalogue, layout: Pick<MeetingChartLayout, "rangeStart" | "rangeEnd" | "labelId">, kind: MeetingKindFilter) {
  const labelId = layout.labelId;
  if (labelId && !catalogue.labels.some(label => label.id === labelId)) return [];
  return catalogue.meetings.filter(meeting => kind === "all" || meeting.kind === kind).map(meeting => ({ ...meeting, sections: meeting.sections.filter(section => !labelId || section.primary_label_id === labelId) })).filter(meeting => meeting.sections.length && (!meeting.meeting_date || meeting.meeting_date >= layout.rangeStart && meeting.meeting_date <= layout.rangeEnd)).sort((a, b) => (a.meeting_date || "9999").localeCompare(b.meeting_date || "9999") || (a.starts_at || "").localeCompare(b.starts_at || "") || a.id.localeCompare(b.id));
}
export function meetingGroups(meetings: MeetingSummary[], layout: Pick<MeetingChartLayout, "start" | "end" | "grain">) {
  const groups = new Map<string, MeetingSummary[]>();
  for (const meeting of meetings) {
    if (!meeting.meeting_date || meeting.meeting_date < layout.start || meeting.meeting_date > layout.end) continue;
    const key = layout.grain === "week" ? monday(meeting.meeting_date) : layout.grain === "month" ? meeting.meeting_date.slice(0, 7) : meeting.meeting_date;
    groups.set(key, [...groups.get(key) || [], meeting]);
  }
  const monthOrdinal = (day: string) => Number(day.slice(0, 4)) * 12 + Number(day.slice(5, 7)) - 1;
  return [...groups].map(([tick, items]) => {
    const first = layout.grain === "week" ? monday(layout.start) : layout.start, last = layout.grain === "week" ? monday(layout.end) : layout.end;
    const position = layout.grain === "month" ? (monthOrdinal(tick) - monthOrdinal(first) + .5) / (monthOrdinal(last) - monthOrdinal(first) + 1) : first === last ? .5 : (dayMs(tick) - dayMs(first)) / (dayMs(last) - dayMs(first));
    return { tick, items, position: Math.max(0, Math.min(1, position)) };
  });
}
export function safeMeetingHref(href: string | undefined) {
  if (!href || /[\u0000-\u0020]/.test(href)) return "";
  if (/^https?:\/\//i.test(href)) { try { return new URL(href).href; } catch { return ""; } }
  // Relative notes are resolved internally by identity, never opened as OS paths.
  return "";
}
export function resolveNoteRef(current: string, href: string, catalogue: MeetingCatalogue) {
  if (/^[a-z]+:/i.test(href) || href.startsWith("/")) return null;
  const base = current.split("/"); base.pop();
  let decoded: string; try { decoded = decodeURIComponent(href.split("#")[0]); } catch { return null; }
  for (const part of decoded.split("/")) { if (part === "..") base.pop(); else if (part && part !== ".") base.push(part); }
  const target = base.join("/");
  for (const meeting of catalogue.meetings) for (const section of meeting.sections) if (section.note_ref === target) return { meeting, section };
  return null;
}

export function clusterMeetingGroups(groups: ReturnType<typeof meetingGroups>, width: number) {
  if (!width) return groups;
  const clustered: ReturnType<typeof meetingGroups> = [];
  for (const group of groups.sort((a,b)=>a.position-b.position)) {
    const previous = clustered.at(-1);
    if (previous && (group.position-previous.position)*width < 29) {
      previous.position=(previous.position*previous.items.length+group.position*group.items.length)/(previous.items.length+group.items.length);
      previous.items=[...previous.items,...group.items]; previous.tick+=':'+group.tick;
    } else clustered.push({...group,items:[...group.items]});
  }
  return clustered;
}
