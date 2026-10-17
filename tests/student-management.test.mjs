import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

test('Delegated student management and a directory of more than 100 students',async t=>{
 const directory=path.resolve('test-results','student-management-'+Date.now());fs.mkdirSync(directory,{recursive:true});
 const env={...process.env,DATA_DIR:directory,PORT:'0',NODE_ENV:'test',DEMO_PASSWORD:'Learn@2026!'};
 const seed=spawnSync(process.execPath,['--experimental-sqlite','--input-type=module','-e',`const {db,save,hash,sql}=await import('./store.mjs');const password=hash('Learn@2026!');for(let i=0;i<125;i++)db.users.push({id:'bulk-'+i,name:'Learner '+String(i).padStart(3,'0'),email:'learner'+i+'@test.school',admission:'BULK-'+String(i).padStart(4,'0'),role:'STUDENT',status:'ACTIVE',class:'SS1',password});db.users.push({id:'outside',name:'Outside class learner',email:'outside@test.school',role:'STUDENT',status:'PENDING',class:'SS2',password});await save();await sql.close();`],{env,encoding:'utf8'});assert.equal(seed.status,0,seed.stderr);
 let server,root,output='';
 async function start(){root='';output='';server=spawn(process.execPath,['--experimental-sqlite','server.mjs'],{env,stdio:['ignore','pipe','pipe']});server.stdout.on('data',b=>{output+=b;root=output.match(/ready at (http:\/\/127\.0\.0\.1:\d+)/)?.[1]||'';});server.stderr.on('data',b=>output+=b);for(let i=0;i<100;i++){if(root)return;await new Promise(r=>setTimeout(r,100));}throw Error(output);}
 async function stop(){if(server.exitCode!==null)return;await new Promise(r=>{server.once('exit',r);server.kill();});}
 async function req(route,data,session={}){const response=await fetch(root+'/api/'+route,{method:data?'POST':'GET',headers:{Cookie:session.cookie||'','X-CSRF-Token':session.csrf||'','Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})});return {status:response.status,value:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};}
 async function login(role){const r=await req('login',{email:role+'@olawaleslab.school',password:'Learn@2026!'});assert.equal(r.status,200);return {cookie:r.cookie,csrf:r.value.csrf};}
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aG9sAAAAASUVORK5CYII=','base64');
 const upload=(session,query)=>fetch(root+'/api/profile-photo'+query,{method:'PUT',headers:{Cookie:session.cookie,'X-CSRF-Token':session.csrf},body:png});
 try{
  await start();const admin=await login('admin'),teacher=await login('teacher'),student=await login('student');
  const registration={name:'Teacher Registered Learner',email:'registered@test.school',password:'Learn@2026!',role:'STUDENT',class:'SS1',admission:'NEW-123'};
  await t.test('Staff directory is searchable, filtered, bounded and class-scoped',async()=>{
   assert.equal((await req('students',null,student)).status,403);
   const page=(await req('students?pageSize=50',null,teacher)).value;assert.equal(page.total,128);assert.equal(page.students.length,50);assert.equal(page.pages,3);assert.deepEqual(page.classes,['SS1']);assert(page.students.every(s=>s.class==='SS1'));assert(page.students.every(s=>!s.password&&!s.guardian));
   const second=(await req('students?pageSize=50&page=2',null,teacher)).value;assert.equal(second.students.length,50);assert(!page.students.some(a=>second.students.some(b=>a.id===b.id)));
   assert.equal((await req('students?pageSize=50&page=3',null,teacher)).value.students.length,28);
   assert.equal((await req('students?search=bulk-0123',null,teacher)).value.students[0].id,'bulk-123');
   assert.equal((await req('students?search=LEARNER124%40TEST.SCHOOL',null,teacher)).value.total,1);
   assert.equal((await req('students?status=PENDING',null,teacher)).value.total,1);
   assert.equal((await req('students?search=not-found',null,teacher)).value.total,0);
   assert.equal((await req('students?studentClass=SS2',null,teacher)).status,403);
   assert.equal((await req('students?studentClass=SS2',null,admin)).value.total,1);
   assert.equal((await req('students?pageSize=10000',null,admin)).status,400);
   assert.equal((await req('students?page=-1',null,admin)).status,400);
  });
  await t.test('Only admin can grant registration; teachers cannot create staff or cross classes',async()=>{
   assert.equal((await req('add-user',registration,teacher)).status,403);
   assert.equal((await req('teacher-privileges',{id:'teacher',registerStudents:true,manageStudents:true},teacher)).status,403);
   assert.equal((await req('teacher-privileges',{id:'teacher',registerStudents:true,manageStudents:false},admin)).status,200);
   assert.equal((await req('add-user',{...registration,role:'TEACHER'},teacher)).status,403);
   assert.equal((await req('add-user',{...registration,class:'SS2'},teacher)).status,403);
   assert.equal((await req('add-user',registration,teacher)).status,400);
   assert.equal((await req('student-status',{id:'pending',status:'ACTIVE'},teacher)).status,403);
  });
  let registered;
  await t.test('Privileged teacher registers with a photo, then admin separately grants approval rights',async()=>{
   const photo=await upload(teacher,'?newStudent=true');assert.equal(photo.status,201);const photoId=(await photo.json()).id;
   const created=await req('add-user',{...registration,photoId,subject:'Physics',privileges:{manageStudents:true}},teacher);assert.equal(created.status,201,JSON.stringify(created.value));assert.equal(created.value.status,'PENDING');assert.equal(created.value.registeredBy,'teacher');registered=created.value;
   assert.equal((await req('student-status',{id:registered.id,status:'ACTIVE'},teacher)).status,403);
   assert.equal((await req('teacher-privileges',{id:'teacher',registerStudents:true,manageStudents:true},admin)).status,200);
   assert.equal((await req('student-status',{id:registered.id,status:'ACTIVE'},teacher)).status,200);
   assert.equal((await req('student-status',{id:'outside',status:'REMOVED'},teacher)).status,404);
   assert.equal((await upload(teacher,'?student=outside')).status,403);
   assert.equal((await upload(teacher,'?student='+registered.id)).status,201);
   assert.equal((await req('student-status',{id:registered.id,status:'SUSPENDED',newClass:'SS2'},teacher)).status,403);
   assert.equal((await req('students?search=NEW-123',null,teacher)).value.students[0].status,'ACTIVE','Invalid destination must not partially suspend the account');
   assert.equal((await req('allocation',{teacher:'teacher',class:'SS2',subject:'Mathematics'},admin)).status,200);
   assert.equal((await req('student-status',{id:registered.id,status:'ACTIVE',newClass:'SS2'},teacher)).status,200);
   assert.equal((await req('students?studentClass=SS2&search=NEW-123',null,teacher)).value.total,1);
  });
  await t.test('Privileges persist, revoke immediately, and loss of allocation removes access',async()=>{
   await stop();await start();assert.equal((await req('me',null,teacher)).value.user.privileges.manageStudents,true);
   assert.equal((await req('teacher-privileges',{id:'teacher',registerStudents:false,manageStudents:false},admin)).status,200);
   assert.equal((await req('student-status',{id:registered.id,status:'SUSPENDED'},teacher)).status,403);
   assert.equal((await upload(teacher,'?newStudent=true')).status,403);
   assert.equal((await upload(teacher,'?student='+registered.id)).status,403);
   assert.equal((await req('add-user',{...registration,email:'other@test.school',import:true},teacher)).status,403);
   await req('allocation',{teacher:'teacher',class:'SS2',subject:'Mathematics',remove:true},admin);
   assert.equal((await req('students?search=NEW-123',null,teacher)).value.total,0);
   assert.equal((await req('students?studentClass=SS2',null,teacher)).status,403);
  });
 }finally{await stop();}
});
