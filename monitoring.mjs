import {db,sql,save} from './store.mjs';
import {randomUUID} from 'node:crypto';
import {academicSession} from './context.mjs';
import {rememberLearningReleases} from './learning-releases.mjs';

const ratio=(done,total)=>({done,total,percent:total?Math.round(done/total*10000)/100:0});
export const monitoringCategories=['content','exercises','quizzes','mastery','reflections','assignments'];
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
  const mastery=assessments.some(a=>a.kind==='mastery'&&Number(a.week||String(a.lesson).split('-')[0])===week.id);
  const reflected=new Set([...reflections.filter(r=>ids.has(r.lesson)).map(r=>r.lesson),...progress.filter(p=>ids.has(p.lesson)&&p.reflectionDone).map(p=>p.lesson)]);
  const homework=assignments.filter(a=>Number(a.week)===week.id),markedCorrect=[...answers.values()].filter(Boolean).length;
  correct+=markedCorrect;attempted+=answers.size;
  const categories={content:ratio(new Set(progress.filter(p=>ids.has(p.lesson)&&p.contentConsumedAt).map(p=>p.lesson)).size,lessons.length),exercises:ratio(answers.size,valid.size),quizzes:ratio(quizLessons.size,lessons.length),mastery:ratio(lessons.length&&week.quiz?.length&&mastery?1:0,lessons.length&&week.quiz?.length?1:0),reflections:ratio(reflected.size,lessons.length),assignments:ratio(homework.filter(a=>submittedAssignments.has(a.id)).length,homework.length)};
  weekly.push({id:week.id,title:week.title,releasedAt:week.releasedAt||null,...ratio(Object.values(categories).reduce((n,c)=>n+c.done,0),Object.values(categories).reduce((n,c)=>n+c.total,0)),categories,lessonsCompleted:new Set(progress.filter(p=>ids.has(p.lesson)&&p.complete).map(p=>p.lesson)).size,lessonsTotal:lessons.length,notes:submissions.filter(s=>s.kind==='note'&&Number(s.week)===week.id).length});
 }
 const categories=Object.fromEntries(monitoringCategories.map(key=>[key,ratio(weekly.reduce((n,w)=>n+w.categories[key].done,0),weekly.reduce((n,w)=>n+w.categories[key].total,0))]));

 return {id:student.id,name:student.name,email:student.email,admission:student.admission||'',status:student.status,weeks:weekly,categories,...ratio(Object.values(categories).reduce((n,c)=>n+c.done,0),Object.values(categories).reduce((n,c)=>n+c.total,0)),practiceAccuracy:attempted?Math.round(correct/attempted*100):null,exerciseAttempts:practice.filter(a=>weeks.some(w=>w.lessons.some(l=>l.id===a.lesson&&l.questions.some(q=>q.id===a.question&&q.stage!=='quiz')))).length,quizAttempts:assessments.filter(a=>a.kind==='quiz'&&weeks.some(w=>w.lessons.some(l=>l.id===a.lesson))).length,notes:submissions.filter(s=>s.kind==='note').length,generalAssignments:0};
}

