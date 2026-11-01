import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

// Two schools on one installation must be completely separate: accounts, data, sessions and files.
test('Schools are isolated: separate accounts, sessions, ids, lists and folders',async()=>{
 const dir=path.resolve('test-results','multi-school-'+Date.now());fs.mkdirSync(dir,{recursive:true});
 const env={...process.env,NODE_ENV:'production',DEMO_MODE:'false',DATA_DIR:dir,SESSION_SECRET:'a-test-only-secret-that-is-long-enough-for-isolated-tests',ADMIN_EMAIL:'head@shared.test',ADMIN_PASSWORD:'Main-initial-password-1!'};
 const made=spawnSync(process.execPath,['--experimental-sqlite','scripts/create-school.mjs','--code','beta','--name','Beta Academy','--admin-email','head@shared.test','--password','Beta-initial-password-1!'],{env,encoding:'utf8'});
 assert.equal(made.status,0,made.stdout+made.stderr);
 assert.notEqual(spawnSync(process.execPath,['--experimental-sqlite','scripts/create-school.mjs','--code','beta','--admin-email','x@y.test'],{env,encoding:'utf8'}).status,0,'a school code cannot be reused');
 assert.notEqual(spawnSync(process.execPath,['--experimental-sqlite','scripts/create-school.mjs','--code','../evil','--admin-email','x@y.test'],{env,encoding:'utf8'}).status,0,'path tricks in a school code are rejected');
 assert(fs.existsSync(path.join(dir,'schools','beta','school.sqlite')),'beta has its own database file');
 assert(!fs.existsSync(path.join(dir,'schools','..','evil')));
 let base='',output='';
 const server=spawn(process.execPath,['--experimental-sqlite','server.mjs'],{env:{...env,PORT:'0'},stdio:['ignore','pipe','pipe']});
 server.stdout.on('data',b=>{output+=b;base=output.match(/ready at (http:\/\/127\.0\.0\.1:\d+)/)?.[1]||'';});server.stderr.on('data',b=>output+=b);
 try{
  for(let i=0;i<150&&!base;i++)await new Promise(r=>setTimeout(r,100));assert(base,output);
  const req=async(route,data,s={},method)=>{const r=await fetch(base+'/api/'+route,{method:method||(data?'POST':'GET'),headers:{'Content-Type':'application/json',Cookie:s.cookie||'','X-CSRF-Token':s.csrf||''},...(data?{body:JSON.stringify(data)}:{})});return {status:r.status,value:await r.json().catch(()=>null),cookie:r.headers.get('set-cookie')?.split(';')[0]};};
  const enter=async(school,initial,chosen)=>{
   const r=await req('login',{school,email:'head@shared.test',password:initial});assert.equal(r.status,200,JSON.stringify(r.value));
   assert(r.cookie.startsWith('lab_session='+school+'.'),'the cookie names its school');
   const c=await req('change-password',{currentPassword:initial,newPassword:chosen},{cookie:r.cookie,csrf:r.value.csrf});assert.equal(c.status,200);
   const again=await req('login',{school,email:'head@shared.test',password:chosen});assert.equal(again.status,200);return {cookie:again.cookie,csrf:again.value.csrf};
  };

  // With two schools the school code is required, and wrong codes or passwords never cross over.
  assert.equal((await req('login',{email:'head@shared.test',password:'Main-initial-password-1!'})).status,400);
  assert.equal((await req('login',{school:'nope',email:'head@shared.test',password:'x'})).status,404);
  assert.equal((await req('login',{school:'beta',email:'head@shared.test',password:'Main-initial-password-1!'})).status,401,'the same email is a different account in each school');
  assert.equal((await req('config')).value.multi,true);
  assert.equal((await req('config?school=beta')).value.school.name,'Beta Academy');

  const main=await enter('main','Main-initial-password-1!','Main-chosen-password-1!');
  const beta=await enter('beta','Beta-initial-password-1!','Beta-chosen-password-1!');

  // Each school adds its own people.
  const ada=await req('add-user',{name:'Ada Main',email:'ada@shared.test',password:'Teacher-password-1',class:'SS1',role:'TEACHER'},main);assert.equal(ada.status,201,JSON.stringify(ada.value));
  const bayo=await req('add-user',{name:'Bayo Beta',email:'bayo@shared.test',password:'Teacher-password-1',class:'SS1',role:'TEACHER'},beta);assert.equal(bayo.status,201,JSON.stringify(bayo.value));
  const names=async s=>JSON.stringify((await req('state',null,s)).value);
  const mainState=await names(main),betaState=await names(beta);
  assert(mainState.includes('Ada Main')&&!mainState.includes('Bayo Beta')&&!mainState.includes('Beta Academy'));
  assert(betaState.includes('Bayo Beta')&&!betaState.includes('Ada Main'));

  // A student of one school cannot sign in to the other, even with the right password.
  assert.equal((await req('login',{school:'beta',email:'ada@shared.test',password:'Teacher-password-1'})).status,401);
  assert.equal((await req('login',{school:'main',email:'bayo@shared.test',password:'Teacher-password-1'})).status,401);

  // Swapping the school in a cookie does not make a session valid elsewhere.
  const swapped={cookie:main.cookie.replace('lab_session=main.','lab_session=beta.'),csrf:main.csrf};
  assert.equal((await req('state',null,swapped)).status,401);
  assert.equal((await req('state',null,{cookie:'lab_session='+main.cookie.split('.')[1],csrf:''})).status,401,'a cookie with no school cannot pick one when there are two');

  // Ids from one school are "not found" in the other.
  const adaId=ada.value.id;
  assert.equal((await req('allocation',{teacher:adaId,class:'SS1',subject:'Mathematics'},beta)).status,400,'a teacher id from another school is not a teacher here');
  assert(!JSON.stringify((await req('admin-directory',null,beta)).value||'').includes('Ada Main'));

  // Each school's data lives in its own folder.
  assert(fs.existsSync(path.join(dir,'school.sqlite'))&&fs.existsSync(path.join(dir,'schools','beta','school.sqlite')));
  const registry=JSON.parse(fs.readFileSync(path.join(dir,'schools.json'),'utf8'));assert.deepEqual(registry.schools.map(s=>s.code).sort(),['beta','main']);
 }finally{server.kill();}
});
