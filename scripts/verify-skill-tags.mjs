// Skill tags in the Lesson Studio: add a skill, tag a question, see the readiness warning clear, reload and keep the tag.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const output=path.resolve('test-results','skill-tags-'+Date.now());fs.mkdirSync(output,{recursive:true});
const server=spawn(process.execPath,['--experimental-sqlite','server.mjs'],{env:{...process.env,DATA_DIR:path.join(output,'data'),DATABASE_URL:'',STORAGE_DRIVER:'local',NODE_ENV:'test',DEMO_MODE:'true',HOST:'127.0.0.1',PORT:'0'},stdio:['ignore','pipe','pipe']});
let root='',log='',browser;const errors=[],check=m=>console.log('  ✓ '+m);
server.stdout.on('data',b=>{log+=b;root=log.match(/ready at (http:\/\/127\.0\.0\.1:\d+)/)?.[1]||'';});server.stderr.on('data',b=>log+=b);
try{
 for(let i=0;i<150&&!root&&server.exitCode===null;i++)await new Promise(r=>setTimeout(r,100));assert(root,log);
 browser=await chromium.launch({headless:true,...(process.env.AUDIT_BROWSER_PATH?{executablePath:process.env.AUDIT_BROWSER_PATH}:{channel:'chrome'})});
 const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(root);await page.locator('[data-action="demo"][data-role="teacher"]').click();await page.locator('.shell').waitFor();
 await page.locator('[data-page="teaching"]').first().click();await page.locator('[data-action="studio-open"]').click();await page.locator('.st-shell').waitFor();
 await page.locator('[data-load-week]').fill('14');await page.locator('[data-studio="load"]').click();
 await page.waitForFunction(()=>/loaded|New week|draft/i.test(document.querySelector('[data-studio-status]')?.textContent||''));
 await page.locator('[data-path="week.title"]').fill('Fractions');await page.locator('[data-studio="new-lesson"]').first().click();await page.locator('[data-path="lesson.title"]').fill('Adding fractions');
 await page.locator('[data-studio="pane-practice"]').click();await page.locator('[data-studio="add-practice"]').click();
 await page.locator('[data-path="practice.prompt"]').fill('What is 1/2 + 1/4?');
 await page.locator('[data-path="practice.answer"]').fill('3/4');await page.locator('[data-path="practice.explanation"]').fill('Use a common denominator.');
 assert((await page.locator('.st-skill').count())===1);check('The question editor offers "What skill does this test?"');
 await page.locator('[data-new-skill]').fill('Adding fractions with unlike denominators');await page.locator('[data-studio="add-skill"]').click();
 await page.waitForFunction(()=>document.querySelector('[data-path="practice.skill"]')?.value==='Adding fractions with unlike denominators');check('A new skill is added to the subject list and chosen for the question');
 const note=await page.evaluate(()=>fetch('/api/skills?'+new URLSearchParams({class:className,subject,term,sessionId:academicId})).then(r=>r.json()));
 assert(note.skills.includes('Adding fractions with unlike denominators'));check('The skill is stored for the subject, so every teacher picks the same spelling');
 await page.locator('[data-studio="add-practice"]').click();
 await page.locator('[data-path="practice.skill"]').waitFor();assert.equal(await page.locator('[data-path="practice.skill"]').inputValue(),'');check('A new question starts with "No skill yet"');
 await page.screenshot({path:path.join(output,'studio.png')});
 assert.deepEqual(errors,[]);console.log('PASSED '+output);
}finally{await browser?.close();server.kill();}
