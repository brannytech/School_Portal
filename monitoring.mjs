import {db,sql,save} from './store.mjs';
import {randomUUID} from 'node:crypto';
import {academicSession} from './context.mjs';
import {rememberLearningReleases} from './learning-releases.mjs';
import {classSupport,defaultSupportSettings,measureTarget,planOutcome,planActions} from './support.mjs';
import {subjectSection,buildReport,filterPeriod} from './report.mjs';

const ratio=(done,total)=>({done,total,percent:total?Math.round(done/total*10000)/100:0});
export const monitoringCategories=['content','exercises','quizzes','reflections','assignments'];
export function studentWorkSummary(student,weeks,records){
 const mine=key=>(records[key]||[]).filter(v=>v.student===student.id);
 const practice=mine('practiceAttempts'),progress=mine('progress'),assessments=mine('assessmentAttempts').filter(a=>a.status==='SUBMITTED'),submissions=mine('submissions'),reflections=mine('reflections').filter(r=>!r.draft);
 const submittedAssignments=new Set(submissions.filter(s=>s.kind==='assignment').map(s=>s.assignment));
 const assignments=records.assignments||[],weekly=[];
 let correct=0,attempted=0;
 for(const week of weeks){
  const lessons=week.lessons,ids=new Set(lessons.map(l=>l.id)),answers=new Map(),valid=new Set(lessons.flatMap(l=>l.questions.filter(q=>q.stage!=='quiz').map(q=>l.id+'|'+q.id)));
  for(const p of progress.filter(p=>ids.has(p.lesson)))for(const [id,value]of Object.entries(p.answers||{}))if(valid.has(p.lesson+'|'+id))answers.set(p.lesson+'|'+id,value===true);
  for(const a of [...practice].sort((a,b)=>(Date.parse(a.at)||0)-(Date.parse(b.at)||0)))if(valid.has(a.lesson+'|'+a.question))answers.set(a.lesson+'|'+a.question,a.correct===true);
  const quizLessons=new Set(assessments.filter(a=>a.kind==='quiz'&&ids.has(a.lesson)).map(a=>a.lesson));
  const mastery=assessments.some(a=>['weekly','mastery'].includes(a.kind)&&Number(a.week||String(a.lesson).split('-')[0])===week.id);
  const reflected=new Set([...reflections.filter(r=>ids.has(r.lesson)).map(r=>r.lesson),...progress.filter(p=>ids.has(p.lesson)&&p.reflectionDone).map(p=>p.lesson)]);
  const homework=assignments.filter(a=>Number(a.week)===week.id),markedCorrect=[...answers.values()].filter(Boolean).length;
  correct+=markedCorrect;attempted+=answers.size;
  const categories={content:ratio(new Set(progress.filter(p=>ids.has(p.lesson)&&p.contentConsumedAt).map(p=>p.lesson)).size,lessons.length),exercises:ratio(answers.size,valid.size),quizzes:ratio(week.closingReleased!==false&&week.quiz?.length&&mastery?1:0,week.closingReleased!==false&&week.quiz?.length?1:0),reflections:ratio(week.closingReleased!==false&&(reflected.size||reflections.some(r=>r.scope==='week'&&Number(r.week)===week.id))?1:0,week.closingReleased!==false?1:0),assignments:ratio(homework.filter(a=>submittedAssignments.has(a.id)).length,homework.length)};
  weekly.push({id:week.id,title:week.title,releasedAt:week.releasedAt||null,...ratio(Object.values(categories).reduce((n,c)=>n+c.done,0),Object.values(categories).reduce((n,c)=>n+c.total,0)),categories,lessonsCompleted:new Set(progress.filter(p=>ids.has(p.lesson)&&p.complete).map(p=>p.lesson)).size,lessonsTotal:lessons.length});
 }
 const categories=Object.fromEntries(monitoringCategories.map(key=>[key,ratio(weekly.reduce((n,w)=>n+w.categories[key].done,0),weekly.reduce((n,w)=>n+w.categories[key].total,0))]));

 return {id:student.id,name:student.name,email:student.email,admission:student.admission||'',status:student.status,weeks:weekly,categories,...ratio(Object.values(categories).reduce((n,c)=>n+c.done,0),Object.values(categories).reduce((n,c)=>n+c.total,0)),practiceAccuracy:attempted?Math.round(correct/attempted*100):null,exerciseAttempts:practice.filter(a=>weeks.some(w=>w.lessons.some(l=>l.id===a.lesson&&l.questions.some(q=>q.id===a.question&&q.stage!=='quiz')))).length,quizAttempts:assessments.filter(a=>['weekly','quiz','mastery'].includes(a.kind)&&weeks.some(w=>w.lessons.some(l=>l.id===a.lesson))).length,generalAssignments:0,lateSubmissions:submissions.filter(s=>s.kind==='assignment'&&s.late===true&&assignments.some(a=>a.id===s.assignment)).length};
}

