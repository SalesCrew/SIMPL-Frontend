import { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { CircleHelp, LoaderCircle, RefreshCw, X } from "lucide-react";
import { Select } from "../../components/ui/Select";
import { canRequestPersonalAnalytics } from "./access";
import { fetchPersonalAnalytics, PersonalAnalyticsError } from "./api";
import { mountPersonalAnalytics } from "./report-runtime.js";
import { MovingAverageControl } from "./MovingAverageControl";
import { ThresholdControl } from "./ThresholdControl";
import { ThresholdOccupancySummary } from "./ThresholdOccupancySummary";
import type { ThresholdControlModel, ThresholdSettings, ThresholdOccupancyModel } from "./types";
import { MeetingContext } from "./meetings/MeetingContext";
import { PersonalAnalyticsSkeleton } from "./PersonalAnalyticsSkeleton";
import type { MeetingChartLayout } from "./meetings/types";
import type { AnalyticsHandle, AnalyticsViewSnapshot, AverageControlModel, AverageMountedControl, AverageSettings, MountedControl, PersonalAnalyticsPayload } from "./types";
import "./report-base.css";
import "./personal-analytics.css";

function Info({ content, label }: { content: string; label: string }) {
  return <PopoverPrimitive.Root><PopoverPrimitive.Trigger asChild><button type="button" className="personal-info-button" aria-label={label} onClick={e => e.stopPropagation()}><CircleHelp size={14} /></button></PopoverPrimitive.Trigger><PopoverPrimitive.Portal><PopoverPrimitive.Content className="personal-info-popover" sideOffset={8} collisionPadding={14} onClick={e => e.stopPropagation()}><div><strong>{label.replace(/ erklären$/, "")}</strong><PopoverPrimitive.Close asChild><button type="button" className="icon-button" aria-label="Erklärung schließen"><X size={13} /></button></PopoverPrimitive.Close></div><p>{content}</p><PopoverPrimitive.Arrow className="personal-info-arrow" /></PopoverPrimitive.Content></PopoverPrimitive.Portal></PopoverPrimitive.Root>;
}
function infoControl(slot: HTMLElement, initial: string, initialLabel: string): MountedControl {
  const root = createRoot(slot); let destroyed = false, content = initial, label = initialLabel;
  const update = (next?: string, nextLabel?: string) => { if (destroyed) return; content = next ?? content; label = nextLabel ?? label; root.render(<Info content={content} label={label} />); };
  update();
  return { update, destroy: () => { if (destroyed) return; destroyed = true; queueMicrotask(() => root.unmount()); } };
}
function selectControl(slot: HTMLElement, select: HTMLSelectElement, label: string): MountedControl {
  const root = createRoot(slot); let destroyed = false;
  const update = () => { if (destroyed) return; root.render(<Select value={select.value} disabled={select.disabled} label={label} options={Array.from(select.options).map(o => ({ value: o.value, label: o.textContent || o.label, disabled: o.disabled }))} onValueChange={value => { select.value = value; select.dispatchEvent(new Event("change", { bubbles: true })); }} />); };
  update(); return { update, destroy: () => { if (destroyed) return; destroyed = true; queueMicrotask(() => root.unmount()); } };
}
function averageControl(slot: HTMLElement, initial: AverageControlModel, onChange: (value: AverageSettings) => void, onExport: () => void): AverageMountedControl {
  const root = createRoot(slot); let destroyed = false;
  const update = (model: AverageControlModel) => { if (!destroyed) root.render(<MovingAverageControl model={model} onChange={onChange} onExport={onExport} />); };
  update(initial); return { update, destroy: () => { if (destroyed) return; destroyed = true; queueMicrotask(() => root.unmount()); } };
}
function thresholdControl(slot: HTMLElement, initial: ThresholdControlModel, onChange: (value: ThresholdSettings) => void) {
  const root = createRoot(slot); let destroyed = false;
  const update = (model: ThresholdControlModel) => { if (!destroyed) root.render(<ThresholdControl model={model} onChange={onChange} />); };
  update(initial); return { update, destroy: () => { if (destroyed) return; destroyed = true; queueMicrotask(() => root.unmount()); } };
}
function thresholdOccupancyControl(slot: HTMLElement, initial: ThresholdOccupancyModel) {
  const root = createRoot(slot); let destroyed = false;
  const update = (model: ThresholdOccupancyModel) => { if (!destroyed) root.render(<ThresholdOccupancySummary model={model} />); };
  update(initial); return { update, destroy: () => { if (destroyed) return; destroyed = true; queueMicrotask(() => root.unmount()); } };
}
export default function PersonalAnalyticsPage({ actorId, revision }: { actorId: string; revision?: number }) {
  const host = useRef<HTMLDivElement>(null), engine = useRef<AnalyticsHandle | null>(null);
  const previousView = useRef<AnalyticsViewSnapshot | undefined>(undefined);
  const [payload, setPayload] = useState<PersonalAnalyticsPayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [mountError, setMountError] = useState("");
  const [earliestMeetingDate, setEarliestMeetingDate] = useState<string | null>(null);
  const noteEarliestMeeting = useCallback((day: string | null) => setEarliestMeetingDate(day && payload?.meta.first_date && day < payload.meta.first_date ? day : null), [payload?.meta.first_date]);
  const [meetingLayout, setMeetingLayout] = useState<{ charts: MeetingChartLayout[]; panel: HTMLElement | null }>({ charts: [], panel: null });
  const refresh = useRef(() => setAttempt(n => n + 1));
  const allowed = canRequestPersonalAnalytics(actorId);
  useEffect(() => {
    if (!allowed) { setPayload(null); return; }
    const controller = new AbortController(); let active = true;
    setLoading(true); setError(""); setMountError("");
    void fetchPersonalAnalytics(controller.signal).then(data => { if (active) setPayload(data); }, failure => {
      if (!active || controller.signal.aborted) return;
      if (failure instanceof PersonalAnalyticsError && [401, 403, 404].includes(failure.status)) setPayload(null);
      setError(failure instanceof Error ? failure.message : "Die Auswertung konnte nicht geladen werden.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [actorId, allowed, revision, attempt]);
  useEffect(() => {
    if (!allowed || !payload || !host.current) return;
    const element = host.current;
    try {
      const mounted = mountPersonalAnalytics(element, payload, { initialView: previousView.current, earliestMeetingDate, snapshotAt: payload.meta.snapshot_at, completedCount: payload.tasks.length, openCount: payload.flow_tasks.filter(t => !t.completed_at).length, archiveFallbackCount: payload.meta.archive_fallback_cards, onRefresh: () => refresh.current(), mountSelect: selectControl, mountInfo: infoControl, mountMovingAverage: averageControl, mountThresholds: thresholdControl, mountThresholdOccupancy: thresholdOccupancyControl, onMeetingCharts: (charts, panel) => setMeetingLayout(previous => previous.panel === panel && previous.charts.length === charts.length && charts.every((chart, i) => Object.entries(chart).every(([key, value]) => previous.charts[i][key as keyof MeetingChartLayout] === value)) ? previous : { charts, panel }) });
      engine.current = mounted;
      return () => { previousView.current = { state: mounted.getState(), overlay: mounted.getOverlayState(), averages: mounted.getAverageState(), thresholds: mounted.getThresholdState?.(), preset: element.querySelector<HTMLButtonElement>('[data-preset].active')?.dataset.preset }; mounted.destroy(); if (engine.current === mounted) engine.current = null; };
    } catch { element.replaceChildren(); setPayload(null); setMountError("Die Darstellung konnte nicht geladen werden. Bitte erneut versuchen."); }
  }, [payload, allowed, earliestMeetingDate]);
  if (!allowed) return <section className="personal-load-state"><h1>Seite nicht gefunden.</h1></section>;
  if (mountError || (!payload && error)) return <section className="personal-load-state" role="alert"><span className="personal-load-icon"><CircleHelp size={24} /></span><h1>Gerade nicht verfügbar.</h1><p>{error || mountError}</p><button type="button" className="secondary" onClick={() => setAttempt(n => n + 1)}><RefreshCw size={14} />Erneut versuchen</button></section>;
  if (!payload) return <PersonalAnalyticsSkeleton />;
  return <section className="personal-analytics-page" aria-label="Persönlicher Fortschritt" aria-busy={loading}>
    {(error || loading) && <div className={`personal-refresh-status${error ? " is-error" : ""}`} role="status">{loading ? <><LoaderCircle size={12} className="spin" />Daten werden aktualisiert</> : <>{error}<button type="button" onClick={() => setAttempt(n => n + 1)}>Erneut versuchen</button></>}</div>}
    <div ref={host} className="personal-productivity" data-personal-analytics-root />
    <MeetingContext actorId={actorId} revision={revision} refresh={attempt} layouts={meetingLayout.charts} panel={meetingLayout.panel} onEarliestDate={noteEarliestMeeting} />
  </section>;
}
