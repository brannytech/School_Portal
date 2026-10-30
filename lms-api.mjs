import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {db,save,hash} from './store.mjs';
import {academicSession} from './context.mjs';
import {rememberLearningReleases} from './learning-releases.mjs';
import {gradeAssessment,masteryBand,calculate,defaultPolicy,checkAnswer} from './dist/domain.js';

const stamp=()=>new Date().toISOString();
const clean=v=>String(v??'').trim().slice(0,5000);
const tokenHash=t=>createHash('sha256').update(t).digest('hex');
export const notify=(recipient,title,message,link='home')=>db.notifications.push({id:randomUUID(),recipient,title,message,link,read:false,created:stamp()});
export function releaseState(c,s,t,id,scopeKey){const release=db.releases.find(r=>r.sessionId===academicSession()&&r.class===c&&r.subject===s&&r.term===t&&r.lesson===id);if(release){const available=release.status==='UNLOCKED'||release.status==='SCHEDULED'&&Date.parse(release.releaseAt)<=Date.now();return {...release,available,reason:available?'Open':release.status==='SCHEDULED'?`Available ${release.releaseAt}`:release.status==='DRAFT'?'Your teacher is preparing this lesson.':release.status==='ARCHIVED'?'This lesson is archived.':'Your teacher has locked this lesson.'};}return {status:'PUBLISHED',available:(db.unlocks[scopeKey(c,s,t)]||[]).includes(Number(id.split('-')[0])),reason:'Your teacher has not unlocked this lesson.'};}
export async function lmsApi(x){
 const {endpoint,method,b,u,c,s,t,json,fail,scope,termAccess,lessonAccess,course,scopeKey,sessions,audit}=x;
 const sessionId=academicSession(),ctx={sessionId,class:c,subject:s,term:t},staff=u.role!=='STUDENT';
 const allowed=record=>{if(!record)fail(404,'Record not found.');scope(u,record.class,record.subject,record.sessionId);if(record.sessionId!==sessionId)fail(403,'Select the record’s academic session.');if(u.role==='STUDENT'&&record.student!==u.id)fail(403,'This record is private.');};
 const needStaff=()=>{if(!staff)fail(403,'Teacher access required.');scope(u,c,s);};const needAdmin=()=>{if(u.role!=='ADMIN')fail(403,'Administrator access required.');};
 if(endpoint==='notifications'&&method==='GET'){json(db.notifications.filter(n=>n.recipient===u.id).slice(-80).reverse());return true;}
 if(endpoint==='notification-read'&&method==='POST'){const n=db.notifications.find(n=>n.id===b.id&&n.recipient===u.id);if(!n)fail(404,'Notification not found.');n.read=true;await save();json({ok:true});return true;}
 if(endpoint==='calculator'&&method==='POST'){json({result:calculate(clean(b.expression))});return true;}
 if(endpoint==='formula-steps'&&method==='POST'){const first=checkAnswer({id:'step1',prompt:'',explanation:'',kind:'expression',answer:'y-5',variables:['y']},b.subtract),second=checkAnswer({id:'step2',prompt:'',explanation:'',kind:'expression',answer:'(y-5)/3',variables:['y']},b.isolate);json({correct:first&&second,message:first&&second?'✓ Both steps preserve the equation. x = (y − 5) / 3.':!first?'First subtract 5 from both sides. The left side becomes y − 5.':'Now divide both sides by 3. Keep the whole numerator inside brackets.'});return true;}
 if(endpoint==='assessment/start'&&method==='POST'){
  if(u.role!=='STUDENT')fail(403,'Assessments are for student accounts.');const w=lessonAccess(u,c,s,t,b.lesson),l=w.lessons.find(l=>l.id===b.lesson);if(!l)fail(404,'Lesson not found.');const kind=b.kind==='mastery'?'mastery':'quiz';
  const pool=kind==='mastery'?w.quiz:l.questions.filter(q=>q.stage==='quiz');const questions=pool.length>=10?pool:l.questions.slice(-10);if(kind==='mastery')for(const lesson of w.lessons)lessonAccess(u,c,s,t,lesson.id);
  const shuffled=[...questions].sort(()=>randomBytes(1)[0]%3-1).slice(0,kind==='mastery'?20:10);
  const attempt={id:randomUUID(),...ctx,student:u.id,lesson:l.id,week:w.id,kind,started:stamp(),status:'STARTED',questions:shuffled,answers:{}};db.assessmentAttempts.push(attempt);await save();json({id:attempt.id,kind,started:attempt.started,questions:shuffled.map(q=>Object.fromEntries(['id','prompt','kind','options','difficulty','hint','stage','objective','variables','tolerance','marks'].filter(k=>q[k]!==undefined).map(k=>[k,q[k]])))});return true;
 }
 if(endpoint==='assessment/submit'&&method==='POST'){
  const attempt=db.assessmentAttempts.find(a=>a.id===b.id);allowed(attempt);if(attempt.student!==u.id)fail(403,'Only the learner can submit this attempt.');lessonAccess(u,c,s,t,attempt.lesson);if(attempt.kind==='weekly'){const week=course(c,s,t).find(w=>w.id===attempt.week);if(!week?.lessons.length)fail(404,'Week not found.');for(const subtopic of week.lessons)lessonAccess(u,c,s,t,subtopic.id);}if(attempt.status!=='STARTED')fail(409,'This attempt has already been submitted.');
  if(!b.answers||typeof b.answers!=='object'||Array.isArray(b.answers))fail(400,'Provide an answer for each question.');const result=gradeAssessment(attempt.questions,b.answers);Object.assign(attempt,{answers:b.answers,status:'SUBMITTED',submitted:stamp(),percentage:result.percentage,results:result.results,activeSeconds:Math.min(7200,Math.max(0,Number(b.activeSeconds)||0)),band:masteryBand(result.percentage,db.policy)});await save();json({...result,band:attempt.band,kind:attempt.kind,id:attempt.id});return true;
 }
 if(endpoint==='assessment/history'&&method==='GET'){termAccess(u,c,s,t);json(db.assessmentAttempts.filter(a=>a.sessionId===sessionId&&a.class===c&&a.subject===s&&a.term===t&&(staff||a.student===u.id)).map(({questions,answers,...a})=>a));return true;}
 if(endpoint==='lesson-release'&&method==='POST'){
  needStaff();const w=course(c,s,t).find(w=>w.lessons.some(l=>l.id===b.lesson));if(!w)fail(404,'Lesson not found.');if(!['DRAFT','SCHEDULED','LOCKED','UNLOCKED','ARCHIVED'].includes(b.status))fail(400,'Choose a valid publication status.');if(b.status==='SCHEDULED'&&!Number.isFinite(Date.parse(b.releaseAt)))fail(400,'Choose a valid release date.');
  await rememberLearningReleases(c,s,t,course,scopeKey,releaseState);let r=db.releases.find(r=>r.sessionId===sessionId&&r.class===c&&r.subject===s&&r.term===t&&r.lesson===b.lesson);if(!r){r={id:randomUUID(),...ctx,lesson:b.lesson};db.releases.push(r);}Object.assign(r,{status:b.status,releaseAt:b.releaseAt?new Date(b.releaseAt).toISOString():null,updated:stamp(),teacher:u.id});audit(u,`Set lesson ${b.lesson} to ${b.status} in ${sessionId}`);await save();await rememberLearningReleases(c,s,t,course,scopeKey,releaseState);json(r);return true;
 }
 if(endpoint==='discussion-control'&&method==='POST'){
  const q=db.questions.find(q=>q.id===b.id);allowed({...q,student:u.id});if(!q)fail(404,'Question not found.');lessonAccess(u,q.class,q.subject,q.term,q.lesson);
  if(b.action==='report'){q.reports??=[];q.reports.push({student:u.id,reason:clean(b.reason),created:stamp()});}
  else if(b.action==='resolve'){if(!staff&&q.student!==u.id)fail(403,'Only the author or a teacher can resolve this question.');q.resolved=!q.resolved;}
  else{needStaff();if(b.action==='pin')q.pinned=!q.pinned;else if(b.action==='hide')q.hidden=!q.hidden;else if(b.action==='highlight'){const reply=q.replies[Number(b.reply)];if(!reply)fail(404,'Reply not found.');reply.highlighted=!reply.highlighted;}else fail(400,'Unknown moderation action.');audit(u,`Moderated discussion ${q.id}: ${b.action}`);}await save();json({ok:true});return true;
 }
 if(endpoint==='announcement'&&method==='POST'){
  needStaff();if(!clean(b.title)||!clean(b.message))fail(400,'Add a title and announcement.');const announcement={id:randomUUID(),...ctx,title:clean(b.title),message:clean(b.message),author:u.name,created:stamp()};db.announcements.push(announcement);for(const e of db.enrolments.filter(e=>e.sessionId===sessionId&&e.class===c))notify(e.student,announcement.title,announcement.message);await save();json(announcement);return true;
 }
 if(endpoint==='score-update'&&method==='POST'){
  needStaff();const score=db.scores.find(v=>v.id===b.id);allowed(score);db.scoreHistory??=[];db.scoreHistory.push({id:randomUUID(),score:score.id,teacher:u.id,before:structuredClone(score),at:stamp()});
  if(b.score!==undefined){const value=Number(b.score);if(!Number.isFinite(value)||value<0||value>score.max)fail(400,'Score is outside the permitted range.');score.score=value;}if(b.published!==undefined)score.published=!!b.published;if(b.remark!==undefined)score.remark=clean(b.remark);audit(u,`Updated ${score.type} result ${score.id}; published=${score.published}`);if(score.published)notify(score.student,'Your result is available',`${score.title||score.type}: ${score.score}/${score.max}`,'scores');await save();json(score);return true;
 }
 if(endpoint==='score-import'&&method==='POST'){
  needStaff();if(!Array.isArray(b.rows)||b.rows.length>500)fail(400,'Import up to 500 score rows.');const prepared=[];for(const [i,row]of b.rows.entries()){const student=db.users.find(u=>u.role==='STUDENT'&&(u.id===row.student||u.email===row.email));if(!student||!db.enrolments.some(e=>e.student===student.id&&e.class===c&&e.sessionId===sessionId))fail(400,`Row ${i+1}: student is not enrolled in this class.`);const value=Number(row.score),max=Number(row.max||100);if(!Number.isFinite(value)||!Number.isFinite(max)||max<=0||value<0||value>max)fail(400,`Row ${i+1}: invalid marks.`);prepared.push({id:randomUUID(),...ctx,student:student.id,title:clean(row.title)||'Imported assessment',type:row.type==='Exam'?'Exam':'Test',score:value,max,published:false,remark:clean(row.remark),date:row.date||stamp().slice(0,10),teacher:u.id});}db.scores.push(...prepared);audit(u,`Imported ${prepared.length} draft results`);await save();json({imported:prepared.length});return true;
 }
 if(endpoint==='sessions'&&method==='POST'){
  needAdmin();const name=clean(b.name);if(!/^\d{4}\/\d{4}$/.test(name)||Number(name.slice(5))!==Number(name.slice(0,4))+1)fail(400,'Use an academic session such as 2027/2028.');if(db.sessions.some(s=>s.name===name))fail(409,'This session already exists.');const record={id:randomUUID(),name,currentTerm:1};db.sessions.push(record);if(b.activate)db.currentSessionId=record.id;audit(u,`Created academic session ${name}`);await save();json(record,201);return true;
 }
 if(endpoint==='session-activate'&&method==='POST'){needAdmin();if(!db.sessions.some(s=>s.id===b.id))fail(404,'Session not found.');db.currentSessionId=b.id;audit(u,`Activated academic session ${b.id}`);await save();json({ok:true});return true;}
 if(endpoint==='promote'&&method==='POST'){
  needAdmin();const target=db.sessions.find(s=>s.id===b.targetSession);if(!target||target.id===sessionId||!db.classes.includes(b.targetClass))fail(400,'Choose a different academic session and a valid destination class.');const ids=Array.isArray(b.students)?b.students:[b.student];const students=ids.map(id=>db.users.find(u=>u.id===id&&u.role==='STUDENT'));if(students.some(s=>!s||!db.enrolments.some(e=>e.student===s.id&&e.sessionId===sessionId)))fail(400,'Each student must be enrolled in the source session.');
  for(const student of students)if(db.enrolments.some(e=>e.student===student.id&&e.sessionId===target.id))fail(409,`${student.name} is already enrolled in the target session.`);
  for(const student of students){db.enrolments.push({id:randomUUID(),student:student.id,sessionId:target.id,class:b.targetClass});if(db.currentSessionId===target.id)student.class=b.targetClass;}audit(u,`Promoted ${students.length} students to ${target.name} ${b.targetClass}`);await save();json({promoted:students.length});return true;
 }
 if(endpoint==='policy'&&method==='POST'){
  needAdmin();const p={...db.policy,...b.policy};if(!(0<=p.developing&&p.developing<p.proficient&&p.proficient<p.mastered&&p.mastered<=100)||p.completion<1||p.completion>100||p.noteMaximum<1||p.noteMaximum>100)fail(400,'Check the mastery thresholds and maximum marks.');p.weights??={test:40,exam:60,notes:0};const weights=Object.values(p.weights);if(weights.length!==3||weights.some(v=>!Number.isFinite(v)||v<0)||weights.reduce((a,b)=>a+b,0)!==100||(!p.noteIncludedInCA&&p.weights.notes>0)||(p.noteIncludedInCA&&p.weights.notes===0))fail(400,'Test, exam and note weights must total 100%. Notes need a positive weight only when explicitly included.');db.policy={...defaultPolicy,...p};audit(u,'Updated mastery and assessment policy');await save();json(db.policy);return true;
 }
 if(endpoint==='account-recovery'&&method==='POST'){
  needAdmin();const person=db.users.find(v=>v.id===b.id);if(!person)fail(404,'Account not found.');const token=randomBytes(32).toString('hex');db.resetTokens=db.resetTokens.filter(v=>v.user!==person.id);db.resetTokens.push({id:tokenHash(token),user:person.id,expires:new Date(Date.now()+30*60000).toISOString(),used:false});audit(u,`Issued one-time account recovery for ${person.id}`);for(const r of db.recoveryRequests||[])if(r.user===person.id&&r.status==='PENDING'){r.status='ISSUED';r.handledBy=u.id;r.handled=new Date().toISOString();}await sessions.revoke(person.id);await save();json({token,expiresInMinutes:30,message:'Deliver this one-time token privately to the account holder. It is never logged.'});return true;
 }
 return false;
}
export async function requestRecovery(b){
 const generic={message:'If that email belongs to an account, your school administrator has been notified. They will give you a one-time recovery token in person or through the school’s private channel.'};
 const email=clean(b.email).toLowerCase();const person=email&&db.users.find(v=>v.email.toLowerCase()===email&&!['ARCHIVED','DEACTIVATED'].includes(v.status));
 if(!person)return generic;
 db.recoveryRequests??=[];
 if(!db.recoveryRequests.some(r=>r.user===person.id&&r.status==='PENDING')){
  db.recoveryRequests.push({id:randomBytes(8).toString('hex'),user:person.id,name:person.name,role:person.role,class:person.class||'',email:person.email,status:'PENDING',requested:new Date().toISOString()});
  for(const admin of db.users.filter(v=>v.role==='ADMIN'&&v.status==='ACTIVE'))notify(admin.id,'Password recovery requested',person.name+' asked for help signing in. Open Admin to issue a one-time recovery token.','admin');
  await save();
 }
 return generic;
}
export async function redeemRecovery(b,fail){const token=db.resetTokens.find(v=>v.id===tokenHash(clean(b.token)));if(!token||token.used||Date.parse(token.expires)<Date.now())fail(400,'This recovery token is invalid or expired.');if(String(b.password||'').length<14)fail(400,'Use a password of at least 14 characters.');const person=db.users.find(u=>u.id===token.user);person.password=hash(b.password);token.used=true;await save();return {message:'Password set. Sign in with your new password. Account approval is still required.'};}
