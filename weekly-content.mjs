import {randomUUID} from 'node:crypto';
import {db,save} from './store.mjs';
import {academicSession} from './context.mjs';
import {rememberLearningReleases} from './learning-releases.mjs';
import {contentRevision,mergeWeekContent,validateWeekDocuments,assignDraftIds} from './lesson-document.mjs';
import {validateLessonDocument} from './public/lesson-document.js';
import {validateDocumentMath} from './math-content.mjs';
import {gradeAssessment} from './dist/domain.js';

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
 if(!week)return false;
 const live=id=>releaseState(a.class,a.subject,a.term,id,scopeKey).available;
 // A lesson assignment waits for its own lesson; general and end-of-week work waits for any lesson of the week.
 if(a.scope==='LESSON'&&a.lessons?.length)return week.lessons.some(l=>l.id===a.lessons[0])&&live(a.lessons[0]);
 if(a.scope==='WEEK_END')return week.lessons.length>0&&week.lessons.every(l=>live(l.id));
 return week.lessons.some(l=>live(l.id));
}
export function closingOpen(week,c,s,t,releaseState,scopeKey){return !!week?.lessons.length&&week.lessons.every(l=>releaseState(c,s,t,l.id,scopeKey).available);}

function question(input,id,fail){
 const q={...input,id:/^[\w-]{1,100}$/.test(String(input?.id||''))?String(input.id):randomUUID(),prompt:clean(input?.prompt),kind:input?.kind||'short',answer:clean(input?.answer,2000),explanation:clean(input?.explanation),stage:input?.stage||'practice',difficulty:input?.difficulty||'Beginner'};
 if(!q.prompt||(!q.answer&&q.kind!=='multi')||!q.explanation||!['numeric','choice','multi','boolean','short','fill','matching','steps','graph','expression'].includes(q.kind))fail(400,'Every question needs a prompt, answer, answer type and explanation.');
 if(q.kind==='choice'){q.options=(input.options||[]).map(v=>clean(v,1000));if(q.options.length<2||!q.options.includes(q.answer))fail(400,'Multiple-choice answers must match one of at least two options.');}
 if(q.kind!=='multi')delete q.answers;
 if(input?.image?.fileId){const alt=clean(input.image.alt,300);if(!alt)fail(400,'Describe the picture in this question for learners who cannot see it.');q.image={fileId:clean(input.image.fileId,100),alt};}else delete q.image;
 if(q.kind==='multi'){
  q.options=(input.options||[]).map(v=>clean(v,1000));q.answers=(Array.isArray(input.answers)?input.answers:String(input.answer||'').split('|')).map(v=>clean(v,1000)).filter(Boolean);
  if(q.options.length<2||q.options.some(v=>v.includes('|')))fail(400,'Multiple-answer questions need at least two choices, and a choice cannot contain the | character.');
  if(!q.answers.length||q.answers.some(v=>!q.options.includes(v)))fail(400,'Choose at least one correct answer, from the listed choices.');
  q.answer=q.answers.join('|');
 }
 if(Array.isArray(input.accepted)&&q.kind!=='multi'&&q.kind!=='choice'&&q.kind!=='boolean'){q.accepted=input.accepted.map(v=>clean(v,500)).filter(Boolean).slice(0,20);if(!q.accepted.length)delete q.accepted;}
 if(input.marks!==undefined){const marks=Number(input.marks);if(!Number.isFinite(marks)||marks<=0||marks>100)fail(400,'Marks must be more than 0 and at most 100.');q.marks=Math.round(marks*100)/100;}
 if(input.hint!==undefined)q.hint=clean(input.hint,1000);
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
const SCOPES=['LESSON','GENERAL','WEEK_END'],MODES=['PHOTO','ONLINE'];
// Plain text of a lesson-style document (used as the readable fallback for instructions).
export function documentText(document){
 const flat=node=>!node?'':node.type==='text'?node.text||'':node.type==='inlineMath'?node.attrs?.latex||'':(node.content||[]).map(flat).join(node.type==='doc'?'\n':'');
 return (document?.blocks||[]).map(block=>block.type==='rich-text'?flat(block.content):block.text||block.latex||block.caption||'').filter(Boolean).join('\n').trim();
}
export function prepareAssignment(b,ctx,teacher,fail,previous){
 const status=b.status||previous?.status||'PUBLISHED',week=Number(b.week||previous?.week);
 if(!['DRAFT','LOCKED','PUBLISHED','SCHEDULED'].includes(status))fail(400,'Choose draft, locked, published or scheduled.');
 if(b.releaseAt&&!Number.isFinite(Date.parse(b.releaseAt)))fail(400,'Choose a valid release date and time.');
 const open=status==='PUBLISHED'||status==='SCHEDULED',max=Number(b.max??previous?.max??100),releaseAt=b.releaseAt?new Date(b.releaseAt).toISOString():null;
 const due=clean(b.due??'',40);
 // A deadline is needed once students can see the work; drafts and locked work may leave it open.
 if(due||open){if(!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(due)||!Number.isFinite(Date.parse(due)))fail(400,'Set a valid deadline.');}
 if(!Number.isFinite(max)||max<=0||max>1000)fail(400,'Set a maximum score between 1 and 1000.');
 if(status==='SCHEDULED'&&!releaseAt)fail(400,'Choose a release date and time.');
 const title=clean(b.title,200);if(!title)fail(400,'Add an assignment title.');
 const scope=SCOPES.includes(b.scope)?b.scope:previous?.scope||'GENERAL',mode=MODES.includes(b.mode)?b.mode:previous?.mode||'PHOTO';
 let document;
 if(b.document!==undefined&&b.document!==null){
  try{document=validateLessonDocument(b.document,{lenient:!open});validateDocumentMath(document);}catch(error){fail(400,error.message);}
 }else document=previous?.document;
 const instructions=clean(b.instructions)||(document?documentText(document):'')||previous?.instructions||'';
 if(open&&!instructions&&!document?.blocks?.length)fail(400,'Write the assignment instructions before releasing it.');
 if(!instructions&&status!=='DRAFT'&&status!=='LOCKED')fail(400,'Add assignment instructions.');
 const lessons=Array.isArray(b.lessons)?[...new Set(b.lessons.map(v=>clean(v,100)).filter(Boolean))].slice(0,30):previous?.lessons||[];
 if(scope==='LESSON'&&lessons.length!==1)fail(400,'Choose the one subtopic this assignment follows, or make it a general assignment.');
 let questions=previous?.questions||[];
 if(b.questions!==undefined){
  if(!Array.isArray(b.questions)||b.questions.length>100)fail(400,'Add up to 100 questions to an assignment.');
  // Drafts keep half-written questions; the full check runs when the assignment is released.
  const KEEP=['id','prompt','kind','answer','answers','accepted','options','explanation','hint','tolerance','marks','difficulty','variables'];
  questions=b.questions.map((q,i)=>open?{...question(q,'assignment-'+(i+1),fail),stage:'assignment'}:{...Object.fromEntries(KEEP.filter(k=>q?.[k]!==undefined).map(k=>[k,typeof q[k]==='string'?clean(q[k],2000):structuredClone(q[k])])),id:/^[\w-]{1,100}$/.test(String(q?.id||''))?String(q.id):randomUUID(),stage:'assignment',...(q?.image?.fileId?{image:{fileId:clean(q.image.fileId,100),alt:clean(q.image.alt,300)}}:{})});
  if(new Set(questions.map(q=>q.id)).size!==questions.length)fail(400,'Question IDs must be unique.');
 }
 if(mode==='ONLINE'&&open&&!questions.length)fail(400,'An online assignment needs at least one question.');
 const autoGrade=['IMMEDIATE','AFTER_REVIEW'].includes(b.autoGrade)?b.autoGrade:previous?.autoGrade||'IMMEDIATE';
 const showAnswers=b.showAnswers===undefined?previous?.showAnswers??true:!!b.showAnswers;
 return {...previous,id:previous?.id||randomUUID(),...ctx,teacher:previous?.teacher||teacher,week:week||null,title,instructions,...(document?{document}:{}),scope,lessons,mode,questions,autoGrade,showAnswers,due,max,status,releaseAt,workDate:clean(b.workDate??previous?.workDate,30),relatedTopic:clean(b.relatedTopic??previous?.relatedTopic,200),type:clean(b.type,100)||previous?.type||'Written homework',resubmission:b.resubmission===undefined?!!previous?.resubmission:!!b.resubmission,publishedAt:status==='PUBLISHED'?(previous?.publishedAt||new Date().toISOString()):previous?.publishedAt||null,updatedAt:new Date().toISOString()};
}
// What a student may receive: no answers, accepted alternatives or explanations.
const SAFE_QUESTION=['id','prompt','image','kind','options','difficulty','hint','stage','variables','tolerance','marks'];
export function studentAssignment(a){
 const out=Object.fromEntries(['id','week','title','subject','class','term','due','max','status','type','scope','lessons','mode','resubmission','autoGrade','showAnswers','document','instructions','workDate','relatedTopic','releaseAt'].filter(k=>a[k]!==undefined).map(k=>[k,structuredClone(a[k])]));
 out.questions=(a.questions||[]).map(q=>Object.fromEntries(SAFE_QUESTION.filter(k=>q[k]!==undefined).map(k=>[k,structuredClone(q[k])])));
 return out;
}
const lateness=a=>!!a.due&&Date.now()>Date.parse(a.due.length===10?a.due+'T23:59:59+01:00':a.due);

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
  const wanted=Array.isArray(b.release?.lessons)&&b.release.lessons.length?new Set(b.release.lessons):null;
  const lenient=lesson=>b.publish!==true||(!!wanted&&!wanted.has(lesson.id));
  validateWeekDocuments(b.week,{lenientFor:lenient});
  if(b.assignments!==undefined&&(!Array.isArray(b.assignments)||b.assignments.length>30))fail(400,'Add up to 30 assignments.');
  // Inherit from the published source, not an abandoned draft: "Load published
  // version" must be able to discard blocks introduced only in that draft.
  const input=mergeWeekContent(b.week,existing);
  validateWeekDocuments(input,{lenientFor:lenient});assignDraftIds(input);
  if(b.publish!==true){db.weekDrafts??={};const nextRevision=randomUUID();db.weekDrafts[key+'|'+id]={week:input,savedBy:u.id,savedAt:new Date().toISOString(),revision:nextRevision,baseRevision:revision,assignments:b.assignments||[]};await save();json({saved:true,published:false,week:input,revision,draftRevision:nextRevision});return true;}
  const allIds=(input.lessons||[]).map(l=>l.id).filter(Boolean);const targets=new Set(Array.isArray(b.release?.lessons)&&b.release.lessons.length?b.release.lessons:allIds);
  const week=prepareWeek(input,fail,targets);
  for(const lesson of week.lessons)if(targets.has(lesson.id))for(const block of lesson.document?.blocks||[])if(block.type==='image'){const f=db.files.find(v=>v.id===block.fileId);if(!f||f.purpose!=='lesson-image'||f.class!==c||f.subject!==s||f.sessionId!==ctx.sessionId)fail(400,`${lesson.title}: an image is missing or belongs to another class. Insert it again.`);}
  for(const lesson of week.lessons)if(targets.has(lesson.id))for(const q of lesson.questions||[])if(q.image?.fileId&&!ownsImage(q.image.fileId,c,s,ctx.sessionId))fail(400,`${lesson.title}: a picture in a practice question is missing or belongs to another class. Add it again.`);
  for(const q of week.quiz||[])if(q.image?.fileId&&!ownsImage(q.image.fileId,c,s,ctx.sessionId))fail(400,'A picture in a quiz question is missing or belongs to another class. Add it again.');
  // Adding to a published week: subtopics the teacher did not choose keep their live content; their edits stay in the private draft.
  const pendingEdits=[];
  if(existing)week.lessons=week.lessons.map(l=>{if(targets.has(l.id))return l;const old=existing.lessons.find(v=>v.id===l.id);if(!old)return l;const kept={...old,order:l.order};if(contentRevision(kept)!==contentRevision(l))pendingEdits.push(l.id);return kept;});
  const previousIds=new Set((existing?.lessons||[]).map(l=>l.id));const legacyOpen=new Set((existing?.lessons||[]).filter(l=>releaseState(c,s,t,l.id,scopeKey).available).map(l=>l.id));
  if(!Array.isArray(b.assignments)||b.assignments.length>30)fail(400,'Add up to 30 assignments.');
  const prepared=b.assignments.map(a=>{const previous=a.id?db.assignments.find(v=>v.id===a.id&&fits(v)&&Number(v.week)===week.id):null;if(a.id&&!previous)fail(400,'An assignment does not belong to this week.');const made=prepareAssignment({...a,week:week.id},ctx,u.id,fail,previous);for(const q of made.questions||[])if(q.image?.fileId&&!ownsImage(q.image.fileId,made.class,made.subject,made.sessionId))fail(400,'A picture in an assignment question is missing or belongs to another class. Add it again.');for(const block of made.document?.blocks||[])if(block.type==='image'&&!ownsImage(block.fileId,made.class,made.subject,made.sessionId))fail(400,'An image in an assignment is missing or belongs to another class. Insert it again.');return made;});
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
  let nextDraft=null;if(pendingEdits.length){nextDraft=randomUUID();db.weekDrafts??={};db.weekDrafts[key+'|'+week.id]={week:input,savedBy:u.id,savedAt:new Date().toISOString(),revision:nextDraft,baseRevision:contentRevision(week),assignments:b.assignments||[]};}else delete db.weekDrafts?.[key+'|'+week.id];audit(u,`Published weekly template ${week.id} for ${key}`);await save();await rememberLearningReleases(c,s,t,course,scopeKey,releaseState);json({published:true,week:week.id,revision:contentRevision(week),draftRevision:nextDraft,pendingEdits,released:[...targets].filter(id=>keep.has(id)),mode:release.mode,warnings:releaseWarnings(week,targets)});return true;
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
  db.assessmentAttempts.push(attempt);await save();json({...attempt,questions:questions.map(q=>Object.fromEntries([...SAFE_QUESTION,'objective'].filter(k=>q[k]!==undefined).map(k=>[k,structuredClone(q[k])]))),answers:undefined});return true;
 }

 // ---------- assignments written in Lesson Studio ----------
 const mine=id=>{staff();const a=db.assignments.find(v=>v.id===id);if(!a)fail(404,'Assignment not found.');scope(u,a.class,a.subject);if(a.sessionId&&a.sessionId!==ctx.sessionId)fail(404,'Assignment not found in this academic session.');return a;};
 // A week that is still a private draft can already have assignments written for it.
 const ownsImage=(fileId,cc,ss,sid)=>{const f=db.files.find(v=>v.id===fileId);return !!f&&f.purpose==='lesson-image'&&f.class===cc&&f.subject===ss&&f.sessionId===sid;};
 const weekOf=(week,cc=c,ss=s,tt=t)=>course(cc,ss,tt).find(w=>w.id===Number(week))||db.weekDrafts?.[scopeKey(cc,ss,tt)+'|'+Number(week)]?.week;
 const checkLinks=(a,week)=>{
  if(!week)fail(400,'Choose a valid week for this assignment.');
  for(const id of a.lessons||[])if(!week.lessons.some(l=>l.id===id))fail(400,'An assignment can only follow subtopics from its own week.');
  for(const block of a.document?.blocks||[])if(block.type==='image'&&!ownsImage(block.fileId,a.class,a.subject,a.sessionId))fail(400,'An image in the instructions is missing or belongs to another class. Insert it again.');
  for(const q of a.questions||[])if(q.image?.fileId&&!ownsImage(q.image.fileId,a.class,a.subject,a.sessionId))fail(400,'A picture in a question is missing or belongs to another class. Add it again.');
 };
 if(endpoint==='assignments'&&method==='GET'){
  staff();const week=Number(url.searchParams.get('week'));
  json({assignments:db.assignments.filter(a=>fits(a)&&(!week||Number(a.week)===week)).map(a=>({...a,submissions:db.submissions.filter(v=>v.kind==='assignment'&&v.assignment===a.id).length,available:assignmentOpen(a,course,releaseState,scopeKey)}))});return true;
 }
 if(endpoint==='assignment-save'&&method==='POST'){
  staff();const input=b.assignment||b,previous=input.id?db.assignments.find(v=>v.id===input.id&&fits(v)):null;
  if(input.id&&!previous)fail(404,'Assignment not found in this class and subject.');
  const week=weekOf(input.week||previous?.week);
  // New work starts locked: the teacher releases it in class, once the topic has been taught.
  const a=prepareAssignment({...input,status:input.status||previous?.status||'LOCKED'},ctx,u.id,fail,previous);
  checkLinks(a,week);
  if(previous&&previous.mode==='ONLINE'&&a.mode!=='ONLINE'&&db.submissions.some(v=>v.assignment===a.id))fail(409,'Students already answered this online assignment, so its type cannot change.');
  if(previous)Object.assign(previous,a);else db.assignments.push(a);
  audit(u,(previous?'Updated':'Created')+' assignment '+a.id);await save();json({...(previous||a),assignment:previous||a});return true;
 }
 if(endpoint==='assignment-release'&&method==='POST'){
  const a=mine(b.id);if(!fits(a))fail(400,'Open the class this assignment belongs to first.');
  const status=b.status;if(!['DRAFT','LOCKED','PUBLISHED','SCHEDULED'].includes(status))fail(400,'Choose draft, locked, release now or scheduled.');
  const next=prepareAssignment({...a,status,releaseAt:status==='SCHEDULED'?b.releaseAt:null,due:b.due??a.due},ctx,u.id,fail,a);
  checkLinks(next,weekOf(next.week));Object.assign(a,next);
  audit(u,'Set assignment '+a.id+' to '+status);await save();json({assignment:a,available:assignmentOpen(a,course,releaseState,scopeKey)});return true;
 }
 if(endpoint==='assignment-delete'&&method==='POST'){
  const a=mine(b.id);if(db.submissions.some(v=>v.assignment===a.id))fail(409,'Students have already submitted this assignment. Lock it instead of deleting it.');
  db.assignments=db.assignments.filter(v=>v!==a);audit(u,'Deleted assignment '+a.id);await save();json({ok:true});return true;
 }
 if(endpoint==='assignment-copy'&&method==='POST'){
  const a=mine(b.id),targets=Array.isArray(b.targets)?b.targets.slice(0,20):[];if(!targets.length)fail(400,'Choose where to copy the assignment.');
  const made=[];
  for(const target of targets){
   const cc=clean(target.class,50)||a.class,ss=clean(target.subject,100)||a.subject,tt=Number(target.term||a.term),week=Number(target.week||a.week);
   if(![1,2,3].includes(tt))fail(400,'Choose a valid term.');
   scope(u,cc,ss);const targetWeek=weekOf(week,cc,ss,tt);if(!targetWeek)fail(400,`Week ${week} has no lessons in ${cc} ${ss} yet. Create the week first.`);
   const copy={...structuredClone(a),id:randomUUID(),class:cc,subject:ss,term:tt,week,teacher:u.id,status:'LOCKED',releaseAt:null,publishedAt:null,due:'',lessons:[],scope:a.scope==='LESSON'?'GENERAL':a.scope,copiedFrom:a.id,updatedAt:new Date().toISOString(),sessionId:a.sessionId};
   // Images are shared, not re-uploaded: each copy gets its own file record for the new class.
   const ids=new Map();
   for(const block of copy.document?.blocks||[])if(block.type==='image'){
    const source=db.files.find(v=>v.id===block.fileId);if(!source)continue;
    if(!ids.has(source.id)){const id=randomUUID();db.files.push({...structuredClone(source),id,class:cc,subject:ss,term:tt,student:u.id});ids.set(source.id,id);}
    block.fileId=ids.get(source.id);
   }
   for(const q of copy.questions||[])if(q.image?.fileId){
    const source=db.files.find(v=>v.id===q.image.fileId);if(!source){delete q.image;continue;}
    if(!ids.has(source.id)){const id=randomUUID();db.files.push({...structuredClone(source),id,class:cc,subject:ss,term:tt,student:u.id});ids.set(source.id,id);}
    q.image.fileId=ids.get(source.id);
   }
   db.assignments.push(copy);made.push({id:copy.id,class:cc,subject:ss,week});
  }
  audit(u,'Copied assignment '+a.id+' to '+made.length+' place(s)');await save();json({copies:made});return true;
 }
 if(endpoint==='assignment-submit'&&method==='POST'){
  if(u.role!=='STUDENT')fail(403,'Only students submit work.');termAccess(u,c,s,t);
  const a=db.assignments.find(v=>v.id===b.assignment&&fits(v));if(!a||a.mode!=='ONLINE')fail(404,'Online assignment not found.');
  if(!assignmentOpen(a,course,releaseState,scopeKey))fail(403,'This assignment has not been released.');
  if(!b.answers||typeof b.answers!=='object'||Array.isArray(b.answers))fail(400,'Answer the questions before submitting.');
  const answers=Object.fromEntries(a.questions.map(q=>[q.id,clean(Array.isArray(b.answers[q.id])?b.answers[q.id].join('|'):b.answers[q.id],2000)]));
  const prev=db.submissions.find(v=>v.student===u.id&&v.kind==='assignment'&&v.assignment===a.id);
  if(prev&&!a.resubmission&&!['Needs redo','Returned for correction'].includes(prev.status))fail(409,'You have already submitted this assignment. Your teacher has not allowed another attempt.');
  const result=gradeAssessment(a.questions,answers),late=lateness(a),immediate=a.autoGrade==='IMMEDIATE';
  const score=Math.round((result.possibleMarks?result.marks/result.possibleMarks*a.max:0)*100)/100;
  if(prev)db.versions.push({id:randomUUID(),submission:prev.id,snapshot:structuredClone(prev),created:new Date().toISOString()});
  const sub=prev||{id:randomUUID(),student:u.id,name:u.name,...ctx,kind:'assignment'};
  Object.assign(sub,{assignment:a.id,online:true,answers,files:[],week:a.week,topic:a.title,max:a.max,late,created:new Date().toISOString(),
   results:result.results.map(r=>({question:r.question,correct:r.correct})),autoScore:score,
   status:immediate?'Marked':prev?'Resubmitted':late?'Late':'Submitted',score:immediate?score:null,feedback:immediate?'Marked automatically.':'',autoMarked:immediate,...(immediate?{markedAt:new Date().toISOString()}:{})});
  if(!prev)db.submissions.push(sub);await save();
  json({submitted:true,graded:immediate,late,...(immediate?{score,max:a.max,percentage:result.percentage,correct:result.correct,total:result.total,results:result.results.map((r,i)=>({question:r.question,correct:r.correct,...(a.showAnswers&&!a.resubmission?{answer:r.answer,explanation:r.explanation}:{})}))}:{})},201);return true;
 }
 return false;
}
