// School identity and the platform-owner screen in a real browser, with two schools on one installation.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const output=path.resolve('test-results','school-identity-ui-'+Date.now());fs.mkdirSync(output,{recursive:true});
const server=spawn(process.execPath,['--experimental-sqlite','server.mjs'],{env:{...process.env,DATA_DIR:path.join(output,'data'),NODE_ENV:'production',DEMO_MODE:'false',HOST:'127.0.0.1',PORT:'0',SESSION_SECRET:'a-test-only-secret-that-is-long-enough-for-isolated-tests',ADMIN_EMAIL:'head@main.test',ADMIN_PASSWORD:'Main-initial-password-1!',PLATFORM_OWNER_EMAIL:'owner@platform.test',PLATFORM_OWNER_PASSWORD:'Owner-initial-password-1!'},stdio:['ignore','pipe','pipe']});
let root='',log='',browser;const pageErrors=[],check=m=>console.log('  ✓ '+m);
server.stdout.on('data',b=>{log+=b;root=log.match(/ready at (http:\/\/127\.0\.0\.1:\d+)/)?.[1]||'';});server.stderr.on('data',b=>log+=b);
const call=async(prefix,route,data,s={})=>{const r=await fetch(root+'/api/'+prefix+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json',Cookie:s.cookie||'','X-CSRF-Token':s.csrf||''},...(data?{body:JSON.stringify(data)}:{})});return {status:r.status,value:await r.json().catch(()=>null),cookie:r.headers.get('set-cookie')?.split(';')[0]};};
try{
 for(let i=0;i<150&&!root&&server.exitCode===null;i++)await new Promise(r=>setTimeout(r,100));assert(root,log);
 const first=await call('platform/','login',{email:'owner@platform.test',password:'Owner-initial-password-1!'});let o={cookie:first.cookie,csrf:first.value.csrf};
 await call('platform/','change-password',{currentPassword:'Owner-initial-password-1!',newPassword:'Owner-chosen-password-1!'},o);
 const alpha=await call('platform/','create-school',{code:'alpha',name:'Alpha High School',adminEmail:'head@alpha.test'},o);assert.equal(alpha.status,201);
 await call('platform/','create-school',{code:'beta',name:'Beta College',adminEmail:'head@beta.test'},o);
 const a1=await call('','login',{school:'alpha',email:'head@alpha.test',password:alpha.value.temporaryPassword});
 await call('','change-password',{currentPassword:alpha.value.temporaryPassword,newPassword:'Alpha-chosen-password-1!'},{cookie:a1.cookie,csrf:a1.value.csrf});
 const a2=await call('','login',{school:'alpha',email:'head@alpha.test',password:'Alpha-chosen-password-1!'});
 await call('','brand-settings',{name:'Alpha High',motto:'Study well',shortName:'AH',accent:'#8a1c1c'},{cookie:a2.cookie,csrf:a2.value.csrf});
 browser=await chromium.launch({headless:true,...(process.env.AUDIT_BROWSER_PATH?{executablePath:process.env.AUDIT_BROWSER_PATH}:{channel:'chrome'})});
 const context=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'}),page=await context.newPage();page.on('pageerror',e=>pageErrors.push(e.message));

 // Sign-in: the school code swaps in that school's identity.
 await page.goto(root);await page.locator('#school').waitFor();
 await page.locator('#school').fill('alpha');await page.locator('#school').press('Tab');
 await page.locator('.auth-brand',{hasText:'ALPHA HIGH'}).waitFor();
 const colour=await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--green').trim());assert.equal(colour,'#8a1c1c');
 assert.match(await page.title(),/Alpha High/);
 assert(await page.locator('.crest-badge').count()>0,'initials badge until a crest is uploaded');
 await page.screenshot({path:path.join(output,'signin-alpha.png')});check('Sign-in shows the school identity after the school code is typed');
 await page.locator('#school').fill('beta');await page.locator('#school').press('Tab');
 await page.locator('.auth-brand',{hasText:'BETA COLLEGE'}).waitFor();
 assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--green').trim()),'#0064a8','beta has no custom colour, so the default applies');
 check('Another school code shows that school and its default colour');

 // The administrator signs in and edits the school profile.
 await page.locator('#school').fill('alpha');await page.locator('#school').press('Tab');await page.locator('.auth-brand',{hasText:'ALPHA HIGH'}).waitFor();
 await page.locator('[name="email"]').fill('head@alpha.test');await page.locator('#password').fill('Alpha-chosen-password-1!');await page.locator('#auth-form button[type="submit"]').click();
 await page.locator('#school-profile-form').waitFor({timeout:15000});
 await page.locator('#school-profile-form [name="motto"]').fill('Study very well');await page.locator('#school-profile-form button[type="submit"]').click();
 await page.locator('#school-profile-message',{hasText:'saved'}).waitFor();
 await page.screenshot({path:path.join(output,'admin-profile.png')});
 assert((await page.locator('.sidebar .school').innerText()).includes('Study very well'));check('Administrator edits the school profile and the sidebar updates');

 // Owner screen.
 const owner=await context.newPage();owner.on('pageerror',e=>pageErrors.push(e.message));await owner.goto(root+'/platform');
 await owner.locator('#login').waitFor();await owner.locator('#email').fill('owner@platform.test');await owner.locator('#password').fill('Owner-chosen-password-1!');await owner.locator('#login button').click();
 await owner.locator('table tbody tr').first().waitFor();assert.equal(await owner.locator('table tbody tr').count(),3);
 await owner.screenshot({path:path.join(output,'platform.png')});check('Owner screen lists all schools with counts only');
 assert.deepEqual(pageErrors,[]);console.log('\nPASSED '+output);
}catch(e){console.error(e);console.error(log.slice(-1500));process.exitCode=1;}finally{await browser?.close();server.kill();}
