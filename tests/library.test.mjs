import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

test('Library: a copy is independent, per school, permission-checked and never overwrites',()=>{
 const dir=path.resolve('test-results','library-'+Date.now());fs.mkdirSync(dir,{recursive:true});
 const script=`
  const {db,createSchool,findSchool,DEFAULT_CODE}=await import('./store.mjs');
  const {requestScope}=await import('./context.mjs');
  const {libraryApi,libraryItems}=await import('./library.mjs');
  await createSchool({code:'beta',name:'Beta',adminEmail:'h@beta.test',adminPassword:'Beta-initial-password-1!'});
  const call=async(code,user,endpoint,method,b)=>requestScope.run({tenant:findSchool(code),sessionId:findSchool(code).db.currentSessionId},async()=>{
   let out,status=200;const fail=(s,m)=>{throw Object.assign(new Error(m),{status:s});};
   try{await libraryApi({endpoint,method,b,u:user,json:v=>{out=v;},fail,audit:()=>{}});}catch(e){status=e.status;out={error:e.message};}return {status,out};});
  const admin={id:'initial-admin',role:'ADMIN'},stranger={id:'nobody',role:'TEACHER'},student={id:'s',role:'STUDENT'};
  const first=libraryItems()[0],title=first.weeks[0].title;
  const r={};
  r.student=(await call(DEFAULT_CODE,student,'library','GET')).status;
  r.stranger=(await call(DEFAULT_CODE,stranger,'library-copy','POST',{id:first.id,weeks:[1]})).status;
  r.copy=(await call(DEFAULT_CODE,admin,'library-copy','POST',{id:first.id,weeks:[1,2]})).out;
  r.again=(await call(DEFAULT_CODE,admin,'library-copy','POST',{id:first.id,weeks:[1,2,3]})).out;
  r.badClass=(await call(DEFAULT_CODE,admin,'library-copy','POST',{id:first.id,class:'XX'})).status;
  r.missing=(await call(DEFAULT_CODE,admin,'library-copy','POST',{id:'nope'})).status;
  // edit the school's copy
  const mainDb=findSchool(DEFAULT_CODE).db,key=Object.keys(mainDb.courses).find(k=>k.endsWith('|SS1:Mathematics:1'));
  r.weeksInMain=mainDb.courses[key].map(w=>w.id);mainDb.courses[key][0].title='Edited by the school';mainDb.courses[key][0].lessons[0].title='Edited lesson';
  r.libraryAfterEdit=libraryItems()[0].weeks[0].title===title&&first.weeks[0].lessons[0].title!=='Edited lesson';
  r.betaCourses=Object.keys(findSchool('beta').db.courses||{}).length;
  r.listing=(await call(DEFAULT_CODE,admin,'library','GET')).out.items[0].copied.map(c=>c.week);
  console.log(JSON.stringify(r));process.exit(0);`;
 const run=spawnSync(process.execPath,['--experimental-sqlite','--no-warnings','--input-type=module','-e',script],{env:{...process.env,DATA_DIR:dir,DATABASE_URL:'',NODE_ENV:'test',ADMIN_EMAIL:'h@main.test',ADMIN_PASSWORD:'Main-initial-password-1!'},encoding:'utf8'});
 assert.equal(run.status,0,run.stderr);const r=JSON.parse(run.stdout.trim().split('\n').pop());
 assert.equal(r.student,403,'students cannot use the library');
 assert.equal(r.stranger,403,'a teacher not assigned to the class and subject cannot copy');
 assert.deepEqual(r.copy.copied,[1,2]);
 assert.deepEqual(r.again.copied,[3]);assert.deepEqual(r.again.skipped,[1,2],'existing weeks are never replaced');
 assert.equal(r.badClass,400);assert.equal(r.missing,404);
 assert.deepEqual(r.weeksInMain,[1,2,3]);
 assert.equal(r.libraryAfterEdit,true,'editing a school copy never changes the library');
 assert.equal(r.betaCourses,0,'another school has nothing');
 assert.deepEqual(r.listing.sort(),[1,2,3]);
});
