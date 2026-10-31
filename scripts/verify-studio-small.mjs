// Lesson Studio on small laptop windows: the page keeps the screen, panels are drawers, menus stay on screen.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const axeSource=fs.readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'),'utf8');
const output=path.resolve('test-results','studio-small-'+Date.now());fs.mkdirSync(output,{recursive:true});
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
const open=async(w,h)=>{
 const context=await browser.newContext({viewport:{width:w,height:h},serviceWorkers:'block'});page=await context.newPage();
 await page.goto(root);await page.locator('[data-action="demo"][data-role="teacher"]').click();await page.locator('.shell').waitFor();
 await page.evaluate(()=>document.querySelector('[data-page="teaching"]')?.click());await page.evaluate(()=>document.querySelector('[data-action="studio-open"]')?.click());await page.locator('.st-shell').waitFor();
 if(w<=1100)await page.locator('[data-studio="drawer-outline"]').click();
 await page.locator('[data-load-week]').fill('1');await page.locator('[data-studio="load"]').click();await page.waitForTimeout(600);
};
const box=sel=>page.evaluate(s=>{const e=document.querySelector(s);if(!e)return null;const b=e.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height,r:b.right,b:b.bottom}},sel);
try{
 for(let i=0;i<150&&!root&&server.exitCode===null;i++)await new Promise(r=>setTimeout(r,100));assert(root,log);
 browser=await chromium.launch({headless:true,...(process.env.AUDIT_BROWSER_PATH?{executablePath:process.env.AUDIT_BROWSER_PATH}:{channel:'chrome'})});
 for(const [w,h] of [[1024,600],[800,560],[700,560],[360,640],[1000,380]]){
  await open(w,h);const label=`${w}×${h}`;
  const wide=w>1100;
  const main=await box('.st-main'),outline=await box('.st-outline'),inspector=await box('.st-inspector');
  assert(main.w>=w*0.9,`${label}: the page area uses the window width (${Math.round(main.w)} of ${w})`);check(`${label}: page area is ${Math.round(main.w)}px wide`);
  assert(main.h>=h*0.7,`${label}: the page area uses the window height (${Math.round(main.h)} of ${h})`);check(`${label}: page area is ${Math.round(main.h)}px tall`);
  assert(outline.r<=main.x+1&&inspector.x>=main.r-1,label+': panels are tucked away');check(`${label}: outline and settings are collapsed`);
  // Typing works straight away: nothing sits on top of the page.
  await page.locator('[data-studio="drawer-outline"]').click();await page.locator('[data-studio="new-lesson"]').first().click();await page.waitForTimeout(300);
  assert.equal(await page.locator('.st-outline').isVisible(),false,label+': choosing from the outline closes it');check(`${label}: choosing a subtopic closes the outline`);
  await page.locator('.st-editor .tiptap').click({timeout:5000});await page.keyboard.type('Typing works at this size.');
  assert.match(await page.locator('.st-editor .tiptap').innerText(),/Typing works at this size\./);check(`${label}: can click and type on the page`);
  // Drawers: aria-expanded, Escape.
  const btn=page.locator('[data-studio="drawer-inspector"]');await btn.click();
  assert.equal(await btn.getAttribute('aria-expanded'),'true');assert.equal(await page.locator('.st-inspector').isVisible(),true);
  assert.equal(await page.evaluate(()=>document.activeElement?.closest('.st-inspector')!==null),true,'focus moves into the drawer');
  await page.keyboard.press('Escape');await page.waitForTimeout(300);
  assert.equal(await page.locator('.st-inspector').isVisible(),false);assert.equal(await btn.getAttribute('aria-expanded'),'false');check(`${label}: settings drawer opens and Escape closes it`);
  // Long text then the slash menu near the bottom stays inside the window.
  await page.locator('.st-editor .tiptap').click();for(let i=0;i<25;i++)await page.keyboard.type('\nLine '+i);
  await page.keyboard.type('\n/');const menu=page.locator('.studio-slash');await menu.waitFor();await page.waitForTimeout(250);
  const m=await box('.studio-slash');assert(m.y>=0&&m.b<=h+0.5,`${label}: slash menu inside the window (${Math.round(m.y)}–${Math.round(m.b)} of ${h})`);check(`${label}: slash menu fits on screen (${Math.round(m.y)}–${Math.round(m.b)} of ${h})`);
  await page.keyboard.press('ArrowUp');await page.keyboard.press('ArrowUp');await page.waitForTimeout(150);
  const active=await page.evaluate(()=>{const a=document.querySelector('.studio-slash .is-active'),m=document.querySelector('.studio-slash');const ar=a.getBoundingClientRect(),mr=m.getBoundingClientRect();return ar.top>=mr.top-1&&ar.bottom<=mr.bottom+1;});
  assert(active,label+': the selected option scrolls into view');check(`${label}: keyboard selection stays visible in the menu`);
  await page.keyboard.press('Escape');
  await page.context().close();
 }
 assert.deepEqual(report.checks.filter(c=>/FAIL/.test(c)),[]);
}catch(error){console.error('FAILED',error.message);try{await page?.screenshot({path:path.join(output,'failure.png')});}catch{}process.exitCode=1;}
finally{await browser?.close();server.kill();}
if(!process.exitCode)console.log('PASSED',output);
