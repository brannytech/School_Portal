import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

test('Admin directories handle more than 100 teachers and subjects',async t=>{
 const directory=path.resolve('test-results','admin-directories-'+Date.now());fs.mkdirSync(directory,{recursive:true});
 const env={...process.env,DATA_DIR:directory,PORT:'0',NODE_ENV:'test',DEMO_PASSWORD:'Learn@2026!'};
 const seed=spawnSync(process.execPath,['--experimental-sqlite','--input-type=module','-e',`const {db,save,hash,sql}=await import('./store.mjs');const password=hash('Learn@2026!');for(let i=0;i<105;i++){const n=String(i).padStart(3,'0');db.users.push({id:'staff-'+i,name:'Directory teacher '+n,email:'staff'+n+'@test.school',role:'TEACHER',status:i===0?'SUSPENDED':'ACTIVE',password});db.subjects.push('Test Subject '+n);if(i<100)db.allocations.push({id:'directory-'+i,teacher:'staff-'+i,class:i%2?'SS2':'SS1',subject:'Test Subject '+n,sessionId:db.currentSessionId});}db.allocations.push({id:'extra',teacher:'staff-0',class:'SS2',subject:'Test Subject 001',sessionId:db.currentSessionId});db.sessions.push({id:'history',name:'Archived test session',currentTerm:3});db.allocations.push({id:'historical',teacher:'staff-104',class:'SS3',subject:'Test Subject 104',sessionId:'history'});await save();await sql.close();`],{env,encoding:'utf8'});assert.equal(seed.status,0,seed.stderr);
 let root='',output='';const server=spawn(process.execPath,['--experimental-sqlite','server.mjs'],{env,stdio:['ignore','pipe','pipe']});server.stdout.on('data',b=>{output+=b;root=output.match(/ready at (http:\/\/127\.0\.0\.1:\d+)/)?.[1]||'';});server.stderr.on('data',b=>output+=b);
 async function req(route,session={},data){const r=await fetch(root+'/api/'+route,{method:data?'POST':'GET',headers:{Cookie:session.cookie||'','Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})});return {status:r.status,value:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
 async function login(role){const r=await req('login',{}, {email:role+'@olawaleslab.school',password:'Learn@2026!'});assert.equal(r.status,200);return {cookie:r.cookie};}
 try{
  for(let i=0;i<100&&!root;i++)await new Promise(r=>setTimeout(r,100));assert(root,output);
  const admin=await login('admin'),teacher=await login('teacher'),student=await login('student');
  const directory=async query=>{const r=await req('admin-directory?'+query,admin);assert.equal(r.status,200,JSON.stringify(r.value));return r.value;};
  await t.test('Teacher pages are bounded, stable and private to administrators',async()=>{
   assert.equal((await req('admin-directory',teacher)).status,403);assert.equal((await req('admin-directory',student)).status,403);assert.equal((await req('admin-directory')).status,401);
   const first=await directory('kind=teachers&pageSize=50'),second=await directory('kind=teachers&pageSize=50&page=2'),last=await directory('kind=teachers&pageSize=50&page=3');
   assert.equal(first.total,106);assert.equal(first.items.length,50);assert.equal(second.items.length,50);assert.equal(last.items.length,6);assert.equal(new Set([...first.items,...second.items,...last.items].map(v=>v.id)).size,106);
   assert(first.items.every(v=>!('password' in v)&&!('guardian' in v)));assert.equal(first.pages,3);
  });
  await t.test('Teacher search and combined filters match the same assignment',async()=>{
   assert.equal((await directory('search=STAFF100%40TEST.SCHOOL')).items[0].id,'staff-100');
   assert.equal((await directory('filterClass=SS1&filterSubject=Test%20Subject%20001')).total,0);
   const pair=await directory('filterClass=SS2&filterSubject=Test%20Subject%20001');assert.equal(pair.total,2);
   assert.equal((await directory('filterClass=SS2&filterSubject=Test%20Subject%20001&status=ACTIVE')).items[0].id,'staff-1');
   assert.equal((await directory('assignment=unassigned')).total,5);assert.equal((await directory('search=no-such-teacher')).total,0);
   assert.equal((await directory('search=STAFF100%40TEST.SCHOOL&page=999')).page,1);
  });
  await t.test('Subjects have search, assignment and class filters with their own pages',async()=>{
   const first=await directory('kind=subjects&pageSize=50'),last=await directory('kind=subjects&pageSize=50&page=3');assert.equal(first.total,110);assert.equal(first.items.length,50);assert.equal(last.items.length,10);
   assert.equal((await directory('kind=subjects&search=test%20subject')).total,105);
   assert.equal((await directory('kind=subjects&assignment=unassigned')).total,9);
   const subject=await directory('kind=subjects&search=Test%20Subject%20001&filterClass=SS2');assert.equal(subject.total,1);assert.equal(subject.items[0].teacherCount,2);assert.deepEqual(subject.items[0].classes,['SS2']);
  });
  await t.test('Teaching assignments respect sessions and validate page/filter inputs',async()=>{
   const current=await directory('kind=allocations&pageSize=50');assert.equal(current.total,102);assert.equal(current.pages,3);
   assert.equal((await directory('kind=allocations&search=STAFF000%40TEST.SCHOOL')).total,2);
   assert.equal((await directory('kind=allocations&sessionId=history')).total,1);
   assert.equal((await directory('kind=teachers&sessionId=history&search=staff104')).items[0].assignmentCount,1);
   for(const query of ['kind=users','pageSize=10000','page=-1','page=1.2','filterClass=unknown','filterSubject=unknown','assignment=bad','status=bad'])assert.equal((await req('admin-directory?'+query,admin)).status,400,query);
  });
 }finally{await new Promise(resolve=>{if(server.exitCode!==null)return resolve();server.once('exit',resolve);server.kill();});}
});
