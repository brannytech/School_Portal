import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

test('sandbox is hidden by default; students request recovery, admin issues a token, token works once',async()=>{
 const dir=path.resolve('test-results','recovery-'+Date.now());fs.mkdirSync(dir,{recursive:true});
 const server=spawn(process.execPath,['--experimental-sqlite','server.mjs'],{env:{...process.env,PORT:'0',DATA_DIR:dir,DEMO_PASSWORD:'Recovery-Test-Password!',NODE_ENV:'test',DEMO_MODE:'',SELF_REGISTRATION:''},stdio:['ignore','pipe','pipe']});
 let output='',base='';
 try{
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('server did not start: '+output)),15000);server.stdout.on('data',b=>{output+=b;const m=output.match(/ready at (http:\/\/127\.0\.0\.1:\d+)/);if(m){base=m[1];clearTimeout(timer);resolve();}});server.stderr.on('data',b=>output+=b);});
  const call=async(endpoint,body,cookie='',csrf='')=>{const r=await fetch(base+'/api/'+endpoint,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...(csrf?{'X-CSRF-Token':csrf}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,body:await r.json().catch(()=>({})),cookie:(r.headers.get('set-cookie')||'').split(';')[0]};};
  const config=(await call('config')).body;assert.equal(config.demo,false);assert.equal(config.selfRegistration,false);
  assert.equal((await call('demo-login',{role:'admin'})).status,404);
  // Unknown and known emails get the same answer.
  const unknown=await call('request-recovery',{email:'nobody@example.test'}),known=await call('request-recovery',{email:'student@olawaleslab.school'});
  assert.equal(unknown.status,200);assert.deepEqual(unknown.body,known.body);
  const login=await call('login',{email:'admin@olawaleslab.school',password:'Recovery-Test-Password!'});assert.equal(login.status,200);
  const csrfToken=login.body.csrf;const state=(await call('state',null,login.cookie)).body;
  assert.equal(state.recoveryRequests.length,1);assert.equal(state.recoveryRequests[0].user,'student');
  await call('request-recovery',{email:'student@olawaleslab.school'});assert.equal((await call('state',null,login.cookie)).body.recoveryRequests.length,1,'duplicate requests are merged');
  const issued=await call('account-recovery',{id:'student'},login.cookie,csrfToken);assert.equal(issued.status,200);assert(issued.body.token);
  assert.equal((await call('state',null,login.cookie)).body.recoveryRequests.length,0);
  assert.equal((await call('recover-account',{token:issued.body.token,password:'short'})).status,400);
  assert.equal((await call('recover-account',{token:issued.body.token,password:'A-brand-new-password-2026'})).status,200);
  assert.equal((await call('recover-account',{token:issued.body.token,password:'Another-new-password-2026'})).status,400,'token is single use');
  assert.equal((await call('login',{email:'student@olawaleslab.school',password:'A-brand-new-password-2026'})).status,200);
 }finally{const stop=new Promise(r=>server.once('exit',r));server.kill();await stop;}
});
