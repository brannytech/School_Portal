import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {curriculum} from '../curriculum.mjs';
import {calculate,checkAnswer,gradeAssessment,masteryBand} from '../dist/domain.js';
import {summariseResults} from '../dist/results.js';
import {openDatabase} from '../database.mjs';

test('Scientific calculator, expression checking and mastery boundaries',()=>{
 assert.equal(calculate('-2^2'),-4);assert.equal(calculate('(3+5)/2'),4);assert.equal(calculate('2(3+4)'),14);assert.equal(calculate('sqrt(81)+log(100)'),11);assert.throws(()=>calculate('process.exit()'));
 assert(checkAnswer({id:'eq',kind:'expression',answer:'(y-5)/3',variables:['y']},'y/3-5/3'));
 assert(!checkAnswer({id:'eq',kind:'expression',answer:'(y-5)/3',variables:['y']},'y-5/3'));
 assert.equal(masteryBand(49),'Needs Improvement');assert.equal(masteryBand(50),'Developing');assert.equal(masteryBand(70),'Proficient');assert.equal(masteryBand(85),'Mastered');
 assert.equal(gradeAssessment(curriculum[0].lessons[0].questions.slice(0,5),{}).percentage,0);
 const policy={developing:50,proficient:70,mastered:85,completion:60,noteMaximum:10,noteIncludedInCA:false};
 assert.equal(summariseResults([{type:'Test',score:18,max:20},{type:'Exam',score:40,max:50}],[],policy).total,84);
 assert.equal(summariseResults([{type:'Test',score:18,max:20},{type:'Exam',score:40,max:50,published:false}],[],policy).total,null);
});

test('Relational migrations and constraints are enforced',async()=>{
 const directory=path.resolve('test-results','schema-'+Date.now());fs.mkdirSync(directory,{recursive:true});const sql=await openDatabase(directory);
 try{assert((await sql.all('SELECT version FROM schema_migrations')).length>=1);await assert.rejects(sql.run('INSERT INTO enrolments(id,student_id,session_id,class_id) VALUES (?,?,?,?)',['invalid','missing','missing','SS1']));
 await sql.run('INSERT INTO schools(id,name,motto) VALUES (?,?,?)',['school','Test School','Learn']);await sql.run('INSERT INTO academic_sessions(id,school_id,name,current_term) VALUES (?,?,?,?)',['s1','school','2030/2031',1]);await assert.rejects(sql.run('INSERT INTO academic_sessions(id,school_id,name,current_term) VALUES (?,?,?,?)',['s2','school','2030/2031',1]));
 }finally{await sql.close();}
});

