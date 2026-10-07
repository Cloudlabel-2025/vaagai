import { PDFDocument,rgb,PDFString,type PDFFont,type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { regularFont,boldFont } from './c310-fonts';
import { calculate,round2,statusText,type Report,type Rating,type Priority } from './c310-model';
const A4:[number,number]=[595.28,841.89],margin=42,width=A4[0]-margin*2;
const navy=rgb(.09,.18,.30),teal=rgb(.05,.40,.44),purple=rgb(.36,.29,.59),muted=rgb(.34,.41,.49),line=rgb(.84,.88,.92),violet=rgb(.94,.92,.99),pale=rgb(.94,.97,.98),white=rgb(1,1,1);
function clean(s:string){const n=s.replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/[–—−]/g,'-').replace(/≥/g,'>=').replace(/→/g,'>').replace(/…/g,'...').replace(/·/g,' / ').replace(/\s+/g,' ').trim();return /[^\x20-\xff]/.test(n)?'[Original text is retained in the saved web assessment.]':n;}
const excerpt=(s:string,n:number)=>s.length>n?s.slice(0,n).trimEnd()+'...':s;
function wrap(text:string,font:PDFFont,size:number,w:number){const lines:string[]=[];let current='';for(const word of clean(text).split(' ')){if(!word)continue;if(font.widthOfTextAtSize(word,size)>w){if(current){lines.push(current);current='';}let chunk='';for(const c of word){if(font.widthOfTextAtSize(chunk+c,size)>w){lines.push(chunk);chunk=c;}else chunk+=c;}current=chunk;}else if(font.widthOfTextAtSize((current?current+' ':'')+word,size)>w){lines.push(current);current=word;}else current+=(current?' ':'')+word;}if(current)lines.push(current);return lines;}
export async function buildReportPdf(report:Report,scenario:Rating[]|null=null){
 const doc=await PDFDocument.create();doc.setTitle(`C310 Development Report - ${report.riderName}`);doc.setSubject('Employable Skill Matrix - provisional development model');doc.setAuthor('Vaagai / Jaguar Crew');
 doc.registerFontkit(fontkit);const regular=await doc.embedFont(regularFont,{subset:true}),bold=await doc.embedFont(boldFont,{subset:true});const pages=Array.from({length:4},()=>doc.addPage(A4));
 function text(p:PDFPage,s:string,x:number,y:number,size=10,font=regular,color=navy){let t=clean(s);const max=A4[0]-margin-x;if(font.widthOfTextAtSize(t,size)>max){while(t.length&&font.widthOfTextAtSize(t+'...',size)>max)t=t.slice(0,-1);t+='...';}p.drawText(t,{x,y,size,font,color});}
 function paragraph(p:PDFPage,s:string,x:number,y:number,w:number,size=10.5,color=navy,font=regular){const lines=wrap(s,font,size,w),leading=size*1.3;for(const l of lines){text(p,l,x,y,size,font,color);y-=leading;}return y;}
 function height(s:string,w:number,size=10.5,font=regular){return wrap(s,font,size,w).length*size*1.3;}
 function rule(p:PDFPage,y:number){p.drawLine({start:{x:margin,y},end:{x:A4[0]-margin,y},thickness:.6,color:line});}
 function link(p:PDFPage,label:string,url:string,x:number,y:number,w:number,size=9.4){const end=paragraph(p,label,x,y,w,size,teal);const h=y-end+4;const annot=doc.context.obj({Type:'Annot',Subtype:'Link',Rect:[x,end-2,x+w,y+size+2],Border:[0,0,0],A:{Type:'Action',S:'URI',URI:PDFString.of(url)}});p.node.addAnnot(doc.context.register(annot));return end;}
 function check(y:number,page:number){if(y<44)throw new Error(`PDF page ${page} overflowed its content boundary (${y.toFixed(1)}).`);}
 const titles=['Your score. Your next move.','Your development priorities','Keep the strengths. Shift the habits.','Build evidence. Then rescore.'];
 for(let i=0;i<4;i++){const p=pages[i];p.drawRectangle({x:0,y:A4[1]-12,width:A4[0],height:12,color:i===0?navy:purple});text(p,'EMPLOYABLE SKILL MATRIX / JAGUAR CREW',margin,802,9,bold,purple);text(p,`${i+1} / 4`,510,802,9,bold,purple);text(p,titles[i],margin,767,23,bold);text(p,`${report.riderName} / ${report.answers.subject} / ${report.answers.path}`,margin,742,9.5,regular,muted);text(p,`${report.answers.date} / ${report.source} / ${clean(report.model.version)}`,margin,725,8.5,regular,muted);rule(p,713);rule(p,34);text(p,'Provisional development model. Scores describe a snapshot, not personal worth.',margin,21,8,regular,muted);}
 // Page 1: scores, factors and all decision requirements.
 {
 const p=pages[0],gap=12,cw=(width-gap*2)/3;for(let i=0;i<3;i++)p.drawRectangle({x:margin+i*(cw+gap),y:619,width:cw,height:75,color:i===0?navy:pale});
 const vals=[report.scores.scoreB?.toFixed(2)??'Incomplete',report.scores.scoreA?.toFixed(2)??'Incomplete',report.outcome?.project??'Not assessed'],labels=['Score-B / 100','Score-A / 100','Ownership project'];for(let i=0;i<3;i++){const x=margin+i*(cw+gap);text(p,labels[i],x+12,674,9,regular,i===0?white:muted);paragraph(p,vals[i],x+12,644,cw-24,i===2?14:25,i===0?white:navy,bold);}
 let y=paragraph(p,statusText(report),margin,600,width,10.2,purple,bold)-8;y=paragraph(p,report.summary,margin,y,width,10.1)-14;
 text(p,'FACTOR LEVELS AND WEIGHTED POINTS',margin,y,9,bold,purple);y-=21;
 text(p,'Factor',margin,y,9,bold,muted);text(p,'Level',362,y,9,bold,muted);text(p,'Points',477,y,9,bold,muted);y-=17;
 for(const f of report.scores.factors){text(p,`${f.code}  ${f.name}${f.provisional?' *':''}`,margin,y,9.1);text(p,f.level===null?'N/A':round2(f.level)+'%',363,y,9.1);text(p,`${f.points?.toFixed(2)??'N/A'} / ${f.weight}`,476,y,9.1);p.drawRectangle({x:363,y:y-7,width:95,height:3,color:line});if(f.level!==null)p.drawRectangle({x:363,y:y-7,width:95*f.level/100,height:3,color:teal});y-=21;}
 const splits=report.model.factors.filter(f=>f.provisional).map(f=>`${f.code} ${round2(f.p1Share*100)}/${round2(f.p2Share*100)}`).join(', ');text(p,`* ${splits||'No provisional splits'} / versioned working settings.`,margin,y,8.4,regular,muted);y-=17;text(p,`Score-A excludes C1B: available weight ${report.scores.denominatorA}. Score-B totals all weighted points.`,margin,y,8.3,regular,muted);y-=23;
 const x2=margin+width/2+10,cwidth=width/2-10;const block=(x:number,title:string,requirements:Report['scores']['gateRequirements'])=>{text(p,title,x,y,10,bold);let yy=y-20;for(const r of requirements){yy=paragraph(p,`${r.met===null?'No decision':r.met?'Met':'Needs attention'}: ${r.label}`,x,yy,cwidth,9.2,r.met?teal:muted)-5;}return yy;};
 const y1=block(margin,'Ownership entry',report.scores.gateRequirements),y2=block(x2,'Certification',report.scores.certRequirements);y=Math.min(y1,y2)-6;y=paragraph(p,report.source==='Self-rated'?'Self-ratings can meet thresholds; mentor confirmation is still pending. Riders cannot award their own project pass or certification.':`Mentor ratings confirmed by ${report.reviewer}. Project and certification outcomes require an authorised reviewer.`,margin,y,width,8.7,muted);check(y,1);
 }
 // Page 2: two columns keep complete priority cards on one page.
 {
 const p=pages[1];let y=paragraph(p,'Review unmet minimums first. Other priorities consider factor levels and weighted point gaps. Interpretations are possibilities to verify with evidence.',margin,695,width,10.3,muted)-13;
 const cw=(width-14)/2,inner=cw-24,blocks=(priority:Priority)=>[priority.why,priority.interpretation,`Do: ${priority.do}`,`Avoid: ${priority.avoid}`,`Evidence: ${priority.proof}`];let size=10;
 const cardHeight=(pr:Priority,s:number)=>36+height(pr.name,inner,10.5,bold)+blocks(pr).reduce((n,t)=>n+height(t,inner,s)+3,0)+height(`Sources: ${pr.source.join('; ')}`,inner,8.1)+14;
 const rows=Array.from({length:Math.ceil(report.priorities.length/2)},(_,i)=>report.priorities.slice(i*2,i*2+2));
 while(rows.reduce((n,row)=>n+Math.max(...row.map(pr=>cardHeight(pr,size)))+12,0)>y-48&&size>9.3)size-=.1;
 for(const row of rows){const h=Math.max(...row.map(pr=>cardHeight(pr,size)));row.forEach((pr,col)=>{const x=margin+col*(cw+14);p.drawRectangle({x,y:y-h,width:cw,height:h,color:violet,borderColor:line,borderWidth:.5});text(p,`${pr.code} / Part ${pr.part} / ${round2(pr.level)}%`,x+12,y-18,9.2,bold,purple);let yy=paragraph(p,pr.name,x+12,y-34,inner,10.5,navy,bold)-5;for(const t of blocks(pr))yy=paragraph(p,t,x+12,yy,inner,size)-3;paragraph(p,`Sources: ${pr.source.join('; ')}`,x+12,yy,inner,8.1,muted);});y-=h+12;}
 check(y,2);
 }
 // Page 3: two columns for maintaining strengths and supporting habits.
 {
 const p=pages[2],cw=(width-18)/2;let y=695;const columns=[report.strengths,report.supporting],ys:number[]=[];
 for(let col=0;col<2;col++){const x=margin+col*(cw+18);text(p,col===0?'MAINTAIN STRONGER RATED AREAS':'SUPPORTING DEVELOPMENT',x,y,9,bold,purple);let yy=y-20;const items=columns[col];if(!items.length)yy=paragraph(p,'Use reviewed examples to identify areas worth maintaining.',x,yy,cw,9.5,muted)-8;for(const pr of items){text(p,`${pr.code} / Part ${pr.part} / ${round2(pr.level)}%`,x,yy,10,bold);yy-=16;for(const t of [`Keep practising: ${pr.do}`,`Avoid: ${pr.avoid}`,`Evidence: ${pr.proof}`])yy=paragraph(p,t,x,yy,cw,9.4)-4;yy-=8;}ys.push(yy);}
 y=Math.min(...ys)-3;text(p,'EXERCISES / GO TO YOUR CURRICULUM',margin,y,10,bold,purple);y-=21;
 const all=[...report.priorities,...report.supporting,...report.strengths];const ys2=[y,y];all.forEach((pr,i)=>{const col=i%2,x=margin+col*(cw+18);let yy=ys2[col];text(p,`${pr.code}, Part ${pr.part}: assigned curriculum`,x,yy,9.1,bold);yy-=14;const ref=pr.references[0];if(ref){const display=excerpt(`${ref.title} / ${new URL(ref.url).hostname}`,92);yy=link(p,display,ref.url,x,yy,cw,9.1)-4;}else yy=paragraph(p,'Curriculum activity to be assigned by your mentor.',x,yy,cw,9.1,muted)-4;ys2[col]=yy-6;});
 y=Math.min(...ys2)-4;y=paragraph(p,'Exercises: refer to your C310 curriculum for the factor and part above. Complete the activities assigned by your mentor. High ratings need repeated, varied evidence.',margin,y,width,8.6,muted);check(y,3);
 }
 // Page 4: review cycle, comparison, barriers, evidence and optional hypothesis.
 {
 const p=pages[3],cw=(width-18)/2;let y=695;const ys=[y,y];report.reviewCycle.forEach((c,i)=>{const col=i%2,x=margin+col*(cw+18);let yy=ys[col];text(p,c.week,x,yy,10,bold,teal);yy=paragraph(p,c.action,x,yy-16,cw,9.5)-9;ys[col]=yy;});y=Math.min(...ys)+2;
 text(p,'COMPARE RATINGS WITH EXAMPLES',margin,y,9.5,bold,purple);y-=17;
 const tableTop=y;
 for(let col=0;col<2;col++){const x=margin+col*(cw+18);text(p,'Factor',x,tableTop,8.7,bold,muted);text(p,'Self P1 / P2',x+58,tableTop,8.7,bold,muted);text(p,'Mentor P1 / P2',x+140,tableTop,8.7,bold,muted);let yy=tableTop-17;for(const r of report.selfRatings.slice(col*5,col*5+5)){const m=report.mentorRatings?.find(m=>m.code===r.code);text(p,r.code,x,yy,9);text(p,`${r.p1??'N/A'} / ${r.p2??'N/A'}`,x+58,yy,9);text(p,m?`${m.p1??'N/A'} / ${m.p2??'N/A'}`:'Not reviewed',x+140,yy,9);yy-=17;}}
 y=tableTop-101;
 y-=4;const columns=[['Barriers and support',[excerpt(report.answers.barriers,180),excerpt(report.answers.support,180)].filter(Boolean).join(' / ')||'Discuss structural barriers, access and useful accommodations with your mentor.'],['Recorded game/work evidence',report.context.work.length?report.context.work.slice(-3).map(w=>`${w.attribute||'Work'} ${w.date}: ${excerpt(w.observation,100)} / ${excerpt(w.evidence,100)}`).join(' / '):'No reviewed game/work evidence was linked when this report snapshot was generated.']];
 let low=y;for(let i=0;i<2;i++){const x=margin+i*(cw+18);text(p,columns[i][0],x,y,9.5,bold);low=Math.min(low,paragraph(p,columns[i][1],x,y-16,cw,9.0)-12);}y=low;
 if(report.mentorComments)y=paragraph(p,`Mentor observation: ${excerpt(report.mentorComments,160)}`,margin,y,width,9.1)-7;
 text(p,'RIVER PRACTICE AND NEXT REVIEW',margin,y,9.5,bold,purple);y=paragraph(p,`Assessment suggestion: ${report.weekend.targets.join(' / ')}. Weekend focus: ${report.weekend.weekend||'Not available'}. ${report.context.weekly.slice(-2).map(w=>`Saved week ${w.week}: ${w.targets.join('/')} / weekend ${w.weekend} / ${w.status}.`).join(' ')} Agree priorities with your mentor; existing saved weekly targets remain in place. Reassess in 6-8 weeks against the rubric.`,margin,y-17,width,9.2)-12;
 if(scenario){const result=calculate(report.model,scenario,report.outcome),base=report.mentorRatings??report.selfRatings,changes=scenario.filter(r=>{const b=base.find(b=>b.code===r.code);return b?.p1!==r.p1||b?.p2!==r.p2;});text(p,'HYPOTHETICAL / DOES NOT CHANGE THIS ASSESSMENT',margin,y,9.1,bold,teal);y=paragraph(p,`Proposed Score-B ${result.scoreB?.toFixed(2)??'Incomplete'} / Score-A ${result.scoreA?.toFixed(2)??'Incomplete'}. Real Score-B ${report.scores.scoreB?.toFixed(2)??'Incomplete'}. Changes: ${changes.map(r=>`${r.code}: ${r.p1??'missing'}/${r.p2??'missing'}`).join('; ')||'None'}.`,margin,y-17,width,9.1)-8;}
 y=paragraph(p,'Certification requires minimums and a project pass; 90+ is optional. One mistake does not automatically change a rating. Full evidence and activity links stay in your saved web assessment.',margin,y,width,8.7,muted);check(y,4);
 }
 return await doc.save();
}
