import { z } from 'zod';
import { identity,RequestError } from '../../../../../lib/crew-server';
import { assessment,c310Failure } from '../../../../../lib/c310-server';
import { buildReportPdf } from '../../../../../lib/c310-pdf';
import { attributes } from '../../../../../lib/growth';
import type { Rating } from '../../../../../lib/c310-model';
export const dynamic='force-dynamic';
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){try{
 const u=await identity(),{id}=await params,a=(await assessment(id,u)).assessment,url=new URL(req.url),report=a.reports.find(r=>r.id===url.searchParams.get('report'));if(!report)throw new RequestError('Saved report not found.',404);
 let scenario:Rating[]|null=null;const raw=url.searchParams.get('scenario');if(raw){if(raw.length>5000)throw new RequestError('Hypothetical changes are too large.');let input:unknown;try{input=JSON.parse(raw);}catch{throw new RequestError('Enter valid hypothetical ratings.');}const schema=z.array(z.object({code:z.enum(attributes.map(a=>a[0]) as [string,...string[]]),p1:z.number().min(0).max(5).multipleOf(.5).nullable(),p2:z.number().min(0).max(5).multipleOf(.5).nullable()}).strict()).length(10).refine(r=>new Set(r.map(x=>x.code)).size===10);const parsed=schema.safeParse(input);if(!parsed.success)throw new RequestError('Hypothetical ratings need ten factors and half marks from zero to five.');scenario=parsed.data.map(r=>({...r,e1:'',e2:''})) as Rating[];}
 const bytes=await buildReportPdf(report,scenario),name=a.riderName.replace(/[^A-Za-z0-9_-]/g,'_');return new Response(bytes as BodyInit,{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="C310_${name}_${report.answers.date}${scenario?'_Hypothetical':''}.pdf"`,'Cache-Control':'private, no-store','Vary':'oai-authenticated-user-id, oai-authenticated-user-email'}});
 }catch(e){return c310Failure(e);}}
