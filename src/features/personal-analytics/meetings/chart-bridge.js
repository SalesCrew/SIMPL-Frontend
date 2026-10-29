// Adds a separate event layer. It never changes plot values, domains or metric models.
export function createMeetingChartBridge({document,options,lifecycle,getState,getOverlay,getOverlayState}){
 const slots=new Map();let destroyed=false;
 const targets=['weekly-chart','daily-chart','backlog-chart','distribution-chart','cohort-chart','overlay-chart','projects','weekdays'];
 const shift=(day,n)=>{const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
 function sync(s,averages){if(destroyed||!options.onMeetingCharts)return;const state=getState(),rangeStart=state.from,rangeEnd=s.dailySeries.at(-1)?.day||shift(state.to,6),contexts=[];
  for(const id of targets){const chart=document.getElementById(id),panel=chart?.closest('.panel');if(!panel)continue;let slot=slots.get(id);if(!slot||!panel.contains(slot)){slot=document.createElement('div');slot.className='personal-meeting-chart-slot';slot.dataset.meetingChart=id;const anchor=panel.querySelector('[data-average-legend="'+id+'"]')||chart;anchor.after(slot);slots.set(id,slot)}
   let start=rangeStart,end=rangeEnd,grain='day',left=5,right=2,independent=false;const svg=chart.querySelector('svg'),width=svg?.viewBox.baseVal.width||chart.clientWidth||500;
   if(id==='weekly-chart'||id==='daily-chart'){const rows=[...chart.querySelectorAll('[data-day]')];if(rows.length){start=rows[0].dataset.day;end=rows.at(-1).dataset.day;left=(id==='weekly-chart'&&['flow','phases'].includes(state.progressMode)?62:49)/width*100;right=17/width*100}else independent=true}
   else if(id==='backlog-chart'){const rows=s.deep.rows.filter(row=>row.open!==null);if(rows.length){start=rows[0].day;end=rows.at(-1).day;left=49/width*100;right=18/width*100}else independent=true}
   else if(id==='overlay-chart'){const model=getOverlay(s);grain=getOverlayState().grain;const rows=model.rows;if(rows.length){start=rows[0].day;end=rows.at(-1).day;left=58/width*100;right=(model.axes.length>1?64:18)/width*100}else independent=true}
   else if(id==='distribution-chart'){grain='month';if(s.deep.boxes.length){start=s.deep.boxes[0].month+'-01';end=shift(new Date(Date.UTC(Number(s.deep.boxes.at(-1).month.slice(0,4)),Number(s.deep.boxes.at(-1).month.slice(5,7)),1,12)).toISOString().slice(0,10),-1);left=49/width*100;right=18/width*100}else independent=true}
   else{independent=true;grain=id==='weekdays'||id==='cohort-chart'?'week':averages?.projects?.grain||'day'}
   contexts.push({id,slot,start,end,rangeStart,rangeEnd,labelId:state.project,grain,left,right,independent});
  }
  options.onMeetingCharts(contexts,document.getElementById('meeting-context-slot'));
 }
 lifecycle.onDestroy(()=>{destroyed=true;slots.clear()});return{sync};
}
