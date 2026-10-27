import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const output=path.resolve('test-results','studio-ribbon-'+Date.now());fs.mkdirSync(output,{recursive:true});
const server=spawn(process.execPath,['--experimental-sqlite','server.mjs'],{env:{...process.env,DATA_DIR:path.join(output,'fictional-data'),DATABASE_URL:'',STORAGE_DRIVER:'local',NODE_ENV:'test',DEMO_MODE:'true',HOST:'127.0.0.1',PORT:'0'},stdio:['ignore','pipe','pipe']});
let root='',log='',browser,page;server.stdout.on('data',b=>{log+=b;root=log.match(/ready at (http:\/\/127\.0\.0\.1:\d+)/)?.[1]||'';});server.stderr.on('data',b=>log+=b);
const report={checks:[],pageErrors:[],scope:'Isolated fictional database; desktop and emulated mobile Chrome'};
const check=check=>report.checks.push({check,passed:true});
const tab=name=>page.getByRole('tab',{name,exact:true});
const action=name=>page.locator(`[data-studio="${name}"]`).first();
const field=name=>page.locator(`[data-path="${name}"]`);
async function saved(){await page.waitForFunction(()=>document.querySelector('[data-studio-status]')?.textContent.startsWith('All changes saved'),null,{timeout:20000});}
async function api(route){return page.evaluate(async route=>(await fetch('/api/'+route)).json(),route);}
async function question(bank,prompt,answer){const panel=page.locator(`[data-bank-panel="${bank}"]`);if(!await panel.evaluate(el=>el.open))await panel.locator('summary').click();await action('add-'+bank).click();await field(bank+'.prompt').fill(prompt);await field(bank+'.answer').fill(answer);await field(bank+'.explanation').fill('Substitute the value into the equation.');}
try{
 for(let i=0;i<150&&!root&&server.exitCode===null;i++)await new Promise(r=>setTimeout(r,100));assert(root,log);
 browser=await chromium.launch({headless:true,channel:process.env.AUDIT_BROWSER_CHANNEL||'chrome'});const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>report.pageErrors.push(e.message));
 await page.goto(root);await page.locator('[data-action="demo"][data-role="teacher"]').click();await page.locator('.shell').waitFor();await page.locator('[data-action="studio-open"]').click();await tab('Home').waitFor();
 assert.equal(await tab('Home').getAttribute('aria-selected'),'true');assert.equal(await page.locator('.studio-setup').isVisible(),false);assert.equal(await page.locator('.studio-properties').isVisible(),false);assert(await page.locator('.studio-canvas').isVisible());
 await tab('Home').focus();await tab('Home').press('ArrowRight');assert.equal(await tab('Insert').getAttribute('aria-selected'),'true');
 check('Home opens to a clean lesson page; setup and questions are hidden; ribbon supports keyboard navigation');
 await tab('File').click();await page.locator('[data-load-week]').fill('9');await action('load').click();await page.waitForFunction(()=>document.querySelector('[data-path="week.title"]')?.value==='');await page.locator('[data-studio="start-document"]').click();
 await field('lesson.title').fill('Exploring quadratic functions');await page.locator('.studio-rich-editor .tiptap').fill('A quadratic function creates a curved graph called a parabola.');await tab('File').click();await field('week.title').fill('Functions and graphs');await tab('Home').click();
 // Select actual document text, then use the remote ribbon without destroying selection.
 await page.locator('.studio-rich-editor .tiptap').evaluate(el=>{el.focus();const r=document.createRange();r.selectNodeContents(el);const selection=getSelection();selection.removeAllRanges();selection.addRange(r);});await page.getByRole('button',{name:'Bold',exact:true}).click();assert.equal(await page.locator('.studio-rich-editor strong').textContent(),'A quadratic function creates a curved graph called a parabola.');
 await tab('Insert').click();await tab('Home').click();assert(await page.locator('.studio-rich-editor strong').isVisible());await saved();
 check('Create lesson starts direct writing; title, remote bold formatting and text survive ribbon switches and autosave');
 await tab('Insert').click();await page.getByRole('button',{name:'Add graph',exact:true}).click();await page.locator('[data-graph-field="parameter.0.value"]').fill('2');await page.locator('[data-graph-field="parameter.1.value"]').fill('3');await page.locator('[data-graph-field="parameter.2.value"]').fill('-2');await page.waitForFunction(()=>document.querySelector('.studio-block.selected [data-equation]')?.textContent.includes('2x² + 3x − 2'));
 await page.getByRole('button',{name:'Add table',exact:true}).click();await field('block.headers.0').fill('x');await field('block.headers.1').fill('y');await field('block.rows.0.0').fill('0');await field('block.rows.0.1').fill('-2');await field('block.rows.1.0').fill('1');await field('block.rows.1.1').fill('3');
 await tab('Home').click();await action('duplicate').click();assert.equal(await page.locator('.studio-block[data-kind="table"]').count(),2);await action('undo').click();assert.equal(await page.locator('.studio-block[data-kind="table"]').count(),1);
 await page.locator('.studio-block[data-kind="table"] [data-studio="select"]').click();await tab('Home').click();await action('up').click();const order=await page.locator('[data-block]').evaluateAll(els=>els.map(el=>el.dataset.kind));assert.deepEqual(order,['table','graph','rich-text']);
 check('Insert ribbon creates editable graphs and tables; Home duplicate, undo and reorder controls act on the selected item');
 await tab('Questions').click();await question('practice','Evaluate y = 2x² + 3x − 2 at x = 0.','-2');await question('quiz','What is the coefficient of x²?','2');await tab('Review').click();assert.equal(await page.locator('[data-readiness]').textContent(),'Ready to publish');await saved();
 await action('preview').click();assert.equal(await page.locator('[data-question-preview]').count(),2);assert.equal(await page.locator('.studio-preview').textContent().then(v=>v.includes('Substitute the value')),false);await page.screenshot({path:path.join(output,'preview.png')});await action('hide-panel').click();await action('publish').click();await page.waitForFunction(()=>document.querySelector('[data-studio-status]')?.textContent.startsWith('Published'));
 const record=await api('weekly-template?week=9');assert(record.published);assert.equal(record.published.lessons[0].document.blocks.length,2);assert.equal(record.published.lessons[0].document.blocks[1].graph.parameters[0].value,2);
 check('Questions and Review tabs preserve drafts; preview hides answer feedback and publication retains all authored items');
 await tab('Home').click();await page.locator('.studio-block[data-kind="rich-text"] [data-studio="select"]').first().click();await page.locator('.studio-workspace').evaluate(el=>el.scrollTop=0);await page.screenshot({path:path.join(output,'desktop.png')});
 for(const width of [768,360]){await page.setViewportSize({width,height:950});assert(await page.locator('.content-studio-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth));assert(await page.locator('.studio-workspace').evaluate(el=>el.scrollWidth<=el.clientWidth));await page.locator('.studio-rich-editor .tiptap').click();await page.keyboard.press('End');await page.keyboard.type(' Explore the graph.');await tab('Insert').click();await page.getByRole('button',{name:'Add equation',exact:true}).click();await page.locator('math-field').waitFor();await action('symbol').first().click();await action('apply-equation').click();await tab('Home').click();await page.locator('.studio-block[data-kind="rich-text"] [data-studio="select"]').first().click();await page.locator('.studio-workspace').evaluate(el=>el.scrollTop=0);await page.screenshot({path:path.join(output,`layout-${width}.png`)});await saved();}
 check('Tablet and mobile retain the page layout, text editing, ribbon access and visual equation insertion without workspace overflow');
 await tab('File').click();await action('blank-template').click();await action('publish').click();await page.locator('.studio-checklist').waitFor();await page.locator('[data-studio="fix-issue"]').first().click();assert.equal(await tab('File').getAttribute('aria-selected'),'true');assert(await field('week.title').evaluate(el=>el===document.activeElement));
 check('Publication checklist opens the correct hidden toolkit and focuses the missing field');
 assert.deepEqual(report.pageErrors,[]);report.status='PASSED';
}catch(error){report.status='FAILED';report.error=error.stack;process.exitCode=1;if(page)await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});}
finally{if(browser)await browser.close();if(server.exitCode===null&&server.signalCode===null)await new Promise(resolve=>{server.once('exit',resolve);server.kill();});fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({output,...report},null,2));}
