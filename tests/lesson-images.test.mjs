import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import zlib from 'node:zlib';

const chunk=(type,data)=>{const body=Buffer.concat([Buffer.from(type),data]),out=Buffer.alloc(12+data.length);out.writeUInt32BE(data.length,0);body.copy(out,4);out.writeUInt32BE(zlib.crc32(body),8+data.length);return out;};
function png(){const header=Buffer.alloc(13);header.writeUInt32BE(1,0);header.writeUInt32BE(1,4);header[8]=8;header[9]=2;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(Buffer.from([0,200,30,30]))),chunk('IEND',Buffer.alloc(0))]);}

test('Lesson images: teachers upload, alt text is required, students see only images in released lessons',async()=>{
 const dir=path.resolve('test-results','lesson-images-'+Date.now());fs.mkdirSync(dir,{recursive:true});
 const env={...process.env,DATA_DIR:dir,PORT:'0',NODE_ENV:'test',DEMO_PASSWORD:'Learn@2026!'};
 let root='',output='';const server=spawn(process.execPath,['--experimental-sqlite','server.mjs'],{env,stdio:['ignore','pipe','pipe']});server.stdout.on('data',b=>{output+=b;root=output.match(/ready at (http:\/\/127\.0\.0\.1:\d+)/)?.[1]||'';});server.stderr.on('data',b=>output+=b);
 try{
  for(let i=0;i<150&&!root;i++)await new Promise(r=>setTimeout(r,100));assert(root,output);
  const raw=async(route,{method='GET',session={},body,type='application/json'}={})=>fetch(root+'/api/'+route,{method,headers:{Cookie:session.cookie||'','X-CSRF-Token':session.csrf||'','Content-Type':type},body});
  const req=async(route,data,s={})=>{const r=await raw(route,{method:data?'POST':'GET',session:s,body:data?JSON.stringify(data):undefined});return {status:r.status,value:await r.json().catch(()=>null)};};
  const login=async role=>{const r=await raw('login',{method:'POST',body:JSON.stringify({email:role+'@olawaleslab.school',password:'Learn@2026!'})});const v=await r.json();return {cookie:r.headers.get('set-cookie').split(';')[0],csrf:v.csrf};};
  const teacher=await login('teacher'),student=await login('student');
  const upload=async(session,bytes)=>{const t=await req('upload-token',{purpose:'lesson-image'},session);if(t.status!==200)return t;const r=await raw(t.value.url.replace('/api/',''),{method:'PUT',session,body:bytes,type:'application/octet-stream'});return {status:r.status,value:await r.json()};};

  assert.equal((await upload(student,png())).status,403,'students cannot upload lesson images');
  const bad=await upload(teacher,Buffer.from('not an image at all'));assert.equal(bad.status,400);
  const up=await upload(teacher,png());assert.equal(up.status,200);const id=up.value.id;

  const image=extra=>({id:'img1',type:'image',fileId:id,alt:'A red square',caption:'Figure 1',width:'medium',align:'center',...extra});
  const week=blocks=>({id:14,title:'Images',lessons:[{id:'14-a',title:'Pictures',minutes:10,document:{schemaVersion:1,blocks},questions:[]}],quiz:[]});
  const save=async(blocks,release={mode:'DRAFT'})=>{const x=(await req('weekly-template?week=14',null,teacher)).value;return req('weekly-template',{week:week(blocks),assignments:[],publish:true,revision:x.revision,draftRevision:x.draftRevision,release},teacher);};

  assert.equal((await raw('media/'+id,{session:student})).status,404,'an image in no lesson is hidden from students');
  assert.equal((await raw('media/'+id,{session:teacher})).status,200,'the teacher can always preview it');

  let r=await save([image({alt:'   '})]);assert.equal(r.status,400);assert.match(r.value.error,/alternative text/i);
  r=await save([image({alt:'',decorative:true})]);assert.equal(r.status,200,JSON.stringify(r.value));
  r=await save([image({fileId:'does-not-exist-1'})]);assert.equal(r.status,400,'unknown image id is refused');
  r=await save([image({width:'huge'})]);assert.equal(r.status,400);

  r=await save([image()]);assert.equal(r.status,200,JSON.stringify(r.value));
  assert.equal((await raw('media/'+id,{session:student})).status,404,'a draft lesson does not reveal its images');
  const current=(await req('weekly-template?week=14',null,teacher)).value;
  r=await req('weekly-template',{week:current.published,assignments:[],publish:true,revision:current.revision,draftRevision:current.draftRevision,release:{mode:'NOW'}},teacher);assert.equal(r.status,200,JSON.stringify(r.value));
  const shown=await raw('media/'+id,{session:student});assert.equal(shown.status,200);assert.equal(shown.headers.get('content-type'),'image/png');assert.match(shown.headers.get('cache-control'),/private/);
  const lesson=(await req('lesson/14-a',null,student)).value;assert.equal(lesson.document.blocks[0].type,'image');assert.equal(lesson.document.blocks[0].alt,'A red square');
  assert.equal((await raw('media/'+id)).status,401,'anonymous visitors are refused');
 }finally{await new Promise(r=>{server.once('exit',r);server.kill();});}
});
