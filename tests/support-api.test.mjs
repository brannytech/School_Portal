import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const setup=`const {db,save,sql}=await import('./store.mjs');const scope={sessionId:db.currentSessionId,class:'SS1',subject:'Mathematics',term:1};const q=i=>({id:'q'+i,prompt:'Question '+i,kind:'numeric',answer:'1',explanation:'Test fixture',stage:i<39?'practice':'quiz'});const lesson={id:'1-1',title:'Practice fixture',objectives:[],explain:'Fixture',realLife:'Fixture',summary:[],example:q(0),questions:Array.from({length:50},(_,i)=>q(i))};db.courses[db.currentSessionId+'|SS1:Mathematics:1']=[{id:1,title:'Week one',lessons:[lesson],quiz:Array.from({length:20},(_,i)=>q(i))},{id:2,title:'Draft week',lessons:[{...lesson,id:'2-1'}],quiz:Array.from({length:20},(_,i)=>q(i))}];db.releases.push({id:'draft',...scope,lesson:'2-1',status:'DRAFT'});db.assignments=['a1','a2','general'].map((id,i)=>({id,...scope,title:id,week:i<2?1:null,teacher:'teacher'}));db.progress=[{id:'p',...scope,student:'student',lesson:'1-1',answers:Object.fromEntries(Array.from({length:7},(_,i)=>['q'+i,true])),complete:true,reflectionDone:true,contentConsumedAt:'2026-10-01T10:00:00.000Z'}];db.practiceAttempts=[{id:'wrong',...scope,student:'student',lesson:'1-1',question:'q0',correct:false},...Array.from({length:7},(_,i)=>({id:'attempt'+i,...scope,student:'student',lesson:'1-1',question:'q'+i,correct:true})),{id:'ghost',...scope,student:'student',lesson:'1-1',question:'removed-question',correct:true},{id:'private-subject',...scope,subject:'Physics',student:'student',lesson:'1-1',question:'q9',correct:true}];db.assessmentAttempts=[...['quiz','quiz','mastery'].map((kind,i)=>({id:'assessment'+i,...scope,student:'student',lesson:'1-1',week:1,kind,status:'SUBMITTED',percentage:75,questions:[],answers:{}})),{id:'unfinished',...scope,student:'student',lesson:'1-1',week:1,kind:'mastery',status:'STARTED',questions:[],answers:{}}];db.reflections=[{id:'r',...scope,student:'student',lesson:'1-1',learnt:'Reflection',draft:false}];db.submissions=[{id:'sub1',...scope,student:'student',kind:'assignment',assignment:'a1',week:1},{id:'sub1-retry',...scope,student:'student',kind:'assignment',assignment:'a1',week:1},{id:'note',...scope,student:'student',kind:'note',week:1}];db.submissions.push({id:'old-note',...scope,student:'student',kind:'note',week:null},{id:'peer-note',...scope,student:'student2',kind:'note',week:null});db.users.push({id:'outside',name:'Private learner',email:'private@test.school',role:'STUDENT',status:'ACTIVE',class:'SS2',password:db.users[0].password});await save();await sql.run('INSERT INTO student_presence(user_id,last_seen) VALUES (?,?)',['student2','2020-01-01T00:00:00.000Z']);db.practiceAttempts.push(...Array.from({length:9},(_,i)=>({id:'weak'+i,...scope,student:'student2',lesson:'1-1',question:'q'+i,correct:false,response:'9',at:new Date().toISOString()})));await save();await sql.close();`;

