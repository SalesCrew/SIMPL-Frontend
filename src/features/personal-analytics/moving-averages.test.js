import { describe, expect, it } from "vitest";
import { averageColumns, cleanAverageSettings, extendOverlayWithAverages, movingAverage, tickOrdinal } from "./moving-averages.js";

const mean = (rows, period, grain = "day") => movingAverage(rows, (row) => row.value, period, (row) => tickOrdinal(row.day, grain));
describe("displayed tick moving averages", () => {
  it("includes true zeroes, signed values and only full windows", () => {
    expect(mean([{ day: "2026-10-01", value: 0 }, { day: "2026-10-02", value: 4 }, { day: "2026-10-03", value: -2 }], 2)).toEqual([null, 2, 1]);
  });
  it("does not replace missing or incomplete values by zero or skip them", () => {
    const rows = Array.from({ length: 6 }, (_, i) => ({ day: `2026-10-0${i + 1}`, value: i === 1 ? null : i, partial: i === 5 }));
    expect(mean(rows, 2)).toEqual([null, null, null, 2.5, 3.5, null]);
  });
  it("does not bridge missing ticks, even when there are enough observations", () => {
    expect(mean([{ day: "2026-10-01", value: 1 }, { day: "2026-10-03", value: 3 }, { day: "2026-10-04", value: 5 }], 2)).toEqual([null, null, 4]);
  });
  it("counts weeks as weeks across the year and months as months", () => {
    expect(mean([{ day: "2026-12-28", value: 2 }, { day: "2027-01-04", value: 10 }, { day: "2027-01-11", value: 0 }], 2, "week")).toEqual([null, 6, 5]);
    expect(mean([{ day: "2026-11-01", value: 4 }, { day: "2026-12-01", value: 8 }, { day: "2027-01-01", value: 12 }], 2, "month")).toEqual([null, 6, 10]);
  });
  it("rejects invalid windows and deduplicates saved preferences", () => {
    for (const n of [0, -1, 1.5, NaN, Infinity, 10001]) expect(() => mean([], n)).toThrow(RangeError);
    expect(cleanAverageSettings({ periods: [7, 2, 7, -1, 0, 3.5], sources: ["count", "count"] })).toEqual({ periods: [2, 7], sources: ["count"], grain: "day" });
    expect(mean([{ day: "2026-10-01", value: 10 }], 10)).toEqual([null]);
  });
  it("keeps each period and basis independent", () => {
    const rows = [{ day: "2026-10-01", a: 0, b: 10 }, { day: "2026-10-02", a: 4, b: 20 }, { day: "2026-10-03", a: 2, b: 30 }];
    const columns = averageColumns(rows, [{ key: "a", label: "A" }, { key: "b", label: "B" }], { periods: [2, 3], sources: ["a"] }, "day");
    expect(columns.map((column) => column.values)).toEqual([[null, 2, 3], [null, null, 2]]);
    expect(rows[0]).not.toHaveProperty("ma:a:2");
  });
  it("normalizes the average using its parent's domain, retains raw units and axes", () => {
    const line = { key: "a", label: "A", min: 0, max: 10, axis: 1, color: "green", family: "count", unit: "Tasks" };
    const model = { normalized: true, lines: [line], rows: [0, 10, 0].map((a, i) => ({ day: `2026-10-0${i + 1}`, values: { a }, plot: { a: a * 10 } })), axes: [{ min: 0, max: 100 }], selected: ["a"] };
    const result = extendOverlayWithAverages(model, { periods: [2], sources: ["*"] }, "day");
    expect(result.rows.map((row) => row.plot["ma:a:2"])).toEqual([null, 50, 50]);
    expect(result.rows[1].values["ma:a:2"]).toBe(5);
    expect(result.lines[1]).toMatchObject({ axis: 1, family: "count", unit: "Tasks" });
    expect(model.lines).toHaveLength(1); expect(model.rows[1].values).toEqual({ a: 10 });
  });
  it("excludes partial weekly counts and preserves missing weekly ticks", () => {
    const model = { normalized: false, lines: [{ key: "a", label: "A", min: 0, max: 10, axis: 0 }], rows: [{ day: "2026-10-04", week: "2026-09-28", partial: true, values: { a: 2 }, plot: { a: 2 } }, { day: "2026-10-11", week: "2026-10-05", values: { a: 10 }, plot: { a: 10 } }, { day: "2026-10-18", week: "2026-10-12", values: { a: 0 }, plot: { a: 0 } }] };
    expect(extendOverlayWithAverages(model, { periods: [2], sources: ["*"] }, "week").rows.map((row) => row.values["ma:a:2"])).toEqual([null, null, 5]);
  });
});
