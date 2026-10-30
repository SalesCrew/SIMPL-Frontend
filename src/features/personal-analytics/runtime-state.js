// UI preferences stay in memory within the verified owner's mounted page only.
import { restoreReadCycleSelection } from './read-cycle.js';
export function restoreAnalyticsView({state,overlayState,data,weeks,projects,document,initial}){
 if(!initial)return;const saved=initial.state||{},overlay=initial.overlay||{},byId=id=>document.getElementById(id);
 const preset=['all','4','8'].includes(initial.preset)?initial.preset:null;
 state.from=preset==='all'?weeks[0]:preset?weeks[Math.max(0,weeks.length-Number(preset))]:weeks.includes(saved.from)?saved.from:state.from;
 state.to=preset?weeks.at(-1):weeks.includes(saved.to)?saved.to:state.to;
 if(state.from>state.to)state.from=state.to;
 state.project=projects.includes(saved.project)?saved.project:'';
 if(['pace','cumulative','phases','flow'].includes(saved.progressMode))state.progressMode=saved.progressMode;
 for(const key of ['excludeSpecial','showRaw'])if(typeof saved[key]==='boolean')state[key]=saved[key];
 for(const key of ['search','detailDay'])if(typeof saved[key]==='string')state[key]=saved[key];
 if(Number.isInteger(saved.page)&&saved.page>=0)state.page=saved.page;
 if(typeof saved.historyStart==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(saved.historyStart)&&Number.isFinite(Date.parse(saved.historyStart+'T12:00:00Z')))state.historyStart=[data.meta.first_date,[saved.historyStart,data.meta.last_date].sort()[0]].sort().at(-1);
 for(const [id,key]of [['from-week','from'],['to-week','to'],['project-filter','project'],['progress-mode','progressMode'],['history-start','historyStart'],['task-search','search']])byId(id).value=state[key];
 byId('exclude-special').checked=state.excludeSpecial;byId('show-raw').checked=state.showRaw;
 for(const button of document.querySelectorAll('[data-preset]'))button.classList.toggle('active',button.dataset.preset===preset);
 const allowed=['readCycleDaily','readCycle28','pace28','incomingPace','median8','open','openOld','cumulative','count','mean14','phaseChange','flowRatio','cohort7','cohort14','cohort28'];
 if(Array.isArray(overlay.selected))overlayState.selected=restoreReadCycleSelection(overlay.selected.filter(k=>allowed.includes(k)),overlay.readCycleDisplayVersion);
 overlayState.readCycleDisplayVersion=2;
 if(['native','normalized'].includes(overlay.scale))overlayState.scale=overlay.scale;
 if(['day','week'].includes(overlay.grain))overlayState.grain=overlay.grain;
 if(typeof overlay.common==='boolean')overlayState.common=overlay.common;
 for(const side of ['left','right'])for(const bound of ['min','max']){const value=overlay.bounds?.[side]?.[bound];if(typeof value==='string'&&(value===''||Number.isFinite(Number(value))))overlayState.bounds[side][bound]=value;}
 byId('overlay-scale').value=overlayState.scale;byId('overlay-grain').value=overlayState.grain;byId('overlay-common').checked=overlayState.common;
 for(const input of document.querySelectorAll('.axis-bound'))input.value=overlayState.bounds[input.dataset.side][input.dataset.bound];
}
