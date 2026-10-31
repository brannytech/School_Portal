import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

test('assignments: linked, general and end-of-week work; locked until released; online work is marked at once',async()=>{
 const dir=path.resolve('test-results','assignments-v2-'+Date.now());fs.mkdirSync(dir,{recursive:true});
 const env={...process.env,DATA_DIR:dir,PORT:'0',NODE_ENV:'test',DEMO_PASSWORD:'Learn@2026!'};
 let root='',output='';const server=spawn(process.execPath,['--experimental-sqlite','server.mjs'],{env,stdio:['ignore','pipe','pipe']});server.stdout.on('data',b=>{output+=b;root=output.match(/ready at (http:\/\/127\.0\.0\.1:\d+)/)?.[1]||'';});server.stderr.on('data',b=>output+=b);
 try{
  for(let i=0;i<150&&!root;i++)await new Promise(r=>setTimeout(r,100));assert(root,output);
  const req=async(route,data,s={})=>{const r=await fetch(root+'/api/'+route,{method:data?'POST':'GET',headers:{Cookie:s.cookie||'','X-CSRF-Token':s.csrf||'','Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})});return {status:r.status,value:await r.json().catch(()=>null),cookie:r.headers.get('set-cookie')?.split(';')[0]};};
  const login=async role=>{const r=await req('login',{email:role+'@olawaleslab.school',password:'Learn@2026!'});assert.equal(r.status,200);return {cookie:r.cookie,csrf:r.value.csrf};};
  const teacher=await login('teacher'),student=await login('student');
  const note=text=>({schemaVersion:1,blocks:[{id:'b'+Math.random().toString(36).slice(2,8),type:'paragraph',text}]});
  const publishWeek=async(id,lessons)=>{const now=(await req('weekly-template?week='+id,null,teacher)).value;const r=await req('weekly-template',{week:{id,title:'Week '+id,subtitle:'',lessons:lessons.map(l=>({id:id+'-'+l,title:'Lesson '+l,minutes:10,document:note('Note '+l),questions:[]})),quiz:[]},assignments:[],publish:true,release:{mode:'NOW',lessons:lessons.map(l=>id+'-'+l)},...(now.published?{revision:now.revision,draftRevision:now.draftRevision}:{})},teacher);assert.equal(r.status,200,JSON.stringify(r.value));};
  await publishWeek(16,['a','b']);await publishWeek(17,['a']);
  const save=(assignment,who=teacher)=>req('assignment-save',{assignment},who);
  const seen=async()=>(await req('bootstrap',null,student)).value;
  const listed=async id=>{const r=await req('state',null,student);return r.value?.assignments?.find(a=>a.id===id);};
  const q1={id:'aq1',prompt:'What is $3\\times4$?',kind:'numeric',answer:'12',explanation:'Three fours.',marks:2};
  const q2={id:'aq2',prompt:'Pick the even numbers',kind:'multi',options:['2','3','4'],answers:['2','4'],explanation:'Divisible by 2.',marks:2};

  // New work starts locked, whatever its scope.
  const photo=await save({week:16,title:'Homework on lesson A',scope:'LESSON',lessons:['16-a'],mode:'PHOTO',max:20,document:note('Solve the exercises in your note and snap a photo.')});
  assert.equal(photo.status,200,JSON.stringify(photo.value));assert.equal(photo.value.assignment.status,'LOCKED');assert.equal(photo.value.assignment.scope,'LESSON');
  const general=await save({week:16,title:'General revision',scope:'GENERAL',lessons:['16-a','16-b'],mode:'PHOTO',max:10,instructions:'Revise both lessons.'});assert.equal(general.status,200,JSON.stringify(general.value));
  const weekEnd=await save({week:16,title:'End of week test',scope:'WEEK_END',mode:'ONLINE',autoGrade:'IMMEDIATE',max:20,questions:[q1,q2],document:note('Answer on the platform.')});assert.equal(weekEnd.status,200,JSON.stringify(weekEnd.value));
  const review=await save({week:16,title:'Teacher-reviewed online',scope:'GENERAL',mode:'ONLINE',autoGrade:'AFTER_REVIEW',max:10,questions:[q1],instructions:'Answer, then wait for your teacher.'});assert.equal(review.status,200);
  const id={photo:photo.value.assignment.id,general:general.value.assignment.id,end:weekEnd.value.assignment.id,review:review.value.assignment.id};

  // Validation.
  assert.equal((await save({week:16,title:'x',scope:'LESSON',lessons:[],instructions:'x'})).status,400,'a lesson assignment needs one subtopic');
  assert.equal((await save({week:16,title:'x',scope:'LESSON',lessons:['17-a'],instructions:'x'})).status,400,'subtopic must belong to the week');
  assert.equal((await save({week:16,title:'',instructions:'x'})).status,400);
  const halfDone=await save({week:16,title:'bad q',mode:'ONLINE',instructions:'x',questions:[{...q1,answer:''}]});
  assert.equal(halfDone.status,200,'half-written questions are kept while the assignment is a draft');
  assert.equal((await req('assignment-release',{id:halfDone.value.assignment.id,status:'PUBLISHED',due:'2099-01-01'},teacher)).status,400,'but cannot be released until complete');
  assert.equal((await req('assignment-delete',{id:halfDone.value.assignment.id},teacher)).status,200);

  // Students see only a locked placeholder until release; nothing can be submitted.
  const locked=await listed(id.end);assert(locked,'students see that the work exists');assert.equal(locked.available,false);assert.equal(locked.questions,undefined);assert.equal(locked.document,undefined);
  assert.equal((await req('assignment-submit',{assignment:id.end,answers:{aq1:'12'}},student)).status,403,'locked work cannot be submitted');

  // Releasing needs a deadline; then students get the work without answers.
  assert.equal((await req('assignment-release',{id:id.end,status:'PUBLISHED'},teacher)).status,400,'a deadline is required to release');
  const due='2099-01-01';
  const rel=await req('assignment-release',{id:id.end,status:'PUBLISHED',due},teacher);assert.equal(rel.status,200,JSON.stringify(rel.value));assert.equal(rel.value.available,true);
  const open=await listed(id.end);assert.equal(open.available,true);assert.equal(open.questions.length,2);
  for(const question of open.questions)for(const secret of ['answer','answers','accepted','explanation'])assert.equal(question[secret],undefined,secret+' must not reach students');
  assert.equal(open.questions[1].marks,2);assert.equal(open.mode,'ONLINE');

  // Online work is marked at once and counts as a mark on the submission.
  const half=await req('assignment-submit',{assignment:id.end,answers:{aq1:'12',aq2:'2'}},student);assert.equal(half.status,201,JSON.stringify(half.value));
  assert.equal(half.value.graded,true);assert.equal(half.value.score,10,'2 of 4 marks on a 20-mark assignment');assert.equal(half.value.percentage,50);
  assert(half.value.results.every(r=>r.explanation!==undefined),'answers are shown after submission when allowed');
  assert.equal((await req('assignment-submit',{assignment:id.end,answers:{aq1:'12',aq2:'2|4'}},student)).status,409,'a second attempt needs resubmission');
  assert.equal((await req('resubmission',{id:id.end,enabled:true},teacher)).status,200);
  const full=await req('assignment-submit',{assignment:id.end,answers:{aq1:'12',aq2:'4|2'}},student);assert.equal(full.value.score,20);
  const state=(await req('state',null,student)).value,mineSub=state.submissions.find(v=>v.assignment===id.end);
  assert.equal(mineSub.score,20);assert.equal(mineSub.status,'Marked');assert.equal(state.submissions.filter(v=>v.assignment===id.end).length,1,'a retake updates the same submission');
  assert.equal((await req('submit',{kind:'assignment',assignment:id.end,files:['x']},student)).status===200,false,'photo upload is not used for online work');

  // Teacher-reviewed online work keeps the score back.
  assert.equal((await req('assignment-release',{id:id.review,status:'PUBLISHED',due},teacher)).status,200);
  const held=await req('assignment-submit',{assignment:id.review,answers:{aq1:'12'}},student);assert.equal(held.value.graded,false);assert.equal(held.value.score,undefined);
  const heldSub=(await req('state',null,student)).value.submissions.find(v=>v.assignment===id.review);assert.equal(heldSub.score,null);assert.equal(heldSub.status,'Submitted');

  // A lesson assignment follows its lesson, and release can be scheduled.
  assert.equal((await req('assignment-release',{id:id.photo,status:'SCHEDULED',releaseAt:new Date(Date.now()+864e5).toISOString(),due},teacher)).status,200);
  assert.equal((await listed(id.photo)).available,false,'scheduled work stays closed until its time');
  assert.equal((await req('assignment-release',{id:id.photo,status:'PUBLISHED',due},teacher)).status,200);
  assert.equal((await listed(id.photo)).available,true);
  assert.equal((await listed(id.photo)).mode,'PHOTO');
  assert.match((await listed(id.photo)).instructions,/snap a photo/,'plain-text instructions are derived from the written document');

  // Copy to another week for reuse; copies start locked with no deadline and no subtopic link.
  const copied=await req('assignment-copy',{id:id.end,targets:[{week:17}]},teacher);assert.equal(copied.status,200,JSON.stringify(copied.value));
  const week17=(await req('assignments?week=17',null,teacher)).value.assignments;assert.equal(week17.length,1);
  assert.equal(week17[0].status,'LOCKED');assert.equal(week17[0].due,'');assert.equal(week17[0].questions.length,2);assert.notEqual(week17[0].id,id.end);assert.equal(week17[0].copiedFrom,id.end);
  assert.equal((await req('assignment-copy',{id:id.end,targets:[{week:30}]},teacher)).status,400,'cannot copy into a week that does not exist');

  // Students cannot manage assignments; assignments with submissions cannot be deleted.
  for(const route of ['assignment-save','assignment-release','assignment-delete','assignment-copy'])assert.equal((await req(route,{id:id.end,assignment:{week:16,title:'x',instructions:'x'}},student)).status,403,route);
  assert.equal((await req('assignment-delete',{id:id.end},teacher)).status,409);
  assert.equal((await req('assignment-delete',{id:id.general},teacher)).status,200);
  assert.equal((await req('assignments?week=16',null,teacher)).value.assignments.some(a=>a.id===id.general),false);
 }finally{await new Promise(r=>{server.once('exit',r);server.kill();});}
});
