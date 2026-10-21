// Phase 1 browser acceptance, exclusively against a new fictional database.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {contentRevision} from '../lesson-document.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const output=path.resolve('test-results','phase-1-browser-'+Date.now());fs.mkdirSync(output,{recursive:true});
const server=spawn(process.execPath,['--experimental-sqlite','server.mjs'],{env:{...process.env,DATA_DIR:path.join(output,'fictional-data'),DATABASE_URL:'',STORAGE_DRIVER:'local',NODE_ENV:'test',DEMO_MODE:'true',PORT:'0',HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});
let root='',logs='',browser;
server.stdout.on('data',data=>{logs+=data;root=logs.match(/ready at (http:\/\/127\.0\.0\.1:\d+)/)?.[1]||'';});server.stderr.on('data',data=>logs+=data);
const report={date:new Date().toISOString(),checks:[],pageErrors:[],status:'RUNNING'};
const check=label=>report.checks.push({check:label,passed:true});
async function call(page,route,data){return page.evaluate(async({route,data})=>{const me=await(await fetch('/api/me')).json();const response=await fetch('/api/'+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','X-CSRF-Token':me.csrf},...(data?{body:JSON.stringify(data)}:{})});return {status:response.status,value:await response.json()};},{route,data});}
async function enter(role){const context=await browser.newContext({viewport:{width:1366,height:900}});const page=await context.newPage();page.on('pageerror',error=>report.pageErrors.push({role,message:error.message}));await page.goto(root);await page.locator(`[data-action="demo"][data-role="${role}"]`).click();await page.locator('.shell').waitFor();return {context,page};}
try{
 for(let i=0;i<150&&!root&&server.exitCode===null;i++)await new Promise(resolve=>setTimeout(resolve,100));assert(root,logs);
 browser=await chromium.launch({headless:true,channel:process.env.AUDIT_BROWSER_CHANNEL||'chrome'});
 const teacher=await enter('teacher'),page=teacher.page;
 const before=(await call(page,'course')).value;
 await page.locator('[data-action="course-builder"]').first().click();await page.locator('[data-form="course-builder"]').waitFor();
 const text=await page.locator('[name="sub-0-explain"]').inputValue();
 await page.locator('[name="sub-0-explain"]').fill(text+'\nChecked through the browser.');
 await page.locator('[name="draft"]').click();await page.locator('#modal').waitFor({state:'hidden'});
 await page.locator('[data-action="course-builder"]').first().click();await page.locator('[data-form="course-builder"]').waitFor();
 assert.equal(await page.locator('[name="sub-0-explain"]').inputValue(),text+'\nChecked through the browser.');
 await page.locator('[name="publish"]').click();await page.locator('#modal').waitFor({state:'hidden'});check('Teacher edits legacy lesson, saves draft, reopens and publishes through actual UI');
 const after=(await call(page,'course')).value;
 assert.equal(contentRevision(after.filter(w=>w.id!==1)),contentRevision(before.filter(w=>w.id!==1)));
 const old=before[0].lessons[0],revised=after[0].lessons[0];
 assert.equal(revised.discovery,old.discovery);assert.deepEqual(revised.steps,old.steps);assert.equal(revised.questions.filter(q=>q.stage==='quiz').length,10);
 for(const q of old.questions){const saved=revised.questions.find(v=>v.id===q.id);assert(saved);for(const key of ['answer','proof','stage','objective','hint'])assert.deepEqual(saved[key],q[key]);}
 check('Weekly form preserves hidden quiz items, question proof/stage/objective/hint and lesson discovery/steps');
 const student=await enter('student');await student.page.locator('[data-page="learn"]').first().click();await student.page.getByRole('heading',{name:'Your weekly learning path.'}).waitFor();await student.page.locator('[data-action="open-lesson"][data-id="1-1"]').click();await student.page.locator('#subtopic-practice').waitFor();
 assert((await student.page.locator('.lesson-document').textContent()).includes('Checked through the browser.'));assert.equal(await student.page.locator('.widget').count(),1);
 check('Released legacy lesson renders with shared adapter and existing binary widget');
 const document={schemaVersion:1,blocks:[{id:'h',type:'heading',level:2,text:'Structured lesson check'},{id:'p',type:'paragraph',text:'<img src=x onerror="window.injectionExecuted=true">'},{id:'e',type:'equation',latex:'x^2-2x-3=0',displayMode:true},{id:'t',type:'table',caption:'Table of values',headers:['x','y'],rows:[['-1','0'],['1','-4'],['3','0']]},{id:'w',type:'worked-example',prompt:'Evaluate at x = 1',explanation:'1 − 2 − 3 = −4',answer:'−4'},{id:'s',type:'summary',items:['Keep checking the signs.']}]};
 const q={id:'p1',prompt:'Evaluate 1 + 1',kind:'numeric',answer:'2',explanation:'Add one and one.'};
 const week={id:9,title:'Structured content',lessons:[{id:'9-structured',title:'Structured lesson',explain:'Legacy fallback remains',questions:[q],document,privateSource:{answer:'not-for-students'}}],quiz:[{...q,id:'q1'}]};
 const saved=await call(page,'weekly-template',{week,assignments:[],publish:false});assert.equal(saved.status,200);
 await page.reload();await page.locator('.shell').waitFor();await page.locator('[data-action="course-builder"]').first().click();await page.locator('[data-form="course-builder"]').waitFor();
 await page.locator('#builder-load-week').fill('9');await page.locator('[data-action="course-load-week"]').click();await page.locator('[name="builder-title"]').filter({visible:true}).waitFor();
 await page.waitForFunction(()=>document.querySelector('[name="builder-title"]')?.value==='Structured content');
 assert.equal(await page.locator('[name="sub-0-explain"]').getAttribute('readonly'),'');
 await page.locator('[name="publish"]').click();await page.locator('#modal').waitFor({state:'hidden'});
 const current=(await call(page,'weekly-template?week=9')).value.published;assert.deepEqual(current.lessons[0].document,document);assert.deepEqual(current.lessons[0].privateSource,week.lessons[0].privateSource);
 check('Structured draft survives browser refresh and weekly form publication without changing its document');
 await student.page.reload();await student.page.locator('.shell').waitFor();await student.page.locator('[data-page="learn"]').first().click();await student.page.getByRole('heading',{name:'Your weekly learning path.'}).waitFor();await student.page.locator('[data-action="open-lesson"][data-id="9-structured"]').click();await student.page.locator('[data-block-id="t"] table').waitFor();
 assert.equal(await student.page.locator('.lesson-document img').count(),0);assert.equal(await student.page.evaluate(()=>window.injectionExecuted),undefined);assert.equal(await student.page.locator('.lesson-equation code').textContent(),'x^2-2x-3=0');
 assert((await student.page.locator('.lesson-document').textContent()).includes('<img src=x'));const visible=(await call(student.page,'lesson/9-structured')).value;assert(!('privateSource'in visible));
 check('Student sees structured heading/table/example/source equation; HTML remains harmless text and source metadata stays private');
 await student.page.screenshot({path:path.join(output,'structured-desktop.png'),fullPage:true});
 for(const width of [360,768]){await student.page.setViewportSize({width,height:900});const size=await student.page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert(size.scroll<=size.width);check('Structured student lesson fits '+width+'px viewport');await student.page.screenshot({path:path.join(output,'structured-'+width+'.png')});}
 await student.page.reload();await student.page.locator('.shell').waitFor();await student.page.waitForFunction(()=>navigator.serviceWorker.controller!==null);
 const cache=await student.page.evaluate(async()=>{const keys=await caches.keys();const current=await caches.open(keys.find(key=>key==='olawale-shell-v12'));return {assets:(await current.keys()).map(request=>new URL(request.url).pathname),versions:keys};});
 assert(cache.assets.includes('/lesson-renderer.js'));assert(cache.assets.includes('/lesson-document.js'));assert(cache.assets.every(asset=>!asset.startsWith('/api/')));check('Service worker caches shared public modules and no private API responses');
 assert.equal(report.pageErrors.length,0);report.status='PASSED';
 await teacher.context.close();await student.context.close();
}catch(error){report.status='FAILED';report.error=error.stack;process.exitCode=1;}
finally{if(browser)await browser.close();if(server.exitCode===null)await new Promise(resolve=>{server.once('exit',resolve);server.kill();});fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({output,...report},null,2));}