export async function monitoringApi({endpoint,method,url,b,u,c,s,t,scope,course,releaseState,scopeKey,lessonAccess,termAccess,audit,json,fail}){
 if(endpoint==='content-read'&&method==='POST'){
  if(u.role!=='STUDENT')fail(403,'Only a student can mark their lesson as read.');const week=lessonAccess(u,c,s,t,b.lesson);if(!week.lessons.some(l=>l.id===b.lesson))fail(404,'Lesson not found.');await rememberLearningReleases(c,s,t,course,scopeKey,releaseState);let progress=db.progress.find(v=>v.student===u.id&&v.sessionId===academicSession()&&v.class===c&&v.subject===s&&v.term===t&&v.lesson===b.lesson);if(!progress){progress={id:randomUUID(),sessionId:academicSession(),student:u.id,class:c,subject:s,term:t,lesson:b.lesson,answers:{},reflectionDone:false};db.progress.push(progress);}progress.contentConsumedAt??=new Date().toISOString();progress.complete=(progress.practiceScore??progress.accuracy??0)>=db.policy.completion;await save();json({contentConsumedAt:progress.contentConsumedAt});return true;
 }
 if(endpoint==='assignment-week'&&method==='POST'){
  if(!['ADMIN','TEACHER'].includes(u.role))fail(403,'Staff access required.');scope(u,c,s);const assignment=db.assignments.find(a=>a.id===b.id&&a.sessionId===academicSession()&&a.class===c&&a.subject===s&&a.term===t);if(!assignment)fail(404,'Assignment not found.');if(!course(c,s,t).some(w=>w.id===Number(b.week)))fail(400,'Choose a valid learning week.');assignment.week=Number(b.week);audit(u,`Linked assignment ${assignment.id} to week ${assignment.week}`);await save();json({ok:true});return true;
 }
 if(endpoint==='note-week'&&method==='POST'){
  if(u.role!=='STUDENT')fail(403,'Only students can link their own notes.');termAccess(u,c,s,t);
  const note=db.submissions.find(v=>v.id===b.id&&v.kind==='note'&&v.student===u.id&&v.sessionId===academicSession()&&v.class===c&&v.subject===s&&v.term===t);
  if(!note)fail(404,'Note submission not found.');if(note.week)fail(409,'This note already has a learning week.');
  const history=await rememberLearningReleases(c,s,t,course,scopeKey,releaseState);if(!history.some(v=>v.week===Number(b.week)))fail(400,'Choose a released learning week.');
  note.week=Number(b.week);audit(u,`Linked note ${note.id} to week ${note.week}`);await save();json({ok:true});return true;
 }
 if(endpoint==='support-settings'&&['GET','POST'].includes(method)){
  if(!['ADMIN','TEACHER'].includes(u.role))fail(403,'Staff access required.');
  if(method==='POST'){
   if(u.role!=='ADMIN')fail(403,'Only the administrator can change the support rules.');
   const n=(v,lo,hi,name)=>{const x=Number(v);if(!Number.isFinite(x)||x<lo||x>hi)fail(400,name+' must be between '+lo+' and '+hi+'.');return x;};
   const bands={developing:n(b.bands?.developing,1,99,'Developing'),proficient:n(b.bands?.proficient,1,99,'Proficient'),mastered:n(b.bands?.mastered,1,100,'Mastered')};
   if(!(bands.developing<bands.proficient&&bands.proficient<bands.mastered))fail(400,'Bands must rise: developing, proficient, mastered.');
   db.supportSettings={...defaultSupportSettings,...(db.supportSettings||{}),bands,enoughAnswers:n(b.enoughAnswers??defaultSupportSettings.enoughAnswers,1,50,'Answers needed'),behindDays:n(b.behindDays??defaultSupportSettings.behindDays,1,30,'Behind days'),inactiveDays:n(b.inactiveDays??defaultSupportSettings.inactiveDays,1,60,'Inactive days')};
   audit(u,'Changed support monitor rules');await save();
  }
  json({settings:{...defaultSupportSettings,...(db.supportSettings||{})},defaults:defaultSupportSettings});return true;
 }
 const supportContextFor=async(c,s,t)=>{
  if(!['ADMIN','TEACHER'].includes(u.role))fail(403,'Staff access required.');scope(u,c,s);
  if(!db.classes.includes(c)||!db.subjects.includes(s))fail(400,'Choose a valid class and subject.');
  const sessionId=academicSession(),history=await rememberLearningReleases(c,s,t,course,scopeKey,releaseState),released=new Set(history.map(r=>r.lesson));
  const weeks=course(c,s,t).map(w=>({...w,lessons:w.lessons.filter(l=>released.has(l.id)),releasedAt:history.filter(r=>r.week===w.id&&r.releasedAt).map(r=>r.releasedAt).sort()[0]||null})).filter(w=>w.lessons.length).sort((a,b)=>a.id-b.id);
  const fits=v=>v.sessionId===sessionId&&v.class===c&&v.subject===s&&v.term===t;
  const records=Object.fromEntries(['practiceAttempts','progress','assessmentAttempts','submissions','reflections','assignments'].map(key=>[key,(db[key]||[]).filter(fits)]));
  records.assignments=records.assignments.filter(a=>!a.status||a.status==='PUBLISHED'||a.status==='SCHEDULED'&&Date.parse(a.releaseAt)<=Date.now());
  const students=db.users.filter(x=>x.role==='STUDENT'&&x.status==='ACTIVE'&&db.enrolments.some(e=>e.student===x.id&&e.sessionId===sessionId&&e.class===c));
  const seen=new Map((await sql.all('SELECT user_id,last_seen FROM student_presence')).map(r=>[r.user_id,r.last_seen]));
  const settings={...defaultSupportSettings,...(db.supportSettings||{})};
  return {sessionId,weeks,fits,records,students,seen,settings,c,s,t};
 };
 const supportContext=()=>supportContextFor(c,s,t);
 // Plans whose due date has passed are measured once, and the result is kept for good.
 const livePlans=async(ctx,only)=>{
  db.supportPlans??=[];const mine=db.supportPlans.filter(p=>ctx.fits(p)&&(!only||p.student===only));let changed=false;
  const out=mine.map(plan=>{
   const after=measureTarget(plan,ctx.weeks,ctx.records,{settings:ctx.settings,sinceStart:true});
   if(plan.status==='OPEN'&&!plan.result){const result=planOutcome(plan,after);if(result){plan.result=result;plan.status='CLOSED';changed=true;}}
   const week=ctx.weeks.find(w=>w.id===Number(plan.week));
   return {...plan,topic:week?.title||'Week '+plan.week,progress:{score:after.score,level:after.level,answers:after.answers},actionLabel:planActions[plan.action]||plan.action};
  });
  if(changed)await save();return out;
 };
 if(endpoint==='support'&&method==='GET'){
  const ctx=await supportContext();
  const result=classSupport(ctx.students.map(x=>({id:x.id,name:x.name})),ctx.weeks,ctx.records,{settings:ctx.settings,seen:ctx.seen,records:ctx.records});
  const plans=await livePlans(ctx);
  for(const row of result.students)row.openPlans=plans.filter(p=>p.student===row.id&&p.status==='OPEN').length;
  const only=url.searchParams.get('student');
  if(only){const row=result.students.find(r=>r.id===only);if(!row)fail(404,'Student not found in this class.');json({student:row,plans:plans.filter(p=>p.student===only),weeks:ctx.weeks.map(w=>({id:w.id,title:w.title})),settings:ctx.settings,generatedAt:new Date().toISOString()});return true;}
  json({...result,weeks:ctx.weeks.map(w=>({id:w.id,title:w.title})),generatedAt:new Date().toISOString()});return true;
 }
 if(endpoint==='support-plan'&&method==='POST'){
  const ctx=await supportContext();
  const student=ctx.students.find(x=>x.id===b.student);if(!student)fail(404,'Student not found in this class.');
  const week=ctx.weeks.find(w=>w.id===Number(b.week));if(!week)fail(400,'Choose a released topic.');
  const skill=String(b.skill||'').trim().slice(0,120);if(skill&&!(db.skills?.[s]||[]).some(v=>v.toLowerCase()===skill.toLowerCase()))fail(400,'Choose a skill from this subject’s list, or leave it blank for the whole topic.');
  const action=String(b.action||'');if(!planActions[action])fail(400,'Choose an action.');
  const target=Number(b.target);if(!Number.isFinite(target)||target<1||target>100)fail(400,'The target must be between 1 and 100.');
  const start=new Date().toISOString(),due=new Date(String(b.due||'')+'T00:00:00Z');
  if(Number.isNaN(due.getTime()))fail(400,'Choose a due date.');const days=Math.round((due.getTime()-Date.now())/86400000);if(days<1||days>90)fail(400,'The due date must be between 1 and 90 days from today.');
  db.supportPlans??=[];if(db.supportPlans.some(p=>ctx.fits(p)&&p.student===student.id&&p.status==='OPEN'&&p.week===week.id&&(p.skill||'')===skill))fail(409,'This child already has an open plan for that topic.');
  const plan={id:randomUUID(),sessionId:ctx.sessionId,class:c,subject:s,term:t,student:student.id,studentName:student.name,week:week.id,skill:skill||undefined,action,notes:String(b.notes||'').trim().slice(0,1000),start,due:due.toISOString().slice(0,10),target,owner:u.id,ownerName:u.name,status:'OPEN',baseline:measureTarget({student:student.id,week:week.id,skill},ctx.weeks,ctx.records,{settings:ctx.settings}),created:start};
  db.supportPlans.push(plan);audit(u,`Started support plan for ${student.name}: ${week.title}${skill?' / '+skill:''}`);await save();json({plan});return true;
 }
 if(endpoint==='support-plan-close'&&method==='POST'){
  const ctx=await supportContext();db.supportPlans??=[];
  const plan=db.supportPlans.find(p=>p.id===b.id&&ctx.fits(p));if(!plan)fail(404,'Plan not found.');
  if(plan.result){json({plan});return true;}
  const after=measureTarget(plan,ctx.weeks,ctx.records,{settings:ctx.settings,sinceStart:true});
  plan.result=planOutcome(plan,after,Date.now(),{force:true});plan.status='CLOSED';plan.closedEarly=true;audit(u,`Closed support plan early for ${plan.studentName}`);await save();json({plan});return true;
 }
 // ---- Parent report (plan section 13): staff only, saved as snapshots, never a public link ----
 const reportPeriod=()=>{const day=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||''))?String(v):'';return {from:day(b.from??url.searchParams.get('from')),to:day(b.to??url.searchParams.get('to'))};};
 const reportBuild=async(studentId,period)=>{
  const subjects=[];let student=null,sessionId=academicSession();
  for(const subject of db.subjects){
   let ctx;try{ctx=await supportContextFor(c,subject,t);}catch(error){if(error.status===403||error.status===400)continue;throw error;}
   if(!ctx.weeks.length)continue;
   const found=ctx.students.find(x=>x.id===studentId);if(!found)continue;student=found;sessionId=ctx.sessionId;
   const alloc=db.allocations.find(a=>a.class===c&&a.subject===subject&&a.sessionId===ctx.sessionId),teacher=alloc?db.users.find(x=>x.id===alloc.teacher)?.name:'';
   const scores=(db.scores||[]).filter(x=>x.student===studentId&&x.class===c&&x.subject===subject&&x.term===t);
   subjects.push(subjectSection({student:{id:found.id,name:found.name},subject,teacher,weeks:ctx.weeks,records:ctx.records,scores,now:Date.now(),lastSeen:ctx.seen.get(found.id)||null,settings:ctx.settings,period}));
  }
  if(!student){const any=db.users.find(x=>x.id===studentId&&x.role==='STUDENT'&&db.enrolments.some(e=>e.student===x.id&&e.class===c));if(!any)fail(404,'Student not found in this class, or none of your subjects are released for this class yet.');student=any;}
  const full=db.users.find(x=>x.id===studentId);
  const brand=db.branding||{},sessionName=db.sessions.find(x=>x.id===sessionId)?.name||sessionId;
  return buildReport({student:{id:full.id,name:full.name,admission:full.admission||'',class:c},school:{name:db.school.name,motto:db.school.motto||'',address:brand.address||'',phone:brand.phone||'',principal:brand.principal||''},session:sessionName,term:t,period,sections:subjects,settings:{...defaultSupportSettings,...(db.supportSettings||{})}});
 };
 const reportClean=(v,max)=>String(v??'').replace(/\r/g,'').trim().slice(0,max);
 const reportMeta=r=>({id:r.id,student:r.student,studentName:r.studentName,class:r.class,term:r.term,period:r.period,status:r.status,version:r.version,created:r.created,createdBy:r.createdByName,reviewedAt:r.reviewedAt,releasedAt:r.releasedAt,releasedBy:r.releasedByName,downloads:r.downloads.length});
 const reportAllowed=r=>{if(u.role==='ADMIN')return true;return db.allocations.some(a=>a.teacher===u.id&&a.class===r.class);};
 if(endpoint==='report-draft'&&method==='GET'){
  if(!['ADMIN','TEACHER'].includes(u.role))fail(403,'Staff access required.');
  const only=url.searchParams.get('student');
  if(only){json({report:await reportBuild(only,reportPeriod())});return true;}
  const sessionId=academicSession(),ids=db.users.filter(x=>x.role==='STUDENT'&&x.status==='ACTIVE'&&db.enrolments.some(e=>e.student===x.id&&e.sessionId===sessionId&&e.class===c)).sort((a,z)=>a.name.localeCompare(z.name));
  const reports=[];for(const st of ids){try{reports.push(await reportBuild(st.id,reportPeriod()));}catch(error){if(error.status!==404)throw error;}}
  json({reports});return true;
 }
 if(endpoint==='report-list'&&method==='GET'){
  if(!['ADMIN','TEACHER'].includes(u.role))fail(403,'Staff access required.');
  const only=url.searchParams.get('student');
  json({reports:(db.reportSnapshots||[]).filter(r=>r.class===c&&r.term===t&&(!only||r.student===only)&&reportAllowed(r)).sort((a,z)=>z.created.localeCompare(a.created)).map(reportMeta)});return true;
 }
 if(endpoint==='report-get'&&method==='GET'){
  if(!['ADMIN','TEACHER'].includes(u.role))fail(403,'Staff access required.');
  const r=(db.reportSnapshots||[]).find(x=>x.id===url.searchParams.get('id'));if(!r||!reportAllowed(r))fail(404,'Report not found.');
  if(url.searchParams.get('download')==='1'){r.downloads.push({by:u.id,byName:u.name,at:new Date().toISOString()});audit(u,`Downloaded parent report for ${r.studentName}`);await save();}
  let data=r.data;
  if(u.role!=='ADMIN'){const mine=new Set(db.allocations.filter(a=>a.teacher===u.id&&a.class===r.class).map(a=>a.subject));data={...data,sections:data.sections.filter(x=>mine.has(x.subject))};}
  json({report:{...reportMeta(r),data}});return true;
 }
 if(endpoint==='report-save'&&method==='POST'){
  if(!['ADMIN','TEACHER'].includes(u.role))fail(403,'Staff access required.');
  const status=String(b.status||'DRAFT');if(!['DRAFT','REVIEWED','RELEASED'].includes(status))fail(400,'Unknown report status.');
  if(status==='RELEASED'&&u.role!=='ADMIN')fail(403,'Only the administrator can release a report.');
  db.reportSnapshots??=[];const period=reportPeriod();
  // The server rebuilds every figure itself; the browser can only change the wording.
  const data=await reportBuild(String(b.student||''),period);
  if(u.role!=='ADMIN'){const mine=new Set(db.allocations.filter(a=>a.teacher===u.id&&a.class===c).map(a=>a.subject));if(!mine.size)fail(403,'This class is not assigned to you.');}
  const comments=b.subjectComments&&typeof b.subjectComments==='object'?b.subjectComments:{};
  for(const sec of data.sections)if(typeof comments[sec.subject]==='string')sec.comment=reportClean(comments[sec.subject],1500);
  if(typeof b.overallComment==='string')data.overallComment=reportClean(b.overallComment,2000);
  if(Array.isArray(b.homeSuggestions))data.homeSuggestions=b.homeSuggestions.map(v=>reportClean(v,300)).filter(Boolean).slice(0,5);
  let r=b.id?db.reportSnapshots.find(x=>x.id===b.id):null;
  if(b.id&&!r)fail(404,'Report not found.');
  if(r&&r.class!==c)fail(400,'That report belongs to another class.');
  if(r&&r.status==='RELEASED')fail(409,'A released report cannot be edited. Start a new version instead.');
  const now=new Date().toISOString();
  if(!r){const version=db.reportSnapshots.filter(x=>x.student===data.student.id&&x.term===t&&x.class===c).length+1;r={id:randomUUID(),student:data.student.id,studentName:data.student.name,class:c,term:t,sessionId:academicSession(),version,created:now,createdBy:u.id,createdByName:u.name,downloads:[]};db.reportSnapshots.push(r);}
  Object.assign(r,{period,data,status,edited:now,editedBy:u.id});
  if(status==='REVIEWED'||status==='RELEASED'){r.reviewedAt=now;r.reviewedBy=u.id;}
  if(status==='RELEASED'){r.releasedAt=now;r.releasedBy=u.id;r.releasedByName=u.name;}
  audit(u,`${status==='RELEASED'?'Released':status==='REVIEWED'?'Reviewed':'Saved draft of'} parent report for ${r.studentName}`);await save();json({report:reportMeta(r)});return true;
 }
 const personal=endpoint==='my-progress';
 if((endpoint!=='monitoring'&&!personal)||method!=='GET')return false;
 if(personal){if(u.role!=='STUDENT')fail(403,'Student access required.');termAccess(u,c,s,t);}else{if(!['ADMIN','TEACHER'].includes(u.role))fail(403,'Staff access required.');scope(u,c,s);}
 if(!db.classes.includes(c)||!db.subjects.includes(s))fail(400,'Choose a valid class and subject.');
 const sessionId=academicSession(),p=url.searchParams,weekChoice=p.get('week')||'latest',compareChoice=p.get('compareWeek')||'previous',pageSize=Number(p.get('pageSize')||10),requested=Number(p.get('page')||1),search=(p.get('search')||'').trim().slice(0,160).toLocaleLowerCase(),selected=personal?u.id:p.get('student')||'';
 if(![10,20,50].includes(pageSize)||!Number.isSafeInteger(requested)||requested<1)fail(400,'Choose a valid page and page size.');
 const history=await rememberLearningReleases(c,s,t,course,scopeKey,releaseState),released=new Set(history.map(r=>r.lesson));
 const weeks=course(c,s,t).map(w=>({...w,lessons:w.lessons.filter(l=>released.has(l.id)),closingReleased:w.lessons.every(l=>released.has(l.id)),quiz:w.lessons.every(l=>released.has(l.id))?w.quiz:[],releasedAt:history.filter(r=>r.week===w.id&&r.releasedAt).map(r=>r.releasedAt).sort()[0]||null})).filter(w=>w.lessons.length).sort((a,b)=>a.id-b.id);
 const latest=weeks.at(-1)?.id||null;const sort=p.get('sort')||'completion';if(!['completion','name'].includes(sort))fail(400,'Choose a valid student ordering.');
 if(!['all','latest'].includes(weekChoice)&&!weeks.some(w=>String(w.id)===weekChoice))fail(400,'Choose a released learning week.');
 const current=weekChoice==='all'||weekChoice==='latest'?latest:Number(weekChoice);
 const previous=compareChoice==='previous'?weeks.filter(w=>w.id<current).at(-1)?.id||null:Number(compareChoice);
 if(compareChoice!=='previous'&&(!weeks.some(w=>w.id===previous)||previous===current))fail(400,'Choose a different released week for comparison.');
 const chosen=weekChoice==='all'?weeks:weeks.filter(w=>w.id===current);
 const students=db.users.filter(student=>(!personal||student.id===u.id)&&student.role==='STUDENT'&&student.status==='ACTIVE'&&db.enrolments.some(e=>e.student===student.id&&e.sessionId===sessionId&&e.class===c));
 if(selected&&!students.some(student=>student.id===selected))fail(404,'Student not found in this class.');
 const fits=v=>v.sessionId===sessionId&&v.class===c&&v.subject===s&&v.term===t;
 const raw=Object.fromEntries(['practiceAttempts','progress','assessmentAttempts','submissions','reflections','assignments'].map(key=>[key,db[key].filter(fits)]));
 const recordsFor=ws=>({...raw,assignments:raw.assignments.filter(a=>ws.some(w=>w.id===Number(a.week))&&(!a.status||a.status==='PUBLISHED'||a.status==='SCHEDULED'&&Date.parse(a.releaseAt)<=Date.now())),submissions:raw.submissions.filter(v=>v.kind==='assignment'?raw.assignments.some(a=>a.id===v.assignment&&ws.some(w=>w.id===Number(a.week))):ws.some(w=>w.id===Number(v.week)))});
 const chosenRecords=recordsFor(chosen),releasedRecords=recordsFor(weeks),seen=new Map((await sql.all('SELECT user_id,last_seen FROM student_presence')).map(r=>[r.user_id,r.last_seen]));
 const comparisonFor=values=>{
  const now=values.find(w=>w.id===current)||null,before=values.find(w=>w.id===previous)||null;
  return {current:now,previous:before,change:now&&before?Math.round((now.percent-before.percent)*100)/100:null};
 };
 const summaryFor=student=>{
  const value=studentWorkSummary(student,chosen,chosenRecords),allWeeks=studentWorkSummary(student,weeks,releasedRecords).weeks;
  const lastSeen=seen.get(student.id)||null,elapsed=lastSeen?Date.now()-Date.parse(lastSeen):Infinity;
  return {...value,lastSeen,recentlyActive:elapsed>=0&&elapsed<300000,comparison:comparisonFor(allWeeks),allWeeks};
 };
 const all=students.filter(student=>!search||[student.name,student.email,student.admission].some(v=>String(v||'').toLocaleLowerCase().includes(search))).map(summaryFor);
 all.sort((a,b)=>(sort==='completion'?a.percent-b.percent:0)||a.name.localeCompare(b.name,'en',{numeric:true,sensitivity:'base'})||a.id.localeCompare(b.id));
 const total=all.length,pages=Math.max(1,Math.ceil(total/pageSize)),page=Math.min(requested,pages);
 const categories=Object.fromEntries(monitoringCategories.map(key=>[key,ratio(all.reduce((n,v)=>n+v.categories[key].done,0),all.reduce((n,v)=>n+v.categories[key].total,0))]));
 const aggregateWeeks=weeks.map(w=>{const values=all.map(v=>v.allWeeks.find(x=>x.id===w.id));return {id:w.id,title:w.title,releasedAt:w.releasedAt,categories:Object.fromEntries(monitoringCategories.map(key=>[key,ratio(values.reduce((n,v)=>n+v.categories[key].done,0),values.reduce((n,v)=>n+v.categories[key].total,0))])),...ratio(values.reduce((n,v)=>n+v.done,0),values.reduce((n,v)=>n+v.total,0))};});
 const detail=selected?all.find(v=>v.id===selected)||summaryFor(students.find(v=>v.id===selected)):null;
 if(personal){const detail=summaryFor(u);json({detail,weekChoice,currentWeek:current,compareWeek:previous,weekOptions:weeks.map(w=>({id:w.id,title:w.title,releasedAt:w.releasedAt})),generatedAt:new Date().toISOString()});return true;}
 json({students:all.slice((page-1)*pageSize,page*pageSize),total,pages,page,pageSize,latestWeek:latest,currentWeek:current,compareWeek:previous,weekChoice,weekOptions:weeks.map(w=>({id:w.id,title:w.title,releasedAt:w.releasedAt})),unlinkedAssignments:raw.assignments.filter(a=>!course(c,s,t).some(w=>w.id===Number(a.week))).length,summary:{categories,weeks:aggregateWeeks.filter(w=>chosen.some(c=>c.id===w.id)),allWeeks:aggregateWeeks,comparison:comparisonFor(aggregateWeeks),recentlyActive:all.filter(v=>v.recentlyActive).length,...ratio(all.reduce((n,v)=>n+v.done,0),all.reduce((n,v)=>n+v.total,0))},detail,generatedAt:new Date().toISOString()});return true;
}
