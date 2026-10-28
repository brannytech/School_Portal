import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

// One release model: every subtopic has its own state, chosen in the Publish step.
test('Publish releases chosen subtopics now, on a date, locked or as draft; missing questions only warn',async()=>{
 const dir=path.resolve('test-results','release-model-'+Date.now());fs.mkdirSync(dir,{recursive:true});
 const env={...process.env,DATA_DIR:dir,PORT:'0',NODE_ENV:'test',DEMO_PASSWORD:'Learn@2026!'};
 let server,root='',output='';
 server=spawn(process.execPath,['--experimental-sqlite','server.mjs'],{env,stdio:['ignore','pipe','pipe']});server.stdout.on('data',b=>{output+=b;root=output.match(/ready at (http:\/\/127\.0\.0\.1:\d+)/)?.[1]||'';});server.stderr.on('data',b=>output+=b);
 try{
  for(let i=0;i<150&&!root;i++)await new Promise(r=>setTimeout(r,100));assert(root,output);
  const req=async(route,data,s={})=>{const r=await fetch(root+'/api/'+route,{method:data?'POST':'GET',headers:{Cookie:s.cookie||'','X-CSRF-Token':s.csrf||'','Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})});return {status:r.status,value:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};};
  const login=async role=>{const r=await req('login',{email:role+'@olawaleslab.school',password:'Learn@2026!'});assert.equal(r.status,200);return {cookie:r.cookie,csrf:r.value.csrf};};
  const teacher=await login('teacher'),student=await login('student');
  const note=text=>({schemaVersion:1,blocks:[{id:'b'+Math.random().toString(36).slice(2,8),type:'paragraph',text}]});
  const lesson=(id,title,text)=>({id:'12-'+id,title,minutes:15,document:note(text),questions:[]});
  const week=(...lessons)=>({id:12,title:'Release model',subtitle:'',lessons,quiz:[]});
  const canOpen=async id=>(await req('lesson/'+id,null,student)).status===200;
  const releases=async()=>(await req('weekly-template?week=12',null,teacher)).value.releases;

  const first=await req('weekly-template',{week:week(lesson('a','Alpha','First note.'),lesson('b','Beta','Second note.')),assignments:[],publish:true,release:{mode:'NOW',lessons:['12-a']}},teacher);
  assert.equal(first.status,200,JSON.stringify(first.value));
  assert(first.value.warnings.some(w=>/Alpha: no practice questions/.test(w)),'missing questions are a warning');
  assert(first.value.warnings.some(w=>/weekly quiz/.test(w)));
  assert.deepEqual(first.value.released,['12-a']);
  assert.equal(await canOpen('12-a'),true,'a note-only subtopic publishes and opens');
  assert.equal(await canOpen('12-b'),false,'subtopics that were not chosen stay hidden');
  let r=await releases();assert.equal(r['12-a'].status,'UNLOCKED');assert.equal(r['12-b'].status,'DRAFT');

  const current=(await req('weekly-template?week=12',null,teacher)).value;
  const second=await req('weekly-template',{week:current.published,assignments:[],publish:true,revision:current.revision,draftRevision:current.draftRevision,release:{mode:'LOCKED',lessons:['12-b']}},teacher);
  assert.equal(second.status,200,JSON.stringify(second.value));
  assert.equal(await canOpen('12-a'),true,'publishing another subtopic does not change an already live one');
  assert.equal(await canOpen('12-b'),false,'locked');
  r=await releases();assert.equal(r['12-b'].status,'LOCKED');

  const bad=async(release,pattern)=>{const x=(await req('weekly-template?week=12',null,teacher)).value;const y=await req('weekly-template',{week:x.published,assignments:[],publish:true,revision:x.revision,draftRevision:x.draftRevision,release},teacher);assert.equal(y.status,400,JSON.stringify(y.value));assert.match(y.value.error,pattern);};
  await bad({mode:'SOMETIME'},/publish now, schedule/i);
  await bad({mode:'SCHEDULED'},/valid release date/i);

  const future=new Date(Date.now()+864e5).toISOString();
  let x=(await req('weekly-template?week=12',null,teacher)).value;
  assert.equal((await req('weekly-template',{week:x.published,assignments:[],publish:true,revision:x.revision,draftRevision:x.draftRevision,release:{mode:'SCHEDULED',releaseAt:future,lessons:['12-b']}},teacher)).status,200);
  assert.equal(await canOpen('12-b'),false,'a future schedule is not open yet');
  r=await releases();assert.equal(r['12-b'].status,'SCHEDULED');assert.equal(r['12-b'].available,false);
  const past=new Date(Date.now()-6e4).toISOString();
  x=(await req('weekly-template?week=12',null,teacher)).value;
  assert.equal((await req('weekly-template',{week:x.published,assignments:[],publish:true,revision:x.revision,draftRevision:x.draftRevision,release:{mode:'SCHEDULED',releaseAt:past,lessons:['12-b']}},teacher)).status,200);
  assert.equal(await canOpen('12-b'),true,'a schedule whose time has arrived opens');

  // An unfinished subtopic elsewhere in the week must not block releasing a finished one.
  x=(await req('weekly-template?week=12',null,teacher)).value;
  const withDraft=structuredClone(x.published);withDraft.lessons.push({id:'12-c',title:'',minutes:10,document:{schemaVersion:1,blocks:[]},questions:[]});
  const ok=await req('weekly-template',{week:withDraft,assignments:[],publish:true,revision:x.revision,draftRevision:x.draftRevision,release:{mode:'NOW',lessons:['12-a']}},teacher);
  assert.equal(ok.status,200,JSON.stringify(ok.value));
  r=await releases();assert.equal(r['12-c'].status,'DRAFT');assert.equal(await canOpen('12-c'),false);
  x=(await req('weekly-template?week=12',null,teacher)).value;
  const empty=await req('weekly-template',{week:x.published,assignments:[],publish:true,revision:x.revision,draftRevision:x.draftRevision,release:{mode:'NOW',lessons:['12-c']}},teacher);
  assert.equal(empty.status,400);assert.match(empty.value.error,/needs a title and learning content/);
 }finally{await new Promise(r=>{server.once('exit',r);server.kill();});}
});
