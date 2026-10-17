import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

test('Profile photos: initial registration, ownership, validation, persistence and logout',async()=>{
 const directory=path.resolve('test-results','profiles-'+Date.now());fs.mkdirSync(directory,{recursive:true});
 let server,root,output='';
 async function start(){root='';output='';server=spawn(process.execPath,['--experimental-sqlite','server.mjs'],{env:{...process.env,PORT:'0',DATA_DIR:directory,DEMO_PASSWORD:'Learn@2026!',NODE_ENV:'test'},stdio:['ignore','pipe','pipe']});server.stdout.on('data',b=>{output+=b;root=output.match(/ready at (http:\/\/127\.0\.0\.1:\d+)/)?.[1]||'';});server.stderr.on('data',b=>output+=b);for(let i=0;i<100;i++){if(root)return;await new Promise(r=>setTimeout(r,100));}throw Error(output);}
 async function stop(){if(server.exitCode!==null)return;await new Promise(resolve=>{server.once('exit',resolve);server.kill();});}
 async function req(route,data,session={}){const response=await fetch(root+'/api/'+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json',Cookie:session.cookie||'','X-CSRF-Token':session.csrf||''},...(data?{body:JSON.stringify(data)}:{})});return {status:response.status,value:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};}
 async function login(email){const r=await req('login',{email,password:'Learn@2026!'});assert.equal(r.status,200);return {cookie:r.cookie,csrf:r.value.csrf};}
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aG9sAAAAASUVORK5CYII=','base64');
 async function upload(session,query='',bytes=png){return fetch(root+'/api/profile-photo'+query,{method:'PUT',headers:{Cookie:session.cookie,'X-CSRF-Token':session.csrf},body:bytes});}
 try{
  await start();const admin=await login('admin@olawaleslab.school'),student=await login('student@olawaleslab.school'),peer=await login('chisom@olawaleslab.school'),teacher=await login('teacher@olawaleslab.school');
  const account={name:'Photo Learner',email:'photo@test.school',password:'Learn@2026!',class:'SS1',role:'STUDENT',admission:'P-001'};
  assert.equal((await req('add-user',account,student)).status,403);
  assert.equal((await req('add-user',account,admin)).status,400);
  assert.equal((await upload(student,'?newStudent=true')).status,403);
  assert.equal((await upload(teacher,'?student=student')).status,403);
  assert.equal((await upload({...admin,csrf:'wrong'},'?newStudent=true')).status,403);
  assert.equal((await upload(admin,'?newStudent=true',Buffer.from('%PDF-1.7'))).status,400);
  assert.equal((await upload(admin,'?newStudent=true',Buffer.alloc(700*1024+1))).status,413);
  const staged=await upload(admin,'?newStudent=true');assert.equal(staged.status,201);const photo=(await staged.json()).id;
  assert.equal((await fetch(root+'/api/profile-photo/'+photo,{headers:{Cookie:peer.cookie}})).status,404);
  const created=await req('add-user',{...account,photoId:photo},admin);assert.equal(created.status,201);assert.equal(created.value.status,'PENDING');const id=created.value.id;
  assert.equal((await req('add-user',{...account,email:'reuse@test.school',photoId:photo},admin)).status,400);
  assert.equal((await req('login',{email:account.email,password:account.password})).status,403);
  assert.equal((await req('student-status',{id,status:'ACTIVE'},admin)).status,200);const learner=await login(account.email);
  assert.equal((await fetch(root+'/api/profile-photo/'+id)).status,401);
  assert.equal((await fetch(root+'/api/profile-photo/'+id,{headers:{Cookie:peer.cookie}})).status,404);
  assert.equal((await fetch(root+'/api/profile-photo/'+id,{headers:{Cookie:teacher.cookie}})).status,404);
  const image=await fetch(root+'/api/profile-photo/'+id,{headers:{Cookie:learner.cookie}});assert.equal(image.status,200);assert.equal(image.headers.get('content-type'),'image/png');assert.equal(image.headers.get('cache-control'),'no-store');assert.deepEqual(Buffer.from(await image.arrayBuffer()),png);
  assert.equal((await upload(peer,'?student='+id)).status,403);
  const updated=await upload(learner);assert.equal(updated.status,201);const replacement=(await updated.json()).id;assert.notEqual(replacement,photo);
  assert.equal((await req('me',null,learner)).value.user.photoId,replacement);
  const imported=await req('add-user',{...account,email:'import@test.school',import:true},admin);assert.equal(imported.status,201);assert.equal((await req('student-status',{id:imported.value.id,status:'ACTIVE'},admin)).status,400);
  await stop();await start();assert.equal((await req('me',null,learner)).value.user.photoId,replacement);assert.equal((await fetch(root+'/api/profile-photo/'+id,{headers:{Cookie:learner.cookie}})).status,200);
  assert.equal((await req('logout',{},learner)).status,200);assert.equal((await fetch(root+'/api/profile-photo/'+id,{headers:{Cookie:learner.cookie}})).status,401);
 }finally{await stop();}
});
