// Support monitor engine (plan section 12). Pure functions: no database access, so every rule is unit-tested.
// Understanding (do they get it?) and engagement (did they do the work?) are measured separately.
// "Not enough evidence" is a status, never a zero.

export const defaultSupportSettings={
 bands:{developing:50,proficient:70,mastered:85},
 weights:{practice:30,quiz:40,assignment:30},
 enoughAnswers:8,
 trendChange:10,
 slippingDrop:15,
 behindDays:5,
 inactiveDays:7,
 guessingTries:3,guessingQuestions:5,
 overconfidentConfidence:4,
 lateOfLastFour:2,
 missingWorkPercent:60,
 reteachAverage:60,reteachShare:1/3
};
export const severeFlags=['struggling','slipping','inactive'];
export const flagInfo={
 struggling:{label:'Struggling with a topic',action:'Reteach in a small group; give the easiest missed questions again.'},
 slipping:{label:'Slipping',action:'Check in; look for a missed lesson or a skipped prerequisite.'},
 behind:{label:'Behind',action:'Remind the student; check access (data, phone).'},
 guessing:{label:'Possible guessing',action:'Ask the student to explain a worked example aloud.'},
 overconfident:{label:'Overconfident',action:'Short diagnostic quiz with private feedback.'},
 asked_help:{label:'Asked for help',action:'Reply in the discussion or in person.'},
 late_pattern:{label:'Late pattern',action:'Talk about workload and reminders.'},
 inactive:{label:'Inactive',action:'Contact the family through the school.'},
 missing_work:{label:'Missing work',action:'Agree a catch-up plan.'}
};
export const statusOrder=['needs_support','watch','no_evidence','on_track','excelling'];

const time=v=>Date.parse(v)||0;
const round=n=>Math.round(n*10)/10;
const percent=(n,d)=>d?n/d*100:0;
export const bandFor=(score,settings=defaultSupportSettings)=>score>=settings.bands.mastered?'Mastered':score>=settings.bands.proficient?'Proficient':score>=settings.bands.developing?'Developing':'Needs support';

export function topicEvidence(student,week,records,settings=defaultSupportSettings){
 const lessonIds=new Set(week.lessons.map(l=>l.id));
 const valid=new Set(week.lessons.flatMap(l=>(l.questions||[]).filter(q=>q.stage!=='quiz').map(q=>l.id+'|'+q.id)));
 const mine=key=>(records[key]||[]).filter(v=>v.student===student);
 // Practice: the first try at each question counts, so retries cannot hide a misunderstanding.
 const tries=new Map();
 for(const a of mine('practiceAttempts').sort((x,y)=>time(x.at)-time(y.at))){
  const key=a.lesson+'|'+a.question;if(!valid.has(key))continue;
  const t=tries.get(key)||{first:a.correct===true,count:0,solved:false,triesToSolve:0};
  t.count++;if(!t.solved){t.triesToSolve++;if(a.correct===true)t.solved=true;}
  tries.set(key,t);
 }
 const answers=tries.size,firstCorrect=[...tries.values()].filter(t=>t.first).length;
 const solvedTries=[...tries.values()].filter(t=>t.solved).map(t=>t.triesToSolve);
 const practice=answers?percent(firstCorrect,answers):null;
 const sat=mine('assessmentAttempts').filter(a=>a.status==='SUBMITTED'&&(Number(a.week)===week.id||lessonIds.has(a.lesson))&&Number.isFinite(Number(a.percentage)))
  .sort((x,y)=>time(x.submitted||x.at||x.started)-time(y.submitted||y.at||y.started));
 const recent=sat.slice(-2).map(a=>Number(a.percentage));
 const quiz=recent.length?Math.max(...recent):null;
 const weekAssignments=new Set((records.assignments||[]).filter(a=>Number(a.week)===week.id).map(a=>a.id));
 const marked=new Map();
 for(const s of mine('submissions').filter(s=>s.kind==='assignment'&&weekAssignments.has(s.assignment)&&s.score!=null&&Number(s.max)>0))marked.set(s.assignment,percent(Number(s.score),Number(s.max)));
 const assignment=marked.size?[...marked.values()].reduce((n,v)=>n+v,0)/marked.size:null;
 const parts=[['practice',practice],['quiz',quiz],['assignment',assignment]].filter(([,v])=>v!==null);
 const weightSum=parts.reduce((n,[k])=>n+settings.weights[k],0);
 const score=parts.length?round(parts.reduce((n,[k,v])=>n+v*settings.weights[k],0)/weightSum):null;
 const count=answers+sat.length+marked.size;
 const level=answers>=settings.enoughAnswers||sat.length>=1?'enough':count>0?'thin':'none';
 const lastAt=Math.max(0,...mine('practiceAttempts').filter(a=>valid.has(a.lesson+'|'+a.question)).map(a=>time(a.at)),...sat.map(a=>time(a.submitted||a.at||a.started)));
 return {week:week.id,title:week.title,score,band:score===null||level!=='enough'?null:bandFor(score,settings),level,
  evidence:{answers,assessments:sat.length,assignments:marked.size,text:level==='none'?'No evidence yet':`${score}% from ${answers} answer${answers===1?'':'s'}, ${sat.length} quiz${sat.length===1?'':'zes'}, ${marked.size} marked assignment${marked.size===1?'':'s'}`},
  sources:{practice:practice===null?null:round(practice),quiz,assignment:assignment===null?null:round(assignment)},
  tries:solvedTries,lastAt:lastAt||null};
}

