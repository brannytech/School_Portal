import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

test('Weekly templates, end-of-topic activities and controlled assignments',async t=>{
 const dir=path.resolve('test-results','weekly-content-'+Date.now());fs.mkdirSync(dir,{recursive:true});
 const env={...process.env,DATA_DIR:dir,PORT:'0',NODE_ENV:'test',DEMO_PASSWORD:'Learn@2026!'};
 let server,root='',output='';
 async function start(){root='';output='';server=spawn(process.execPath,['--experimental-sqlite','server.mjs'],{env,stdio:['ignore','pipe','pipe']});server.stdout.on('data',b=>{output+=b;root=output.match(/ready at (http:\/\/127\.0\.0\.1:\d+)/)?.[1]||'';});server.stderr.on('data',b=>output+=b);for(let i=0;i<150&&!root;i++)await new Promise(r=>setTimeout(r,100));assert(root,output);}
 async function stop(){if(server?.exitCode!==null)return;await new Promise(r=>{server.once('exit',r);server.kill();});}
 async function req(route,data,session={}){const r=await fetch(root+'/api/'+route,{method:data?'POST':'GET',headers:{Cookie:session.cookie||'','X-CSRF-Token':session.csrf||'','Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})});return {status:r.status,value:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
 async function login(role){const r=await req('login',{email:role+'@olawaleslab.school',password:'Learn@2026!'});assert.equal(r.status,200);return {cookie:r.cookie,csrf:r.value.csrf};}
 // Mathematical fixture answers are calculated rather than handwritten.
 const q=(id,a,b)=>({id,prompt:`Evaluate ${a} + ${b}.`,kind:'numeric',answer:String(a+b),explanation:`Add ${a} and ${b} to get ${a+b}.`});
 const week={id:9,title:'Addition and checking',subtitle:'A weekly teaching fixture',reflectionPrompt:'What helped you check your sums?',lessons:[{id:'9-first',title:'Adding small numbers',objectives:['Add and check.'],explain:'Combine both quantities, then check by counting.',realLife:'Counting items in a basket.',summary:['Check your total.'],videoUrl:'https://www.youtube.com/watch?v=dQw4w9WgXcQ',questions:[q('a',2,3),q('b',4,5)]},{id:'9-second',title:'Checking the total',explain:'Reverse the order to check the same total.',questions:[q('c',3,2)]}],quiz:[q('weekly-a',6,2),q('weekly-b',7,1)]};
 const task=(title,status)=>({title,instructions:'Show each step of your working.',due:'2030-11-01T17:00:00+01:00',workDate:'2030-10-30',max:10,status});
 let teacher,student,admin,assignment,publishedRevision;
 try{
  await start();teacher=await login('teacher');student=await login('student');admin=await login('admin');
  await t.test('Drafts are private and cannot replace live content',async()=>{
   assert.equal((await req('weekly-template?week=9',null,student)).status,403);
   assert.equal((await req('weekly-template?week=9&class=SS2',null,teacher)).status,403);
   assert.equal((await req('weekly-template',{week,publish:true,assignments:[]},student)).status,403);
   assert.equal((await req('weekly-template',{week:{...week,title:'Private draft',lessons:[{title:''}]},publish:false},teacher)).status,200);
   assert((await req('weekly-template?week=9',null,teacher)).value.draft);
   assert(!(await req('state',null,student)).value.weeks.some(w=>w.id===9));
  });
  await t.test('Publish only the selected week, embed valid videos and withhold answer keys',async()=>{
   const before=(await req('course',null,teacher)).value;
   const invalid=structuredClone(week);invalid.lessons[0].videoUrl='https://evil.example/video';assert.equal((await req('weekly-template',{week:invalid,publish:true,assignments:[]},teacher)).status,400);
   assert.equal((await req('weekly-template',{week,publish:true,assignments:[task('First task','PUBLISHED'),task('Later task','LOCKED'),task('Private task','DRAFT')]},teacher)).status,200);
   const after=(await req('course',null,teacher)).value;assert.deepEqual(after.filter(w=>w.id!==9),before);
   const state=(await req('state',null,student)).value,w=state.weeks.find(w=>w.id===9);assert.equal(w.closingAvailable,true);assert.equal(w.quizCount,2);assert(!JSON.stringify(w).includes('weekly-a'));assert.deepEqual(w.lessons.map(l=>l.title),week.lessons.map(l=>l.title));
   const lesson=(await req('lesson/9-first',null,student)).value;assert.equal(lesson.videoUrl,week.lessons[0].videoUrl);assert(!('answer' in lesson.questions[0]));assert.deepEqual(lesson.quiz,[]);
   assert(!state.assignments.some(a=>a.title==='Private task'));assert(!('instructions' in state.assignments.find(a=>a.title==='Later task')));
   assignment=state.assignments.find(a=>a.title==='First task');assert.equal(assignment.workDate,'2030-10-30');assert.equal(assignment.due,'2030-11-01T17:00:00+01:00');
   const info=(await req('weekly-template?week=9',null,teacher)).value;publishedRevision=info.revision;assert.equal(info.draft,null);
  });
  await t.test('One quiz and reflection cover the whole week and cannot bypass a locked subtopic',async()=>{
   await req('lesson-release',{lesson:'9-second',status:'LOCKED'},teacher);
   assert.equal((await req('assessment/start',{kind:'weekly',week:9},student)).status,403);
   assert.equal((await req('week-reflection',{week:9,learnt:'A sum combines quantities.',question:'None for now'},student)).status,403);
   await req('lesson-release',{lesson:'9-second',status:'UNLOCKED'},teacher);
   const started=(await req('assessment/start',{kind:'weekly',week:9},student)).value;assert.equal(started.questions.length,2);assert(!('answer' in started.questions[0]));
   const answers=Object.fromEntries(week.quiz.map(q=>[q.id,q.answer]));const graded=await req('assessment/submit',{id:started.id,answers},student);assert.equal(graded.value.percentage,100);
   for(let i=0;i<2;i++)assert.equal((await req('week-reflection',{week:9,learnt:'I can add and check totals.',question:'None for now'},student)).status,200);
   const summary=(await req('my-progress?week=9',null,student)).value.detail;assert.equal(summary.categories.quizzes.done,1);assert.equal(summary.categories.quizzes.total,1);assert.equal(summary.categories.reflections.done,1);assert.equal(summary.categories.reflections.total,1);assert(!('mastery' in summary.categories));assert.equal(summary.categories.assignments.total,1);assert.equal(summary.done,2);assert.equal(summary.total,8);
   assert.equal((await req('state',null,student)).value.reflections.filter(r=>r.scope==='week'&&r.week===9).length,1);
  });
  await t.test('Assignments release independently, hide drafts and enforce locked submission',async()=>{
   const staffState=(await req('state',null,teacher)).value,locked=staffState.assignments.find(a=>a.title==='Later task');
   const token=(await req('upload-token',{purpose:'assignment'},student)).value,png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aG9sAAAAASUVORK5CYII=','base64');
   const upload=await fetch(root+token.url,{method:'PUT',headers:{Cookie:student.cookie,'X-CSRF-Token':student.csrf},body:png});const file=(await upload.json()).id;
   assert.equal((await req('submit',{kind:'assignment',assignment:locked.id,files:[file]},student)).status,403);
   assert.equal((await req('assignment-save',{...locked,status:'PUBLISHED'},student)).status,403);
   assert.equal((await req('assignment-save',{...locked,status:'PUBLISHED'},teacher)).status,200);
   assert.equal((await req('submit',{kind:'assignment',assignment:locked.id,files:[file]},student)).status,201);
   assert.equal((await req('my-progress?week=9',null,student)).value.detail.categories.assignments.total,2);
   const scheduled=await req('assignment-save',{...task('Scheduled task','SCHEDULED'),week:9,releaseAt:'2099-01-01T10:00:00+01:00'},teacher);assert.equal(scheduled.status,200);
   const waiting=(await req('state',null,student)).value.assignments.find(a=>a.id===scheduled.value.id);assert.equal(waiting.available,false);assert(!('instructions' in waiting));
   assert.equal((await req('assignment-save',{...task('Invalid schedule','SCHEDULED'),week:9,releaseAt:'not-a-date'},teacher)).status,400);
  });
  await t.test('Editing one week retains records and subtopic order across restart',async()=>{
   await req('content-read',{lesson:'9-first'},student);await req('practice',{lesson:'9-first',question:'a',answer:'5'},student);
   const changed=structuredClone(week);changed.title='Addition, reviewed';changed.lessons.reverse();
   assert.equal((await req('weekly-template',{week:changed,assignments:[],publish:true,revision:'stale'},teacher)).status,409);
   assert.equal((await req('weekly-template',{week:changed,assignments:[],publish:true,revision:publishedRevision},teacher)).status,200);
   await stop();await start();const state=(await req('state',null,student)).value;
   assert.deepEqual(state.weeks.find(w=>w.id===9).lessons.map(l=>l.id),['9-second','9-first']);assert(state.progress.find(p=>p.lesson==='9-first')?.contentConsumedAt);assert(state.practiceAttempts.some(a=>a.lesson==='9-first'&&a.question==='a'));
   assert.equal((await req('my-progress?week=9',null,student)).value.detail.categories.quizzes.done,1);
   assert.equal((await req('weekly-template?week=9',null,admin)).value.published.title,'Addition, reviewed');
  });
 }finally{await stop();}
});
