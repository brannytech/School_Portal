// Parent report in a real browser: preview, edit, save, release, whole class, print copy.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn,spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const output=path.resolve('test-results','parent-report-'+Date.now());fs.mkdirSync(output,{recursive:true});
const setup=`const {db,save,sql}=await import('./store.mjs');const scope={sessionId:db.currentSessionId,class:'SS1',subject:'Mathematics',term:1};const q=i=>({id:'q'+i,prompt:'Question '+i,kind:'numeric',answer:'1',explanation:'Test fixture',stage:i<39?'practice':'quiz'});const lesson={id:'1-1',title:'Practice fixture',objectives:[],explain:'Fixture',realLife:'Fixture',summary:[],example:q(0),questions:Array.from({length:50},(_,i)=>q(i))};db.courses[db.currentSessionId+'|SS1:Mathematics:1']=[{id:1,title:'Week one',lessons:[lesson],quiz:Array.from({length:20},(_,i)=>q(i))},{id:2,title:'Draft week',lessons:[{...lesson,id:'2-1'}],quiz:Array.from({length:20},(_,i)=>q(i))}];db.releases.push({id:'draft',...scope,lesson:'2-1',status:'DRAFT'});db.assignments=['a1','a2','general'].map((id,i)=>({id,...scope,title:id,week:i<2?1:null,teacher:'teacher'}));db.progress=[{id:'p',...scope,student:'student',lesson:'1-1',answers:Object.fromEntries(Array.from({length:7},(_,i)=>['q'+i,true])),complete:true,reflectionDone:true,contentConsumedAt:'2026-10-01T10:00:00.000Z'}];db.practiceAttempts=[{id:'wrong',...scope,student:'student',lesson:'1-1',question:'q0',correct:false},...Array.from({length:7},(_,i)=>({id:'attempt'+i,...scope,student:'student',lesson:'1-1',question:'q'+i,correct:true})),{id:'ghost',...scope,student:'student',lesson:'1-1',question:'removed-question',correct:true},{id:'private-subject',...scope,subject:'Physics',student:'student',lesson:'1-1',question:'q9',correct:true}];db.assessmentAttempts=[...['quiz','quiz','mastery'].map((kind,i)=>({id:'assessment'+i,...scope,student:'student',lesson:'1-1',week:1,kind,status:'SUBMITTED',percentage:75,questions:[],answers:{}})),{id:'unfinished',...scope,student:'student',lesson:'1-1',week:1,kind:'mastery',status:'STARTED',questions:[],answers:{}}];db.reflections=[{id:'r',...scope,student:'student',lesson:'1-1',learnt:'Reflection',draft:false}];db.submissions=[{id:'sub1',...scope,student:'student',kind:'assignment',assignment:'a1',week:1},{id:'sub1-retry',...scope,student:'student',kind:'assignment',assignment:'a1',week:1},{id:'note',...scope,student:'student',kind:'note',week:1}];db.submissions.push({id:'old-note',...scope,student:'student',kind:'note',week:null},{id:'peer-note',...scope,student:'student2',kind:'note',week:null});db.users.push({id:'outside',name:'Private learner',email:'private@test.school',role:'STUDENT',status:'ACTIVE',class:'SS2',password:db.users[0].password});await save();await sql.run('INSERT INTO student_presence(user_id,last_seen) VALUES (?,?)',['student2','2020-01-01T00:00:00.000Z']);db.practiceAttempts.push(...Array.from({length:9},(_,i)=>({id:'weak'+i,...scope,student:'student2',lesson:'1-1',question:'q'+i,correct:false,response:'9',at:new Date().toISOString()})));await save();await sql.close();`;
const env={...process.env,DATA_DIR:path.join(output,'data'),PORT:'0',NODE_ENV:'test',DEMO_PASSWORD:'Learn@2026!'};
const seed=spawnSync(process.execPath,['--experimental-sqlite','--input-type=module','-e',setup],{env,encoding:'utf8'});assert.equal(seed.status,0,seed.stderr);
const server=spawn(process.execPath,['--experimental-sqlite','server.mjs'],{env,stdio:['ignore','pipe','pipe']});
let root='',log='',browser;const errors=[],check=m=>console.log('  ✓ '+m);
server.stdout.on('data',b=>{log+=b;root=log.match(/ready at (http:\/\/127\.0\.0\.1:\d+)/)?.[1]||'';});server.stderr.on('data',b=>log+=b);
try{
 for(let i=0;i<150&&!root&&server.exitCode===null;i++)await new Promise(r=>setTimeout(r,100));assert(root,log);
 browser=await chromium.launch({headless:true,...(process.env.AUDIT_BROWSER_PATH?{executablePath:process.env.AUDIT_BROWSER_PATH}:{channel:'chrome'})});
 for(const [role,size] of [['admin',{width:1280,height:900}],['teacher',{width:390,height:800}]]){
  const context=await browser.newContext({viewport:size,serviceWorkers:'block'}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.goto(root);
  await page.evaluate(async([role])=>{await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:role+'@olawaleslab.school',password:'Learn@2026!'})});},[role]);
  await page.goto(root);await page.waitForFunction(()=>typeof navigate==='function'&&typeof user!=='undefined'&&user);await page.evaluate(()=>navigate('progress'));
  await page.locator('.support-strip').waitFor({timeout:15000});
  await page.locator('[data-action="support-view"][data-view="report"]').click();await page.locator('#rp-s option',{hasText:'Chisom'}).waitFor({state:'attached'});check(role+': the Parent report tab lists the class');
  await page.locator('#rp-s').selectOption({label:'Chisom Okafor'});await page.locator('[data-action="report-preview"]').click();await page.locator('.report-sheet').waitFor();
  const text=await page.locator('.report-sheet').innerText();assert(text.includes('PROGRESS REPORT')&&text.includes('Chisom Okafor')&&text.includes('GF/2026/002')&&text.includes('Mathematics'));check(role+': the report shows school, child, admission number and subjects');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),'sideways scroll at '+size.width);check(role+': no sideways scrolling at '+size.width+' px');
  await page.locator('[data-report-overall]').fill('Chisom needs a small-group session on fractions this week.');
  await page.locator('[data-action="report-save-draft"]').click();await page.locator('#report-status',{hasText:'Saved as Draft'}).waitFor();check(role+': edited wording is saved as a draft');
  await page.locator('[data-action="report-save-reviewed"]').click();await page.locator('#report-status',{hasText:'Saved as Reviewed'}).waitFor();check(role+': a teacher can mark it reviewed');
  if(role==='admin'){
   await page.locator('[data-action="report-release"]').click();await page.locator('#report-status',{hasText:'Released'}).waitFor();check('admin: release fixes the report as a saved version');
   await page.locator('#report-versions [data-action="report-open"]').first().click();await page.waitForFunction(()=>document.querySelector('.report-sheet')&&!document.querySelector('.report-sheet textarea'));const shown=await page.locator('.report-sheet').innerText();assert(shown.includes('small-group session'),shown.slice(0,1200));assert((await page.locator('.report-sheet textarea').count())===0);check('admin: opening a saved version shows exactly the released wording, read-only');
  }else{assert((await page.locator('[data-action="report-release"]').count())===0);check('teacher: no Release button');}
  await page.locator('[data-action="report-class"]').click();await page.waitForFunction(()=>document.querySelectorAll('.report-sheet').length>=2);check(role+': the whole class builds one report per child');
  await page.screenshot({path:path.join(output,role+'-report.png'),fullPage:false});
  await page.evaluate(()=>reportPrint());await page.waitForFunction(()=>document.querySelector('iframe[aria-hidden]'),null,{timeout:5000}).catch(()=>{});
  const frameText=await page.evaluate(()=>document.querySelector('iframe[aria-hidden]')?.contentDocument?.body?.innerText||'');assert(frameText.includes('PROGRESS REPORT')&&!frameText.includes('Save draft'));check(role+': the print copy has only the report pages (no buttons)');
  await context.close();
 }
 assert.deepEqual(errors,[]);console.log('PASSED '+output);
}finally{await browser?.close();server.kill();}
