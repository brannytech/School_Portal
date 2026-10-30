// Lesson Studio v2 end-to-end check: Week 13 notes for Mathematics, English Language and Physics in one workspace.
// After every insertion (equation, inline equation, graph, table, video, image, worked example, callouts, slash menu)
// the caret must land where the teacher can keep typing. Then each note is published and read as a student.
// Uses an isolated fictional database. Run: node scripts/verify-studio-v2.mjs
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const output=path.resolve('test-results','studio-v2-'+Date.now());fs.mkdirSync(output,{recursive:true});
const server=spawn(process.execPath,['--experimental-sqlite','server.mjs'],{env:{...process.env,DATA_DIR:path.join(output,'fictional-data'),DATABASE_URL:'',STORAGE_DRIVER:'local',NODE_ENV:'test',DEMO_MODE:'true',HOST:'127.0.0.1',PORT:'0'},stdio:['ignore','pipe','pipe']});
let root='',log='',browser,currentPage;
server.stdout.on('data',b=>{log+=b;root=log.match(/ready at (http:\/\/127\.0\.0\.1:\d+)/)?.[1]||'';});server.stderr.on('data',b=>log+=b);
const report={date:new Date().toISOString(),checks:[],pageErrors:[]};
const check=message=>{report.checks.push({check:message,passed:true});console.log('  ✓ '+message);};
const WEEK=13,VIDEO='https://www.youtube.com/watch?v=dQw4w9WgXcQ';

// A small valid PNG (red square) to upload as a lesson image.
function makePng(file){
 const crc=zlib.crc32,chunk=(type,data)=>{const body=Buffer.concat([Buffer.from(type),data]),out=Buffer.alloc(12+data.length);out.writeUInt32BE(data.length,0);body.copy(out,4);out.writeUInt32BE(crc(body),8+data.length);return out;};
 const size=24,header=Buffer.alloc(13);header.writeUInt32BE(size,0);header.writeUInt32BE(size,4);header[8]=8;header[9]=2;
 const row=Buffer.concat([Buffer.from([0]),Buffer.concat(Array.from({length:size},()=>Buffer.from([210,40,40])))]);
 fs.writeFileSync(file,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(Buffer.concat(Array.from({length:size},()=>row)))),chunk('IEND',Buffer.alloc(0))]));
}
const PNG=path.join(output,'red-square.png');makePng(PNG);