export async function monitoringApi({endpoint,method,url,b,u,c,s,t,scope,course,releaseState,scopeKey,lessonAccess,audit,json,fail}){
 if(endpoint==='content-read'&&method==='POST'){
  if(u.role!=='STUDENT')fail(403,'Only a student can mark their lesson as read.');const week=lessonAccess(u,c,s,t,b.lesson);if(!week.lessons.some(l=>l.id===b.lesson))fail(404,'Lesson not found.');await rememberLearningReleases(c,s,t,course,scopeKey,releaseState);let progress=db.progress.find(v=>v.student===u.id&&v.sessionId===academicSession()&&v.class===c&&v.subject===s&&v.term===t&&v.lesson===b.lesson);if(!progress){progress={id:randomUUID(),sessionId:academicSession(),student:u.id,class:c,subject:s,term:t,lesson:b.lesson,answers:{},reflectionDone:false};db.progress.push(progress);}progress.contentConsumedAt??=new Date().toISOString();await save();json({contentConsumedAt:progress.contentConsumedAt});return true;
 }
 if(endpoint==='assignment-week'&&method==='POST'){
  if(!['ADMIN','TEACHER'].includes(u.role))fail(403,'Staff access required.');scope(u,c,s);const assignment=db.assignments.find(a=>a.id===b.id&&a.sessionId===academicSession()&&a.class===c&&a.subject===s&&a.term===t);if(!assignment)fail(404,'Assignment not found.');if(!course(c,s,t).some(w=>w.id===Number(b.week)))fail(400,'Choose a valid learning week.');assignment.week=Number(b.week);audit(u,`Linked assignment ${assignment.id} to week ${assignment.week}`);await save();json({ok:true});return true;
 }
 if(endpoint!=='monitoring'||method!=='GET')return false;
 if(!['ADMIN','TEACHER'].includes(u.role))fail(403,'Staff access required.');scope(u,c,s);
 if(!db.classes.includes(c)||!db.subjects.includes(s))fail(400,'Choose a valid class and subject.');
 const sessionId=academicSession(),p=url.searchParams,weekChoice=p.get('week')||'latest',compareChoice=p.get('compareWeek')||'previous',pageSize=Number(p.get('pageSize')||10),requested=Number(p.get('page')||1),search=(p.get('search')||'').trim().slice(0,160).toLocaleLowerCase(),selected=p.get('student')||'';
 if(![10,20,50].includes(pageSize)||!Number.isSafeInteger(requested)||requested<1)fail(400,'Choose a valid page and page size.');
 const history=await rememberLearningReleases(c,s,t,course,scopeKey,releaseState),released=new Set(history.map(r=>r.lesson));
 const weeks=course(c,s,t).map(w=>({...w,lessons:w.lessons.filter(l=>released.has(l.id)),quiz:w.lessons.every(l=>released.has(l.id))?w.quiz:[],releasedAt:history.filter(r=>r.week===w.id&&r.releasedAt).map(r=>r.releasedAt).sort()[0]||null})).filter(w=>w.lessons.length).sort((a,b)=>a.id-b.id);
 const latest=weeks.at(-1)?.id||null;const sort=p.get('sort')||'completion';if(!['completion','name'].includes(sort))fail(400,'Choose a valid student ordering.');
 if(!['all','latest'].includes(weekChoice)&&!weeks.some(w=>String(w.id)===weekChoice))fail(400,'Choose a released learning week.');
 const current=weekChoice==='all'||weekChoice==='latest'?latest:Number(weekChoice);
 const previous=compareChoice==='previous'?weeks.filter(w=>w.id<current).at(-1)?.id||null:Number(compareChoice);
 if(compareChoice!=='previous'&&(!weeks.some(w=>w.id===previous)||previous===current))fail(400,'Choose a different released week for comparison.');
 const chosen=weekChoice==='all'?weeks:weeks.filter(w=>w.id===current);
 const students=db.users.filter(student=>student.role==='STUDENT'&&student.status==='ACTIVE'&&db.enrolments.some(e=>e.student===student.id&&e.sessionId===sessionId&&e.class===c));
 if(selected&&!students.some(student=>student.id===selected))fail(404,'Student not found in this class.');
 const fits=v=>v.sessionId===sessionId&&v.class===c&&v.subject===s&&v.term===t;
 const raw=Object.fromEntries(['practiceAttempts','progress','assessmentAttempts','submissions','reflections','assignments'].map(key=>[key,db[key].filter(fits)]));
 const recordsFor=ws=>({...raw,assignments:raw.assignments.filter(a=>ws.some(w=>w.id===Number(a.week))),submissions:raw.submissions.filter(v=>v.kind==='assignment'?raw.assignments.some(a=>a.id===v.assignment&&ws.some(w=>w.id===Number(a.week))):ws.some(w=>w.id===Number(v.week)))});
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
 json({students:all.slice((page-1)*pageSize,page*pageSize),total,pages,page,pageSize,latestWeek:latest,currentWeek:current,compareWeek:previous,weekChoice,weekOptions:weeks.map(w=>({id:w.id,title:w.title,releasedAt:w.releasedAt})),unlinkedAssignments:raw.assignments.filter(a=>!course(c,s,t).some(w=>w.id===Number(a.week))).length,summary:{categories,weeks:aggregateWeeks.filter(w=>chosen.some(c=>c.id===w.id)),allWeeks:aggregateWeeks,comparison:comparisonFor(aggregateWeeks),notes:all.reduce((n,v)=>n+v.notes,0),recentlyActive:all.filter(v=>v.recentlyActive).length,...ratio(all.reduce((n,v)=>n+v.done,0),all.reduce((n,v)=>n+v.total,0))},detail,generatedAt:new Date().toISOString()});return true;
}
