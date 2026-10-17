import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {curriculum as weeks} from '../curriculum.mjs';
const dir=path.resolve('test-results','api-'+Date.now());fs.mkdirSync(dir,{recursive:true});
const port=0;let root='';
const processServer=spawn(process.execPath,['--experimental-sqlite','server.mjs'],{env:{...process.env,PORT:String(port),DATA_DIR:dir,DEMO_PASSWORD:'Learn@2026!',NODE_ENV:'test',SELF_REGISTRATION:'true'},stdio:['ignore','pipe','pipe']});
let serverOutput='';processServer.stdout.on('data',b=>{serverOutput+=b;const match=serverOutput.match(/ready at (http:\/\/127\.0\.0\.1:\d+)/);if(match)root=match[1];});processServer.stderr.on('data',b=>serverOutput+=b);

async function request(route,data,session={},method){const r=await fetch(root+'/api/'+route,{method:method||(data?'POST':'GET'),headers:{'Content-Type':'application/json',Cookie:session.cookie||'','X-CSRF-Token':session.csrf||''},...(data?{body:JSON.stringify(data)}:{})});const json=await r.json();return {status:r.status,value:json,cookie:r.headers.get('set-cookie')?.split(';')[0]};}
async function login(email){const r=await request('login',{email,password:'Learn@2026!'});assert.equal(r.status,200,JSON.stringify(r.value));return {cookie:r.cookie,csrf:r.value.csrf};}
const context={class:'SS1',subject:'Mathematics',term:1};
test('School portal: approval, isolation, content, submissions and teacher workflows',async t=>{
 try{
 for(let i=0;i<80;i++){try{if((await fetch(root)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));if(i===79)throw Error(serverOutput);}
 const student=await login('student@olawaleslab.school'),second=await login('chisom@olawaleslab.school'),admin=await login('admin@olawaleslab.school'),teacher=await login('teacher@olawaleslab.school');
 await t.test('Pending students cannot sign in; registration always starts pending',async()=>{
  assert.equal((await request('login',{email:'pending@olawaleslab.school',password:'Learn@2026!'})).status,403);
  const reg=await request('register',{name:'New Learner',email:'new@test.school',password:'Learn@2026!',class:'SS2',admission:'NEW-001',guardian:'08000000000',role:'ADMIN',status:'ACTIVE'});assert.equal(reg.status,201,serverOutput);
  assert.equal((await request('login',{email:'new@test.school',password:'Learn@2026!'})).status,403);
  const data=(await request('state',null,admin)).value,newUser=data.students.find(u=>u.email==='new@test.school');assert.equal(newUser.role,'STUDENT');assert.equal(newUser.status,'PENDING');
  assert.equal((await request('student-status',{id:newUser.id,status:'ACTIVE'},admin)).status,200);const active=await login('new@test.school');assert.equal((await request('state',null,active)).value.user.class,'SS2');
 });
 await t.test('Weeks and terms are protected through the API',async()=>{
  assert.equal((await request('lesson/1-1',null,student)).status,200);
  assert.equal((await request('lesson/2-1',null,student)).status,403);
  assert.equal((await request('practice',{...context,lesson:'2-1',question:'w2q0',answer:'16'},student)).status,403);
  assert.equal((await request('unlock',{...context,week:2,unlocked:true},teacher)).status,200);
  assert.equal((await request('lesson/2-1',null,student)).status,200);
  await request('term-lock',{...context,locked:true},admin);assert.equal((await request('lesson/1-1',null,student)).status,403);assert.equal((await request('state',null,student)).value.weeks.length,0);
  await request('term-lock',{...context,locked:false},admin);assert.equal((await request('state?term=2',null,student)).value.termLocked,true);
 });
 await t.test('Student cannot mutate school settings; teacher cannot cross assigned subjects or classes',async()=>{
  assert.equal((await request('unlock',{...context,week:8,unlocked:true},student)).status,403);
  assert.equal((await request('state?class=SS2',null,teacher)).status,403);
  assert.equal((await request('state?subject=Physics',null,teacher)).status,403);
  assert.equal((await request('assignment',{class:'SS2',title:'No',instructions:'No',due:'2026-10-20'},teacher)).status,403);
  assert.equal((await request('term-lock',{...context,locked:true},teacher)).status,403);
 });
 let fileId,subId;
 await t.test('Private photo upload, signed access, submission and feedback',async()=>{
  const token=await request('upload-token',{...context,purpose:'assignment'},student);assert.equal(token.status,200);
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aG9sAAAAASUVORK5CYII=','base64');
  const upload=await fetch(root+token.value.url,{method:'PUT',headers:{Cookie:student.cookie,'X-CSRF-Token':student.csrf,'Content-Type':'image/png'},body:png});assert.equal(upload.status,200);fileId=(await upload.json()).id;
  const submitted=await request('submit',{...context,kind:'assignment',assignment:'assignment1',files:[fileId]},student);assert.equal(submitted.status,201);subId=submitted.value.id;
  assert.equal((await request('file/'+fileId,null,second)).status,404);
  const signed=(await request('file/'+fileId,null,student)).value.url;
  assert.equal((await fetch(root+signed,{headers:{Cookie:student.cookie}})).status,200);
  assert.equal((await fetch(root+signed,{headers:{Cookie:second.cookie}})).status,404);
  assert.equal((await request('file/'+fileId,null,teacher)).status,200);
  assert.equal((await request('state',null,second)).value.submissions.length,0);
  assert.equal((await request('mark',{...context,id:subId,score:85,feedback:'Clear working. Well done.'},teacher)).status,200);
  assert.equal((await request('state',null,student)).value.submissions[0].score,85);
  assert.equal((await request('submit',{...context,kind:'assignment',assignment:'assignment1',files:[fileId]},student)).status,409);
  assert.equal((await request('submit',{...context,kind:'note',date:'2026-10-16',frequency:'Daily',files:[fileId]},second)).status,403);
 });
 await t.test('Practice answers are server-marked and completion requires reflection',async()=>{
  const content=(await request('lesson/1-1',null,student)).value;assert.equal(content.questions.length,60);assert.equal(content.questions[0].answer,undefined);
  const first=await request('practice',{...context,lesson:'1-1',question:content.questions[5].id,answer:weeks[0].lessons[0].questions[5].answer},student);assert.equal(first.value.progress.accuracy,100);assert.equal(first.value.progress.practiceScore,2);assert.equal(first.value.progress.complete,false);
  let p;for(let i=0;i<40;i++){const q=content.questions[i],answer=weeks[0].lessons[0].questions[i].answer;p=(await request('practice',{...context,lesson:'1-1',question:q.id,answer},student)).value.progress;}
  assert(p.accuracy>=60);assert.equal(p.complete,false);
  assert.equal((await request('reflection',{...context,lesson:'1-1',learnt:'I learnt how binary place values work. I can convert to decimal.',question:'None for now'},student)).status,200);
  assert.equal((await request('state',null,student)).value.progress.find(p=>p.lesson==='1-1').complete,true);
 });
 await t.test('Class discussion visible to peers; teacher replies and resources persist',async()=>{
  const q=await request('question',{...context,lesson:'1-1',text:'How do I add in base five?'},student);assert.equal(q.status,200);
  assert((await request('state',null,second)).value.questions.some(v=>v.id===q.value.id));
  await request('reply',{...context,id:q.value.id,text:'Carry after you reach five.'},teacher);
  assert((await request('state',null,student)).value.questions.find(v=>v.id===q.value.id).replies.some(v=>v.role==='TEACHER'));
  assert.equal((await request('resource',{...context,type:'live',title:'Live bases lesson',url:'https://meet.google.com/abc-defg-hij'},teacher)).status,200);
  assert.equal((await request('resource',{...context,type:'recording',title:'Bad link',url:'javascript:alert(1)'},teacher)).status,400);
  assert.equal((await request('resource',{...context,type:'lesson-note',title:'Place values',text:'Each place is a power of the base.'},teacher)).status,200);
 });
 await t.test('Teachers publish validated content without exposing answer keys; terms retain separate records',async()=>{
  assert.equal((await request('course',null,student)).status,403);
  assert.equal((await request('course',{...context,weeks:[{id:1,title:'Incomplete lesson'}]},teacher)).status,400);
  const source=(await request('course',null,teacher)).value;assert.equal(source.length,8);
  assert.equal((await request('course',{...context,weeks:source},teacher)).status,200);
  assert.equal((await request('lesson/1-1',null,student)).value.questions[0].check,undefined);
  await request('current-term',{currentTerm:2},admin);
  assert.equal((await request('state?term=2',null,student)).value.termLocked,false);
  assert.equal((await request('state?term=2',null,student)).value.questions.length,0);
  assert.equal((await request('state?term=1',null,student)).value.termLocked,false);
  await request('term-lock',{...context,locked:true},admin);assert.equal((await request('file/'+fileId,null,student)).status,404);
  await request('term-lock',{...context,locked:false},admin);
 });
 await t.test('CSRF, file validation, soft removal and password redaction',async()=>{
  const bad=await request('unlock',{...context,week:3,unlocked:true},{cookie:admin.cookie,csrf:'wrong'});assert.equal(bad.status,403);
  const token=await request('upload-token',{...context,purpose:'note'},student);const upload=await fetch(root+token.value.url,{method:'PUT',headers:{Cookie:student.cookie,'X-CSRF-Token':student.csrf},body:'not an image'});assert.equal(upload.status,400);
  const info=(await request('state',null,admin)).value;assert.equal(info.students[0].password,undefined);
  await request('student-status',{id:'student2',status:'REMOVED'},admin);assert.equal((await request('state',null,second)).status,401);
  assert.equal((await request('login',{email:'chisom@olawaleslab.school',password:'Learn@2026!'})).status,403);
 });
 }finally{processServer.kill();}
});
