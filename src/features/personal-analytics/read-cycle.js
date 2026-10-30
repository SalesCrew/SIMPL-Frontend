const dayMs = 86_400_000;
const shiftDay = (day, n) => new Date(Date.parse(day + 'T12:00:00Z') + n * dayMs).toISOString().slice(0, 10);
const num = n => new Intl.NumberFormat('de-AT', { maximumFractionDigits: 2 }).format(n);
export const isReadCycle = key => key === 'readCycleDaily' || key === 'readCycle28';
export const readCycleMetrics = {
  readCycleDaily: { label: 'Gelesen → Fertig · Ø je Abschlusstag', unit: 'Kalenderstunden / Task', family: 'hours', color: '#4b789e', hint: 'Ø Zeit ab eigenem SIMPL-Lesestempel für die an diesem Tag fertigen Tasks. Ohne belegte Stempel bleibt eine Lücke.', description: 'Summe der Kalenderstunden vom eigenen nativen Gelesen-Stempel bis Fertig, geteilt durch die Zahl dieser auswertbaren Tasks. In KW: nach Tasks gewichteter Wochendurchschnitt. Wartezeit ist enthalten; kein Aufwand oder Nachweis der Taskgröße.', aggregation: 'task-weighted' },
  readCycle28: { label: 'Gelesen → Fertig · Ø der letzten 28 Tage', unit: 'Kalenderstunden / Task', family: 'hours', color: '#8b679a', hint: 'Alle auswertbaren Tasks mit Fertig-Stempel in den letzten 28 vollen Tagen: Gesamtzeit ÷ Taskzahl.', description: 'Nach Tasks gewichtete mittlere Durchlaufzeit der Abschlüsse in 28 vollständigen Kalendertagen. Tage ohne auswertbaren Abschluss zählen nicht als null Stunden. Importierte Lesestempel und unbekannte/verkehrte Zeitfolgen bleiben ausgeschlossen. Keine gemessene Arbeitszeit oder Taskschwierigkeit.', aggregation: 'last' },
};

export function readCycleSeries(tasks, { from, through, historyStart, snapshotDay, firstFullDay }) {
  const daily = new Map(), seen = new Set();
  for (const task of tasks) {
    if (!task.id || seen.has(task.id)) continue; seen.add(task.id);
    const day = task.output_date;
    if (!day) continue;
    const bucket = daily.get(day) || { hours: 0, n: 0, total: 0 }; bucket.total++;
    if (task.read_to_finish_status === 'valid' && Number.isFinite(task.read_to_finish_hours) && task.read_to_finish_hours >= 0) { bucket.hours += task.read_to_finish_hours; bucket.n++; }
    daily.set(day, bucket);
  }
  const rows = [], coverage = firstFullDay ? [firstFullDay, historyStart].sort().at(-1) : null;
  for (let day = from; day <= through; day = shiftDay(day, 1)) {
    const valid = day >= historyStart && day < snapshotDay, d = daily.get(day) || { hours: 0, n: 0, total: 0 }, start = shiftDay(day, -27);
    const full = valid && coverage && start >= coverage;
    let sum = 0, n = 0, total = 0;
    if (full) for (let at = start; at <= day; at = shiftDay(at, 1)) { const b = daily.get(at); if (b) { sum += b.hours; n += b.n; total += b.total; } }
    rows.push({ day, readCycleDaily: valid && d.n ? d.hours / d.n : null, readCycleDayHours: valid ? d.hours : null, readCycleDayN: valid ? d.n : null, readCycleDayTotal: valid ? d.total : null, readCycle28: full && n ? sum / n : null, readCycle28Hours: full ? sum : null, readCycle28N: full ? n : null, readCycle28Total: full ? total : null });
  }
  return rows;
}

export function weightedReadCycleWeek(group, values) {
  for (const key of ['readCycleDayHours', 'readCycleDayN', 'readCycleDayTotal']) values[key] = group.reduce((sum, row) => sum + (row.values[key] || 0), 0);
  values.readCycleDaily = values.readCycleDayN ? values.readCycleDayHours / values.readCycleDayN : null;
  return values;
}
export function readCycleMeaning(line, row, grain) {
  const d = row.values, rolling = line.key === 'readCycle28';
  const n = d[rolling ? 'readCycle28N' : 'readCycleDayN'], total = d[rolling ? 'readCycle28Total' : 'readCycleDayTotal'], sum = d[rolling ? 'readCycle28Hours' : 'readCycleDayHours'];
  const from = rolling ? shiftDay(row.day, -27) : grain === 'week' ? row.week : row.day;
  return `${from}–${row.day}: ${num(sum || 0)} Kalenderstunden ÷ ${n || 0} auswertbare Tasks = ${Number.isFinite(d[line.key]) ? num(d[line.key]) : '—'} h/Task. ${n || 0} von ${total || 0} Abschlüssen mit passenden eigenen SIMPL-Lesestempeln. Einschließlich Wartezeit; keine Arbeitszeit oder belegte Taskgröße.`;
}
export function readCycleCSV(line, row) {
  if (!isReadCycle(line.key)) return ['', '', ''];
  const rolling = line.key === 'readCycle28', d = row.values;
  return [d[rolling ? 'readCycle28N' : 'readCycleDayN'] ?? '', d[rolling ? 'readCycle28Hours' : 'readCycleDayHours'] ?? '', d[rolling ? 'readCycle28Total' : 'readCycleDayTotal'] ?? ''];
}

