import { activeRoster } from "../../../lib/access";
import { z } from 'zod';
import { identity,database,RequestError,sameOrigin,safeUrl } from '../../../lib/crew-server';
import { models,assessment,assessmentList,store,context,c310Failure } from '../../../lib/c310-server';
import { emptyRatings,canReview,calculate,makeReport,riderPlayer,type Assessment,type Answers,type MentorReview,type Model,type Outcome } from '../../../lib/c310-model';
import { initialGrowthState } from '../../../lib/growth-defaults';
import { attributes,ranked,weekDates,weekCount,weekAt,type GrowthState,type Practice } from '../../../lib/growth';
import { istDate,crew } from '../../../lib/jaguar';
export const dynamic='force-dynamic';
const text=z.string().trim().max(2400),short=z.string().trim().max(160),required=short.min(1),id=z.string().regex(/^[A-Za-z0-9_-]{1,100}$/),revision=z.number().int().min(1);
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{const d=new Date(v+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v;},'Enter a valid date.');
const code=z.enum(attributes.map(a=>a[0]) as [string,...string[]]),rating=z.number().min(0).max(5).multipleOf(.5).nullable();
const ratings=z.array(z.object({code,p1:rating,p2:rating,e1:z.string().trim().max(800),e2:z.string().trim().max(800)}).strict()).length(10).refine(r=>new Set(r.map(x=>x.code)).size===10,'Include each factor exactly once.');
const answers=z.object({subject:short,path:short,date,ratings,barriers:text,support:text,reflection:text}).strict();
const factor=z.object({code,name:required,weight:z.number().positive().max(100),p1Share:z.number().min(0).max(1),p2Share:z.number().min(0).max(1),p1:required,p2:required,provisional:z.boolean()}).strict().refine(f=>Math.abs(f.p1Share+f.p2Share-1)<1e-8,'Part shares must total 100%.');
const configuration=z.object({version:required,factors:z.array(factor).length(10),gate:z.object({scoreA:z.number().min(0).max(100),c1aP1:z.number().min(0).max(5),c1cP1:z.number().min(0).max(5),c1cP2:z.number().min(0).max(5),c2bP2:z.number().min(0).max(5)}).strict(),cert:z.object({c1bLevel:z.number().min(0).max(100),scoreB:z.number().min(0).max(100)}).strict(),note:text}).strict().refine(m=>new Set(m.factors.map(f=>f.code)).size===10&&Math.abs(m.factors.reduce((n,f)=>n+f.weight,0)-100)<1e-8,'Ten unique factors must total 100 weighted points.').refine(m=>m.factors.filter(f=>f.code!=='C1B').reduce((n,f)=>n+f.weight,0)>0,'Score-A requires available weight outside C1B.');
const base={id,revision};
const mutation=z.discriminatedUnion('op',[
 z.object({op:z.literal('new'),previousId:id.nullable().optional()}).strict(),
 z.object({op:z.literal('draft'),...base,answers}).strict(),z.object({op:z.literal('submit'),...base}).strict(),z.object({op:z.literal('request'),...base}).strict(),
 z.object({op:z.literal('mentor_draft'),...base,reviewId:id.nullable(),ratings,date,comment:text,factorComments:z.record(code,text)}).strict(),
 z.object({op:z.literal('mentor_confirm'),...base,reviewId:id}).strict(),
 z.object({op:z.literal('assign'),...base,code,part:z.union([z.literal(1),z.literal(2)]),title:required,url:z.string().max(2048).refine(s=>safeUrl(s),'Enter the actual HTTPS curriculum activity link.'),note:text}).strict(),
 z.object({op:z.literal('outcome'),...base,project:z.enum(['Not assessed','Passed','Needs further work']),evidence:text,certified:z.boolean()}).strict(),
 z.object({op:z.literal('weekend'),...base,week:z.number().int().min(1).max(14)}).strict(),
 z.object({op:z.literal('model'),data:configuration}).strict(),
]);
const reply=(data:unknown)=>Response.json(data,{headers:{'Cache-Control':'private, no-store','Vary':'Cookie'}});
export async function GET(){try{const u=await identity(),all=await assessmentList(u),roster=await activeRoster();return reply({user:u,models:await models(),assessments:all,contexts:Object.fromEntries(await Promise.all(all.map(async r=>[r.assessment.id,await context(r.assessment)]))),reviewRiders:roster.filter(p=>canReview(u,p.email,roster)).map(p=>({name:p.name,email:p.email}))});}catch(e){return c310Failure(e);}}
export async function POST(req:Request){try{
 sameOrigin(req);const roster=await activeRoster();const u=await identity(),raw=await req.text();if(raw.length>90000)throw new RequestError('This assessment entry is too large. Shorten the examples.');let input:unknown;try{input=JSON.parse(raw);}catch{throw new RequestError('Enter a valid C310 request.');}
 const parsed=mutation.safeParse(input);if(!parsed.success)throw new RequestError(parsed.error.issues[0].message);const p=parsed.data,now=new Date().toISOString();
 if(p.op==='model'){if(u.role!=='owner')throw new RequestError('Only Lavy can publish scoring-model versions.',403);if((await models()).some(m=>m.version===p.data.version))throw new RequestError('Use a new, unique model version label.');const model={...p.data,factors:attributes.map(([code])=>p.data.factors.find(f=>f.code===code)!),id:crypto.randomUUID(),createdAt:now} as Model;await (await database()).models.insertOne({_id:model.id,id:model.id,data:model,created_at:now});return reply({model});}
 if(p.op==='new'){
  if(p.previousId){const prior=await assessment(p.previousId,u);if(prior.assessment.rider!==u.email)throw new RequestError('Reassess only your own report.',403);}
  const model=(await models())[0],a:Assessment={id:crypto.randomUUID(),rider:u.email,riderName:u.name,model:structuredClone(model),answers:{subject:'',path:'',date:istDate(),ratings:emptyRatings(),barriers:'',support:'',reflection:''},status:'Draft',mentorReviews:[],curriculum:[],outcomes:[],reports:[],createdAt:now,previousId:p.previousId??null};
  if(p.previousId){const previous=(await assessment(p.previousId,u)).assessment;a.answers.subject=previous.answers.subject;a.answers.path=previous.answers.path;}
  await (await database()).assessments.insertOne({_id:a.id,id:a.id,rider:a.rider,data:a,revision:1,created_at:now,updated_at:now});return reply({record:{assessment:a,revision:1,updatedAt:now},context:await context(a)});
 }
 const loaded=await assessment(p.id,u),a=loaded.assessment;if(p.revision!==loaded.revision)throw new RequestError('This assessment changed. Reload saved data, then save your kept draft again.',409);
 const own=a.rider===u.email,mentor=canReview(u,a.rider,roster),latest=()=>[...a.mentorReviews].reverse().find(r=>r.status==='Confirmed')??null;
 const snapshot=async()=>{const review=latest();a.reports.push(makeReport(a,review?'Mentor-rated':'Self-rated',await context(a),review));};
 if(p.op==='draft'){
  if(!own)throw new RequestError('Only the rider can enter self-ratings.',403);if(a.status!=='Draft')throw new RequestError('Generated assessments are preserved. Start a reassessment to change self-ratings.');a.answers={...p.answers,ratings:a.model.factors.map(f=>p.answers.ratings.find(r=>r.code===f.code)!)} as Answers;
 }else if(p.op==='submit'){
  if(!own)throw new RequestError('Only the rider can submit a self-assessment.',403);if(a.status!=='Draft')throw new RequestError('This assessment already has a saved report.');if(!a.answers.subject||!a.answers.path)throw new RequestError('Enter the subject and route before generating the report.');if(a.answers.date>istDate())throw new RequestError('Choose an assessment date on or before today.');if(!calculate(a.model,a.answers.ratings).complete)throw new RequestError('Missing ratings do not receive a final score. Save the draft until all twenty parts have enough evidence.');a.status='Submitted';await snapshot();
 }else if(p.op==='request'){
  if(!own)throw new RequestError('Only the rider can request review.',403);if(a.status==='Draft')throw new RequestError('Generate the report before requesting mentor review.');if(!roster.some(c=>canReview(c,a.rider,roster)))throw new RequestError('An independent mentor must be assigned before this account can receive confirmation.');a.status='Review requested';
 }else if(p.op==='mentor_draft'){
  if(!mentor)throw new RequestError('Only an assigned independent mentor can rate this rider.',403);if(a.status==='Draft')throw new RequestError('The rider must submit the assessment before mentor review.');
  const existing=p.reviewId?a.mentorReviews.find(r=>r.id===p.reviewId):null;if(p.reviewId&&(!existing||existing.mentor!==u.email||existing.status!=='Draft'))throw new RequestError('Open your own draft review or start a new review.');
  const review={id:existing?.id??crypto.randomUUID(),mentor:u.email,mentorName:u.name,date:p.date,status:'Draft',ratings:a.model.factors.map(f=>p.ratings.find(r=>r.code===f.code)!),comment:p.comment,factorComments:p.factorComments} as MentorReview;
  if(existing)a.mentorReviews=a.mentorReviews.map(r=>r.id===existing.id?review:r);else a.mentorReviews.push(review);
 }else if(p.op==='mentor_confirm'){
  if(!mentor)throw new RequestError('An independent assigned mentor must confirm this review.',403);const r=a.mentorReviews.find(r=>r.id===p.reviewId&&r.mentor===u.email&&r.status==='Draft');if(!r)throw new RequestError('Save your independent mentor ratings as a draft first.');if(!calculate(a.model,r.ratings).complete||!r.comment)throw new RequestError('Confirmation needs all twenty mentor ratings and an evidence-based review comment.');if(r.date>istDate())throw new RequestError('A review cannot be confirmed before its date.');r.status='Confirmed';a.status='Reviewed';await snapshot();
 }else if(p.op==='assign'){
  if(!mentor)throw new RequestError('Only an assigned mentor can assign curriculum activities.',403);a.curriculum.push({id:crypto.randomUUID(),code:p.code as import('../../../lib/growth').Attribute,part:p.part,title:p.title,url:p.url,note:p.note,by:u.name,assignedAt:now});if(a.status!=='Draft')await snapshot();
 }else if(p.op==='outcome'){
  if(u.role!=='owner'||!mentor)throw new RequestError('Only Lavy can record authorised project and certification outcomes for another rider.',403);const review=latest();if(p.project==='Passed'&&(!review||!calculate(a.model,review.ratings).gate||!p.evidence))throw new RequestError('A project pass needs mentor-confirmed entry thresholds and project evidence.');const o:Outcome={id:crypto.randomUUID(),project:p.project,evidence:p.evidence,certified:p.certified,by:u.name,date:now};if(p.certified&&(!review||!calculate(a.model,review.ratings,o).cert))throw new RequestError('Certification requires the confirmed Ownership gate, C1B minimum, Score-B minimum and an authorised project pass.');a.outcomes.push(o);if(a.status!=='Draft')await snapshot();
 }else if(p.op==='weekend'){
  if(!mentor)throw new RequestError('An assigned mentor must agree the weekly plan.',403);const report=[...a.reports].reverse().find(r=>r.source==='Mentor-rated'),player=riderPlayer(a.rider);if(!report||!report.scores.complete||!player)throw new RequestError('A complete mentor-confirmed report is needed for a river player.');
  const growRow=await (await database()).growth.findOne({_id:'jaguar'}),g=growRow?growRow.data:initialGrowthState(),week=p.week;if(week>weekCount(g.settings.start))throw new RequestError('Choose a river week.');const wd=weekDates(g.settings.start,week);if(wd.start>istDate())throw new RequestError('Agree the weekly plan when its week begins.');
  if((report.reviewDate??report.answers.date)>wd.end)throw new RequestError('Use a week on or after the confirmed assessment date. Historical priorities are retained.');const existing=g.practices.find(w=>w.player===player&&w.week===week),standard=ranked(g,player,[wd.end,istDate()].sort()[0]);const targets=existing?.targets??(standard.complete?standard.targets.map(t=>t.attribute):report.weekend.targets),weekend=existing?.weekend??(standard.complete?standard.weekend!.attribute:report.weekend.weekend);const ref=report.context.curriculum.find(c=>c.code===weekend);
  const practice:Practice={...(existing??{id:`${player}__${week}`,player,week,targets,weekend,status:'Planned',minutes:0,evidence:'',feedback:'',retry:'',outcome:'',support:'',exerciseUrl:''}),support:[existing?.support,`Agreed from C310 ${report.model.version}; ${report.source} report dated ${report.answers.date}.`].filter(Boolean).join('\n'),exerciseUrl:existing?.exerciseUrl||ref?.url||'',c310:{assessmentId:a.id,reportId:report.id,source:existing||standard.complete?'Existing tracker priorities':'Mentor-assessment blended grades',grades:report.scores.factors.map(f=>({attribute:f.code,grade:f.blended!}))}};
  g.practices=g.practices.filter(w=>w.id!==practice.id).concat(practice);const newRevision=(growRow?.revision??0)+1;
  const collection=(await database()).growth, fields={data:g,revision:newRevision,updated_by:u.email,updated_at:now};
  const result=growRow?await collection.updateOne({_id:'jaguar',revision:growRow.revision},{$set:fields}):await collection.updateOne({_id:'jaguar'},{$setOnInsert:{_id:'jaguar',id:'jaguar',...fields}},{upsert:true});if(result.modifiedCount+result.upsertedCount!==1)throw new RequestError('The weekly tracker changed. Refresh before agreeing the plan.',409);return reply({record:loaded,context:await context(a),message:'Agreed priorities saved to the weekend plan.'});
 }
 const saved=await store(a,loaded.revision);return reply({record:saved,context:await context(a)});
 }catch(e){return c310Failure(e);}}
