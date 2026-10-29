import { averageColumns, cleanAverageSettings, extendOverlayWithAverages, tickOrdinal } from './moving-averages.js';

const definitions = {
  'weekly-chart': { title: 'Fortschritt', grain: 'day', note: 'Auch eine Rate in Tasks/Woche hat hier tägliche Beobachtungspunkte. Bei Summe: Durchschnitt des kumulierten Niveaus; bei Prozenten: ungewichtetes Mittel der Prozentwerte.' },
  'daily-chart': { title: 'Tägliche Erledigungen', grain: 'day', defaults: { sources: ['count'] }, note: '„An diesem Tag erledigt“ zählt Fertig-Stempel; der vorhandene 14-Tage-Trend bleibt erhalten.' },
  'backlog-chart': { title: 'Offener Bestand', grain: 'day', defaults: { sources: ['open'] }, note: 'Gemittelt werden Tagesendstände, keine Arbeitsstunden.' },
  'distribution-chart': { title: 'Typische Liefermenge', grain: 'month', note: 'Durchschnitt der Monatsmediane voller KW. Ein Tick ist ein vollständig abgedeckter Monat des KW-Sonntags, keine einzelne KW.' },
  'cohort-chart': { title: 'Eingangskohorten', grain: 'week', note: 'Zusätzlicher Zeitverlauf nach Eingangs-KW. Ungewichtetes Mittel der Wochenquoten; kein zusammengelegter Anteil. Unreife oder teilweise erfasste Kohorten bleiben leer.' },
  'overlay-chart': { title: 'Eigener Kennzahlenvergleich', note: 'Zuerst in Originaleinheiten gemittelt, dann mit der Skala der Basislinie normiert. Prozentwerte werden ungewichtet gemittelt. Zusammenhangsvorschläge verwenden weiterhin nur die Basisdaten.' },
  projects: { title: 'Projektverlauf', adjustableGrain: true, defaults: { sources: ['total'] }, note: 'Zusätzlicher Zeitverlauf der erledigten Tasks. Die Anteile darüber beziehen sich weiterhin auf den gesamten Filterzeitraum.' },
  weekdays: { title: 'Verlauf der Abschluss-Tage', grain: 'week', defaults: { sources: ['total'] }, note: 'Zusätzlicher Zeitverlauf je voller KW. „Montag“ zählt nur die Montag-Abschlüsse der jeweiligen KW. Es wird nicht über die Wochentagskategorien gemittelt.' },
};
const colors = ['#8063a0', '#a86b3c', '#397f99', '#698139', '#b45b76', '#4c668d'];
export function createMovingAverageRuntime({ document, options, lifecycle, helpers: h, getState, getOverlayState, redraw }) {
  const settings = Object.fromEntries(Object.entries(definitions).map(([id, definition]) => [id, cleanAverageSettings(options.initialView?.averages?.[id], definition.defaults)]));
  const controls = new Map(), records = new Map(); let destroyed = false;
  function configure(id, sources, grain) {
    const definition = definitions[id], actualGrain = grain || definition.grain || settings[id].grain;
    const model = { ...definition, id, grain: actualGrain, sources: sources.map(({ key, label }) => ({ key, label })), settings: structuredClone(settings[id]) };
    const holder = document.getElementById(id), panel = holder?.closest('.panel'), head = panel?.querySelector('.panel-head');
    if (head && options.mountMovingAverage) {
      let control = controls.get(id);
      if (!control) {
        const slot = document.createElement('span'); slot.className = 'personal-average-slot'; slot.dataset.averageControl = id; head.append(slot);
        control = options.mountMovingAverage(slot, model, next => { if (destroyed) return; settings[id] = cleanAverageSettings(next, definition.defaults); redraw(); }, () => exportValues(id)); controls.set(id, control);
      } else control.update(model);
    }
    return settings[id];
  }
  function save(id, rows, columns, grain) {
    records.set(id, { rows, columns, grain });
    const panel = document.getElementById(id)?.closest('.panel'); if (!panel) return;
    let legend = panel.querySelector('[data-average-legend="' + id + '"]');
    if (!legend) { legend = h.element('div', 'personal-average-legend'); legend.dataset.averageLegend = id; const anchor = panel.querySelector('[data-average-timeline="' + id + '"]') || document.getElementById(id); anchor.after(legend); }
    legend.replaceChildren(); legend.hidden = !settings[id].periods.length;
    for (const column of columns) { const item = h.element('span'), swatch = h.element('i'); swatch.style.borderTop = '2px dashed ' + column.color; item.append(swatch, document.createTextNode(column.label)); legend.append(item); }
    if (settings[id].periods.length) {
      const label = h.element('small', '', '1 Tick = 1 ' + (grain === 'week' ? 'KW' : grain === 'month' ? 'Monat' : 'Tag') + (columns.some(c => c.values.some(Number.isFinite)) ? '' : ' · Kein vollständiges Fenster für diese Auswahl.')); legend.append(label);
    }
  }
  function compact(s, id, originalLines) {
    const primary = originalLines.at(-1).key, state = getState(), sourceRows = s.dailySeries.filter(row => Number.isFinite(row[primary]));
    const sources = id === 'daily-chart' ? [{ key: 'count', label: 'An diesem Tag erledigt', color: '#8063a0', unit: 'erledigte Tasks / Tag' }, { key: 'mean14', label: 'Erledigt pro Tag · vorhandener 14-Tage-Trend', color: '#a86b3c', unit: 'erledigte Tasks / Tag' }] : originalLines.map(line => ({ ...line, label: primary === 'pace28' ? 'Erledigt pro Woche · 28-Tage-Trend' : primary === 'flowRatio' ? 'Erledigte ÷ neu angelegte Tasks · 28 Tage' : primary === 'phaseChange' ? 'Änderung der Erledigungen · 28 vs. 28 Tage' : 'Erledigte Tasks · Summe im Zeitraum', color: '#8063a0', unit: ['flowRatio', 'phaseChange'].includes(primary) ? '%' : primary === 'pace28' ? 'erledigte Tasks / Woche' : 'erledigte Tasks insgesamt' }));
    configure(id, sources, 'day');
    const rows = sourceRows.map(row => ({ ...row, partial: row.partial || row.day < state.historyStart })), columns = averageColumns(rows, sources, settings[id], 'day');
    save(id, rows, columns, 'day');
    const dailySeries = rows.map((row, index) => ({ ...row, ...Object.fromEntries(columns.map(column => [column.key, column.values[index]])) }));
    return { s: { ...s, dailySeries }, lines: [...columns.map(column => ({ ...column, width: 1.8, opacity: .95 })), ...originalLines] };
  }
  function overlay(model) {
    const grain = getOverlayState().grain, current = configure('overlay-chart', model.lines, grain), extended = extendOverlayWithAverages(model, current, grain);
    save('overlay-chart', extended.rows, extended.lines.filter(line => line.period).map(line => ({ ...line, values: extended.rows.map(row => row.values[line.key]) })), grain);
    return extended;
  }
  function frameLines(f, rows, columns, x, y) {
    const before = f.svg.querySelector('[data-deep-hit]');
    for (const column of columns) {
      let path = '', previous = -2;
      column.values.forEach((value, index) => { if (!Number.isFinite(value)) { previous = -2; return; } const continuous = previous === index - 1 && tickOrdinal(rows[index].day, column.grain) === tickOrdinal(rows[previous].day, column.grain) + 1; path += (continuous ? ' L ' : ' M ') + x(index) + ' ' + y(value); previous = index; });
      if (path) { const line = h.svgEl('path', { d: path, fill: 'none', stroke: column.color, 'stroke-width': 2, 'stroke-dasharray': column.dash, 'stroke-linejoin': 'round', 'pointer-events': 'none', 'data-average-series': column.key }); if (before) f.svg.insertBefore(line, before); else f.svg.append(line); }
      column.values.forEach((value, index) => { if (!Number.isFinite(value) || Number.isFinite(column.values[index - 1]) || Number.isFinite(column.values[index + 1])) return; const dot = h.svgEl('circle', { cx: x(index), cy: y(value), r: 2.5, fill: column.color, 'pointer-events': 'none', 'data-average-point': column.key }); if (before) f.svg.insertBefore(dot, before); else f.svg.append(dot); });
    }
  }
  function backlog(s, f, rows, x, y) {
    const sources = [{ key: 'open', label: 'Noch offen · insgesamt', color: '#8063a0' }, { key: 'open7', label: 'Noch offen · bis 7 Tage', color: '#577a36' }, { key: 'open28', label: 'Noch offen · 8–28 Tage', color: '#397f99' }, { key: 'openOld', label: 'Noch offen · mehr als 28 Tage', color: '#a86b3c' }].map(source => ({ ...source, unit: 'offene Tasks' }));
    configure('backlog-chart', sources, 'day'); const columns = averageColumns(rows, sources, settings['backlog-chart'], 'day'); save('backlog-chart', rows, columns, 'day'); frameLines(f, rows, columns, x, y);
  }
  function distribution(s, f, boxes, x, y) {
    const state = getState(), first = [state.from, state.historyStart].sort().at(-1), end = s.dailySeries.at(-1)?.day, snapshot = h.snapshotDay;
    const rows = boxes.map(box => { const day = box.month + '-01', nextMonth = new Date(Date.UTC(Number(box.month.slice(0, 4)), Number(box.month.slice(5, 7)), 1, 12)).toISOString().slice(0, 10), last = h.shift(nextMonth, -1); return { ...box, day, partial: first > day || !end || end < last || snapshot <= last }; });
    const sources = [{ key: 'median', label: 'Monatsmedian der Erledigungen je voller KW', color: '#8063a0', unit: 'erledigte Tasks / volle KW' }]; configure('distribution-chart', sources, 'month');
    const columns = averageColumns(rows, sources, settings['distribution-chart'], 'month'); save('distribution-chart', rows, columns, 'month'); frameLines(f, rows, columns, x, y);
  }
  function timeline(id, rows, sources, grain) {
    configure(id, sources, grain);
    const holder = document.getElementById(id), panel = holder.closest('.panel'); let chart = panel.querySelector('[data-average-timeline="' + id + '"]');
    if (!chart) { chart = h.element('div', 'personal-average-timeline'); chart.id = id + '-averages'; chart.dataset.averageTimeline = id; (id === 'cohort-chart' ? holder.closest('.cohort-layout') : holder).after(chart); }
    const columns = averageColumns(rows, sources, settings[id], grain); save(id, rows, columns, grain); chart.hidden = !settings[id].periods.length; chart.replaceChildren();
    if (chart.hidden) return;
    const values = columns.flatMap(column => column.values).filter(Number.isFinite); if (!values.length) { chart.append(h.element('p', 'chart-empty', 'Für diese Fenster fehlen vollständige aufeinanderfolgende Ticks. Zeitraum oder Fenster anpassen.')); return; }
    const f = h.deepFrame(chart.id, 210, 53, 18), max = Math.max(1, ...values), y = h.deepAxisY(f, grain === 'week' && id === 'cohort-chart' ? Math.max(100, max) : max, id === 'cohort-chart' ? 'Ø Wochenquote (%)' : grain === 'week' ? 'Ø erledigte Tasks / KW' : 'Ø erledigte Tasks / Tag'), first = h.utc(rows[0].day), span = h.utc(rows.at(-1).day) - first, x = index => f.left + (span ? (h.utc(rows[index].day) - first) / span * f.pw : f.pw / 2);
    f.svg.setAttribute('aria-label', definitions[id].title + ' · gleitende Durchschnitte im Zeitverlauf'); frameLines(f, rows, columns, x, y); h.deepAxisDates(f, rows, x);
    if (grain === 'week') for (const label of f.svg.querySelectorAll('text.axis-text')) if (label.getAttribute('y') === String(f.height - 12)) { const index = rows.findIndex((row, i) => Math.abs(x(i) - Number(label.getAttribute('x'))) < .01); if (index >= 0) label.textContent = h.kw(rows[index].week || rows[index].day); }
    h.deepHover(f, rows, x, row => ({ title: grain === 'week' ? h.weekLabel(row.week || row.day) : h.dayLabel(row.day), lines: describe(id, row.day) }), grain === 'week' ? 7 : 1);
  }
  function cohorts(s) {
    const rows = s.deep.cohorts.map(row => ({ day: row.week, week: row.week, partial: row.partial, ...Object.fromEntries(row.cells.map(cell => ['cohort' + cell.days, cell.rate])) }));
    timeline('cohort-chart', rows, [7, 14, 28].map((n, index) => ({ key: 'cohort' + n, label: 'Binnen ' + n + ' Tagen erledigt', color: colors[index], unit: '%' })), 'week');
  }
  function projects(s) {
    const grain = settings.projects.grain, state = getState(), names = [...new Set(s.context.completed.map(task => task.project))].sort((a, b) => a.localeCompare(b, 'de')), sources = [{ key: 'total', label: 'Alle ausgewählten Projekte', color: '#8063a0', value: row => row.total }, ...names.map((name, index) => ({ key: 'project:' + name, label: name, color: colors[(index + 1) % colors.length], value: row => row.projects[name] || 0 }))].map(source => ({ ...source, unit: grain === 'week' ? 'erledigte Tasks / KW' : 'erledigte Tasks / Tag' }));
    const counts = new Map(); for (const task of s.tasks) { const key = grain === 'week' ? task.output_week : task.output_date; if (!counts.has(key)) counts.set(key, Object.create(null)); const bucket = counts.get(key); bucket[task.project] = (bucket[task.project] || 0) + 1; }
    const rows = grain === 'week' ? s.series.map(row => ({ day: row.week, week: row.week, partial: row.partial, total: row.count, projects: counts.get(row.week) || Object.create(null) })) : s.dailySeries.map(row => ({ ...row, partial: row.partial || row.day < state.historyStart, total: row.count, projects: counts.get(row.day) || Object.create(null) }));
    timeline('projects', rows, sources, grain);
  }
  function weekdays(s) {
    const names = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'], counts = new Map(); for (const task of s.tasks) { if (!counts.has(task.output_week)) counts.set(task.output_week, Array(7).fill(0)); counts.get(task.output_week)[(h.utc(task.output_date).getUTCDay() + 6) % 7]++; }
    const rows = s.series.map(row => ({ day: row.week, week: row.week, partial: row.partial, total: row.count, ...Object.fromEntries(names.map((name, index) => ['weekday' + index, counts.get(row.week)?.[index] || 0])) }));
    timeline('weekdays', rows, [{ key: 'total', label: 'Erledigt in der gesamten KW', color: '#8063a0' }, ...names.map((name, index) => ({ key: 'weekday' + index, label: 'Am ' + name + ' der jeweiligen KW erledigt', color: colors[(index + 1) % colors.length] }))].map(source => ({ ...source, unit: 'erledigte Tasks / KW' })), 'week');
  }
  function describe(id, day) {
    const record = records.get(id), index = record?.rows.findIndex(row => row.day === day || row.month === day); if (!record || index < 0) return [];
    return record.columns.map(column => column.label + ': ' + (Number.isFinite(column.values[index]) ? h.dec.format(column.values[index]) + ' ' + (column.unit || '') : 'kein vollständiges Fenster'));
  }
  function exportValues(id) {
    const record = records.get(id); if (!record) return;
    const cell = value => { const text = String(value ?? ''); return '"' + (typeof value === 'string' && /^[=+@-]/.test(text.trimStart()) ? "'" + text : text).replace(/"/g, '""') + '"'; };
    const rows = [['Intervallbeginn / Stichtag', 'Intervall', 'Basis', 'Fenster Ticks', 'Einheit', 'Gleitender Durchschnitt Originalwert'], ...record.rows.flatMap((row, index) => record.columns.map(column => [record.grain === 'week' ? row.week || row.day : row.day, record.grain, column.label, column.period, column.unit || '', column.values[index] ?? '']))];
    lifecycle.download('\ufeff' + rows.map(row => row.map(cell).join(';')).join('\r\n'), 'durchschnitte-' + id + '.csv');
  }
  lifecycle.onDestroy(() => { destroyed = true; for (const control of controls.values()) control.destroy(); controls.clear(); records.clear(); });
  return { compact, overlay, backlog, distribution, cohorts, projects, weekdays, describe, configure, getState: () => structuredClone(settings) };
}
