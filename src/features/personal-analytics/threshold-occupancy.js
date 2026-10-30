import { tickOrdinal } from './moving-averages.js';

// Match the chart's calendar-date X scale, not elapsed clock hours across DST.
const calendarDay = day => Date.parse(day + 'T00:00:00Z') / 86_400_000;

/** Share of the supported plotted curve on each side of a reference.
 * Straight, adjacent segments are split at the exact crossing. No extrapolation
 * from isolated points, no bridging gaps, and no dependence on Y-axis clipping.
 * Discrete detail points have observation shares instead of invented durations.
 */
export function thresholdOccupancy(model, line, threshold) {
  const kind = line.render === 'points' ? 'observations' : 'time';
  const result = { kind, above: 0, below: 0, equal: 0, total: 0, segments: 0, validPoints: 0, excludedPoints: 0, start: null, end: null };
  if (!Number.isFinite(threshold)) return { ...result, percentages: null };
  const grain = model.grain || 'day';
  let previous = null;
  for (const row of model.rows) {
    const value = row.plot[line.key], day = calendarDay(row.day);
    if (row.partial || !Number.isFinite(value) || !Number.isFinite(day)) { result.excludedPoints++; previous = null; continue; }
    result.validPoints++;
    if (kind === 'observations') {
      result[value > threshold ? 'above' : value < threshold ? 'below' : 'equal']++;
      result.start ??= row.day; result.end = row.day;
    } else if (previous && tickOrdinal(grain === 'week' ? row.week : row.day, grain) === previous.tick + 1) {
      const span = day - previous.day;
      if (span > 0) {
        const a = previous.value, b = value;
        if (a === threshold && b === threshold) result.equal += span;
        else if (a >= threshold && b >= threshold) result.above += span;
        else if (a <= threshold && b <= threshold) result.below += span;
        else {
          // Scale first to avoid overflowing when finite values have large gaps.
          const scale = Math.max(Math.abs(a), Math.abs(b), Math.abs(threshold), 1);
          const fraction = Math.max(0, Math.min(1, (threshold / scale - a / scale) / (b / scale - a / scale)));
          result[a > threshold ? 'above' : 'below'] += span * fraction;
          result[b > threshold ? 'above' : 'below'] += span * (1 - fraction);
        }
        result.segments++; result.start ??= previous.date; result.end = row.day;
      }
    }
    previous = { value, day, date: row.day, tick: tickOrdinal(grain === 'week' ? row.week : row.day, grain) };
  }
  result.total = result.above + result.below + result.equal;
  return { ...result, percentages: result.total ? Object.fromEntries(['above', 'below', 'equal'].map(key => [key, result[key] / result.total * 100])) : null };
}

const number = value => new Intl.NumberFormat('de-AT', { maximumFractionDigits: 2 }).format(value);
const shortDate = day => day?.split('-').reverse().join('.');

export function createThresholdOccupancy({ document, options, lifecycle }) {
  let section, control;
  function render(model, entries) {
    if (!section) {
      section = document.createElement('div'); section.className = 'personal-threshold-occupancy'; section.id = 'overlay-threshold-occupancy';
      document.querySelector('.overlay-tools').append(section);
    }
    const visible = Boolean(entries.length && options.mountThresholdOccupancy);
    section.hidden = !visible;
    document.querySelector('.overlay-tools').classList.toggle('has-threshold-occupancy', visible);
    const content = { range: model.rows.length ? `${shortDate(model.rows[0].day)}–${shortDate(model.rows.at(-1).day)}` : 'Gewählter Chartzeitraum', entries: entries.map(({ line, rule, pattern }) => {
      const stats = thresholdOccupancy(model, line, rule.value);
      const unit = model.normalized ? '0–100 normiert' : line.unit;
      const reference = `${rule.axis.side === 'right' ? 'R' : 'L'} · ${rule.reference ? 'Ø ' : ''}${number(rule.value)} ${unit}`;
      const coverage = stats.kind === 'observations' ? `${stats.validPoints} gültige ${model.grain === 'week' ? 'KW-Werte' : 'Tageswerte'} · Punkteanteil` : `${number(stats.total)} Kalendertage Verlauf · ${stats.segments} Abschnitte`;
      return { key: line.key, label: line.label, color: line.color, pattern: pattern || '', reference, coverage, percentages: stats.percentages, empty: stats.validPoints ? 'Keine zusammenhängende Zeitspanne' : 'Keine gültigen Werte', note: `${line.label} · ${reference}. ${coverage}.${stats.start ? ' ' + shortDate(stats.start) + '–' + shortDate(stats.end) + '.' : ''} ${stats.excludedPoints} fehlende oder unvollständige Intervallwerte ausgeschlossen.` };
    }), method: 'Anteil der verbundenen Zeitspanne jeder Linie im gewählten Chartzeitraum. Kreuzungen teilen die Zeit genau am Schnittpunkt; durchgehend gleiche Werte zählen separat als „auf der Grenze“. Lücken, isolierte Punkte und Teil-KW zählen nicht als Zeit. Optionale Detailpunkte zeigen stattdessen ihren Anteil an den gültigen Tages-/KW-Werten. Jede Reihe hat ihren eigenen Nenner. Y-Zoom ändert die Anteile nicht; bei Normierung gilt die angezeigte Skala. Grün/Rot beschreibt die Lage, kein Leistungsurteil.' };
    if (!control && options.mountThresholdOccupancy) control = options.mountThresholdOccupancy(section, content);
    else control?.update(content);
  }
  lifecycle.onDestroy(() => control?.destroy());
  return { render };
}
