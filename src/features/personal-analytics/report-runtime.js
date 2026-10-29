import markup from './report-template.html?raw';
import { createAnalyticsHost } from './runtime-host.js';
import { restoreAnalyticsView } from './runtime-state.js';
import { createMovingAverageRuntime } from './moving-average-runtime.js';
export function mountPersonalAnalytics(host,payload,options={}) {
const lifecycle=createAnalyticsHost(host,markup,options);
const {document,window,ResizeObserver,MutationObserver,URL,setTimeout}=lifecycle;
const {initCustomControls,syncCustomControls,applyAppPresentation}=lifecycle;
try {
function drawOverlay(s){drawOverlayContent(s);applyAppPresentation();}
function overlayModel(s,settings=overlayState){const model=overlayModelContent(s,settings);return settings===overlayState?averages.overlay(model):model;}
function drawCompactLine(s,id,lines,config){const prepared=averages.compact(s,id,lines);drawCompactLineContent(prepared.s,id,prepared.lines,config);}
'use strict';
const DATA=payload;
const $=id=>document.getElementById(id);
const nf=new Intl.NumberFormat('de-AT'),dec=new Intl.NumberFormat('de-AT',{minimumFractionDigits:1,maximumFractionDigits:1}),precise=new Intl.NumberFormat('de-AT',{minimumFractionDigits:2,maximumFractionDigits:2});
const fmt=n=>nf.format(n),pct=n=>dec.format(n)+' %',hours=n=>n===null?'—':dec.format(n)+' h';
const utc=s=>new Date(s+'T12:00:00Z'),iso=d=>d.toISOString().slice(0,10);
const shift=(s,n)=>{const d=utc(s);d.setUTCDate(d.getUTCDate()+n);return iso(d)};
const monday=s=>shift(s,-((utc(s).getUTCDay()+6)%7));
const dateShort=s=>s?new Intl.DateTimeFormat('de-AT',{day:'2-digit',month:'2-digit',timeZone:'UTC'}).format(utc(s)):'—';
const dateLong=s=>s?new Intl.DateTimeFormat('de-AT',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(utc(s)):'—';
const dayLabel=s=>new Intl.DateTimeFormat('de-AT',{weekday:'short',day:'2-digit',month:'2-digit',timeZone:'UTC'}).format(utc(s));
function isoWeek(s){const d=utc(s);d.setUTCDate(d.getUTCDate()+3-((d.getUTCDay()+6)%7));const y=d.getUTCFullYear(),jan4=new Date(Date.UTC(y,0,4,12)),first=shift(iso(jan4),-((jan4.getUTCDay()+6)%7));return {year:y,number:1+Math.round((utc(monday(s))-utc(first))/604800000)}}
const kw=s=>'KW '+isoWeek(s).number,range=s=>dateShort(s)+'–'+dateShort(shift(s,6)),weekLabel=s=>kw(s)+' · '+range(s);
const today=DATA.meta.snapshot_vienna.slice(0,10),currentWeek=monday(today),firstWeek=monday(DATA.meta.first_date),lastWeek=currentWeek;
const allWeeks=[];for(let w=firstWeek;w<=lastWeek;w=shift(w,7))allWeeks.push(w);
function quantile(values,p){const a=values.filter(v=>Number.isFinite(v)).sort((a,b)=>a-b);if(!a.length)return null;const x=(a.length-1)*p,i=Math.floor(x);return a[i]+(a[Math.min(i+1,a.length-1)]-a[i])*(x-i)}
function viennaDay(ms){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Vienna',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(ms));const o=Object.fromEntries(parts.map(p=>[p.type,p.value]));return o.year+'-'+o.month+'-'+o.day}
function auditRows(rows,snapshotMillis){
 if(!Number.isFinite(snapshotMillis))throw new Error('Ungültiger Snapshot-Zeitpunkt');
 const seen=new Set(),tasks=[];let duplicates=0,invalidFinish=0,invalidCreation=0;
 for(const source of rows){
  if(!source.id){invalidFinish++;continue}
  if(seen.has(source.id)){duplicates++;continue}seen.add(source.id);
  const end=Date.parse(source.completed_at);
  if(!Number.isFinite(end)||end>snapshotMillis){invalidFinish++;continue}
  const start=Date.parse(source.created_at),goodCreation=Number.isFinite(start)&&start<=end;
  if(!goodCreation)invalidCreation++;
  const output_date=viennaDay(end),output_week=monday(output_date);
  tasks.push({...source,output_date,done_date:output_date,output_week,project:source.project||'Ohne Projekt',duration_hours:goodCreation?(end-start)/3600000:null,isTest:/^test\b/i.test(source.title||''),isPaused:source.project==='Pausiert/Abgelehnt'});
 }
 const durations=tasks.map(t=>t.duration_hours).filter(v=>v!==null),q1=quantile(durations,.25),q3=quantile(durations,.75),fence=q1===null?null:q3+1.5*(q3-q1);
 for(const task of tasks)task.longOpen=fence!==null&&task.duration_hours!==null&&task.duration_hours>fence;
 return {tasks,input:rows.length,duplicates,invalidFinish,invalidCreation,q1,q3,fence,longOpen:tasks.filter(t=>t.longOpen).length,tests:tasks.filter(t=>t.isTest).length,paused:tasks.filter(t=>t.isPaused).length};
}
function progressSeries(tasks,from,through,historyStart,snapshotDay){
 const counts=new Map();for(const task of tasks)counts.set(task.output_date,(counts.get(task.output_date)||0)+1);
 const sum=(a,b)=>{let n=0;for(let d=a;d<=b;d=shift(d,1))n+=counts.get(d)||0;return n};
 const rows=[];let cumulative=0,comparableCumulative=0;
 for(let day=from;day<=through;day=shift(day,1)){
  const count=counts.get(day)||0;cumulative+=count;if(day>=historyStart)comparableCumulative+=count;
  const start14=shift(day,-13),start28=shift(day,-27),start56=shift(day,-55),complete=day<snapshotDay;
  const count14=complete&&start14>=historyStart?sum(start14,day):null;
  const count28=complete&&start28>=historyStart?sum(start28,day):null;
  const previous28=complete&&start56>=historyStart?sum(start56,shift(day,-28)):null;
  const phaseChange=count28!==null&&previous28!==null&&previous28>0?(count28-previous28)/previous28*100:null;
  const phaseReason=!complete?'partial':previous28===null?'warmup':previous28===0?'zero-baseline':'valid';
  rows.push({day,count,cumulative,comparableCumulative:day>=historyStart?comparableCumulative:null,mean14:count14===null?null:count14/14,pace28:count28===null?null:count28/4,count28,previous28,phaseChange,phaseReason,partial:!complete});
 }
 return rows;
}
function auditIntake(rows,snapshotMillis){
 const seen=new Set(),tasks=[];let invalid=0,duplicates=0;
 for(const source of rows){
  if(!source.id||source.deleted_at){invalid++;continue}
  if(seen.has(source.id)){duplicates++;continue}seen.add(source.id);
  const start=Date.parse(source.created_at);
  if(!Number.isFinite(start)||start>snapshotMillis){invalid++;continue}
  const end=Date.parse(source.completed_at),done=Number.isFinite(end)&&end>=start&&end<=snapshotMillis;
  tasks.push({...source,project:source.project||'Ohne Projekt',created_ms:start,done_ms:done?end:null,created_date:viennaDay(start),done_date:done?viennaDay(end):null,isTest:/^test\b/i.test(source.title||''),isPaused:source.project==='Pausiert/Abgelehnt'});
 }
 return {tasks,input:rows.length,duplicates,invalid};
}
function flowSeries(tasks,from,through,historyStart,snapshotDay){
 const incoming=new Map(),finished=new Map();for(const task of tasks){incoming.set(task.created_date,(incoming.get(task.created_date)||0)+1);if(task.done_date)finished.set(task.done_date,(finished.get(task.done_date)||0)+1)}
 const sum=(map,a,b)=>{let n=0;for(let d=a;d<=b;d=shift(d,1))n+=map.get(d)||0;return n};
 const rows=[];
 for(let day=from;day<=through;day=shift(day,1)){
  const start=shift(day,-27),complete=day<snapshotDay&&start>=historyStart;
  const incoming28=complete?sum(incoming,start,day):null,finished28=complete?sum(finished,start,day):null;
  const flowRatio=incoming28>0?finished28/incoming28*100:null;
  const newCohort=complete?tasks.filter(t=>t.created_date>=start&&t.created_date<=day):[];
  const newCohortClosed=complete?newCohort.filter(t=>t.done_date&&t.done_date<=day).length:null;
  rows.push({day,incomingDaily:incoming.get(day)||0,incoming28,finished28,flowRatio,backlogDelta28:complete?incoming28-finished28:null,newCohortClosed,flowReason:!complete?(day>=snapshotDay?'partial':'warmup'):incoming28===0?'zero-intake':'valid'});
 }
 return rows;
}

const snapshotMillis=Date.parse(DATA.meta.snapshot_at.replace(' ','T').replace(/\+00$/,'+00:00'));
const AUDIT=auditRows(DATA.tasks,snapshotMillis),allTasks=AUDIT.tasks;
const INTAKE=auditIntake(DATA.flow_tasks,snapshotMillis);
let state={from:firstWeek,to:lastWeek,project:'',detailDay:'',search:'',page:0,progressMode:'pace',excludeSpecial:false,showRaw:true,historyStart:DATA.coverage.start_date};
const PAGE_SIZE=15;let printing=false;
const medianOf=values=>{const a=values.filter(v=>v!==null&&Number.isFinite(v)).sort((a,b)=>a-b);return a.length?(a[Math.floor((a.length-1)/2)]+a[Math.floor(a.length/2)])/2:null};
const option=(value,text)=>{const e=document.createElement('option');e.value=value;e.textContent=text;return e};
const projects=[...new Set([...allTasks,...INTAKE.tasks].map(t=>t.project))].sort((a,b)=>a.localeCompare(b,'de'));
for(const w of allWeeks){$('from-week').append(option(w,weekLabel(w)));$('to-week').append(option(w,weekLabel(w)))}
for(const p of projects)$('project-filter').append(option(p,p));
$('from-week').value=state.from;$('to-week').value=state.to;
$('history-start').value=state.historyStart;$('history-start').min=DATA.meta.first_date;$('history-start').max=today;
$('snapshot').textContent='Snapshot '+dateLong(today)+' · '+DATA.meta.snapshot_vienna.slice(11)+' Uhr';
$('intro').textContent=fmt(allTasks.length)+' eindeutig abgeschlossene Development-Karten. Dein Lieferfortschritt und Abschlusstempo von '+dateLong(DATA.meta.first_date)+' bis '+dateLong(today)+', unabhängig davon, wie lange Karten vorher offen lagen.';
$('source-note').textContent='Quelle: SIMPL, Development. Unveränderter Original-Snapshot vom '+DATA.meta.snapshot_vienna+' Uhr. '+AUDIT.input+' Rohzeilen, '+allTasks.length+' eindeutige gültige Abschluss-Karten. '+AUDIT.duplicates+' Duplikate und '+AUDIT.invalidFinish+' ungültige Abschlussstempel ausgeschlossen; '+AUDIT.invalidCreation+' ungültige Erstellungsdaten nur bei der Offenzeit unberücksichtigt. Alle Datumskategorien in Europe/Vienna. Für die Eingangsquote: '+INTAKE.tasks.length+' Karten einschließlich '+INTAKE.tasks.filter(t=>!t.done_date).length+' offener Karten; Anlegedatum als Eingangs-Proxy.';
function calc(){
 const weeks=allWeeks.filter(w=>w>=state.from&&w<=state.to);
 const base=allTasks.filter(t=>(!state.project||t.project===state.project)&&(!state.excludeSpecial||(!t.isTest&&!t.isPaused)));
 const tasks=base.filter(t=>t.output_week>=state.from&&t.output_week<=state.to);
 const series=weeks.map(w=>{const rows=tasks.filter(t=>t.output_week===w);return {week:w,count:rows.length,partial:w===currentWeek||w<state.historyStart,medianLead:medianOf(rows.map(t=>t.duration_hours)),longOpen:rows.filter(t=>t.longOpen).length}});
 const full=series.filter(w=>!w.partial),total=tasks.length,avg=full.length?full.reduce((n,w)=>n+w.count,0)/full.length:null;
 const best=full.length?[...full].sort((a,b)=>b.count-a.count||a.week.localeCompare(b.week))[0]:null;
 const dayEnd=[shift(state.to,6),today].sort()[0];
 const incomingBase=INTAKE.tasks.filter(t=>(!state.project||t.project===state.project)&&(!state.excludeSpecial||(!t.isTest&&!t.isPaused)));
 const flows=flowSeries(incomingBase,state.from,dayEnd,state.historyStart,today);
 const dailySeries=progressSeries(base,state.from,dayEnd,state.historyStart,today).map((row,i)=>({...row,...flows[i]}));
 const latestFlow=dailySeries.filter(d=>d.incoming28!==null).at(-1)||null;
 const latest=dailySeries.filter(d=>d.pace28!==null).at(-1)||null;
 const paceChange=latest?.phaseChange??null;
 const byProject=Object.create(null);for(const t of tasks)byProject[t.project]=(byProject[t.project]||0)+1;
 const ranks=Object.entries(byProject).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
 const daily={};for(const t of tasks)daily[t.output_date]=(daily[t.output_date]||0)+1;
 const dayRanks=Object.entries(daily).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
 const weekday=Array(7).fill(0);for(const t of tasks)weekday[(utc(t.output_date).getUTCDay()+6)%7]++;
 const labels={Bug:0,Feature:0,Anpassung:0};for(const t of tasks)for(const label of Object.keys(labels))if(t.labels.includes(label))labels[label]++;
 const typed=tasks.filter(t=>Object.keys(labels).some(l=>t.labels.includes(l))).length;
 const medianDuration=medianOf(tasks.map(t=>t.duration_hours)),regularMedian=medianOf(tasks.filter(t=>!t.longOpen).map(t=>t.duration_hours));
 const deep=deepAnalysis(incomingBase,base,weeks,state.from,dayEnd,state.historyStart,today);
 return {weeks,tasks,series,full,total,avg,best,medianWeek:medianOf(full.map(w=>w.count)),latest,latestFlow,paceChange,ranks,daily,dayRanks,weekday,labels,typed,medianDuration,regularMedian,dailySeries,dailyTasks:tasks,deep,context:{completed:base,intake:incomingBase},tests:tasks.filter(t=>t.isTest).length,paused:tasks.filter(t=>t.isPaused).length,longOpen:tasks.filter(t=>t.longOpen).length};
}
function element(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e}
function metric(label,value,note,isHours=false){const card=element('div','metric');card.append(element('div','metric-label',label),element('div','metric-value'+(isHours?' hours':''),value),element('div','metric-note',note));return card}
function renderMetrics(s){
 const last=s.latest;
 $('metrics').replaceChildren(metric('Erledigte Tasks im Zeitraum',fmt(s.total),'Alle erfassten Abschlüsse · inklusive Trello-Historie'),metric('Ø erledigt pro Woche · letzte 28 Tage',last?dec.format(last.pace28):'—',last?last.count28+' erledigte Tasks ÷ 4 Wochen · bis '+dateShort(last.day):'Noch kein vollständig beobachtetes 28-Tage-Fenster'),metric('Erledigt pro voller KW · Median',s.medianWeek===null?'—':dec.format(s.medianWeek),s.full.length+' volle KW · mittlerer Wochenwert, inklusive Nullwochen'),metric('Mehr / weniger erledigt als in den 28 Tagen davor',s.paceChange===null?'—':(s.paceChange>0?'+':'')+dec.format(s.paceChange)+' %',last&&last.previous28!==null?last.count28+' vs. '+last.previous28+' Abschlüsse in je 28 vollen Tagen':'Für den Vergleich werden 56 volle Tage benötigt'));
 const phase=state.progressMode==='phases';
 $('weekly-title').textContent=phase?'Stärkere und schwächere Abschlussphasen':state.progressMode==='pace'?'Wie viele Tasks du pro Woche erledigst':'Dein kumulativer Fortschritt';
 $('weekly-sub').textContent=phase?'Prozentuale Tempoänderung: letzte 28 volle Tage gegenüber den 28 Tagen davor · täglich neu berechnet':state.progressMode==='pace'?'Rollierende 28 Kalendertage · erfasste Abschlüsse je Woche · ohne künstliche Stunden':'Jede abgeschlossene Karte zählt einmal · Summe im gewählten Zeitraum';
 $('progress-legend').textContent=phase?'Über 0 %: mehr erledigt · unter 0 %: weniger erledigt':state.progressMode==='pace'?'Ø erledigte Tasks pro Woche · aus 28 vollen Tagen':'Erledigte Tasks · Summe seit gewähltem Beginn';
 $('volume-explanation').textContent=phase?'Formel: (Abschlüsse letzte 28 Tage ÷ Abschlüsse der 28 Tage davor − 1) × 100. +50 % bedeutet 50 % mehr Abschlüsse in der jüngeren Phase. Die Nulllinie bedeutet gleiches Tempo. 56 volle Tage Vorgeschichte sind nötig; bei null Abschlüssen in der Vorphase gibt es keinen Prozentwert. Kleine Vergleichszahlen können große Prozentwerte erzeugen – der Tooltip zeigt beide Mengen.':state.progressMode==='pace'?'Formel: Abschlüsse der letzten 28 vollständigen Kalendertage ÷ 4. Ein Langläufer zählt genau einen Task. Heute fließt noch nicht in den Trend ein. Nötige Vorgeschichte vor dem Filterbeginn wird für die Glättung mitgenutzt.':'Die Kurve addiert echte Fertig-Stempel im gewählten Zeitraum. Flache Abschnitte zeigen fehlende Abschlüsse, nicht fehlende Arbeit an noch offenen Tasks.';
 $('quality-summary').textContent=allTasks.length+' eindeutige Karten · '+AUDIT.duplicates+' Duplikate · '+AUDIT.invalidFinish+' ungültige Abschlüsse · '+AUDIT.longOpen+' lange Offenzeiten markiert · '+s.total+' Karten in dieser Ansicht';
 $('coverage-note').textContent=(state.historyStart===DATA.meta.first_date?'Gesamte verfügbare Historie ab '+dateLong(state.historyStart)+' einschließlich älterer Trello-Daten.':'Manueller Vergleichsbeginn: '+dateLong(state.historyStart)+'. „Gesamter Zeitraum“ setzt ihn zurück.')+' Die importierte Historie kann unvollständig sein; es gibt keinen automatischen Migrationsstichtag. Nur mathematisch nicht berechenbare Trendwerte bleiben leer.';
 if(state.progressMode==='cumulative'){$('weekly-sub').textContent='Erfasste Abschlüsse ab '+dateLong([state.from,state.historyStart].sort().at(-1))+' · einschließlich älterer importierter Karten';$('volume-explanation').textContent='Die Kurve addiert eindeutige Fertig-Stempel im gewählten Zeitraum ab dem Vergleichsbeginn. Jede Karte zählt einmal, auch aus der Trello-Historie; eine spätere Archivierung zählt nicht erneut. Flache Abschnitte belegen keine Inaktivität.';}
 if(state.progressMode==='flow'){
  const flow=s.latestFlow;
  $('weekly-title').textContent='Wie du mit dem Aufgabeneingang mithältst';
  $('weekly-sub').textContent='Erledigungsrate ÷ Eingangsrate · letzte 28 volle Kalendertage · 100 % = gleich viele erledigt wie neu';
  $('progress-legend').textContent='Über 100 %: Rückstandsabbau · unter 100 %: Rückstand wächst';
  $('volume-explanation').textContent='Formel: erledigte Tasks der letzten 28 vollen Tage ÷ neu angelegte Tasks im gleichen Fenster × 100. Eingang = Anlegedatum als Näherung, kein historischer Zuweisungszeitpunkt. Alte offene Karten zählen erst beim Fertigstellen als Ergebnis. Die Quote misst den Aufgabenfluss, nicht Arbeitsstunden oder Taskschwierigkeit.';
  $('metrics').replaceChildren(metric('Erledigt im Verhältnis zum Eingang',flow&&flow.flowRatio!==null?pct(flow.flowRatio):'—',flow&&flow.incoming28===0?'Keine Quote bei null Aufgabeneingang':'28 volle Tage · 100 % bedeutet Eingang ausgeglichen'),metric('Neu angelegte Tasks',flow?fmt(flow.incoming28):'—',flow?dec.format(flow.incoming28/4)+' neue Tasks pro Woche':'Keine vollständige Vergleichsbasis'),metric('Erledigte Tasks',flow?fmt(flow.finished28):'—',flow?dec.format(flow.finished28/4)+' Abschlüsse pro Woche':'Kein künstliches Stundenmodell'),metric('Veränderung des Rückstands',flow?(flow.backlogDelta28>0?'+':'')+fmt(flow.backlogDelta28):'—',flow?'Neu angelegt − erledigt · negative Werte bedeuten Abbau':'Kein Quotient bei null Eingang'));
 }
}
const NS='http://www.w3.org/2000/svg';
function svgEl(tag,attrs={},text){const e=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;return e}
function hideTip(){$('chart-tooltip').style.display='none'}
function showTip(event,title,lines){const tip=$('chart-tooltip');tip.replaceChildren(element('b','',title));for(const line of lines)tip.append(document.createElement('br'),document.createTextNode(line));tip.style.display='block';const box=event.currentTarget.getBoundingClientRect(),x=event.clientX||box.x+box.width/2,y=event.clientY||box.y;tip.style.left=Math.min(Math.max(8,x+12),window.innerWidth-tip.offsetWidth-8)+'px';tip.style.top=Math.max(8,Math.min(y-10-tip.offsetHeight,window.innerHeight-tip.offsetHeight-8))+'px'}
function niceStep(max){if(max<=5)return 1;const rough=max/4,power=10**Math.floor(Math.log10(rough)),factor=rough/power;return (factor<=1?1:factor<=2?2:factor<=5?5:10)*power}
function drawCompactLineContent(s,containerId,lines,{height,unit,kind}){
 const phase=kind==='progress'&&state.progressMode==='phases',flow=kind==='progress'&&state.progressMode==='flow',comparison=phase||flow,reference=flow?100:0;
 const container=$(containerId),style=getComputedStyle(container),width=Math.max(container.clientWidth-(parseFloat(style.paddingLeft)||0)-(parseFloat(style.paddingRight)||0),240),left=comparison?62:49,right=17,top=29,bottom=38,pw=width-left-right,ph=height-top-bottom,rows=s.dailySeries.filter(d=>Number.isFinite(d[lines.at(-1).key]));
 if(!rows.length){container.replaceChildren(element('div','chart-empty','Für diesen Ausschnitt gibt es noch kein vollständig berechenbares Vergleichsfenster. Es werden keine Werte geschätzt.'));if(kind==='progress')$('chart-coverage').textContent='Kein berechenbarer Kurvenbereich ab der eingestellten Vergleichshistorie.';return}
 if(kind==='progress')$('chart-coverage').textContent='Berechenbarer Bereich: '+dateLong(rows[0].day)+'–'+dateLong(rows.at(-1).day)+' · '+rows.length+' gültige Tageswerte. Ungültige Bereiche sind ausgeblendet.';
 const primary=lines.at(-1),values=rows.flatMap(d=>lines.map(line=>d[line.key])).filter(v=>v!==null),max=Math.max(flow?100:1,...values),low=Math.min(0,...values),high=Math.max(0,...values),step=niceStep(phase?Math.max(1,high-low):max);
 let floor=phase?Math.floor((low<0?low-Math.max(1,high-low)*.04:0)/step)*step:0,ceiling=phase?Math.ceil((high>0?high+Math.max(1,high-low)*.04:0)/step)*step:Math.max(step,Math.ceil(max*1.08/step)*step);
 if(floor===ceiling){floor=phase?-step:0;ceiling=step}
 const firstMs=utc(rows[0].day).getTime(),lastMs=utc(rows.at(-1).day).getTime();
 const x=i=>left+(lastMs>firstMs?(utc(rows[i].day).getTime()-firstMs)/(lastMs-firstMs)*pw:pw/2),y=v=>top+ph-(v-floor)/(ceiling-floor)*ph;
 const label=kind==='daily'?'Fertige Tasks mit rollierendem 14-Tage-Durchschnitt':flow?'Erledigte Tasks im Verhältnis zu neuen Tasks in 28 Tagen':phase?'Prozentuale Tempoänderung zwischen zwei aufeinanderfolgenden 28-Tage-Phasen':state.progressMode==='pace'?'Abschlusstempo: letzte 28 volle Tage geteilt durch vier':'Kumulativ abgeschlossene Tasks im gewählten Zeitraum';
 const svg=svgEl('svg',{viewBox:'0 0 '+width+' '+height,role:'img',class:'compact-line','aria-label':label});
 svg.append(svgEl('desc',{},'Gezählt werden eindeutige Fertig-Stempel. Keine erfundenen Arbeitsstunden oder zwischenzeitlichen Aktivitäten. Die geglätteten Werte verwenden nur vollständige Kalendertage.'));
 if(comparison){const zero=y(reference);svg.append(svgEl('rect',{x:left,y:top,width:pw,height:Math.max(0,zero-top),fill:'#f1f8f4'}),svgEl('rect',{x:left,y:zero,width:pw,height:Math.max(0,top+ph-zero),fill:'#fff3ec'}));const defs=svgEl('defs'),clip=svgEl('clipPath',{id:containerId+'-negative'});clip.append(svgEl('rect',{x:left,y:zero,width:pw,height:Math.max(0,top+ph-zero)}));defs.append(clip);svg.append(defs)}
 const axisTicks=[];for(let v=floor;v<=ceiling+step*.001;v+=step)axisTicks.push(v);if(flow&&!axisTicks.includes(100))axisTicks.push(100);axisTicks.sort((a,b)=>a-b);
 for(const v of axisTicks){const yy=y(v);svg.append(svgEl('line',{x1:left,y1:yy,x2:width-right,y2:yy,stroke:comparison&&v===reference?'#80998c':'#e7ece6','stroke-width':comparison&&v===reference?1.5:1,'data-zero-line':phase&&v===0?'true':'false','data-reference-line':flow&&v===100?'true':'false'}),svgEl('text',{x:left-9,y:yy+4,'text-anchor':'end',fill:'#748176','font-size':10},comparison?(phase&&v>0?'+':'')+fmt(v)+'%':fmt(v)))}
 svg.append(svgEl('text',{x:left,y:13,fill:'#748176','font-size':10},unit));
 const tickCount=Math.min(rows.length,width<440?4:8),ticks=new Set();for(let i=0;i<tickCount;i++)ticks.add(Math.round(i/Math.max(1,tickCount-1)*(rows.length-1)));
 for(const i of ticks)svg.append(svgEl('text',{x:x(i),y:height-14,'text-anchor':i===0?'start':i===rows.length-1?'end':'middle',fill:'#748176','font-size':10},dateShort(rows[i].day)));
 for(const line of lines){let path='',connected=false,previousDay=null;for(let i=0;i<rows.length;i++){const value=rows[i][line.key];if(value===null){connected=false;continue}connected=connected&&previousDay!==null&&shift(previousDay,1)===rows[i].day;path+=(connected?' L ':' M ')+x(i)+' '+y(value);connected=true;previousDay=rows[i].day}if(path){svg.append(svgEl('path',{d:path,fill:'none',stroke:line.color,'stroke-width':line.width,'stroke-opacity':line.opacity??1,'stroke-dasharray':line.dash||'','stroke-linejoin':'round','stroke-linecap':'round',class:'data-line','data-series':line.key}));if(comparison&&!line.period)svg.append(svgEl('path',{d:path,fill:'none',stroke:'#b45d25','stroke-width':line.width,'stroke-linejoin':'round','stroke-linecap':'round','clip-path':'url(#'+containerId+'-negative)','data-series':flow?'flowRatio-below-target':'phaseChange-negative','pointer-events':'none'}))}}
 const primaryValues=rows.map(d=>d[primary.key]).filter(v=>v!==null),primaryMax=primaryValues.length?Math.max(...primaryValues):null,peakIndex=primaryMax===null?-1:rows.findIndex(d=>d[primary.key]===primaryMax),lastValueIndex=rows.findLastIndex(d=>d[primary.key]!==null);
 if(comparison&&!primaryValues.length)svg.append(svgEl('text',{x:left+pw/2,y:top+ph/2-10,'text-anchor':'middle',fill:'#748176','font-size':10},flow?'Kein vollständiges 28-Tage-Fenster mit Aufgabeneingang.':'Noch kein vollständiger Vergleich mit positiver Vorphase.'));
 rows.forEach((d,i)=>{
  const value=d[primary.key],selected=state.detailDay===d.day,group=svgEl('g',{'data-day':d.day,'data-value':value===null?'':value});
  if(value!==null&&(selected||i===peakIndex||i===lastValueIndex))group.append(svgEl('circle',{cx:x(i),cy:y(value),r:selected?4:3,fill:comparison&&value<reference?'#b45d25':'#33765b',class:'chart-point'}));
  if(kind==='daily'&&state.showRaw&&d.partial)group.append(svgEl('circle',{cx:x(i),cy:y(d.count),r:3,fill:'#b45d25',class:'chart-point'}));
  if(selected)group.append(svgEl('line',{x1:x(i),y1:top,x2:x(i),y2:top+ph,stroke:'#80b7a4','stroke-width':1,'stroke-dasharray':'3 3'}));
  if((i===peakIndex||comparison&&i===lastValueIndex)&&value!==null){const anchor=x(i)<left+30?'start':x(i)>width-right-30?'end':'middle';group.append(svgEl('text',{x:x(i),y:y(value)-8,'text-anchor':anchor,fill:comparison&&value<reference?'#9b4d24':'#263a2f','font-size':10,'font-weight':600},comparison?(phase&&value>0?'+':'')+dec.format(value)+'%':['cumulative','comparableCumulative'].includes(primary.key)?fmt(value):dec.format(value)))}svg.append(group);
 });
 const guide=svgEl('g',{visibility:'hidden','pointer-events':'none'}),guideLine=svgEl('line',{y1:top,y2:top+ph,stroke:'#a1b7ad','stroke-width':1}),guideDot=svgEl('circle',{r:3.5,fill:'#33765b'});guide.append(guideLine,guideDot);svg.append(guide);
 const overlay=svgEl('rect',{x:left,y:top-4,width:pw,height:ph+8,fill:'transparent',class:'chart-hover',tabindex:0,role:'button','aria-label':'Tageswerte. Mit links/rechts einen Tag wählen, mit Enter seine Tasks anzeigen.','data-chart-hit':'daily'});
 let focusIndex=Math.max(0,rows.findIndex(d=>d.day===state.detailDay));
 const indexFromEvent=e=>{if(rows.length===1)return 0;const box=svg.getBoundingClientRect(),fraction=Math.max(0,Math.min(1,((e.clientX-box.left)/box.width*width-left)/pw)),target=firstMs+fraction*(lastMs-firstMs);let best=0;for(let i=1;i<rows.length;i++)if(Math.abs(utc(rows[i].day).getTime()-target)<Math.abs(utc(rows[best].day).getTime()-target))best=i;return Math.abs(utc(rows[best].day).getTime()-target)>43200001?null:best};
 const hover=(event,index)=>{
  focusIndex=index;const d=rows[index],value=d[primary.key];guide.setAttribute('visibility','visible');guideLine.setAttribute('x1',x(index));guideLine.setAttribute('x2',x(index));guideDot.setAttribute('visibility',value===null?'hidden':'visible');if(value!==null){guideDot.setAttribute('cx',x(index));guideDot.setAttribute('cy',y(value));guideDot.setAttribute('fill',comparison&&value<reference?'#b45d25':'#33765b')}
  let text;
  if(kind==='daily')text=[d.count+' Tasks an diesem Tag erledigt',d.mean14===null?(d.partial?'Heute noch nicht im 14-Tage-Durchschnitt':'Noch kein vollständiges 14-Tage-Fenster'):'Ø '+dec.format(d.mean14)+' erledigte Tasks pro Kalendertag',...(d.mean14===null?[]:[Math.round(d.mean14*14)+' Erledigungen vom '+dateShort(shift(d.day,-13))+'–'+dateShort(d.day)+' ÷ 14 Kalendertage, inklusive Nulltagen']),d.count===0?'Kein Abschluss bedeutet nicht keine Arbeit.':'Gezählt wird der Fertig-Stempel.'];
  else if(flow){text=[d.flowRatio===null?(d.flowReason==='zero-intake'?'Kein Quotient: 0 neue Tasks im Fenster':d.flowReason==='partial'?'Heute noch kein vollständiges Fenster':'Noch kein vollständiges 28-Tage-Fenster'):dec.format(d.flowRatio)+' % · erledigt im Verhältnis zum Eingang'];if(d.incoming28!==null){text.push(dateShort(shift(d.day,-27))+'–'+dateShort(d.day)+': '+d.incoming28+' neu, '+d.finished28+' erledigt',dec.format(d.finished28/4)+' erledigt / '+dec.format(d.incoming28/4)+' neu pro Woche','Rückstandänderung: '+(d.backlogDelta28>0?'+':'')+d.backlogDelta28,'Von den neuen Karten bis Stichtag fertig: '+d.newCohortClosed+' / '+d.incoming28);if(d.incoming28>0&&d.incoming28<10)text.push('Kleiner Eingang: Quote vorsichtig lesen.');}text.push('Eingang = Anlegedatum, kein Zuweisungsverlauf.');}
  else if(phase){text=[d.phaseChange===null?(d.phaseReason==='zero-baseline'?'Kein Prozentwert: Vorphase hat 0 Abschlüsse':d.phaseReason==='partial'?'Heute noch kein vollständiger Vergleich':'Noch keine 56 vollen Tage Vorgeschichte'):(d.phaseChange>0?'+':'')+dec.format(d.phaseChange)+' % Abschlusstempo gegenüber der Vorphase'];if(d.count28!==null)text.push('Jüngere Phase '+dateShort(shift(d.day,-27))+'–'+dateShort(d.day)+': '+d.count28+' Abschlüsse');if(d.previous28!==null)text.push('Vorherige Phase '+dateShort(shift(d.day,-55))+'–'+dateShort(shift(d.day,-28))+': '+d.previous28+' Abschlüsse');if(d.previous28>0&&d.previous28<10)text.push('Kleine Vergleichsbasis: große Prozente vorsichtig lesen.');}
  else if(state.progressMode==='cumulative')text=[d.comparableCumulative+' Tasks kumulativ im Vergleichszeitraum',d.count+' Fertig-Stempel an diesem Tag'];
  else text=[d.pace28===null?(d.partial?'Heute nicht im 28-Tage-Durchschnitt':'Noch kein vollständiges 28-Tage-Fenster'):'Ø '+dec.format(d.pace28)+' erledigte Tasks pro Woche',d.count28===null?'Keine Hochrechnung aus unvollständigen Fenstern':d.count28+' erledigte Tasks in 28 vollen Tagen ÷ 4 Wochen',d.count+' Tasks an diesem Tag erledigt'];
  if(d.partial)text.push('Heute · noch unvollständig');text.push(...averages.describe(containerId,d.day));showTip(event,dayLabel(d.day),text);overlay.setAttribute('aria-label',dayLabel(d.day)+', '+d.count+' tatsächliche Abschlüsse. Enter zeigt die Tasks.');
 };
 const choose=index=>{state.detailDay=state.detailDay===rows[index].day?'':rows[index].day;state.page=0;hideTip();render()};
 overlay.addEventListener('pointermove',e=>{const index=indexFromEvent(e);if(index===null){guide.setAttribute('visibility','hidden');hideTip()}else hover(e,index)});overlay.addEventListener('pointerleave',()=>{guide.setAttribute('visibility','hidden');hideTip()});overlay.addEventListener('click',e=>{const index=indexFromEvent(e);if(index!==null)choose(index)});overlay.addEventListener('focus',e=>hover(e,focusIndex));overlay.addEventListener('blur',()=>{guide.setAttribute('visibility','hidden');hideTip()});
 overlay.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();focusIndex=e.key==='Home'?0:e.key==='End'?rows.length-1:Math.max(0,Math.min(rows.length-1,focusIndex+(e.key==='ArrowRight'?1:-1)));hover(e,focusIndex)}else if(e.key==='Enter'||e.key===' '){e.preventDefault();choose(focusIndex)}});
 svg.append(overlay);container.replaceChildren(svg);
}
function drawChart(s){const phase=state.progressMode==='phases',flow=state.progressMode==='flow',key=flow?'flowRatio':phase?'phaseChange':state.progressMode==='pace'?'pace28':'comparableCumulative';drawCompactLine(s,'weekly-chart',[{key,color:'#33765b',width:2.5}],{height:250,unit:flow?'Erledigt / neu angelegt (%)':phase?'Änderung der Erledigungen (%)':state.progressMode==='pace'?'Ø erledigte Tasks / Woche':'Erledigte Tasks · Summe',kind:'progress'})}
function drawDaily(s){const lines=state.showRaw?[{key:'count',color:'#9bada3',width:1.2,opacity:.58}]:[];lines.push({key:'mean14',color:'#33765b',width:2.6});drawCompactLine(s,'daily-chart',lines,{height:190,unit:'Erledigte Tasks / Tag',kind:'daily'});const valid=s.dailySeries.filter(d=>d.mean14!==null),last=valid.at(-1);$('daily-sub').textContent=valid.length?valid.reduce((n,d)=>n+d.count,0)+' erledigte Tasks im gezeigten Ausschnitt · '+dateShort(valid[0].day)+' bis '+dateShort(last.day)+' · tatsächliche Tagesabschlüsse und ihr 14-Tage-Durchschnitt':'Für den Durchschnitt fehlen 14 volle Tage ab dem Vergleichsbeginn.';$('daily-meaning').textContent=last?'So liest du den Durchschnitt am '+dateShort(last.day)+': '+Math.round(last.mean14*14)+' Tasks wurden vom '+dateShort(shift(last.day,-13))+' bis '+dateShort(last.day)+' erledigt. Geteilt durch 14 Kalendertage ergibt das Ø '+dec.format(last.mean14)+' erledigte Tasks pro Tag. Tage ohne Abschluss zählen mit.':'Der Durchschnitt zählt erledigte Tasks der letzten 14 vollen Kalendertage und teilt sie durch 14, einschließlich Tagen ohne Abschluss.'}

const DAY_MS=86400000;
const dayDistance=(a,b)=>Math.round((utc(b)-utc(a))/DAY_MS);
function viennaStartMs(day){const guess=Date.parse(day+'T00:00:00Z'),parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Vienna',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(guess)),p=Object.fromEntries(parts.map(v=>[v.type,v.value]));return guess-(Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day),Number(p.hour),Number(p.minute),Number(p.second))-guess)}
function deepAnalysis(intake,completed,weeks,from,through,historyStart,snapshotDay){
 const snapshotStart=viennaStartMs(snapshotDay);
 const counts=new Map();for(const t of completed)counts.set(t.output_date,(counts.get(t.output_date)||0)+1);
 const weekCount=w=>{let n=0;for(let i=0;i<7;i++)n+=counts.get(shift(w,i))||0;return n};
 const qualifies=(t,n)=>t.done_ms!==null&&t.done_ms>=t.created_ms&&t.done_ms-t.created_ms<=n*DAY_MS;
 const rows=[];
 for(let day=from;day<=through;day=shift(day,1)){
  const valid=day>=historyStart&&day<snapshotDay,observationEnd=viennaStartMs(shift(day,1)),open=valid?intake.filter(t=>t.created_date<=day&&(!t.done_date||t.done_date>day)):[];
  const bands=[0,0,0];for(const t of open){const age=dayDistance(t.created_date,day);bands[age<=7?0:age<=28?1:2]++}
  const lastWeek=shift(monday(shift(day,1)),-7),firstOf8=shift(lastWeek,-49),eight=valid&&firstOf8>=historyStart?Array.from({length:8},(_,i)=>weekCount(shift(firstOf8,i*7))):[];
  const row={day,open:valid?open.length:null,open7:valid?bands[0]:null,open28:valid?bands[1]:null,openOld:valid?bands[2]:null,median8:eight.length?quantile(eight,.5):null,q1week8:eight.length?quantile(eight,.25):null,q3week8:eight.length?quantile(eight,.75):null};
  for(const n of [7,14,28]){
   const start=shift(day,-(27+n)),end=shift(day,-n),windowValid=valid&&start>=historyStart;
   const cohort=windowValid?intake.filter(t=>t.created_date>=start&&t.created_date<=end):[];
   const eligible=windowValid&&cohort.every(t=>t.created_ms+n*DAY_MS<observationEnd);
   const hit=cohort.filter(t=>qualifies(t,n)).length;
   row['cohort'+n]=eligible&&cohort.length?100*hit/cohort.length:null;row['cohortN'+n]=eligible?cohort.length:null;row['cohortHit'+n]=eligible?hit:null;
  }
  rows.push(row);
 }
 const cohorts=weeks.map(week=>{
  const tasks=intake.filter(t=>monday(t.created_date)===week&&t.created_date>=historyStart),cells=[7,14,28].map(days=>{
   const matured=viennaStartMs(shift(week,7))+days*DAY_MS<=snapshotStart,hit=tasks.filter(t=>qualifies(t,days)).length;
   return {days,n:tasks.length,hit:matured?hit:null,matured,rate:matured&&tasks.length?100*hit/tasks.length:null};
  });return {week,n:tasks.length,partial:week<historyStart||shift(week,6)>=snapshotDay,cells};
 });
 const fullWeeks=weeks.filter(w=>w>=historyStart&&shift(w,6)<snapshotDay).map(week=>({week,count:weekCount(week)}));
 const groups=new Map();for(const row of fullWeeks){const month=shift(row.week,6).slice(0,7);if(!groups.has(month))groups.set(month,[]);groups.get(month).push(row)}
 const boxes=[...groups].map(([month,points])=>{const values=points.map(p=>p.count);return {month,points,n:points.length,min:Math.min(...values),q1:quantile(values,.25),median:quantile(values,.5),q3:quantile(values,.75),max:Math.max(...values),total:values.reduce((a,b)=>a+b,0)}});
 return {rows,cohorts,boxes,fullWeeks};
}
function deepFrame(id,height,left=49,right=18){const el=$(id),width=Math.max(280,el.clientWidth),top=28,bottom=37,pw=width-left-right,ph=height-top-bottom,svg=svgEl('svg',{viewBox:'0 0 '+width+' '+height,role:'img',class:'deep-svg'});el.replaceChildren(svg);return {svg,width,height,left,right,top,bottom,pw,ph}}
function deepAxisY(f,max,label){const step=niceStep(Math.max(1,max)),ceiling=Math.max(step,Math.ceil(Math.max(1,max)*1.08/step)*step),y=v=>f.top+f.ph-v/ceiling*f.ph;
 for(let v=0;v<=ceiling;v+=step){f.svg.append(svgEl('line',{x1:f.left,x2:f.width-f.right,y1:y(v),y2:y(v),stroke:'#e7ece6'}),svgEl('text',{x:f.left-8,y:y(v)+4,'text-anchor':'end',class:'axis-text'},fmt(v)))}f.svg.append(svgEl('text',{x:f.left,y:13,class:'axis-text'},label));return y}
function deepAxisDates(f,rows,x){const ticks=Math.min(rows.length,f.width<500?4:8),seen=new Set();for(let i=0;i<ticks;i++)seen.add(Math.round(i/Math.max(1,ticks-1)*(rows.length-1)));for(const i of seen)f.svg.append(svgEl('text',{x:x(i),y:f.height-12,'text-anchor':i===0?'start':i===rows.length-1?'end':'middle',class:'axis-text'},dateShort(rows[i].day)))}
function deepHover(f,rows,x,describe,cadence=1){
 const guide=svgEl('line',{y1:f.top,y2:f.top+f.ph,stroke:'#829f95','stroke-dasharray':'3 3',visibility:'hidden'});f.svg.append(guide);
 const hit=svgEl('rect',{x:f.left,y:f.top,width:f.pw,height:f.ph,fill:'transparent',tabindex:0,'data-deep-hit':'true','aria-label':'Zeitreihe. Mit Pfeiltasten, Pos1 und Ende Werte ansehen.',class:'chart-hover'});let index=0;
 const show=(e,i)=>{index=i;guide.setAttribute('x1',x(i));guide.setAttribute('x2',x(i));guide.setAttribute('visibility','visible');const d=describe(rows[i]);showTip(e,d.title,d.lines)};
 hit.addEventListener('pointermove',e=>{const box=f.svg.getBoundingClientRect(),pos=(e.clientX-box.left)/box.width*f.width;let i=0;for(let n=1;n<rows.length;n++)if(Math.abs(x(n)-pos)<Math.abs(x(i)-pos))i=n;const span=utc(rows.at(-1).day)-utc(rows[0].day),target=utc(rows[0].day).getTime()+Math.max(0,Math.min(1,(pos-f.left)/f.pw))*span;if(Math.abs(utc(rows[i].day).getTime()-target)>cadence*DAY_MS/2+1){guide.setAttribute('visibility','hidden');hideTip();return}show(e,i)});
 const hide=()=>{guide.setAttribute('visibility','hidden');hideTip()};hit.addEventListener('pointerleave',hide);hit.addEventListener('blur',hide);hit.addEventListener('focus',e=>show(e,index));hit.addEventListener('keydown',e=>{if(['Home','End','ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();show(e,e.key==='Home'?0:e.key==='End'?rows.length-1:Math.max(0,Math.min(rows.length-1,index+(e.key==='ArrowLeft'?-1:1))))}});f.svg.append(hit);
}
function drawBacklog(s){
 const rows=s.deep.rows.filter(d=>d.open!==null),el=$('backlog-chart');if(!rows.length){el.replaceChildren(element('p','chart-empty','Keine vollständigen Tagesstände in diesem Zeitraum.'));$('backlog-facts').textContent='';return}
 const f=deepFrame('backlog-chart',245),y=deepAxisY(f,Math.max(...rows.map(d=>d.open)),'Offene erfasste Karten'),first=utc(rows[0].day),span=utc(rows.at(-1).day)-first,x=i=>f.left+(span?(utc(rows[i].day)-first)/span*f.pw:f.pw/2);
 f.svg.setAttribute('aria-label','Erfasster offener Aufgabenbestand nach Kalenderalter. Gestapelte Flächen: bis 7, 8 bis 28 und mehr als 28 Tage.');
 const keys=['open7','open28','openOld'],colors=['#91c8b8','#2d887d','#d29a6a'];let lower=rows.map(()=>0);
 keys.forEach((key,k)=>{const upper=rows.map((d,i)=>lower[i]+d[key]);const p=upper.map((v,i)=>(i?'L':'M')+x(i)+' '+y(v)).join(' ')+lower.map((v,i)=>'L'+x(rows.length-1-i)+' '+y(lower[rows.length-1-i])).join(' ')+' Z';f.svg.append(svgEl('path',{d:p,fill:colors[k],'fill-opacity':.8,'data-backlog-band':key}));lower=upper});
 f.svg.append(svgEl('path',{d:rows.map((d,i)=>(i?'L':'M')+x(i)+' '+y(d.open)).join(' '),fill:'none',stroke:'#174c46','stroke-width':1.6}));deepAxisDates(f,rows,x);
 averages.backlog(s,f,rows,x,y);deepHover(f,rows,x,d=>({title:dayLabel(d.day)+' · Tagesende',lines:[d.open+' Karten noch offen',d.open7+' bis 7 Tage · '+d.open28+' von 8–28 Tagen · '+d.openOld+' älter als 28 Tage','Offen = erstellt und bis dahin nicht fertig; kein aktiver Arbeitsbestand.',...averages.describe('backlog-chart',d.day)]}));
 const last=rows.at(-1),peak=rows.reduce((a,b)=>a.open>=b.open?a:b);$('backlog-facts').textContent='Stand '+dateShort(last.day)+': '+last.open+' offen, davon '+last.openOld+' älter als 28 Tage. Höchster erfasster Bestand: '+peak.open+' am '+dateShort(peak.day)+'.';
}
function drawCohorts(s){
 const f=deepFrame('cohort-chart',Math.max(155,67+s.deep.cohorts.length*27),98,10),cellW=f.pw/3,header=35,rowH=27;
 f.svg.setAttribute('aria-label','Erledigungsquoten je Eingangs-Kalenderwoche nach 7, 14 und 28 verstrichenen Kalendertagen. Unreife Kohorten bleiben ohne Quote.');
 [7,14,28].forEach((n,i)=>f.svg.append(svgEl('text',{x:f.left+(i+.5)*cellW,y:17,'text-anchor':'middle',class:'axis-text'},'≤ '+n+' Tage')));
 let n=0,hit=0;
 for(let i=0;i<s.deep.cohorts.length;i++){
  const row=s.deep.cohorts[i],yy=header+i*rowH;f.svg.append(svgEl('text',{x:f.left-9,y:yy+16,'text-anchor':'end',class:'axis-text'},kw(row.week)+' · n='+row.n));
  for(let j=0;j<3;j++){
   const cell=row.cells[j],color=cell.rate===null?'#eff1ee':'hsl(139 28% '+(98-cell.rate*.26)+'%)',group=svgEl('g',{tabindex:0,'data-cohort-week':row.week,'data-cohort-days':cell.days,'data-rate':cell.rate===null?'':cell.rate,role:'img','aria-label':kw(row.week)+', '+cell.days+' Tage: '+(cell.rate===null?(!cell.n?'keine Eingänge':'noch nicht vollständig beobachtet'):dec.format(cell.rate)+' Prozent, '+cell.hit+' von '+cell.n)});
   group.append(svgEl('rect',{x:f.left+j*cellW+2,y:yy,width:cellW-4,height:23,rx:3,fill:color}),svgEl('text',{x:f.left+(j+.5)*cellW,y:yy+16,'text-anchor':'middle',fill:'#294a32','font-size':10,'font-weight':cell.rate!==null?600:400},cell.rate===null?(cell.n?'…':'—'):Math.round(cell.rate)+' %'));
   const describe=e=>showTip(e,weekLabel(row.week)+' · Eingänge',[(row.partial?'Teilweise erfasste KW · ':'')+row.n+' angelegte Karten',cell.rate===null?(!cell.n?'Keine Eingänge: kein Prozentwert':'Noch keine vollständige '+cell.days+'-Tage-Nachbeobachtung für diese KW'):cell.hit+' von '+cell.n+' innerhalb '+cell.days+' Tagen fertig · '+dec.format(cell.rate)+' %','Alle Karten im Nenner, auch weiterhin offene.',row.n>0&&row.n<5?'Kleine Kohorte: einzelne Karten bewegen den Prozentwert stark.':'Gemessen wird Kalenderdauer ab Erstellung, keine Arbeitszeit.']);group.addEventListener('pointerenter',describe);group.addEventListener('focus',describe);group.addEventListener('pointerleave',hideTip);group.addEventListener('blur',hideTip);f.svg.append(group);
   if(j===0&&cell.rate!==null){n+=cell.n;hit+=cell.hit}
  }
 }
 $('cohort-facts').textContent=n?hit+' von '+n+' Karten aus vollständig 7 Tage nachbeobachteten Eingangs-KW wurden binnen 7 Tagen fertig ('+dec.format(100*hit/n)+' %).':'Noch keine vollständig nachbeobachtete Eingangs-KW.';
}
function drawDistribution(s){
 const boxes=s.deep.boxes,el=$('distribution-chart');if(!boxes.length){el.replaceChildren(element('p','chart-empty','Keine vollständig beobachtete KW in dieser Auswahl.'));$('distribution-facts').textContent='';return}
 const f=deepFrame('distribution-chart',245),y=deepAxisY(f,Math.max(...boxes.map(b=>b.max)),'Abschlüsse je voller KW'),slot=f.pw/boxes.length;
 f.svg.setAttribute('aria-label','Boxplots der vollen Kalenderwochen, gruppiert nach Monat des Sonntags. Median, mittlere 50 Prozent, Minimum und Maximum; alle Wochen als Punkte.');
 boxes.forEach((b,i)=>{
  const xx=f.left+slot*(i+.5),bw=Math.min(44,slot*.46),g=svgEl('g',{tabindex:0,role:'img','data-box-month':b.month,'aria-label':b.month+': Median '+b.median+', '+b.n+' volle KW, Minimum '+b.min+', Maximum '+b.max});
  g.append(svgEl('line',{x1:xx,x2:xx,y1:y(b.max),y2:y(b.min),stroke:'#589b8b','stroke-width':1.5}),svgEl('line',{x1:xx-bw*.3,x2:xx+bw*.3,y1:y(b.max),y2:y(b.max),stroke:'#589b8b'}),svgEl('line',{x1:xx-bw*.3,x2:xx+bw*.3,y1:y(b.min),y2:y(b.min),stroke:'#589b8b'}),svgEl('rect',{x:xx-bw/2,y:y(b.q3),width:bw,height:Math.max(1,y(b.q1)-y(b.q3)),fill:'#d9eee5',stroke:'#589b8b',rx:2}),svgEl('line',{x1:xx-bw/2,x2:xx+bw/2,y1:y(b.median),y2:y(b.median),stroke:'#075c53','stroke-width':2.5}));
  b.points.forEach((p,k)=>g.append(svgEl('circle',{cx:xx+((k%3)-1)*4,cy:y(p.count),r:2.8,fill:'#163f39','fill-opacity':.8,'data-week-point':p.week})));
  const month=new Intl.DateTimeFormat('de-AT',{month:'short',timeZone:'UTC'}).format(utc(b.month+'-15'));g.append(svgEl('text',{x:xx,y:f.height-17,'text-anchor':'middle',class:'axis-text'},month),svgEl('text',{x:xx,y:f.height-3,'text-anchor':'middle',class:'axis-text'},b.n+' KW'));
  const tip=e=>showTip(e,month+' · volle Kalenderwochen',[...averages.describe('distribution-chart',b.month),'Median: '+dec.format(b.median)+' Abschlüsse / KW','Mittlere 50 %: '+dec.format(b.q1)+'–'+dec.format(b.q3),'Min.–Max.: '+b.min+'–'+b.max+' · '+b.n+' Wochen',...b.points.map(p=>kw(p.week)+': '+p.count+' Abschlüsse'),b.n<4?'Wenige Wochen: Verteilung vorsichtig lesen.':'Alle Wochen einschließlich Nullwochen enthalten.']);g.addEventListener('pointerenter',tip);g.addEventListener('focus',tip);g.addEventListener('pointerleave',hideTip);g.addEventListener('blur',hideTip);f.svg.append(g);
 });
 averages.distribution(s,f,boxes,i=>f.left+slot*(i+.5),y);const counts=s.deep.fullWeeks.map(w=>w.count),median=quantile(counts,.5),iqr=quantile(counts,.75)-quantile(counts,.25);$('distribution-facts').textContent=s.deep.fullWeeks.length+' volle KW: Median '+dec.format(median)+', mittlere 50 % von '+dec.format(quantile(counts,.25))+' bis '+dec.format(quantile(counts,.75))+' Abschlüssen. Streubreite dieser Mitte: '+dec.format(iqr)+' Tasks/KW. Jede Punktmarke ist eine echte KW.';
}
const overlayMetrics={
 pace28:{label:'Erledigt pro Woche · 28-Tage-Durchschnitt',unit:'erledigte Tasks / Woche',family:'week',color:'#33765b',hint:'Erledigte Tasks der letzten 28 vollen Kalendertage ÷ 4 Wochen.',description:'Erledigte Tasks der letzten 28 vollen Kalendertage ÷ 4 Wochen. Jeder Punkt zeigt die durchschnittliche Wochenmenge dieses Fensters.',aggregation:'last'},
 incomingPace:{label:'Neu angelegt pro Woche · 28-Tage-Durchschnitt',unit:'neu angelegte Tasks / Woche',family:'week',color:'#b45d25',hint:'Neu angelegte Tasks der letzten 28 vollen Kalendertage ÷ 4 Wochen.',description:'Neu angelegte Tasks der letzten 28 vollen Kalendertage ÷ 4 Wochen, einschließlich noch offener Tasks. Erstellung ist eine Näherung für Eingang; das Zuweisungsdatum fehlt.',aggregation:'last'},
 median8:{label:'Erledigt pro voller KW · Median aus 8 KW',unit:'erledigte Tasks / Woche',family:'week',color:'#7164aa',hint:'Mittlerer Wochenwert deiner letzten 8 vollständigen KW, inklusive Nullwochen.',description:'Median der erledigten Tasks in den letzten 8 vollständig beobachteten Montag–Sonntag-Wochen. Der Median ist der mittlere Wert der sortierten Wochenmengen.',aggregation:'last'},
 open:{label:'Noch offene Tasks · Tagesendstand',unit:'offene Tasks',family:'count',color:'#285d9b',hint:'Bis Tagesende angelegt, bis dahin noch nicht erledigt. Wartende zählen mit.',description:'Bis Tagesende angelegt, noch nicht fertig. Enthält auch wartende Tasks; das misst keinen aktiven Arbeitsbestand.',aggregation:'last'},
 openOld:{label:'Noch offen · seit mehr als 28 Tagen',unit:'offene Tasks',family:'count',color:'#966239',hint:'Noch offene Tasks, deren Erstellung mehr als 28 Kalendertage zurückliegt.',description:'Teilmenge der noch offenen Tasks mit mehr als 28 Kalendertagen seit Erstellung. Liegezeit ist keine Arbeitszeit.',aggregation:'last'},
 cumulative:{label:'Erledigte Tasks · Summe im Zeitraum',unit:'erledigte Tasks insgesamt',family:'count',color:'#697a3b',hint:'Alle Erledigungen seit dem gewählten Beginn, bis zum jeweiligen Tag addiert.',description:'Eindeutige erledigte Tasks ab gewähltem Filter-/Vergleichsbeginn, in dieser Vergleichsansicht nur bis gestern.',aggregation:'last'},
 count:{label:'Erledigt an diesem Tag',unit:'erledigte Tasks / Tag',family:'day',color:'#506d67',hint:'Fertig-Stempel an genau diesem Tag. In der KW-Ansicht werden sie summiert.',description:'Erledigte Tasks je vollständigem Kalendertag. In der KW-Ansicht: Summe der Erledigungen dieser KW. Null Abschlüsse bedeuten nicht null Arbeit.',aggregation:'sum'},
 mean14:{label:'Erledigt pro Tag · 14-Tage-Durchschnitt',unit:'erledigte Tasks / Tag',family:'day',color:'#9c4770',hint:'Erledigte Tasks der letzten 14 vollen Kalendertage ÷ 14, inklusive Nulltagen.',description:'Erledigte Tasks der letzten 14 vollen Kalendertage geteilt durch 14. Zeigt deine durchschnittlichen Erledigungen pro Kalendertag in diesem Fenster, inklusive Tagen ohne Abschluss.',aggregation:'last'},
 phaseChange:{label:'Mehr / weniger erledigt · 28 vs. 28 Tage',unit:'% Änderung der Erledigungen',family:'percent',color:'#a64331',hint:'Wie viel mehr oder weniger du als in den 28 Tagen davor erledigt hast.',description:'100 × (Erledigungen der jüngeren 28 Tage / Erledigungen der vorherigen 28 Tage − 1). +20 % bedeutet ein Fünftel mehr erledigte Tasks in der jüngeren Phase.',aggregation:'last'},
 flowRatio:{label:'Erledigte ÷ neu angelegte Tasks · 28 Tage',unit:'% · erledigt / neu angelegt',family:'percent',color:'#547a20',hint:'Gleiche 28 Tage: 100 % = genauso viele erledigt wie neu angelegt.',description:'100 × erledigte / neu angelegte Tasks im selben 28-Tage-Fenster. Erledigte Tasks können früher angelegt worden sein; die Quote kann über 100 % liegen.',aggregation:'last'},
 cohort7:{label:'Neue Tasks binnen 7 Tagen erledigt',unit:'% der nachbeobachteten Eingänge',family:'percent',color:'#a36f00',hint:'Anteil eines älteren 28-Tage-Eingangszeitraums, der binnen 7 Tagen fertig wurde.',description:'Anteil der neu angelegten Tasks von d−34 bis d−7, die binnen 7 verstrichenen Tagen erledigt wurden. Offene Tasks zählen im Nenner mit. Alle 28 Eingangstage wurden mindestens 7 Tage nachbeobachtet.',aggregation:'last'},
 cohort14:{label:'Neue Tasks binnen 14 Tagen erledigt',unit:'% der nachbeobachteten Eingänge',family:'percent',color:'#327894',hint:'Anteil eines älteren 28-Tage-Eingangszeitraums, der binnen 14 Tagen fertig wurde.',description:'Anteil der neu angelegten Tasks von d−41 bis d−14, die binnen 14 verstrichenen Tagen erledigt wurden. Offene Tasks zählen im Nenner mit. Andere Eingangsgruppe als bei der 7-Tage-Linie.',aggregation:'last'},
 cohort28:{label:'Neue Tasks binnen 28 Tagen erledigt',unit:'% der nachbeobachteten Eingänge',family:'percent',color:'#695291',hint:'Anteil eines älteren 28-Tage-Eingangszeitraums, der binnen 28 Tagen fertig wurde.',description:'Anteil der neu angelegten Tasks von d−55 bis d−28, die binnen 28 verstrichenen Tagen erledigt wurden. Offene Tasks zählen im Nenner mit. Andere Eingangsgruppe als bei der 7-/14-Tage-Linie.',aggregation:'last'}
};
const overlayState={selected:['pace28','incomingPace'],scale:'native',grain:'day',common:false,bounds:{left:{min:'',max:''},right:{min:'',max:''}},notice:''};
const overlayFamily={week:'Tasks / Woche',count:'Tasks · Bestand / kumuliert',day:'Tasks / Tag',percent:'Prozent · siehe Definition der Linie'};
function overlayModelContent(s,settings=overlayState){
 const selected=settings.selected.filter(k=>overlayMetrics[k]),extra=new Map(s.deep.rows.map(d=>[d.day,d]));
 let rows=s.dailySeries.filter(d=>d.day>=state.historyStart&&d.day<today).map(d=>({day:d.day,week:monday(d.day),values:{...d,...extra.get(d.day),incomingPace:d.incoming28===null?null:d.incoming28/4,cumulative:d.comparableCumulative}}));
 if(settings.grain==='week'){
  const groups=new Map();for(const row of rows){if(!groups.has(row.week))groups.set(row.week,[]);groups.get(row.week).push(row)}
  rows=[...groups].map(([week,group])=>{const last=group.at(-1),values={...last.values};for(const key of selected)if(overlayMetrics[key].aggregation==='sum')values[key]=group.reduce((n,d)=>n+(d.values[key]||0),0);return {day:last.day,week,partial:group.length<7,values}});
 }
 if(settings.common&&selected.length){const spans=selected.map(k=>rows.filter(r=>Number.isFinite(r.values[k])));if(spans.some(a=>!a.length))rows=[];else{const start=spans.map(a=>a[0].day).sort().at(-1),end=spans.map(a=>a.at(-1).day).sort()[0];rows=rows.filter(r=>r.day>=start&&r.day<=end)}}
 rows=rows.filter(r=>selected.some(k=>Number.isFinite(r.values[k])));
 const families=[...new Set(selected.map(k=>settings.grain==='week'&&k==='count'?'count':overlayMetrics[k].family))],normalized=settings.scale==='normalized'||families.length>2;
 const axes=normalized?[{family:'normalized',label:'Normierter Verlauf · 0–100, keine Prozentquote',side:'left'}]:families.map((family,i)=>({family,label:overlayFamily[family],side:i?'right':'left'}));
 const lines=selected.map(key=>{const metric=overlayMetrics[key],family=settings.grain==='week'&&key==='count'?'count':metric.family,values=rows.map(r=>r.values[key]).filter(Number.isFinite),min=values.length?Math.min(...values):null,max=values.length?Math.max(...values):null;return {key,...metric,family,label:settings.grain==='week'&&key==='count'?'Erledigt in dieser KW':metric.label,unit:settings.grain==='week'&&key==='count'?'erledigte Tasks / KW (Summe)':metric.unit,axis:normalized?0:families.indexOf(family),min,max,constant:min!==null&&min===max}});
 const chartRows=rows.map(r=>({...r,plot:Object.fromEntries(lines.map(l=>{const value=r.values[l.key];return [l.key,!Number.isFinite(value)?null:normalized?(l.max===l.min?50:100*(value-l.min)/(l.max-l.min)):value]}))}));
 const domains=axes.map((axis,i)=>{
  const values=chartRows.flatMap(r=>lines.filter(l=>l.axis===i).map(l=>r.plot[l.key])).filter(Number.isFinite);
  if(normalized)return {...axis,min:0,max:100,step:25,clipped:0};
  const low=Math.min(0,...values),high=Math.max(0,...values),span=Math.max(1,high-low),step=niceStep(span),autoMin=low<0?Math.floor((low-span*.04)/step)*step:0,autoMax=Math.max(autoMin+step,Math.ceil((high+span*.06)/step)*step),bounds=settings.bounds[axis.side],parse=value=>value!==''&&Number.isFinite(Number(value))?Number(value):null,min=parse(bounds.min)??autoMin,max=parse(bounds.max)??autoMax;
  if(min>=max||!Number.isFinite(max-min))return {...axis,min:autoMin,max:autoMax,step,error:'Gültige Y-Grenzen benötigen Minimum < Maximum und eine endliche Spannweite. Automatische Grenzen werden verwendet.',clipped:0};
  return {...axis,min,max,step:niceStep(max-min),clipped:values.filter(v=>v<min||v>max).length};
 });
 return {rows:chartRows,lines,axes:domains,normalized,autoNormalized:families.length>2&&settings.scale!=='normalized',selected,families};
}
function metricMeaning(line,row){
 const d=row.values,day=row.day,window=n=>dateShort(shift(day,1-n))+'–'+dateShort(day),value=d[line.key];
 if(line.key==='mean14')return Math.round(value*14)+' Tasks vom '+window(14)+' erledigt ÷ 14 Kalendertage = '+dec.format(value)+' erledigte Tasks pro Tag im Durchschnitt. Tage ohne Abschluss zählen mit.';
 if(line.key==='pace28')return d.count28+' Tasks vom '+window(28)+' erledigt ÷ 4 Wochen = '+dec.format(value)+' erledigte Tasks pro Woche im Durchschnitt.';
 if(line.key==='incomingPace')return d.incoming28+' Tasks vom '+window(28)+' neu angelegt ÷ 4 Wochen = '+dec.format(value)+' neue Tasks pro Woche im Durchschnitt. Auch noch offene Tasks zählen hier mit.';
 if(line.key==='count')return overlayState.grain==='week'?fmt(value)+' Tasks vom '+dateShort([row.week,state.historyStart].sort().at(-1))+' bis '+dateShort(day)+' erledigt.'+(row.partial?' Diese KW ist nur teilweise beobachtet.':' Das ist die Summe dieser KW.'):fmt(value)+' Tasks wurden genau an diesem Kalendertag als Fertig markiert.';
 if(line.key==='median8'){const lastWeek=shift(monday(shift(day,1)),-7);return 'Mittlerer Wochenwert der 8 vollen KW vom '+dateShort(shift(lastWeek,-49))+' bis '+dateShort(shift(lastWeek,6))+': '+dec.format(value)+' erledigte Tasks je KW. Nullwochen sind enthalten.'}
 if(line.key==='open')return fmt(value)+' bereits angelegte Tasks hatten am Tagesende noch keinen Fertig-Stempel. Wartende Tasks sind enthalten.';
 if(line.key==='openOld')return fmt(value)+' Tasks waren am Tagesende noch offen und vor mehr als 28 Kalendertagen angelegt worden. Die Zeit kann auch Wartezeit enthalten.';
 if(line.key==='cumulative')return fmt(value)+' Tasks seit '+dateShort([state.from,state.historyStart].sort().at(-1))+' bis '+dateShort(day)+' erledigt, jede Karte einmal gezählt.';
 if(line.key==='phaseChange')return d.count28+' erledigte Tasks vom '+window(28)+' gegenüber '+d.previous28+' vom '+dateShort(shift(day,-55))+'–'+dateShort(shift(day,-28))+'. '+(value===0?'Die Anzahl der Erledigungen ist gleich geblieben.':'Das sind '+dec.format(Math.abs(value))+' % '+(value>0?'mehr':'weniger')+' Erledigungen.');
 if(line.key==='flowRatio')return d.finished28+' erledigte ÷ '+d.incoming28+' neu angelegte Tasks vom '+window(28)+' × 100 = '+dec.format(value)+' %. Auch früher angelegte Tasks zählen im Zähler. 100 % bedeutet: genauso viele erledigt wie neu angelegt.';
 const n=line.key.match(/^cohort(7|14|28)$/)?.[1];if(n)return d['cohortHit'+n]+' von '+d['cohortN'+n]+' neu angelegten Tasks vom '+dateShort(shift(day,-(27+Number(n))))+'–'+dateShort(shift(day,-Number(n)))+' wurden binnen '+n+' Kalendertagen erledigt. Alle hatten bereits mindestens '+n+' Tage Beobachtungszeit; offene Tasks bleiben im Nenner.';
 return line.description;
}
function renderMetricReadouts(model){
 const section=$('metric-readouts'),holder=$('metric-readout-list');holder.replaceChildren();section.hidden=!model.lines.length;
 for(const line of model.lines){const row=model.rows.findLast(r=>Number.isFinite(r.values[line.key])),card=element('article','metric-readout');card.dataset.metricExplanation=line.key;card.style.setProperty('--metric-color',line.color);card.append(element('h4','',line.label));
  if(row){const value=row.values[line.key],number=(line.key==='phaseChange'&&value>0?'+':'')+(Number.isInteger(value)?fmt(value):dec.format(value)),amount=element('p','readout-value',number);amount.append(element('span','',line.unit));card.append(amount,element('p','readout-meaning',metricMeaning(line,row)),element('small','readout-date','Zuletzt berechenbar am '+dateLong(row.day)+(model.normalized?' · Chartwert: '+dec.format(row.plot[line.key])+' auf der normierten Skala 0–100':'')))}else card.append(element('p','readout-meaning','Noch kein berechenbarer Wert in dieser Auswahl. '+line.description));holder.append(card);
 }
}
function drawOverlayContent(s){
 let model=overlayModel(s);const el=$('overlay-chart'),legend=$('overlay-legend');legend.replaceChildren();$('overlay-range').textContent='';
 const axisFamilies=model.axes.map(a=>a.family);if(overlayState.axisFamilies){let changed=false;axisFamilies.forEach((family,i)=>{if(family!==overlayState.axisFamilies[i]){const side=i?'right':'left';overlayState.bounds[side]={min:'',max:''};for(const input of document.querySelectorAll('.axis-bound[data-side="'+side+'"]'))input.value='';changed=true}});if(changed)model=overlayModel(s)}overlayState.axisFamilies=axisFamilies;
 document.querySelector('.overlay-picker summary').textContent='Kennzahlen auswählen · '+model.selected.length+' ausgewählt';renderMetricReadouts(model);renderRelationships(s);
 const mode=model.normalized?'Normierung je Linie auf ihre eigene Spannweite im sichtbaren Zeitraum. 0 = kleinstes, 100 = größtes beobachtetes Niveau; konstant = 50. Das ist kein Produktivitäts-Prozentwert.':model.axes.length===2?'Zwei beschriftete Y-Achsen. Kurvenhöhen verschiedener Einheiten sind nicht direkt vergleichbar.':'Eine gemeinsame Y-Achse mit Originaleinheiten.';
 $('overlay-status').textContent=[overlayState.notice,model.autoNormalized?'Mehr als zwei Einheiten gewählt: automatisch normiert.':'',...model.axes.filter(a=>a.error).map(a=>a.error),...model.axes.filter(a=>a.clipped).map(a=>a.clipped+' Werte außerhalb der manuellen '+(a.side==='left'?'linken':'rechten')+' Y-Grenzen; Tooltip und CSV behalten die Originalwerte.')].filter(Boolean).join(' ');
 $('overlay-explanation').textContent=mode+' X: '+(overlayState.grain==='week'?'KW-Endstand am letzten verfügbaren vollen Tag; Tagesabschlüsse werden je KW summiert, Raten und Quoten als Stichtagswert gezeigt. Teil-KW werden markiert.':'Einheitliche Beobachtungstage in Europe/Vienna; jeder Punkt gehört zum tatsächlichen Datum.')+' Zeitfenster bleiben fest (14/28 Tage bzw. 8 KW). Lücken werden nicht als null gefüllt. Alle Vergleiche bis gestern; vorherige Historie kann für rollierende Werte einfließen.';
 $('overlay-right-bounds').hidden=model.axes.length<2;for(const input of document.querySelectorAll('.axis-bound'))input.disabled=model.normalized;
 for(const line of model.lines){const item=element('span','overlay-legend-item'),swatch=element('i','line-key');swatch.style.background=line.period?'transparent':line.color;if(line.period)swatch.style.borderTop='2px dashed '+line.color;item.append(swatch,document.createTextNode(line.label+' · '+(model.normalized?'0–100 · '+line.unit:(line.axis?'rechts':'links')+' · '+line.unit)+(line.constant?' · konstant':'')));item.title=line.description;legend.append(item)}
 if(!model.selected.length||!model.rows.length||!model.lines.some(l=>l.min!==null)){el.replaceChildren(element('p','chart-empty',!model.selected.length?'Wähle mindestens eine Kennzahl zum Vergleichen.':'Für diese Auswahl gibt es keine berechenbaren Werte. Zeitraum erweitern oder „Nur gemeinsamen Bereich“ ausschalten.'));return}
 const f=deepFrame('overlay-chart',340,58,model.axes.length>1?64:18),rows=model.rows,first=utc(rows[0].day),span=utc(rows.at(-1).day)-first,x=i=>f.left+(span?(utc(rows[i].day)-first)/span*f.pw:f.pw/2),yy=(v,a)=>f.top+f.ph-(v-a.min)/(a.max-a.min)*f.ph;
 f.svg.setAttribute('aria-label','Überlagerter Zeitvergleich mit '+model.lines.length+' Kennzahlen. '+(model.normalized?'Je Linie auf null bis hundert normiert.':model.axes.map(a=>a.side+': '+a.label).join('; ')));
 const defs=svgEl('defs'),clip=svgEl('clipPath',{id:'overlay-clip'});clip.append(svgEl('rect',{x:f.left,y:f.top,width:f.pw,height:f.ph}));defs.append(clip);f.svg.append(defs);
 model.axes.forEach((a,i)=>{
  const ax=i?f.width-f.right:f.left,anchor=i?'start':'end',ticks=[a.min];for(let v=Math.ceil(a.min/a.step)*a.step;v<a.max;v+=a.step)if(v>a.min+1e-8)ticks.push(v);ticks.push(a.max);
  for(const v of ticks){const y=yy(v,a);if(i===0)f.svg.append(svgEl('line',{x1:f.left,x2:f.width-f.right,y1:y,y2:y,stroke:'#e7ece6'}));f.svg.append(svgEl('text',{x:ax+(i?8:-8),y:y+4,'text-anchor':anchor,class:'axis-text'},Number.isInteger(v)?fmt(v):dec.format(v)))}
  f.svg.append(svgEl('text',{x:ax,y:12,'text-anchor':i?'end':'start',class:'axis-text'},model.normalized?'Verlauf 0–100':(i?'Rechts: ':'Links: ')+(a.family==='percent'?'%':a.family==='week'?'Tasks / Woche':a.family==='day'?'Tasks / Tag':'Tasks')));
 });
 deepAxisDates(f,rows,x);
 if(overlayState.grain==='week')for(const t of f.svg.querySelectorAll('text.axis-text')){if(t.getAttribute('y')===String(f.height-12)){const date=rows.find((r,i)=>Math.abs(x(i)-Number(t.getAttribute('x')))<.001);if(date)t.textContent=kw(date.week)+(date.partial?'*':'')}}
 for(const line of model.lines){let path='',prior=null;for(let i=0;i<rows.length;i++){const v=rows[i].plot[line.key];if(v===null){prior=null;continue}const connected=prior!==null&&(overlayState.grain==='week'?rows[i].week===shift(rows[prior].week,7):rows[i].day===shift(rows[prior].day,1));path+=(connected?' L ':' M ')+x(i)+' '+yy(v,model.axes[line.axis]);prior=i}if(path)f.svg.append(svgEl('path',{d:path,fill:'none',stroke:line.color,'stroke-width':line.period?1.8:2.1,'stroke-dasharray':line.dash||'','stroke-linecap':'round','stroke-linejoin':'round','clip-path':'url(#overlay-clip)','data-overlay-series':line.key}));
  // A singleton remains visible, even when no line segment can be drawn.
  rows.forEach((r,i)=>{if(r.plot[line.key]!==null&&(overlayState.grain==='week'||line.min===line.max))f.svg.append(svgEl('circle',{cx:x(i),cy:yy(r.plot[line.key],model.axes[line.axis]),r:2.2,fill:line.color,'clip-path':'url(#overlay-clip)'}))});
 }
 deepHover(f,rows,x,row=>({title:dayLabel(row.day)+(overlayState.grain==='week'?' · '+kw(row.week)+(row.partial?' · Teil-KW':''):''),lines:model.lines.map(l=>{const v=row.values[l.key];let text=l.label+': '+(!Number.isFinite(v)?'nicht berechenbar':dec.format(v)+' '+l.unit+(model.normalized?' · normiert '+dec.format(row.plot[l.key]):''));const n=l.key.match(/^cohort(7|14|28)$/)?.[1];if(n&&Number.isFinite(v))text+=' · '+row.values['cohortHit'+n]+' / '+row.values['cohortN'+n]+' Eingänge vom '+dateShort(shift(row.day,-(27+Number(n))))+'–'+dateShort(shift(row.day,-Number(n)));return text})}),overlayState.grain==='week'?7:1);
 $('overlay-range').textContent=dateLong(rows[0].day)+'–'+dateLong(rows.at(-1).day)+' · '+rows.length+' '+(overlayState.grain==='week'?'KW-Stichtage (* = Teil-KW)':'Kalendertage')+' · '+model.selected.length+' Kennzahlen';
}
function renderDeep(s){drawBacklog(s);drawCohorts(s);averages.cohorts(s);drawDistribution(s);drawOverlay(s)}
function initDeepControls(){
 const choices=$('overlay-choices');for(const [key,metric]of Object.entries(overlayMetrics)){const label=element('label','overlay-choice'),input=document.createElement('input'),swatch=element('i','dot'),text=element('span'),hint=element('small','metric-hint',metric.hint);hint.id='metric-hint-'+key;input.type='checkbox';input.value=key;input.checked=overlayState.selected.includes(key);input.dataset.overlayMetric=key;input.setAttribute('aria-describedby',hint.id);swatch.style.background=metric.color;text.append(element('b','',metric.label),hint);label.append(input,swatch,text);label.title=metric.description;choices.append(label);input.addEventListener('change',()=>{overlayState.selected=[...choices.querySelectorAll('input:checked')].map(i=>i.value);overlayState.notice='';drawOverlay(calc())})}
 $('overlay-scale').addEventListener('change',e=>{overlayState.scale=e.target.value;overlayState.notice='';drawOverlay(calc())});$('overlay-grain').addEventListener('change',e=>{overlayState.grain=e.target.value;overlayState.notice='';drawOverlay(calc())});$('overlay-common').addEventListener('change',e=>{overlayState.common=e.target.checked;drawOverlay(calc())});
 for(const input of document.querySelectorAll('.axis-bound'))input.addEventListener('change',()=>{overlayState.bounds[input.dataset.side][input.dataset.bound]=input.value;drawOverlay(calc())});
 for(const b of document.querySelectorAll('[data-overlay-preset]'))b.addEventListener('click',()=>{const sets={balance:['pace28','incomingPace','open'],response:['cohort7','cohort14','cohort28'],stability:['pace28','median8'],empty:[]};overlayState.selected=sets[b.dataset.overlayPreset];overlayState.scale='native';overlayState.bounds={left:{min:'',max:''},right:{min:'',max:''}};overlayState.notice='';$('overlay-scale').value='native';for(const input of document.querySelectorAll('.axis-bound'))input.value='';for(const input of choices.querySelectorAll('input'))input.checked=overlayState.selected.includes(input.value);syncCustomControls();drawOverlay(calc());if(!b.closest('.overlay-panel'))document.querySelector('.overlay-panel').scrollIntoView({block:'start'})});
 $('overlay-reset-axes').addEventListener('click',()=>{overlayState.bounds={left:{min:'',max:''},right:{min:'',max:''}};for(const input of document.querySelectorAll('.axis-bound'))input.value='';drawOverlay(calc())});
 $('overlay-export').addEventListener('click',()=>{const model=overlayModel(calc());downloadCSV([['Beobachtungsdatum','KW','Teil-KW','Kennzahl','Originalwert','Originaleinheit','Plotwert','Skalierung','Aggregation'],...model.rows.flatMap(r=>model.lines.map(l=>[r.day,kw(r.week),r.partial?'ja':'nein',l.label,Number.isFinite(r.values[l.key])?r.values[l.key]:'',l.unit,r.plot[l.key]??'',model.normalized?'0-100 je Linie':'Originaleinheit',overlayState.grain==='week'?(l.aggregation==='sum'?'Summe':'letzter beobachteter Tagesstand'):'Tageswert']))],'kennzahlen-vergleich.csv')});
 $('deep-export').addEventListener('click',()=>{const s=calc();downloadCSV([['Stichtag','Offene Karten','Bis 7 Tage offen','8 bis 28 Tage offen','Mehr als 28 Tage offen','Median letzte 8 volle KW','7-Tage-Quote reife Eingaenge Prozent','7-Tage-Zaehler','7-Tage-Nenner','14-Tage-Quote reife Eingaenge Prozent','14-Tage-Zaehler','14-Tage-Nenner','28-Tage-Quote reife Eingaenge Prozent','28-Tage-Zaehler','28-Tage-Nenner'],...s.deep.rows.map(d=>[d.day,d.open??'',d.open7??'',d.open28??'',d.openOld??'',d.median8??'',...([7,14,28].flatMap(n=>[d['cohort'+n]??'',d['cohortHit'+n]??'',d['cohortN'+n]??'']))])],'vertiefung-tageswerte.csv')});
}

// Descriptive relationship screening; no causal model or significance claims.
const RELATION_MIN_WEEKS=10;
const relationRoles={pace28:'delivery',count:'delivery',mean14:'delivery',cumulative:'delivery',incomingPace:'arrival',open:'backlog',openOld:'aged',median8:'typical',phaseChange:'shift',flowRatio:'balance',cohort7:'response',cohort14:'response',cohort28:'response'};
const relationShort={pace28:'Erledigt/Woche',count:'Tages-/KW-Abschlüsse',mean14:'Erledigt/Tag',cumulative:'Summe erledigt',incomingPace:'Neu angelegt/Woche',open:'Offener Bestand',openOld:'Älterer Rückstand',median8:'Typische volle KW',phaseChange:'Änderung der Abschlüsse',flowRatio:'Erledigt ÷ neu',cohort7:'Binnen 7 Tagen erledigt',cohort14:'Binnen 14 Tagen erledigt',cohort28:'Binnen 28 Tagen erledigt'};
function averageRanks(values){const order=values.map((v,i)=>({v,i})).sort((a,b)=>a.v-b.v),ranks=Array(values.length);for(let i=0;i<order.length;){let end=i+1;while(end<order.length&&order[end].v===order[i].v)end++;const rank=(i+end+1)/2;for(let j=i;j<end;j++)ranks[order[j].i]=rank;i=end}return ranks}
function rankCorrelation(xs,ys){if(xs.length!==ys.length||xs.length<3||xs.some(v=>!Number.isFinite(v))||ys.some(v=>!Number.isFinite(v)))return null;const x=averageRanks(xs),y=averageRanks(ys),mx=x.reduce((a,b)=>a+b,0)/x.length,my=y.reduce((a,b)=>a+b,0)/y.length;let xy=0,xx=0,yy=0;for(let i=0;i<x.length;i++){const dx=x[i]-mx,dy=y[i]-my;xy+=dx*dy;xx+=dx*dx;yy+=dy*dy}return xx&&yy?Math.max(-1,Math.min(1,xy/Math.sqrt(xx*yy))):null}
function relationshipEvidence(observations){
 const rows=observations.filter(r=>Number.isFinite(r.x)&&Number.isFinite(r.y)).sort((a,b)=>a.week.localeCompare(b.week)),n=rows.length,rho=rankCorrelation(rows.map(r=>r.x),rows.map(r=>r.y));
 const changes=[];for(let i=1;i<rows.length;i++)if(rows[i].week===shift(rows[i-1].week,7))changes.push({x:rows[i].x-rows[i-1].x,y:rows[i].y-rows[i-1].y});
 const deltaRho=rankCorrelation(changes.map(r=>r.x),changes.map(r=>r.y)),uniqueX=new Set(rows.map(r=>r.x)).size,uniqueY=new Set(rows.map(r=>r.y)).size;
 const loo=n>=RELATION_MIN_WEEKS&&rho!==null?rows.map((_,i)=>{const subset=rows.filter((r,j)=>j!==i);return rankCorrelation(subset.map(r=>r.x),subset.map(r=>r.y))}).filter(Number.isFinite):[],looMin=loo.length?Math.min(...loo):null,looMax=loo.length?Math.max(...loo):null;
 const stable=rho!==null&&loo.length===n&&loo.every(v=>Math.sign(v)===Math.sign(rho)&&Math.abs(v)>=.3),eligible=n>=RELATION_MIN_WEEKS&&changes.length>=8&&uniqueX>=4&&uniqueY>=4;
 const qualifies=eligible&&rho!==null&&deltaRho!==null&&Math.abs(rho)>=.55&&Math.abs(deltaRho)>=.35&&Math.sign(rho)===Math.sign(deltaRho)&&stable;
 return {n,changeN:changes.length,rho,deltaRho,looMin,looMax,stable,eligible,qualifies,uniqueX,uniqueY,from:rows[0]?.week||null,to:rows.at(-1)?.week||null};
}
function mechanicallyRelated(a,b){
 const output=new Set(['pace28','count','mean14','cumulative','median8','phaseChange']);
 return a==='cumulative'||b==='cumulative'||(output.has(a)&&output.has(b))||(['open','openOld'].includes(a)&&['open','openOld'].includes(b))||(a==='flowRatio'&&(output.has(b)||b==='incomingPace'))||(b==='flowRatio'&&(output.has(a)||a==='incomingPace'))||(a.startsWith('cohort')&&b.startsWith('cohort'));
}
function buildRelationshipAnalysis(s){
 const keys=Object.keys(overlayMetrics),settings={selected:keys,scale:'native',grain:'week',common:false,bounds:{left:{min:'',max:''},right:{min:'',max:''}}},full=new Set(s.deep.fullWeeks.map(w=>w.week));
 const weekly=overlayModel(s,settings).rows.filter(r=>!r.partial&&full.has(r.week)).map(r=>({...r,created:s.dailySeries.filter(d=>d.day>=r.week&&d.day<=r.day).reduce((n,d)=>n+d.incomingDaily,0)}));
 const availability=Object.fromEntries(keys.map(key=>{const vals=weekly.map(w=>w.values[key]).filter(Number.isFinite);return [key,{n:vals.length,unique:new Set(vals).size,usable:vals.length>=3&&new Set(vals).size>=2}]}));
 const pairs=[];for(let i=0;i<keys.length;i++)for(let j=i+1;j<keys.length;j++){const a=keys[i],b=keys[j],evidence=relationshipEvidence(weekly.map(w=>({week:w.week,x:w.values[a],y:w.values[b]}))),mechanical=mechanicallyRelated(a,b);pairs.push({a,b,...evidence,mechanical,qualified:!mechanical&&evidence.qualifies})}
 const raw=relationshipEvidence(weekly.map(w=>({week:w.week,x:w.created,y:w.values.count}))),observations=deriveRelationshipInsights(s,weekly,raw);
 return {weekly,availability,pairs,raw,observations,from:weekly[0]?.week||null,to:weekly.at(-1)?.day||null,screened:pairs.length};
}
let relationshipCache=null;
function currentRelationshipAnalysis(s){const key=JSON.stringify([state.from,state.to,state.project,state.excludeSpecial,state.historyStart,DATA.meta.snapshot_at]);if(relationshipCache?.key!==key)relationshipCache={key,value:buildRelationshipAnalysis(s)};return relationshipCache.value}
const semanticLinks={
 'arrival|delivery':{weight:.72,why:'Vergleicht die neue Aufgabenmenge mit der erledigten Menge.'},
 'backlog|delivery':{weight:.65,why:'Zeigt neben den Erledigungen, wie viel weiterhin offen bleibt.'},
 'arrival|backlog':{weight:.68,why:'Verbindet neue Aufgaben mit dem offenen Bestand.'},
 'delivery|response':{weight:.54,why:'Ergänzt die erledigte Menge um den Anteil neuer Tasks, die zeitnah fertig werden.'},
 'arrival|response':{weight:.52,why:'Zeigt neben der Eingangsmenge, wie schnell diese neuen Tasks fertig werden.'},
 'backlog|response':{weight:.55,why:'Vergleicht liegenbleibende Aufgaben mit der Erledigung neuer Aufgaben.'},
 'aged|backlog':{weight:.74,why:'Zerlegt den offenen Bestand: Wie viel davon ist bereits älter als 28 Tage?'},
 'aged|response':{weight:.57,why:'Trennt ältere offene Karten von der Erledigung neuer Eingänge.'},
 'delivery|typical':{weight:.60,why:'Vergleicht die aktuelle Menge mit dem mittleren Niveau voller Wochen. Beide beruhen auf denselben Fertig-Stempeln.'},
 'delivery|shift':{weight:.70,why:'Ergänzt die Prozentänderung um die tatsächliche erledigte Menge; rechnerischer Kontext.'},
 'shift|typical':{weight:.52,why:'Zeigt, ob eine kurzfristige Mengenänderung neben einem veränderten typischen Wochenniveau steht.'},
 'arrival|balance':{weight:.76,why:'Zeigt den Nenner der Quote: wie viele Tasks neu angelegt wurden.'},
 'balance|delivery':{weight:.76,why:'Zeigt den Zähler der Quote: wie viele Tasks erledigt wurden.'},
 'backlog|balance':{weight:.70,why:'Unter 100 % übersteigt der Eingang die Erledigungen; der erfasste Bestand wächst rechnerisch.'}
};
function semanticRelation(a,b){return semanticLinks[[relationRoles[a],relationRoles[b]].sort().join('|')]||null}
const relationshipGroups=[
 {id:'balance',name:'Eingang → Erledigung → offener Bestand',roles:['arrival','delivery','backlog'],priority:1,why:'Neue minus erledigte Tasks ergeben die Änderung des offenen Bestands. Die geglätteten Linien behalten ihre jeweils beschrifteten Zeitfenster.'},
 {id:'aging',name:'Neues erledigen, älteren Rückstand erkennen',roles:['backlog','aged','response'],priority:.85,why:'Bestand und Alter zeigen, was liegen bleibt; die Erledigungsquote zeigt, wie neue Eingänge abgearbeitet werden.'},
 {id:'stability',name:'Aktuelle Menge, typische Woche und Veränderung',roles:['delivery','typical','shift'],priority:.65,why:'Drei Perspektiven derselben Fertig-Stempel. Sie helfen bei der Einordnung, liefern aber keine drei unabhängigen Leistungsbeweise.'},
 {id:'ratio',name:'Die Eingangsquote mit ihren Ausgangsmengen lesen',roles:['arrival','delivery','balance'],priority:.78,why:'Zähler und Nenner erklären die Quote. Die Quote fügt rechnerisch keine neue unabhängige Messung hinzu.'},
 {id:'extended',name:'Menge, offener Bestand, Alter, Erledigung und Regelmäßigkeit',roles:['arrival','delivery','backlog','aged','response','typical'],priority:1.2,extended:true,why:'Diese sechs Perspektiven ergänzen sich: neue und fertige Tasks, verbleibender Bestand, sein Alter, die Erledigung neuer Tasks und das typische Wochenniveau.'}
];
function recommendRelationships(analysis,selection){
 const selected=[...new Set(selection.filter(k=>overlayMetrics[k]))],selectedRoles=new Set(selected.map(k=>relationRoles[k])),eligibleKeys=Object.keys(overlayMetrics).filter(k=>analysis.availability[k].usable),candidates=[];
 for(const key of eligibleKeys){if(selected.includes(key)||selectedRoles.has(relationRoles[key])||!selected.length)continue;
  const linksByRole=new Map();for(const other of selected){const semantic=semanticRelation(key,other),pair=analysis.pairs.find(p=>(p.a===key&&p.b===other)||(p.b===key&&p.a===other)),empirical=pair?.qualified,link={other,semantic,pair,weight:Math.max(semantic?.weight||0,empirical ? .72+.20*Math.abs(pair.rho) : 0)},role=relationRoles[other];if(!linksByRole.has(role)||linksByRole.get(role).weight<link.weight)linksByRole.set(role,link)}const links=[...linksByRole.values()];
  const positive=links.filter(l=>l.weight>0).sort((a,b)=>b.weight-a.weight);if(!positive.length)continue;
  const strongest=positive[0],top=positive.slice(0,3),coverage=new Set(positive.map(l=>relationRoles[l.other])).size/Math.max(1,selectedRoles.size);
  let score=.65*strongest.weight+.25*top.reduce((n,l)=>n+l.weight,0)/top.length+.1*coverage+.04;
  if(relationRoles[key]==='backlog'&&selectedRoles.has('delivery')&&selectedRoles.has('arrival'))score+=.16;
  if(['shift','balance'].includes(relationRoles[key]))score-=.13;
  const empirical=positive.filter(l=>l.pair?.qualified).sort((a,b)=>Math.abs(b.pair.deltaRho)-Math.abs(a.pair.deltaRho))[0];
  const reason=empirical?'Mit „'+relationShort[empirical.other]+'“ '+(empirical.pair.rho>0?'gleichläufig':'gegenläufig')+': Rangkorrelation ρ='+precise.format(empirical.pair.rho)+' in '+empirical.pair.n+' vollen KW; auch die KW-Änderungen passen dazu (ρ='+precise.format(empirical.pair.deltaRho)+'). Beobachtung, keine Ursache.':strongest.semantic?.why;
  if(score>=.55)candidates.push({key,role:relationRoles[key],score:Math.min(1,score),reason,kind:empirical?'observed':'context',partner:empirical?.other||strongest.other,pair:empirical?.pair||null,links:positive.map(l=>l.other)});
 }
 // One useful representative of each new perspective; equivalent smoothings do not crowd the list.
 const preferred={pace28:.035,cohort7:.025,cohort14:.01};candidates.sort((a,b)=>(b.score+(preferred[b.key]||0))-(a.score+(preferred[a.key]||0))||a.key.localeCompare(b.key));
 const seen=new Set(),recommendations=candidates.filter(c=>{if(seen.has(c.role))return false;seen.add(c.role);return true}).map((c,i)=>({...c,rank:i+1}));
 const byRole=new Map();for(const key of selected)if(!byRole.has(relationRoles[key]))byRole.set(relationRoles[key],key);for(const c of recommendations)if(!byRole.has(c.role))byRole.set(c.role,c.key);
 const groups=relationshipGroups.filter(g=>!g.extended||['delivery','arrival','backlog'].every(r=>selectedRoles.has(r))).map(g=>{const members=g.roles.map(r=>byRole.get(r)),matched=g.roles.filter(r=>selectedRoles.has(r)).length,missing=members.filter(k=>k&&!selected.includes(k));return {...g,members,matched,missing,complete:matched===g.roles.length,valid:members.every(k=>k&&analysis.availability[k].usable)&&matched>0,score:matched+.4*g.priority-.08*missing.length}}).filter(g=>g.valid).sort((a,b)=>b.score-a.score);
 const next=groups.find(g=>g.missing.length),completed=groups.find(g=>g.complete),bundles=[next,completed].filter((g,i,a)=>g&&a.findIndex(v=>v?.id===g.id)===i).slice(0,2),outlined=[...new Set(bundles.flatMap(g=>g.members))];
 const duplicateRoles=[...selectedRoles].filter(r=>selected.filter(k=>relationRoles[k]===r).length>1);
 return {selected,recommendations,bundles,outlined,duplicateRoles,exhausted:selected.length>0&&!recommendations.length};
}
function deriveRelationshipInsights(s,weekly,raw){
 const insights=[],last=s.latestFlow,completed=s.context.completed,intake=s.context.intake;
 if(last){
  const end=last.day,start=shift(end,-27),created=intake.filter(t=>t.created_date>=start&&t.created_date<=end),done=completed.filter(t=>t.output_date>=start&&t.output_date<=end),openEnd=intake.filter(t=>t.created_date<=end&&(!t.done_date||t.done_date>end)).length,openStart=openEnd-created.length+done.length,delta=created.length-done.length;
  insights.push({id:'balance',headline:delta>0?'Der erfasste offene Bestand wächst':delta<0?'Du baust erfassten Rückstand ab':'Eingang und Erledigungen sind ausgeglichen',body:done.length+' erledigte Tasks bei '+created.length+' neu angelegten Tasks. Der offene Bestand ging von '+openStart+' auf '+openEnd+'.',evidence:dateShort(start)+'–'+dateShort(end)+' · '+created.length+' neu − '+done.length+' erledigt = '+(delta>0?'+':'')+delta+' offene Tasks',conclusion:delta>0?'In diesem Fenster kam mehr dazu, als fertig wurde. Ob zusätzliche Kapazität oder andere Prioritäten nötig sind, lässt sich daraus allein nicht ablesen.':delta<0?'Du hast mehr Tasks fertiggestellt, als neu dazugekommen sind. Das ist erfasster Rückstandsabbau.':'Die erfasste Aufgabenmenge ist in diesem Fenster ausgeglichen.',roles:['arrival','delivery','backlog','balance'],metrics:['pace28','incomingPace','open','flowRatio'],priority:1,facts:{created:created.length,done:done.length,openStart,openEnd,delta,start,end}});
  const old=intake.filter(t=>t.created_date<start&&(!t.done_date||t.done_date>=start)),oldDone=old.filter(t=>t.done_date&&t.done_date<=end).length,oldRemaining=old.length-oldDone,newDone=created.filter(t=>t.done_date&&t.done_date<=end).length,newOpen=created.length-newDone;
  if(created.length&&old.length)insights.push({id:'older',headline:oldRemaining/old.length>newOpen/created.length+.1?'Neue Tasks werden erledigt, ältere bleiben häufiger offen':'Neue und ältere Tasks getrennt betrachtet',body:newDone+' von '+created.length+' neuen Tasks waren bis zum Stichtag fertig. Von den '+old.length+' schon am Fensterbeginn offenen Tasks wurden '+oldDone+' erledigt; '+oldRemaining+' blieben offen.',evidence:dateShort(start)+'–'+dateShort(end)+' · '+newDone+' neue + '+oldDone+' ältere = '+done.length+' Erledigungen',conclusion:oldRemaining?'Für den JF lohnt sich der Blick auf diese '+oldRemaining+' älteren offenen Karten: Welche warten absichtlich, welche sind blockiert? Die Zahlen zeigen den offenen Bestand, keinen Arbeitsaufwand.':'Auch der am Fensterbeginn offene Bestand wurde in diesem Zeitraum erledigt.',roles:['backlog','aged','response','delivery'],metrics:['open','openOld','cohort7','pace28'],priority:.95,facts:{newDone,newTotal:created.length,newOpen,oldStart:old.length,oldDone,oldRemaining,start,end}});
  const priorStart=shift(start,-28),priorEnd=shift(start,-1);
  if(priorStart>=state.historyStart){const priorDone=completed.filter(t=>t.output_date>=priorStart&&t.output_date<=priorEnd).length,priorCreated=intake.filter(t=>t.created_date>=priorStart&&t.created_date<=priorEnd).length,doneChange=priorDone?(done.length/priorDone-1)*100:null,inputChange=priorCreated?(created.length/priorCreated-1)*100:null;
   if(doneChange!==null&&inputChange!==null)insights.push({id:'phase',headline:doneChange<0&&inputChange<0?'Weniger Erledigungen treffen auf weniger neue Tasks':doneChange>0&&inputChange>0?'Mehr Erledigungen treffen auf mehr neue Tasks':'Eingang und Erledigungen entwickeln sich unterschiedlich',body:'Erledigt: '+priorDone+' → '+done.length+' ('+(doneChange>0?'+':'')+dec.format(doneChange)+' %). Neu angelegt: '+priorCreated+' → '+created.length+' ('+(inputChange>0?'+':'')+dec.format(inputChange)+' %).',evidence:dateShort(priorStart)+'–'+dateShort(priorEnd)+' gegenüber '+dateShort(start)+'–'+dateShort(end)+' · je 28 volle Tage',conclusion:doneChange<0&&inputChange<0?(doneChange<inputChange?'Die erledigte Menge sank stärker als der Eingang. Eine reine Aussage „langsamer geworden“ würde den veränderten Eingang ausblenden.':'Beide Mengen gingen zurück; die Erledigungen gingen prozentual weniger stark zurück.'):'Für die Einordnung gehören beide Mengen zusammen. Das beschreibt gemeinsame Entwicklungen und belegt keine Ursache.',roles:['arrival','delivery','shift','balance'],metrics:['pace28','incomingPace','phaseChange','flowRatio'],priority:.85,facts:{priorDone,done:done.length,priorCreated,created:created.length,doneChange,inputChange,priorStart,priorEnd,start,end}});
  }
 }
 if(weekly.length>=16){const recent=weekly.slice(-8),previous=weekly.slice(-16,-8),recentDone=quantile(recent.map(w=>w.values.count),.5),previousDone=quantile(previous.map(w=>w.values.count),.5),recentInput=quantile(recent.map(w=>w.created),.5),previousInput=quantile(previous.map(w=>w.created),.5);
  insights.push({id:'typical',headline:recentDone>previousDone?'Die typische Wochenmenge liegt längerfristig höher':recentDone<previousDone?'Die typische Wochenmenge liegt längerfristig niedriger':'Die typische Wochenmenge ist gleich geblieben',body:'Median erledigt pro voller KW: '+dec.format(previousDone)+' → '+dec.format(recentDone)+'. Median neu angelegt: '+dec.format(previousInput)+' → '+dec.format(recentInput)+'.',evidence:dateShort(previous[0].week)+'–'+dateShort(previous.at(-1).day)+' gegenüber '+dateShort(recent[0].week)+'–'+dateShort(recent.at(-1).day)+' · zwei getrennte Abschnitte mit je 8 vollen KW',conclusion:recentDone===previousDone&&recentInput===previousInput?'Beide mittleren Wochenwerte sind in diesen Abschnitten gleich geblieben. Einzelne Wochen können trotzdem deutlich schwanken.':Math.sign(recentDone-previousDone)===Math.sign(recentInput-previousInput)?'Die typische erledigte Menge und der typische Eingang veränderten sich in dieselbe Richtung. Mehr erledigte Tasks allein belegen daher keinen Effizienzgewinn.':'Die typische erledigte Menge und der typische Eingang veränderten sich unterschiedlich. Taskgröße und tatsächliche Arbeitszeit sind dabei weiterhin unbekannt.',roles:['delivery','typical','arrival','shift'],metrics:['pace28','median8','incomingPace','phaseChange'],priority:.8,facts:{recentDone,previousDone,recentInput,previousInput,recentFrom:recent[0].week,recentTo:recent.at(-1).day,previousFrom:previous[0].week,previousTo:previous.at(-1).day}});
 }
 if(raw.qualifies){const threshold=quantile(weekly.map(w=>w.created),.5),high=weekly.filter(w=>w.created>threshold),low=weekly.filter(w=>w.created<=threshold),highMedian=quantile(high.map(w=>w.values.count),.5),lowMedian=quantile(low.map(w=>w.values.count),.5);
  insights.push({id:'raw-association',headline:raw.rho>0?'Wochen mit mehr Eingang haben auch mehr Erledigungen':'Wochen mit mehr Eingang haben weniger Erledigungen',body:'In '+raw.n+' vollen KW: Rangkorrelation ρ='+precise.format(raw.rho)+'. Auch die Änderungen von KW zu KW zeigen dieselbe Richtung (ρ='+precise.format(raw.deltaRho)+').',evidence:dateShort(weekly[0].week)+'–'+dateShort(weekly.at(-1).day)+' · echte Wochenmengen, keine geglätteten Tagespunkte',conclusion:'Bei mehr als '+dec.format(threshold)+' neuen Tasks je KW lag der Median der Erledigungen bei '+dec.format(highMedian)+' ('+high.length+' KW); sonst bei '+dec.format(lowMedian)+' ('+low.length+' KW). Der Zusammenhang allein erklärt keine Ursache.',roles:['arrival','delivery'],metrics:['pace28','incomingPace','count'],priority:.9,facts:{...raw,threshold,highMedian,lowMedian,highN:high.length,lowN:low.length}});
 }
 return insights;
}
function applyRelationshipSelection(keys){for(const key of keys)if(!overlayState.selected.includes(key))overlayState.selected.push(key);for(const input of $('overlay-choices').querySelectorAll('input'))input.checked=overlayState.selected.includes(input.value);overlayState.notice='';drawOverlay(calc())}
function renderRelationships(s){
 const analysis=currentRelationshipAnalysis(s),matches=recommendRelationships(analysis,overlayState.selected),byKey=new Map(matches.recommendations.map(r=>[r.key,r])),outlined=new Set(matches.outlined);
 for(const input of $('overlay-choices').querySelectorAll('input')){
  const key=input.value,label=input.closest('label'),match=byKey.get(key);label.classList.toggle('relationship-match',Boolean(match));label.classList.toggle('relationship-set',outlined.has(key));label.dataset.matchRank=match?.rank||'';label.dataset.relationshipSet=matches.bundles.filter(g=>g.members.includes(key)).map(g=>g.id).join(' ');label.style.setProperty('--match-opacity',match?String(.025+.035*match.score):'0');
  let signal=label.querySelector('.relationship-signal');if(!signal){signal=element('small','relationship-signal');signal.id='match-reason-'+key;label.querySelector('span').append(signal)}signal.hidden=!match&&!outlined.has(key);
  signal.textContent=match?'Vorschlag '+match.rank+' · '+(match.kind==='observed'?'beobachtetes Muster':'ergänzende Perspektive')+(outlined.has(key)?' · passt ins Set':''):outlined.has(key)?'Passt ins gemeinsame Set':'';signal.title=match?.reason||'';input.setAttribute('aria-describedby','metric-hint-'+key+(!signal.hidden?' '+signal.id:''));
 }
 const available=matches.recommendations.length;
 $('relationship-status').textContent=!matches.selected.length?'Wähle eine Kennzahl. Danach werden passende Ergänzungen aus dem aktuellen Datensatz neu berechnet.':available?available+' passende Ergänzung'+(available===1?'':'en')+' zur gesamten Auswahl. Hell gefüllt = Vorschlag; umrandet = gemeinsam sinnvolles Set.':analysis.weekly.length<3?'Für Vorschläge fehlen mindestens 3 volle KW mit veränderlichen Werten. Die Kennzahlen bleiben auswählbar.':'Keine weitere eigenständige Perspektive mit ausreichenden Daten gefunden. Andere Glättungen derselben Mengen bleiben manuell auswählbar.';
 if(matches.duplicateRoles.length)$('relationship-status').textContent+=' Mehrere gewählte Linien beschreiben dieselbe Perspektive; sie zählen bei der Empfehlung gemeinsam als eine.';
 const groupHolder=$('relationship-bundles');groupHolder.replaceChildren();for(const group of matches.bundles){const card=element('article','relationship-bundle');card.dataset.bundle=group.id;card.append(element('h4','',group.name),element('p','',group.members.map(k=>relationShort[k]).join(' + ')),element('small','',group.why));if(group.missing.length){const add=element('button','relationship-add','Set ergänzen · '+group.missing.length+' Kennzahl'+(group.missing.length===1?'':'en'));add.type='button';add.addEventListener('click',()=>applyRelationshipSelection(group.missing));card.append(add)}else card.append(element('span','relationship-complete','Set vollständig gewählt'));groupHolder.append(card)}
 const list=$('relationship-recommendations');list.replaceChildren();for(const match of matches.recommendations){const li=element('li'),button=element('button','relationship-add',relationShort[match.key]+' hinzufügen');button.type='button';button.dataset.addMetric=match.key;button.addEventListener('click',()=>applyRelationshipSelection([match.key]));li.append(button,element('p','',match.reason));list.append(li)}$('relationship-why').hidden=!available;
 const selectedRoles=new Set(matches.selected.map(k=>relationRoles[k])),insightHolder=$('relationship-insight-list');insightHolder.replaceChildren();const observations=[...analysis.observations].sort((a,b)=>{const score=o=>o.priority+.12*o.roles.filter(r=>selectedRoles.has(r)).length;return score(b)-score(a)});
 for(const insight of observations){const card=element('article','relationship-insight');card.dataset.relationshipInsight=insight.id;card.append(element('h4','',insight.headline),element('p','insight-body',insight.body),element('p','insight-conclusion',insight.conclusion),element('small','insight-evidence',insight.evidence));insightHolder.append(card)}if(!observations.length)insightHolder.append(element('p','relationship-empty','Für belastbare Zeitfenster-Vergleiche fehlen hier noch vollständige Daten. Zeitraum erweitern; fehlende Werte werden nicht ergänzt.'));
 $('relationship-basis').textContent=analysis.weekly.length+' volle KW im Filter für die Zusammenhangssuche'+(analysis.from?' · '+dateShort(analysis.from)+'–'+dateShort(analysis.to):'')+'. '+analysis.screened+' Kennzahlenpaare geprüft; '+analysis.pairs.filter(p=>p.qualified).length+' bestehen die beschreibenden Auswahlregeln. Zeitfenster-Befunde zeigen ihre eigenen Datumsbereiche und können nötige Vorgeschichte vor dem Filterbeginn verwenden.';
 const table=$('relationship-evidence-body');table.replaceChildren();const selected=new Set(matches.selected),shown=analysis.pairs.filter(p=>selected.has(p.a)||selected.has(p.b)).sort((a,b)=>Number(b.qualified)-Number(a.qualified)||Math.abs(b.rho||0)-Math.abs(a.rho||0));for(const pair of shown){const row=element('tr');row.append(element('td','',relationShort[pair.a]+' ↔ '+relationShort[pair.b]),element('td','',fmt(pair.n)),element('td','',pair.rho===null?'—':precise.format(pair.rho)),element('td','',pair.deltaRho===null?'—':precise.format(pair.deltaRho)),element('td','',pair.mechanical?'Gleiche Quelle / rechnerisch verwandt':pair.qualified?'Beobachtetes Muster':!pair.eligible?'Zu wenig Variation / Daten':'Kein ausreichend konsistentes Muster'));table.append(row)}
 window.relationshipSummary={weeklyCount:analysis.weekly.length,screened:analysis.screened,qualified:analysis.pairs.filter(p=>p.qualified).length,recommendations:matches.recommendations.map(r=>r.key),outlined:matches.outlined,bundles:matches.bundles.map(g=>g.id),findings:observations.map(o=>({id:o.id,...o.facts}))};
}


function renderProjects(s){const holder=$('projects');holder.replaceChildren();if(!s.ranks.length){holder.append(element('p','no-data','Keine Abschlüsse in dieser Auswahl.'));return}for(const [p,count]of s.ranks){const button=element('button','project-row');button.type='button';button.setAttribute('aria-label',p+' auswählen: '+count+' Abschlüsse');const row=element('div','project-top'),amount=element('span','project-amount',fmt(count));amount.append(element('span','project-share',pct(count/s.total*100)));row.append(element('span','project-name',p),amount);const track=element('div','track'),fill=element('div','fill');fill.style.width=count/s.total*100+'%';track.append(fill);button.append(row,track);button.addEventListener('click',()=>{state.project=state.project===p?'':p;$('project-filter').value=state.project;state.page=0;render()});holder.append(button)}}
function fact(label,value,note){const e=element('div');e.append(element('div','fact-label',label),element('div','fact-number',value),element('div','fact-note',note));return e}
function renderFacts(s){
 const days=['Mo','Di','Mi','Do','Fr','Sa','So'],max=Math.max(1,...s.weekday),holder=$('weekdays');holder.replaceChildren();s.weekday.forEach((count,i)=>{const col=element('div','day-col'+(count===max?' peak':'')),track=element('div','day-track'),bar=element('div','day-bar');bar.style.height=Math.max(2,count/max*97)+'px';track.append(bar);col.append(element('div','day-count',fmt(count)),track,element('div','day-label',days[i]));col.setAttribute('aria-label',days[i]+': '+count+' Abschlüsse');holder.append(col)});
 $('facts').replaceChildren(fact('Tage mit Fertig-Stempeln',fmt(Object.keys(s.daily).length),'Nulltage sagen nichts über die Arbeit an offenen Tasks.'),fact('Stärkster Abschluss-Tag',s.dayRanks.length?fmt(s.dayRanks[0][1]):'—',s.dayRanks.length?dateLong(s.dayRanks[0][0]):'Keine Abschlüsse'),fact('Ø je voller KW',s.avg===null?'—':dec.format(s.avg),'Liefermenge; kein Stunden- oder Schwierigkeitsvergleich'),fact('Lange Offenzeiten',fmt(s.longOpen),'Über '+hours(AUDIT.fence)+' seit Erstellung · statistisch markiert'),fact('Median Offenzeit · alle Karten',hours(s.medianDuration),'Erstellung → Fertig. Keine aktive Arbeitszeit.'),fact('Median ohne lange Offenzeiten',hours(s.regularMedian),'Nur Diagnose der Liegezeit; echte Abschlüsse bleiben im Tempo.'));
 const types=$('types');types.replaceChildren();for(const [label,count]of Object.entries(s.labels)){const span=element('span');span.append(element('b','',fmt(count)),document.createTextNode(label));types.append(span)}types.append(element('small','',s.typed+' von '+s.total+' Karten haben mindestens eines dieser Labels. Mehrfachlabels möglich; keine aus Titeln geratenen Aufwandsgewichte.'));
 const lead=s.ranks[0];$('insight').textContent=!s.total?'Keine Abschlüsse im gewählten Zeitraum. Der Trend kann Vorgeschichte vor dem Filterbeginn enthalten.':lead[0]+' macht '+pct(lead[1]/s.total*100)+' der Abschlüsse aus. '+(s.best?kw(s.best.week)+' war mit '+s.best.count+' die stärkste volle Abschlusswoche. ':'')+'Keine Arbeitsstunden aus Liegezeiten: Langläufer beeinflussen das Tempo nur als ein fertiger Task. Arbeit zwischen den Stempeln ist nicht erfasst.';
}
function detailedTasks(s){let rows=s.dailyTasks.filter(t=>!state.detailDay||t.output_date===state.detailDay);const q=state.search.toLocaleLowerCase('de');if(q)rows=rows.filter(t=>(t.title+' '+t.project+' '+t.labels.join(' ')).toLocaleLowerCase('de').includes(q));return rows.sort((a,b)=>(b.output_date||'').localeCompare(a.output_date||'')||(b.completed_at||'').localeCompare(a.completed_at||'')||a.id.localeCompare(b.id))}
function renderTable(s){
 $('detail-day').replaceChildren(option('','Alle angezeigten Tage'));for(const d of [...s.dailySeries].reverse())$('detail-day').append(option(d.day,dayLabel(d.day)+' · '+d.count+' Tasks'));$('detail-day').value=state.detailDay;
 $('clear-day').hidden=!state.detailDay;
 const rows=detailedTasks(s),pageCount=Math.max(1,Math.ceil(rows.length/PAGE_SIZE));state.page=Math.min(state.page,pageCount-1);
 $('table-sub').textContent=rows.length+' passende Tasks · nach Fertig-Tag gruppiert'+(state.detailDay?' · '+dayLabel(state.detailDay):'')+(state.search?' · Suche aktiv':'');
 const body=$('tasks-body');body.replaceChildren();let lastDay=null;
 for(const t of (printing?rows:rows.slice(state.page*PAGE_SIZE,(state.page+1)*PAGE_SIZE))){
  if(t.output_date!==lastDay){const group=element('tr','day-group'),cell=element('td');cell.colSpan=6;const sameDay=rows.filter(row=>row.output_date===t.output_date);cell.textContent=dayLabel(t.output_date)+' · '+sameDay.length+' Tasks';group.dataset.date=t.output_date;group.append(cell);body.append(group);lastDay=t.output_date}
  const tr=element('tr');tr.dataset.taskId=t.id;const name=element('td','task-name',t.title),tags=element('div','task-tags');
  for(const l of t.labels.filter(l=>['Bug','Feature','Anpassung'].includes(l)))tags.append(element('span','task-tag',l));
  if(t.completion_source==='archive-fallback')tags.append(element('span','task-tag notice','Archivdatum als Ersatzstempel'));if(t.longOpen)tags.append(element('span','task-tag outlier','Lange Offenzeit · kein Aufwandgewicht'));if(t.isTest)tags.append(element('span','task-tag notice','Testkarte · enthalten'));if(t.isPaused)tags.append(element('span','task-tag notice','Pausiert/Abgelehnt · enthalten'));if(t.project==='Ohne Projekt')tags.append(element('span','task-tag notice','Projekt nicht auflösbar'));if(t.deleted_at)tags.append(element('span','task-tag notice','Gelöschte Karte · Stempel erhalten'));if(tags.childElementCount)name.append(tags);
  const stamp=value=>{const e=element('td','date date-time',value?dateShort(value.slice(0,10)):'—');if(value)e.append(element('small','',value.slice(11)));return e};
  tr.append(name,element('td','',t.project),stamp(t.created_local),stamp(t.finished_local),element('td','duration-cell',t.duration_hours===null?'—':precise.format(t.duration_hours)),element('td','date',dateShort(t.archive_date)));body.append(tr);
 }
 if(!rows.length){const tr=element('tr'),td=element('td','table-empty','Keine Tasks für diese Auswahl.');td.colSpan=6;tr.append(td);body.append(tr)}
 $('page-info').textContent=rows.length?fmt(state.page*PAGE_SIZE+1)+'–'+fmt(Math.min((state.page+1)*PAGE_SIZE,rows.length))+' von '+fmt(rows.length)+' Tasks · Seite '+(state.page+1)+' / '+pageCount:'0 Tasks';
 $('previous-page').disabled=state.page===0;$('next-page').disabled=state.page>=pageCount-1;
}
function renderVolumeTable(s){const body=$('volume-body');body.replaceChildren();let cumulative=0;for(const w of s.series){cumulative+=w.count;const tr=element('tr');tr.dataset.volumeWeek=w.week;tr.append(element('td','',weekLabel(w.week)+(w.partial?(w.week===currentWeek?' · läuft':' · Vergleich erst ab '+dateShort(state.historyStart)):'')),element('td','',fmt(w.count)),element('td','',hours(w.medianLead)),element('td','',fmt(w.longOpen)));body.append(tr)}}
function render(){const s=calc();if(state.detailDay&&!s.dailySeries.some(d=>d.day===state.detailDay))state.detailDay='';renderMetrics(s);drawChart(s);drawDaily(s);renderDeep(s);renderVolumeTable(s);renderProjects(s);averages.projects(s);renderFacts(s);averages.weekdays(s);renderTable(s);syncCustomControls();applyAppPresentation();window.reportState={...state};window.reportSummary={total:s.total,average:s.avg,fullWeeks:s.full.length,best:s.best,latest:s.latest,latestFlow:s.latestFlow,paceChange:s.paceChange,historyStart:state.historyStart,medianWeek:s.medianWeek,medianDuration:s.medianDuration,longOpen:s.longOpen,ranks:s.ranks};}
function changeRange(key,value){state[key]=value;if(state.from>state.to){if(key==='from')state.to=state.from;else state.from=state.to}$('from-week').value=state.from;$('to-week').value=state.to;state.detailDay='';state.page=0;document.querySelectorAll('[data-preset]').forEach(b=>b.classList.remove('active'));render()}
$('from-week').addEventListener('change',e=>changeRange('from',e.target.value));$('to-week').addEventListener('change',e=>changeRange('to',e.target.value));
$('project-filter').addEventListener('change',e=>{state.project=e.target.value;state.page=0;render()});
$('progress-mode').addEventListener('change',e=>{state.progressMode=e.target.value;render()});
$('history-start').addEventListener('change',e=>{const value=e.target.value,parsed=new Date(value+'T12:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(parsed.getTime())||iso(parsed)!==value){e.target.setCustomValidity('Bitte ein gültiges Datum als JJJJ-MM-TT eingeben.');e.target.reportValidity();return}e.target.setCustomValidity('');state.historyStart=[DATA.meta.first_date,[value,today].sort()[0]].sort().at(-1);e.target.value=state.historyStart;state.page=0;render()});
$('exclude-special').addEventListener('change',e=>{state.excludeSpecial=e.target.checked;state.page=0;render()});
$('show-raw').addEventListener('change',e=>{state.showRaw=e.target.checked;drawDaily(calc())});
document.querySelectorAll('[data-preset]').forEach(b=>b.addEventListener('click',()=>{const n=b.dataset.preset;state.from=n==='all'?firstWeek:allWeeks[Math.max(0,allWeeks.length-Number(n))];state.to=lastWeek;if(n==='all'){state.historyStart=DATA.meta.first_date;$('history-start').value=state.historyStart}state.detailDay='';state.page=0;$('from-week').value=state.from;$('to-week').value=state.to;document.querySelectorAll('[data-preset]').forEach(el=>el.classList.toggle('active',el===b));render()}));
$('detail-day').addEventListener('change',e=>{state.detailDay=e.target.value;state.page=0;render()});$('clear-day').addEventListener('click',()=>{state.detailDay='';state.page=0;render()});
$('task-search').addEventListener('input',e=>{state.search=e.target.value;state.page=0;renderTable(calc())});$('previous-page').addEventListener('click',()=>{state.page=Math.max(0,state.page-1);renderTable(calc())});$('next-page').addEventListener('click',()=>{state.page++;renderTable(calc())});
$('print-report').addEventListener('click',()=>window.print());window.addEventListener('beforeprint',()=>{printing=true;renderTable(calc())});window.addEventListener('afterprint',()=>{printing=false;renderTable(calc())});
$('csv-export').addEventListener('click',()=>{const rows=detailedTasks(calc());const cell=value=>{let s=String(value??'');if(/^[=+@-]/.test(s.trimStart()))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'};const records=[['Karten-ID','Task','Projekt','Abschlusstag','Erstellt Europe/Vienna','Fertig Europe/Vienna','Offenzeit Kalenderstunden','Archiviert','Labels','Lange Offenzeit nach IQR','Testkarte nach Titel','Pausiert Abgelehnt','Abschlussstempel Quelle'],...rows.map(t=>[t.id,t.title,t.project,t.output_date,t.created_local,t.finished_local,t.duration_hours===null?'':t.duration_hours.toFixed(6).replace('.',','),t.archive_date,t.labels.join(', '),t.longOpen?'ja':'nein',t.isTest?'ja':'nein',t.isPaused?'ja':'nein',t.completion_source==='archive-fallback'?'Archivdatum als Ersatz':'Fertig-Stempel'])];const csv='\ufeff'+records.map(row=>row.map(cell).join(';')).join('\r\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='development-'+(state.detailDay||state.from)+'-bis-'+state.to+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)});
$('volume-export').addEventListener('click',()=>downloadCSV([['KW Montag','Kalenderwoche','Fertige Tasks','Median Offenzeit h (keine Arbeitszeit)','Karten mit langer Offenzeit'],...calc().series.map(w=>[w.week,kw(w.week),w.count,w.medianLead===null?'':w.medianLead.toFixed(6).replace('.',','),w.longOpen])],'kw-abschluesse-'+state.from+'-bis-'+state.to+'.csv'));
$('daily-volume-export').addEventListener('click',()=>downloadCSV([['Datum','Fertige Tasks','Kumulativ im Filterzeitraum','Erledigte Tasks je Woche (Durchschnitt aus 28 vollen Tagen)','Erledigte Tasks je Kalendertag (Durchschnitt aus 14 vollen Tagen)','Heutiger Tag unvollstaendig','Phasenvergleich Prozent','Abschluesse letzte 28 volle Tage','Abschluesse 28 Tage davor','Neu angelegt in 28 Tagen','Erledigt in 28 Tagen','Erledigt zu Eingang Prozent','Rueckstand Delta','Neue Karten davon fertig','Kumulativ ab Vergleichsbeginn','Vergleichshistorie ab'],...calc().dailySeries.map(d=>[d.day,d.count,d.cumulative,d.pace28===null?'':d.pace28.toFixed(6).replace('.',','),d.mean14===null?'':d.mean14.toFixed(6).replace('.',','),d.partial?'ja':'nein',d.phaseChange===null?'':d.phaseChange.toFixed(6).replace('.',','),d.count28??'',d.previous28??'',d.incoming28??'',d.finished28??'',d.flowRatio===null?'':d.flowRatio.toFixed(6).replace('.',','),d.backlogDelta28??'',d.newCohortClosed??'',d.comparableCumulative??'',state.historyStart])],'fortschritt-und-trends-'+state.from+'-bis-'+state.to+'.csv'));
function downloadCSV(records,name){const cell=value=>'"'+String(value??'').replace(/"/g,'""')+'"',csv='\ufeff'+records.map(row=>row.map(cell).join(';')).join('\r\n'),url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
const widths=new Map();new ResizeObserver(entries=>{let changed=false;for(const entry of entries){const width=Math.round(entry.contentRect.width);if(widths.get(entry.target)!==width){widths.set(entry.target,width);changed=true}}if(changed){const s=calc();drawChart(s);drawDaily(s);renderDeep(s)}}).observe($('weekly-chart'));
window.addEventListener('resize',()=>{const s=calc();drawDaily(s);renderDeep(s)});
const averages=createMovingAverageRuntime({document,options,lifecycle,helpers:{element,svgEl,deepFrame,deepAxisY,deepAxisDates,deepHover,utc,shift,kw,weekLabel,dayLabel,dec,snapshotDay:today},getState:()=>state,getOverlayState:()=>overlayState,redraw:()=>render()});restoreAnalyticsView({state,overlayState,data:DATA,weeks:allWeeks,projects,document,initial:options.initialView});initDeepControls();initCustomControls();
window.reportAPI={data:DATA,audit:AUDIT,calc,auditRows,auditIntake,flowSeries,progressSeries,quantile,deepAnalysis,overlayModel,overlayMetrics,rankCorrelation,relationshipEvidence,buildRelationshipAnalysis,recommendRelationships,getRelationships:()=>{const analysis=currentRelationshipAnalysis(calc());return {analysis,matches:recommendRelationships(analysis,overlayState.selected)}},getOverlayState:()=>structuredClone(overlayState),getState:()=>({...state}),weeks:allWeeks,detailedTasks};render();

return {api:window.reportAPI,getState:()=>window.reportAPI.getState(),getOverlayState:()=>window.reportAPI.getOverlayState(),getAverageState:()=>averages.getState(),summary:()=>window.reportSummary,destroy:()=>lifecycle.destroy()};
} catch (error) { lifecycle.destroy(); throw error; }
}
