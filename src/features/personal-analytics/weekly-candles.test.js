import { describe, expect, it } from 'vitest';
import { weeklyCompletionCandles } from './weekly-candles.js';
import { deepAnalysis, shift } from './calendar-series.js';

const tasksOn = (day, count) => Array.from({ length: count }, () => ({ output_date: day }));
describe('weekly completion candlesticks', () => {
  it('uses real trailing seven-day observations for open, high, low and close', () => {
    const completed = [...tasksOn('2026-11-04', 8), ...tasksOn('2026-11-09', 2), ...tasksOn('2026-11-11', 5), ...tasksOn('2026-11-12', 3)];
    const [candle] = weeklyCompletionCandles([{ week: '2026-11-09', count: 10 }], completed, '2026-11-01');
    // Daily rolling totals: 10, 10, 7, 10, 10, 10, 10.
    expect(candle).toMatchObject({ open: 10, high: 10, low: 7, close: 10, count: 10, partialOpen: false, openDay: '2026-11-09' });
  });
  it('preserves full-week counts, null weeks and existing distribution statistics', () => {
    const weeks = ['2026-10-26', '2026-11-02', '2026-11-09'];
    const completed = [...tasksOn('2026-10-26', 2), ...tasksOn('2026-10-30', 8), ...tasksOn('2026-11-13', 5)];
    const deep = deepAnalysis([], completed, weeks, weeks[0], '2026-11-15', '2026-10-20', '2026-11-20');
    const original = structuredClone(deep), candles = weeklyCompletionCandles(deep.fullWeeks, completed, '2026-10-20');
    expect(candles.map(c => c.close)).toEqual([10, 0, 5]);
    expect(candles.every(c => c.close === c.count && c.low <= Math.min(c.open, c.close) && c.high >= Math.max(c.open, c.close))).toBe(true);
    expect(deep).toEqual(original);
  });
  it('uses prior-filter history for the same candle when narrowing the date selection', () => {
    const completed = [...tasksOn('2026-11-06', 9), ...tasksOn('2026-11-10', 2)];
    const weeks = [{ week: '2026-11-02', count: 9 }, { week: '2026-11-09', count: 2 }];
    const full = weeklyCompletionCandles(weeks, completed, '2026-10-01');
    expect(weeklyCompletionCandles(weeks.slice(1), completed, '2026-10-01')[0]).toEqual(full[1]);
    expect(full[1]).toMatchObject({ open: 9, high: 11, low: 2, close: 2 });
  });
  it('never turns missing early history into a zero opening value', () => {
    const completed = tasksOn('2026-05-25', 3);
    expect(weeklyCompletionCandles([{ week: '2026-05-25', count: 3 }], completed, '2026-05-20')[0]).toMatchObject({ openDay: '2026-05-26', partialOpen: true, open: 3, close: 3 });
    expect(weeklyCompletionCandles([], [], '2026-05-20')).toEqual([]);
  });
  it('uses seven calendar dates across the daylight-saving boundary', () => {
    const week = '2026-10-19', completed = [...tasksOn(shift(week, -2), 4), ...tasksOn(shift(week, 6), 7)];
    expect(weeklyCompletionCandles([{ week, count: 7 }], completed, '2026-10-01')[0]).toMatchObject({ open: 4, low: 0, high: 7, close: 7 });
  });
});
