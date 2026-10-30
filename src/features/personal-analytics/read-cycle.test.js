import { describe, expect, it } from 'vitest';
import { readCycleSeries, weightedReadCycleWeek, datasetReference, readCycleCSV, readCycleMeaning, selectReadCycleMetrics, restoreReadCycleSelection } from './read-cycle.js';
import { cleanThresholdState, resolvedThresholdRule, thresholdForLine, thresholdBackground } from './overlay-thresholds.js';
const task = (id, day, hours, status = 'valid') => ({ id, output_date: day, read_to_finish_hours: hours, read_to_finish_status: status });
const settings = { from: '2026-09-01', through: '2026-10-01', historyStart: '2026-05-01', snapshotDay: '2026-10-01', firstFullDay: '2026-09-01' };
const tasks = [task('long', '2026-09-02', 100), ...Array.from({ length: 9 }, (_, i) => task('short' + i, '2026-09-03', 2)), task('bad', '2026-09-03', 9999, 'imported-review'), task('unread', '2026-09-03', null, 'missing-review')];
const rows = readCycleSeries(tasks, settings);
const line = { key: 'readCycle28', axis: 0, unit: 'Kalenderstunden / Task', min: 0, max: 100 };
const model = { normalized: false, axes: [{ side: 'left', family: 'hours' }], lines: [line], dailyRows: rows.filter(r => r.day < '2026-10-01').map(r => ({ day: r.day, values: r })), rows: [] };
describe('duration trend with optional daily details', () => {
  it('replaces legacy scatter selection with the existing 28-day trend without dropping other metrics', () => {
    expect(restoreReadCycleSelection(['readCycleDaily', 'pace28', 'open'], undefined)).toEqual(['readCycle28', 'pace28', 'open']);
    expect(restoreReadCycleSelection(['readCycle28', 'readCycleDaily', 'pace28'], 1)).toEqual(['readCycle28', 'pace28']);
  });
  it('preserves explicitly enabled detail observations in current snapshots', () => {
    expect(restoreReadCycleSelection(['readCycle28', 'readCycleDaily', 'pace28'], 2)).toEqual(['readCycle28', 'readCycleDaily', 'pace28']);
  });
  it('adds the trend when enabling detail points, while respecting removal of the trend', () => {
    expect(selectReadCycleMetrics(['pace28', 'readCycleDaily'], 'readCycleDaily')).toEqual(['pace28', 'readCycle28', 'readCycleDaily']);
    expect(selectReadCycleMetrics(['pace28', 'readCycleDaily', 'open'], 'readCycle28')).toEqual(['pace28', 'open']);
  });
  it('keeps empty and unrelated selections independent of duration metrics', () => {
    expect(restoreReadCycleSelection([], undefined)).toEqual([]);
    expect(selectReadCycleMetrics(['open', 'open', 'count'])).toEqual(['open', 'count']);
  });
});
describe('calendar read-to-finish metrics', () => {
  it('weights every task once, rather than averaging high-volume and low-volume days equally', () => {
    const last = rows.find(r => r.day === '2026-09-28');
    expect(last.readCycle28).toBe(11.8); expect(last.readCycle28N).toBe(10); expect(last.readCycle28Total).toBe(12); expect(last.readCycle28Hours).toBe(118);
  });
  it('does not count imported, missing, nonfinite or negative values and deduplicates task IDs', () => {
    const result = readCycleSeries([...tasks, tasks[0], task('invalid', '2026-09-03', NaN), task('negative', '2026-09-03', -2)], settings);
    expect(result.find(r => r.day === '2026-09-28').readCycle28N).toBe(10);
  });
  it('retains zero-hour genuine tasks but leaves no-completion days empty', () => {
    const result = readCycleSeries([task('zero', '2026-09-01', 0)], settings);
    expect(result[0].readCycleDaily).toBe(0); expect(result[1].readCycleDaily).toBeNull();
  });
  it('requires a full native 28-day window, omits today and respects a later comparison boundary', () => {
    expect(rows[26].readCycle28).toBeNull(); expect(rows[27].readCycle28).toBe(11.8); expect(rows.at(-1).readCycleDaily).toBeNull();
    expect(readCycleSeries(tasks, { ...settings, historyStart: '2026-09-15' }).every(r => r.readCycle28 === null)).toBe(true);
  });
  it('keeps weighted weekly means and last-day rolling windows separate', () => {
    const values = { readCycle28: 123 };
    weightedReadCycleWeek(rows.slice(0, 7).map(values => ({ values })), values);
    expect(values.readCycleDaily).toBe(11.8); expect(values.readCycleDayN).toBe(10); expect(values.readCycle28).toBe(123);
    expect(readCycleCSV({ key: 'readCycleDaily' }, { values })).toEqual([10, 118, 12]);
  });
  it('older payloads do not invent a 28-day history', () => {
    expect(readCycleSeries([], { ...settings, firstFullDay: null }).every(r => r.readCycle28 === null)).toBe(true);
  });
  it('distinguishes days without completions, invalid pairs and genuine zero-hour values', () => {
    const base = { day: '2026-09-03', values: { readCycleDaily: null, readCycleDayN: 0, readCycleDayTotal: 0, readCycleDayHours: 0 } };
    expect(readCycleMeaning({ key: 'readCycleDaily' }, base, 'day')).toMatch(/Keine Abschlüsse/);
    expect(readCycleMeaning({ key: 'readCycleDaily' }, { ...base, values: { ...base.values, readCycleDayTotal: 2 } }, 'day')).toMatch(/2 Abschlüsse, aber kein gültiges/);
    const zero = readCycleMeaning({ key: 'readCycleDaily' }, { ...base, values: { ...base.values, readCycleDaily: 0, readCycleDayN: 1, readCycleDayTotal: 1 } }, 'day');
    expect(zero).toMatch(/0 Kalenderstunden ÷ 1/); expect(zero).not.toMatch(/kein.*durchschnitt/);
    expect(readCycleMeaning({ key: 'readCycle28' }, { day: '2026-09-03', values: { readCycle28N: null } }, 'day')).toMatch(/Noch kein vollständig beobachtetes/);
  });
});
describe('dataset-derived threshold references', () => {
  it('uses the actual last 28 days and pools task durations instead of averaging overlapping means', () => {
    const reference = datasetReference(model, line);
    // On 30 September, 2 September is outside the latest 28 days.
    expect(reference.original).toBe(2); expect(reference.n).toBe(9); expect(reference.total).toBe(11); expect(reference.start).toBe('2026-09-03');
    expect(datasetReference(model, line, 'visible').original).toBe(11.8);
  });
  it('keeps missing values missing and real zero interval values in general series averages', () => {
    const l = { key: 'open', axis: 0, min: 0, max: 10, unit: 'Tasks' };
    const m = { ...model, lines: [l], dailyRows: undefined, rows: [{ day: '2026-09-27', values: { open: 0 } }, { day: '2026-09-28', values: { open: null } }, { day: '2026-09-29', values: { open: 10 } }, { day: '2026-09-30', partial: true, values: { open: 500 } }] };
    expect(datasetReference(m, l).original).toBe(5); expect(datasetReference(m, l).n).toBe(2);
    expect(datasetReference({ ...m, rows: [] }, l)).toBeNull();
  });
  it('maps an average using the selected series original domain, including parent domains for MAs', () => {
    expect(datasetReference({ ...model, normalized: true }, { ...line, min: 0, max: 4 }).value).toBe(50);
    const l = { key: 'ma:open:3', axis: 0, min: 3, max: 7, normalizationMin: 0, normalizationMax: 20, unit: 'Tasks' };
    const m = { ...model, normalized: true, dailyRows: undefined, rows: [{ day: '2026-09-29', values: { [l.key]: 3 } }, { day: '2026-09-30', values: { [l.key]: 7 } }] };
    expect(datasetReference(m, l).value).toBe(25);
    expect(datasetReference(m, { ...l, normalizationMin: 4, normalizationMax: 4 }).value).toBe(50);
  });
  it('recomputes the reference after filtering and never reuses a stale number when its source disappears', () => {
    const state = cleanThresholdState({ rules: { 'left:hours': { value: 999, sources: ['*'], reference: { source: line.key, period: '28d' } } }, backgroundKey: 'left:hours' });
    expect(resolvedThresholdRule(model, state, 'left:hours').value).toBe(2);
    const filtered = { ...model, dailyRows: model.dailyRows.map(row => ({ ...row, values: { ...row.values, readCycleDayHours: (row.values.readCycleDayHours || 0) * 3 } })) };
    expect(resolvedThresholdRule(filtered, state, 'left:hours').value).toBe(6);
    expect(thresholdForLine({ ...model, lines: [] }, state, line)).toBeNull();
    expect(thresholdBackground({ ...model, lines: [] }, state)).toBeNull();
    expect(thresholdForLine({ ...model, axes: [{ side: 'left', family: 'week' }] }, state, line)).toBeNull();
  });
  it('rejects malformed automatic rules instead of treating them as manual values', () => {
    expect(cleanThresholdState({ rules: { 'left:hours': { value: 4, sources: ['*'], reference: { source: line.key, period: 'invalid' } } } }).rules).toEqual({});
  });
  it('uses common-date boundaries for visible-period references and disables unplottable sources', () => {
    const m = { ...model, common: true, rows: [{ day: '2026-09-03', values: {} }, { day: '2026-09-29', values: {} }] };
    const r = datasetReference(m, line, 'visible'); expect(r.start).toBe('2026-09-03'); expect(r.end).toBe('2026-09-29'); expect(r.original).toBe(2);
    expect(datasetReference(model, { ...line, min: null, max: null }, 'visible')).toBeNull();
  });
});
