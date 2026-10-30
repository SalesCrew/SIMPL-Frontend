// App-only native review metrics. Historical JSON snapshots remain immutable.
export function applyReadCycleAnalytics(script) {
  const change = (before, after) => { if (!script.includes(before)) throw Error('Read-cycle adapter target changed: ' + before.slice(0, 90)); script = script.replace(before, after); };
  change('const overlayMetrics={', 'const overlayMetrics={...readCycleMetrics,');
  change("const sets={balance:", "const sets={cycle:['pace28','readCycle28'],balance:");
  change("const overlayFamily={week:", "const overlayFamily={hours:'Kalenderstunden / Task',week:");
  change('const dailySeries=progressSeries(base,state.from,dayEnd,state.historyStart,today).map((row,i)=>({...row,...flows[i]}));', 'const cycles=readCycleSeries(base,{from:state.from,through:dayEnd,historyStart:state.historyStart,snapshotDay:today,firstFullDay:DATA.read_cycle?.first_full_day});const dailySeries=progressSeries(base,state.from,dayEnd,state.historyStart,today).map((row,i)=>({...row,...flows[i],...cycles[i]}));');
  change(" if(settings.grain==='week'){", " const dailyRows=rows;\n if(settings.grain==='week'){");
  change('return {day:last.day,week,partial:group.length<7,values}', 'weightedReadCycleWeek(group,values);return {day:last.day,week,partial:group.length<7,values}');
  change('return {rows:chartRows,lines,axes:domains,', 'return {dailyRows,common:settings.common,grain:settings.grain,rows:chartRows,lines,axes:domains,');
  change("label:settings.grain==='week'&&key==='count'?'Erledigt in dieser KW':metric.label", "label:settings.grain==='week'&&key==='readCycleDaily'?'Gelesen → Fertig · Ø je Abschluss-KW':settings.grain==='week'&&key==='count'?'Erledigt in dieser KW':metric.label");
  change('function metricMeaning(line,row){', "function metricMeaning(line,row){if(isReadCycle(line.key))return readCycleMeaning(line,row,overlayState.grain);");
  change("a.family==='percent'?'%'", "a.family==='hours'?'Kalenderstunden / Task':a.family==='percent'?'%'");
  change("overlayState.grain==='week'||line.min===line.max", "overlayState.grain==='week'||line.min===line.max||(!Number.isFinite(rows[i-1]?.plot[line.key])&&!Number.isFinite(rows[i+1]?.plot[line.key]))");
  change('return text})}),overlayState.grain', "if(isReadCycle(l.key))text+=' · '+readCycleMeaning(l,row,overlayState.grain);return text})}),overlayState.grain");
  change("'Plotwert','Skalierung','Aggregation']", "'Plotwert','Skalierung','Aggregation','Auswertbare Tasks fuer Durchlaufzeit','Summe Gelesen-bis-Fertig Kalenderstunden','Alle Abschluesse im Fenster']");
  change("(l.aggregation==='sum'?'Summe':'letzter beobachteter Tagesstand'):'Tageswert'", "(l.aggregation==='sum'?'Summe':l.aggregation==='task-weighted'?'nach Taskzahl gewichteter KW-Durchschnitt':'letzter beobachteter Tagesstand'):'Tageswert',...readCycleCSV(l,r)");
  change("'Abschlussstempel Quelle'],...rows.map", "'Abschlussstempel Quelle','Gelesen UTC','Gelesen vom eigenen Account','Gelesen bis Fertig Kalenderstunden','Durchlaufzeit Datenstatus'],...rows.map");
  change("t.completion_source==='archive-fallback'?'Archivdatum als Ersatz':'Fertig-Stempel'])];", "t.completion_source==='archive-fallback'?'Archivdatum als Ersatz':'Fertig-Stempel',t.reviewed_at||'',t.reviewed_by_owner?'ja':'nein',t.read_to_finish_hours??'',t.read_to_finish_status||'not-provided'])];");
  change("'Vergleichshistorie ab'],...calc().dailySeries.map", "'Vergleichshistorie ab','Gelesen bis Fertig Tagesdurchschnitt h je Task','Gelesen bis Fertig 28 Tage h je Task','Auswertbare Tasks am Tag','Auswertbare Tasks letzte 28 Tage','Summe Gelesen bis Fertig h letzte 28 Tage'],...calc().dailySeries.map");
  change("d.comparableCumulative??'',state.historyStart])],", "d.comparableCumulative??'',state.historyStart,d.readCycleDaily??'',d.readCycle28??'',d.readCycleDayN??'',d.readCycle28N??'',d.readCycle28Hours??''])],");
  change("const relationRoles={", "const relationRoles={readCycleDaily:'cycle',readCycle28:'cycle',");
  change("const relationShort={", "const relationShort={readCycleDaily:'Gelesen → Fertig je Tag',readCycle28:'Gelesen → Fertig · 28 Tage',");
  change("return a==='cumulative'||b==='cumulative'", "return (isReadCycle(a)&&isReadCycle(b))||a==='cumulative'||b==='cumulative'");
  change('const semanticLinks={', "const semanticLinks={'cycle|delivery':{weight:.64,why:'Vergleicht erledigte Menge mit der Durchlaufzeit nach Gelesen. Längere Kalenderdauer kann Wartezeit bedeuten und belegt keinen höheren Aufwand.'},");
  change('const relationshipGroups=[', "const relationshipGroups=[{id:'cycle',name:'Erledigte Menge und Zeit ab Gelesen',roles:['delivery','cycle'],priority:.72,why:'Gleicher 28-Tage-Zeitraum: erledigte Menge neben der belegten mittleren Durchlaufzeit. Die Zeitlinie enthält nur auswertbare Lesestempel; keine Aussage über Arbeitszeit oder Taskgröße.'},");
  return script;
}
