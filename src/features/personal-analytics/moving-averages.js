// Windows count displayed intervals, never just the non-missing observations.
export const MAX_AVERAGE_TICKS = 10000;
export function tickOrdinal(day, grain = 'day') {
  if (grain === 'month') return Number(day.slice(0, 4)) * 12 + Number(day.slice(5, 7)) - 1;
  const days = Math.floor(Date.parse(day.slice(0, 10) + 'T00:00:00Z') / 86400000);
  return grain === 'week' ? Math.floor((days + 3) / 7) : days;
}
export function movingAverage(rows, value, period, ordinal, complete = row => !row.partial) {
  if (!Number.isInteger(period) || period < 1 || period > MAX_AVERAGE_TICKS) throw new RangeError('Ungültiges Tick-Fenster');
  let sum = 0, invalid = 0, runStart = 0;
  const values = rows.map(row => complete(row) && Number.isFinite(value(row)) ? value(row) : null);
  return rows.map((row, index) => {
    if (index && ordinal(row) !== ordinal(rows[index - 1]) + 1) { sum = 0; invalid = 0; runStart = index; }
    if (values[index] === null) invalid++; else sum += values[index];
    if (index - runStart >= period) { const old = values[index - period]; if (old === null) invalid--; else sum -= old; }
    return index - runStart + 1 >= period && !invalid ? sum / period : null;
  });
}
export function cleanAverageSettings(input, defaults = {}) {
  const periods = Array.isArray(input?.periods) ? [...new Set(input.periods.filter(n => Number.isInteger(n) && n >= 1 && n <= MAX_AVERAGE_TICKS))].sort((a, b) => a - b).slice(0, 8) : [];
  const sources = Array.isArray(input?.sources) ? [...new Set(input.sources.filter(k => typeof k === 'string'))] : defaults.sources ?? ['*'];
  return { periods, sources, grain: input?.grain === 'week' ? 'week' : 'day' };
}
export function averageColumns(rows, sources, settings, grain) {
  const selected = settings.sources.includes('*') ? sources : sources.filter(source => settings.sources.includes(source.key));
  return selected.flatMap(source => settings.periods.map((period, index) => ({
    ...source, baseKey: source.key, key: 'ma:' + source.key + ':' + period, period, grain,
    label: source.label + ' · Ø ' + period + ' Ticks', dash: ['6 3', '2 3', '10 3 2 3', '9 5'][index % 4],
    values: movingAverage(rows, row => source.value ? source.value(row) : row[source.key], period, row => tickOrdinal(grain === 'week' ? row.week || row.day : row.day, grain)),
  })));
}
// An average shares the ORIGINAL source's normalization domain and axis.
export function extendOverlayWithAverages(model, settings, grain) {
  const columns = averageColumns(model.rows, model.lines.map(line => ({ ...line, value: row => row.values[line.key] })), settings, grain);
  const rows = model.rows.map(row => ({ ...row, values: { ...row.values }, plot: { ...row.plot } }));
  const lines = columns.map(column => {
    const parent = model.lines.find(line => line.key === column.baseKey), finite = column.values.filter(Number.isFinite);
    rows.forEach((row, index) => {
      const value = column.values[index]; row.values[column.key] = value;
      row.plot[column.key] = value === null ? null : model.normalized ? parent.max === parent.min ? 50 : 100 * (value - parent.min) / (parent.max - parent.min) : value;
    });
    const { value: _value, values: _values, ...line } = column;
    return { ...line, min: finite.length ? Math.min(...finite) : null, max: finite.length ? Math.max(...finite) : null, constant: finite.length > 0 && finite.every(v => v === finite[0]), description: 'Arithmetisches Mittel der letzten ' + column.period + ' vollständigen dargestellten Intervalle von „' + parent.label + '“. Prozentwerte werden ungewichtet gemittelt. In der Normierung gilt dieselbe Spannweite wie für die Basislinie.' };
  });
  return { ...model, rows, lines: [...model.lines, ...lines] };
}
