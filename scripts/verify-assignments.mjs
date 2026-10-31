// Assignments in Lesson Studio, end to end: written beside lessons, locked until the teacher releases them in class,
// photo or online answering, instant marking, and copying. Isolated fictional database.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const output=path.resolve('test-results','assignments-'+Date.now());fs.mkdirSync(output,{recursive:true});
const server=spawn(process.execPath,['--experimental-sqlite','server.mjs'],{env:{...process.env,DATA_DIR:path.join(output,'fictional-data'),DATABASE_URL:'',STORAGE_DRIVER:'local',NODE_ENV:'test',DEMO_MODE:'true',HOST:'127.0.0.1',PORT:'0'},stdio:['ignore','pipe','pipe']});
let root='',log='',browser,currentPage;
server.stdout.on('data',b=>{log+=b;root=log.match(/ready at (http:\/\/127\.0\.0\.1:\d+)/)?.[1]||'';});server.stderr.on('data',b=>log+=b);
const report={checks:[],pageErrors:[]},check=m=>{report.checks.push(m);console.log('  ✓ '+m);};
async function enter(role){const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'}),page=await context.newPage();page.on('pageerror',e=>report.pageErrors.push(e.message));await page.goto(root);await page.locator(`[data-action="demo"][data-role="${role}"]`).click();await page.locator('.shell').waitFor();return page;}
const api=(page,route,data)=>page.evaluate(async({route,data})=>{const me=await(await fetch('/api/me')).json(),r=await fetch('/api/'+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','X-CSRF-Token':me.csrf},...(data?{body:JSON.stringify(data)}:{})});return {status:r.status,value:await r.json().catch(()=>null)};},{route,data});
const saved=page=>page.waitForFunction(()=>/^All changes saved|^Published/.test(document.querySelector('[data-studio-status]')?.textContent||''),{timeout:20000});
const type=(page,t)=>page.keyboard.type(t,{delay:4});
try{
 for(let i=0;i<150&&!root&&server.exitCode===null;i++)await new Promise(r=>setTimeout(r,100));assert(root,log);
 browser=await chromium.launch({headless:true,...(process.env.AUDIT_BROWSER_PATH?{executablePath:process.env.AUDIT_BROWSER_PATH}:{channel:'chrome'})});
 const teacher=await enter('teacher');currentPage=teacher;
 await teacher.locator('[data-page="teaching"]').first().click();await teacher.locator('[data-action="studio-open"]').click();await teacher.locator('.st-shell').waitFor();
 await teacher.locator('[data-load-week]').fill('22');await teacher.locator('[data-studio="load"]').click();
 await teacher.waitForFunction(()=>/New week|loaded|draft|saved/i.test(document.querySelector('[data-studio-status]')?.textContent||''));
 await teacher.locator('[data-path="week.title"]').fill('Fractions');
 await teacher.locator('[data-studio="new-lesson"]').first().click();await teacher.locator('[data-path="lesson.title"]').fill('Adding fractions');
 await teacher.locator('.st-editor .tiptap').click();await type(teacher,'Add fractions with a common denominator.');
 await saved(teacher);
 await teacher.locator('[data-studio="publish"]').click();await teacher.locator('[data-studio="publish-confirm"]').click();
 await teacher.waitForFunction(()=>/^Published/.test(document.querySelector('[data-studio-status]')?.textContent||''),{timeout:20000});
 const lessonId=(await api(teacher,'weekly-template?week=22')).value.published.lessons[0].id;

 // 1. Photo assignment that follows the lesson, with a formula in the instructions.
 await teacher.locator('[data-studio="new-assignment"]').click();
 await teacher.waitForFunction(()=>document.querySelector('[data-path="assign.title"]')?.value==='New assignment');
 await teacher.locator('[data-path="assign.title"]').fill('Fractions homework');
 await teacher.locator('[data-path="assign.scope"]').selectOption('LESSON');
 await teacher.locator('[data-path="assign.lesson"]').selectOption(lessonId);
 await teacher.locator('[data-path="assign.max"]').fill('20');
 await teacher.locator('.st-editor .tiptap').click();await type(teacher,'Do exercise 3 in your note. Show every step. ');
 await teacher.locator('[data-studio="text-inline-equation"]').click();
 await teacher.locator('[data-inspector] [data-eq-mode]').selectOption('source');await teacher.locator('[data-inspector] [data-latex]').fill('\\frac{1}{2}+\\frac{1}{3}');await teacher.locator('[data-inspector] [data-eq="apply"]').click();
 await teacher.waitForFunction(()=>!!document.activeElement?.closest?.('.tiptap'));await type(teacher,' is your first question.');
 await saved(teacher);
 assert.match(await teacher.locator('[data-outline-assignment]').first().locator('..').textContent(),/Locked/);
 check('Teacher writes a photo assignment beside the lesson; it is locked by default');

 // 2. Online assignment with questions, marked at once.
 await teacher.locator('[data-studio="new-assignment"]').click();
 await teacher.waitForFunction(()=>document.querySelectorAll('[data-outline-assignment]').length===2&&document.querySelector('[data-path="assign.title"]')?.value==='New assignment');
 await teacher.locator('[data-path="assign.title"]').fill('Fractions quiz homework');
 await teacher.locator('[data-path="assign.scope"]').selectOption('WEEK_END');
 await teacher.locator('[data-path="assign.mode"]').selectOption('ONLINE');
 await teacher.locator('[data-path="assign.max"]').fill('10');
 await teacher.locator('.st-editor .tiptap').click();await type(teacher,'Answer both questions on the platform.');
 await teacher.locator('[data-studio="assign-tab"][data-tab="questions"]').click();
 await teacher.locator('[data-studio="add-assign"]').click();
 await teacher.locator('[data-path="assign.prompt"]').fill('What is $\\frac{1}{2}+\\frac{1}{2}$?');await teacher.locator('[data-path="assign.answer"]').fill('1');await teacher.locator('[data-path="assign.explanation"]').fill('Halves add to a whole.');await teacher.locator('[data-path="assign.marks"]').fill('2');
 await teacher.locator('[data-studio="add-assign"]').click();
 await teacher.locator('[data-question-kind="assign"]').selectOption('multi');
 await teacher.locator('[data-path="assign.prompt"]').fill('Which are equal to one half?');await teacher.locator('[data-path="assign.options"]').fill('2/4\n1/3\n3/6');
 await teacher.locator('[data-path="assign.answers"][value="2/4"]').check();await teacher.locator('[data-path="assign.answers"][value="3/6"]').check();await teacher.locator('[data-path="assign.explanation"]').fill('2/4 and 3/6 simplify to 1/2.');await teacher.locator('[data-path="assign.marks"]').fill('2');
 await saved(teacher);
 check('Teacher writes an online end-of-week assignment with questions');

 // 3. Student sees both as locked.
 const student=await enter('student');currentPage=student;
 await student.locator('[data-page="assignments"]').first().click();
 await student.locator('article.thread').filter({hasText:'Fractions homework'}).waitFor();
 assert.equal(await student.locator('article.thread:has-text("Locked")').count(),2);assert.equal(await student.locator('article.thread').filter({hasText:'Fractions'}).locator('[data-action="assignment-open"]').count(),0);
 const hidden=(await api(student,'state')).value.assignments.filter(a=>/Fractions/.test(a.title));assert(hidden.every(a=>a.document===undefined&&a.questions===undefined),'locked work exposes no content');
 check('Students see both assignments as locked, with no content');

 // 4. Teacher releases one from the Assignments page (in class) and one from the Studio.
 await teacher.locator('[data-studio="close"]').click();await teacher.locator('.st-shell').waitFor({state:'detached'}).catch(()=>{});
 await teacher.locator('[data-page="assignments"]').first().click();
 const homework=teacher.locator('article.thread').filter({hasText:'Fractions homework'});
 await homework.locator('[data-action="assignment-release-open"]').click();
 await teacher.locator('#modal [name="due"]').fill('2099-12-31');await teacher.locator('#modal form button').click();
 await teacher.locator('article.thread').filter({hasText:'Fractions homework'}).getByText('Released').waitFor();
 check('Teacher releases the photo assignment from the Assignments page');

 await teacher.locator('[data-page="teaching"]').first().click();await teacher.locator('[data-action="studio-open"]').click();await teacher.locator('.st-shell').waitFor();
 await teacher.locator('[data-load-week]').fill('22');await teacher.locator('[data-studio="load"]').click();
 await teacher.locator('[data-studio="select-assignment"]').filter({hasText:'Fractions quiz homework'}).click();
 await teacher.locator('[data-studio="assign-release"]').click();await teacher.locator('[data-assign-due]').fill('2099-12-31');await teacher.locator('[data-studio="assign-release-confirm"]').click();
 await teacher.locator('[data-studio="select-assignment"]').filter({hasText:'Fractions quiz homework'}).getByText('Released').waitFor();
 check('Teacher releases the online assignment from Lesson Studio');

 // 5. Student opens both.
 await student.reload();await student.locator('.shell').waitFor();await student.locator('[data-page="assignments"]').first().click();
 await student.locator('article.thread').filter({hasText:'Fractions homework'}).locator('[data-action="assignment-open"]').click();
 await student.locator('#modal .lesson-document .katex').first().waitFor({timeout:10000});
 assert.match(await student.locator('#modal').textContent(),/Do exercise 3/);assert(await student.locator('#modal [data-form="submission"]').count()===1);
 check('Student opens the photo assignment: instructions with a formula and a photo upload');
 await student.locator('#modal [data-action="close-modal"]').click();
 await student.locator('article.thread').filter({hasText:'Fractions quiz homework'}).locator('[data-action="assignment-open"]').click();
 const form=student.locator('#modal [data-form="assignment-online"]');await form.waitFor();
 await form.locator('.question').first().locator('.katex').first().waitFor({timeout:10000});
 await form.locator('input[name]').first().fill('1');
 await form.locator('input[type=checkbox][value="2/4"]').check();
 await form.locator('button').first().click();
 await form.locator('.answer-feedback').getByText(/scored/).waitFor();
 assert.match(await form.locator('.answer-feedback').textContent(),/You scored 5 out of 10 \(50%\)/);
 check('Student answers online: partial answer scores 50% straight away, with explanations');
 await student.reload();await student.locator('.shell').waitFor();await student.locator('[data-page="assignments"]').first().click();
 await student.locator('article.thread').filter({hasText:'Fractions quiz homework'}).getByText(/Marked/).waitFor();
 const sub=(await api(student,'state')).value.submissions.find(v=>v.online);assert.equal(sub.score,5);assert.equal(sub.max,10);
 check('The score is stored on the submission, so progress and monitoring count it');

 // 6. Copy.
 await teacher.locator('[data-studio="select-assignment"]').filter({hasText:'Fractions quiz homework'}).click();
 await teacher.locator('[data-studio="assign-copy"]').click();await teacher.locator('[data-studio="assign-copy-confirm"]').click();
 await teacher.waitForFunction(()=>document.querySelectorAll('[data-outline-assignment]').length===3);
 assert.equal(await teacher.locator('[data-studio="select-assignment"]').filter({hasText:'Fractions quiz homework'}).filter({hasText:'Locked'}).count(),1);
 check('Teacher copies an assignment: the copy appears locked, ready to adjust');
 await student.setViewportSize({width:360,height:800});assert(await student.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));check('Assignments page fits 360px');
 assert.deepEqual(report.pageErrors,[]);report.status='PASSED';
}catch(error){report.status='FAILED';console.error(error.stack);if(currentPage)await currentPage.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});process.exitCode=1;}
finally{if(browser)await browser.close();if(server.exitCode===null&&server.signalCode===null)await new Promise(r=>{server.once('exit',r);server.kill();});console.log('\n'+report.status,output);}