// Trend: the newest topic with enough evidence against the earlier ones (up to two) that also have enough.
export function trendOf(topics,settings=defaultSupportSettings){
 const ok=topics.filter(t=>t.level==='enough'&&t.score!==null);
 if(ok.length<2)return {trend:null,change:null};
 const latest=ok.at(-1),before=ok.slice(-3,-1),avg=before.reduce((n,t)=>n+t.score,0)/before.length;
 const change=round(latest.score-avg);
 return {trend:change>=settings.trendChange?'improving':change<=-settings.trendChange?'slipping':'steady',change};
}

export function studentSupport(student,weeks,records,{now=Date.now(),lastSeen=null,settings=defaultSupportSettings}={}){
 const id=student.id,topics=weeks.map(w=>topicEvidence(id,w,records,settings));
 const {trend,change}=trendOf(topics,settings);
 const mine=key=>(records[key]||[]).filter(v=>v.student===id);
 const flags=[],add=(code,reason)=>flags.push({code,severe:severeFlags.includes(code),label:flagInfo[code].label,action:flagInfo[code].action,reason});
 for(const t of topics)if(t.level==='enough'&&t.score!==null&&t.score<settings.bands.developing)add('struggling',`${t.title} ${Math.round(t.score)}% (${t.evidence.answers} answers, ${t.evidence.assessments} quizzes)`);
 const ok=topics.filter(t=>t.level==='enough');
 if(ok.length>=2){const drop=ok.at(-2).score-ok.at(-1).score;if(drop>=settings.slippingDrop)add('slipping',`Down ${Math.round(drop)} points from ${ok.at(-2).title} to ${ok.at(-1).title}`);}
 // Activity: any practice, progress, quiz or submission.
 const activityAt=[...mine('practiceAttempts').map(a=>time(a.at)),...mine('progress').map(a=>time(a.contentConsumedAt)),...mine('assessmentAttempts').map(a=>time(a.submitted||a.started)),...mine('submissions').map(a=>time(a.created||a.submitted||a.at)),time(lastSeen)].filter(Boolean);
 const lastActive=activityAt.length?Math.max(...activityAt):0,day=86400000;
 for(const w of weeks){
  const released=time(w.releasedAt);if(!released||now-released<settings.behindDays*day)continue;
  const ids=new Set(w.lessons.map(l=>l.id));
  const did=mine('practiceAttempts').some(a=>ids.has(a.lesson))||mine('progress').some(p=>ids.has(p.lesson))||mine('assessmentAttempts').some(a=>Number(a.week)===w.id||ids.has(a.lesson));
  if(!did)add('behind',`${w.title}: released ${Math.floor((now-released)/day)} days ago, no activity`);
 }
 const hard=topics.flatMap(t=>t.tries);
 if(hard.length>=settings.guessingQuestions){const avg=hard.reduce((n,v)=>n+v,0)/hard.length;if(avg>=settings.guessingTries)add('guessing',`${round(avg)} tries on average before a correct answer (${hard.length} questions)`);}
 const confidences=mine('reflections').filter(r=>!r.draft&&Number.isFinite(Number(r.confidence)));
 const lastConfidence=confidences.at(-1);
 const scored=ok.at(-1);
 if(lastConfidence&&scored&&Number(lastConfidence.confidence)>=settings.overconfidentConfidence&&scored.score<settings.bands.developing)add('overconfident',`Confidence ${lastConfidence.confidence}/5 but ${scored.title} is ${Math.round(scored.score)}%`);
 const asks=mine('reflections').filter(r=>!r.draft&&!r.addressed&&r.question&&!/^\s*(none|no|nothing)\b/i.test(r.question));
 if(asks.length)add('asked_help',`${asks.length} question${asks.length===1?'':'s'} waiting for a reply`);
 const assigned=(records.assignments||[]).filter(a=>weeks.some(w=>Number(a.week)===w.id)||a.week==null);
 const subs=mine('submissions').filter(s=>s.kind==='assignment'&&assigned.some(a=>a.id===s.assignment));
 const lastFour=[...subs].sort((a,b)=>time(a.created||a.submitted||a.at)-time(b.created||b.submitted||b.at)).slice(-4);
 if(lastFour.filter(s=>s.late).length>=settings.lateOfLastFour)add('late_pattern',`${lastFour.filter(s=>s.late).length} of the last ${lastFour.length} assignments were late`);
 const submitted=new Set(subs.map(s=>s.assignment)).size;
 if(assigned.length>=2&&percent(submitted,assigned.length)<settings.missingWorkPercent)add('missing_work',`${submitted} of ${assigned.length} assignments submitted`);
 if(activityAt.length&&now-lastActive>=settings.inactiveDays*day)add('inactive',`No activity for ${Math.floor((now-lastActive)/day)} days`);
 // Engagement: share of released lessons the student touched.
 const lessonsTotal=weeks.reduce((n,w)=>n+w.lessons.length,0);
 const touched=new Set([...mine('progress').filter(p=>p.contentConsumedAt||p.complete).map(p=>p.lesson),...mine('practiceAttempts').map(a=>a.lesson)]);
 const lessonIds=new Set(weeks.flatMap(w=>w.lessons.map(l=>l.id)));
 const engagement=lessonsTotal?round(percent([...touched].filter(l=>lessonIds.has(l)).length,lessonsTotal)):null;
 const noEvidence=topics.every(t=>t.level==='none')&&!activityAt.length;
 const lightFlags=flags.filter(f=>!f.severe);
 const mastered=ok.filter(t=>t.score>=settings.bands.mastered).length;
 let status='on_track';
 if(flags.some(f=>f.severe))status='needs_support';
 else if(lightFlags.length)status='watch';
 else if(noEvidence)status='no_evidence';
 else if(ok.length>=2&&mastered>ok.length/2&&(engagement??0)>=80)status='excelling';
 // A flag on a student with no evidence at all would be a false alarm in week one.
 if(noEvidence&&!flags.some(f=>f.code==='behind'))status='no_evidence';
 const reasons=[...flags].sort((a,b)=>Number(b.severe)-Number(a.severe)).slice(0,3).map(f=>f.reason);
 const overall=ok.length?round(ok.reduce((n,t)=>n+t.score,0)/ok.length):null;
 return {id,name:student.name,status,flags,reasons,topics,trend,trendChange:change,engagement,overall,overallBand:overall===null?null:bandFor(overall,settings),lastActive:lastActive?new Date(lastActive).toISOString():null};
}

