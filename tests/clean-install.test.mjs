import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

// A clean install: one administrator, forced password change, then the admin adds a teacher and a student,
// the teacher writes a week and an assignment, and the student can use them.
test('Clean install: admin adds people, teacher publishes a week and an assignment, student sees them',async()=>{
 const dir=path.resolve('test-results','clean-install-'+Date.now());fs.mkdirSync(dir,{recursive:true});
 let base='',output='';
 const server=spawn(process.execPath,['--experimental-sqlite','server.mjs'],{env:{...process.env,NODE_ENV:'production',DEMO_MODE:'false',DATA_DIR:dir,PORT:'0',SESSION_SECRET:'a-test-only-secret-that-is-long-enough-for-isolated-tests',ADMIN_EMAIL:'head@test.school',ADMIN_PASSWORD:'Initial-password-2026!'},stdio:['ignore','pipe','pipe']});
 server.stdout.on('data',b=>{output+=b;base=output.match(/ready at (http:\/\/127\.0\.0\.1:\d+)/)?.[1]||'';});server.stderr.on('data',b=>output+=b);
 try{
  for(let i=0;i<150&&!base;i++)await new Promise(r=>setTimeout(r,100));assert(base,output);
  const req=async(route,data,s={})=>{const r=await fetch(base+'/api/'+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json',Cookie:s.cookie||'','X-CSRF-Token':s.csrf||''},...(data?{body:JSON.stringify(data)}:{})});return {status:r.status,value:await r.json().catch(()=>null),cookie:r.headers.get('set-cookie')?.split(';')[0]};};
  const login=async(email,password)=>{const r=await req('login',{email,password});assert.equal(r.status,200,JSON.stringify(r.value));return {cookie:r.cookie,csrf:r.value.csrf,user:r.value.user};};

  // 1. First sign-in and forced password change.
  let admin=await login('head@test.school','Initial-password-2026!');assert.equal(admin.user.mustChangePassword,true);
  assert.equal((await req('add-user',{name:'X',email:'x@test.school',password:'Long-password-1',class:'SS1',role:'TEACHER'},admin)).status,403,'nothing works before the password is changed');
  const changed=await req('change-password',{currentPassword:'Initial-password-2026!',newPassword:'Chosen-password-2026!'},admin);assert.equal(changed.status,200);
  admin={cookie:changed.cookie,csrf:changed.value.csrf??admin.csrf};
  admin=await login('head@test.school','Chosen-password-2026!');assert(!admin.user.mustChangePassword);

  // 2. Add a teacher and give them a class and subject.
  const teacherAccount=await req('add-user',{name:'Mrs Bello',email:'bello@test.school',password:'Teacher-password-1',class:'SS1',role:'TEACHER'},admin);assert.equal(teacherAccount.status,201,JSON.stringify(teacherAccount.value));
  assert.equal(teacherAccount.value.role,'TEACHER');
  assert.equal((await req('allocation',{teacher:teacherAccount.value.id,class:'SS1',subject:'Mathematics'},admin)).status,200);

  // 3. Add a student (a profile photo is required) and approve the account.
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aG9sAAAAASUVORK5CYII=','base64');
  const staged=await fetch(base+'/api/profile-photo?newStudent=true',{method:'PUT',headers:{Cookie:admin.cookie,'X-CSRF-Token':admin.csrf},body:png});assert.equal(staged.status,201);
  const studentAccount=await req('add-user',{name:'Ada Obi',email:'ada@test.school',password:'Student-password-1',class:'SS1',role:'STUDENT',admission:'A-001',photoId:(await staged.json()).id},admin);assert.equal(studentAccount.status,201,JSON.stringify(studentAccount.value));
  assert.equal((await req('login',{email:'ada@test.school',password:'Student-password-1'})).status,403,'a new student waits for approval');
  assert.equal((await req('student-status',{id:studentAccount.value.id,status:'ACTIVE'},admin)).status,200);

  // 4. The teacher writes Week 1 and an assignment; both are locked or live only as chosen.
  const teacher=await login('bello@test.school','Teacher-password-1');
  const note={schemaVersion:1,blocks:[{id:'n1',type:'paragraph',text:'Numbers can be sorted into types.'}]};
  const week=await req('weekly-template',{week:{id:1,title:'Number types',subtitle:'',lessons:[{id:'1-a',title:'Kinds of number',minutes:15,document:note,questions:[]}],quiz:[]},assignments:[],publish:true,release:{mode:'NOW',lessons:['1-a']}},teacher);assert.equal(week.status,200,JSON.stringify(week.value));
  const homework=await req('assignment-save',{assignment:{week:1,title:'Sort the numbers',scope:'LESSON',lessons:['1-a'],mode:'PHOTO',max:10,instructions:'Sort ten numbers and photograph your work.'}},teacher);assert.equal(homework.status,200,JSON.stringify(homework.value));
  const student=await login('ada@test.school','Student-password-1');
  assert.equal((await req('lesson/1-a',null,student)).status,200,'the released lesson opens');
  const before=(await req('state',null,student)).value.assignments.find(a=>a.title==='Sort the numbers');assert.equal(before.available,false,'the assignment waits for the teacher');
  assert.equal((await req('assignment-release',{id:homework.value.assignment.id,status:'PUBLISHED',due:'2099-01-01'},teacher)).status,200);
  const after=(await req('state',null,student)).value.assignments.find(a=>a.title==='Sort the numbers');assert.equal(after.available,true);assert.match(after.instructions,/photograph/);

  // 5. The admin sees both people and no sample data.
  const state=(await req('state',null,admin)).value;assert.equal(state.teachers.length,1);assert.equal(state.students.length,1);
  assert(!output.includes('Initial-password-2026!'),'the temporary password is never logged');
 }finally{await new Promise(r=>{server.once('exit',r);server.kill();});}
});
