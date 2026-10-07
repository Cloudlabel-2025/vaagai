import { z } from 'zod';
import { identity,database,RequestError,failure,sameOrigin,safeUrl } from '../../../lib/crew-server';
import { canManageGrowth,players,attributes,riverEnd,weekCount,weekDates,ranked,incidentAllocated,type GrowthState } from '../../../lib/growth';
import { initialGrowthState } from '../../../lib/growth-defaults';
import { istDate } from '../../../lib/jaguar';
export const dynamic='force-dynamic';
const player=z.enum(players), attr=z.enum(attributes.map(a=>a[0]) as [string,...string[]]);
const text=z.string().trim().max(4000), short=z.string().trim().max(240), required=short.min(1);
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{const d=new Date(v+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v;},'Enter a valid date.');
const url=z.string().max(2048).refine(v=>!v||safeUrl(v),'Use a complete HTTPS exercise link.');
const nullableMinutes=z.number().int().min(0).max(1440).nullable();
const allowance=z.number().int().min(0).max(90).nullable();
const grade=z.number().min(0).max(5).nullable();
const id=z.string().regex(/^[A-Za-z0-9_-]{1,100}$/);
const dailyRow=z.object({player,task:short,output:text,result:text,status:z.enum(['Not started','In progress','Completed','Blocked']),scheduled:nullableMinutes,breaks:nullableMinutes,meetings:nullableMinutes,productive:nullableMinutes,learning:nullableMinutes,attempts:z.number().int().min(0).max(100),taskId:z.string().max(100)}).strict();
const daySchema=z.object({id:date,date,rows:z.array(dailyRow).length(4)}).strict().refine(d=>d.id===d.date&&new Set(d.rows.map(r=>r.player)).size===4,'Enter one row for each player.').refine(d=>d.rows.every(r=>[r.breaks,r.meetings,r.productive,r.learning].reduce<number>((n,v)=>n+(v??0),0)<=(r.scheduled??1440)),'Recorded time exceeds the scheduled minutes.');
const incidentSchema=z.object({id,date,catalogueId:z.string().max(100),observation:required,minutes:z.number().int().min(0).max(1440),reportedCount:z.number().int().min(1).max(4).nullable(),affected:z.array(player).max(4),timeType:z.enum(['Pending','Blocked','Avoidable','Learning']),kind:z.enum(['Mistake','External blocker']),attribute:attr.or(z.literal('')),supporting:z.array(attr).max(9),status:z.enum(['Pending','Reviewed']),evidence:text,explanation:text,recovery:text,exerciseUrl:url,sourceNote:text}).strict().refine(i=>new Set(i.affected).size===i.affected.length&&new Set(i.supporting).size===i.supporting.length,'Players and attributes must be unique.').refine(i=>i.status!=='Reviewed'||(i.reportedCount===i.affected.length&&i.affected.length>0&&i.timeType!=='Pending'&&i.evidence.length>0&&i.explanation.length>0&&(i.kind!=='Mistake'||!!i.attribute)),'A reviewed incident needs matching player allocation, time classification, evidence, explanation and a primary attribute for a mistake.').refine(i=>i.status!=='Reviewed'||i.timeType!=='Avoidable'||i.recovery.length>0,'Record how the delayed output will be recovered.');
const reviewSchema=z.object({id,player,stage:z.number().int().min(0).max(6),date,status:z.enum(['Draft','Confirmed']),evidence:text,grades:z.array(z.object({attribute:attr,life:grade,path:grade,evidence:text}).strict()).length(10)}).strict().refine(r=>r.id===`${r.player}__${r.stage}`&&new Set(r.grades.map(g=>g.attribute)).size===10,'Each review must contain each of the ten attributes once.').refine(r=>r.status!=='Confirmed'||(r.evidence.length>0&&r.grades.every(g=>g.life!==null&&g.path!==null)),'Confirmation requires evidence and ten complete Life / Path grades.');
const catalogueSchema=z.object({id,pattern:required,timeType:z.enum(['Pending','Blocked','Avoidable','Learning']),attribute:attr.or(z.literal('')),guidance:text,supporting:z.array(attr).max(9),exerciseUrl:url,nextStep:text}).strict();
const supportSchema=z.object({player,order:z.number().int().min(1).max(4),responsibilities:text,earns:z.enum(['Not recorded','Yes','No']),extraDays:allowance,extraAttempts:allowance,approved:z.boolean(),basis:text}).strict().refine(s=>!s.approved||(s.extraDays!==null&&s.extraAttempts!==null&&s.basis.length>0),'Approve both extra days and extra attempts, with a reason. Zero is allowed.');
const settingsSchema=z.object({start:date,method:z.enum(['Lower grade','Life','Path','Weighted']),lifeShare:z.number().min(0).max(1).nullable(),baseAttempts:z.number().int().min(1).max(100).nullable(),exerciseLinks:z.record(attr,url)}).strict().refine(s=>s.method!=='Weighted'||s.lifeShare!==null,'Weighted mode requires a Life share between 0 and 1.');
const practiceSchema=z.object({id,player,week:z.number().int().min(1).max(14),status:z.enum(['Planned','In progress','Completed']),minutes:z.number().int().min(0).max(2880),evidence:text,feedback:text,retry:text,outcome:text,support:text,exerciseUrl:url}).strict().refine(p=>p.id===`${p.player}__${p.week}`,'Practice record must match the student and week.').refine(p=>p.status!=='Completed'||(p.evidence.length>0&&p.feedback.length>0&&p.outcome.length>0),'Completed practice needs evidence, feedback and an outcome.');
const taskSchema=z.object({id,player,title:required,expected:text.min(1),due:date,extraDays:allowance,extraAttempts:allowance,reason:text}).strict().refine(t=>(t.extraDays===null&&t.extraAttempts===null)||t.reason.length>0,'Give a reason for a task allowance override.');
const mutation=z.discriminatedUnion('op',[
 z.object({op:z.literal('settings'),revision:z.number().int().min(0),data:settingsSchema}),
 z.object({op:z.literal('support'),revision:z.number().int().min(0),data:supportSchema}),
 z.object({op:z.literal('day'),revision:z.number().int().min(0),data:daySchema}),
 z.object({op:z.literal('incident'),revision:z.number().int().min(0),data:incidentSchema}),
 z.object({op:z.literal('review'),revision:z.number().int().min(0),data:reviewSchema}),
 z.object({op:z.literal('catalogue'),revision:z.number().int().min(0),data:catalogueSchema}),
 z.object({op:z.literal('practice'),revision:z.number().int().min(0),data:practiceSchema}),
 z.object({op:z.literal('task'),revision:z.number().int().min(0),data:taskSchema}),
]);
async function allowed(){const u=await identity();if(!canManageGrowth(u))throw new RequestError('Growth Tracker is available only to Premothan and Lavy.',403);return u;}
async function load(){const row=await (await database()).growth.findOne({_id:'jaguar'});return {state:row?row.data:initialGrowthState(),revision:row?.revision??0,updatedBy:row?.updated_by??null,updatedAt:row?.updated_at??null};}
const reply=(data:unknown)=>Response.json(data,{headers:{'Cache-Control':'private, no-store','Vary':'oai-authenticated-user-id, oai-authenticated-user-email'}});
export async function GET(){try{await allowed();return reply(await load());}catch(e){return failure(e);}}
export async function POST(req:Request){try{
 sameOrigin(req);const u=await allowed();const raw=await req.text();if(raw.length>100000)throw new RequestError('This entry is too large. Shorten the notes.');
 let input:unknown;try{input=JSON.parse(raw);}catch{throw new RequestError('Enter a valid tracker request.');}
 const parsed=mutation.safeParse(input);if(!parsed.success)throw new RequestError(parsed.error.issues[0].message);
 const p=parsed.data,loaded=await load();if(p.revision!==loaded.revision)throw new RequestError('Another leader saved a change. Reload the tracker, then save your kept draft again.',409);
 const state=loaded.state;
 function replace<T extends {id:string}>(rows:T[],record:T){const n=rows.findIndex(r=>r.id===record.id);if(n<0)rows.push(record);else rows[n]=record;}
 function inRiver(d:string){if(d<state.settings.start||d>riverEnd(state.settings.start))throw new RequestError('Choose a date within the three-month river.');}
 if(p.op==='settings'){
  const dates=[...state.days.map(d=>d.date),...state.incidents.map(i=>i.date),...state.reviews.map(r=>r.date)];
  if(dates.some(d=>d<p.data.start||d>riverEnd(p.data.start)))throw new RequestError('The new river dates would exclude existing records. Keep dates that cover them.');
  if(state.practices.length&&p.data.start!==state.settings.start)throw new RequestError('Keep the river start once weekly practice has been recorded.');
  state.settings=p.data;
 }else if(p.op==='support'){
  state.supports=state.supports.map(s=>s.player===p.data.player?p.data:s);
 }else if(p.op==='day'){
  inRiver(p.data.date);
  for(const r of p.data.rows){if(r.attempts>0&&!r.taskId)throw new RequestError('Select a tracked task before recording submitted attempts.');if(r.taskId&&!state.tasks.some(t=>t.id===r.taskId&&t.player===r.player))throw new RequestError('Choose this player’s tracked task.');}
  replace(state.days,p.data);
 }else if(p.op==='incident'){
  inRiver(p.data.date);if(p.data.catalogueId&&!state.catalogue.some(c=>c.id===p.data.catalogueId))throw new RequestError('Choose a valid catalogue pattern.');
  const data=p.data as GrowthState['incidents'][number];if(data.status==='Reviewed'&&!incidentAllocated(data))throw new RequestError('Resolve the affected player count before review.');replace(state.incidents,data);
 }else if(p.op==='review'){
  inRiver(p.data.date);if(p.data.status==='Confirmed'&&p.data.date>istDate())throw new RequestError('Confirm a review only on or after its assessment date.');
  const previous=state.reviews.find(r=>r.id===p.data.id);
  if(previous?.status==='Confirmed'&&p.data.status==='Draft')throw new RequestError('A confirmed review stays confirmed. Save a correction with evidence.');
  if(previous?.status==='Confirmed')state.reviewHistory.push(previous);
  replace(state.reviews,{...p.data,reviewer:u.name} as GrowthState['reviews'][number]);
 }else if(p.op==='catalogue'){
  replace(state.catalogue,p.data as GrowthState['catalogue'][number]);
 }else if(p.op==='practice'){
  if(p.data.week>weekCount(state.settings.start))throw new RequestError('Choose a river week.');
  const wd=weekDates(state.settings.start,p.data.week);if(wd.start>istDate())throw new RequestError('Practice priorities become available when the week starts.');
  const previous=state.practices.find(r=>r.id===p.data.id),focus=ranked(state,p.data.player,[wd.end,istDate()].sort()[0]);
  if(!previous&&!focus.complete)throw new RequestError('Confirm all ten C310 grades before saving this week’s practice.');
  replace(state.practices,{...p.data,...(previous?.c310?{c310:previous.c310}:{}),targets:previous?.targets??focus.targets.map(t=>t.attribute),weekend:previous?.weekend??focus.weekend?.attribute??''});
 }else if(p.op==='task'){
  inRiver(p.data.due);replace(state.tasks,p.data);
 }
 const now=new Date().toISOString(),revision=loaded.revision+1,json=JSON.stringify(state);
 if(json.length>3000000)throw new RequestError('This tracker has reached its record limit. Contact the project lead.');
 const collection=(await database()).growth, fields={data:state,revision,updated_by:u.email,updated_at:now};
 const result=loaded.revision===0?await collection.updateOne({_id:'jaguar'},{$setOnInsert:{_id:'jaguar',id:'jaguar',...fields}},{upsert:true}):await collection.updateOne({_id:'jaguar',revision:loaded.revision},{$set:fields});
 if(result.modifiedCount+result.upsertedCount!==1)throw new RequestError('Another leader saved a change. Reload the tracker, then save your kept draft again.',409);
 return reply({state,revision,updatedBy:u.email,updatedAt:now});
 }catch(e){return failure(e);}}
