import { describe, expect, it } from 'vitest';
import { thresholdOccupancy } from './threshold-occupancy.js';
import { extendOverlayWithAverages } from './moving-averages.js';
import { thresholdForLine } from './overlay-thresholds.js';

const line = { key: 'x', axis: 0 };
const fixture = (values, extra = {}) => ({ grain: 'day', rows: values.map((value, i) => ({ day: `2026-10-${String(i + 1).padStart(2, '0')}`, plot: { x: value } })), ...extra });
describe('time on each side of the displayed threshold', () => {
  it('splits crossings by time, rather than counting endpoints or averaging heights', () => {
    const result = thresholdOccupancy(fixture([0, 4, 4]), line, 1);
    expect(result.total).toBe(2); expect(result.percentages).toEqual({ above: 87.5, below: 12.5, equal: 0 });
    expect(result.segments).toBe(2);
  });
  it('is symmetric on reversal, includes real zero values and supports negative thresholds', () => {
    expect(thresholdOccupancy(fixture([4, 4, 0]), line, 1).percentages.above).toBe(87.5);
    expect(thresholdOccupancy(fixture([-4, 0]), line, -1).percentages).toEqual({ above: 25, below: 75, equal: 0 });
    expect(thresholdOccupancy(fixture([0, 0]), line, 0).percentages).toEqual({ above: 0, below: 0, equal: 100 });
  });
  it('distinguishes staying on the boundary from touching it at an instant', () => {
    const same = thresholdOccupancy(fixture([1, 1, 2, 1]), line, 1).percentages;
    expect(same.above).toBeCloseTo(200 / 3); expect(same.equal).toBeCloseTo(100 / 3); expect(same.below).toBe(0);
    expect(thresholdOccupancy(fixture([0, 1, 0]), line, 1).percentages).toEqual({ above: 0, below: 100, equal: 0 });
  });
  it('excludes missing, nonfinite, partial and omitted dates without joining gaps', () => {
    const model = fixture([0, 2, null, 8, 8, NaN, undefined, Infinity]);
    const result = thresholdOccupancy(model, line, 1);
    expect(result.percentages).toEqual({ above: 75, below: 25, equal: 0 }); expect(result.total).toBe(2); expect(result.excludedPoints).toBe(4);
    expect(thresholdOccupancy(fixture([8, 8], { rows: [model.rows[0], model.rows[3]] }), line, 1).percentages).toBeNull();
    model.rows[4].partial = true;
    expect(thresholdOccupancy(model, line, 1).total).toBe(1);
  });
  it('requires connected support for lines; zero valid time is undefined', () => {
    for (const values of [[], [0], [null], [0, null, 2]]) expect(thresholdOccupancy(fixture(values), line, 0).percentages).toBeNull();
    expect(thresholdOccupancy(fixture([0, 2]), line, Infinity).percentages).toBeNull();
  });
  it('weights weekly segments by calendar span and omits partial KW', () => {
    const rows = ['2026-10-04', '2026-10-11', '2026-10-18', '2026-10-25', '2026-10-29'].map((day, i) => ({ day, week: ['2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26'][i], partial: i === 4, plot: { x: [0, 4, null, 3, 10][i] } }));
    const result = thresholdOccupancy({ grain: 'week', rows }, line, 1);
    expect(result.total).toBe(7); expect(result.percentages).toEqual({ above: 75, below: 25, equal: 0 });
  });
  it('keeps Vienna calendar weighting through the DST change', () => {
    const model = fixture([], { rows: ['2026-10-24', '2026-10-25', '2026-10-26'].map((day, i) => ({ day, plot: { x: i } })) });
    expect(thresholdOccupancy(model, line, 1).percentages).toEqual({ above: 50, below: 50, equal: 0 });
  });
  it('keeps separate native axes and ignores manual Y zoom', () => {
    const model = fixture([0, 4, 4], { axes: [{ side: 'left', family: 'hours', min: 2, max: 3 }, { side: 'right', family: 'week' }], lines: [line, { key: 'y', axis: 1 }] });
    model.rows.forEach(row => { row.plot.y = 10; });
    const state = { rules: { 'left:hours': { value: 1, sources: ['*'] }, 'right:week': { value: 12, sources: ['*'] } } };
    for (const source of model.lines) {
      const rule = thresholdForLine(model, state, source);
      expect(thresholdOccupancy(model, source, rule.value).percentages.above).toBe(source.key === 'x' ? 87.5 : 0);
    }
  });
  it('uses plot units for normalized series and the parent domain for moving averages', () => {
    const model = fixture([0, 50, 100], { normalized: true, axes: [{ side: 'left', family: 'normalized' }], lines: [{ ...line, label: 'x', min: 100, max: 200 }], rows: [100, 150, 200].map((value, i) => ({ day: `2026-10-0${i + 1}`, values: { x: value }, plot: { x: i * 50 } })) });
    const extended = extendOverlayWithAverages(model, { sources: ['*'], periods: [2] }, 'day');
    const shares = thresholdOccupancy(extended, extended.lines[1], 50).percentages;
    expect(shares.above).toBeCloseTo(50); expect(shares.below).toBeCloseTo(50); expect(shares.equal).toBe(0);
    expect(extended.rows[1].plot['ma:x:2']).toBe(25);
  });
  it('calls discrete point results observation shares, keeps isolated values and omits partial values', () => {
    const model = fixture([0, null, 1, 2, 2]); model.rows[4].partial = true;
    const result = thresholdOccupancy(model, { ...line, render: 'points' }, 1);
    expect(result.kind).toBe('observations'); expect(result.total).toBe(3);
    for (const value of Object.values(result.percentages)) expect(value).toBeCloseTo(100 / 3);
  });
  it('does not mutate the data or overflow crossings between large finite values', () => {
    const model = fixture([-1e308, 1e308]), before = structuredClone(model);
    expect(thresholdOccupancy(model, line, 0).percentages).toEqual({ above: 50, below: 50, equal: 0 });
    expect(model).toEqual(before);
  });
});
