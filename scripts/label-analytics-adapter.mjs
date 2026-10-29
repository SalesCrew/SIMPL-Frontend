// App-only label routing. The standalone report snapshots remain unchanged.
export function applyLabelAnalytics(script) {
 const change=(a,b)=>{if(!script.includes(a))throw Error('Label adapter target changed: '+a.slice(0,80));script=script.replace(a,b)};
 change("const projects=[...new Set([...allTasks,...INTAKE.tasks,...(DATA.project_catalog||[]).map(p=>({project:p.name}))].map(t=>t.project))].sort((a,b)=>a.localeCompare(b,'de'));", "const analysisLabels=(DATA.label_catalog||[]).filter(l=>l.primary).sort((a,b)=>a.name.localeCompare(b.name,'de'));const projects=analysisLabels.map(l=>l.id);");
 change("for(const p of projects)$('project-filter').append(option(p,p));", "for(const p of analysisLabels)$('project-filter').append(option(p.id,p.name));");
 script=script.replaceAll('(!state.project||t.project===state.project)', '(!state.project||(t.label_ids||[]).includes(state.project))');
 change('const byProject=Object.create(null);for(const t of tasks)byProject[t.project]=(byProject[t.project]||0)+1;', 'const byProject=Object.create(null);for(const label of analysisLabels){const count=tasks.filter(t=>(t.label_ids||[]).includes(label.id)).length;if(count)byProject[label.name]=count}');
 change('return {weeks,tasks,series,full,total,', 'return {labelCatalogue:analysisLabels,weeks,tasks,series,full,total,');
 change("state.project=state.project===p?'':p;$('project-filter').value=state.project;", "const label=analysisLabels.find(l=>l.name===p);if(!label)return;state.project=state.project===label.id?'':label.id;$('project-filter').value=state.project;");
 change("$('insight').textContent=!s.total?", "$('insight').textContent=!s.total||!s.ranks.length?");
 change("' Karten in dieser Ansicht';", "' Karten in dieser Ansicht · '+allTasks.filter(t=>!analysisLabels.some(l=>(t.label_ids||[]).includes(l.id))).length+' erledigte Karten ohne Zuordnungslabel (ungefiltert enthalten)';");
 change("tr.append(name,element('td','',t.project),","tr.append(name,element('td','',analysisLabels.filter(l=>(t.label_ids||[]).includes(l.id)).map(l=>l.name).join(', ')||'Kein Zuordnungslabel'),");
 change("if(t.project==='Ohne Projekt')tags.append(element('span','task-tag notice','Projekt nicht auflösbar'));","if(!analysisLabels.some(l=>(t.label_ids||[]).includes(l.id)))tags.append(element('span','task-tag notice','Kein Zuordnungslabel'));");
 return script;
}