export function renderReadCycleNotice(document, model, summary, coverage) {
  let notice = document.getElementById('read-cycle-coverage');
  if (!notice) { notice = document.createElement('p'); notice.id = 'read-cycle-coverage'; notice.className = 'personal-read-cycle-coverage'; document.getElementById('overlay-legend').after(notice); }
  notice.hidden = !model.lines.some(line => isReadCycle(line.key));
  if (notice.hidden) return;
  const latest = model.dailyRows.at(-1)?.values, full = latest?.readCycle28N !== null && latest?.readCycle28N !== undefined;
  const from = model.dailyRows[0]?.day, end = model.dailyRows.at(-1)?.day;
  const tasks = summary.context.completed.filter(task => task.output_date >= from && task.output_date <= end);
  const counts = new Map(); for (const task of tasks) { const key = task.read_to_finish_status || 'not-provided'; counts.set(key, (counts.get(key) || 0) + 1); }
  const labels = { 'missing-review': 'ohne Lesestempel', 'imported-review': 'mit importiertem Lesestempel', 'other-reviewer': 'von anderem Account gelesen', 'review-after-finish': 'nach Fertig gelesen', 'no-finish': 'nur archiviert', 'invalid-stamp': 'mit ungültigen Stempeln', 'review-before-creation': 'vor Erstellung gelesen', 'future-finish': 'mit künftigem Fertig-Stempel', 'not-provided': 'ohne diese Quelldaten' };
  const exclusions = [...counts].filter(([key]) => key !== 'valid').map(([key, n]) => `${n} ${labels[key] || key}`);
  notice.textContent = (full ? `Letzte 28 volle Tage: ${latest.readCycle28N} von ${latest.readCycle28Total} Abschlüssen auswertbar${latest.readCycle28N ? ' · Ø '+num(latest.readCycle28)+' h/Task' : ''}. ` : 'Für die 28-Tage-Linie fehlt noch ein vollständiges natives Beobachtungsfenster. ') + (coverage ? `SIMPL-Lesestempel ab ${coverage.native_from.slice(0,10)}; volle Tage ab ${coverage.first_full_day}. ` : 'Der Datenstand enthält noch keine belegten nativen Lesestempel. ') + (exclusions.length ? 'Im Chartzeitraum ausgeschlossen: '+exclusions.join(', ')+'. ' : '') + 'Kalenderdauer inklusive Warten, keine Arbeitszeit oder Taskgröße. Erneutes Gelesen setzt den gespeicherten Start neu. Die übrigen Statistiken behalten alle Tasks.';
}

/** A fixed reference line for a displayed dataset, always in original units first. */
export function datasetReference(model, line, period = '28d') {
  if (!Number.isFinite(line.min) || !Number.isFinite(line.max)) return null;
  const daily = model.dailyRows || model.rows;
  const end = model.common && model.rows.length ? [daily.at(-1)?.day, model.rows.at(-1).day].filter(Boolean).sort()[0] : daily.at(-1)?.day;
  if (!end) return null;
  const sharedStart = model.rows[0] && (model.grain === 'week' ? model.rows[0].week : model.rows[0].day);
  const start = period === 'visible' ? model.common && sharedStart ? [daily[0].day,sharedStart].sort().at(-1) : daily[0].day : shiftDay(end, -27);
  let original, n, total = null, sum = null, method;
  if (isReadCycle(line.key)) {
    if (period !== 'visible' && !daily.some(row => row.day === end && row.values.readCycle28N !== null && row.values.readCycle28N !== undefined)) return null;
    const rows = daily.filter(row => row.day >= start && row.day <= end);
    n = rows.reduce((v, row) => v + (row.values.readCycleDayN || 0), 0);
    sum = rows.reduce((v, row) => v + (row.values.readCycleDayHours || 0), 0);
    total = rows.reduce((v, row) => v + (row.values.readCycleDayTotal || 0), 0);
    if (!n) return null;
    original = sum / n; method = 'Nach Tasks gewichtet';
  } else {
    const rows = model.rows.filter(row => row.day >= start && row.day <= end && !row.partial && Number.isFinite(row.values[line.key]));
    n = rows.length; if (!n) return null;
    sum = rows.reduce((value, row) => value + row.values[line.key], 0); original = sum / n;
    method = 'Mittel der vorhandenen Intervallwerte';
  }
  const min = line.normalizationMin ?? line.min, max = line.normalizationMax ?? line.max;
  const value = model.normalized ? min === max ? 50 : 100 * (original - min) / (max - min) : original;
  if (!Number.isFinite(value)) return null;
  return { value, original, n, total, sum, start, end, method, unit: line.unit, note: `${start}–${end} · ${method} · ${n} ${isReadCycle(line.key) ? 'Tasks' : 'Intervallwerte'} · Ø ${num(original)} ${line.unit}${model.normalized ? ' → ' + num(value) + ' normiert' : ''}` };
}
