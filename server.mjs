import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {randomBytes,randomUUID,createHmac,timingSafeEqual} from 'node:crypto';
import {db,save,hash,matches,dataDir,sql} from './store.mjs';
import {weeks} from './content.mjs';
import {profileApi} from './profile-api.mjs';
import {studentApi} from './student-api.mjs';
import {monitoringApi} from './monitoring.mjs';
import {weeklyContentApi,assignmentOpen,closingOpen,prepareAssignment,studentAssignment} from './weekly-content.mjs';
import {recordStudentPresence} from './presence.mjs';
import {rememberLearningReleases} from './learning-releases.mjs';
import {adminDirectory} from './admin-directory.mjs';
import {validateFile,storeFile,streamFile} from './storage.mjs';
import {requestScope,academicSession,academicKey} from './context.mjs';
import {durableSessions} from './database.mjs';
import {lmsApi,releaseState,notify,redeemRecovery,requestRecovery} from './lms-api.mjs';
import {checkAnswer,gradeAssessment,masteryBand,calculate} from './dist/domain.js';
import {summariseResults} from './dist/results.js';
import {studentLesson,contentRevision,mergeWeekContent,validateWeekDocuments} from './lesson-document.mjs';
const port=Number(process.env.PORT||3000),host=process.env.HOST||'127.0.0.1';
const sessions=durableSessions(sql),rates=new Map(),uploadTokens=new Map(),secret=db.appSecret;
const demo=process.env.NODE_ENV!=='production'&&process.env.DEMO_MODE==='true';
const scopeKey=(c,s,t,sid=academicSession()||db.currentSessionId)=>academicKey(c,s,t,sid);
const classFor=(u,sid=academicSession()||db.currentSessionId)=>db.enrolments.find(e=>e.student===u.id&&e.sessionId===sid)?.class;
const currentTerm=()=>db.sessions.find(s=>s.id===(academicSession()||db.currentSessionId))?.currentTerm||1;
const belongs=v=>v.sessionId===(academicSession()||db.currentSessionId);

