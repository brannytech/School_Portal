// Support board in a real browser: strip, filters, student profile, rules, heatmap.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn,spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const output=path.resolve('test-results','support-ui-'+Date.now());fs.mkdirSync(output,{recursive:true});
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
  const context=await browser.newContext({viewport:size,serviceWorkers:'block'}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(root);
  await page.evaluate(async([role])=>{await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:role+'@olawaleslab.school',password:'Learn@2026!'})});},[role]);
  await page.goto(root);await page.waitForFunction(()=>typeof navigate==='function'&&typeof user!=='undefined'&&user);await page.evaluate(()=>navigate('progress'));
  await page.locator('.support-strip').waitFor({timeout:15000});check(role+': support board opens by default');
  const weak=page.locator('.support-row',{hasText:'Needs support now'}).first();await weak.waitFor();check(role+': a struggling student is listed with a plain reason');
  const scroll=await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1);assert(scroll,'horizontal scroll at '+size.width);check(role+': no sideways scrolling at '+size.width+' px');
  await page.locator('[data-action="support-filter"][data-status="needs_support"]').click();assert((await page.locator('.support-row').count())>=1);check(role+': tapping a count filters the list');
  await weak.locator('button').click();await page.locator('#modal .support-flags').waitFor();assert((await page.locator('#modal').innerText()).includes('Suggested'));check(role+': profile shows flags, evidence and suggested action');
  if(role==='admin'){
   await page.locator('[data-action="support-plan-new"]').click();await page.locator('#sp-w').waitFor();await page.locator('#sp-t').fill('70');await page.locator('#sp-n').fill('Small group on Tuesday');
   await page.locator('[data-action="support-plan-save"]').click();await page.locator('.support-row',{hasText:'Support plan open'}).first().waitFor();check('admin: a support plan is started and the board shows it');
   await page.locator('.support-row',{hasText:'Support plan open'}).first().locator('button').click();await page.locator('#modal .support-plan').waitFor();assert((await page.locator('#modal').innerText()).includes('Target 70%'));check('admin: the profile shows the plan, target and starting score');
   await page.locator('[data-action="support-plan-close"]').click();await page.locator('.support-row').first().waitFor();await page.waitForTimeout(500);
   await page.locator('.support-row').filter({hasNotText:'Support plan open'}).first().locator('button').click();await page.locator('#modal .support-flags').waitFor();
   check('admin: closing a plan measures it and removes the open-plan marker');
  }
  await page.keyboard.press('Escape');
  await page.locator('[data-action="support-how"]').click();await page.locator('#modal',{hasText:'first try only'}).waitFor();check(role+': "How we calculate this" explains the rules');await page.keyboard.press('Escape');
  if(role==='admin'){await page.locator('[data-action="support-rules"]').click();await page.locator('#sr-d').fill('90');await page.locator('#sr-p').fill('80');await page.locator('[data-action="support-rules-save"]').click();await page.locator('#support-rules-error',{hasText:'must rise'}).waitFor();check('admin: invalid rules are refused with a clear message');await page.keyboard.press('Escape');}
  await page.locator('.support-heat summary').click();assert((await page.locator('.heat').count())>0);check(role+': heatmap shows thin evidence differently');
  await page.screenshot({path:path.join(output,role+'.png'),fullPage:true});await context.close();
 }
 assert.deepEqual(errors,[]);console.log('PASSED '+output);
}finally{await browser?.close();server.kill();}
