import {randomUUID} from 'node:crypto';
import {db,save} from './store.mjs';
import {academicSession} from './context.mjs';
import {rememberLearningReleases} from './learning-releases.mjs';

const clean=(v,n=15000)=>String(v??'').trim().slice(0,n);
export function youtubeId(value){
 try{const u=new URL(value);if(u.protocol!=='https:')return null;const host=u.hostname.toLowerCase();const id=host==='youtu.be'?u.pathname.slice(1):['youtube.com','www.youtube.com','m.youtube.com','www.youtube-nocookie.com'].includes(host)?(u.searchParams.get('v')||u.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1]):null;return /^[\w-]{11}$/.test(id||'')?id:null;}catch{return null;}
}
export function assignmentOpen(a,course,releaseState,scopeKey){
 const status=a.status||'PUBLISHED';
 if(!['PUBLISHED','SCHEDULED'].includes(status))return false;
 if(status==='SCHEDULED'&&!(Date.parse(a.releaseAt)<=Date.now()))return false;
 if(!a.week)return true; // Historical, unlinked assignments remain readable.
 const week=course(a.class,a.subject,a.term).find(w=>w.id===Number(a.week));
 return !!week?.lessons.some(l=>releaseState(a.class,a.subject,a.term,l.id,scopeKey).available);
}
export function closingOpen(week,c,s,t,releaseState,scopeKey){return !!week?.lessons.length&&week.lessons.every(l=>releaseState(c,s,t,l.id,scopeKey).available);}

function question(input,id,fail){
 const q={id:clean(input?.id,100)||randomUUID(),prompt:clean(input?.prompt),kind:input?.kind||'short',answer:clean(input?.answer,2000),explanation:clean(input?.explanation),stage:'practice',difficulty:input?.difficulty||'Beginner'};
 if(!q.prompt||!q.answer||!q.explanation||!['numeric','choice','boolean','short','fill','matching','steps','graph','expression'].includes(q.kind))fail(400,'Every question needs a prompt, answer, answer type and explanation.');
 if(q.kind==='choice'){q.options=(input.options||[]).map(v=>clean(v,1000));if(q.options.length<2||!q.options.includes(q.answer))fail(400,'Multiple-choice answers must match one of at least two options.');}
 if(q.kind==='boolean'&&!['true','false'].includes(q.answer.toLowerCase()))fail(400,'True/false answers must be true or false.');
 if(Array.isArray(input.variables))q.variables=input.variables.map(v=>clean(v,30));if(Number.isFinite(input.tolerance)&&input.tolerance>=0)q.tolerance=input.tolerance;
 return q;
}
function prepareWeek(input,fail){
 const id=Number(input?.id);if(!Number.isInteger(id)||id<1||id>52)fail(400,'Choose a week from 1 to 52.');
 const week={id,title:clean(input.title,200),subtitle:clean(input.subtitle,1000),reflectionPrompt:clean(input.reflectionPrompt)||'What did you learn from this week’s topic, and what do you still need help with?',workflow:'weekly',updatedAt:new Date().toISOString()};
 if(!week.title||!Array.isArray(input.lessons)||!input.lessons.length||input.lessons.length>30)fail(400,'Add a weekly topic and between 1 and 30 subtopics.');
 const ids=new Set();week.lessons=input.lessons.map((l,index)=>{
  const key=clean(l.id,100)||`${id}-${randomUUID()}`;if(!key.startsWith(id+'-')||ids.has(key))fail(400,'Subtopics need unique IDs belonging to this week.');ids.add(key);
  const videoUrl=clean(l.videoUrl,1500);if(videoUrl&&!youtubeId(videoUrl))fail(400,'Use a valid HTTPS YouTube video link.');
  const lesson={id:key,week:id,order:index+1,title:clean(l.title,200),minutes:Math.max(1,Math.min(240,Number(l.minutes)||20)),objectives:(l.objectives||[]).map(v=>clean(v,1000)),explain:clean(l.explain,40000),realLife:clean(l.realLife),experiment:clean(l.experiment),summary:(l.summary||[]).map(v=>clean(v,1000)),videoUrl,commonMistake:clean(l.commonMistake),questions:[]};
  if(!lesson.title||!lesson.explain)fail(400,'Each subtopic needs a title and learning content.');
  if(!Array.isArray(l.questions)||!l.questions.length||l.questions.length>100)fail(400,'Add between 1 and 100 practice questions to each subtopic.');
  lesson.questions=l.questions.map((q,i)=>({...question(q,`practice-${i+1}`,fail),stage:'practice'}));
  if(new Set(lesson.questions.map(q=>q.id)).size!==lesson.questions.length)fail(400,'Practice question IDs must be unique.');
  lesson.example=l.example?.prompt?question(l.example,'worked-example',fail):null;return lesson;
 });
 if(!Array.isArray(input.quiz)||!input.quiz.length||input.quiz.length>100)fail(400,'Add between 1 and 100 questions to the weekly quiz.');
 week.quiz=input.quiz.map((q,i)=>({...question(q,`quiz-${i+1}`,fail),stage:'quiz'}));
 if(new Set(week.quiz.map(q=>q.id)).size!==week.quiz.length)fail(400,'Weekly quiz question IDs must be unique.');return week;
}
export function prepareAssignment(b,ctx,teacher,fail,previous){
 const status=b.status||previous?.status||'PUBLISHED',week=Number(b.week||previous?.week);
 if(!['DRAFT','LOCKED','PUBLISHED','SCHEDULED'].includes(status))fail(400,'Choose draft, locked, published or scheduled.');
 if(b.releaseAt&&!Number.isFinite(Date.parse(b.releaseAt)))fail(400,'Choose a valid release date and time.');
 const due=clean(b.due,40),max=Number(b.max||100),releaseAt=b.releaseAt?new Date(b.releaseAt).toISOString():null;
 if(!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(due)||!Number.isFinite(Date.parse(due))||max<=0||max>1000||!Number.isFinite(max))fail(400,'Set a valid deadline and maximum score.');
 if(status==='SCHEDULED'&&!releaseAt)fail(400,'Choose a release date and time.');
 const title=clean(b.title,200),instructions=clean(b.instructions);if(!title||!instructions)fail(400,'Add an assignment title and instructions.');
 return {...previous,id:previous?.id||randomUUID(),...ctx,teacher:previous?.teacher||teacher,week:week||null,title,instructions,due,max,status,releaseAt,workDate:clean(b.workDate,30),relatedTopic:clean(b.relatedTopic,200),type:clean(b.type,100)||'Written homework',resubmission:!!b.resubmission,publishedAt:status==='PUBLISHED'?(previous?.publishedAt||new Date().toISOString()):previous?.publishedAt||null,updatedAt:new Date().toISOString()};
}

