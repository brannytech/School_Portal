// Parent report engine (plan section 13). Pure functions: figures come from the same support engine as the
// Monitor, so the report and the board can never disagree. Every sentence is built from a stored number.
import {studentSupport,defaultSupportSettings,bandFor} from './support.mjs';

const round=n=>Math.round(n);
const time=v=>Date.parse(v)||0;
export const reportStatuses=['DRAFT','REVIEWED','RELEASED'];

// Keep only work done inside the period. Records without a date (for example assignment definitions) are kept.
export function filterPeriod(records,period={}){
 const from=period.from?time(period.from+'T00:00:00Z'):0,to=period.to?time(period.to+'T23:59:59Z'):Infinity;
 const inside=v=>{const t=Number(v)||0;return !t||t>=from&&t<=to;};
 const when={practiceAttempts:a=>time(a.at),assessmentAttempts:a=>time(a.submitted||a.at||a.started),submissions:a=>time(a.created||a.submitted||a.at),progress:a=>time(a.contentConsumedAt)};
 const out={...records};
 for(const [key,get] of Object.entries(when))if(records[key])out[key]=records[key].filter(v=>inside(get(v)));
 return out;
}

// One subject's section for one child.
export function subjectSection({student,subject,teacher,weeks,records,scores=[],now=Date.now(),lastSeen=null,settings=defaultSupportSettings,period={}}){
 const filtered=filterPeriod(records,period);
 const row=studentSupport(student,weeks,filtered,{now,lastSeen,settings});
 const ok=row.topics.filter(t=>t.level==='enough'&&t.score!==null);
 const strengths=ok.filter(t=>t.score>=settings.bands.proficient).sort((a,b)=>b.score-a.score).slice(0,3).map(t=>({topic:t.title,score:round(t.score),answers:t.evidence.answers}));
 const weaknesses=ok.filter(t=>t.score<settings.bands.developing).sort((a,b)=>a.score-b.score).slice(0,3).map(t=>({topic:t.title,score:round(t.score),answers:t.evidence.answers,assessments:t.evidence.assessments}));
 const thin=row.topics.filter(t=>t.level!=='enough').map(t=>t.title).slice(0,5);
 const assigned=(records.assignments||[]).length,submitted=new Set(filtered.submissions.filter(x=>x.student===student.id&&x.kind==='assignment').map(x=>x.assignment)).size;
 const late=filtered.submissions.filter(x=>x.student===student.id&&x.kind==='assignment'&&x.late).length;
 const tests=scores.filter(x=>x.student===student.id).map(x=>({type:x.type||'Test',score:x.score,max:x.max,percent:x.max?round(x.score/x.max*100):null}));
 return {subject,teacher:teacher||'',overall:row.overall===null?null:round(row.overall),band:row.overallBand,trend:row.trend,trendChange:row.trendChange,engagement:row.engagement===null?null:round(row.engagement),
  strengths,weaknesses,skillNeedsHelp:row.skillNeedsHelp.map(k=>({name:k.name,score:round(k.score),answers:k.answers})),skillStrengths:row.skillStrengths.map(k=>({name:k.name,score:round(k.score)})),thinTopics:thin,
  assignments:{assigned,submitted,late},tests,flags:row.flags.map(f=>f.code),status:row.status,evidenceTopics:ok.length,hasEvidence:row.topics.some(t=>t.level!=='none')};
}

// Rule-based wording. Every sentence quotes a measure that appears in the report.
export function subjectComment(name,section){
 const first=name.split(' ')[0],sentences=[];
 if(section.overall===null){
  sentences.push(`There is not enough work yet to judge ${first}'s understanding in ${section.subject}.`);
 }else{
  let line=`${first} is ${section.band} in ${section.subject} (${section.overall}%)`;
  if(section.trend==='improving')line+=`, and is improving (up ${Math.abs(section.trendChange)} points)`;
  else if(section.trend==='slipping')line+=`, but has slipped (down ${Math.abs(section.trendChange)} points)`;
  sentences.push(line+'.');
 }
 if(section.strengths.length)sentences.push(`Strongest topic: ${section.strengths[0].topic} (${section.strengths[0].score}%).`);
 for(const w of section.weaknesses.slice(0,2))sentences.push(`Needs more practice on ${w.topic} (${w.score}% from ${w.answers} answer${w.answers===1?'':'s'}).`);
 for(const k of section.skillNeedsHelp.slice(0,1))sentences.push(`The skill to practise first is ${k.name} (${k.score}% over ${k.answers} answers).`);
 if(section.thinTopics.length)sentences.push(`Not enough work yet to judge understanding in ${section.thinTopics.slice(0,2).join(' and ')}.`);
 if(section.assignments.assigned)sentences.push(`Assignments handed in: ${section.assignments.submitted} of ${section.assignments.assigned}${section.assignments.late?` (${section.assignments.late} late)`:''}.`);
 return sentences.join(' ');
}

