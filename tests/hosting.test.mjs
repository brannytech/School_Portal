import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import {freshDatabase} from './helpers/database.mjs';

// Limits per school, the health check, and backing up and restoring one school without touching another.
test('Hosting: health check, per-school limits, and single-school backup and restore',async()=>{
 const dir=path.resolve('test-results','hosting-'+Date.now());fs.mkdirSync(dir,{recursive:true});const pg=await freshDatabase();
 const env={...process.env,NODE_ENV:'production',DEMO_MODE:'false',DATA_DIR:dir,DATABASE_URL:pg?.url||'',SESSION_SECRET:'a-test-only-secret-that-is-long-enough-for-isolated-tests',ADMIN_EMAIL:'head@main.test',ADMIN_PASSWORD:'Main-initial-password-1!',PLATFORM_OWNER_EMAIL:'owner@platform.test',PLATFORM_OWNER_PASSWORD:'Owner-initial-password-1!',SELF_REGISTRATION:'true'};
 let server,base='';
 const start=async()=>{let output='';base='';server=spawn(process.execPath,['--experimental-sqlite','server.mjs'],{env:{...env,PORT:'0'},stdio:['ignore','pipe','pipe']});server.stdout.on('data',b=>{output+=b;base=output.match(/ready at (http:\/\/127\.0\.0\.1:\d+)/)?.[1]||'';});server.stderr.on('data',b=>output+=b);for(let i=0;i<150&&!base;i++)await new Promise(r=>setTimeout(r,100));assert(base,output);};
 const stop=async()=>{server.kill();await new Promise(r=>server.once('exit',r));};
 const call=async(prefix,route,data,s={})=>{const r=await fetch(base+'/api/'+prefix+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json',Cookie:s.cookie||'','X-CSRF-Token':s.csrf||''},...(data?{body:JSON.stringify(data)}:{})});return {status:r.status,value:await r.json().catch(()=>null),cookie:r.headers.get('set-cookie')?.split(';')[0]};};
 const owner=(route,data,s)=>call('platform/',route,data,s),app=(route,data,s)=>call('',route,data,s);
 const cli=(...a)=>spawnSync(process.execPath,['--experimental-sqlite','scripts/school-backup.mjs',...a],{env,encoding:'utf8'});
 try{
  await start();
  assert.deepEqual((await app('health')).value,{ok:true});
  const first=await owner('login',{email:'owner@platform.test',password:'Owner-initial-password-1!'});let o={cookie:first.cookie,csrf:first.value.csrf};
  assert.equal((await owner('change-password',{currentPassword:'Owner-initial-password-1!',newPassword:'Owner-chosen-password-1!'},o)).status,200);
  const made={};for(const code of ['alpha','beta']){const r=await owner('create-school',{code,name:code+' school',adminEmail:`head@${code}.test`},o);assert.equal(r.status,201);made[code]=r.value.temporaryPassword;}
  const enter=async code=>{const l=await app('login',{school:code,email:`head@${code}.test`,password:made[code]});const c=await app('change-password',{currentPassword:made[code],newPassword:code+'-Chosen-password-1!'},{cookie:l.cookie,csrf:l.value.csrf});assert.equal(c.status,200);made[code]=code+'-Chosen-password-1!';};
  const signIn=async code=>{const l=await app('login',{school:code,email:`head@${code}.test`,password:made[code]});assert.equal(l.status,200);return {cookie:l.cookie,csrf:l.value.csrf};};
  await enter('alpha');await enter('beta');let alpha=await signIn('alpha'),beta=await signIn('beta');
  const teacher=(s,name)=>app('add-user',{name,email:name.toLowerCase().replace(/\W/g,'')+'@x.test',password:'Teacher-password-1',class:'SS1',role:'TEACHER'},s);
  assert.equal((await teacher(alpha,'Ada Alpha')).status,201);assert.equal((await teacher(beta,'Bayo Beta')).status,201);

  // Limits: alpha may have one student; beta is unlimited. Limits are the owner's to set.
  const register=(school,n)=>app('register',{school,name:'Pupil '+n,email:`p${n}@${school}.test`,password:'Pupil-password-123',class:'SS1',admission:'A-'+n,guardian:'0800000000'});
  assert.equal((await owner('school-limits',{code:'alpha',students:1},o)).status,200);
  assert.equal((await owner('school-limits',{code:'alpha',students:-3},o)).status,400);
  assert.equal((await app('school-limits',{code:'alpha',students:99},alpha)).status===200,false,'a school cannot raise its own limit');
  assert.equal((await register('alpha',1)).status,201);
  const blocked=await register('alpha',2);assert.equal(blocked.status,403);assert.match(blocked.value.error,/limit of 1 students/);
  assert.equal((await register('beta',1)).status,201);assert.equal((await register('beta',2)).status,201,'another school is not limited');
  assert.equal((await owner('schools',null,o)).value.schools.find(s=>s.code==='alpha').limits.students,1);

  // Backup alpha, change both schools, restore alpha: only alpha goes back.
  await stop();
  const out=path.join(dir,'backup-alpha');assert.equal(cli('backup','--code','alpha','--out',out).status,0);assert(fs.existsSync(path.join(out,'data.json')));
  await start();alpha=await signIn('alpha');beta=await signIn('beta');
  assert.equal((await teacher(alpha,'Zed Alpha')).status,201);assert.equal((await teacher(beta,'Bola Beta')).status,201);
  const names=async s=>JSON.stringify((await app('state',null,s)).value);
  assert((await names(alpha)).includes('Zed Alpha'));
  await stop();
  assert.notEqual(cli('restore','--code','alpha','--from',out).status,0,'restore needs --yes');
  assert.notEqual(cli('restore','--code','beta','--from',out,'--yes').status,0,'a backup only restores its own school');
  assert.equal(cli('restore','--code','alpha','--from',out,'--yes').status,0);
  await start();alpha=await signIn('alpha');beta=await signIn('beta');
  const a=await names(alpha),b=await names(beta);
  assert(a.includes('Ada Alpha')&&!a.includes('Zed Alpha'),'alpha is back to the backup');
  assert(b.includes('Bayo Beta')&&b.includes('Bola Beta'),'beta keeps everything, including changes made after the backup');
  assert(!a.includes('Bayo')&&!b.includes('Ada Alpha'));
 }finally{server?.kill();await pg?.cleanup();}
});
