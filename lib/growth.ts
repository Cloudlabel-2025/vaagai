import type { Identity } from './jaguar';
export const players = ['Abinesh','Stephen','Surjith','Premothan'] as const;
export type Player = typeof players[number];
export const attributes = [
 ['C1A','Communication Confidence'],['C1B','Social & Institutional Confidence'],['C1C','Opportunity & Economic Agency'],['C1D','Self-belief & Emotional Resilience'],
 ['C2A','Subject Cognition'],['C2B','Applied Problem Solving'],['C2C','People / Context / Requirement Cognition'],['C2D','AI Learning & Prompt Engineering'],
 ['C3A','Cognitive Practice Consistency'],['C3B','Subject Practice Consistency'],
] as const;
export type Attribute = typeof attributes[number][0];
export type Method = 'Lower grade'|'Life'|'Path'|'Weighted';
export type Settings = { start:string; method:Method; lifeShare:number|null; baseAttempts:number|null; exerciseLinks:Record<string,string> };
export type Support = { player:Player; order:number; responsibilities:string; earns:'Not recorded'|'Yes'|'No'; extraDays:number|null; extraAttempts:number|null; approved:boolean; basis:string };
export type Daily = { player:Player; task:string; output:string; result:string; status:string; scheduled:number|null; breaks:number|null; meetings:number|null; productive:number|null; learning:number|null; attempts:number; taskId:string };
export type Day = { id:string; date:string; rows:Daily[] };
export type Incident = { id:string; date:string; catalogueId:string; observation:string; minutes:number; reportedCount:number|null; affected:Player[]; timeType:'Pending'|'Blocked'|'Avoidable'|'Learning'; kind:'Mistake'|'External blocker'; attribute:Attribute|''; supporting:Attribute[]; status:'Pending'|'Reviewed'; evidence:string; explanation:string; recovery:string; exerciseUrl:string; sourceNote:string };
export type Catalogue = { id:string; pattern:string; timeType:Incident['timeType']; attribute:Attribute|''; guidance:string; supporting:Attribute[]; exerciseUrl:string; nextStep:string };
export type Grade = { attribute:Attribute; life:number|null; path:number|null; evidence:string };
export type Review = { id:string; player:Player; stage:number; date:string; status:'Draft'|'Confirmed'; evidence:string; grades:Grade[]; reviewer?:string };
export type Practice = { c310?:{assessmentId:string;reportId:string;source:string;grades:{attribute:Attribute;grade:number}[]}; id:string; player:Player; week:number; targets:Attribute[]; weekend:Attribute|''; status:'Planned'|'In progress'|'Completed'; minutes:number; evidence:string; feedback:string; retry:string; outcome:string; support:string; exerciseUrl:string };
export type TaskSupport = { id:string; player:Player; title:string; expected:string; due:string; extraDays:number|null; extraAttempts:number|null; reason:string };
export type SourceObservation = { date:string; total:number; breaks:number; meetings:number; working:number; reportedLoss:number; remaining:number; surjithWork:number; abineshWork:number; note:string };
export type GrowthState = { sourceObservations:SourceObservation[]; settings:Settings; supports:Support[]; days:Day[]; incidents:Incident[]; catalogue:Catalogue[]; reviews:Review[]; reviewHistory:Review[]; practices:Practice[]; tasks:TaskSupport[] };
export const canManageGrowth = (u:Identity|null) => !!u && ['lavanyabalaji123@gmail.com','mechpremothan@gmail.com'].includes(u.email);
export const emptyDay = (date:string):Day => ({id:date,date,rows:players.map(player=>({player,task:'',output:'',result:'',status:'Not started',scheduled:null,breaks:null,meetings:null,productive:null,learning:null,attempts:0,taskId:''}))});
export const emptyReview=(player:Player,stage:number,date:string):Review=>({id:`${player}__${stage}`,player,stage,date,status:'Draft',evidence:'',grades:attributes.map(([attribute])=>({attribute,life:null,path:null,evidence:''}))});
export function addDays(date:string,n:number){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
export function addMonths(date:string,n:number){const d=new Date(date+'T12:00:00Z'),day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+n);const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last));return d.toISOString().slice(0,10);}
export const riverEnd=(start:string)=>addDays(addMonths(start,3),-1);
export const weekCount=(start:string)=>Math.ceil((Date.parse(riverEnd(start))-Date.parse(start)+86400000)/604800000);
export const weekAt=(start:string,date:string)=>Math.floor((Date.parse(date)-Date.parse(start))/604800000)+1;
export function weekDates(start:string,week:number){return {start:addDays(start,(week-1)*7),end:[addDays(start,week*7-1),riverEnd(start)].sort()[0]};}
export function reviewDates(start:string){return [start,...[0,1,2].flatMap(m=>[addDays(addMonths(start,m),14),addDays(addMonths(start,m+1),-1)])];}
export function priorityGrade(g:Grade,s:Settings):number|null {
 if(s.method==='Life')return g.life; if(s.method==='Path')return g.path;
 if(g.life===null||g.path===null)return null;
 if(s.method==='Weighted')return s.lifeShare===null?null:g.life*s.lifeShare+g.path*(1-s.lifeShare);
 return Math.min(g.life,g.path);
}
export function ranked(state:GrowthState,player:Player,cutoff:string){
 const current=attributes.map(([attribute],order)=>{
  const review=state.reviews.filter(r=>r.player===player&&r.status==='Confirmed'&&r.date<=cutoff&&r.grades.some(g=>g.attribute===attribute)).sort((a,b)=>b.date.localeCompare(a.date)||b.stage-a.stage)[0];
  const g=review?.grades.find(g=>g.attribute===attribute)??{attribute,life:null,path:null,evidence:''};
  return {attribute,order,life:g.life,path:g.path,grade:priorityGrade(g,state.settings)};
 });
 const complete=current.every(r=>r.grade!==null);
 const weakest=complete?[...current].sort((a,b)=>a.grade!-b.grade!||a.order-b.order).slice(0,8):[];
 const targets=[...weakest].sort((a,b)=>a.attribute[1].localeCompare(b.attribute[1])||a.grade!-b.grade!||a.order-b.order).slice(0,3);
 const weekend=[...targets].sort((a,b)=>a.grade!-b.grade!||a.order-b.order)[0];
 return {current,complete,weakest,targets,weekend};
}
export function incidentAllocated(i:Incident){return i.affected.length>0&&i.reportedCount===i.affected.length;}
export function incidentMinutes(state:GrowthState,player:Player,start:string,end=start){
 let blocked=0,avoidable=0,pending=0;
 for(const i of state.incidents.filter(i=>i.date>=start&&i.date<=end&&i.affected.includes(player))){
  if(i.timeType==='Learning')continue;
  if(i.status!=='Reviewed'||!incidentAllocated(i)||i.timeType==='Pending'){pending+=i.minutes;continue;}
  if(i.timeType==='Blocked')blocked+=i.minutes; if(i.timeType==='Avoidable')avoidable+=i.minutes;
 }
 return {blocked,avoidable,pending};
}
export function dailyBalance(state:GrowthState,date:string,row:Daily){const times=incidentMinutes(state,row.player,date);const fields=[row.scheduled,row.breaks,row.meetings,row.productive,row.learning];const complete=fields.every(n=>n!==null);const recorded=(row.breaks??0)+(row.meetings??0)+(row.productive??0)+(row.learning??0)+times.blocked+times.avoidable+times.pending;return {...times,recorded,complete,gap:row.scheduled===null?null:row.scheduled-recorded};}
export function taskAllowance(state:GrowthState,t:TaskSupport){
 const s=state.supports.find(s=>s.player===t.player);
 const extraDays=t.extraDays??(s?.approved?s.extraDays:null),extraAttempts=t.extraAttempts??(s?.approved?s.extraAttempts:null);
 const attempts=state.days.flatMap(d=>d.rows).filter(r=>r.player===t.player&&r.taskId===t.id).reduce((n,r)=>n+r.attempts,0);
 return {due:extraDays===null?null:addDays(t.due,extraDays),allowed:state.settings.baseAttempts===null||extraAttempts===null?null:state.settings.baseAttempts+extraAttempts,attempts,remaining:state.settings.baseAttempts===null||extraAttempts===null?null:Math.max(0,state.settings.baseAttempts+extraAttempts-attempts)};
}
export const label=(a:string)=>attributes.find(x=>x[0]===a)?.[1]??a;
