// Studio v2 accessibility: axe at desktop and phone width, keyboard, slash menu semantics, text and target sizes.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const axeSource=fs.readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'),'utf8');
const output=path.resolve('test-results','studio-a11y-'+Date.now());fs.mkdirSync(output,{recursive:true});
const server=spawn(process.execPath,['--experimental-sqlite','server.mjs'],{env:{...process.env,DATA_DIR:path.join(output,'fictional-data'),DATABASE_URL:'',STORAGE_DRIVER:'local',NODE_ENV:'test',DEMO_MODE:'true',HOST:'127.0.0.1',PORT:'0'},stdio:['ignore','pipe','pipe']});
let root='',log='',browser,page;
server.stdout.on('data',b=>{log+=b;root=log.match(/ready at (http:\/\/127\.0\.0\.1:\d+)/)?.[1]||'';});server.stderr.on('data',b=>log+=b);
const report={checks:[]},check=m=>{report.checks.push(m);console.log('  ✓ '+m);};
const axe=async(label)=>{
 await page.evaluate(axeSource);
 const r=await page.evaluate(()=>axe.run('.st-shell',{runOnly:['wcag2a','wcag2aa','wcag21a','wcag21aa']}));
 const bad=r.violations.map(v=>v.id+': '+v.nodes.slice(0,3).map(n=>n.target.join(' ')).join(' | '));
 assert.deepEqual(bad,[],label+' axe violations');check(label+': no axe violations (WCAG 2.1 AA)');
};
try{
 for(let i=0;i<150&&!root&&server.exitCode===null;i++)await new Promise(r=>setTimeout(r,100));assert(root,log);
 browser=await chromium.launch({headless:true,...(process.env.AUDIT_BROWSER_PATH?{executablePath:process.env.AUDIT_BROWSER_PATH}:{channel:'chrome'})});
 const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});page=await context.newPage();
 await page.goto(root);await page.locator('[data-action="demo"][data-role="teacher"]').click();await page.locator('.shell').waitFor();
 await page.locator('[data-page="teaching"]').first().click();await page.locator('[data-action="studio-open"]').click();await page.locator('.st-shell').waitFor();
 await page.locator('[data-load-week]').fill('1');await page.locator('[data-studio="load"]').click();await page.locator('.st-editor .tiptap > *').nth(1).waitFor();
 await axe('Desktop, lesson open');
 // slash menu semantics and keyboard
 await page.locator('.st-editor .tiptap').click();await page.keyboard.press('Control+End');await page.keyboard.press('Enter');await page.keyboard.type('/');
 const menu=page.locator('.studio-slash');await menu.waitFor();
 assert.equal(await menu.getAttribute('role'),'listbox');assert(await menu.locator('[role="option"]').count()>3);
 assert.equal(await menu.locator('[role="option"][aria-selected="true"]').count(),1);check('Slash menu is a listbox with one selected option');
 await axe('Desktop, slash menu open');
 await page.keyboard.press('Escape');await menu.waitFor({state:'detached'}).catch(()=>{});assert.equal(await page.locator('.studio-slash').count(),0);
 check('Escape closes the slash menu');
 // publish dialog: opens, is a dialog, Escape closes
 await page.locator('[data-studio="publish"]').click();const dialog=page.locator('[data-studio-panel]');await dialog.waitFor();
 await axe('Desktop, publish dialog');
 await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('[data-studio-panel]')||document.querySelector('[data-studio-panel]').hidden||!document.querySelector('[data-studio-panel]').offsetParent);
 check('Escape closes the publish dialog');
 // sizes
 const small=await page.evaluate(()=>{const out=[];for(const el of document.querySelectorAll('.st-shell *')){if(!el.childNodes.length||![...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()))continue;const s=getComputedStyle(el);if(s.display==='none'||s.visibility==='hidden'||!el.offsetParent)continue;if(parseFloat(s.fontSize)<12)out.push(el.tagName+'.'+el.className+' '+s.fontSize);}return out.slice(0,5);});
 assert.deepEqual(small,[],'text under 12px');check('No visible text under 12px');
 const targets=await page.evaluate(()=>[...document.querySelectorAll('.st-shell button:not([disabled]), .st-shell summary')].filter(b=>b.offsetParent).map(b=>({t:(b.textContent||'').trim().slice(0,24),h:b.getBoundingClientRect().height,w:b.getBoundingClientRect().width})).filter(b=>b.h<36||b.w<30).slice(0,8));
 assert.deepEqual(targets,[],'small targets');check('Buttons are at least 36px tall');
 await page.setViewportSize({width:360,height:800});await page.waitForTimeout(300);
 await axe('Phone width');
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));check('No sideways scroll at 360px');
 report.status='PASSED';
}catch(e){report.status='FAILED';console.error(e.stack||e);if(page)await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});process.exitCode=1;}
finally{if(browser)await browser.close();if(server.exitCode===null)await new Promise(r=>{server.once('exit',r);server.kill();});console.log('\n'+report.status,output);}
