// Plot coordinates come from the chart's existing scales. Meetings never add metric values.
const plots = new WeakMap();
export function recordMeetingPlot(svg, frame, rows, series, grain = 'day', append = false) {
  const old = append ? plots.get(svg) : null;
  const values = series.map(line => ({
    key: line.key, label: line.label || line.key, color: line.color,
    points: rows.flatMap((row, index) => {
      const value = line.value(row, index);
      if (!Number.isFinite(value)) return [];
      const point = { day: row.day, week: row.week, x: frame.x(index), y: frame.y(value, line), value };
      return point.y >= frame.top - .01 && point.y <= frame.height - frame.bottom + .01 ? [point] : [];
    }),
  }));
  plots.set(svg, { svg, grain, width: frame.width, height: frame.height, series: [...old?.series || [], ...values].filter(line => line.points.length) });
}
export function meetingPlot(svg) { return svg ? plots.get(svg) || null : null; }
