import { shift } from './calendar-series.js';

// OHLC of the trailing seven-calendar-day completion total, observed once per day.
// Sunday's close is exactly the existing full calendar week's completed-task count.
export function weeklyCompletionCandles(fullWeeks, completed, historyStart) {
  const daily = new Map();
  for (const task of completed) daily.set(task.output_date, (daily.get(task.output_date) || 0) + 1);
  return fullWeeks.map(row => {
    const observations = [];
    for (let i = 0; i < 7; i++) {
      const day = shift(row.week, i), first = shift(day, -6);
      if (first < historyStart) continue;
      let count = 0;
      for (let j = 0; j < 7; j++) count += daily.get(shift(first, j)) || 0;
      observations.push({ day, count });
    }
    if (!observations.length) return null;
    const open = observations[0].count, close = observations.at(-1).count;
    return { ...row, open, close, high: Math.max(...observations.map(p => p.count)), low: Math.min(...observations.map(p => p.count)), openDay: observations[0].day, partialOpen: observations.length < 7 };
  }).filter(Boolean);
}
