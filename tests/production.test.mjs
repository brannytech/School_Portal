import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

test('Production bootstrap has no sandbox login or seeded student accounts',async()=>{
 const directory=path.resolve('test-results','production-'+Date.now());fs.mkdirSync(directory,{recursive:true});const port=0;let base='';
 const server=spawn(process.execPath,['--experimental-sqlite','server.mjs'],{env:{...process.env,NODE_ENV:'production',DEMO_MODE:'false',DATA_DIR:directory,PORT:String(port),SESSION_SECRET:'a-test-only-secret-that-is-long-enough-for-isolated-tests',ADMIN_EMAIL:'production-admin@test.school',ADMIN_PASSWORD:'An-isolated-test-password!'},stdio:['ignore','pipe','pipe']});let output='';server.stdout.on('data',b=>{output+=b;const match=output.match(/ready at (http:\/\/127\.0\.0\.1:\d+)/);if(match)base=match[1];});server.stderr.on('data',b=>output+=b);
 try{for(let i=0;i<100;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,80));if(i===99)throw Error(output);}
 const config=await(await fetch(base+'/api/config')).json();assert.equal(config.demo,false);assert.equal(config.selfRegistration,false);
 const response=await fetch(base+'/api/demo-login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({role:'admin'})});assert.equal(response.status,404);
 const login=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'production-admin@test.school',password:'An-isolated-test-password!'})});assert.equal(login.status,200);let cookie=login.headers.get('set-cookie').split(';')[0];const first=await login.json();assert.equal(first.user.mustChangePassword,true);
 assert.equal((await fetch(base+'/api/state',{headers:{Cookie:cookie}})).status,403,'state is blocked until the password is changed');
 const changed=await fetch(base+'/api/change-password',{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie,'X-CSRF-Token':first.csrf},body:JSON.stringify({currentPassword:'An-isolated-test-password!',newPassword:'A-brand-new-password-2026'})});assert.equal(changed.status,200);cookie=changed.headers.get('set-cookie').split(';')[0];
 assert.equal((await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'production-admin@test.school',password:'An-isolated-test-password!'})})).status,401);
 const state=await(await fetch(base+'/api/state',{headers:{Cookie:cookie}})).json();assert.equal(state.students.length,0);assert.equal(state.teachers.length,0);assert.equal(state.assignments.length,0);
 assert(!output.includes('An-isolated-test-password!'));assert(!output.includes('a-test-only-secret'));
 }finally{const stop=new Promise(resolve=>server.once('exit',resolve));server.kill();await stop;}
});
