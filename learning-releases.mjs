import {db,sql} from './store.mjs';
import {academicSession} from './context.mjs';

// Retain release history so relocking a completed week does not erase its report.
export async function rememberLearningReleases(c,s,t,course,scopeKey,releaseState){
 db.learningReleases??=[];const sessionId=academicSession();let changed=false;
 const fits=v=>v.sessionId===sessionId&&v.class===c&&v.subject===s&&v.term===t;
 const studentIds=new Set(db.users.filter(u=>u.role==='STUDENT').map(u=>u.id));
 const evidence=new Set([...db.progress,...db.practiceAttempts,...db.assessmentAttempts].filter(v=>fits(v)&&studentIds.has(v.student)).map(v=>v.lesson));
 for(const week of course(c,s,t))for(const lesson of week.lessons){
  const release=releaseState(c,s,t,lesson.id,scopeKey);
  if(!release.available&&!evidence.has(lesson.id))continue;
  if(db.learningReleases.some(v=>fits(v)&&v.lesson===lesson.id))continue;
  const audit=db.audit.filter(v=>v.action===`Unlock week ${week.id}, ${scopeKey(c,s,t)}`).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at))[0];
  db.learningReleases.push({sessionId,class:c,subject:s,term:t,lesson:lesson.id,week:week.id,releasedAt:release.available?(release.status==='SCHEDULED'?release.releaseAt:release.updated||audit?.at||null):audit?.at||null,recordedAt:new Date().toISOString()});changed=true;
 }
 // Persist only this setting: a report must not create historical enrolments.
 if(changed)await sql.run('INSERT INTO app_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',['learningReleases',JSON.stringify(db.learningReleases)]);
 return db.learningReleases.filter(fits);
}
