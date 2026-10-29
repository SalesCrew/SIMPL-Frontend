export interface AnalyticsTask {
  id: string;
  title: string;
  project: string;
  created_at: string;
  completed_at: string | null;
  original_completed_at?: string | null;
  archived_at?: string | null;
  deleted_at?: string | null;
  labels: string[];
  label_ids?: string[];
  created_date?: string | null;
  created_local?: string | null;
  finished_local?: string | null;
  archive_date?: string | null;
  completion_source?: "completed" | "archive-fallback" | null;
  duration_hours?: number | null;
}
export interface AnalyticsMeta {
  workspace: string;
  snapshot_at: string;
  snapshot_vienna: string;
  first_date: string;
  last_date: string;
  total_cards?: number;
  closed_cards?: number;
  open_cards?: number;
  archive_fallback_cards?: number;
}
export interface PersonalAnalyticsPayload {
  label_catalog?: { id: string; name: string; color?: string; primary: boolean }[];
  project_catalog?: { id: string; name: string; color?: string }[];
  meta: AnalyticsMeta;
  flow_meta: AnalyticsMeta;
  tasks: AnalyticsTask[];
  flow_tasks: AnalyticsTask[];
  coverage: { start_date: string; source: string; confirmed_complete: boolean; note?: string };
}
export interface MountedControl {
  update: (content?: string, label?: string) => void;
  destroy: () => void;
}
export interface AverageSettings { periods: number[]; sources: string[]; grain: "day" | "week" }
export interface AverageControlModel { id: string; title: string; grain: "day" | "week" | "month"; adjustableGrain?: boolean; note: string; sources: { key: string; label: string }[]; settings: AverageSettings }
export interface AverageMountedControl { update: (model: AverageControlModel) => void; destroy: () => void }
export interface AnalyticsViewSnapshot { state: Record<string, unknown>; overlay: Record<string, unknown>; averages?: Record<string, AverageSettings>; preset?: string | null; thresholds?: ThresholdSettings }
export interface AnalyticsMountOptions {
  initialView?: AnalyticsViewSnapshot;
  earliestMeetingDate?: string | null;
  snapshotAt: string;
  completedCount: number;
  openCount: number;
  archiveFallbackCount?: number;
  onRefresh: () => void;
  onMeetingCharts?: (charts: import("./meetings/types").MeetingChartLayout[], panel: HTMLElement | null) => void;
  mountThresholds: (slot: HTMLElement, model: ThresholdControlModel, onChange: (value: ThresholdSettings) => void) => { update: (model: ThresholdControlModel) => void; destroy: () => void };
  mountSelect: (slot: HTMLElement, select: HTMLSelectElement, label: string) => MountedControl;
  mountInfo: (slot: HTMLElement, content: string, label: string) => MountedControl;
  mountMovingAverage: (slot: HTMLElement, model: AverageControlModel, onChange: (settings: AverageSettings) => void, onExport: () => void) => AverageMountedControl;
}
export interface AnalyticsHandle {
  api: { calc: () => unknown; getRelationships: () => unknown; getState: () => Record<string, unknown>; getOverlayState: () => Record<string, unknown> };
  getState: () => Record<string, unknown>;
  getOverlayState: () => Record<string, unknown>;
  getThresholdState?: () => ThresholdSettings;
  getAverageState: () => Record<string, AverageSettings>;
  summary: () => { total: number };
  destroy: () => void;
}

export interface ThresholdRule { value: number; sources: string[] }
export interface ThresholdSettings { rules: Record<string, ThresholdRule>; backgroundKey: string | null; backgrounds?: { native?: string | null; normalized?: string | null } }
export interface ThresholdControlModel { axes: { key: string; side: string; label: string; unit: string; rule: ThresholdRule | null; lines: { key: string; label: string }[] }[]; settings: ThresholdSettings; activeCount: number; normalized: boolean }