const publicDir=path.resolve('public');fs.mkdirSync(path.join(dataDir,'uploads'),{recursive:true});
const safeUser=u=>{const {password,guardian,...rest}=u;return rest;};
const fail=(s,m)=>{throw Object.assign(new Error(m),{status:s});};
const signed=value=>createHmac('sha256',secret).update(value).digest('hex');
function scoped(u,c,s,sid=academicSession()||db.currentSessionId){return u.role==='ADMIN'||(u.role==='STUDENT'?classFor(u,sid)===c:db.allocations.some(a=>a.teacher===u.id&&a.class===c&&a.subject===s&&a.sessionId===sid));}
function course(c,s,t){return (db.courses?.[scopeKey(c,s,t)]||[]).map(w=>({...w,lessons:[...w.lessons].sort((a,b)=>(a.order||a.day||0)-(b.order||b.day||0))}));}
function scope(u,c,s){if(!scoped(u,c,s))fail(403,'This class or subject is not assigned to you.');}
function termAccess(u,c,s,t){scope(u,c,s);if(u.role==='STUDENT'&&(t>currentTerm()||db.termLocks.includes(scopeKey(c,s,t))))fail(403,'This term is not open.');}
function lessonAccess(u,c,s,t,id){termAccess(u,c,s,t);const w=Number(String(id).split('-')[0]);if(u.role==='STUDENT'&&!releaseState(c,s,t,id,scopeKey).available)fail(403,releaseState(c,s,t,id,scopeKey).reason);const week=course(c,s,t).find(v=>v.id===w);if(!week)fail(404,'Lessons have not been added for this week.');return week;}
const visibleFile=(u,f)=>{if(!scoped(u,f.class,f.subject,f.sessionId))return false;const term=db.sessions.find(s=>s.id===f.sessionId)?.currentTerm||1;if(u.role==='STUDENT'&&(f.term>term||db.termLocks.includes(scopeKey(f.class,f.subject,f.term,f.sessionId))))return false;if(u.role!=='STUDENT'||f.student===u.id)return true;if(f.purpose==='question'){const thread=db.questions.find(q=>q.sessionId===f.sessionId&&q.files?.includes(f.id));return !!thread&&!thread.hidden&&releaseState(f.class,f.subject,f.term,thread.lesson,scopeKey).available;}return f.purpose==='lesson-note';};
function checkFiles(u,ids,c,s,t,purpose){if(!Array.isArray(ids)||ids.length>10)fail(400,'Choose up to 10 images.');for(const id of ids){const f=db.files.find(f=>f.id===id);if(!f||f.student!==u.id||f.class!==c||f.subject!==s||f.term!==t||f.purpose!==purpose)fail(403,'Invalid attachment.');}}
function audit(u,action){db.audit.push({id:randomUUID(),user:u.id,action,at:new Date().toISOString()});}
async function body(req,max=6*1024*1024){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>max)fail(413,'File or request is too large.');chunks.push(chunk);}return Buffer.concat(chunks);}
const text=(v,max=5000)=>String(v??'').trim().slice(0,max);
function needed(v,label){if(!v)fail(400,`${label} is required.`);return v;}
function urlValue(v){try{const u=new URL(v);if(u.protocol!=='https:')throw Error();return u.href;}catch{fail(400,'Enter a full https:// link.');}}
const rate=(key,limit)=>{const now=Date.now();const r=rates.get(key)||{n:0,until:now+60000};if(now>r.until){r.n=0;r.until=now+60000;}r.n++;rates.set(key,r);if(r.n>limit)fail(429,'Too many attempts. Please wait a minute.');};
async function handle(req,res){
 const url=new URL(req.url,'http://localhost');let session;
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');
 res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; media-src 'self' blob: https:; frame-src https://www.youtube-nocookie.com https://player.vimeo.com; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
 function json(value,status=200){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));}
 try{
 if(!url.pathname.startsWith('/api/')){
  if(!['GET','HEAD'].includes(req.method))fail(405,'Method not allowed.');
  const file=path.resolve(publicDir,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(publicDir+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory())fail(404,'Page not found.');
  const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});if(req.method==='HEAD')res.end();else fs.createReadStream(file).pipe(res);return;
 }
 res.setHeader('Cache-Control','no-store');
 if(!['GET','HEAD'].includes(req.method)&&req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`&&req.headers.origin!==`https://${req.headers.host}`)fail(403,'Request origin not allowed.');
 const sid=(req.headers.cookie||'').match(/(?:^|; )lab_session=([^;]+)/)?.[1];session=await sessions.get(sid);
 if(session&&session.expires<Date.now()){await sessions.delete(sid);session=null;}
 let u=session&&db.users.find(v=>v.id===session.user&&v.status==='ACTIVE');
 const endpoint=url.pathname.slice(5);const method=req.method;
 let b={};if(['POST','PATCH','DELETE'].includes(method)){if(!String(req.headers['content-type']||'').startsWith('application/json'))fail(415,'Expected JSON.');try{b=JSON.parse((await body(req)).toString()||'{}');}catch(e){if(e.status)throw e;fail(400,'Invalid JSON.');}}
 if(endpoint==='config'&&method==='GET'){json({demo,school:db.school,selfRegistration:demo||process.env.SELF_REGISTRATION==='true'});return;}
 if((endpoint==='login'||endpoint==='demo-login')&&method==='POST'){
  rate('login:'+req.socket.remoteAddress,15);const user=endpoint==='demo-login'&&demo?db.users.find(v=>v.id===text(b.role).toLowerCase()):db.users.find(v=>v.email.toLowerCase()===text(b.email).toLowerCase());if(endpoint==='demo-login'&&!demo)fail(404,'Not found.');if(!user||(endpoint!=='demo-login'&&!matches(String(b.password||''),user.password)))fail(401,'Email or password is incorrect.');if(user.status!=='ACTIVE')fail(403,user.status==='PENDING'?'Your account is awaiting admin approval.':`Your account is ${user.status.toLowerCase()}. Contact the school administrator.`);
  if(sid)await sessions.delete(sid);const id=randomBytes(32).toString('hex'),csrf=randomBytes(24).toString('hex');await sessions.set(id,{user:user.id,csrf,expires:Date.now()+8*3600000});res.setHeader('Set-Cookie',`lab_session=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${process.env.COOKIE_SECURE==='true'?'; Secure':''}`);await recordStudentPresence(user);json({user:safeUser(user),csrf});return;
 }
 if(endpoint==='register'&&method==='POST'){
  if(!demo&&process.env.SELF_REGISTRATION!=='true')fail(403,'Ask your administrator for an invitation.');
  rate('register:'+req.socket.remoteAddress,8);const email=text(b.email,160).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail(400,'Enter a valid email.');if(db.users.some(v=>v.email===email))fail(409,'This email is already registered.');if(!db.classes.includes(b.class))fail(400,'Choose a valid class.');if(String(b.password||'').length<10)fail(400,'Use at least 10 characters for your password.');
  const admission=needed(text(b.admission,80),'Admission number');if(db.users.some(v=>v.admission===admission))fail(409,'This admission number is already registered.');db.users.push({id:randomUUID(),name:needed(text(b.name,100),'Name'),email,password:hash(b.password),class:b.class,admission,guardian:needed(text(b.guardian,40),'Guardian phone'),role:'STUDENT',status:'PENDING',photoRequired:true});await save();json({message:'Registration received. Your account is awaiting admin approval.'},201);return;
 }
 if(endpoint==='request-recovery'&&method==='POST'){rate('request-recovery:'+req.socket.remoteAddress,6);json(await requestRecovery(b));return;}
 if(endpoint==='recover-account'&&method==='POST'){rate('recover:'+req.socket.remoteAddress,8);json(await redeemRecovery(b,fail));return;}
 if(!u)fail(401,'Please sign in to continue.');
 if(endpoint.startsWith('media/')&&method==='GET'){
  // Lesson images are served only to people who may read the lesson that uses them; cookies authenticate the request, so no short-lived link is needed.
  const id=decodeURIComponent(endpoint.slice(6)),f=db.files.find(v=>v.id===id&&v.purpose==='lesson-image');if(!f)fail(404,'Image not found.');
  requestScope.getStore().sessionId=f.sessionId;if(!scoped(u,f.class,f.subject,f.sessionId))fail(404,'Image not found.');
  if(u.role==='STUDENT'){const inAssignment=db.assignments.some(a=>a.class===f.class&&a.subject===f.subject&&a.sessionId===f.sessionId&&a.term<=currentTerm()&&JSON.stringify(a.document?.blocks||[]).includes(id)&&!db.termLocks.includes(scopeKey(a.class,a.subject,a.term))&&assignmentOpen(a,course,releaseState,scopeKey));const used=inAssignment||[1,2,3].some(t=>t<=currentTerm()&&!db.termLocks.includes(scopeKey(f.class,f.subject,t))&&course(f.class,f.subject,t).some(w=>w.lessons.some(l=>releaseState(f.class,f.subject,t,l.id,scopeKey).available&&JSON.stringify(l.document?.blocks||[]).includes(id))));if(!used)fail(404,'Image not found.');}
  await streamFile(dataDir,f,req,res,'private, max-age=3600');return;
 }
 const chosen=text(b.sessionId||url.searchParams.get('sessionId')||db.currentSessionId);if(!db.sessions.some(s=>s.id===chosen))fail(400,'Unknown academic session.');requestScope.getStore().sessionId=chosen;
 if(u.role==='STUDENT'){const enrolled=classFor(u);if(!enrolled)fail(403,'You are not enrolled in this academic session.');u={...u,class:enrolled};}

 if(!['GET','HEAD'].includes(method)&&req.headers['x-csrf-token']!==session.csrf)fail(403,'Session check failed. Refresh and try again.');
 if(u.mustChangePassword&&!['me','logout','change-password','config'].includes(endpoint))fail(403,'Choose a new password before continuing.');
 if(endpoint==='change-password'&&method==='POST'){
  rate('change-password:'+u.id,8);const next=String(b.newPassword||'');
  if(!matches(String(b.currentPassword||''),u.password))fail(400,'Your current password is not correct.');
  if(next.length<12)fail(400,'Use a new password of at least 12 characters.');
  if(next===String(b.currentPassword))fail(400,'Choose a password different from the temporary one.');
  if(next.toLowerCase().includes(u.email.split('@')[0].toLowerCase())&&u.email.split('@')[0].length>=4)fail(400,'Do not include your email name in the password.');
  const account=db.users.find(v=>v.id===u.id);account.password=hash(next);delete account.mustChangePassword;audit(u,'Changed account password');await save();
  await sessions.revoke(u.id);const id=randomBytes(32).toString('hex'),csrf=randomBytes(24).toString('hex');await sessions.set(id,{user:u.id,csrf,expires:Date.now()+8*3600000});
  res.setHeader('Set-Cookie',`lab_session=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${process.env.COOKIE_SECURE==='true'?'; Secure':''}`);
  try{fs.unlinkSync(path.join(dataDir,'FIRST-LOGIN.txt'));}catch{}
  json({user:safeUser(account),csrf});return;
 }
 if(endpoint==='logout'&&method==='POST'){await sessions.delete(sid);res.setHeader('Set-Cookie','lab_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');json({ok:true});return;}
 if(endpoint==='presence'&&method==='POST'){if(u.role!=='STUDENT')fail(403,'Student activity only.');rate('presence:'+u.id,6);json({lastSeen:await recordStudentPresence(u)});return;}
 if(endpoint==='me'){json({user:safeUser(u),csrf:session.csrf,currentTerm:currentTerm(),currentSessionId:db.currentSessionId,sessionId:academicSession(),sessions:db.sessions.filter(v=>u.role!=='STUDENT'||db.enrolments.some(e=>e.student===u.id&&e.sessionId===v.id)),policy:db.policy,allocations:db.allocations.filter(a=>a.teacher===u.id&&belongs(a))});return;}
 if(await profileApi({endpoint,method,url,req,res,u,body,json,fail,audit,rate}))return;
 const c=u.role==='STUDENT'?u.class:text(b.class||url.searchParams.get('class')||'SS1');const s=text(b.subject||url.searchParams.get('subject')||'Mathematics');const t=Number(b.term||url.searchParams.get('term')||1);
 if(![1,2,3].includes(t))fail(400,'Choose a valid term.');
 if(adminDirectory({endpoint,method,url,u,json,fail}))return;
 if(await studentApi({endpoint,method,b,url,u,c,json,fail,audit,sessions}))return;
 if(await weeklyContentApi({endpoint,method,url,b,u,c,s,t,scope,termAccess,lessonAccess,course,releaseState,scopeKey,audit,json,fail}))return;
 if(await monitoringApi({endpoint,method,url,b,u,c,s,t,scope,course,releaseState,scopeKey,lessonAccess,termAccess,audit,json,fail}))return;
 if(await lmsApi({endpoint,method,b,u,c,s,t,json,fail,scope,termAccess,lessonAccess,course,scopeKey,sessions,audit}))return;
 if(endpoint==='state'&&method==='GET'){
  scope(u,c,s);const locked=u.role==='STUDENT'&&(t>currentTerm()||db.termLocks.includes(scopeKey(c,s,t)));
  const fits=v=>v.class===c&&v.subject===s&&v.term===t&&belongs(v);
  const mine=v=>u.role!=='STUDENT'||v.student===u.id;
  json({user:safeUser(u),currentTerm:currentTerm(),sessionId:academicSession(),currentSessionId:db.currentSessionId,sessions:db.sessions.filter(v=>u.role!=='STUDENT'||db.enrolments.some(e=>e.student===u.id&&e.sessionId===v.id)),policy:db.policy,recoveryRequests:u.role==='ADMIN'?(db.recoveryRequests||[]).filter(r=>r.status==='PENDING'):[],resultSummary:u.role==='STUDENT'?summariseResults(db.scores.filter(v=>fits(v)&&v.student===u.id),db.submissions.filter(v=>fits(v)&&v.student===u.id&&v.kind==='note'),db.policy):null,school:db.school,classes:db.classes,subjects:db.subjects,allocations:db.allocations.filter(a=>belongs(a)&&(u.role==='ADMIN'||a.teacher===u.id)),termLocked:locked,
   weeks:locked?[]:(course(c,s,t).map(({lessons,quiz,...w})=>({id:w.id,title:w.title,subtitle:w.subtitle,reflectionPrompt:w.reflectionPrompt||'',closingAvailable:closingOpen({lessons},c,s,t,releaseState,scopeKey),quizCount:quiz.length,unlocked:(db.unlocks[scopeKey(c,s,t)]||[]).includes(w.id),lessons:lessons.filter(l=>u.role!=='STUDENT'||releaseState(c,s,t,l.id,scopeKey).status!=='DRAFT').map(({id,title,minutes,day})=>({title,minutes,day,...releaseState(c,s,t,id,scopeKey),id}))}))),
   assignments:locked?[]:db.assignments.filter(v=>fits(v)&&(u.role!=='STUDENT'||v.status!=='DRAFT')).map(a=>u.role==='STUDENT'&&!assignmentOpen(a,course,releaseState,scopeKey)?{id:a.id,week:a.week,title:a.title,subject:a.subject,due:a.due,workDate:a.workDate,status:a.status||'PUBLISHED',available:false,releaseAt:a.releaseAt}:(u.role==='STUDENT'?{...studentAssignment(a),available:true}:{...a,available:assignmentOpen(a,course,releaseState,scopeKey)})),submissions:locked?[]:db.submissions.filter(v=>fits(v)&&mine(v)),progress:locked?[]:db.progress.filter(v=>fits(v)&&mine(v)),reflections:locked?[]:db.reflections.filter(v=>fits(v)&&mine(v)&&(u.role==='STUDENT'||!v.draft)),scores:locked?[]:db.scores.filter(v=>fits(v)&&mine(v)&&(u.role!=='STUDENT'||v.published!==false)),
   questions:locked?[]:db.questions.filter(v=>fits(v)&&(u.role!=='STUDENT'||!v.hidden&&releaseState(c,s,t,v.lesson,scopeKey).available)).map(q=>u.role==='STUDENT'?((({reports,...v})=>v)(q)):q),resources:locked?[]:db.resources.filter(fits),announcements:locked?[]:db.announcements.filter(fits),notifications:db.notifications.filter(n=>n.recipient===u.id).slice(-30).reverse(),assessments:locked?[]:db.assessmentAttempts.filter(v=>fits(v)&&mine(v)).map(({questions,answers,...v})=>v),practiceAttempts:locked?[]:db.practiceAttempts.filter(v=>fits(v)&&mine(v)),
   students:u.role==='ADMIN'?db.users.filter(v=>v.role==='STUDENT').map(safeUser):u.role==='TEACHER'?db.users.filter(v=>v.role==='STUDENT'&&classFor(v)===c).map(safeUser):[],teachers:u.role==='ADMIN'?db.users.filter(v=>v.role==='TEACHER').map(safeUser):[],termLocks:db.termLocks.filter(k=>u.role==='ADMIN'||k.startsWith(academicSession()+'|'+c+':'+s+':')),audit:u.role==='ADMIN'?db.audit.slice(-30).reverse():[]});return;
 }
 if(endpoint.startsWith('lesson/')&&method==='GET'){const id=endpoint.split('/')[1],week=lessonAccess(u,c,s,t,id),lesson=week.lessons.find(v=>v.id===id);if(!lesson)fail(404,'Lesson not found.');if(u.role==='STUDENT'&&!db.progress.some(p=>belongs(p)&&p.student===u.id&&p.lesson===id&&p.class===c&&p.subject===s&&p.term===t)){db.progress.push({id:randomUUID(),sessionId:academicSession(),student:u.id,lesson:id,class:c,subject:s,term:t,answers:{},accuracy:0,practiceScore:0,reflectionDone:false,started:new Date().toISOString()});await save();}json({...studentLesson(lesson),quiz:[],questionCounts:{total:lesson.questions.length,quiz:lesson.questions.filter(q=>q.stage==='quiz').length,mastery:week.quiz.length}});return;}
 if(endpoint==='practice'&&method==='POST'){
  const week=lessonAccess(u,c,s,t,b.lesson),lesson=week.lessons.find(v=>v.id===b.lesson);if(!lesson)fail(404,'Lesson not found.');const q=lesson.questions.find(v=>v.id===b.question);if(!q)fail(404,'Question not found.');if(q.stage==='quiz')fail(403,'Quiz answers are available only after submitting an assessment.');
  const correct=checkAnswer(q,b.answer);db.practiceAttempts.push({id:randomUUID(),sessionId:academicSession(),class:c,subject:s,term:t,student:u.id,lesson:b.lesson,question:q.id,response:text(b.answer,200),correct,at:new Date().toISOString(),activeSeconds:Math.max(0,Math.min(300,Number(b.activeSeconds)||0))});
  let p=db.progress.find(v=>v.student===u.id&&belongs(v)&&v.lesson===b.lesson&&v.term===t&&v.class===c&&v.subject===s);if(!p){p={student:u.id,lesson:b.lesson,class:c,subject:s,term:t,answers:{},reflectionDone:false};db.progress.push(p);}p.answers[q.id]=correct;p.updated=new Date().toISOString();const practice=lesson.questions.filter(q=>q.stage!=='quiz'),answers=practice.map(q=>p.answers[q.id]),attempted=answers.filter(a=>a!==undefined);p.accuracy=attempted.length?Math.round(attempted.filter(Boolean).length/attempted.length*100):0;p.practiceScore=Math.round(answers.filter(Boolean).length/practice.length*100);p.complete=p.practiceScore>=db.policy.completion&&!!(p.contentConsumedAt||p.reflectionDone);await save();json({correct,answer:q.answer,explanation:q.explanation,progress:p});return;
 }
 if(endpoint==='reflection'&&method==='POST'){
  const week=lessonAccess(u,c,s,t,b.lesson);if(!week.lessons.some(v=>v.id===b.lesson))fail(404,'Lesson not found.');const learnt=needed(text(b.learnt),'What you learnt'),question=needed(text(b.question),'Your unanswered question (or write “None for now”)');let r=db.reflections.find(v=>v.student===u.id&&belongs(v)&&v.lesson===b.lesson&&v.term===t&&v.subject===s);if(!r){r={id:randomUUID(),student:u.id,name:u.name,class:c,subject:s,term:t,lesson:b.lesson};db.reflections.push(r);}Object.assign(r,{learnt,question,concept:text(b.concept),difficult:text(b.difficult),confidence:Math.min(5,Math.max(1,Number(b.confidence)||3)),draft:!!b.draft,created:new Date().toISOString()});let p=db.progress.find(v=>v.student===u.id&&belongs(v)&&v.lesson===b.lesson&&v.term===t&&v.subject===s);if(!p){p={student:u.id,lesson:b.lesson,class:c,subject:s,term:t,answers:{},accuracy:0};db.progress.push(p);}p.reflectionDone=!b.draft;p.complete=(p.practiceScore??p.accuracy)>=db.policy.completion;await save();json(r);return;
 }
 if(endpoint==='question'&&method==='POST'){lessonAccess(u,c,s,t,b.lesson);const files=b.files||[];checkFiles(u,files,c,s,t,'question');if(!text(b.text)&&!files.length)fail(400,'Write a question or attach an image.');const q={id:randomUUID(),student:u.id,name:u.name,class:c,subject:s,term:t,lesson:b.lesson,text:text(b.text),files,replies:[],created:new Date().toISOString()};db.questions.push(q);await save();json(q);return;}
 if(endpoint==='reply'&&method==='POST'){const q=db.questions.find(v=>v.id===b.id);if(!q)fail(404,'Question not found.');lessonAccess(u,q.class,q.subject,q.term,q.lesson);if(q.resolved&&u.role==='STUDENT')fail(409,'This discussion is resolved. Ask your teacher to reopen it.');q.replies.push({id:randomUUID(),author:u.id,name:u.name,role:u.role,text:needed(text(b.text),'Reply')});if(q.student!==u.id)notify(q.student,'A reply to your question',u.name+' replied to your lesson question.','questions');await save();json(q);return;}
 if(endpoint==='submit'&&method==='POST'){
  if(u.role!=='STUDENT')fail(403,'Only students submit work.');termAccess(u,c,s,t);const kind=b.kind==='note'?'note':'assignment';const files=b.files||[];needed(files.length,'A photo');checkFiles(u,files,c,s,t,kind);let assignment;
  if(kind==='assignment'){assignment=db.assignments.find(v=>v.id===b.assignment&&belongs(v)&&v.class===c&&v.subject===s&&v.term===t);if(!assignment)fail(404,'Assignment not found.');if(!assignmentOpen(assignment,course,releaseState,scopeKey))fail(403,'This assignment has not been released.');if(assignment.mode==='ONLINE')fail(400,'Answer this assignment on the platform instead of uploading a photo.');}
  if(kind==='note'){const week=course(c,s,t).find(w=>w.id===Number(b.week));if(!week||!week.lessons.some(l=>releaseState(c,s,t,l.id,scopeKey).available))fail(400,'Choose an open learning week for your notes.');}
  if(kind==='note'&&!/^\d{4}-\d{2}-\d{2}$/.test(b.date||''))fail(400,'Choose a note date.');
  const prev=db.submissions.find(v=>v.student===u.id&&belongs(v)&&v.class===c&&v.subject===s&&v.term===t&&v.kind===kind&&(kind==='assignment'?v.assignment===b.assignment:v.date===b.date&&v.frequency===(b.frequency==='Weekly'?'Weekly':'Daily')&&(Number(v.week)===Number(b.week)||!v.week)));
  if(prev&&kind==='assignment'&&!assignment.resubmission&&!['Needs redo','Returned for correction'].includes(prev.status))fail(409,'Your teacher has not enabled resubmission.');
  if(prev&&kind==='note'&&!['Needs redo','Returned for correction'].includes(prev.status))fail(409,'These notes have already been submitted.');
  if(prev)db.versions.push({id:randomUUID(),submission:prev.id,snapshot:structuredClone(prev),created:new Date().toISOString()});const sub=prev||{id:randomUUID(),student:u.id,name:u.name,class:c,subject:s,term:t,kind};Object.assign(sub,{assignment:assignment?.id,date:text(b.date),frequency:b.frequency==='Weekly'?'Weekly':'Daily',files,status:prev?'Resubmitted':assignment&&Date.now()>Date.parse(assignment.due.length===10?assignment.due+'T23:59:59+01:00':assignment.due)?'Late':'Submitted',max:kind==='note'?db.policy.noteMaximum:assignment?.max||100,week:Number(b.week)||null,topic:text(b.topic),created:new Date().toISOString(),score:null,feedback:''});if(!prev)db.submissions.push(sub);await save();json(sub,201);return;
 }
 if(endpoint==='upload-token'&&method==='POST'){
  rate('upload:'+u.id,30);termAccess(u,c,s,t);const purpose=b.purpose;if(!['assignment','note','question','lesson-note','lesson-image','recording'].includes(purpose))fail(400,'Invalid upload purpose.');if(['lesson-note','lesson-image','recording'].includes(purpose)&&u.role==='STUDENT')fail(403,'Only teachers upload lesson notes.');const token=randomBytes(32).toString('hex');uploadTokens.set(token,{user:u.id,class:c,subject:s,term:t,purpose,expires:Date.now()+300000});json({url:`/api/upload/${token}`});return;
 }
 if(endpoint.startsWith('upload/')&&method==='PUT'){
  const token=endpoint.split('/')[1],v=uploadTokens.get(token);if(!v||v.user!==u.id||v.expires<Date.now())fail(403,'Upload link expired. Try again.');termAccess(u,v.class,v.subject,v.term);const bytes=await body(req,v.purpose==='recording'?120*1024*1024:v.purpose==='lesson-image'?5*1024*1024:['assignment','lesson-note'].includes(v.purpose)?20*1024*1024:700*1024);const cleaned=validateFile(bytes,v.purpose);const id=randomUUID();const storage=await storeFile(dataDir,id,cleaned.bytes,cleaned.type);db.files.push({id,student:u.id,class:v.class,subject:v.subject,term:v.term,purpose:v.purpose,sessionId:academicSession(),storage,type:cleaned.type,size:cleaned.bytes.length});uploadTokens.delete(token);await save();json({id});return;
 }
 if(endpoint.startsWith('file/')&&method==='GET'){
  const id=endpoint.split('/')[1],f=db.files.find(v=>v.id===id);if(!f||!visibleFile(u,f))fail(404,'File not found.');const exp=url.searchParams.get('expires'),sig=url.searchParams.get('sig');if(!sig){const expires=Date.now()+120000;json({url:`/api/file/${id}?expires=${expires}&sessionId=${encodeURIComponent(f.sessionId)}&sig=${signed(`${id}:${u.id}:${expires}`)}`});return;}const expected=signed(`${id}:${u.id}:${exp}`);if(Number(exp)<Date.now()||sig.length!==expected.length||!timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))fail(403,'Image link expired.');await streamFile(dataDir,f,req,res);return;
 }
 // Every management mutation is checked here before any record is changed.
 if(u.role==='STUDENT')fail(403,'Teacher or administrator access required.');
 scope(u,c,s);
 if(endpoint==='course'&&method==='GET'){const weeks=course(c,s,t);res.setHeader('X-Content-Revision',contentRevision(weeks));json(weeks);return;}
 if(endpoint==='course'&&method==='POST'){
  const input=b.weeks;if(!Array.isArray(input)||input.length>20)fail(400,'Provide an array of up to 20 weeks.');
  const ids=new Set();
  const validQuestion=q=>q&&typeof q.id==='string'&&typeof q.prompt==='string'&&['string','number'].includes(typeof q.answer)&&typeof q.explanation==='string'&&['numeric','choice','boolean','short','fill','matching','steps','graph','expression'].includes(q.kind)&&(q.kind!=='choice'||Array.isArray(q.options)&&q.options.map(String).includes(String(q.answer)));
  for(const w of input){
   validateWeekDocuments(w);
   if(!Number.isInteger(w.id)||w.id<1||w.id>52||ids.has(w.id)||typeof w.title!=='string'||w.lessons.length<1||w.lessons.length>7||!Array.isArray(w.quiz)||w.quiz.length<10||!w.quiz.every(validQuestion))fail(400,'Each week needs a unique number, a title, 1–7 lessons and at least 10 valid quiz questions.');
   ids.add(w.id);const lessonIds=new Set();
   for(const l of w.lessons){
    const contentValid=l.document?l.document.blocks.length>0:Array.isArray(l.objectives)&&l.explain&&l.realLife&&Array.isArray(l.summary)&&validQuestion(l.example);
    if(typeof l.id!=='string'||!l.id.startsWith(w.id+'-')||lessonIds.has(l.id)||!l.title||!contentValid||!Array.isArray(l.questions)||l.questions.length<12||!l.questions.every(validQuestion))fail(400,'Each lesson needs its week-prefixed ID, title, valid teaching content and at least 12 valid questions.');
    lessonIds.add(l.id);const questionIds=l.questions.map(q=>q.id);if(new Set(questionIds).size!==questionIds.length)fail(400,'Question IDs must be unique within a lesson.');
   }
   if(new Set(w.quiz.map(q=>q.id)).size!==w.quiz.length)fail(400,'Weekly quiz question IDs must be unique.');
  }
  const previous=course(c,s,t);
  if(b.revision!==contentRevision(previous))fail(409,'This course was changed or its revision is missing. Reopen the course before publishing.');
  const prepared=input.map(w=>{validateWeekDocuments(w);const merged=mergeWeekContent(w,previous.find(old=>old.id===w.id));validateWeekDocuments(merged);return {...merged,updatedAt:new Date().toISOString(),publicationId:randomUUID()};});
  db.weekVersions??=[];for(const old of previous)db.weekVersions.push({id:randomUUID(),sessionId:academicSession(),class:c,subject:s,term:t,week:old.id,content:structuredClone(old),teacher:u.id,created:new Date().toISOString()});
  db.courses??={};db.courses[scopeKey(c,s,t)]=prepared;audit(u,`Published ${input.length} content weeks for ${c}:${s}:${t}`);await save();json({ok:true,revision:contentRevision(course(c,s,t))});return;
 }
 if(endpoint==='unlock'&&method==='POST'){await rememberLearningReleases(c,s,t,course,scopeKey,releaseState);if(!course(c,s,t).some(w=>w.id===Number(b.week)))fail(400,'Invalid week.');const key=scopeKey(c,s,t),set=new Set(db.unlocks[key]||[]);if(b.unlocked)set.add(Number(b.week));else set.delete(Number(b.week));db.unlocks[key]=[...set];audit(u,`${b.unlocked?'Unlock':'Lock'} week ${b.week}, ${key}`);await save();await rememberLearningReleases(c,s,t,course,scopeKey,releaseState);json({ok:true});return;}
 if(endpoint==='term-lock'&&method==='POST'){if(u.role!=='ADMIN')fail(403,'Admin access required.');const key=scopeKey(c,s,t);db.termLocks=db.termLocks.filter(v=>v!==key);if(b.locked)db.termLocks.push(key);audit(u,`${b.locked?'Lock':'Open'} term ${key}`);await save();json({ok:true});return;}
 if(endpoint==='assignment'&&method==='POST'){if(b.week&&(!Number.isInteger(Number(b.week))||!course(c,s,t).some(w=>w.id===Number(b.week))))fail(400,'Choose a valid assignment week.');const a=prepareAssignment(b,{sessionId:academicSession(),class:c,subject:s,term:t},u.id,fail);db.assignments.push(a);await save();json(a);return;}
 if(endpoint==='resubmission'&&method==='POST'){const a=db.assignments.find(v=>v.id===b.id);if(!a)fail(404,'Assignment not found.');scope(u,a.class,a.subject);a.resubmission=!!b.enabled;await save();json({ok:true});return;}
 if(endpoint==='mark'&&method==='POST'){const sub=db.submissions.find(v=>v.id===b.id);if(!sub)fail(404,'Submission not found.');scope(u,sub.class,sub.subject);const score=Number(b.score);const maximum=sub.max||(sub.kind==='note'?db.policy.noteMaximum:100);if(!Number.isFinite(score)||score<0||score>maximum)fail(400,'Enter a score from 0 to '+maximum+'.');db.markingHistory.push({id:randomUUID(),submission:sub.id,teacher:u.id,before:structuredClone(sub),created:new Date().toISOString()});const rubric={};for(const [name,value]of Object.entries(b.rubric||{})){if(!['Completeness','Accuracy','Organisation','Legibility','Timeliness'].includes(name)||!Number.isFinite(Number(value))||Number(value)<0||Number(value)>5)fail(400,'Rubric criteria must be between 0 and 5.');rubric[name]=Number(value);}Object.assign(sub,{score,max:maximum,rubric,feedback:needed(text(b.feedback),'Feedback'),status:['Needs redo','Returned for correction'].includes(b.status)?'Returned for correction':'Marked',markedAt:new Date().toISOString()});notify(sub.student,'Your work has been reviewed',sub.feedback,sub.kind==='note'?'notes':'assignments');audit(u,'Marked submission '+sub.id);await save();json(sub);return;}
 if(endpoint==='score'&&method==='POST'){const student=db.users.find(v=>v.id===b.student&&v.role==='STUDENT'&&v.class===c);if(!student)fail(400,'Choose a student in this class.');const score=Number(b.score),max=Number(b.max);if(!Number.isFinite(score)||!Number.isFinite(max)||max<=0||score<0||score>max)fail(400,'Check the score and maximum.');db.scores.push({id:randomUUID(),student:student.id,class:c,subject:s,term:t,type:b.type==='Exam'?'Exam':'Test',score,max,remark:text(b.remark),published:!!b.published,title:text(b.title)||'Class assessment',date:text(b.date)||new Date().toISOString().slice(0,10),teacher:u.id});audit(u,'Created draft '+b.type+' result');await save();json({ok:true});return;}
 if(endpoint==='resource'&&method==='POST'){const type=['live','recording','lesson-note'].includes(b.type)?b.type:'recording';const files=b.files||[];if(files.length)checkFiles(u,files,c,s,t,type==='recording'?'recording':'lesson-note');if(!files.length&&!b.url&&!text(b.text))fail(400,'Add a link, note text or image.');if(b.day&&!Number.isFinite(Date.parse(b.day)))fail(400,'Choose a valid date and time.');const r={id:randomUUID(),class:c,subject:s,term:t,type,title:needed(text(b.title,200),'Title'),url:b.url?urlValue(b.url):'',text:text(b.text,15000),files,duration:Number(b.duration)||60,instructions:text(b.instructions),topic:text(b.topic),description:text(b.description),day:b.day?new Date(b.day).toISOString():'',teacher:u.name,created:new Date().toISOString()};db.resources.push(r);await save();json(r);return;}
 if(endpoint==='reflection-reply'&&method==='POST'){const r=db.reflections.find(v=>v.id===b.id);if(!r)fail(404,'Reflection not found.');scope(u,r.class,r.subject);r.reply=needed(text(b.text),'Feedback');await save();json(r);return;}
 if(u.role!=='ADMIN')fail(403,'Admin access required.');
 if(endpoint==='current-term'&&method==='POST'){if(![1,2,3].includes(Number(b.currentTerm)))fail(400,'Invalid term.');db.currentTerm=Number(b.currentTerm);db.sessions.find(v=>v.id===academicSession()).currentTerm=db.currentTerm;audit(u,`Current term set to ${db.currentTerm}`);await save();json({ok:true});return;}
 if(endpoint==='allocation'&&method==='POST'){if(!db.users.some(v=>v.id===b.teacher&&v.role==='TEACHER'))fail(400,'Choose a teacher.');if(!db.classes.includes(c)||!db.subjects.includes(s))fail(400,'Invalid class or subject.');db.allocations=db.allocations.filter(v=>!(belongs(v)&&v.teacher===b.teacher&&v.class===c&&v.subject===s));if(!b.remove)db.allocations.push({id:randomUUID(),teacher:b.teacher,class:c,subject:s,sessionId:academicSession()});audit(u,`${b.remove?'Removed':'Assigned'} teacher ${b.teacher}: ${c} ${s}`);await save();json({ok:true});return;}
 if(endpoint==='catalog'&&method==='POST'){const list=b.kind==='class'?db.classes:db.subjects;const name=needed(text(b.name,80),'Name');if(!list.includes(name))list.push(name);audit(u,`Added ${b.kind}: ${name}`);await save();json({ok:true});return;}
 fail(404,'Endpoint not found.');
 }catch(e){if(!res.headersSent)json({error:e.status?e.message:'An unexpected error occurred. Please try again.'},e.status||500);else res.end();if(!e.status)console.error(e);}
}
let requestTail=Promise.resolve();
const server=http.createServer((req,res)=>{requestTail=requestTail.then(()=>requestScope.run({sessionId:db.currentSessionId},()=>handle(req,res))).catch(e=>{console.error('Request failed:',e.message);if(!res.headersSent)res.writeHead(500);res.end();});});
server.on('error',e=>{if(e.code==='EADDRINUSE'){console.error(`Port ${port} is already in use (another copy of this app or another program).\nChoose another port: set PORT=3001 in your .env or .env.production file, or stop the program using port ${port}.`);process.exit(1);}throw e;});
server.listen(port,host,()=>console.log(`Olawale's Lab is ready at http://${host}:${server.address().port}`));
