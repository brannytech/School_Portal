// Studio v2: interactive graph + toolkit authoring, legacy lessons opening/saving, history, phone widths.
// Isolated fictional database. Run: node scripts/verify-studio-interactive.mjs
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const output=path.resolve('test-results','studio-interactive-'+Date.now());fs.mkdirSync(output,{recursive:true});
const server=spawn(process.execPath,['--experimental-sqlite','server.mjs'],{env:{...process.env,DATA_DIR:path.join(output,'fictional-data'),DATABASE_URL:'',STORAGE_DRIVER:'local',NODE_ENV:'test',DEMO_MODE:'true',HOST:'127.0.0.1',PORT:'0'},stdio:['ignore','pipe','pipe']});
let root='',log='',browser,currentPage;
server.stdout.on('data',b=>{log+=b;root=log.match(/ready at (http:\/\/127\.0\.0\.1:\d+)/)?.[1]||'';});server.stderr.on('data',b=>log+=b);
const report={date:new Date().toISOString(),checks:[],pageErrors:[]};
const check=m=>{report.checks.push({check:m,passed:true});console.log('  ✓ '+m);};
async function enter(role,viewport={width:1440,height:1000}){
 const context=await browser.newContext({viewport,serviceWorkers:'block'}),page=await context.newPage();
 page.on('pageerror',e=>report.pageErrors.push({role,message:e.message}));
 await page.goto(root);await page.locator(`[data-action="demo"][data-role="${role}"]`).click();await page.locator('.shell').waitFor();return page;
}
const api=(page,route,data)=>page.evaluate(async({route,data})=>{const me=await(await fetch('/api/me')).json(),r=await fetch('/api/'+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','X-CSRF-Token':me.csrf},...(data?{body:JSON.stringify(data)}:{})});return {status:r.status,value:await r.json().catch(()=>null)};},{route,data});
const saved=page=>page.waitForFunction(()=>/^All changes saved|^Published/.test(document.querySelector('[data-studio-status]')?.textContent||''),{timeout:20000});
const insertMenu=async(page,kind)=>{await page.locator('.st-insert summary').click();await page.locator(`[data-studio="insert"][data-type="${kind}"]`).click();};
async function openWeek(page,week){
 await page.locator('[data-page="teaching"]').first().click();
 await page.locator('[data-action="studio-open"]').click();await page.locator('.st-shell').waitFor();
 await page.locator('[data-load-week]').fill(String(week));await page.locator('[data-studio="load"]').click();
 await page.waitForFunction(()=>/loaded|New week|draft|saved/i.test(document.querySelector('[data-studio-status]')?.textContent||''));
}
try{
 for(let i=0;i<150&&!root&&server.exitCode===null;i++)await new Promise(r=>setTimeout(r,100));assert(root,log);
 browser=await chromium.launch({headless:true,...(process.env.AUDIT_BROWSER_PATH?{executablePath:process.env.AUDIT_BROWSER_PATH}:{channel:process.env.AUDIT_BROWSER_CHANNEL||'chrome'})});
 const page=await enter('teacher');currentPage=page;

 // 1. A legacy lesson (written before the new editor, no document) opens with its content and saves without losing it.
 const legacy=(await api(page,'weekly-template?week=1')).value.published;
 const lesson=legacy.lessons[0];assert(lesson,'demo week 1 has a lesson');
 await openWeek(page,1);
 const items=await page.locator('.st-editor .tiptap > *').count();assert(items>1,'the legacy lesson shows content on the page');
 const titleBefore=await page.locator('[data-path="lesson.title"]').inputValue();assert.equal(titleBefore,lesson.title);
 await page.locator('.st-editor .tiptap').click();await page.keyboard.press('Control+End');await page.keyboard.type('Checked in the new Studio.');
 await saved(page);
 const draft=(await api(page,'weekly-template?week=1')).value.draft.week.lessons[0];
 assert(draft.document?.blocks?.length>0,'saving converts the legacy lesson to a document');
 assert(JSON.stringify(draft.document).includes('Checked in the new Studio.'));
 assert.equal(draft.questions.length,lesson.questions.length,'practice questions are kept');
 check('Legacy lesson opens in the new Studio, accepts an edit, and keeps its title and questions');
 const published=(await api(page,'weekly-template?week=1')).value.published.lessons[0];
 assert(!JSON.stringify(published).includes('Checked in the new Studio.'),'draft edits stay private until publishing');
 check('The edit stays in the private draft; the live lesson is unchanged');

 // 2. Version history lists the publication and restore is offered.
 await page.locator('[data-studio="history"]').click();await page.locator('[data-history-version]').waitFor();
 check('Version history opens');await page.locator('[data-studio="hide-panel"]').click();

 // 3. Author a graph and a toolkit item on a new week, publish, and use them as a student.
 await page.locator('[data-load-week]').fill('20');await page.locator('[data-studio="load"]').click();
 await page.waitForFunction(()=>/New week|loaded|draft|saved/i.test(document.querySelector('[data-studio-status]')?.textContent||''));
 await page.locator('[data-path="week.title"]').fill('Graphs and tools');
 await page.locator('[data-studio="new-lesson"]').first().click();await page.locator('[data-path="lesson.title"]').fill('Explore a parabola');
 await page.locator('.st-editor .tiptap').click();
 await insertMenu(page,'graph');await page.locator('[data-inspector] [data-graph-field="title"]').fill('Saved parabola');
 await page.locator('.st-editor [data-features]').waitFor();assert((await page.locator('.st-editor [data-features]').textContent()).includes('Roots: -1, 3'));
 await page.locator('[data-studio="continue-writing"]').click();await page.keyboard.type('Move the sliders.');await page.keyboard.press('Enter');
 await insertMenu(page,'math-tool');await page.locator('[data-inspector] [data-tool-kind]').waitFor();
 await page.locator('[data-inspector] [data-tool-kind]').selectOption('geometry');await page.locator('[data-inspector] .geometry-svg').waitFor();
 check('Teacher authors an interactive graph and a geometry toolkit as lesson items');
 await page.setViewportSize({width:360,height:800});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.setViewportSize({width:1440,height:1000});
 check('Studio does not scroll sideways at 360px');
 await saved(page);
 await page.locator('[data-studio="publish"]').click();await page.locator('[data-studio="publish-confirm"]').click();
 await page.waitForFunction(()=>/^Published/.test(document.querySelector('[data-studio-status]')?.textContent||''),{timeout:20000});
 const rec=(await api(page,'weekly-template?week=20')).value.published,lessonId=rec.lessons[0].id;
 assert.deepEqual(rec.lessons[0].document.blocks.map(b=>b.type).filter(t=>t!=='rich-text'),['graph','math-tool']);

 const sp=await enter('student');currentPage=sp;
 await sp.locator('[data-page="learn"]').first().click();
 await sp.locator(`[data-action="open-lesson"][data-id="${lessonId}"]`).click();await sp.locator('.lesson-document .math-interactive').first().waitFor({timeout:15000});
 const graph=sp.locator('.lesson-document .math-interactive').first();
 await graph.locator('[data-param="a"]').evaluate(el=>{el.value=-1;el.dispatchEvent(new Event('input',{bubbles:true}));});
 assert((await graph.locator('[data-features]').textContent()).includes('Opens downward'));
 await graph.locator('[data-math-action="reset"]').click();
 check('Student sliders update the published graph');
 await sp.setViewportSize({width:360,height:800});
 assert(await sp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));check('Published interactive lesson fits 360px');
 assert.equal((await api(sp,'weekly-template?week=20')).status,403);check('Students cannot read teacher drafts');
 assert.deepEqual(report.pageErrors,[]);report.status='PASSED';
}catch(error){report.status='FAILED';report.error=error.stack;console.error(error.stack);if(currentPage)await currentPage.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});process.exitCode=1;}
finally{if(browser)await browser.close();if(server.exitCode===null&&server.signalCode===null)await new Promise(r=>{server.once('exit',r);server.kill();});fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log('\n'+report.status,output);}