test('Support monitor API: staff only, evidence-based status, admin-editable rules',async t=>{
 const directory=path.resolve('test-results','support-'+Date.now());fs.mkdirSync(directory,{recursive:true});
 const env={...process.env,DATA_DIR:directory,PORT:'0',NODE_ENV:'test',DEMO_PASSWORD:'Learn@2026!'};
 const seed=spawnSync(process.execPath,['--experimental-sqlite','--input-type=module','-e',setup],{env,encoding:'utf8'});assert.equal(seed.status,0,seed.stderr);
 let server,root='',output='';
 server=spawn(process.execPath,['--experimental-sqlite','server.mjs'],{env,stdio:['ignore','pipe','pipe']});server.stdout.on('data',b=>{output+=b;root=output.match(/ready at (http:\/\/127\.0\.0\.1:\d+)/)?.[1]||'';});server.stderr.on('data',b=>output+=b);for(let i=0;i<100&&!root;i++)await new Promise(r=>setTimeout(r,100));assert(root,output);
 async function req(route,data,session={}){const r=await fetch(root+'/api/'+route,{method:data?'POST':'GET',headers:{Cookie:session.cookie||'','X-CSRF-Token':session.csrf||'','Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})});return {status:r.status,value:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
 async function login(role){const r=await req('login',{email:role+'@olawaleslab.school',password:'Learn@2026!'});assert.equal(r.status,200);return {cookie:r.cookie,csrf:r.value.csrf};}
 try{
  const admin=await login('admin'),teacher=await login('teacher'),student=await login('student');
  await t.test('students cannot read the support board; teachers are limited to their class',async()=>{
   assert.equal((await req('support',null,student)).status,403);
   assert.equal((await req('support?class=SS2',null,teacher)).status,403);
  });
  await t.test('the board ranks a student who got everything wrong ahead of one with strong work',async()=>{
   const r=await req('support',null,teacher);assert.equal(r.status,200);
   const weak=r.value.students.find(x=>x.id==='student2');assert.ok(weak,'student2 is on the board');
   assert.equal(weak.status,'needs_support');assert.ok(weak.flags.some(f=>f.code==='struggling'));assert.ok(weak.reasons.length>0);
   assert.equal(r.value.students[0].status,'needs_support');
   assert.equal(r.value.counts.needs_support>=1,true);assert.equal(r.value.reteach.length>=1,true);
   assert.ok(!r.value.students.some(x=>x.id==='outside'),'other classes never appear');
   const one=await req('support?student=student2',null,teacher);assert.equal(one.status,200);assert.equal(one.value.student.id,'student2');
   assert.equal((await req('support?student=outside',null,teacher)).status,404);
  });
  await t.test('only the administrator changes the rules, and they are validated',async()=>{
   assert.equal((await req('support-settings',{bands:{developing:50,proficient:70,mastered:85}},teacher)).status,403);
   assert.equal((await req('support-settings',{bands:{developing:80,proficient:70,mastered:85}},admin)).status,400);
   const ok=await req('support-settings',{bands:{developing:95,proficient:97,mastered:99}},admin);assert.equal(ok.status,200);assert.equal(ok.value.settings.bands.developing,95);
   assert.equal((await req('support-settings',null,teacher)).value.settings.bands.developing,95);
  });
 await t.test('skills: staff add to a subject list without duplicates; students cannot; admin can remove',async()=>{
   assert.equal((await req('skills',null,student)).status,403);
   const a=await req('skills',{name:'  Adding   fractions '},teacher);assert.equal(a.status,200);assert.deepEqual(a.value.skills,['Adding fractions']);
   const b=await req('skills',{name:'adding fractions'},teacher);assert.deepEqual(b.value.skills,['Adding fractions']);
   assert.equal((await req('skills',{name:'Adding fractions',remove:true},teacher)).status,403);
   const c=await req('skills',{name:'Adding fractions',remove:true},admin);assert.deepEqual(c.value.skills,[]);
  });
 await t.test('a skill tag is saved with the question, cleaned, and read back; an empty tag is dropped',async()=>{
   const q=(id,skill)=>({id,prompt:'Evaluate 2 + 3.',kind:'numeric',answer:'5',explanation:'Add.',...(skill!==undefined?{skill}:{})});
   const week={id:9,title:'Tagging',subtitle:'x',reflectionPrompt:'?',lessons:[{id:'9-first',title:'Adding',explain:'Combine.',questions:[q('a','  Adding fractions  '),q('b',''),q('c')]}],quiz:[q('qa','Ratios')]};
   const saved=await req('weekly-template',{week,publish:false},teacher);assert.equal(saved.status,200);
   const back=await req('weekly-template?week=9',null,teacher);const w=back.value.draft?.week||back.value.published;
   const qs=w.lessons[0].questions;assert.equal(qs.find(x=>x.id==='a').skill,'Adding fractions');assert.ok(!('skill' in qs.find(x=>x.id==='b')));assert.ok(!('skill' in qs.find(x=>x.id==='c')));assert.equal(w.quiz[0].skill,'Ratios');
  });
 }finally{await new Promise(r=>{if(server.exitCode!==null)return r();server.once('exit',r);server.kill();});}
});
