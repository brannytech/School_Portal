// First-run sign-in and the school owner page, exactly as printed in the terminal, in a real browser.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const output=path.resolve('test-results','login-owner-'+Date.now());fs.mkdirSync(output,{recursive:true});
const env={...process.env,DATA_DIR:path.join(output,'data'),PORT:'0',HOST:'127.0.0.1'};delete env.DEMO_MODE;delete env.NODE_ENV;delete env.PLATFORM_OWNER_EMAIL;delete env.ADMIN_PASSWORD;
const start=()=>{const p=spawn(process.execPath,['--experimental-sqlite','server.mjs'],{env,stdio:['ignore','pipe','pipe']});p.log='';p.on('error',()=>{});p.stdout.on('data',b=>p.log+=b);p.stderr.on('data',b=>p.log+=b);return p;};
const ready=async p=>{for(let i=0;i<150&&!/ready at/.test(p.log)&&p.exitCode===null;i++)await new Promise(r=>setTimeout(r,100));assert(/ready at/.test(p.log),p.log);return p.log.match(/ready at (http:\/\/127\.0\.0\.1:\d+)/)[1];};
const check=m=>console.log('  ✓ '+m);let server=start(),browser;
try{
 const root=await ready(server);
 const admin={email:server.log.match(/Email:\s+(\S+)/)[1],password:server.log.match(/Password:\s+(\S+)/)[1]};
 const owner={email:server.log.match(/Email:\s+(\S+)[\s\S]*Email:\s+(\S+)/)[2],password:server.log.match(/Password:\s+(\S+)[\s\S]*Password:\s+(\S+)/)[2]};
 assert(server.log.indexOf('FIRST RUN')<server.log.indexOf('ready at'));assert(/\/platform/.test(server.log));check('The terminal prints the administrator and owner sign-ins, and where the owner page is');
 browser=await chromium.launch({headless:true,...(process.env.AUDIT_BROWSER_PATH?{executablePath:process.env.AUDIT_BROWSER_PATH}:{channel:'chrome'})});
 const signIn=async(email,password,school)=>{const page=await (await browser.newContext({serviceWorkers:'block'})).newPage();await page.goto(root);
  if(school){await page.locator('[data-other-school]').click();await page.locator('#school').fill(school);}
  await page.locator('#email').fill(email);await page.locator('#password').fill(password);await page.locator('[type=submit]').first().click();await page.waitForTimeout(1800);return page;};
 let page=await signIn(admin.email,admin.password);assert((await page.locator('body').innerText()).includes('Choose your own password'));check('The printed administrator password signs in (first run)');
 page=await signIn(admin.email,admin.password,'main');assert((await page.locator('body').innerText()).includes('Choose your own password'));check('"Sign in to a different school" shows a school code box; the code "main" works');
 page=await signIn(admin.email,admin.password,'nosuchschool');assert((await page.locator('body').innerText()).includes('School code not recognised'));check('A wrong school code says so clearly');
 assert(await (await browser.newContext()).newPage().then(async p=>{await p.goto(root);await p.locator('#email').waitFor();await p.waitForTimeout(800);return p.locator('a[href="/platform"]').count();})===1);check('The sign-in page links to the platform owner page');
 // Stop and start again on the same data: the same password must still work, and no new password is printed.
 server.kill();await new Promise(r=>server.once('exit',r));server=start();const root2=await ready(server);
 assert(!/FIRST RUN/.test(server.log));assert(/Sign-in mode: real school data/.test(server.log));assert(/Data folder:/.test(server.log));check('A second start prints no new password and says which data folder it uses');
 const again=await (await browser.newContext({serviceWorkers:'block'})).newPage();await again.goto(root2);await again.locator('#email').fill(admin.email);await again.locator('#password').fill(admin.password);await again.locator('[type=submit]').first().click();await again.waitForTimeout(1800);
 assert((await again.locator('body').innerText()).includes('Choose your own password'));check('After a restart the same temporary password still works');
 // Owner page: sign in with the printed owner details.
 const op=await (await browser.newContext({serviceWorkers:'block'})).newPage();await op.goto(root2+'/platform');
 const res=await op.evaluate(async([e,p])=>{const r=await fetch('/api/platform/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:e,password:p})});return r.status;},[owner.email,owner.password]);assert.equal(res,200);check('The owner page accepts the printed owner sign-in');
 server.kill();await new Promise(r=>server.once('exit',r));
 // Forgotten password: the reset command gives a new one that works.
 const {spawnSync}=await import('node:child_process');
 const r=spawnSync(process.execPath,['--experimental-sqlite','scripts/reset-admin.mjs'],{env,encoding:'utf8'});assert.equal(r.status,0,r.stderr);const fresh=r.stdout.match(/Temporary password: (\S+)/)[1];
 server=start();const root3=await ready(server);const p3=await (await browser.newContext({serviceWorkers:'block'})).newPage();await p3.goto(root3);await p3.locator('#email').fill(admin.email);await p3.locator('#password').fill(fresh);await p3.locator('[type=submit]').first().click();await p3.waitForTimeout(1800);
 assert((await p3.locator('body').innerText()).includes('Choose your own password'));check('npm run reset-admin gives a new temporary password that works');
 console.log('PASSED '+output);
}finally{await browser?.close();server.kill();}
