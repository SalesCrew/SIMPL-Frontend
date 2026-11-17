import { describe, expect, it } from 'vitest';
import { progressSeries, flowSeries, deepAnalysis, shift, viennaStartMs } from './calendar-series.js';

const today = '2026-11-17', yesterday = shift(today, -1), historyStart = '2026-08-01';
const completed = [
  { id: 'older', output_date: shift(today, -28) },
  { id: 'yesterday', output_date: yesterday },
  { id: 'today-a', output_date: today }, { id: 'today-b', output_date: today },
];
describe('live current-day analytics', () => {
  it('counts today in the fixed 14/28-day windows while preserving yesterday and marking today partial', () => {
    const rows = progressSeries(completed, yesterday, today, historyStart, today);
    expect(rows[0]).toMatchObject({ count: 1, count28: 2, pace28: .5, partial: false });
    expect(rows[1]).toMatchObject({ count: 2, count28: 3, pace28: .75, mean14: 3 / 14, previous28: 1, phaseChange: 200, partial: true });
    const updated = progressSeries([...completed, { id: 'today-c', output_date: today }], yesterday, today, historyStart, today);
    expect(updated[0]).toEqual(rows[0]);
    expect(updated[1]).toMatchObject({ count: 3, count28: 4, pace28: 1 });
  });
  it('does not invent missing history or a percentage with a zero baseline', () => {
    const row = progressSeries(completed, today, today, yesterday, today)[0];
    expect(row.count).toBe(2); expect(row.pace28).toBeNull(); expect(row.phaseChange).toBeNull();
    expect(progressSeries([], today, today, historyStart, today)[0]).toMatchObject({ count28: 0, previous28: 0, phaseChange: null, phaseReason: 'zero-baseline' });
  });
  it('updates incoming/finished counts and never divides by zero intake', () => {
    const tasks = [{ created_date: today, done_date: today }, { created_date: yesterday, done_date: null }];
    expect(flowSeries(tasks, today, today, historyStart, today)[0]).toMatchObject({ incomingDaily: 1, incoming28: 2, finished28: 1, flowRatio: 50, backlogDelta28: 1 });
    expect(flowSeries([], today, today, historyStart, today)[0]).toMatchObject({ incoming28: 0, finished28: 0, flowRatio: null, flowReason: 'zero-intake' });
  });
  it('shows the current backlog and keeps unfinished observation cohorts empty', () => {
    const snapshot = Date.parse('2026-11-17T10:00:00Z');
    const tasks = [
      { created_date: yesterday, created_ms: Date.parse(yesterday+'T08:00:00Z'), done_date: today, done_ms: snapshot-1000 },
      { created_date: today, created_ms: snapshot-1000, done_date: null, done_ms: null },
      // Seven calendar days old, but its full seven elapsed days end after this snapshot.
      { created_date: shift(today,-7), created_ms: Date.parse(shift(today,-7)+'T20:00:00Z'), done_date: null, done_ms: null },
    ];
    const result = deepAnalysis(tasks, completed, [], yesterday, today, historyStart, today, snapshot);
    expect(result.rows[0]).toMatchObject({ open: 2, partial: false });
    expect(result.rows[1]).toMatchObject({ open: 2, partial: true, cohort7: null });
  });
  it('keeps the ongoing Sunday out of full-week reference statistics', () => {
    const sunday='2026-11-22', monday='2026-11-16';
    const tasks=[{id:'current',output_date:sunday}];
    const result=deepAnalysis([],tasks,[monday],sunday,sunday,historyStart,sunday,Date.parse(sunday+'T12:00:00Z'));
    expect(result.fullWeeks).toEqual([]); expect(result.rows[0].median8).toBe(0);
  });
  it('uses Vienna dates across winter midnight and daylight-saving changes', () => {
    expect(new Date(viennaStartMs('2026-11-17')).toISOString()).toBe('2026-11-16T23:00:00.000Z');
    expect(viennaStartMs('2026-03-30')-viennaStartMs('2026-03-29')).toBe(23*3_600_000);
    expect(viennaStartMs('2026-10-26')-viennaStartMs('2026-10-25')).toBe(25*3_600_000);
    const before=progressSeries(completed,today,today,historyStart,today)[0];
    const after=progressSeries(completed,today,shift(today,1),historyStart,shift(today,1));
    expect(after[0]).toEqual({...before,partial:false});
    expect(after[1]).toMatchObject({count:0,partial:true});
  });
});
