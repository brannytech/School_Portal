// Phase 0 smoke inspection. Uses a new fictional database, never the school database.
// Set PLAYWRIGHT_MODULE to an installed playwright module if it is not locally installed.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const output=path.resolve('test-results','phase-0-browser-'+Date.now());
fs.mkdirSync(output,{recursive:true});
const server=spawn(process.execPath,['--experimental-sqlite','server.mjs'],{
 env:{...process.env,DATA_DIR:path.join(output,'fictional-data'),DATABASE_URL:'',STORAGE_DRIVER:'local',NODE_ENV:'test',DEMO_MODE:'true',PORT:'0',HOST:'127.0.0.1'},
 stdio:['ignore','pipe','pipe']
});
let logs='',root='',browser;
server.stdout.on('data',data=>{logs+=data;root=logs.match(/ready at (http:\/\/127\.0\.0\.1:\d+)/)?.[1]||'';});
server.stderr.on('data',data=>{logs+=data;});
const report={date:new Date().toISOString(),database:'isolated fictional fixture',checks:[],pageErrors:[],consoleErrors:[],httpErrors:[]};
try{
 for(let i=0;i<150&&!root&&server.exitCode===null;i++)await new Promise(r=>setTimeout(r,100));
 assert(root,'Fixture server did not start: '+logs);
 browser=await chromium.launch({headless:true,...(process.env.AUDIT_BROWSER_PATH?{executablePath:process.env.AUDIT_BROWSER_PATH}:{channel:process.env.AUDIT_BROWSER_CHANNEL||'chrome'})});
 for(const role of ['teacher','student','admin']){
  const context=await browser.newContext({viewport:{width:1366,height:900},serviceWorkers:'block'});
  const page=await context.newPage();
  page.on('pageerror',error=>report.pageErrors.push({role,message:error.message}));
  page.on('console',message=>{if(message.type()==='error')report.consoleErrors.push({role,message:message.text()});});
  page.on('response',response=>{if(response.status()>=400)report.httpErrors.push({role,path:new URL(response.url()).pathname,status:response.status()});});
  await page.goto(root);
  await page.locator(`[data-action="demo"][data-role="${role}"]`).click();
  await page.locator('.shell').waitFor();
  await page.screenshot({path:path.join(output,role+'-desktop.png'),fullPage:true});
  report.checks.push({role,check:'Sign in and render role dashboard',passed:true});
  if(role==='teacher'){
   await page.locator('[data-page="teaching"]').first().click();
   await page.locator('[data-action="studio-open"]').click();
   await page.locator('.st-shell').waitFor();
   await page.locator('[data-load-week]').fill('1');await page.locator('[data-studio="load"]').click();
   await page.locator('.st-lessons li').nth(4).waitFor();
   assert.equal(await page.locator('.st-lessons li').count(),5);
   assert.match(await page.locator('[data-studio="pane-quiz"]').textContent(),/Weekly quiz \(20\)/);
   report.checks.push({role,check:'Lesson Studio loads 5 subtopics and 20 quiz questions',passed:true});
   await page.screenshot({path:path.join(output,'teacher-editor.png')});
   await page.setViewportSize({width:360,height:800});
   const editorSize=await page.locator('.st-shell').evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth}));
   report.checks.push({role,check:'360px Lesson Studio has no internal horizontal overflow',passed:editorSize.scroll<=editorSize.client,...editorSize});
   await page.screenshot({path:path.join(output,'teacher-editor-mobile.png')});
   await page.setViewportSize({width:1366,height:900});
   await page.locator('[data-studio="close"]').click();
  }
  if(role==='student'){
   await page.locator('[data-page="learn"]').first().click();
   await page.getByRole('heading',{name:'Your weekly learning path.'}).waitFor();
   await page.locator('[data-action="open-lesson"][data-id="1-1"]').click();
   await page.locator('#subtopic-practice').waitFor();
   const sections=await page.locator('.course-text').allTextContents();
   assert(sections.length>0&&sections.some(v=>v.trim().length>20));
   report.checks.push({role,check:'Released lesson renders explanation and practice',passed:true});
   report.checks.push({role,check:'Existing topic widget visible in weekly renderer',passed:await page.locator('.widget').count()>0,observation:'Recorded as a feature finding, not a required baseline assertion.'});
   await page.screenshot({path:path.join(output,'student-lesson.png'),fullPage:true});
  }
  await page.setViewportSize({width:360,height:800});
  const size=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth}));
  report.checks.push({role,check:'360px page has no horizontal overflow',passed:size.document<=size.viewport,...size});
  await page.screenshot({path:path.join(output,role+'-mobile.png')});
  await context.close();
 }
 assert.equal(report.pageErrors.length,0,'Uncaught browser errors');
 assert(report.checks.every(check=>check.passed),'One or more browser checks failed; inspect report.json.');
 report.status='COMPLETED';
}catch(error){report.status='FAILED';report.error=error.stack;process.exitCode=1;}
finally{
 if(browser)await browser.close();
 if(server.exitCode===null)await new Promise(resolve=>{server.once('exit',resolve);server.kill();});
 fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({output,...report},null,2));
}