export function homeSuggestions(name,sections){
 const first=name.split(' ')[0],out=[];
 if(!sections.some(s=>s.hasEvidence))return [`Ask ${first} to log in and complete the first practice set this week so the teacher can see how to help.`];
 for(const s of sections){
  for(const k of s.skillNeedsHelp.slice(0,1))out.push(`${s.subject}: 10 minutes of practice on "${k.name}", three evenings a week.`);
  for(const w of s.weaknesses.slice(0,1))if(!s.skillNeedsHelp.length)out.push(`${s.subject}: revisit "${w.topic}" for 10 minutes, three evenings a week, and ask ${first} to explain one worked example aloud.`);
 }
 if(sections.some(s=>s.assignments.assigned&&s.assignments.submitted<s.assignments.assigned))out.push('Agree a fixed time each day for homework and check that assignments are handed in before the due date.');
 if(sections.some(s=>s.engagement!==null&&s.engagement<50))out.push(`Help ${first} log in a few times each week and finish each lesson from start to end.`);
 if(!out.length&&sections.some(s=>s.hasEvidence))out.push(`Keep up the good routine. A few extra challenge questions each week will help ${first} stretch further.`);
 return out.slice(0,3);
}

export function overallComment(name,sections){
 const first=name.split(' ')[0],measured=sections.filter(s=>s.overall!==null);
 if(!measured.length)return `${first} has not done enough work in the app yet for the school to judge understanding. The first step is to log in and complete the practice questions.`;
 const avg=round(measured.reduce((n,s)=>n+s.overall,0)/measured.length),eng=sections.filter(s=>s.engagement!==null);
 const engAvg=eng.length?round(eng.reduce((n,s)=>n+s.engagement,0)/eng.length):null;
 const parts=[`${first}'s overall understanding is ${bandFor(avg)} (${avg}%) across ${measured.length} subject${measured.length===1?'':'s'}.`];
 if(engAvg!==null)parts.push(`${first} has completed about ${engAvg}% of the lessons released so far.`);
 const best=[...measured].sort((a,b)=>b.overall-a.overall)[0],weak=[...measured].sort((a,b)=>a.overall-b.overall)[0];
 if(measured.length>1)parts.push(`The strongest subject is ${best.subject} (${best.overall}%) and the one needing most support is ${weak.subject} (${weak.overall}%).`);
 const slipping=measured.filter(s=>s.trend==='slipping').map(s=>s.subject);if(slipping.length)parts.push(`Recent results have slipped in ${slipping.join(' and ')}.`);
 parts.push('See the suggestions below for what to practise at home.');
 return parts.join(' ');
}

// Everything the page and the saved snapshot need.
export function buildReport({student,school,session,term,period,sections,generatedAt=new Date().toISOString(),settings=defaultSupportSettings}){
 const measured=sections.filter(s=>s.overall!==null),avg=measured.length?round(measured.reduce((n,s)=>n+s.overall,0)/measured.length):null;
 const eng=sections.filter(s=>s.engagement!==null);
 return {
  school,student:{id:student.id,name:student.name,admission:student.admission||'',class:student.class},session,term,period,generatedAt,
  glance:{overall:avg,band:avg===null?null:bandFor(avg,settings),engagement:eng.length?round(eng.reduce((n,s)=>n+s.engagement,0)/eng.length):null,
   assignments:{assigned:sections.reduce((n,s)=>n+s.assignments.assigned,0),submitted:sections.reduce((n,s)=>n+s.assignments.submitted,0),late:sections.reduce((n,s)=>n+s.assignments.late,0)}},
  sections:sections.map(s=>({...s,comment:subjectComment(student.name,s)})),
  overallComment:overallComment(student.name,sections),homeSuggestions:homeSuggestions(student.name,sections),
  footer:'Understanding combines first-try practice answers (30%), quizzes (40%) and marked assignments (30%). A topic is judged only when there is enough work; otherwise it says so. This report is confidential to the family.'
 };
}
