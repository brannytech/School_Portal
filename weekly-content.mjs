import {randomUUID} from 'node:crypto';
import {db,save} from './store.mjs';
import {academicSession} from './context.mjs';
import {rememberLearningReleases} from './learning-releases.mjs';
import {contentRevision,mergeWeekContent,validateWeekDocuments,assignDraftIds} from './lesson-document.mjs';
import {validateLessonDocument} from './public/lesson-document.js';
import {validateDocumentMath} from './math-content.mjs';

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
 const q={...input,id:clean(input?.id,100)||randomUUID(),prompt:clean(input?.prompt),kind:input?.kind||'short',answer:clean(input?.answer,2000),explanation:clean(input?.explanation),stage:input?.stage||'practice',difficulty:input?.difficulty||'Beginner'};
 if(!q.prompt||!q.answer||!q.explanation||!['numeric','choice','boolean','short','fill','matching','steps','graph','expression'].includes(q.kind))fail(400,'Every question needs a prompt, answer, answer type and explanation.');
 if(q.kind==='choice'){q.options=(input.options||[]).map(v=>clean(v,1000));if(q.options.length<2||!q.options.includes(q.answer))fail(400,'Multiple-choice answers must match one of at least two options.');}
 if(q.kind==='boolean'&&!['true','false'].includes(q.answer.toLowerCase()))fail(400,'True/false answers must be true or false.');
 if(Array.isArray(input.variables))q.variables=input.variables.map(v=>clean(v,30));if(Number.isFinite(input.tolerance)&&input.tolerance>=0)q.tolerance=input.tolerance;
 return q;
}
function prepareWeek(input,fail,only=null){
 const id=Number(input?.id);if(!Number.isInteger(id)||id<1||id>52)fail(400,'Choose a week from 1 to 52.');
 const strict=l=>!only||only.has(l.id);
 const week={...input,id,title:clean(input.title,200),subtitle:clean(input.subtitle,1000),reflectionPrompt:clean(input.reflectionPrompt)||'What did you learn from this week’s topic, and what do you still need help with?',workflow:'weekly',updatedAt:new Date().toISOString(),publicationId:randomUUID()};
 if(!week.title||!Array.isArray(input.lessons)||!input.lessons.length||input.lessons.length>30)fail(400,'Add a weekly topic and between 1 and 30 subtopics.');
 const ids=new Set();week.lessons=input.lessons.map((l,index)=>{
  const key=clean(l.id,100)||`${id}-${randomUUID()}`;if(!key.startsWith(id+'-')||ids.has(key))fail(400,'Subtopics need unique IDs belonging to this week.');ids.add(key);
  const videoUrl=clean(l.videoUrl,1500);if(videoUrl&&!youtubeId(videoUrl))fail(400,'Use a valid HTTPS YouTube video link.');
  const lesson={...l,id:key,week:id,order:index+1,title:clean(l.title,200),minutes:Math.max(1,Math.min(240,Number(l.minutes)||20)),objectives:(l.objectives||[]).map(v=>clean(v,1000)),explain:clean(l.explain,40000),realLife:clean(l.realLife),experiment:clean(l.experiment),summary:(l.summary||[]).map(v=>clean(v,1000)),videoUrl,commonMistake:clean(l.commonMistake),questions:[]};
  if(strict(l)&&(!lesson.title||(!lesson.explain&&!lesson.document?.blocks.length)))fail(400,`${lesson.title||'A subtopic'} needs a title and learning content before it can be released.`);
  if(!lesson.title)lesson.title='Untitled subtopic';
  if(!Array.isArray(l.questions)||l.questions.length>100)fail(400,'Add up to 100 practice questions to each subtopic.');
  lesson.questions=l.questions.map((q,i)=>question(q,`practice-${i+1}`,fail));
  if(new Set(lesson.questions.map(q=>q.id)).size!==lesson.questions.length)fail(400,'Practice question IDs must be unique.');
  lesson.example=l.example?.prompt?question(l.example,'worked-example',fail):null;return lesson;
 });
 if(!Array.isArray(input.quiz)||input.quiz.length>100)fail(400,'Add up to 100 questions to the weekly quiz.');
 week.quiz=input.quiz.map((q,i)=>({...question(q,`quiz-${i+1}`,fail),stage:q.stage||'quiz'}));
 if(new Set(week.quiz.map(q=>q.id)).size!==week.quiz.length)fail(400,'Weekly quiz question IDs must be unique.');return week;
}
function releaseWarnings(week,targets){const out=[];for(const l of week.lessons)if(targets.has(l.id)&&!l.questions.length)out.push(`${l.title}: no practice questions yet.`);if(!week.quiz.length)out.push('This week has no weekly quiz yet.');return out;}
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
 if(endpoint==='weekly-history'&&method==='GET'){
  staff();const id=Number(url.searchParams.get('week')),version=url.searchParams.get('version');
  if(!Number.isInteger(id)||id<1||id>52)fail(400,'Choose a valid week.');
  const current=course(c,s,t).find(w=>w.id===id),versions=(db.weekVersions||[]).filter(v=>fits(v)&&v.week===id);
  if(version){const record=version==='current'&&current?{id:'current',content:current}:versions.find(v=>v.id===version);if(!record)fail(404,'Version not found in this teaching scope.');json(record);return true;}
  json({current:!!current,versions:[...versions].reverse().map(({id,created,teacher,content})=>({id,created,teacher:db.users.find(u=>u.id===teacher)?.name||'Teacher',title:content.title,lessons:content.lessons.length}))});return true;
 }
 if(endpoint==='weekly-restore'&&method==='POST'){
  staff();const id=Number(b.week),key=scopeKey(c,s,t)+'|'+id,current=course(c,s,t).find(w=>w.id===id),draft=db.weekDrafts?.[key];
  if(!Number.isInteger(id)||id<1||id>52)fail(400,'Choose a valid week.');
  if((b.revision??null)!==contentRevision(current)||(b.draftRevision??null)!==(draft?.revision||draft?.savedAt||null))fail(409,'This week or draft changed. Reload before restoring.');
  const content=b.version==='current'?current:(db.weekVersions||[]).find(v=>v.id===b.version&&fits(v)&&v.week===id)?.content;
  if(!content)fail(404,'Version not found in this teaching scope.');
  const week=assignDraftIds(validateWeekDocuments(structuredClone(content))),revision=randomUUID();
  db.weekDrafts??={};db.weekDrafts[key]={week,revision,baseRevision:contentRevision(current),restoredFrom:b.version,savedBy:u.id,savedAt:new Date().toISOString(),assignments:db.assignments.filter(a=>fits(a)&&Number(a.week)===id)};
  audit(u,`Restored weekly content ${id} as a new private draft`);await save();json({saved:true,published:false,draftRevision:revision});return true;
 }
 if(endpoint==='studio-templates'){
  staff();if(method==='GET'){json((db.blockTemplates||[]).filter(v=>v.owner===u.id&&fits(v)));return true;}
  if(method==='POST'){
   const document=validateLessonDocument({schemaVersion:1,blocks:[b.block]});validateDocumentMath(document);
   const name=clean(b.name,100);if(!name)fail(400,'Name this reusable block.');
   if((db.blockTemplates||[]).filter(v=>v.owner===u.id).length>=50)fail(400,'You have reached the 50-template limit.');
   const record={id:randomUUID(),...ctx,owner:u.id,name,block:document.blocks[0]};db.blockTemplates??=[];db.blockTemplates.push(record);await save();json(record);return true;
  }
 }
 if(endpoint==='weekly-template'&&method==='GET'){
  staff();const id=Number(url.searchParams.get('week'));const key=scopeKey(c,s,t)+'|'+id;const week=course(c,s,t).find(w=>w.id===id);
  const draft=db.weekDrafts?.[key]||null;
  json({draft,published:week||null,releases:Object.fromEntries((week?.lessons||[]).map(l=>{const r=releaseState(c,s,t,l.id,scopeKey);return [l.id,{status:r.status,available:r.available,releaseAt:r.releaseAt||null}];})),assignments:db.assignments.filter(a=>fits(a)&&a.week===id),revision:contentRevision(week),draftRevision:draft?.revision||draft?.savedAt||null});return true;
 }
 if(endpoint==='weekly-template'&&method==='POST'){
  staff();const key=scopeKey(c,s,t),id=Number(b.week?.id);if(!Number.isInteger(id)||id<1||id>52)fail(400,'Choose a week from 1 to 52.');const existing=course(c,s,t).find(w=>w.id===id);
  const draft=db.weekDrafts?.[key+'|'+id],revision=contentRevision(existing),draftRevision=draft?.revision||draft?.savedAt||null;
  if((b.revision??null)!==revision)fail(409,'This week was changed by another teacher. Reload it before saving.');
  if((b.draftRevision??null)!==draftRevision)fail(409,'This draft was changed in another window. Reload it before saving.');
  validateWeekDocuments(b.week);
  if(b.assignments!==undefined&&(!Array.isArray(b.assignments)||b.assignments.length>30))fail(400,'Add up to 30 assignments.');
  // Inherit from the published source, not an abandoned draft: "Load published
  // version" must be able to discard blocks introduced only in that draft.
  const input=mergeWeekContent(b.week,existing);
  validateWeekDocuments(input);assignDraftIds(input);
  if(b.publish!==true){db.weekDrafts??={};const nextRevision=randomUUID();db.weekDrafts[key+'|'+id]={week:input,savedBy:u.id,savedAt:new Date().toISOString(),revision:nextRevision,baseRevision:revision,assignments:b.assignments||[]};await save();json({saved:true,published:false,week:input,revision,draftRevision:nextRevision});return true;}
  const allIds=(input.lessons||[]).map(l=>l.id).filter(Boolean);const targets=new Set(Array.isArray(b.release?.lessons)&&b.release.lessons.length?b.release.lessons:allIds);
  const week=prepareWeek(input,fail,targets);
  for(const lesson of week.lessons)for(const block of lesson.document?.blocks||[])if(block.type==='image'){const f=db.files.find(v=>v.id===block.fileId);if(!f||f.purpose!=='lesson-image'||f.class!==c||f.subject!==s||f.sessionId!==ctx.sessionId)fail(400,`${lesson.title}: an image is missing or belongs to another class. Insert it again.`);}
  const previousIds=new Set((existing?.lessons||[]).map(l=>l.id));const legacyOpen=new Set((existing?.lessons||[]).filter(l=>releaseState(c,s,t,l.id,scopeKey).available).map(l=>l.id));
  if(!Array.isArray(b.assignments)||b.assignments.length>30)fail(400,'Add up to 30 assignments.');
  const prepared=b.assignments.map(a=>{const previous=a.id?db.assignments.find(v=>v.id===a.id&&fits(v)&&Number(v.week)===week.id):null;if(a.id&&!previous)fail(400,'An assignment does not belong to this week.');return prepareAssignment({...a,week:week.id},ctx,u.id,fail,previous);});
  await rememberLearningReleases(c,s,t,course,scopeKey,releaseState);
  db.weekVersions??=[];const archive=content=>{if(content&&!db.weekVersions.some(v=>fits(v)&&v.week===week.id&&contentRevision(v.content)===contentRevision(content)))db.weekVersions.push({id:randomUUID(),...ctx,week:week.id,content:structuredClone(content),teacher:u.id,created:new Date().toISOString()});};archive(existing);archive(week);
  db.courses[key]=[...course(c,s,t).filter(w=>w.id!==week.id),week].sort((a,b)=>a.id-b.id);
  const release=b.release||{mode:b.unlock===false?'LOCKED':'NOW'};
  const modes={NOW:'UNLOCKED',SCHEDULED:'SCHEDULED',DRAFT:'DRAFT',LOCKED:'LOCKED'};
  if(!modes[release.mode])fail(400,'Choose publish now, schedule, draft or locked.');
  if(release.mode==='SCHEDULED'&&!Number.isFinite(Date.parse(release.releaseAt)))fail(400,'Choose a valid release date and time.');
  for(const lesson of week.lessons){
   const old=db.releases.find(r=>fits(r)&&r.lesson===lesson.id);const wasKnown=previousIds.has(lesson.id);
   if(targets.has(lesson.id)){db.releases=db.releases.filter(r=>r!==old);db.releases.push({id:randomUUID(),...ctx,lesson:lesson.id,status:modes[release.mode],releaseAt:release.mode==='SCHEDULED'?new Date(release.releaseAt).toISOString():null,teacher:u.id,updated:new Date().toISOString()});}
   else if(!old){db.releases.push({id:randomUUID(),...ctx,lesson:lesson.id,status:wasKnown&&legacyOpen.has(lesson.id)?'UNLOCKED':'DRAFT',teacher:u.id,updated:new Date().toISOString()});}
  }
  const keep=new Set(week.lessons.map(l=>l.id));db.releases=db.releases.filter(r=>!fits(r)||Number(String(r.lesson).split('-')[0])!==week.id||keep.has(r.lesson));
  for(const a of prepared){const index=db.assignments.findIndex(v=>v.id===a.id);if(index<0)db.assignments.push(a);else db.assignments[index]=a;}
  delete db.weekDrafts?.[key+'|'+week.id];audit(u,`Published weekly template ${week.id} for ${key}`);await save();await rememberLearningReleases(c,s,t,course,scopeKey,releaseState);json({published:true,week:week.id,revision:contentRevision(week),draftRevision:null,released:[...targets].filter(id=>keep.has(id)),mode:release.mode,warnings:releaseWarnings(week,targets)});return true;
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
