// Scoped DOM adapter: the report never writes to the app's document/window state.
export function createAnalyticsHost(host, markup, options) {
  const ownerDocument=host.ownerDocument, realm=ownerDocument.defaultView;
  if(!realm)throw new Error('Die Auswertung benötigt ein Browserfenster.');
  host.innerHTML=markup;
  let destroyed=false;const cleanups=[],observers=new Set(),timers=new Set(),blobs=new Set(),selects=new Map(),helps=new Map();
  const listen=(target,type,handler,config)=>{const guarded=event=>{if(!destroyed&&host.isConnected){if(typeof handler==='function')handler(event);else handler.handleEvent(event)}};target.addEventListener(type,guarded,config);cleanups.push(()=>target.removeEventListener(type,guarded,config));};
  const scopedDocument={getElementById:id=>host.querySelector('#'+realm.CSS.escape(id)),querySelector:s=>host.querySelector(s),querySelectorAll:s=>host.querySelectorAll(s),createElement:ownerDocument.createElement.bind(ownerDocument),createElementNS:ownerDocument.createElementNS.bind(ownerDocument),createTextNode:ownerDocument.createTextNode.bind(ownerDocument),body:host,documentElement:host,addEventListener:(type,handler,config)=>listen(host,type,handler,config)};
  const localWindow=Object.create(null);
  const windowFacade=new Proxy(localWindow,{get(target,key){if(Object.hasOwn(target,key))return target[key];if(key==='addEventListener')return(type,handler,config)=>listen(realm,type,handler,config);if(key==='removeEventListener')return realm.removeEventListener.bind(realm);const value=realm[key];return typeof value==='function'?value.bind(realm):value;},set(target,key,value){target[key]=value;return true}});
  const ManagedResizeObserver=class extends realm.ResizeObserver{constructor(callback){super(entries=>{if(!destroyed&&host.isConnected)callback(entries,this)});observers.add(this)}};
  const ManagedMutationObserver=class extends realm.MutationObserver{constructor(callback){super(entries=>{if(!destroyed&&host.isConnected)callback(entries,this)});observers.add(this)}};
  const urls={createObjectURL(blob){const url=realm.URL.createObjectURL(blob);blobs.add(url);return url;},revokeObjectURL(url){blobs.delete(url);realm.URL.revokeObjectURL(url);}};
  const schedule=(callback,delay)=>{const timer=realm.setTimeout(()=>{timers.delete(timer);if(!destroyed)callback()},delay);timers.add(timer);return timer;};
  function help(source, content, label='Erklärung anzeigen') {
    if(!options.mountInfo)return;
    let item=helps.get(source);
    if(!item){const slot=ownerDocument.createElement('span');slot.className='personal-info-slot';source.append(slot);item={slot,control:options.mountInfo(slot,content,label)};helps.set(source,item)}
    else item.control.update?.(content,label);
  }
  function disclosure(el,label){if(!el||el.closest('.personal-explanation')||el.closest('details'))return;const details=ownerDocument.createElement('details'),summary=ownerDocument.createElement('summary');details.className='personal-explanation';summary.textContent=label;el.before(details);details.append(summary,el);}
  function initCustomControls(){
    for(const select of host.querySelectorAll('select')){
      const label=host.querySelector('label[for="'+select.id+'"]')?.textContent||select.getAttribute('aria-label')||'Auswahl',slot=ownerDocument.createElement('span');slot.className='personal-select-slot';select.classList.add('personal-native-select');select.tabIndex=-1;select.setAttribute('aria-hidden','true');select.after(slot);
      const controller=options.mountSelect?.(slot,select,label);if(!controller)throw new Error('SIMPL-Auswahl fehlt.');selects.set(select,controller);const observer=new ManagedMutationObserver(()=>controller.update());observer.observe(select,{subtree:true,childList:true,attributes:true,attributeFilter:['disabled','selected']});listen(select,'change',()=>controller.update());
    }
    host.querySelector('#refresh-report')?.addEventListener('click',()=>options.onRefresh?.());
  }
  function syncCustomControls(){for(const controller of selects.values())controller.update()}
  function applyAppPresentation(){
    if(destroyed)return;
    for(const [node,item]of helps)if(!host.contains(node)){item.control.destroy();helps.delete(node)}
    for(const metric of host.querySelectorAll('.metric')){const note=metric.querySelector('.metric-note');if(note){note.classList.add('personal-help-source');help(metric,note.textContent,metric.querySelector('.metric-label')?.textContent+' erklären')}}
    for(const label of host.querySelectorAll('.overlay-choice')){const text=label.querySelector('.metric-hint');if(text){text.classList.add('personal-help-source');label.removeAttribute('title');help(label,text.textContent,label.querySelector('b')?.textContent+' erklären')}}
    for(const el of host.querySelectorAll('.model-note,.coverage-note,#volume-explanation,#chart-coverage,.deep-caption,.daily-meaning,.metric-vocabulary,#overlay-explanation'))disclosure(el,el.id==='chart-coverage'?'Datenbereich':el.classList.contains('coverage-note')?'Historie & Datenqualität':'So liest du diese Werte');
    const readouts=host.querySelector('#metric-readouts');disclosure(readouts,'Ausgewählte Werte erklärt');if(readouts?.closest('details'))readouts.closest('details').hidden=readouts.hidden;
    const cohortHeader=host.querySelector('.cohort-panel .panel-head>div'),cohortReading=host.querySelector('.cohort-reading');if(cohortHeader&&cohortReading)help(cohortHeader,Array.from(cohortReading.querySelectorAll('p:not(.deep-fact),small')).map(el=>el.textContent).join(' '),'Erledigungsquoten erklären');
    for(const card of host.querySelectorAll('.relationship-insight')){const meaning=card.querySelector('.insight-conclusion'),evidence=card.querySelector('.insight-evidence');if(meaning&&!card.querySelector('.personal-finding-explanation')){const details=ownerDocument.createElement('details'),summary=ownerDocument.createElement('summary');details.className='personal-finding-explanation';summary.textContent='Einordnung & Datengrundlage';card.append(details);details.append(summary,meaning);if(evidence)details.append(evidence)}}
    for(const card of host.querySelectorAll('.relationship-bundle')){const note=card.querySelector('small');if(note){note.classList.add('personal-help-source');help(card,note.textContent,'Dieses Set erklären')}}
    host.querySelector('#snapshot').textContent='Datenstand '+new Intl.DateTimeFormat('de-AT',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Vienna'}).format(new Date(options.snapshotAt));
    const total=options.completedCount??0,open=options.openCount??0;host.querySelector('#intro').textContent='Development · '+total+' erledigt · '+open+' offen · gesamte verfügbare Historie';
    const archiveFallback=options.archiveFallbackCount||0;
    if(archiveFallback){let note=host.querySelector('#archive-fallback-note');if(!note){note=ownerDocument.createElement('p');note.id='archive-fallback-note';note.className='coverage-note';host.querySelector('.quality-strip').after(note)}note.textContent=archiveFallback+' archivierte Karten ohne Fertig-Stempel: Das Archivdatum wird als gekennzeichnetes Ersatzdatum verwendet.';disclosure(note,'Archivdaten als Ersatzstempel')}
  }
  listen(realm,'beforeprint',()=>{ownerDocument.body.dataset.personalAnalyticsPrint='true';});
  listen(realm,'afterprint',()=>{delete ownerDocument.body.dataset.personalAnalyticsPrint;});
  function destroy(){if(destroyed)return;destroyed=true;for(const cleanup of cleanups)cleanup();for(const observer of observers)observer.disconnect();for(const timer of timers)realm.clearTimeout(timer);for(const url of blobs)realm.URL.revokeObjectURL(url);for(const controller of selects.values())controller.destroy();for(const item of helps.values())item.control.destroy();selects.clear();helps.clear();observers.clear();timers.clear();blobs.clear();for(const key of Object.keys(localWindow))delete localWindow[key];delete ownerDocument.body.dataset.personalAnalyticsPrint;host.replaceChildren();}
  function download(text,name){const url=urls.createObjectURL(new realm.Blob([text],{type:'text/csv;charset=utf-8'})),anchor=ownerDocument.createElement('a');anchor.href=url;anchor.download=name;anchor.click();schedule(()=>urls.revokeObjectURL(url),1000)}
  return{document:scopedDocument,window:windowFacade,ResizeObserver:ManagedResizeObserver,MutationObserver:ManagedMutationObserver,URL:urls,setTimeout:schedule,initCustomControls,syncCustomControls,applyAppPresentation,destroy,download,onDestroy:cleanup=>cleanups.push(cleanup)};
}
