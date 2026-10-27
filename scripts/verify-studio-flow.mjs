// Week 13 multi-subject authoring check: Mathematics, English Language and Physics in one workspace.
// Verifies that after every insertion (equation, inline equation, graph, table, video, worked example and others)
// the caret moves to the right place and typing continues on the next line, then publishes and reads each note as a student.
// Uses an isolated fictional database. Run: node scripts/verify-studio-flow.mjs
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const output=path.resolve('test-results','studio-flow-'+Date.now());fs.mkdirSync(output,{recursive:true});
const server=spawn(process.execPath,['--experimental-sqlite','server.mjs'],{env:{...process.env,DATA_DIR:path.join(output,'fictional-data'),DATABASE_URL:'',STORAGE_DRIVER:'local',NODE_ENV:'test',DEMO_MODE:'true',HOST:'127.0.0.1',PORT:'0'},stdio:['ignore','pipe','pipe']});
let root='',log='',browser,currentPage;
server.stdout.on('data',b=>{log+=b;root=log.match(/ready at (http:\/\/127\.0\.0\.1:\d+)/)?.[1]||'';});server.stderr.on('data',b=>log+=b);
const report={date:new Date().toISOString(),checks:[],pageErrors:[]};
const check=message=>{report.checks.push({check:message,passed:true});console.log('  ✓ '+message);};
const WEEK=13,VIDEO='https://www.youtube.com/watch?v=dQw4w9WgXcQ';

