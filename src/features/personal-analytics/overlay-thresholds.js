// Visual reference rules only: no changes to data, aggregation, domains or correlations.
import { datasetReference } from './read-cycle.js';
import { createThresholdOccupancy } from './threshold-occupancy.js';
export const thresholdKey = (model, axis) => `${axis.side}:${model.normalized ? 'normalized' : axis.family}`;
export function cleanThresholdState(value) {
  const rules = {};
  for (const [key, rule] of Object.entries(value?.rules || {})) {
    if (!/^(left|right):(week|day|count|percent|hours|normalized)$/.test(key) || !Number.isFinite(rule?.value)) continue;
    if (!Array.isArray(rule.sources) || !rule.sources.every(source => typeof source === 'string')) continue;
    if (rule.reference && (typeof rule.reference.source !== 'string' || !rule.reference.source || rule.reference.source.length > 160 || !['28d', 'visible'].includes(rule.reference.period))) continue;
    rules[key] = { value: rule.value, sources: [...new Set(rule.sources)].slice(0, 160), ...(rule.reference ? { reference: { source: rule.reference.source, period: rule.reference.period } } : {}) };
  }
  const backgrounds=value?.backgrounds?Object.fromEntries(['native','normalized'].map(mode=>[mode,typeof value.backgrounds[mode]==='string'&&rules[value.backgrounds[mode]]?value.backgrounds[mode]:null])):undefined;
  return { rules, backgroundKey: typeof value?.backgroundKey === 'string' && rules[value.backgroundKey] ? value.backgroundKey : null, ...(backgrounds?{backgrounds}:{}) };
}
export function resolvedThresholdRule(model, state, key) {
  const rule = state.rules[key]; if (!rule || !rule.reference) return rule || null;
  const axis = model.axes.findIndex(axis => thresholdKey(model,axis) === key);
  const line = model.lines.find(line => line.axis === axis && line.key === rule.reference.source);
  const reference = line && datasetReference(model,line,rule.reference.period);
  return reference ? { ...rule, value: reference.value, resolvedReference: reference } : null;
}
export function thresholdBackground(model,state){
  const mode=model.normalized?'normalized':'native',key=Object.hasOwn(state.backgrounds||{},mode)?state.backgrounds[mode]:state.backgroundKey;
  return key&&resolvedThresholdRule(model,state,key)&&model.axes.some(axis=>thresholdKey(model,axis)===key)?key:null;
}
export function thresholdForLine(model, state, line) {
  const axis = model.axes[line.axis];
  if (!axis) return null;
  const key = thresholdKey(model, axis), rule = resolvedThresholdRule(model,state,key);
  return rule && (rule.sources.includes('*') || rule.sources.includes(line.key)) ? { ...rule, axis, key } : null;
}
export function thresholdPatterns(model, state) {
  const choices = ['', '7 3', '2 3', '10 3 2 3', '4 2 2 2', '12 4', '1 2', '8 2 1 2'], used = new Set(), result = new Map();
  for (const line of model.lines) {
    if (!thresholdForLine(model,state,line)) continue;
    const wanted = line.dash || '';
    const pattern = !used.has(wanted) ? wanted : choices.find(value=>!used.has(value)) ?? choices[result.size % choices.length];
    used.add(pattern);result.set(line.key,pattern);
  }
  return result;
}
const green = '#2b8a64', red = '#c15c65';
export function createOverlayThresholds({ document, options, lifecycle, redraw }) {
  let state = cleanThresholdState(options.initialView?.thresholds), control, status, mode='native';
  const occupancy = createThresholdOccupancy(document);
  const number = value => new Intl.NumberFormat('de-AT', { maximumFractionDigits: 4 }).format(value);
  const side = axis => axis.side === 'right' ? 'Rechte Y-Achse' : 'Linke Y-Achse';
  function controlModel(model) {
    const units = { week: 'Tasks / Woche', day: 'Tasks / Tag', count: 'Tasks', percent: '%', hours: 'Kalenderstunden / Task', normalized: '0–100 normiert' };
    const axes = model.axes.map((axis, index) => {
      const key = thresholdKey(model, axis), unit = units[model.normalized ? 'normalized' : axis.family] || axis.label;
      return { key, side: axis.side, label: side(axis), unit, rule: resolvedThresholdRule(model,state,key) || state.rules[key] || null, lines: model.lines.filter(line => line.axis === index).map(line => ({ key: line.key, label: line.label, references: { '28d': datasetReference(model,line,'28d'), visible: datasetReference(model,line,'visible') } })) };
    });
    return { axes, settings: { ...cleanThresholdState(state), backgroundKey: thresholdBackground(model,state) }, activeCount: axes.filter(axis => resolvedThresholdRule(model,state,axis.key)).length, normalized: model.normalized };
  }
  function configure(model) {
    mode=model.normalized?'normalized':'native';
    if (!control && options.mountThresholds) {
      const slot = document.createElement('span'); slot.className = 'personal-threshold-slot';
      document.querySelector('.overlay-panel .panel-head')?.append(slot);
      control = options.mountThresholds(slot, controlModel(model), value => { state = cleanThresholdState({...value,backgrounds:{...state.backgrounds,[mode]:value.backgroundKey}}); redraw(); });
    } else control?.update(controlModel(model));
    if (!status) { status = document.createElement('p'); status.className = 'personal-threshold-status'; status.id = 'overlay-threshold-status'; document.getElementById('overlay-legend').after(status); }
    const active = model.axes.filter(axis => resolvedThresholdRule(model,state,thresholdKey(model, axis)));
    status.textContent = active.map(axis => {
      const key = thresholdKey(model, axis), rule = resolvedThresholdRule(model,state,key);
      const unit = controlModel(model).axes.find(a => a.key === key)?.unit;
      return `${axis.side === 'right' ? 'R' : 'L'}: ${rule.reference ? 'Ø-Referenz · ' : ''}Grün ≥ ${number(rule.value)} ${unit}, Rot darunter${thresholdBackground(model,state) === key ? ' · mit Fläche' : ''}${rule.resolvedReference ? ' · '+rule.resolvedReference.note : ''}`;
    }).join('  /  ');
    status.hidden = !active.length;
    const patterns = thresholdPatterns(model, state), backgroundKey = thresholdBackground(model,state);
    occupancy.render(model, model.lines.flatMap(line => {
      const axis = model.axes[line.axis], key = axis && thresholdKey(model,axis);
      const rule = thresholdForLine(model, state, line) || (key === backgroundKey ? { ...resolvedThresholdRule(model,state,key), axis, key } : null);
      return rule ? [{ line, rule, pattern: patterns.get(line.key) }] : [];
    }));
  }
  function legend(line, model, swatch) {
    const rule = thresholdForLine(model, state, line);
    if (!rule) return '';
    const ns='http://www.w3.org/2000/svg', svg=document.createElementNS(ns,'svg'), pattern=thresholdPatterns(model,state).get(line.key)||'';
    svg.setAttribute('viewBox','0 0 28 6');svg.setAttribute('width','28');svg.setAttribute('height','6');svg.setAttribute('aria-hidden','true');
    for(const [x1,x2,color]of[[0,14,red],[14,28,green]]){const segment=document.createElementNS(ns,'line');for(const[key,value]of Object.entries({x1,x2,y1:3,y2:3,stroke:color,'stroke-width':2,'stroke-dasharray':pattern,'stroke-dashoffset':-x1}))segment.setAttribute(key,value);svg.append(segment);}
    swatch.style.background='transparent';swatch.style.borderTop='none';swatch.style.width='28px';swatch.style.height='6px';swatch.replaceChildren(svg);
    return ` · ${rule.reference ? 'Ø-Referenz' : 'Grün ab'} ${number(rule.value)}${model.normalized ? ' normiert' : ''}`;
  }
  function paint(frame, model, y) {
    const patterns=thresholdPatterns(model,state);
    const { svg } = frame, ns = 'http://www.w3.org/2000/svg';
    const node = (name, attributes) => { const result = document.createElementNS(ns, name); for (const [key, value] of Object.entries(attributes)) result.setAttribute(key, value); return result; };
    const defs = node('defs', {}); svg.append(defs);
    for (const axis of model.axes) {
      const key = thresholdKey(model, axis), rule = resolvedThresholdRule(model,state,key); if (!rule) continue;
      const boundary = y(rule.value, axis), split = Math.max(frame.top, Math.min(frame.top + frame.ph, boundary));
      const prefix = `personal-threshold-${axis.side}`;
      const upper = node('clipPath', { id: prefix + '-above' }), lower = node('clipPath', { id: prefix + '-below' });
      upper.append(node('rect', { x: frame.left, y: frame.top, width: frame.pw, height: split - frame.top }));
      lower.append(node('rect', { x: frame.left, y: split, width: frame.pw, height: frame.top + frame.ph - split }));
      defs.append(upper, lower);
      if (thresholdBackground(model,state) === key) {
        const background = node('g', { 'data-threshold-background': key, 'pointer-events': 'none' });
        background.append(node('rect', { x: frame.left, y: frame.top, width: frame.pw, height: split - frame.top, fill: green, 'fill-opacity': .065 }), node('rect', { x: frame.left, y: split, width: frame.pw, height: frame.top + frame.ph - split, fill: red, 'fill-opacity': .06 }));
        svg.insertBefore(background, svg.firstChild);
      }
      if (boundary >= frame.top && boundary <= frame.top + frame.ph) {
        svg.append(node('line', { x1: frame.left, x2: frame.left + frame.pw, y1: boundary, y2: boundary, stroke: '#8c9aaa', 'stroke-width': 1, 'stroke-dasharray': '4 4', 'pointer-events': 'none', 'data-threshold-boundary': key }));
        const caption = node('text', { x: axis.side === 'right' ? frame.left + frame.pw - 5 : frame.left + 5, y: Math.max(frame.top + 11, boundary - 6), 'text-anchor': axis.side === 'right' ? 'end' : 'start', fill: '#718094', 'font-size': 9, 'pointer-events': 'none' });
        caption.textContent = `${axis.side === 'right' ? 'R' : 'L'} ${rule.reference ? 'Ø ' : ''}${number(rule.value)}`; svg.append(caption);
      }
    }
    for (const line of model.lines) {
      const rule = thresholdForLine(model, state, line); if (!rule) continue;
      const base = [...svg.querySelectorAll('[data-overlay-series]')].find(path => path.getAttribute('data-overlay-series') === line.key);
      if (base) {
        base.setAttribute('stroke-opacity', '0');
        const group = node('g', { 'clip-path': 'url(#overlay-clip)', 'pointer-events': 'none', 'aria-hidden': 'true' });
        for (const [zone, color] of [['below', red], ['above', green]]) {
          const path = base.cloneNode(false); path.removeAttribute('data-overlay-series');
          path.setAttribute('data-threshold-series', line.key); path.setAttribute('data-threshold-zone', zone); path.setAttribute('stroke', color); path.setAttribute('stroke-opacity', '1'); path.setAttribute('stroke-dasharray',patterns.get(line.key)||''); path.setAttribute('clip-path', `url(#personal-threshold-${rule.axis.side}-${zone})`); group.append(path);
        }
        svg.append(group);
      }
      const boundary = y(rule.value, rule.axis);
      for (const dot of svg.querySelectorAll('[data-overlay-point]')) if (dot.getAttribute('data-overlay-point') === line.key) dot.setAttribute('fill', Number(dot.getAttribute('cy')) <= boundary ? green : red);
    }
  }
  lifecycle.onDestroy(() => control?.destroy());
  return { configure, legend, paint, getState: () => cleanThresholdState(state) };
}
