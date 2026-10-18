import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

test('Scoped student monitoring, accurate work counts and durable last seen',async t=>{
 const directory=path.resolve('test-results','monitoring-'+Date.now());fs.mkdirSync(directory,{recursive:true});
 const env={...process.env,DATA_DIR:directory,PORT:'0',NODE_ENV:'test',DEMO_PASSWORD:'Learn@2026!'};
 const setup=`const {db,save,sql}=await import('./store.mjs');const scope={sessionId:db.currentSessionId,class:'SS1',subject:'Mathematics',term:1};const q=i=>({id:'q'+i,prompt:'Question '+i,kind:'numeric',answer:'1',explanation:'Test fixture',stage:i<39?'practice':'quiz'});const lesson={id:'1-1',title:'Practice fixture',objectives:[],explain:'Fixture',realLife:'Fixture',summary:[],example:q(0),questions:Array.from({length:50},(_,i)=>q(i))};db.courses[db.currentSessionId+'|SS1:Mathematics:1']=[{id:1,title:'Week one',lessons:[lesson],quiz:Array.from({length:20},(_,i)=>q(i))},{id:2,title:'Draft week',lessons:[{...lesson,id:'2-1'}],quiz:Array.from({length:20},(_,i)=>q(i))}];db.releases.push({id:'draft',...scope,lesson:'2-1',status:'DRAFT'});db.assignments=['a1','a2','general'].map((id,i)=>({id,...scope,title:id,week:i<2?1:null,teacher:'teacher'}));db.progress=[{id:'p',...scope,student:'student',lesson:'1-1',answers:Object.fromEntries(Array.from({length:7},(_,i)=>['q'+i,true])),complete:true,reflectionDone:true,contentConsumedAt:'2026-10-01T10:00:00.000Z'}];db.practiceAttempts=[{id:'wrong',...scope,student:'student',lesson:'1-1',question:'q0',correct:false},...Array.from({length:7},(_,i)=>({id:'attempt'+i,...scope,student:'student',lesson:'1-1',question:'q'+i,correct:true})),{id:'ghost',...scope,student:'student',lesson:'1-1',question:'removed-question',correct:true},{id:'private-subject',...scope,subject:'Physics',student:'student',lesson:'1-1',question:'q9',correct:true}];db.assessmentAttempts=[...['quiz','quiz','mastery'].map((kind,i)=>({id:'assessment'+i,...scope,student:'student',lesson:'1-1',week:1,kind,status:'SUBMITTED',percentage:75,questions:[],answers:{}})),{id:'unfinished',...scope,student:'student',lesson:'1-1',week:1,kind:'mastery',status:'STARTED',questions:[],answers:{}}];db.reflections=[{id:'r',...scope,student:'student',lesson:'1-1',learnt:'Reflection',draft:false}];db.submissions=[{id:'sub1',...scope,student:'student',kind:'assignment',assignment:'a1',week:1},{id:'sub1-retry',...scope,student:'student',kind:'assignment',assignment:'a1',week:1},{id:'note',...scope,student:'student',kind:'note',week:1}];db.submissions.push({id:'old-note',...scope,student:'student',kind:'note',week:null},{id:'peer-note',...scope,student:'student2',kind:'note',week:null});db.users.push({id:'outside',name:'Private learner',email:'private@test.school',role:'STUDENT',status:'ACTIVE',class:'SS2',password:db.users[0].password});await save();await sql.run('INSERT INTO student_presence(user_id,last_seen) VALUES (?,?)',['student2','2020-01-01T00:00:00.000Z']);await sql.close();`;
 const seed=spawnSync(process.execPath,['--experimental-sqlite','--input-type=module','-e',setup],{env,encoding:'utf8'});assert.equal(seed.status,0,seed.stderr);
 let server,root='',output='';
 async function start(){root='';output='';server=spawn(process.execPath,['--experimental-sqlite','server.mjs'],{env,stdio:['ignore','pipe','pipe']});server.stdout.on('data',b=>{output+=b;root=output.match(/ready at (http:\/\/127\.0\.0\.1:\d+)/)?.[1]||'';});server.stderr.on('data',b=>output+=b);for(let i=0;i<100&&!root;i++)await new Promise(r=>setTimeout(r,100));assert(root,output);}
 async function stop(){if(server.exitCode!==null)return;await new Promise(r=>{server.once('exit',r);server.kill();});}
 async function req(route,data,session={}){const r=await fetch(root+'/api/'+route,{method:data?'POST':'GET',headers:{Cookie:session.cookie||'','X-CSRF-Token':session.csrf||'','Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})});return {status:r.status,value:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
 async function login(role){const r=await req('login',{email:role+'@olawaleslab.school',password:'Learn@2026!'});assert.equal(r.status,200);return {cookie:r.cookie,csrf:r.value.csrf};}
 try{
  await start();const admin=await login('admin'),teacher=await login('teacher'),student=await login('student');
  await t.test('Only assigned staff can monitor a class and subject',async()=>{
   assert.equal((await req('monitoring',null,student)).status,403);
   assert.equal((await req('monitoring?class=SS2',null,teacher)).status,403);
   assert.equal((await req('monitoring?subject=Physics',null,teacher)).status,403);
   assert.equal((await req('monitoring?student=outside',null,teacher)).status,404);
   assert.equal((await req('monitoring?class=SS2',null,admin)).value.total,1);
  });
  await t.test('Weekly work is 11/44; retakes and unknown questions cannot inflate completion',async()=>{
   const r=await req('monitoring?student=student',null,teacher);assert.equal(r.status,200);const v=r.value.detail;
   assert.equal(v.weeks[0].done,11);assert.equal(v.weeks[0].total,44);assert.equal(v.weeks[0].percent,25);assert.equal(v.done,11);assert.equal(v.total,44);
   assert.deepEqual(v.categories.exercises,{done:7,total:39,percent:17.95});assert.equal(v.categories.quizzes.done,1);assert(!('mastery' in v.categories));assert.equal(v.categories.assignments.done,1);
   assert.equal(v.exerciseAttempts,8);assert.equal(v.quizAttempts,3);assert.equal(v.practiceAccuracy,100);assert(!('notes' in v));assert(!('notes' in v.weeks[0]));assert.equal(v.generalAssignments,0);assert.equal(r.value.unlinkedAssignments,1);assert.equal(v.categories.content.done,1);
   assert.equal(v.weeks.length,1,'Unreleased draft weeks must not appear in progress');assert.deepEqual(r.value.weekOptions.map(w=>w.id),[1]);
   assert.equal(r.value.students.find(s=>s.id==='student2').done,0);
   assert(!JSON.stringify(r.value).includes('removed-question'));assert(!('answers' in v));
  });
  await t.test('Personal weekly progress matches staff calculations and never exposes classmates',async()=>{
   const result=await req('my-progress?student=student2&class=SS2',null,student);assert.equal(result.status,200);const v=result.value;
   assert.equal(v.detail.id,'student');assert.equal(v.detail.done,11);assert.equal(v.detail.total,44);assert(!('unlinkedNotes' in v));assert(!('students' in v));assert(!JSON.stringify(v).includes('student2'));assert(!('answers' in v.detail));
   assert.equal((await req('my-progress',null,teacher)).status,403);
   assert.equal((await req('my-progress?term=2',null,student)).status,403);
   await req('term-lock',{locked:true},admin);assert.equal((await req('my-progress',null,student)).status,403);await req('term-lock',{locked:false},admin);
  });
  await t.test('Week and search filters use real denominators and validate pagination',async()=>{
   const week=(await req('monitoring?week=1&student=student',null,teacher)).value.detail;assert.equal(week.done,11);assert.equal(week.total,44);assert.equal(week.generalAssignments,0);
   assert.equal((await req('monitoring?search=GF%2F2026%2F001',null,teacher)).value.total,1);
   assert.equal((await req('monitoring?week=2&student=student',null,teacher)).status,400);
   for(const query of ['week=999','week=bad','page=-1','pageSize=1000'])assert.equal((await req('monitoring?'+query,null,teacher)).status,400);
  });
  await t.test('Release the next week and compare it with the previous week or all released weeks',async()=>{
   assert.equal((await req('content-read',{lesson:'2-1'},student)).status,403);
   assert.equal((await req('content-read',{lesson:'1-1'},teacher)).status,403);
   assert.equal((await req('lesson-release',{lesson:'2-1',status:'UNLOCKED'},teacher)).status,200);
   assert.equal((await req('unlock',{week:2,unlocked:true},teacher)).status,200);
   const latest=(await req('monitoring?student=student',null,teacher)).value;
   assert.equal(latest.latestWeek,2);assert.equal(latest.currentWeek,2);assert.equal(latest.detail.done,0);assert.equal(latest.detail.total,42);
   assert.equal(latest.detail.comparison.previous.id,1);assert.equal(latest.detail.comparison.previous.done,11);assert.equal(latest.detail.comparison.change,-25);
   const all=(await req('monitoring?week=all&student=student',null,teacher)).value.detail;assert.equal(all.done,11);assert.equal(all.total,86);assert.equal(all.weeks.length,2);
   assert.equal((await req('monitoring?week=1&compareWeek=2&student=student',null,teacher)).value.detail.comparison.change,25);
   assert.equal((await req('monitoring?week=2&compareWeek=2',null,teacher)).status,400);
   assert.equal((await req('monitoring?compareWeek=99',null,teacher)).status,400);
  });
  await t.test('Content consumption and homework count only for their assigned week',async()=>{
   assert.equal((await req('assignment-week',{id:'general',week:2},teacher)).status,200);
   assert.equal((await req('assignment-week',{id:'a1',week:999},teacher)).status,400);
   assert.equal((await req('assignment-week',{id:'a1',week:2},student)).status,403);
   assert.equal((await req('content-read',{lesson:'2-1',student:'student2'},student)).status,200);
   assert.equal((await req('content-read',{lesson:'2-1'},student)).status,200);
   const week=(await req('monitoring?week=2&student=student',null,teacher)).value;
   assert.equal(week.detail.done,1);assert.equal(week.detail.total,43);assert.equal(week.detail.categories.content.done,1);assert.equal(week.detail.categories.assignments.total,1);assert.equal(week.unlinkedAssignments,0);
   assert.equal(week.students.find(s=>s.id==='student2').categories.content.done,0);
   assert.equal((await req('monitoring?week=1&student=student',null,teacher)).value.detail.done,11);
   assert.equal((await req('monitoring?week=all&student=student',null,teacher)).value.detail.done,12);
  });
  await t.test('Relocking weeks preserves their progress and release history across restart',async()=>{
   await req('unlock',{week:1,unlocked:false},teacher);
   await req('lesson-release',{lesson:'2-1',status:'LOCKED'},teacher);
   await req('unlock',{week:2,unlocked:false},teacher);
   assert.equal((await req('content-read',{lesson:'2-1'},student)).status,403);
   await stop();await start();
   const data=(await req('monitoring?week=all&student=student',null,teacher)).value;
   assert.deepEqual(data.weekOptions.map(w=>w.id),[1,2]);assert.equal(data.detail.done,12);assert.equal(data.detail.comparison.previous.done,11);
  });
  let lastSeen;
  await t.test('Last seen is durable student activity, not staff polling or a supplied student ID',async()=>{
   const before=(await req('monitoring',null,teacher)).value.students;lastSeen=before.find(s=>s.id==='student').lastSeen;assert(lastSeen);assert(before.find(s=>s.id==='student').recentlyActive);
   const presence=await req('presence',{student:'student2'},student);assert.equal(presence.status,200);lastSeen=presence.value.lastSeen;
   assert.equal((await req('presence',{},teacher)).status,403);
   assert.equal((await req('presence',{},{...student,csrf:'wrong'})).status,403);
   const after=(await req('monitoring',null,teacher)).value.students;assert.equal(after.find(s=>s.id==='student2').lastSeen,'2020-01-01T00:00:00.000Z');assert.equal(after.find(s=>s.id==='student').lastSeen,lastSeen);
   await stop();await start();assert.equal((await req('monitoring?student=student',null,teacher)).value.detail.lastSeen,lastSeen);
  });
  await t.test('Assignments can be linked to a real learning week',async()=>{
   const assignment={title:'Weekly task',instructions:'Complete the exercise.',due:'2026-11-01',class:'SS1',subject:'Mathematics',term:1};
   assert.equal((await req('assignment',{...assignment,week:999},teacher)).status,400);
   assert.equal((await req('assignment',{...assignment,week:'bad'},teacher)).status,400);
   assert.equal((await req('assignment',{...assignment,week:1},teacher)).value.week,1);
  });
  await t.test('Optional notes retain their weeks and correction history without affecting progress',async()=>{
   const beforeNotes=(await req('my-progress?week=1',null,student)).value.detail;
   assert.equal((await req('note-week',{id:'peer-note',week:1},student)).status,404);
   assert.equal((await req('note-week',{id:'old-note',week:99},student)).status,400);
   assert.equal((await req('note-week',{id:'old-note',week:1},{...student,csrf:'bad'})).status,403);
   assert.equal((await req('note-week',{id:'old-note',week:1},student)).status,200);
   assert.equal((await req('note-week',{id:'old-note',week:2},student)).status,409);
   assert.equal((await req('state',null,student)).value.submissions.find(v=>v.id==='old-note').week,1);
   const token=(await req('upload-token',{purpose:'note'},student)).value;
   const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aG9sAAAAASUVORK5CYII=','base64');
   const upload=await fetch(root+token.url,{method:'PUT',headers:{Cookie:student.cookie,'X-CSRF-Token':student.csrf},body:png});assert.equal(upload.status,200);const file=(await upload.json()).id;
   const note={kind:'note',date:'2026-10-18',frequency:'Daily',files:[file]};
   for(const week of [undefined,999,2])assert.equal((await req('submit',{...note,week},student)).status,400);
   await req('unlock',{week:1,unlocked:true},teacher);
   const submitted=await req('submit',{...note,week:1},student);assert.equal(submitted.status,201);assert.equal(submitted.value.week,1);
   assert.equal((await req('submit',{...note,week:1},student)).status,409);
   await req('mark',{id:submitted.value.id,score:5,status:'Returned for correction',feedback:'Add the definitions.'},teacher);
   const resubmitted=await req('submit',{...note,week:1},student);assert.equal(resubmitted.value.id,submitted.value.id);assert.equal(resubmitted.value.status,'Resubmitted');
   const own=(await req('my-progress?week=1',null,student)).value.detail;const staffView=(await req('monitoring?week=1&student=student',null,teacher)).value.detail;
   assert(!('notes' in own));assert(!('notes' in own.weeks[0]));assert(!('notes' in staffView));assert.equal(own.done,11);assert.equal(own.total,beforeNotes.total);assert.equal(own.percent,beforeNotes.percent);assert.equal(own.done,staffView.done);
   assert(!('notes' in (await req('my-progress?week=2',null,student)).value.detail));
   await stop();await start();assert.equal((await req('state',null,student)).value.submissions.find(v=>v.id===submitted.value.id).week,1);assert.equal((await req('my-progress?week=1',null,student)).value.detail.done,11);
  });
 }finally{await stop();}
});