test('New LMS workflows: assessments, scheduling, archives, moderation and recovery',async t=>{
 const dir=path.resolve('test-results','upgrade-'+Date.now());fs.mkdirSync(dir,{recursive:true});const port=0;let root='';
 let child;let output='';const start=async()=>{child=spawn(process.execPath,['--experimental-sqlite','server.mjs'],{env:{...process.env,PORT:String(port),DATA_DIR:dir,DEMO_PASSWORD:'Upgrade-Test-Password!',NODE_ENV:'test'},stdio:['ignore','pipe','pipe']});child.stdout.on('data',b=>{output+=b;const match=output.match(/ready at (http:\/\/127\.0\.0\.1:\d+)/g)?.at(-1);if(match)root=match.slice(9);});child.stderr.on('data',b=>output+=b);for(let i=0;i<100;i++){try{if((await fetch(root)).ok)return;}catch{}await new Promise(r=>setTimeout(r,60));}throw Error(output);};
 const stop=async()=>{if(!child||child.exitCode!==null||child.signalCode!==null)return;const stopped=new Promise(resolve=>child.once('exit',resolve));child.kill();await stopped;child=null;};
 async function req(route,data,account={},method){const r=await fetch(root+'/api/'+route,{method:method||(data?'POST':'GET'),headers:{'Content-Type':'application/json',Cookie:account.cookie||'','X-CSRF-Token':account.csrf||''},...(data?{body:JSON.stringify(data)}:{})});return {status:r.status,value:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
 async function login(role){const r=await req('login',{email:role+'@olawaleslab.school',password:'Upgrade-Test-Password!'});assert.equal(r.status,200,output);return {cookie:r.cookie,csrf:r.value.csrf};}
 const ctx={class:'SS1',subject:'Mathematics',term:1};
 try{await start();const admin=await login('admin'),teacher=await login('teacher'),student=await login('student');const oldSession=(await req('me',null,student)).value.sessionId;
 await t.test('Daily schedule overrides a week, including direct assessments',async()=>{
  await req('lesson-release',{...ctx,lesson:'1-2',status:'LOCKED'},teacher);assert.equal((await req('lesson/1-2',null,student)).status,403);
  await req('lesson-release',{...ctx,lesson:'1-2',status:'SCHEDULED',releaseAt:new Date(Date.now()+3600000).toISOString()},teacher);assert.equal((await req('lesson/1-2',null,student)).status,403);
  assert.equal((await req('assessment/start',{...ctx,lesson:'1-2',kind:'quiz'},student)).status,403);
  await req('lesson-release',{...ctx,lesson:'1-2',status:'SCHEDULED',releaseAt:new Date(Date.now()-1000).toISOString()},teacher);assert.equal((await req('lesson/1-2',null,student)).status,200);
 });
 await t.test('Quiz attempts withhold solutions, grade as a whole and persist mastery',async()=>{
  const l=(await req('lesson/1-1',null,student)).value;assert.equal(l.quiz.length,0);const hidden=l.questions.find(q=>q.stage==='quiz');assert.equal((await req('practice',{...ctx,lesson:'1-1',question:hidden.id,answer:'1'},student)).status,403);
  const start=await req('assessment/start',{...ctx,lesson:'1-1',kind:'quiz'},student);assert.equal(start.status,200);assert.equal(start.value.questions.length,10);assert.equal(start.value.questions[0].answer,undefined);assert.equal(start.value.questions[0].proof,undefined);
  const bank=curriculum[0].lessons[0].questions;const answers=Object.fromEntries(start.value.questions.map(q=>[q.id,bank.find(b=>b.id===q.id).answer]));const result=await req('assessment/submit',{...ctx,id:start.value.id,answers,activeSeconds:120},student);assert.equal(result.value.percentage,100);assert.equal(result.value.band,'Mastered');assert.equal((await req('assessment/submit',{...ctx,id:start.value.id,answers},student)).status,409);
  const mastery=await req('assessment/start',{...ctx,lesson:'1-1',kind:'mastery'},student);assert.equal(mastery.value.questions.length,20);
 });
 await t.test('Result drafts stay private and corrections/publication are audited',async()=>{
  const before=(await req('state',null,student)).value.scores.length;await req('score',{...ctx,student:'student',title:'Draft exam',type:'Exam',score:42,max:50,published:false},teacher);assert.equal((await req('state',null,student)).value.scores.length,before);
  const draft=(await req('state',null,teacher)).value.scores.find(s=>s.title==='Draft exam');await req('score-update',{...ctx,id:draft.id,score:45,published:true},teacher);assert.equal((await req('state',null,student)).value.scores.find(s=>s.id===draft.id).score,45);assert((await req('notifications',null,student)).value.some(n=>n.title==='Your result is available'));
 });
 await t.test('Notes use independent configurable marks and preserve resubmission history',async()=>{
  const token=(await req('upload-token',{...ctx,purpose:'note'},student)).value;const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aG9sAAAAASUVORK5CYII=','base64');const r=await fetch(root+token.url,{method:'PUT',headers:{Cookie:student.cookie,'X-CSRF-Token':student.csrf},body:png});const file=(await r.json()).id;
  const sub=await req('submit',{...ctx,kind:'note',date:'2030-10-01',frequency:'Daily',week:1,files:[file]},student);assert.equal(sub.value.max,10);assert.equal((await req('mark',{...ctx,id:sub.value.id,score:11,feedback:'Too high'},teacher)).status,400);
  await req('mark',{...ctx,id:sub.value.id,score:6,status:'Returned for correction',feedback:'Please add the missing definitions.'},teacher);const redo=await req('submit',{...ctx,kind:'note',date:'2030-10-01',frequency:'Daily',files:[file]},student);assert.equal(redo.value.status,'Resubmitted');
 });
 await t.test('Discussions can be resolved, reported and moderated within scope',async()=>{
  const peer=await login('chisom'),token=(await req('upload-token',{...ctx,purpose:'question'},student)).value;const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aG9sAAAAASUVORK5CYII=','base64');const response=await fetch(root+token.url,{method:'PUT',headers:{Cookie:student.cookie,'X-CSRF-Token':student.csrf},body:png});const image=(await response.json()).id;
  const q=(await req('question',{...ctx,lesson:'1-1',text:'A moderation test question',files:[image]},student)).value;assert.equal((await req('file/'+image,null,peer)).status,200);await req('discussion-control',{...ctx,id:q.id,action:'resolve'},student);assert.equal((await req('reply',{...ctx,id:q.id,text:'A reply'},student)).status,409);await req('discussion-control',{...ctx,id:q.id,action:'hide'},teacher);assert(!(await req('state',null,student)).value.questions.some(v=>v.id===q.id));assert.equal((await req('file/'+image,null,peer)).status,404);
  await req('discussion-control',{...ctx,id:q.id,action:'hide'},teacher);await req('lesson-release',{...ctx,lesson:'1-1',status:'LOCKED'},teacher);assert.equal((await req('file/'+image,null,peer)).status,404);await req('lesson-release',{...ctx,lesson:'1-1',status:'UNLOCKED'},teacher);
 });
 await t.test('Promotion retains historical class isolation and term data',async()=>{
  const year=Number((await req('me',null,admin)).value.sessions[0].name.slice(0,4))+1;const target=(await req('sessions',{...ctx,name:`${year}/${year+1}`},admin)).value;
  await req('promote',{...ctx,student:'student',targetSession:target.id,targetClass:'SS2'},admin);
  assert.equal((await req('state?sessionId='+target.id,null,student)).value.user.class,'SS2');assert.equal((await req('state?sessionId='+oldSession,null,student)).value.user.class,'SS1');assert.equal((await req('state?sessionId='+target.id,null,teacher)).status,403);
 });
 await t.test('Authentication survives process restart; suspension revokes an existing session',async()=>{
  await stop();await start();assert.equal((await req('me',null,student)).status,200);await req('student-status',{...ctx,id:'student',status:'SUSPENDED'},admin);assert.equal((await req('me',null,student)).status,401);await req('student-status',{...ctx,id:'student',status:'ACTIVE'},admin);
 });
 await t.test('Recovery is one-time and does not bypass approval',async()=>{
  const recovery=(await req('account-recovery',{...ctx,id:'pending'},admin)).value;assert(recovery.token);assert.equal((await req('recover-account',{token:recovery.token,password:'A-new-private-password!'})).status,200);assert.equal((await req('recover-account',{token:recovery.token,password:'Another-private-password!'})).status,400);assert.equal((await req('login',{email:'pending@olawaleslab.school',password:'A-new-private-password!'})).status,403);
 });
 await t.test('Private backup restores records and media into a fresh database',async()=>{
  await stop();const backup=path.join(dir,'backup-test'),restored=path.join(dir,'restored');
  const command=(script,args,environment)=>new Promise((resolve,reject)=>{const p=spawn(process.execPath,['--experimental-sqlite',script,...args],{env:{...process.env,DATA_DIR:environment},stdio:['ignore','pipe','pipe']});let output='';p.stdout.on('data',b=>output+=b);p.stderr.on('data',b=>output+=b);p.on('exit',code=>code===0?resolve(output):reject(Error(output)));});
  await command('scripts/backup.mjs',[backup],dir);await command('scripts/restore.mjs',[backup],restored);const sql=await openDatabase(restored);try{assert((await sql.all('SELECT id FROM users')).length>=5);assert((await sql.all('SELECT id FROM score_history')).length>=1);assert((await sql.all('SELECT id FROM question_items')).length>=1600);assert.equal((await sql.all('SELECT id FROM auth_sessions')).length,0);assert(fs.readdirSync(path.join(restored,'uploads')).length>=1);}finally{await sql.close();}
 });
 }finally{await stop();}
});
