// Vienna calendar buckets; today is an observed, explicitly partial snapshot.
export const utc=s=>new Date(s+'T12:00:00Z');
export const iso=d=>d.toISOString().slice(0,10);
export const shift=(s,n)=>{const d=utc(s);d.setUTCDate(d.getUTCDate()+n);return iso(d)};
export const monday=s=>shift(s,-((utc(s).getUTCDay()+6)%7));

export function quantile(values,p){const a=values.filter(v=>Number.isFinite(v)).sort((a,b)=>a-b);if(!a.length)return null;const x=(a.length-1)*p,i=Math.floor(x);return a[i]+(a[Math.min(i+1,a.length-1)]-a[i])*(x-i)}

export function progressSeries(tasks,from,through,historyStart,snapshotDay){
 const counts=new Map();for(const task of tasks)counts.set(task.output_date,(counts.get(task.output_date)||0)+1);
 const sum=(a,b)=>{let n=0;for(let d=a;d<=b;d=shift(d,1))n+=counts.get(d)||0;return n};
 const rows=[];let cumulative=0,comparableCumulative=0;
 for(let day=from;day<=through;day=shift(day,1)){
  const count=counts.get(day)||0;cumulative+=count;if(day>=historyStart)comparableCumulative+=count;
  const start14=shift(day,-13),start28=shift(day,-27),start56=shift(day,-55),complete=day<=snapshotDay;
  const count14=complete&&start14>=historyStart?sum(start14,day):null;
  const count28=complete&&start28>=historyStart?sum(start28,day):null;
  const previous28=complete&&start56>=historyStart?sum(start56,shift(day,-28)):null;
  const phaseChange=count28!==null&&previous28!==null&&previous28>0?(count28-previous28)/previous28*100:null;
  const phaseReason=!complete?'partial':previous28===null?'warmup':previous28===0?'zero-baseline':'valid';
  rows.push({day,count,cumulative,comparableCumulative:day>=historyStart?comparableCumulative:null,mean14:count14===null?null:count14/14,pace28:count28===null?null:count28/4,count28,previous28,phaseChange,phaseReason,partial:day>=snapshotDay});
 }
 return rows;
}

export function flowSeries(tasks,from,through,historyStart,snapshotDay){
 const incoming=new Map(),finished=new Map();for(const task of tasks){incoming.set(task.created_date,(incoming.get(task.created_date)||0)+1);if(task.done_date)finished.set(task.done_date,(finished.get(task.done_date)||0)+1)}
 const sum=(map,a,b)=>{let n=0;for(let d=a;d<=b;d=shift(d,1))n+=map.get(d)||0;return n};
 const rows=[];
 for(let day=from;day<=through;day=shift(day,1)){
  const start=shift(day,-27),complete=day<=snapshotDay&&start>=historyStart;
  const incoming28=complete?sum(incoming,start,day):null,finished28=complete?sum(finished,start,day):null;
  const flowRatio=incoming28>0?finished28/incoming28*100:null;
  const newCohort=complete?tasks.filter(t=>t.created_date>=start&&t.created_date<=day):[];
  const newCohortClosed=complete?newCohort.filter(t=>t.done_date&&t.done_date<=day).length:null;
  rows.push({day,incomingDaily:incoming.get(day)||0,incoming28,finished28,flowRatio,backlogDelta28:complete?incoming28-finished28:null,newCohortClosed,flowReason:!complete?(day>=snapshotDay?'partial':'warmup'):incoming28===0?'zero-intake':'valid'});
 }
 return rows;
}

export const DAY_MS=86400000;
const dayDistance=(a,b)=>Math.round((utc(b)-utc(a))/DAY_MS);
export function viennaStartMs(day){const guess=Date.parse(day+'T00:00:00Z'),parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Vienna',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(guess)),p=Object.fromEntries(parts.map(v=>[v.type,v.value]));return guess-(Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day),Number(p.hour),Number(p.minute),Number(p.second))-guess)}
export function deepAnalysis(intake,completed,weeks,from,through,historyStart,snapshotDay,snapshotAt=viennaStartMs(snapshotDay)){
 const snapshotStart=snapshotAt;
 const counts=new Map();for(const t of completed)counts.set(t.output_date,(counts.get(t.output_date)||0)+1);
 const weekCount=w=>{let n=0;for(let i=0;i<7;i++)n+=counts.get(shift(w,i))||0;return n};
 const qualifies=(t,n)=>t.done_ms!==null&&t.done_ms>=t.created_ms&&t.done_ms-t.created_ms<=n*DAY_MS;
 const rows=[];
 for(let day=from;day<=through;day=shift(day,1)){
  const valid=day>=historyStart&&day<=snapshotDay,observationEnd=day===snapshotDay?snapshotAt:viennaStartMs(shift(day,1)),open=valid?intake.filter(t=>t.created_date<=day&&(!t.done_date||t.done_date>day)):[];
  const bands=[0,0,0];for(const t of open){const age=dayDistance(t.created_date,day);bands[age<=7?0:age<=28?1:2]++}
  const lastWeek=shift(monday(day===snapshotDay?day:shift(day,1)),-7),firstOf8=shift(lastWeek,-49),eight=valid&&firstOf8>=historyStart?Array.from({length:8},(_,i)=>weekCount(shift(firstOf8,i*7))):[];
  const row={day,partial:day===snapshotDay,open:valid?open.length:null,open7:valid?bands[0]:null,open28:valid?bands[1]:null,openOld:valid?bands[2]:null,median8:eight.length?quantile(eight,.5):null,q1week8:eight.length?quantile(eight,.25):null,q3week8:eight.length?quantile(eight,.75):null};
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
