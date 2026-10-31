import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {contentRevision} from '../lesson-document.mjs';

test('Phase 1: documents, conflicts, legacy preservation and recovery through real HTTP/SQLite',async t=>{
 const directory=path.resolve('test-results','phase-1-content-'+Date.now());fs.mkdirSync(directory,{recursive:true});
 const env={...process.env,DATA_DIR:directory,DATABASE_URL:'',STORAGE_DRIVER:'local',NODE_ENV:'test',DEMO_PASSWORD:'Content-test-password!',PORT:'0'};
 let server,root='',logs='',teacher,student,baseline,draft,revision,draftRevision,attempt;
 async function start(){root='';logs='';server=spawn(process.execPath,['--experimental-sqlite','server.mjs'],{env,stdio:['ignore','pipe','pipe']});server.stdout.on('data',bytes=>{logs+=bytes;root=logs.match(/ready at (http:\/\/127\.0\.0\.1:\d+)/)?.[1]||'';});server.stderr.on('data',bytes=>logs+=bytes);for(let i=0;i<150&&!root&&server.exitCode===null;i++)await new Promise(r=>setTimeout(r,100));assert(root,logs);}
 async function stop(){if(server&&server.exitCode===null)await new Promise(resolve=>{server.once('exit',resolve);server.kill();});}
 async function req(route,data,session={}){const response=await fetch(root+'/api/'+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json',Cookie:session.cookie||'','X-CSRF-Token':session.csrf||''},...(data?{body:JSON.stringify(data)}:{})});return {status:response.status,value:await response.json(),revision:response.headers.get('X-Content-Revision'),cookie:response.headers.get('set-cookie')?.split(';')[0]};}
 async function login(role){const response=await req('login',{email:role+'@olawaleslab.school',password:env.DEMO_PASSWORD});assert.equal(response.status,200);return {cookie:response.cookie,csrf:response.value.csrf};}
 const document={schemaVersion:1,blocks:[{id:'intro',type:'heading',level:2,text:'Quadratic equations'},{id:'body',type:'paragraph',text:'<script> is displayed as plain text.'},{id:'formula',type:'equation',latex:'x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}',displayMode:true},{id:'values',type:'table',caption:'Values',headers:['x','y'],rows:[['1','-4']]},{id:'sum',type:'summary',items:['Check your signs.']}]};
 const q=id=>({id,prompt:'Evaluate 1 + 1.',kind:'numeric',answer:'2',explanation:'One plus one is two.',objective:'addition',proof:{operation:'sum',args:[1,1]}});
 const week={id:9,title:'Structured teaching fixture',customWeek:{keep:true},lessons:[{title:'Structured subtopic',explain:'Original fallback',document,customLesson:{keep:true},privateArchive:{answer:'DO-NOT-SEND'},questions:Array.from({length:12},(_,i)=>q('practice-'+i)),objectives:['Read the formula'],realLife:'Counting',summary:['Check']}],quiz:Array.from({length:10},(_,i)=>q('quiz-'+i))};
 try{
  await start();teacher=await login('teacher');student=await login('student');baseline=(await req('course',null,teacher)).value;
  await t.test('Draft and publish validation fails closed, with role/scope/CSRF enforcement',async()=>{
   assert.equal((await req('weekly-template',{week},student)).status,403);
   assert.equal((await req('weekly-template',{week,class:'SS2'},teacher)).status,403);
   assert.equal((await req('weekly-template',{week},{cookie:teacher.cookie,csrf:'wrong'})).status,403);
   for(const bad of [null,{schemaVersion:2,blocks:[]},{schemaVersion:1,blocks:[{id:'secret',type:'quiz',answer:'hidden'}]}]){
    const input=structuredClone(week);input.lessons[0].document=bad;
    for(const publish of [false,true])assert.equal((await req('weekly-template',{week:input,assignments:[],publish},teacher)).status,400);
   }
   assert.equal((await req('weekly-template?week=9',null,teacher)).value.draft,null);
   assert.equal(contentRevision((await req('course',null,teacher)).value),contentRevision(baseline));
  });
  await t.test('Draft IDs and incomplete legacy drafts survive save/reopen/restart without changing published content',async()=>{
   const response=await req('weekly-template',{week,assignments:[],publish:false},teacher);assert.equal(response.status,200,response.value.error);
   draft=response.value.week;draftRevision=response.value.draftRevision;assert(draft.lessons[0].id.startsWith('9-'));assert.equal(response.value.revision,null);
   assert.equal((await req('lesson/'+draft.lessons[0].id,null,student)).status,403);
   assert(!(await req('state',null,student)).value.weeks.some(w=>w.id===9));
   await stop();await start();const loaded=(await req('weekly-template?week=9',null,teacher)).value;
   assert.deepEqual(loaded.draft.week,draft);assert.equal(loaded.draftRevision,draftRevision);
   assert.equal(contentRevision((await req('course',null,teacher)).value),contentRevision(baseline));
   const incomplete={id:10,title:'',lessons:[{title:'',questions:[{}]}],quiz:[{}]};
   const saved=await req('weekly-template',{week:incomplete},teacher);assert.equal(saved.status,200);assert(saved.value.week.lessons[0].questions[0].id);
  });
  await t.test('Independent draft revisions prevent stale and omitted-token saves or publication',async()=>{
   const saved=await req('weekly-template',{week:draft,draftRevision,publish:false},teacher);assert.equal(saved.status,200);
   assert.equal((await req('weekly-template',{week:draft,draftRevision,publish:false},teacher)).status,409);
   assert.equal((await req('weekly-template',{week:draft,publish:true,assignments:[]},teacher)).status,409);
   draftRevision=saved.value.draftRevision;
   const published=await req('weekly-template',{week:draft,draftRevision,publish:true,assignments:[]},teacher);assert.equal(published.status,200,published.value.error);revision=published.value.revision;
   assert.equal((await req('weekly-template',{week:draft,draftRevision,publish:false},teacher)).status,409);
   const safe=(await req('lesson/'+draft.lessons[0].id,null,student)).value;
   assert.deepEqual(safe.document,document);assert(!('privateArchive'in safe));assert(!('customLesson'in safe));assert(!('answer'in safe.questions[0]));assert(!JSON.stringify(safe).includes('DO-NOT-SEND'));
  });
  await t.test('Republishing preserves unknown legacy fields, old attempt snapshots and published revision conflicts',async()=>{
   await stop();await start();assert.equal((await req('weekly-template?week=9',null,teacher)).value.revision,revision,'restart must not create a false conflict');
   attempt=(await req('assessment/start',{kind:'weekly',week:9},student)).value;
   assert(!('answer'in attempt.questions[0]));
   const changed=structuredClone(draft);changed.lessons[0].questions[0].answer='3';changed.title='Reviewed';
   assert.equal((await req('weekly-template',{week:changed,revision:'stale',publish:true,assignments:[]},teacher)).status,409);
   assert.equal((await req('weekly-template',{week:changed,publish:true,assignments:[]},teacher)).status,409);
   // Simulate a reduced older client: omitted properties must survive server-side merge.
   delete changed.customWeek;delete changed.lessons[0].customLesson;delete changed.lessons[0].privateArchive;delete changed.lessons[0].document;
   const saved=await req('weekly-template',{week:changed,revision,publish:true,assignments:[]},teacher);assert.equal(saved.status,200,saved.value.error);revision=saved.value.revision;
   const published=(await req('weekly-template?week=9',null,teacher)).value.published;
   assert.deepEqual(published.customWeek,{keep:true});assert.deepEqual(published.lessons[0].customLesson,{keep:true});assert.deepEqual(published.lessons[0].document,document);
   const staleText=structuredClone(published);staleText.lessons[0].explain='Stale replacement';
   assert.equal((await req('weekly-template',{week:staleText,revision,publish:true,assignments:[]},teacher)).status,409);
   const result=await req('assessment/submit',{id:attempt.id,answers:Object.fromEntries(attempt.questions.map(q=>[q.id,'2']))},student);assert.equal(result.value.percentage,100);
   assert.equal(contentRevision((await req('course',null,teacher)).value.filter(w=>w.id!==9)),contentRevision(baseline));
  });
  await t.test('Weekly publication requires the current revision and invalidates stale draft bases',async()=>{
   const info=(await req('weekly-template?week=9',null,teacher)).value;
   const saved=await req('weekly-template',{week:info.published,revision:info.revision,publish:false},teacher);assert.equal(saved.status,200);
   draftRevision=saved.value.draftRevision;const oldBase=info.revision;
   const valid=await req('weekly-template',{week:{...info.published,title:info.published.title+' (revised)'},revision:info.revision,draftRevision,publish:true,assignments:[]},teacher);assert.equal(valid.status,200,valid.value.error);
   assert.equal((await req('weekly-template',{week:info.published,revision:oldBase,draftRevision,publish:true,assignments:[]},teacher)).status,409);
   await req('lesson-release',{lesson:draft.lessons[0].id,status:'LOCKED'},teacher);assert.equal((await req('lesson/'+draft.lessons[0].id,null,student)).status,403);
   await req('lesson-release',{lesson:draft.lessons[0].id,status:'UNLOCKED'},teacher);
  });
  await t.test('Loading published legacy content can discard blocks introduced only in an abandoned draft',async()=>{
   const info=(await req('weekly-template?week=2',null,teacher)).value;
   const edit=structuredClone(info.published);edit.lessons[0].document=document;
   const saved=await req('weekly-template',{week:edit,revision:info.revision,publish:false},teacher);assert.equal(saved.status,200);
   const published=await req('weekly-template',{week:info.published,revision:info.revision,draftRevision:saved.value.draftRevision,publish:true,assignments:[]},teacher);assert.equal(published.status,200,published.value.error);
   assert.equal((await req('weekly-template?week=2',null,teacher)).value.published.lessons[0].document,undefined);
  });
  await t.test('Structured content, archives and submitted assessments survive actual backup/restore',async()=>{
   await stop();const sql=new DatabaseSync(path.join(directory,'school.sqlite'),{readOnly:true});
   const versions=JSON.parse(sql.prepare("SELECT value FROM app_settings WHERE key='weekVersions'").get().value);
   assert(versions.some(v=>v.week===9&&v.content.lessons[0].customLesson?.keep));
   const originalLesson=sql.prepare('SELECT content FROM lessons WHERE lesson_key=?').get(draft.lessons[0].id).content;sql.close();
   const backup=path.join(directory,'backup'),restored=path.join(directory,'restored');
   const dump=spawnSync(process.execPath,['--experimental-sqlite','scripts/backup.mjs',backup],{env,encoding:'utf8'});assert.equal(dump.status,0,dump.stderr);
   const restore=spawnSync(process.execPath,['--experimental-sqlite','scripts/restore.mjs',backup],{env:{...env,DATA_DIR:restored},encoding:'utf8'});assert.equal(restore.status,0,restore.stderr);
   const recovered=new DatabaseSync(path.join(restored,'school.sqlite'),{readOnly:true});
   assert.equal(recovered.prepare('SELECT content FROM lessons WHERE lesson_key=?').get(draft.lessons[0].id).content,originalLesson);
   assert.equal(recovered.prepare('PRAGMA foreign_key_check').all().length,0);
   assert.equal(JSON.parse(recovered.prepare('SELECT content FROM assessment_attempts WHERE id=?').get(attempt.id).content).percentage,100);
   assert.equal(JSON.parse(recovered.prepare("SELECT value FROM app_settings WHERE key='weekVersions'").get().value).length,versions.length);recovered.close();
   env.DATA_DIR=restored;await start();student=await login('student');assert.deepEqual((await req('lesson/'+draft.lessons[0].id,null,student)).value.document,document);
  });
 }finally{await stop();}
});