// Class view: every student plus the topics the whole class should revisit.
export function classSupport(students,weeks,records,options={}){
 const settings=options.settings||defaultSupportSettings;
 const rows=students.map(s=>studentSupport(s,weeks,records,{...options,settings,lastSeen:options.seen?.get?.(s.id)||null}));
 rows.sort((a,b)=>statusOrder.indexOf(a.status)-statusOrder.indexOf(b.status)||(a.overall??101)-(b.overall??101)||a.name.localeCompare(b.name));
 const counts=Object.fromEntries(statusOrder.map(k=>[k,rows.filter(r=>r.status===k).length]));
 const reteach=weeks.map(w=>{
  const cells=rows.map(r=>r.topics.find(t=>t.week===w.id)).filter(t=>t&&t.level==='enough');
  if(!cells.length)return null;
  const average=round(cells.reduce((n,t)=>n+t.score,0)/cells.length),weak=cells.filter(t=>t.score<settings.bands.developing).length;
  if(average>=settings.reteachAverage&&weak/cells.length<=settings.reteachShare)return null;
  return {week:w.id,title:w.title,average,weakStudents:weak,measured:cells.length,commonMistakes:commonMistakes(students,w,options.records||{})};
 }).filter(Boolean);
 return {counts,students:rows,reteach,settings};
}

// The three most-missed practice questions and the wrong answer chosen most often.
export function commonMistakes(students,week,records){
 const ids=new Set(students.map(s=>s.id)),valid=new Map(week.lessons.flatMap(l=>(l.questions||[]).filter(q=>q.stage!=='quiz').map(q=>[l.id+'|'+q.id,q])));
 const per=new Map();
 for(const a of records.practiceAttempts||[]){
  if(!ids.has(a.student))continue;const key=a.lesson+'|'+a.question;if(!valid.has(key)||a.correct===true)continue;
  const m=per.get(key)||{misses:0,wrong:new Map()};m.misses++;const r=String(a.response??'').trim().slice(0,80);if(r)m.wrong.set(r,(m.wrong.get(r)||0)+1);per.set(key,m);
 }
 return [...per.entries()].sort((a,b)=>b[1].misses-a[1].misses).slice(0,3).map(([key,m])=>({question:valid.get(key).id,prompt:String(valid.get(key).prompt||'').slice(0,120),misses:m.misses,commonWrongAnswer:[...m.wrong.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]||null}));
}
