import { meetingPlot } from './chart-geometry.js';
// Stable portal slots survive chart redraws; coordinates belong to the current SVG only.
export function createMeetingChartBridge({document,options,lifecycle,getState}) {
 const slots=new Map();let destroyed=false;
 const targets=['weekly-chart','daily-chart','backlog-chart','distribution-chart','cohort-chart','overlay-chart','projects','weekdays'];
 function sync(s) {
  if(destroyed||!options.onMeetingCharts)return;
  const state=getState(),rangeStart=state.from,rangeEnd=s.dailySeries.at(-1)?.day||state.to,contexts=[];
  for(const id of targets){
   const chart=document.getElementById(id),panel=chart?.closest('.panel');if(!panel)continue;
   let slot=slots.get(id);if(!slot||!panel.contains(slot)){
    slot=document.createElement('div');slot.className='personal-meeting-chart-slot';slot.dataset.meetingChart=id;
    const head=panel.querySelector('.panel-head');(head||chart).after(slot);panel.classList.add('meeting-chart-panel');slots.set(id,slot);
   }
   const timeline=panel.querySelector('[data-average-timeline="'+id+'"]'),svg=timeline&&!timeline.hidden?timeline.querySelector('svg'):chart.querySelector('svg'),savedPlot=meetingPlot(svg),plot=savedPlot?{...savedPlot,width:svg.viewBox.baseVal.width,height:svg.viewBox.baseVal.height}:null;
   contexts.push({id,slot,panel,plot,start:rangeStart,end:rangeEnd,rangeStart,rangeEnd,labelId:state.project,grain:plot?.grain||'day',left:2,right:2,independent:true});
  }
  options.onMeetingCharts(contexts,document.getElementById('meeting-context-slot'));
 }
 lifecycle.onDestroy(()=>{destroyed=true;slots.clear()});return{sync};
}
