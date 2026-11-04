import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

// A neutral fixture: the library ships empty, so the tests bring their own made-up item.
function fixture(dir){
 const lib=path.join(dir,'library');fs.mkdirSync(lib,{recursive:true});
 const weeks=[1,2,3].map(n=>({id:n,title:'Sample week '+n,quiz:[],lessons:[{id:n+'-1',title:'Sample lesson '+n,order:1,questions:[]}]}));
 fs.writeFileSync(path.join(lib,'sample-item.json'),JSON.stringify({id:'sample-item',title:'Sample item',class:'SS1',subject:'Mathematics',term:1,version:1,weeks}));return lib;
}
test('Library: a copy is independent, per school, permission-checked and never overwrites',()=>{
 const dir=path.resolve('test-results','library-'+Date.now());fs.mkdirSync(dir,{recursive:true});const lib=fixture(dir);
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
 const run=spawnSync(process.execPath,['--experimental-sqlite','--no-warnings','--input-type=module','-e',script],{env:{...process.env,DATA_DIR:dir,LIBRARY_DIR:lib,DATABASE_URL:'',NODE_ENV:'test',ADMIN_EMAIL:'h@main.test',ADMIN_PASSWORD:'Main-initial-password-1!'},encoding:'utf8'});
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

test('Library: ships empty, and export turns a school course into an item (leaving out weeks with school pictures)',()=>{
 const dir=path.resolve('test-results','library-export-'+Date.now());fs.mkdirSync(dir,{recursive:true});
 const env={...process.env,DATA_DIR:dir,DATABASE_URL:'',NODE_ENV:'test',LIBRARY_DIR:path.join(dir,'none'),ADMIN_EMAIL:'h@main.test',ADMIN_PASSWORD:'Main-initial-password-1!'};
 const empty=spawnSync(process.execPath,['--experimental-sqlite','--no-warnings','--input-type=module','-e',`const {libraryItems}=await import('./library.mjs');console.log(libraryItems().length);process.exit(0);`],{env:{...env,LIBRARY_DIR:''},encoding:'utf8'});
 assert.equal(empty.stdout.trim(),'0','no ready-made curriculum is shipped');
 const seed=`
  const {db,save}=await import('./store.mjs');const key=db.currentSessionId+'|SS1:Mathematics:1';
  db.files.push({id:'school-picture-1',student:'initial-admin',type:'image/png',storage:'local',class:'SS1',subject:'Mathematics',term:1,sessionId:db.currentSessionId});
  db.courses[key]=[{id:1,title:'One',quiz:[],lessons:[{id:'1-1',title:'A',questions:[]}]},{id:2,title:'Two (has a picture)',quiz:[],lessons:[{id:'2-1',title:'B',body:'school-picture-1',questions:[]}]},{id:3,title:'Three',quiz:[],lessons:[{id:'3-1',title:'C',questions:[]}]}];
  await save();process.exit(0);`;
 assert.equal(spawnSync(process.execPath,['--experimental-sqlite','--no-warnings','--input-type=module','-e',seed],{env,encoding:'utf8'}).status,0);
 const out=path.join(dir,'out'),run=()=>spawnSync(process.execPath,['--experimental-sqlite','--no-warnings','scripts/library-export.mjs','--code','main','--class','SS1','--subject','Mathematics','--term','1','--id','sample-export','--title','Sample export','--out',out],{env,encoding:'utf8'});
 let r=run();assert.equal(r.status,0,r.stderr+r.stdout);
 let item=JSON.parse(fs.readFileSync(path.join(out,'sample-export.json'),'utf8'));
 assert.deepEqual(item.weeks.map(w=>w.id),[1,3],'the week with a school picture is left out');assert.equal(item.version,1);
 r=run();assert.equal(r.status,0);item=JSON.parse(fs.readFileSync(path.join(out,'sample-export.json'),'utf8'));assert.equal(item.version,2,'exporting again raises the version');
 const listed=spawnSync(process.execPath,['--experimental-sqlite','--no-warnings','--input-type=module','-e',`const {libraryItems}=await import('./library.mjs');console.log(JSON.stringify(libraryItems().map(i=>[i.id,i.version])));process.exit(0);`],{env:{...env,LIBRARY_DIR:out},encoding:'utf8'});
 assert.deepEqual(JSON.parse(listed.stdout.trim()),[['sample-export',2]],'the library reads exported files');
});