async function enter(role,viewport={width:1440,height:1000}){
 const context=await browser.newContext({viewport}),page=await context.newPage();
 page.on('pageerror',e=>report.pageErrors.push({role,message:e.message}));
 await page.goto(root);await page.locator(`[data-action="demo"][data-role="${role}"]`).click();await page.locator('.shell').waitFor();return {page,context};
}
const api=(page,route,data)=>page.evaluate(async({route,data})=>{const me=await(await fetch('/api/me')).json(),r=await fetch('/api/'+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','X-CSRF-Token':me.csrf},...(data?{body:JSON.stringify(data)}:{})});return {status:r.status,value:await r.json().catch(()=>null)};},{route,data});
const tab=(page,name)=>page.getByRole('tab',{name,exact:true}).click();
const saved=page=>page.waitForFunction(()=>/^All changes saved|^Published/.test(document.querySelector('[data-studio-status]')?.textContent||''),{timeout:20000});

// Where is the caret? Reports the focused control and which lesson item holds it.
const where=page=>page.evaluate(()=>{
 const a=document.activeElement,card=a?.closest?.('[data-block]'),cards=[...document.querySelectorAll('.studio-block')];
 return {inText:!!a?.closest?.('.tiptap'),tag:a?.tagName,path:a?.dataset?.path||'',label:a?.getAttribute?.('aria-label')||'',kind:card?.dataset.kind||'',index:card?cards.indexOf(card):-1,selected:cards.findIndex(c=>c.classList.contains('selected')),count:cards.length};
});
const kinds=page=>page.evaluate(()=>[...document.querySelectorAll('.studio-block')].map(c=>c.dataset.kind));
// The caret must sit in an empty-or-text line directly below the item that was just inserted.
async function expectNextLine(page,itemKind,label){
 await page.waitForFunction(()=>!!document.activeElement?.closest?.('.tiptap'),null,{timeout:8000}).catch(()=>{});
 const w=await where(page),list=await kinds(page);
 assert(w.inText,`${label}: caret is not in a text line (focus is on ${w.tag} ${w.path||w.label})`);
 assert.equal(list[w.index-1],itemKind,`${label}: the line holding the caret is not directly below the ${itemKind} item (${list.join(',')})`);
}
// A freshly inserted table or graph keeps the caret inside the item so it can be configured; Ctrl+Enter then moves to the next line.
async function leaveItem(page,kind,label){
 await page.waitForFunction(()=>{const a=document.activeElement;return a&&a.closest&&a.closest('.studio-block.selected')&&!a.closest('.tiptap');},null,{timeout:8000});
 await page.keyboard.press('Control+Enter');await expectNextLine(page,kind,label);
}
async function type(page,text){await page.keyboard.type(text,{delay:5});}
async function insert(page,type){await tab(page,'Insert');await page.locator(`[data-studio="insert"][data-type="${type}"]`).click();}
async function insertMore(page,type){await tab(page,'Insert');await page.locator('[data-insert-type]').selectOption(type);await page.locator('[data-studio="insert"]:not([data-type])').click();}
async function applyEquation(page,latex){
 await page.locator('[data-studio-panel] [data-math-mode]').waitFor();
 await page.locator('[data-math-mode]').selectOption('source');await page.locator('[data-latex]').fill(latex);
 await page.locator('[data-studio="apply-equation"]').click();await page.locator('[data-studio-panel]').waitFor({state:'hidden'});
}
async function openBank(page,name){await tab(page,'Questions');const bank=page.locator(`[data-bank-panel="${name}"]`);if(!await bank.evaluate(el=>el.open))await bank.locator('summary').click();}
async function addQuestion(page,bank,{prompt,answer,explanation,kind,options}){
 await openBank(page,bank);await page.locator(`[data-studio="add-${bank}"]`).click();await openBank(page,bank);
 if(kind){await page.locator(`[data-question-kind="${bank}"]`).selectOption(kind);await openBank(page,bank);}
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
 await page.locator('[data-action="studio-open"]').click();await page.locator('.content-studio-dialog').waitFor();
 await tab(page,'File');await page.locator('[data-load-week]').fill(String(WEEK));await page.locator('[data-studio="load"]').click();
 await page.waitForFunction(()=>document.querySelector('[data-studio-status]')?.textContent.match(/loaded/));
 assert((await page.locator('.content-studio-dialog .studio-context').textContent()).includes(subject));
}
async function startLesson(page,topic,title){
 await tab(page,'File');await page.locator('[data-path="week.title"]').fill(topic);
 await page.locator('[data-studio="start-document"]').click();   // creates the first lesson and moves the caret into the page
 await page.locator('[data-path="lesson.title"]').fill(title);
}

// ---------- subject scripts: every step types text, inserts an item, checks the caret, then keeps typing ----------
const notes={
 'Mathematics':async page=>{
  await startLesson(page,'Quadratic equations and their graphs','Solving and sketching quadratics');
  await page.locator('[data-studio="write"]').first().click();await type(page,'A quadratic equation has the form ax² + bx + c = 0. ');
  await insert(page,'equation');await page.waitForFunction(()=>document.activeElement?.tagName==='MATH-FIELD',null,{timeout:8000}).catch(()=>{});
  assert.equal((await where(page)).tag,'MATH-FIELD','equation: the visual editor should hold the caret');
  await applyEquation(page,'x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}');await expectNextLine(page,'equation','Maths equation');check('Maths: applying a display equation moves the caret to the next line');
  await type(page,'The formula above gives both roots. For example, ');
  await tab(page,'Insert');await page.locator('[data-studio="text-inline-equation"]').click();await applyEquation(page,'x^2-5x+6=0');
  await page.waitForFunction(()=>!!document.activeElement?.closest?.('.tiptap'),null,{timeout:8000}).catch(()=>{});assert((await where(page)).inText,'inline equation: caret should return to the text');await type(page,' factorises as (x−2)(x−3).');check('Maths: an inline equation returns the caret to the same sentence');
  await insert(page,'graph');await leaveItem(page,'graph','Maths graph');await type(page,'The parabola crosses the x-axis at the roots.');check('Maths: a new graph keeps the caret in the graph controls, and Ctrl+Enter moves to the next line');
  await insert(page,'table');await page.waitForFunction(()=>document.activeElement?.dataset?.path==='block.caption');await leaveItem(page,'table','Maths table');await type(page,'Table of values for y = x² − 5x + 6.');check('Maths: a new table opens its caption field, and Ctrl+Enter moves to the next line');
  await insertMore(page,'heading');assert.equal((await where(page)).path,'block.text','heading: the heading text should hold the caret');await type(page,'Worked example');await page.keyboard.press('Enter');await expectNextLine(page,'heading','Maths heading');check('Maths: Enter in a heading moves the caret to the next line');
  await insertMore(page,'worked-example');assert.equal((await where(page)).path,'block.prompt');await type(page,'Solve x² − 5x + 6 = 0.');
  await page.locator('[data-path="block.answer"]').fill('x = 2 or x = 3');await page.locator('[data-path="block.explanation"]').fill('Factorise into (x − 2)(x − 3).');
  await page.locator('[data-path="block.explanation"]').press('Control+Enter');await expectNextLine(page,'worked-example','Maths worked example');await type(page,'Try the practice questions next.');check('Maths: Ctrl+Enter leaves a worked example for the next line');
  await insert(page,'video');assert.equal((await where(page)).path,'block.video','video: the link field should hold the caret');await type(page,VIDEO);await page.keyboard.press('Enter');await expectNextLine(page,'video','Maths video');await type(page,'Watch the video again before the quiz.');check('Maths: pasting a video link and pressing Enter moves the caret to the next line');
  await insertMore(page,'summary');await type(page,'Roots are where the graph meets the x-axis');await page.locator('[data-path="block.items"]').press('Control+Enter');await expectNextLine(page,'summary','Maths summary');await type(page,'End of week 13.');
  await addQuestion(page,'practice',{prompt:'Find the larger root of x² − 5x + 6 = 0.',answer:'3',explanation:'The roots are 2 and 3.'});
  await addQuestion(page,'quiz',{prompt:'What is the sum of the roots of x² − 5x + 6 = 0?',answer:'5',explanation:'Sum of roots = −b/a = 5.'});
 },
 'English Language':async page=>{
  await startLesson(page,'Summary writing','How to write a good summary');
  await page.locator('[data-studio="write"]').first().click();await type(page,'A summary keeps the main points of a passage in fewer words.');
  await insertMore(page,'objectives');assert.equal((await where(page)).path,'block.items');await type(page,'Find the main idea of each paragraph');await page.keyboard.press('Enter');await type(page,'Rewrite the points in your own words');await page.locator('[data-path="block.items"]').press('Control+Enter');await expectNextLine(page,'objectives','English objectives');check('English: learning objectives (multi-line) hand the caret to the next line with Ctrl+Enter');
  await type(page,'Read the passage twice before you write.');
  await insert(page,'table');await leaveItem(page,'table','English table');await type(page,'The table lists topic sentences and their key words.');check('English: a new table opens its caption field, and Ctrl+Enter moves to the next line');
  await insertMore(page,'real-life');assert.equal((await where(page)).path,'block.text');await type(page,'Summarising news reports helps you explain events to others.');await page.locator('[data-path="block.text"]').press('Control+Enter');await expectNextLine(page,'real-life','English real-life');
  await insertMore(page,'hint');await type(page,'Count the key points, not the sentences.');await page.locator('[data-path="block.text"]').press('Control+Enter');await expectNextLine(page,'hint','English hint');
  await insertMore(page,'warning');await type(page,'Do not copy whole sentences from the passage.');await page.locator('[data-path="block.text"]').press('Control+Enter');await expectNextLine(page,'warning','English warning');check('English: real-life, hint and warning items each return the caret to a new line');
  await insert(page,'video');await type(page,VIDEO);await page.keyboard.press('Enter');await expectNextLine(page,'video','English video');await type(page,'Discuss the video with a partner.');check('English: a video link followed by Enter continues on the next line');
  // Insert in the middle of a sentence: the text must split around the new item and the caret must land in the second half.
  await type(page,' Beginning|Ending');for(let i=0;i<6;i++)await page.keyboard.press('ArrowLeft');
  await insertMore(page,'paragraph');assert.equal((await where(page)).path,'block.text');await type(page,'Inserted mid-sentence.');await page.locator('[data-path="block.text"]').press('Control+Enter');
  const w=await where(page);assert(w.inText);await page.keyboard.type('>');
  assert.equal(await page.locator('.studio-block.selected .tiptap').textContent(),'>Ending','caret should sit at the start of the second half after a mid-sentence insert');check('English: inserting mid-sentence splits the text and puts the caret at the start of the second half');
  await addQuestion(page,'practice',{prompt:'Which of these is the main idea of a paragraph?',kind:'choice',options:['The topic sentence','A single example','The title only'],answer:'The topic sentence',explanation:'The topic sentence states the main idea.'});
  await addQuestion(page,'quiz',{prompt:'A good summary is…',kind:'choice',options:['Shorter than the passage','Longer than the passage'],answer:'Shorter than the passage',explanation:'A summary shortens the passage.'});
 },
 'Physics':async page=>{
  await startLesson(page,'Motion in a straight line','Speed, velocity and acceleration');
  await page.locator('[data-studio="write"]').first().click();await type(page,'Acceleration is the rate of change of velocity: ');
  await tab(page,'Insert');await page.locator('[data-studio="text-inline-equation"]').click();await applyEquation(page,'a=\\frac{v-u}{t}');await type(page,', measured in m/s².');check('Physics: an inline equation keeps the caret in the sentence');
  await insert(page,'equation');await applyEquation(page,'v=u+at');await expectNextLine(page,'equation','Physics equation');await type(page,'Here u is the initial velocity and v is the final velocity.');
  await insert(page,'table');await leaveItem(page,'table','Physics table');await type(page,'Velocity of a trolley at one-second intervals.');
  await insert(page,'graph');await leaveItem(page,'graph','Physics graph');await type(page,'The gradient of the velocity-time graph is the acceleration.');check('Physics: equation, table and graph each reach the next line (Apply / Ctrl+Enter)');
  await insertMore(page,'experiment');assert.equal((await where(page)).path,'block.text');await type(page,'Roll a trolley down a ramp and record its time over 1 m.');await page.locator('[data-path="block.text"]').press('Control+Enter');await expectNextLine(page,'experiment','Physics experiment');await type(page,'Record your readings in the table.');
  await insert(page,'video');await type(page,'https://youtu.be/dQw4w9WgXcQ');await page.keyboard.press('Enter');await expectNextLine(page,'video','Physics video');await type(page,'Use the video to check your method.');check('Physics: a short youtu.be link is accepted and the caret moves on');
  await insertMore(page,'worked-example');await type(page,'A car moves from 10 m/s to 30 m/s in 5 s. Find a.');await page.locator('[data-path="block.answer"]').fill('4 m/s²');await page.locator('[data-path="block.explanation"]').fill('a = (v − u)/t = 20/5.');await page.locator('[data-path="block.explanation"]').press('Control+Enter');await expectNextLine(page,'worked-example','Physics worked example');
  await addQuestion(page,'practice',{prompt:'A body accelerates from 0 to 12 m/s in 3 s. Find a in m/s².',answer:'4',explanation:'a = 12/3.'});
  await addQuestion(page,'quiz',{prompt:'Find v when u = 5 m/s, a = 2 m/s² and t = 4 s.',answer:'13',explanation:'v = u + at = 5 + 8.'});
 }
};

// ---------- reading the saved note: structure, order and typed text ----------
const flatText=node=>!node?'':node.type==='text'?node.text:node.type==='inlineMath'?'['+node.attrs.latex+']':(node.content||[]).map(flatText).join('');
const outline=week=>week.lessons[0].document.blocks.map(b=>b.type==='rich-text'?'text:'+flatText(b.content):b.type+(b.latex?':'+b.latex:'')+(b.videoId?':'+b.videoId:''));

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
  await page.screenshot({path:path.join(output,subject.replace(/\s/g,'-')+'-studio.png')});
  await page.locator('[data-studio="publish"]').click();
  await page.waitForFunction(()=>/^Published/.test(document.querySelector('[data-studio-status]')?.textContent||'')||document.querySelector('.studio-checklist'),{timeout:20000});
  assert(!await page.locator('.studio-checklist').count(),'Publication checklist reported unfinished items: '+await page.locator('.studio-checklist').allInnerTexts().catch(()=>''));
  const record=(await api(page,`weekly-template?week=${WEEK}&class=SS1&subject=${encodeURIComponent(subject)}&term=1`)).value;
  assert(record.published,subject+': nothing published');published[subject]=record.published;
  check(subject+': Week 13 published after keyboard-only authoring');
  await page.locator('[data-studio="close"]').click();await page.locator('.content-studio-dialog').waitFor({state:'detached'}).catch(()=>{});
 }
 // Each subject keeps its own Week 13; nothing leaks between them.
 const titles=Object.fromEntries(Object.entries(published).map(([k,v])=>[k,v.title]));
 assert.deepEqual(titles,{'Mathematics':'Quadratic equations and their graphs','English Language':'Summary writing','Physics':'Motion in a straight line'});
 check('The three Week 13 notes are stored separately in the same workspace: '+JSON.stringify(titles));
 // Order and typed text: text typed after each item must live on the line below it.
 const m=outline(published['Mathematics']);
 assert.equal(m[0],'text:A quadratic equation has the form ax² + bx + c = 0. ');
 assert.equal(m[1],'equation:x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}');
 assert(m[2].startsWith('text:The formula above gives both roots. For example, [x^2-5x+6=0] factorises as'),m[2]);
 assert.equal(m[3],'graph');assert(m[4].startsWith('text:The parabola'));assert.equal(m[5],'table');assert(m[6].startsWith('text:Table of values'));
 assert.equal(m[7],'heading');assert.equal(m[8],'worked-example','the unused blank line after the heading is dropped on publish');assert(!m.some(v=>v==='text:'),'no blank text lines are published');
 check('Maths note order is exact: text → equation → text with inline equation → graph → text → table → text → heading → worked example → …');
 const e=outline(published['English Language']);
 assert(e.some(v=>v==='text:Discuss the video with a partner. Beginning|'),e.join(' / '));
 assert(e.some(v=>v==='text:>Ending'),'text after the mid-sentence insert');
 check('English note keeps the split sentence in order around the inserted paragraph');
 const p=outline(published['Physics']);assert(p[0].startsWith('text:Acceleration is the rate of change of velocity: [a=\\frac{v-u}{t}], measured in m/s²'),p[0]);assert.equal(p[1],'equation:v=u+at');
 assert(p.includes('equation:v=u+at'));assert(p.some(v=>v==='video:dQw4w9WgXcQ'));
 check('Physics note stores its equation and normalised video id');
 // Student view for each subject.
 const student=await enter('student'),sp=student.page;
 for(const subject of ['Mathematics','English Language','Physics']){
  await sp.locator('[data-page="learn"]').first().click();await sp.locator('#subject-switch').selectOption(subject);
  await sp.waitForFunction(s=>document.querySelector('#subject-switch')?.value===s,subject);
  const lessonId=published[subject].lessons[0].id;
  await sp.getByText('Week 13 ·').first().waitFor({timeout:10000});
  await sp.locator(`[data-action="open-lesson"][data-id="${lessonId}"]`).click();await sp.locator('.lesson-document').waitFor();if(subject!=='English Language')await sp.locator('.lesson-document .katex').first().waitFor({timeout:10000});await sp.waitForTimeout(400);
  const facts=await sp.evaluate(()=>({katex:document.querySelectorAll('.lesson-document .katex').length,frames:document.querySelectorAll('.lesson-document iframe').length,tables:document.querySelectorAll('.lesson-document table').length,graphs:document.querySelectorAll('.lesson-document [data-math-graph], .lesson-document .math-graph, .lesson-document canvas, .lesson-document svg').length,blank:[...document.querySelectorAll('.lesson-document p')].filter(p=>!p.textContent.trim()&&!p.querySelector('*')).length,overflow:document.documentElement.scrollWidth>innerWidth}));
  if(subject==='Mathematics'){assert(facts.katex>=2&&facts.frames>=1&&facts.tables>=1&&facts.graphs>=1,JSON.stringify(facts));}
  if(subject==='English Language'){assert(facts.frames>=1&&facts.tables>=1&&facts.katex===0,JSON.stringify(facts));}
  if(subject==='Physics'){assert(facts.katex>=2&&facts.frames>=1&&facts.tables>=1&&facts.graphs>=1,JSON.stringify(facts));}
  assert.equal(facts.blank,0,subject+': students should not see blank spacer lines');assert(!facts.overflow);
  await sp.screenshot({path:path.join(output,subject.replace(/\s/g,'-')+'-student.png'),fullPage:true});
  check(subject+': student sees the published Week 13 note ('+JSON.stringify(facts)+')');
  await sp.locator('[data-page="learn"]').first().click();
 }
 // Undo: inserting an item and its next line is a single undo step.
 await openStudio(page,'Mathematics');const before=(await kinds(page)).length;await tab(page,'Home');await page.locator('[data-studio="write"]').first().click();
 await insert(page,'table');assert.equal((await kinds(page)).length,before+2);await tab(page,'Home');await page.locator('[data-studio="undo"]').click();assert.equal((await kinds(page)).length,before);
 check('Undo removes an inserted item and its new line together');
 assert.equal(report.pageErrors.length,0,JSON.stringify(report.pageErrors));report.status='PASSED';
}catch(error){report.status='FAILED';report.error=error.stack;console.error(error.stack);if(currentPage)await currentPage.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});process.exitCode=1;}
finally{if(browser)await browser.close();if(server.exitCode===null&&server.signalCode===null)await new Promise(resolve=>{server.once('exit',resolve);server.kill();});fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log('\n'+report.status,output);}
