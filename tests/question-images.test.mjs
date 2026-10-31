import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

// 1x1 PNG
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==','base64');

test('question pictures: need alt text, stay in their class, reach students only after release',async()=>{
 const dir=path.resolve('test-results','question-images-'+Date.now());fs.mkdirSync(dir,{recursive:true});
 const env={...process.env,DATA_DIR:dir,PORT:'0',NODE_ENV:'test',DEMO_PASSWORD:'Learn@2026!'};
 let root='',output='';const server=spawn(process.execPath,['--experimental-sqlite','server.mjs'],{env,stdio:['ignore','pipe','pipe']});server.stdout.on('data',b=>{output+=b;root=output.match(/ready at (\S+)/)?.[1]||root;});server.stderr.on('data',b=>{output+=b;});
 try{
  for(let i=0;i<150&&!root;i++)await new Promise(r=>setTimeout(r,100));assert(root,output);
  const req=async(route,data,s={})=>{const r=await fetch(root+'/api/'+route,{method:data?'POST':'GET',headers:{Cookie:s.cookie||'','X-CSRF-Token':s.csrf||'','Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})});const cookie=(r.headers.get('set-cookie')||'').split(';')[0];let value=null;try{value=await r.json();}catch{}return {status:r.status,value,cookie};};
  const login=async role=>{const r=await req('login',{email:role+'@olawaleslab.school',password:'Learn@2026!'});assert.equal(r.status,200);return {cookie:r.cookie,csrf:r.value.csrf};};
  const teacher=await login('teacher'),student=await login('student');
  const upload=async()=>{const t=await req('upload-token',{purpose:'lesson-image'},teacher);assert.equal(t.status,200,JSON.stringify(t.value));const r=await fetch(root+t.value.url,{method:'PUT',headers:{Cookie:teacher.cookie,'X-CSRF-Token':teacher.csrf,'Content-Type':'image/png'},body:PNG});const out=await r.text();assert.equal(r.status,200,out);return JSON.parse(out).id;};
  const note=text=>({schemaVersion:1,blocks:[{id:'b1',type:'paragraph',text}]});
  const now=(await req('weekly-template?week=30',null,teacher)).value;
  const pub=await req('weekly-template',{week:{id:30,title:'Week 30',subtitle:'',lessons:[{id:'30-a',title:'Lesson a',minutes:10,document:note('Hello'),questions:[]}],quiz:[]},assignments:[],publish:true,release:{mode:'NOW',lessons:['30-a']},...(now.published?{revision:now.revision,draftRevision:now.draftRevision}:{})},teacher);
  assert.equal(pub.status,200,JSON.stringify(pub.value));
  const fileId=await upload();
  const q=(image)=>({id:'iq1',prompt:'Read the value from the diagram.',kind:'numeric',answer:'12',explanation:'From the diagram.',marks:1,...(image?{image}:{})});
  const save=a=>req('assignment-save',{assignment:a},teacher);
  const base={week:30,title:'Diagram work',scope:'GENERAL',lessons:[],mode:'ONLINE',autoGrade:'IMMEDIATE',max:10,instructions:'Look at the picture.'};
  const draft=await save({...base,questions:[q({fileId,alt:'A bar chart'})]});assert.equal(draft.status,200,JSON.stringify(draft.value));
  assert.equal(draft.value.assignment.questions[0].image.fileId,fileId);
  const id=draft.value.assignment.id;

  // Missing alt text blocks release; a stranger's file id is refused.
  const noAlt=await save({...base,id,questions:[q({fileId,alt:''})]});
  assert.equal((await req('assignment-release',{id,status:'PUBLISHED',due:'2099-01-01'},teacher)).status,400,'alt text is required');
  const bogus=await save({...base,id,questions:[q({fileId:'not-a-file',alt:'x'})]});
  assert.equal((await req('assignment-release',{id,status:'PUBLISHED',due:'2099-01-01'},teacher)).status,400,'unknown picture refused');
  assert.equal((await save({...base,id,questions:[q({fileId,alt:'A bar chart'})]})).status,200);

  // Locked: the student cannot fetch the picture. Released: the picture loads and the question carries it.
  const fetchImg=async who=>fetch(root+'/api/media/'+fileId,{headers:{Cookie:who.cookie}});
  assert.equal((await fetchImg(student)).status,404,'hidden while locked');
  assert.equal((await req('assignment-release',{id,status:'PUBLISHED',due:'2099-01-01'},teacher)).status,200);
  const res=await fetchImg(student);assert.equal(res.status,200,'visible once released');assert.equal(res.headers.get('content-type'),'image/png');
  const listed=(await req('state',null,student)).value.assignments.find(a=>a.id===id);
  assert.deepEqual(listed.questions[0].image,{fileId,alt:'A bar chart'});
  assert.equal(listed.questions[0].answer,undefined,'answers stay hidden');

  // Copy gives the new class its own file record.
  const copy=await req('assignment-copy',{id,targets:[{class:'SS1',subject:'Mathematics',term:1,week:30}]},teacher);
  assert.equal(copy.status,200,JSON.stringify(copy.value));
 }finally{server.kill();}
});
