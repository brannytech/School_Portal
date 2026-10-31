// Question authoring v2 in the browser: formulas in prompts, several-answer questions, accepted answers,
// reorder / duplicate / CSV import, and the student experience. Isolated fictional database.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const output=path.resolve('test-results','questions-'+Date.now());fs.mkdirSync(output,{recursive:true});
const server=spawn(process.execPath,['--experimental-sqlite','server.mjs'],{env:{...process.env,DATA_DIR:path.join(output,'fictional-data'),DATABASE_URL:'',STORAGE_DRIVER:'local',NODE_ENV:'test',DEMO_MODE:'true',HOST:'127.0.0.1',PORT:'0'},stdio:['ignore','pipe','pipe']});
let root='',log='',browser,currentPage;
server.stdout.on('data',b=>{log+=b;root=log.match(/ready at (http:\/\/127\.0\.0\.1:\d+)/)?.[1]||'';});server.stderr.on('data',b=>log+=b);
const report={checks:[],pageErrors:[]},check=m=>{report.checks.push(m);console.log('  ✓ '+m);};
async function enter(role){const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'}),page=await context.newPage();page.on('pageerror',e=>report.pageErrors.push(e.message));await page.goto(root);await page.locator(`[data-action="demo"][data-role="${role}"]`).click();await page.locator('.shell').waitFor();return page;}
const api=(page,route,data)=>page.evaluate(async({route,data})=>{const me=await(await fetch('/api/me')).json(),r=await fetch('/api/'+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','X-CSRF-Token':me.csrf},...(data?{body:JSON.stringify(data)}:{})});return {status:r.status,value:await r.json().catch(()=>null)};},{route,data});
const saved=page=>page.waitForFunction(()=>/^All changes saved|^Published/.test(document.querySelector('[data-studio-status]')?.textContent||''),{timeout:20000});
try{
 for(let i=0;i<150&&!root&&server.exitCode===null;i++)await new Promise(r=>setTimeout(r,100));assert(root,log);
 browser=await chromium.launch({headless:true,...(process.env.AUDIT_BROWSER_PATH?{executablePath:process.env.AUDIT_BROWSER_PATH}:{channel:'chrome'})});
 const page=await enter('teacher');currentPage=page;
 await page.locator('[data-page="teaching"]').first().click();await page.locator('[data-action="studio-open"]').click();await page.locator('.st-shell').waitFor();
 await page.locator('[data-load-week]').fill('21');await page.locator('[data-studio="load"]').click();
 await page.waitForFunction(()=>/New week|loaded|draft|saved/i.test(document.querySelector('[data-studio-status]')?.textContent||''));
 await page.locator('[data-path="week.title"]').fill('Even numbers and gases');
 await page.locator('[data-studio="new-lesson"]').first().click();await page.locator('[data-path="lesson.title"]').fill('Practice kinds');
 await page.locator('.st-editor .tiptap').click();await page.keyboard.type('Read, then practise.');
 await page.locator('[data-studio="pane-practice"]').click();

 // several-answer question with a formula in the prompt
 await page.locator('[data-studio="add-practice"]').click();
 await page.locator('[data-question-kind="practice"]').selectOption('multi');
 await page.locator('[data-path="practice.prompt"]').fill('Which values satisfy $x^2=4$ or are even?');
 await page.locator('[data-path="practice.options"]').fill('2\n-2\n3\n5');
 await page.locator('[data-path="practice.answers"][value="2"]').check();await page.locator('[data-path="practice.answers"][value="-2"]').check();
 await page.locator('[data-path="practice.marks"]').fill('2');await page.locator('[data-path="practice.hint"]').fill('Square both signs.');
 await page.locator('[data-path="practice.explanation"]').fill('Both 2 and −2 square to 4.');
 // editing the choices keeps ticked answers that still exist
 await page.locator('[data-path="practice.options"]').fill('2\n-2\n3\n5\n7');assert(await page.locator('[data-path="practice.answers"][value="2"]').isChecked());
 check('Teacher writes a several-answer question with a formula, marks and a hint');

 // short answer with accepted alternatives
 await page.locator('[data-studio="add-practice"]').click();
 await page.locator('[data-question-kind="practice"]').selectOption('short');
 await page.locator('[data-path="practice.prompt"]').fill('Name the gas plants release.');
 await page.locator('[data-path="practice.answer"]').fill('oxygen');await page.locator('[data-path="practice.accepted"]').fill('O2\ndioxygen');
 await page.locator('[data-path="practice.explanation"]').fill('Photosynthesis releases oxygen.');

 // CSV import, duplicate, reorder
 await page.locator('.st-import summary').click();
 await page.locator('[data-csv="practice"]').fill('choice,Which is prime?,4,6,7,9,C,1,,Seven has two factors.\nriddle,Bad row,,,,,x,,,x');
 await page.locator('[data-studio="import-practice"]').click();
 await page.waitForFunction(()=>/1 question imported/.test(document.querySelector('[data-csv-report]')?.textContent||''));
 assert.match(await page.locator('[data-csv-report]').textContent(),/riddle/);
 check('CSV import adds valid rows and reports the invalid one');
 assert.match(await page.locator('[data-bank="practice"]').textContent(),/3\. Which is prime/);
 await page.locator('[data-studio="duplicate-practice"]').click();assert.equal(await page.locator('[data-bank="practice"] option').count(),4);
 for(let i=0;i<3;i++)await page.locator('[data-studio="up-practice"]').click();
 assert.match(await page.locator('[data-bank="practice"] option').first().textContent(),/Which is prime/);
 check('Duplicate and reorder work');

 await page.locator('[data-studio="pane-quiz"]').click();await page.locator('[data-studio="add-quiz"]').click();
 await page.locator('[data-path="quiz.prompt"]').fill('What is $6\\times7$?');await page.locator('[data-path="quiz.answer"]').fill('42');await page.locator('[data-path="quiz.explanation"]').fill('Multiply.');
 await saved(page);
 await page.locator('[data-studio="publish"]').click();await page.locator('[data-studio="publish-confirm"]').click();
 await page.waitForFunction(()=>/^Published/.test(document.querySelector('[data-studio-status]')?.textContent||''),{timeout:20000});
 const rec=(await api(page,'weekly-template?week=21')).value.published,lessonId=rec.lessons[0].id;
 const stored=rec.lessons[0].questions.find(q=>q.kind==='multi');assert.deepEqual(stored.answers.sort(),['-2','2']);assert.equal(stored.marks,2);

 const sp=await enter('student');currentPage=sp;
 await sp.locator('[data-page="learn"]').first().click();
 await sp.locator(`[data-action="open-lesson"][data-id="${lessonId}"]`).click();await sp.locator('.lesson-document').waitFor();
 const tab=sp.locator('[data-action="lesson-tab"][data-tab="practice"]');if(await tab.count())await tab.first().click();
 const multi=sp.locator('.question').filter({hasText:'Which values satisfy'});await multi.waitFor();
 await multi.locator('.katex').first().waitFor({timeout:10000});check('Student sees the formula in the question prompt');
 assert.equal(await multi.locator('input[type=checkbox]').count(),5);assert.match(await multi.textContent(),/2 marks/);
 await multi.locator('input[value="2"]').check();await multi.locator('button[type=submit]').click();
 await multi.locator('.answer-feedback .wrong').waitFor();
 await multi.locator('input[value="-2"]').check();await multi.locator('button[type=submit]').click();
 await multi.locator('.answer-feedback .correct').waitFor();
 check('Student ticks several answers: partial is wrong, all correct is right');
 const short=sp.locator('.question').filter({hasText:'Name the gas'});await short.locator('input[name=answer]').fill('O2');await short.locator('button[type=submit]').click();await short.locator('.answer-feedback .correct').waitFor();
 check('Student typing an accepted alternative is marked correct');
 const visible=(await api(sp,'lesson/'+lessonId)).value;assert(visible.questions.every(q=>q.answer===undefined&&q.answers===undefined&&q.accepted===undefined&&q.explanation===undefined));
 check('Answers, accepted alternatives and explanations never reach the student');
 await sp.setViewportSize({width:360,height:800});assert(await sp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));check('Questions fit 360px');
 assert.deepEqual(report.pageErrors,[]);report.status='PASSED';
}catch(error){report.status='FAILED';console.error(error.stack);if(currentPage)await currentPage.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});process.exitCode=1;}
finally{if(browser)await browser.close();if(server.exitCode===null&&server.signalCode===null)await new Promise(r=>{server.once('exit',r);server.kill();});console.log('\n'+report.status,output);}
