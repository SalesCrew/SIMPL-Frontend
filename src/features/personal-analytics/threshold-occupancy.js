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
const percent = value => value > 0 && value < .1 ? '< 0,1 %' : new Intl.NumberFormat('de-AT', { maximumFractionDigits: 1 }).format(value) + ' %';
const shortDate = day => day?.split('-').reverse().join('.');

export function createThresholdOccupancy(document) {
  let section, expanded = false;
  const node = (tag, className, text) => { const element = document.createElement(tag); element.className = className; if (text !== undefined) element.textContent = text; return element; };
  function render(model, entries) {
    if (!section) {
      section = node('section', 'personal-threshold-occupancy'); section.id = 'overlay-threshold-occupancy';
      section.setAttribute('aria-labelledby', 'threshold-occupancy-title');
      document.getElementById('overlay-chart').before(section);
    }
    const focused = section.ownerDocument.activeElement;
    const restoreFocus = section.contains(focused) ? focused.classList.contains('threshold-occupancy-more') ? '.threshold-occupancy-more' : focused.matches('.threshold-occupancy-method summary') ? '.threshold-occupancy-method summary' : null : null;
    const methodOpen = section.querySelector('.threshold-occupancy-method')?.open || false;
    const scrollTop = section.querySelector('.threshold-occupancy-list')?.scrollTop || 0;
    section.hidden = !entries.length; section.replaceChildren();
    if (!entries.length) return;
    const header = node('div', 'threshold-occupancy-heading');
    const title = node('h3', '', 'Zeit über / unter Referenz'); title.id = 'threshold-occupancy-title';
    header.append(title, node('span', '', model.rows.length ? `${shortDate(model.rows[0].day)}–${shortDate(model.rows.at(-1).day)}` : 'Gewählter Chartzeitraum')); section.append(header);
    const list = node('div', 'threshold-occupancy-list'); list.id = 'threshold-occupancy-list';
    entries.forEach(({ line, rule, pattern }, index) => {
      const stats = thresholdOccupancy(model, line, rule.value), row = node('article', 'threshold-occupancy-row');
      row.dataset.thresholdOccupancy = line.key;
      row.hidden = !expanded && index >= 3;
      const identity = node('div', 'threshold-occupancy-identity'), label = node('div', 'threshold-occupancy-label');
      const swatch = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      swatch.setAttribute('viewBox', '0 0 22 6'); swatch.setAttribute('aria-hidden', 'true');
      const stroke = document.createElementNS(swatch.namespaceURI, 'line');
      for (const [key, value] of Object.entries({ x1: 0, x2: 22, y1: 3, y2: 3, stroke: line.color, 'stroke-width': 2, 'stroke-dasharray': pattern || '' })) stroke.setAttribute(key, value);
      swatch.append(stroke); label.append(swatch, node('span', '', line.label));
      const unit = model.normalized ? '0–100 normiert' : line.unit;
      const reference = `${rule.axis.side === 'right' ? 'R' : 'L'} · ${rule.reference ? 'Ø ' : ''}${number(rule.value)} ${unit}`;
      const coverage = stats.kind === 'observations' ? `${stats.validPoints} gültige ${model.grain === 'week' ? 'KW-Werte' : 'Tageswerte'} · Punkteanteil` : `${number(stats.total)} Kalendertage Verlauf · ${stats.segments} Abschnitte`;
      identity.append(label, node('small', 'threshold-occupancy-reference', reference + ' · ' + coverage)); row.append(identity);
      if (stats.percentages) {
        const values = node('div', 'threshold-occupancy-values'), bar = node('div', 'threshold-occupancy-bar'); bar.setAttribute('aria-hidden', 'true');
        for (const [key, symbol, word] of [['above', '↑', 'darüber'], ['below', '↓', 'darunter'], ['equal', '=', 'auf der Grenze']]) {
          const amount = stats.percentages[key];
          if (key !== 'equal' || amount > 0) {
            const item = node('span', 'is-' + key, symbol + ' ' + percent(amount)); item.dataset.occupancyZone = key;
            item.setAttribute('aria-label', percent(amount) + ' ' + word); values.append(item);
          }
          const part = node('i', 'is-' + key); part.style.width = amount + '%'; bar.append(part);
        }
        row.append(values, bar);
      } else row.append(node('span', 'threshold-occupancy-empty', stats.validPoints ? 'Keine zusammenhängende Zeitspanne' : 'Keine gültigen Werte'));
      row.title = `${line.label} · ${reference}. ${coverage}.${stats.start ? ' ' + shortDate(stats.start) + '–' + shortDate(stats.end) + '.' : ''} ${stats.excludedPoints} fehlende oder unvollständige Intervallwerte ausgeschlossen.`;
      list.append(row);
    });
    section.append(list);
    if (entries.length > 3) {
      const button = node('button', 'threshold-occupancy-more', expanded ? 'Weniger anzeigen' : `Alle ${entries.length} Reihen anzeigen`);
      button.type = 'button'; button.setAttribute('aria-expanded', String(expanded)); button.setAttribute('aria-controls', list.id);
      button.addEventListener('click', () => { expanded = !expanded; render(model, entries); section.querySelector('.threshold-occupancy-more')?.focus({ preventScroll: true }); }); section.append(button);
    }
    const method = node('details', 'threshold-occupancy-method'); method.append(node('summary', '', 'So wird gerechnet'));
    method.append(node('p', '', 'Anteil der verbundenen Zeitspanne jeder Linie im gewählten Chartzeitraum. Kreuzungen teilen die Zeit genau am Schnittpunkt; durchgehend gleiche Werte zählen separat als „auf der Grenze“. Lücken, isolierte Punkte und Teil-KW zählen nicht als Zeit. Optionale Detailpunkte zeigen stattdessen ihren Anteil an den gültigen Tages-/KW-Werten. Jede Reihe hat ihren eigenen Nenner. Y-Zoom ändert die Anteile nicht; bei Normierung gilt die angezeigte Skala. Grün/Rot beschreibt die Lage, kein Leistungsurteil.'));
    section.append(method);
    method.open = methodOpen; list.scrollTop = scrollTop;
    if (restoreFocus) section.querySelector(restoreFocus)?.focus({ preventScroll: true });
  }
  return { render };
}
