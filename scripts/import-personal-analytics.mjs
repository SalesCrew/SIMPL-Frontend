// Imports reviewed report CODE and static markup only. Never imports its JSON/data.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const requireVite = createRequire(import.meta.resolve('vite'));
const postcss = requireVite('postcss');
const source = process.argv[2];
if (!source) throw new Error('Usage: node scripts/import-personal-analytics.mjs /path/to/report-source');
const target = resolve('src/features/personal-analytics');
await mkdir(target, { recursive: true });
const read = name => readFile(resolve(source, name), 'utf8');
const html = await read('produktivitaet-development.html');
let markup = html.match(/<main class="wrap">([\s\S]*?)<\/main>/)?.[1];
let css = html.match(/<style>([\s\S]*?)<\/style>/)?.[1];
if (!markup || !css || markup.includes('report-data') || markup.includes('<script')) throw new Error('Unsafe report markup');
markup = '<div class="wrap">' + markup + '</div><div id="chart-tooltip" class="tooltip" role="tooltip"></div>';
markup = markup.replace(/<header class="masthead">[\s\S]*?<\/header>/, '');
markup = markup.replace(/<section class="hero"[\s\S]*?<\/section>/, '<section class="hero" aria-labelledby="page-title"><div><div class="eyebrow"><span class="private-dot"></span>DEIN PERSÖNLICHER BEREICH</div><h1 id="page-title">Dein Fortschritt<span class="title-dot">.</span></h1><p class="intro" id="intro"></p></div><div class="personal-header-actions"><span class="private-badge">Nur für dich</span><button type="button" class="button secondary" id="refresh-report">Aktualisieren</button><small id="snapshot"></small></div></section>');
markup = markup.replace('dem 20. Mai 2026', 'dem frühesten verfügbaren Datum').replace('Drei Karten ohne auflösbare Projektzuordnung bleiben', 'Karten ohne auflösbare Projektzuordnung bleiben');
markup = markup.replace('Eigenständige Datei · Keine externen Dienste oder Bibliotheken', 'Development · persönlicher Datenstand');
markup = markup.replace('Drei weitere Perspektiven', 'GENAUER HINSEHEN');
markup = markup.replace('<details class="overlay-picker" open>', '<details class="overlay-picker" open>');
// A comma only separates selectors outside strings, brackets and parentheses.
function selectors(input) { let depth = 0, quote = '', escaped = false, start = 0, out = []; for (let i=0;i<input.length;i++){const c=input[i];if(escaped){escaped=false;continue}if(c==='\\'){escaped=true;continue}if(quote){if(c===quote)quote='';continue}if(c==='"'||c==="'"){quote=c;continue}if(c==='('||c==='[')depth++;if(c===')'||c===']')depth--;if(c===','&&!depth){out.push(input.slice(start,i).trim());start=i+1}}out.push(input.slice(start).trim());return out; }
const ast = postcss.parse(css);
ast.walkRules(rule => {
  if (rule.parent?.type === 'atrule' && /keyframes/i.test(rule.parent.name)) return;
  // SIMPL's existing Radix Select replaces the report's standalone dropdowns.
  const list = selectors(rule.selector).filter(s => !/select-trigger|select-popup|select-option|select-chevron|select-empty|custom-select|native-select-data/.test(s));
  if (!list.length) { rule.remove(); return; }
  rule.selector = list.map(s => s === ':root' || s === 'body' || s === 'html' ? '.personal-productivity' : '.personal-productivity ' + s).join(',');
});
css = ast.toString();
const colors = { '#087b70':'#33765b', '#172d31':'#263a2f', '#52676b':'#748176', '#dce3df':'#e9ede9', '#f4f4f0':'#fdfefd' };
function theme(text) { for (const [a,b] of Object.entries(colors)) text=text.replaceAll(a,b);return text; }
css = theme(css);
const modules = ['analytics.js','charts.js','deep.js','relationships.js'];
let script = await read('report.js');
for (const name of modules) script=script.replace('/* REPORT_'+({ 'analytics.js':'ANALYTICS','charts.js':'CHARTS','deep.js':'DEEP','relationships.js':'RELATIONSHIPS' }[name])+' */', await read(name));
script=script.replace('/* REPORT_CONTROLS */', '');
script=script.replace("const DATA=JSON.parse(document.getElementById('report-data').textContent);", 'const DATA=payload;');
script=script.replaceAll('const byProject={};', 'const byProject=Object.create(null);');
script=script.replace('container.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight)', 'container.clientWidth-(parseFloat(style.paddingLeft)||0)-(parseFloat(style.paddingRight)||0)');
script=script.replace('new Set(allTasks.map(t=>t.project))', 'new Set([...allTasks,...INTAKE.tasks].map(t=>t.project))');
script=script.replace("dateShort(rows[0].day)+'–'+dateShort(rows.at(-1).day)+'2026", "dateLong(rows[0].day)+'–'+dateLong(rows.at(-1).day)+'");
script=script.replace('renderTable(s);syncCustomControls();', 'renderTable(s);syncCustomControls();applyAppPresentation();');
script=script.replace("s.tasks.filter(t=>t.isPaused).length", "s.tasks.filter(t=>t.isPaused).length");
script=script.replace('initDeepControls();initCustomControls();', 'restoreAnalyticsView({state,overlayState,data:DATA,weeks:allWeeks,projects,document,initial:options.initialView});initDeepControls();initCustomControls();');
script=script.replace("if(t.longOpen)tags.append", "if(t.completion_source==='archive-fallback')tags.append(element('span','task-tag notice','Archivdatum als Ersatzstempel'));if(t.longOpen)tags.append");
script=script.replace("'Pausiert Abgelehnt'],...rows.map", "'Pausiert Abgelehnt','Abschlussstempel Quelle'],...rows.map");
script=script.replace("t.isPaused?'ja':'nein'])];", "t.isPaused?'ja':'nein',t.completion_source==='archive-fallback'?'Archivdatum als Ersatz':'Fertig-Stempel'])];");
script=script.replace("'hsl(166 37% '+(96-cell.rate*.53)+'%)'", "'hsl(139 28% '+(98-cell.rate*.26)+'%)'");
script=script.replace("fill:cell.rate!==null&&cell.rate>70?'#fff':'#203e38'", "fill:'#294a32'");
script=script.replace('function drawOverlay(s){', 'function drawOverlayContent(s){');
// Stable adapters keep the imported report's original metrics and relationships intact.
function adapt(before, after) { if (!script.includes(before)) throw new Error('Report adapter target changed: ' + before.slice(0, 100)); script = script.replace(before, after); }
adapt('function drawCompactLine(s,containerId,lines,{height,unit,kind}){', 'function drawCompactLineContent(s,containerId,lines,{height,unit,kind}){');
adapt('function overlayModel(s,settings=overlayState){', 'function overlayModelContent(s,settings=overlayState){');
adapt("if(comparison)svg.append(svgEl('path'", "if(comparison&&!line.period)svg.append(svgEl('path'");
adapt("'stroke-opacity':line.opacity??1,", "'stroke-opacity':line.opacity??1,'stroke-dasharray':line.dash||'',");
adapt("if(d.partial)text.push('Heute · noch unvollständig');showTip(event,dayLabel(d.day),text);", "if(d.partial)text.push('Heute · noch unvollständig');text.push(...averages.describe(containerId,d.day));showTip(event,dayLabel(d.day),text);");
adapt("deepHover(f,rows,x,d=>({title:dayLabel(d.day)+' · Tagesende'", "averages.backlog(s,f,rows,x,y);deepHover(f,rows,x,d=>({title:dayLabel(d.day)+' · Tagesende'");
adapt("'Offen = erstellt und bis dahin nicht fertig; kein aktiver Arbeitsbestand.']", "'Offen = erstellt und bis dahin nicht fertig; kein aktiver Arbeitsbestand.',...averages.describe('backlog-chart',d.day)]");
adapt("const counts=s.deep.fullWeeks.map(w=>w.count),", "averages.distribution(s,f,boxes,i=>f.left+slot*(i+.5),y);const counts=s.deep.fullWeeks.map(w=>w.count),");
adapt("const tip=e=>showTip(e,month+' · volle Kalenderwochen',[", "const tip=e=>showTip(e,month+' · volle Kalenderwochen',[...averages.describe('distribution-chart',b.month),");
adapt('function renderDeep(s){drawBacklog(s);drawCohorts(s);drawDistribution(s);drawOverlay(s)}', 'function renderDeep(s){drawBacklog(s);drawCohorts(s);averages.cohorts(s);drawDistribution(s);drawOverlay(s)}');
adapt('renderProjects(s);renderFacts(s);', 'renderProjects(s);averages.projects(s);renderFacts(s);averages.weekdays(s);');
adapt("'stroke-width':2.1,'stroke-linecap'", "'stroke-width':line.period?1.8:2.1,'stroke-dasharray':line.dash||'','stroke-linecap'");
adapt("swatch.style.background=line.color;item.append", "swatch.style.background=line.period?'transparent':line.color;if(line.period)swatch.style.borderTop='2px dashed '+line.color;item.append");
adapt('restoreAnalyticsView({state,overlayState,data:DATA,weeks:allWeeks,projects,document,initial:options.initialView});initDeepControls();', "const averages=createMovingAverageRuntime({document,options,lifecycle,helpers:{element,svgEl,deepFrame,deepAxisY,deepAxisDates,deepHover,utc,shift,kw,weekLabel,dayLabel,dec,snapshotDay:today},getState:()=>state,getOverlayState:()=>overlayState,redraw:()=>render()});restoreAnalyticsView({state,overlayState,data:DATA,weeks:allWeeks,projects,document,initial:options.initialView});initDeepControls();");
script=theme(script);
const bootstrap = `import markup from './report-template.html?raw';\nimport { createAnalyticsHost } from './runtime-host.js';\nimport { restoreAnalyticsView } from './runtime-state.js';\nimport { createMovingAverageRuntime } from './moving-average-runtime.js';\nexport function mountPersonalAnalytics(host,payload,options={}) {\nconst lifecycle=createAnalyticsHost(host,markup,options);\nconst {document,window,ResizeObserver,MutationObserver,URL,setTimeout}=lifecycle;\nconst {initCustomControls,syncCustomControls,applyAppPresentation}=lifecycle;\ntry {\nfunction drawOverlay(s){drawOverlayContent(s);applyAppPresentation();}\nfunction overlayModel(s,settings=overlayState){const model=overlayModelContent(s,settings);return settings===overlayState?averages.overlay(model):model;}\nfunction drawCompactLine(s,id,lines,config){const prepared=averages.compact(s,id,lines);drawCompactLineContent(prepared.s,id,prepared.lines,config);}\n`;
const ending = `\nreturn {api:window.reportAPI,getState:()=>window.reportAPI.getState(),getOverlayState:()=>window.reportAPI.getOverlayState(),getAverageState:()=>averages.getState(),summary:()=>window.reportSummary,destroy:()=>lifecycle.destroy()};\n} catch (error) { lifecycle.destroy(); throw error; }\n}\n`;
await writeFile(resolve(target, 'report-template.html'), markup.split('\n').map(line=>line.trimEnd()).join('\n').trimEnd()+'\n');
await writeFile(resolve(target, 'report-base.css'), css.trimEnd()+'\n');
await writeFile(resolve(target, 'report-runtime.js'), bootstrap + script + ending);
const provenance = Object.fromEntries(await Promise.all(['report.js',...modules].map(async name=>[name,createHash('sha256').update(await read(name)).digest('hex')])));
await writeFile(resolve(target,'source-provenance.json'), JSON.stringify({description:'Reviewed report code parity; contains no report data. App adapters scope DOM/lifecycle, reuse SIMPL controls and disclose explanations on demand.',modules:provenance},null,2)+'\n');
console.log('Imported analytics code and static UI; no snapshots or task data copied.');