async function enter(role,viewport={width:1440,height:1000}){
 const context=await browser.newContext({viewport,serviceWorkers:'block'}),page=await context.newPage();
 page.on('pageerror',e=>{report.pageErrors.push({role,message:e.message});});
 await page.goto(root);await page.locator(`[data-action="demo"][data-role="${role}"]`).click();await page.locator('.shell').waitFor();return {page,context};
}
const api=(page,route,data)=>page.evaluate(async({route,data})=>{const me=await(await fetch('/api/me')).json(),r=await fetch('/api/'+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','X-CSRF-Token':me.csrf},...(data?{body:JSON.stringify(data)}:{})});return {status:r.status,value:await r.json().catch(()=>null)};},{route,data});
const saved=page=>page.waitForFunction(()=>/^All changes saved|^Published/.test(document.querySelector('[data-studio-status]')?.textContent||''),{timeout:20000});
const type=async(page,text)=>page.keyboard.type(text,{delay:4});
const editor=page=>page.locator('.st-editor .tiptap');

// Where is the caret? The line (top-level child of the page) that holds it, and what sits directly above that line.
const caret=page=>page.evaluate(()=>{
 const pm=document.querySelector('.st-editor .tiptap'),selection=getSelection();
 const focused=document.activeElement===pm||!!document.activeElement?.closest?.('.tiptap');
 let node=selection.anchorNode;while(node&&node.parentNode!==pm)node=node.parentNode;
 const children=[...pm.children],index=node?children.indexOf(node):-1,above=children[index-1];
 return {focused,index,line:node?.tagName?.toLowerCase()||'',lineText:node?.textContent||'',above:above?(above.dataset?.type||above.tagName.toLowerCase()):null,items:children.map(c=>c.dataset?.type||c.tagName.toLowerCase()),active:document.activeElement?.tagName+(document.activeElement?.dataset?.path?':'+document.activeElement.dataset.path:'')};
});
async function expectNextLine(page,kind,label){
 await page.waitForFunction(()=>!!document.activeElement?.closest?.('.tiptap'),null,{timeout:8000}).catch(()=>{});
 const c=await caret(page);
 assert(c.focused,`${label}: the caret is not on the page (focus is on ${c.active})`);
 assert.equal(c.above,kind,`${label}: the line holding the caret is not directly below the ${kind} item (${c.items.join(',')})`);
 assert.equal(c.line,'p',`${label}: the caret should be in an ordinary line`);
}
const insertMenu=async(page,kind)=>{await page.locator('.st-insert summary').click();await page.locator(`[data-studio="insert"][data-type="${kind}"]`).click();};
const slash=async(page,query)=>{await type(page,'/'+query);await page.locator('.studio-slash').waitFor();await page.keyboard.press('Enter');};
const focusedPath=page=>page.evaluate(()=>document.activeElement?.dataset?.path||document.activeElement?.tagName);
async function applyEquation(page,latex){
 const panel=page.locator('[data-inspector]');await panel.locator('[data-eq-mode]').waitFor();
 await panel.locator('[data-eq-mode]').selectOption('source');await panel.locator('[data-latex]').fill(latex);
 await panel.locator('[data-eq="apply"]').click();
}
async function addQuestion(page,bank,{prompt,answer,explanation,kind,options}){
 await page.locator(`[data-studio="add-${bank}"]`).click();
 if(kind){await page.locator(`[data-question-kind="${bank}"]`).selectOption(kind);}
 await page.locator(`[data-path="${bank}.prompt"]`).fill(prompt);
 if(options){await page.locator(`[data-path="${bank}.options"]`).fill(options.join('\n'));await page.locator(`[data-path="${bank}.answer"]`).selectOption(answer);}
 else await page.locator(`[data-path="${bank}.answer"]`).fill(answer);
 await page.locator(`[data-path="${bank}.explanation"]`).fill(explanation);
}
async function chooseSubject(page,subject){
 await page.locator('[data-page="teaching"]').first().click();
 await page.locator('#subject-switch').selectOption(subject);
 await page.waitForFunction(s=>document.querySelector('#subject-switch')?.value===s,subject);
 await page.locator('[data-action="studio-open"]').waitFor();
}
async function openStudio(page,subject){
 await chooseSubject(page,subject);
 await page.locator('[data-action="studio-open"]').click();await page.locator('.st-shell').waitFor();
 await page.locator('[data-load-week]').fill(String(WEEK));await page.locator('[data-studio="load"]').click();
 await page.waitForFunction(()=>/loaded|New week|draft/i.test(document.querySelector('[data-studio-status]')?.textContent||''));
 assert((await page.locator('.studio-context').textContent()).includes(subject));
}
async function startLesson(page,topic,title){
 await page.locator('[data-path="week.title"]').fill(topic);
 await page.locator('[data-studio="new-lesson"]').first().click();
 await page.locator('[data-path="lesson.title"]').fill(title);
 await editor(page).click();
}

// ---------- subject scripts: type, insert an item, check the caret, keep typing ----------
const notes={
 'Mathematics':async page=>{
  await startLesson(page,'Quadratic equations and their graphs','Solving and sketching quadratics');
  await type(page,'A quadratic equation has the form ax² + bx + c = 0. ');
  await insertMenu(page,'equation');await page.waitForFunction(()=>document.activeElement?.tagName==='MATH-FIELD',null,{timeout:8000});
  await applyEquation(page,'x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}');await expectNextLine(page,'equation','Maths equation');check('Maths: applying a display equation moves the caret to the next line');
  await type(page,'The formula above gives both roots. For example, ');
  await page.locator('[data-studio="text-inline-equation"]').click();await applyEquation(page,'x^2-5x+6=0');
  await page.waitForFunction(()=>!!document.activeElement?.closest?.('.tiptap'),null,{timeout:8000});
  await type(page,' factorises as (x−2)(x−3).');
  assert((await caret(page)).lineText.includes('factorises as (x−2)(x−3).'));check('Maths: an inline equation returns the caret to the same sentence');
  await page.keyboard.press('Enter');
  await insertMenu(page,'graph');await page.waitForFunction(()=>document.activeElement?.closest?.('[data-inspector]'),null,{timeout:8000});
  await page.keyboard.press('Control+Enter');await expectNextLine(page,'graph','Maths graph');await type(page,'The parabola crosses the x-axis at the roots.');check('Maths: a new graph opens its controls, and Ctrl+Enter moves to the next line');
  await page.keyboard.press('Enter');
  await insertMenu(page,'table');assert.equal(await focusedPath(page),'block.caption');await page.keyboard.press('Enter');await expectNextLine(page,'table','Maths table');await type(page,'Table of values for y = x² − 5x + 6.');check('Maths: a new table opens its caption field, and Enter moves to the next line');
  await page.keyboard.press('Enter');
  await page.locator('#studio-heading').selectOption('2');await type(page,'Worked example');await page.keyboard.press('Enter');
  let c=await caret(page);assert.equal(c.line,'p','Enter in a heading starts an ordinary line');assert.equal(c.above,'h2');check('Maths: Enter in a heading moves the caret to the next line');
  await slash(page,'worked');assert.equal(await focusedPath(page),'block.prompt');await type(page,'Solve x² − 5x + 6 = 0.');
  await page.locator('[data-path="block.answer"]').fill('x = 2 or x = 3');await page.locator('[data-path="block.explanation"]').fill('Factorise into (x − 2)(x − 3).');
  await page.locator('[data-path="block.explanation"]').press('Control+Enter');await expectNextLine(page,'worked-example','Maths worked example');await type(page,'Try the practice questions next.');check('Maths: the slash menu adds a worked example and Ctrl+Enter leaves it for the next line');
  await page.keyboard.press('Enter');
  await slash(page,'video');assert.equal(await focusedPath(page),'block.video');await type(page,VIDEO);await page.keyboard.press('Enter');await expectNextLine(page,'video','Maths video');await type(page,'Watch the video again before the quiz.');check('Maths: pasting a video link and pressing Enter moves the caret to the next line');
  await page.keyboard.press('Enter');
  await insertMenu(page,'summary');await type(page,'Roots are where the graph meets the x-axis');await page.locator('[data-path="block.items"]').press('Control+Enter');await expectNextLine(page,'summary','Maths summary');await type(page,'End of week 13.');
  await page.locator('[data-studio="pane-practice"]').click();
  await addQuestion(page,'practice',{prompt:'Find the larger root of x² − 5x + 6 = 0.',answer:'3',explanation:'The roots are 2 and 3.'});
  await page.locator('[data-studio="pane-quiz"]').click();
  await addQuestion(page,'quiz',{prompt:'What is the sum of the roots of x² − 5x + 6 = 0?',answer:'5',explanation:'Sum of roots = −b/a = 5.'});
 },
 'English Language':async page=>{
  await startLesson(page,'Summary writing','How to write a good summary');
  await type(page,'A summary keeps the main points of a passage in fewer words.');await page.keyboard.press('Enter');
  await insertMenu(page,'objectives');assert.equal(await focusedPath(page),'block.items');await type(page,'Find the main idea of each paragraph');await page.keyboard.press('Enter');await type(page,'Rewrite the points in your own words');await page.locator('[data-path="block.items"]').press('Control+Enter');await expectNextLine(page,'objectives','English objectives');check('English: multi-line learning objectives hand the caret to the next line with Ctrl+Enter');
  await type(page,'Read the passage twice before you write.');await page.keyboard.press('Enter');
  await insertMenu(page,'table');await page.keyboard.press('Enter');await expectNextLine(page,'table','English table');await type(page,'The table lists topic sentences and their key words.');await page.keyboard.press('Enter');
  for(const [kind,text] of [['real-life','Summarising news reports helps you explain events to others.'],['hint','Count the key points, not the sentences.'],['warning','Do not copy whole sentences from the passage.']]){
   await insertMenu(page,kind);assert.equal(await focusedPath(page),'block.text');await type(page,text);await page.locator('[data-path="block.text"]').press('Control+Enter');await expectNextLine(page,kind,'English '+kind);await page.keyboard.press('Enter');
  }
  check('English: real-life, hint and warning items each return the caret to a new line');
  await insertMenu(page,'video');await type(page,VIDEO);await page.keyboard.press('Enter');await expectNextLine(page,'video','English video');await type(page,'Discuss the video with a partner.');check('English: a video link followed by Enter continues on the next line');
  await page.keyboard.press('Enter');
  // Insert in the middle of a sentence: the text splits around the new item and the caret lands at the start of the second half.
  await type(page,'Beginning|Ending');for(let i=0;i<6;i++)await page.keyboard.press('ArrowLeft');
  await insertMenu(page,'hint');await type(page,'Inserted mid-sentence.');await page.locator('[data-path="block.text"]').press('Control+Enter');
  await page.waitForFunction(()=>!!document.activeElement?.closest?.('.tiptap'),null,{timeout:8000});await page.keyboard.type('>');
  c=await caret(page);assert.equal(c.lineText,'>Ending','the caret should sit at the start of the second half after a mid-sentence insert');
  assert.equal(c.above,'hint');check('English: inserting mid-sentence splits the text and puts the caret at the start of the second half');
  var c;
  // Toolbar buttons never steal the caret: bold a selection and keep typing.
  await page.keyboard.press('End');await type(page,' Bold me');for(let i=0;i<7;i++)await page.keyboard.press('Shift+ArrowLeft');
  await page.locator('[data-studio="text-bold"]').click();assert((await caret(page)).focused,'bold: focus stays in the page');await page.keyboard.press('End');await type(page,' and carry on.');
  assert(await editor(page).locator('strong').filter({hasText:'Bold me'}).count(),'the selection is bold');check('English: toolbar formatting keeps the caret in the page and typing continues');
  // An image: choose a file, describe it, and carry on writing below it.
  await page.keyboard.press('Enter');
  const [chooser]=await Promise.all([page.waitForEvent('filechooser'),page.locator('.st-insert summary').click().then(()=>page.locator('[data-studio="insert"][data-type="image"]').click())]);await chooser.setFiles(PNG);
  await page.locator('.lesson-item[data-type="image"] img').waitFor({timeout:15000});
  await page.waitForFunction(()=>document.activeElement?.dataset?.path==='block.alt',null,{timeout:8000});await type(page,'A red square used to mark the main idea');
  await page.locator('[data-path="block.caption"]').fill('Figure 1: the main idea marker');await page.locator('[data-path="block.width"]').selectOption('small');
  await page.locator('[data-path="block.alt"]').press('Control+Enter');await expectNextLine(page,'image','English image');await type(page,'The picture shows the idea to look for.');
  check('English: an uploaded image takes alternative text, caption and size, and the caret continues on the next line');
  await page.locator('[data-studio="pane-practice"]').click();
  await addQuestion(page,'practice',{prompt:'Which of these is the main idea of a paragraph?',kind:'choice',options:['The topic sentence','A single example','The title only'],answer:'The topic sentence',explanation:'The topic sentence states the main idea.'});
  await page.locator('[data-studio="pane-quiz"]').click();
  await addQuestion(page,'quiz',{prompt:'A good summary is…',kind:'choice',options:['Shorter than the passage','Longer than the passage'],answer:'Shorter than the passage',explanation:'A summary shortens the passage.'});
 },
 'Physics':async page=>{
  await startLesson(page,'Motion in a straight line','Speed, velocity and acceleration');
  await type(page,'Acceleration is the rate of change of velocity: ');
  await page.locator('[data-studio="text-inline-equation"]').click();await applyEquation(page,'a=\\frac{v-u}{t}');await page.waitForFunction(()=>!!document.activeElement?.closest?.('.tiptap'),null,{timeout:8000});await type(page,', measured in m/s².');check('Physics: an inline equation keeps the caret in the sentence');
  await page.keyboard.press('Enter');
  await slash(page,'equ');await applyEquation(page,'v=u+at');await expectNextLine(page,'equation','Physics equation');await type(page,'Here u is the initial velocity and v is the final velocity.');await page.keyboard.press('Enter');
  await slash(page,'table');await page.keyboard.press('Enter');await expectNextLine(page,'table','Physics table');await type(page,'Velocity of a trolley at one-second intervals.');await page.keyboard.press('Enter');
  await slash(page,'graph');await page.waitForFunction(()=>document.activeElement?.closest?.('[data-inspector]'),null,{timeout:8000});await page.keyboard.press('Control+Enter');await expectNextLine(page,'graph','Physics graph');await type(page,'The gradient of the velocity-time graph is the acceleration.');
  check('Physics: equation, table and graph from the slash menu each reach the next line');
  await page.keyboard.press('Enter');
  await slash(page,'exper');assert.equal(await focusedPath(page),'block.text');await type(page,'Roll a trolley down a ramp and record its time over 1 m.');await page.locator('[data-path="block.text"]').press('Control+Enter');await expectNextLine(page,'experiment','Physics experiment');await type(page,'Record your readings in the table.');await page.keyboard.press('Enter');
  await slash(page,'video');await type(page,'https://youtu.be/dQw4w9WgXcQ');await page.keyboard.press('Enter');await expectNextLine(page,'video','Physics video');await type(page,'Use the video to check your method.');check('Physics: a short youtu.be link is accepted and the caret moves on');
  await page.keyboard.press('Enter');
  await slash(page,'worked');await type(page,'A car moves from 10 m/s to 30 m/s in 5 s. Find a.');await page.locator('[data-path="block.answer"]').fill('4 m/s²');await page.locator('[data-path="block.explanation"]').fill('a = (v − u)/t = 20/5.');await page.locator('[data-path="block.explanation"]').press('Control+Enter');await expectNextLine(page,'worked-example','Physics worked example');
  await page.locator('[data-studio="pane-practice"]').click();
  await addQuestion(page,'practice',{prompt:'A body accelerates from 0 to 12 m/s in 3 s. Find a in m/s².',answer:'4',explanation:'a = 12/3.'});
  await page.locator('[data-studio="pane-quiz"]').click();
  await addQuestion(page,'quiz',{prompt:'Find v when u = 5 m/s, a = 2 m/s² and t = 4 s.',answer:'13',explanation:'v = u + at = 5 + 8.'});
 }
};

const flatText=node=>!node?'':node.type==='text'?node.text:node.type==='inlineMath'?'['+node.attrs.latex+']':(node.content||[]).map(flatText).join('');
const types=week=>week.lessons[0].document.blocks.map(b=>b.type);
const texts=week=>week.lessons[0].document.blocks.filter(b=>b.type==='rich-text').map(b=>flatText(b.content));

try{
 for(let i=0;i<150&&!root&&server.exitCode===null;i++)await new Promise(r=>setTimeout(r,100));assert(root,log);
 browser=await chromium.launch({headless:true,...(process.env.AUDIT_BROWSER_PATH?{executablePath:process.env.AUDIT_BROWSER_PATH}:{channel:process.env.AUDIT_BROWSER_CHANNEL||'chrome'})});
 const admin=await enter('admin');
 for(const subject of ['English Language','Physics'])assert.equal((await api(admin.page,'allocation',{teacher:'teacher',class:'SS1',subject})).status,200);
 check('Administrator allocates English Language and Physics to the same teacher as Mathematics');
 const teacher=await enter('teacher'),page=teacher.page;currentPage=page;
 const published={};
 for(const subject of ['Mathematics','English Language','Physics']){
  console.log('\n'+subject+' · Week '+WEEK);
  await openStudio(page,subject);
  await notes[subject](page);
  await saved(page).catch(()=>{});
  await page.locator('[data-studio="select-lesson"]').first().click();
  await page.screenshot({path:path.join(output,subject.replace(/\s/g,'-')+'-studio.png')});
  await page.locator('[data-studio="publish"]').click();await page.locator('[data-studio="publish-confirm"]').click();
  await page.waitForFunction(()=>/^Published/.test(document.querySelector('[data-studio-status]')?.textContent||''),{timeout:20000});
  const record=(await api(page,`weekly-template?week=${WEEK}&class=SS1&subject=${encodeURIComponent(subject)}&term=1`)).value;
  assert(record.published,subject+': nothing published');published[subject]=record.published;
  assert.equal(Object.values(record.releases)[0].available,true,subject+': the subtopic is live');
  check(subject+': Week 13 published through the Publish dialog');
  await page.locator('[data-studio="close"]').click();await page.locator('.st-shell').waitFor({state:'detached'}).catch(()=>{});
 }
 const titles=Object.fromEntries(Object.entries(published).map(([k,v])=>[k,v.title]));
 assert.deepEqual(titles,{'Mathematics':'Quadratic equations and their graphs','English Language':'Summary writing','Physics':'Motion in a straight line'});
 check('The three Week 13 notes are stored separately in the same workspace: '+JSON.stringify(titles));

 // Order and typed text: text typed after each item lives on the line below it.
 const m=types(published['Mathematics']),mt=texts(published['Mathematics']);
 assert.deepEqual(m,['rich-text','equation','rich-text','graph','rich-text','table','rich-text','worked-example','rich-text','video','rich-text','summary','rich-text'],m.join(','));
 assert.equal(mt[0],'A quadratic equation has the form ax² + bx + c = 0. ');
 assert(mt[1].startsWith('The formula above gives both roots. For example, [x^2-5x+6=0] factorises as (x−2)(x−3).'),mt[1]);
 assert(mt[3].includes('Table of values')&&mt[3].includes('Worked example'),mt[3]);
 assert.equal(published['Mathematics'].lessons[0].document.blocks[1].latex,'x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}');
 assert(!mt.some(v=>!v.trim()),'no blank text lines are published');
 check('Maths note order is exact: text → equation → text with inline equation → graph → text → table → text → worked example → text → video → text → summary → text');
 const e=types(published['English Language']),et=texts(published['English Language']);
 assert(e.includes('objectives')&&e.includes('table')&&e.includes('real-life')&&e.includes('hint')&&e.includes('warning')&&e.includes('video')&&e.includes('image'),e.join(','));
 assert(et.some(v=>v.includes('Beginning|')),et.join(' / '));assert(et.some(v=>v.startsWith('>Ending')),'text after the mid-sentence insert');
 const imageBlock=published['English Language'].lessons[0].document.blocks.find(b=>b.type==='image');
 assert.equal(imageBlock.alt,'A red square used to mark the main idea');assert.equal(imageBlock.width,'small');assert.equal(imageBlock.caption,'Figure 1: the main idea marker');
 check('English note keeps the split sentence, bold text, callouts and the described image in order');
 const p=types(published['Physics']),pt=texts(published['Physics']);
 assert(pt[0].startsWith('Acceleration is the rate of change of velocity: [a=\\frac{v-u}{t}], measured in m/s²'),pt[0]);
 assert(published['Physics'].lessons[0].document.blocks.some(b=>b.type==='equation'&&b.latex==='v=u+at'));
 assert(published['Physics'].lessons[0].document.blocks.some(b=>b.type==='video'&&b.videoId==='dQw4w9WgXcQ'));assert(p.includes('experiment')&&p.includes('graph')&&p.includes('table')&&p.includes('worked-example'));
 check('Physics note stores its equation, graph, table, experiment and normalised video id');

 // Student view for each subject.
 const student=await enter('student'),sp=student.page;
 for(const subject of ['Mathematics','English Language','Physics']){
  await sp.locator('[data-page="learn"]').first().click();await sp.locator('#subject-switch').selectOption(subject);
  await sp.waitForFunction(s=>document.querySelector('#subject-switch')?.value===s,subject);
  const lessonId=published[subject].lessons[0].id;
  await sp.getByText('Week 13 ·').first().waitFor({timeout:10000});
  await sp.locator(`[data-action="open-lesson"][data-id="${lessonId}"]`).click();await sp.locator('.lesson-document').waitFor();if(subject!=='English Language')await sp.locator('.lesson-document .katex').first().waitFor({timeout:10000});await sp.waitForTimeout(400);
  const facts=await sp.evaluate(async()=>{const img=document.querySelector('.lesson-document img');if(img&&!img.complete)await new Promise(r=>{img.onload=img.onerror=r;});return {katex:document.querySelectorAll('.lesson-document .katex').length,frames:document.querySelectorAll('.lesson-document iframe').length,tables:document.querySelectorAll('.lesson-document table').length,graphs:document.querySelectorAll('.lesson-document [data-math-graph], .lesson-document .math-graph, .lesson-document canvas, .lesson-document svg').length,image:img?{alt:img.alt,loaded:img.naturalWidth>0,caption:img.closest('figure')?.querySelector('figcaption')?.textContent}:null,blank:[...document.querySelectorAll('.lesson-document p')].filter(p=>!p.textContent.trim()&&!p.querySelector('*')).length,overflow:document.documentElement.scrollWidth>innerWidth};});
  if(subject==='Mathematics')assert(facts.katex>=2&&facts.frames>=1&&facts.tables>=1&&facts.graphs>=1,JSON.stringify(facts));
  if(subject==='English Language'){assert(facts.frames>=1&&facts.tables>=1&&facts.katex===0,JSON.stringify(facts));assert.equal(facts.image?.alt,'A red square used to mark the main idea');assert(facts.image.loaded,'the lesson image loads for the student');assert.equal(facts.image.caption,'Figure 1: the main idea marker');}
  if(subject==='Physics')assert(facts.katex>=2&&facts.frames>=1&&facts.tables>=1&&facts.graphs>=1,JSON.stringify(facts));
  assert.equal(facts.blank,0,subject+': students should not see blank spacer lines');assert(!facts.overflow);
  await sp.screenshot({path:path.join(output,subject.replace(/\s/g,'-')+'-student.png'),fullPage:true});
  check(subject+': student sees the published Week 13 note ('+JSON.stringify(facts)+')');
  await sp.locator('[data-page="learn"]').first().click();
 }

 // Undo: an inserted item and its new line go together in one step.
 await openStudio(page,'Mathematics');await editor(page).click();await page.keyboard.press('Control+End');
 const before=await page.locator('.st-editor .tiptap > *').count();
 await insertMenu(page,'table');assert.equal(await page.locator('.st-editor .tiptap > *').count()>before,true);
 await page.locator('[data-studio="undo"]').click();assert.equal(await page.locator('.st-editor .tiptap > *').count(),before);
 check('Undo removes an inserted item and its new line together');

 assert.equal(report.pageErrors.length,0,JSON.stringify(report.pageErrors));report.status='PASSED';
}catch(error){report.status='FAILED';report.error=error.stack;console.error(error.stack);if(currentPage)await currentPage.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});process.exitCode=1;}
finally{if(browser)await browser.close();if(server.exitCode===null&&server.signalCode===null)await new Promise(resolve=>{server.once('exit',resolve);server.kill();});fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log('\n'+report.status,output);}
