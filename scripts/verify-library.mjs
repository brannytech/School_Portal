// The lesson library in the browser: a teacher copies weeks into another term, and cannot overwrite existing weeks.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const output=path.resolve('test-results','library-ui-'+Date.now());fs.mkdirSync(output,{recursive:true});
const server=spawn(process.execPath,['--experimental-sqlite','server.mjs'],{env:{...process.env,DATA_DIR:path.join(output,'fictional-data'),DATABASE_URL:'',STORAGE_DRIVER:'local',NODE_ENV:'test',DEMO_MODE:'true',HOST:'127.0.0.1',PORT:'0'},stdio:['ignore','pipe','pipe']});
let root='',log='',browser;const errors=[];
server.stdout.on('data',b=>{log+=b;root=log.match(/ready at (http:\/\/127\.0\.0\.1:\d+)/)?.[1]||'';});server.stderr.on('data',b=>log+=b);
try{
 for(let i=0;i<150&&!root&&server.exitCode===null;i++)await new Promise(r=>setTimeout(r,100));assert(root,log);
 browser=await chromium.launch({headless:true,...(process.env.AUDIT_BROWSER_PATH?{executablePath:process.env.AUDIT_BROWSER_PATH}:{channel:'chrome'})});
 const context=await browser.newContext({viewport:{width:1280,height:1000},serviceWorkers:'block'}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(root);await page.locator('[data-action="demo"][data-role="teacher"]').click();await page.locator('.shell').waitFor();
 await page.locator('[data-page="teaching"]').first().click();
 await page.locator('[data-action="library-open"]').click();await page.locator('[data-library-form]').waitFor();
 await page.screenshot({path:path.join(output,'library.png')});
 // Term 1 already has these weeks, so nothing is replaced.
 await page.locator('[data-library-form] button[type="submit"]').click();
 await page.locator('[data-library-message]',{hasText:'not replaced'}).waitFor();console.log('  ✓ Existing weeks are never replaced');
 // Copy into term 2.
 await page.locator('[data-library-form] select[name="term"]').selectOption('2');
 await page.locator('[data-library-form] button[type="submit"]').click();
 await page.locator('[data-library-message]',{hasText:'Copied weeks 1, 2, 3, 4, 5, 6, 7, 8'}).waitFor();console.log('  ✓ A teacher copies eight library weeks into term 2');
 assert.deepEqual(errors,[]);console.log('\nPASSED '+output);
}catch(e){console.error(e);console.error(log.slice(-1200));process.exitCode=1;}finally{await browser?.close();server.kill();}