export async function weeklyContentApi(x){
 const {endpoint,method,url,b,u,c,s,t,scope,termAccess,lessonAccess,course,releaseState,scopeKey,audit,json,fail}=x;
 const ctx={sessionId:academicSession(),class:c,subject:s,term:t},fits=v=>v.sessionId===ctx.sessionId&&v.class===c&&v.subject===s&&v.term===t;
 const staff=()=>{if(!['ADMIN','TEACHER'].includes(u.role))fail(403,'Teacher access required.');scope(u,c,s);};
 if(endpoint==='weekly-template'&&method==='GET'){
  staff();const id=Number(url.searchParams.get('week'));const key=scopeKey(c,s,t)+'|'+id;const week=course(c,s,t).find(w=>w.id===id);
  json({draft:db.weekDrafts?.[key]||null,published:week||null,assignments:db.assignments.filter(a=>fits(a)&&a.week===id),revision:week?.updatedAt||null});return true;
 }
 if(endpoint==='weekly-template'&&method==='POST'){
  staff();const key=scopeKey(c,s,t),id=Number(b.week?.id);if(!Number.isInteger(id)||id<1||id>52)fail(400,'Choose a week from 1 to 52.');const existing=course(c,s,t).find(w=>w.id===id);
  if(b.revision!==undefined&&(existing?.updatedAt||null)!==b.revision)fail(409,'This week was changed by another teacher. Reload it before saving.');
  if(b.publish!==true){db.weekDrafts??={};db.weekDrafts[key+'|'+id]={week:{...b.week,id},savedBy:u.id,savedAt:new Date().toISOString(),assignments:b.assignments||[]};await save();json({saved:true,published:false});return true;}
  const week=prepareWeek(b.week,fail);
  if(!Array.isArray(b.assignments)||b.assignments.length>30)fail(400,'Add up to 30 assignments.');
  const prepared=b.assignments.map(a=>{const previous=a.id?db.assignments.find(v=>v.id===a.id&&fits(v)&&Number(v.week)===week.id):null;if(a.id&&!previous)fail(400,'An assignment does not belong to this week.');return prepareAssignment({...a,week:week.id},ctx,u.id,fail,previous);});
  await rememberLearningReleases(c,s,t,course,scopeKey,releaseState);
  db.weekVersions??=[];if(existing)db.weekVersions.push({id:randomUUID(),...ctx,week:week.id,content:structuredClone(existing),teacher:u.id,created:new Date().toISOString()});
  db.courses[key]=[...course(c,s,t).filter(w=>w.id!==week.id),week].sort((a,b)=>a.id-b.id);
  for(const lesson of week.lessons){db.releases=db.releases.filter(r=>!fits(r)||r.lesson!==lesson.id);db.releases.push({id:randomUUID(),...ctx,lesson:lesson.id,status:b.unlock===false?'LOCKED':'UNLOCKED',teacher:u.id,updated:new Date().toISOString()});}
  const opened=new Set(db.unlocks[key]||[]);if(b.unlock===false)opened.delete(week.id);else opened.add(week.id);db.unlocks[key]=[...opened];
  for(const a of prepared){const index=db.assignments.findIndex(v=>v.id===a.id);if(index<0)db.assignments.push(a);else db.assignments[index]=a;}
  delete db.weekDrafts?.[key+'|'+week.id];audit(u,`Published weekly template ${week.id} for ${key}`);await save();await rememberLearningReleases(c,s,t,course,scopeKey,releaseState);json({published:true,week:week.id});return true;
 }
 if(endpoint==='assignment-save'&&method==='POST'){
  staff();const previous=b.id?db.assignments.find(a=>a.id===b.id&&fits(a)):null;if(b.id&&!previous)fail(404,'Assignment not found.');
  if(!course(c,s,t).some(w=>w.id===Number(b.week||previous?.week)))fail(400,'Choose an existing learning week.');
  if(b.releaseAt&&!Number.isFinite(Date.parse(b.releaseAt)))fail(400,'Choose a valid release date.');
  const a=prepareAssignment(b,ctx,u.id,fail,previous);const index=db.assignments.findIndex(v=>v.id===a.id);if(index<0)db.assignments.push(a);else db.assignments[index]=a;audit(u,`Saved ${a.status} assignment ${a.id}`);await save();json(a);return true;
 }
 if(endpoint==='week-reflection'&&method==='POST'){
  if(u.role!=='STUDENT')fail(403,'Student access required.');termAccess(u,c,s,t);const week=course(c,s,t).find(w=>w.id===Number(b.week));
  if(!closingOpen(week,c,s,t,releaseState,scopeKey))fail(403,'The weekly reflection opens when all subtopics have been released.');
  if(!clean(b.learnt)||!clean(b.question))fail(400,'Describe what you learnt and your unanswered question, or write None for now.');
  let reflection=db.reflections.find(v=>fits(v)&&v.student===u.id&&v.week===week.id&&v.scope==='week');if(!reflection){reflection={id:randomUUID(),...ctx,student:u.id,name:u.name,week:week.id,scope:'week',lesson:week.lessons.at(-1).id};db.reflections.push(reflection);}
  Object.assign(reflection,{learnt:clean(b.learnt),question:clean(b.question),difficult:clean(b.difficult),confidence:Math.max(1,Math.min(5,Number(b.confidence)||3)),draft:!!b.draft,created:new Date().toISOString()});await save();json(reflection);return true;
 }
 if(endpoint==='assessment/start'&&method==='POST'&&b.kind==='weekly'){
  if(u.role!=='STUDENT')fail(403,'Student access required.');termAccess(u,c,s,t);const week=course(c,s,t).find(w=>w.id===Number(b.week));
  if(!closingOpen(week,c,s,t,releaseState,scopeKey))fail(403,'The weekly quiz opens when all subtopics have been released.');
  if(!week.quiz.length)fail(400,'Your teacher has not added this week’s quiz.');
  const questions=structuredClone(week.quiz),attempt={id:randomUUID(),...ctx,student:u.id,week:week.id,lesson:week.lessons.at(-1).id,kind:'weekly',started:new Date().toISOString(),status:'STARTED',questions,answers:{}};
  db.assessmentAttempts.push(attempt);await save();json({...attempt,questions:questions.map(({answer,explanation,check,...q})=>q),answers:undefined});return true;
 }
 return false;
}
