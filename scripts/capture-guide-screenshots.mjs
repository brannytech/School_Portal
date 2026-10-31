// Assignments in Lesson Studio, end to end: written beside lessons, locked until the teacher releases them in class,
// photo or online answering, instant marking, and copying. Isolated fictional database.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const output=path.resolve('test-results','guide-'+Date.now());fs.mkdirSync(output,{recursive:true});
const server=spawn(process.execPath,['--experimental-sqlite','server.mjs'],{env:{...process.env,DATA_DIR:path.join(output,'fictional-data'),DATABASE_URL:'',STORAGE_DRIVER:'local',NODE_ENV:'test',DEMO_MODE:'true',HOST:'127.0.0.1',PORT:'0'},stdio:['ignore','pipe','pipe']});
let root='',log='',browser,currentPage;
server.stdout.on('data',b=>{log+=b;root=log.match(/ready at (http:\/\/127\.0\.0\.1:\d+)/)?.[1]||'';});server.stderr.on('data',b=>log+=b);
const report={checks:[],pageErrors:[]},check=m=>{report.checks.push(m);console.log('  ✓ '+m);};
async function enter(role){const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'}),page=await context.newPage();page.on('pageerror',e=>report.pageErrors.push(e.message));await page.goto(root);await page.locator(`[data-action="demo"][data-role="${role}"]`).click();await page.locator('.shell').waitFor();return page;}
const api=(page,route,data)=>page.evaluate(async({route,data})=>{const me=await(await fetch('/api/me')).json(),r=await fetch('/api/'+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','X-CSRF-Token':me.csrf},...(data?{body:JSON.stringify(data)}:{})});return {status:r.status,value:await r.json().catch(()=>null)};},{route,data});
const saved=page=>page.waitForFunction(()=>/^All changes saved|^Published/.test(document.querySelector('[data-studio-status]')?.textContent||''),{timeout:20000});
const type=(page,t)=>page.keyboard.type(t,{delay:4});
const shots=path.resolve('docs','images');fs.mkdirSync(shots,{recursive:true});
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==','base64');
const pic=path.join(output,'diagram.png');
{const {deflateSync}=await import('node:zlib');const w=240,h=140,raw=Buffer.alloc((w*3+1)*h);for(let y=0;y<h;y++){raw[y*(w*3+1)]=0;for(let x=0;x<w;x++){const o=y*(w*3+1)+1+x*3,bar=x>30&&x<210&&y>140-(20+((x/40|0)*18));raw[o]=bar?220:245;raw[o+1]=bar?35:245;raw[o+2]=bar?60:245;}}
 const crc=b=>{let c,t=[];for(let n=0;n<256;n++){c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0;}let r=~0;for(const x of b)r=t[(r^x)&255]^(r>>>8);return (~r)>>>0;};
 const chunk=(t,d)=>{const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t),d]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([l,td,c]);};
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=2;
 fs.writeFileSync(pic,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));}
try{
 for(let i=0;i<150&&!root&&server.exitCode===null;i++)await new Promise(r=>setTimeout(r,100));assert(root,log);
 browser=await chromium.launch({headless:true,...(process.env.AUDIT_BROWSER_PATH?{executablePath:process.env.AUDIT_BROWSER_PATH}:{channel:'chrome'})});
 const teacher=await enter('teacher');currentPage=teacher;
 await teacher.locator('[data-page="teaching"]').first().click();await teacher.screenshot({path:path.join(shots,'01-teaching-workspace.png')});check('Teaching workspace captured');
 await teacher.locator('[data-action="studio-open"]').click();await teacher.locator('.st-shell').waitFor();
 await teacher.locator('[data-load-week]').fill('22');await teacher.locator('[data-studio="load"]').click();
 await teacher.waitForFunction(()=>/New week|loaded|draft|saved/i.test(document.querySelector('[data-studio-status]')?.textContent||''));
 await teacher.locator('[data-path="week.title"]').fill('Fractions');
 await teacher.locator('[data-studio="new-lesson"]').first().click();await teacher.locator('[data-path="lesson.title"]').fill('Adding fractions');
 await teacher.locator('.st-editor .tiptap').click();await type(teacher,'Add fractions with a common denominator. ');
 await teacher.locator('[data-studio="text-inline-equation"]').click();
 await teacher.locator('[data-inspector] [data-eq-mode]').selectOption('source');await teacher.locator('[data-inspector] [data-latex]').fill('\\frac{1}{2}+\\frac{1}{3}');await teacher.locator('[data-inspector] [data-eq="apply"]').click();
 await saved(teacher);assert.equal(await teacher.evaluate(()=>getComputedStyle(document.querySelector('.st-editor .katex-mathml')).position),'absolute');check('Equation shows no stray MathML text');await teacher.screenshot({path:path.join(shots,'02-lesson-editor.png')});check('Lesson editor captured');
 await teacher.locator('[data-studio="publish"]').click();await teacher.locator('[data-studio-panel]').waitFor();
 await teacher.screenshot({path:path.join(shots,'03-publish-dialog.png')});check('Publish dialog captured');
 await teacher.locator('[data-studio="publish-confirm"]').click();await teacher.waitForFunction(()=>/^Published/.test(document.querySelector('[data-studio-status]')?.textContent||''),{timeout:20000});
 await teacher.locator('[data-studio="new-assignment"]').click();
 await teacher.locator('[data-path="assign.title"]').fill('Fractions quiz homework');
 await teacher.locator('[data-path="assign.scope"]').selectOption('WEEK_END');
 await teacher.locator('[data-path="assign.mode"]').selectOption('ONLINE');
 await teacher.locator('[data-path="assign.max"]').fill('10');
 await teacher.locator('.st-editor .tiptap').click();await type(teacher,'Answer the questions on the platform.');
 await teacher.screenshot({path:path.join(shots,'04-assignment-settings.png')});check('Assignment settings captured');
 await teacher.locator('[data-studio="assign-tab"][data-tab="questions"]').click();
 await teacher.locator('[data-studio="add-assign"]').click();
 await teacher.locator('[data-path="assign.prompt"]').fill('Read the height of the tallest bar.');
 const chooser=teacher.waitForEvent('filechooser');await teacher.locator('[data-studio="qimage-pick-assign"]').click();await (await chooser).setFiles(pic);
 await teacher.locator('[data-path="assign.imageAlt"]').waitFor();
 await teacher.locator('[data-path="assign.imageAlt"]').fill('Bar chart with five bars rising from left to right');
 await teacher.locator('[data-path="assign.answer"]').fill('5');await teacher.locator('[data-path="assign.explanation"]').fill('The tallest bar is the fifth.');
 assert((await teacher.locator('.st-qimage img').getAttribute('src')).startsWith('/api/media/'));check('A picture can be added to a question and described');
 await teacher.locator('[data-bank-panel]').scrollIntoViewIfNeeded();await teacher.evaluate(()=>{for(const e of document.querySelectorAll('.st-shell *'))if(e.scrollTop>0)e.scrollTop=0;});
 await teacher.screenshot({path:path.join(shots,'05-question-with-picture.png')});check('Question with picture captured');
 await teacher.locator('[data-studio="save"]').click();await teacher.waitForTimeout(800);
 assert.deepEqual(report.pageErrors,[]);check('No page errors');
}catch(error){console.error('FAILED',error.message);try{await currentPage?.screenshot({path:path.join(output,'failure.png')});}catch{}process.exitCode=1;}
finally{await browser?.close();server.kill();}
if(!process.exitCode)console.log('PASSED',output);
