import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {validateLessonDocument} from '../public/lesson-document.js';
import {validateWeekDocuments} from '../lesson-document.mjs';
import {renderLessonDocument} from '../public/lesson-renderer.js';
import {defaultGraph,defaultTool} from '../public/math-engine.js';

const rich=text=>({schemaVersion:1,blocks:[{id:'text',type:'rich-text',content:{type:'doc',content:[{type:'paragraph',attrs:{textAlign:'center'},content:[{type:'text',text,marks:[{type:'bold'},{type:'underline'}]},{type:'inlineMath',attrs:{latex:'\\frac{2x+3}{x-1}'}}]},{type:'orderedList',attrs:{start:1,type:null},content:[{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'First step'}]}]}]}]}}]});
test('Rich text roundtrips safe formatting and inline maths and rejects untrusted nested payloads',()=>{
 const source=validateLessonDocument(rich('<script> stays text'));const html=renderLessonDocument(source);assert(html.includes('<strong>'));assert(html.includes('<u>'));assert(html.includes('<ol start="1">'));assert(html.includes('rich-align-center'));assert(html.includes('data-math-tex'));assert(!html.includes('<script>'));
 for(const mutation of [
  doc=>{doc.blocks[0].content.content[0].attrs.style='color:red';},
  doc=>{doc.blocks[0].content.content[0].content[0].marks=[{type:'link',attrs:{href:'javascript:alert(1)'}}];},
  doc=>{doc.blocks[0].content.content[0].content[1].attrs.latex='\\href{https://example.test}{x}';},
  doc=>{doc.blocks[0].content.content.push({type:'iframe',attrs:{src:'https://evil.test'}});},
  doc=>{let parent=doc.blocks[0].content.content[1];for(let i=0;i<20;i++){parent.content=[{type:'listItem',content:[{type:'bulletList',content:[]}]}];parent=parent.content[0].content[0];}}
 ]){const value=rich('safe');mutation(value);assert.throws(()=>validateLessonDocument(value),error=>error.status===400);}
 const linked=rich('safe');linked.blocks[0].content.content[0].content[0].marks=[{type:'link',attrs:{href:'https://example.test',target:'_blank',rel:null,class:null}}];assert(renderLessonDocument(validateLessonDocument(linked)).includes('rel="noopener noreferrer"'));
});
test('Server equation validation uses bounded KaTeX parsing for display and inline input',()=>{
 const lesson={id:9,lessons:[{document:rich('valid')}],quiz:[]};assert.doesNotThrow(()=>validateWeekDocuments(lesson));
 lesson.lessons[0].document.blocks[0].content.content[0].content[1].attrs.latex='\\notARealMathCommand{x}';assert.throws(()=>validateWeekDocuments(lesson),error=>error.status===400);
 for(const latex of ['\\frac{2x+3}{x-1}','\\begin{pmatrix}2&3\\\\4&5\\end{pmatrix}','\\begin{aligned}2x+3y&=12\\\\3x-y&=5\\end{aligned}','x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}'])assert.doesNotThrow(()=>validateWeekDocuments({lessons:[{document:{schemaVersion:1,blocks:[{id:'eq',type:'equation',latex,displayMode:true}]}}],quiz:[]}));
});

test('Studio versions, restores and reusable blocks are scoped, conflict-safe and durable',async t=>{
 const dir=path.resolve('test-results','studio-'+Date.now());fs.mkdirSync(dir,{recursive:true});
 const env={...process.env,DATA_DIR:dir,DATABASE_URL:'',NODE_ENV:'test',DEMO_PASSWORD:'Studio-test-password!',PORT:'0',STORAGE_DRIVER:'local'};
 let server,root='',log='',teacher,student,admin,first,second,restoredToken;
 async function start(){root='';log='';server=spawn(process.execPath,['--experimental-sqlite','server.mjs'],{env,stdio:['ignore','pipe','pipe']});server.stdout.on('data',bytes=>{log+=bytes;root=log.match(/ready at (http:\/\/127\.0\.0\.1:\d+)/)?.[1]||'';});server.stderr.on('data',bytes=>log+=bytes);for(let i=0;i<150&&!root&&server.exitCode===null;i++)await new Promise(r=>setTimeout(r,100));assert(root,log);}
 async function stop(){if(server?.exitCode===null&&server.signalCode===null)await new Promise(resolve=>{server.once('exit',resolve);server.kill();});}
 async function req(route,data,session={}){const r=await fetch(root+'/api/'+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json',Cookie:session.cookie||'','X-CSRF-Token':session.csrf||''},...(data?{body:JSON.stringify(data)}:{})});return {status:r.status,value:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
 async function login(role){const r=await req('login',{email:role+'@olawaleslab.school',password:env.DEMO_PASSWORD});assert.equal(r.status,200);return {cookie:r.cookie,csrf:r.value.csrf};}
 const question={id:'q',prompt:'Evaluate 1+1',kind:'numeric',answer:'2',explanation:'Add the two units.'};
 const week={id:9,title:'Visual teaching',lessons:[{id:'9-one',title:'Fractions',explain:'Preserved legacy fallback',questions:[question],document:rich('Version one')}],quiz:[{...question,id:'quiz'}]};
 const mathBlocks=[{id:'graph',type:'graph',graph:defaultGraph()},{id:'matrix',type:'math-tool',config:defaultTool('matrix')},{id:'geometry',type:'math-tool',config:defaultTool('geometry')}];
 week.lessons[0].document.blocks.push(...structuredClone(mathBlocks));
 try{
  await start();teacher=await login('teacher');student=await login('student');admin=await login('admin');
  await t.test('Students and unassigned teachers cannot inspect history or save reusable blocks',async()=>{
   for(const route of ['weekly-history?week=9','weekly-history?week=9&version=current','studio-templates'])assert.equal((await req(route,null,student)).status,403);
   assert.equal((await req('weekly-history?week=9&class=SS2',null,teacher)).status,403);
   assert.equal((await req('weekly-restore',{week:9,version:'current'},student)).status,403);
   assert.equal((await req('studio-templates',{name:'Private',block:week.lessons[0].document.blocks[0]},student)).status,403);
  });
  await t.test('New publications appear in history with immutable original content',async()=>{
   const blank={id:9,title:'',lessons:[{id:'9-one',title:'',document:{schemaVersion:1,blocks:[]},questions:[]}],quiz:[]};
   const savedBlank=await req('weekly-template',{week:blank,publish:false,assignments:[]},teacher);assert.equal(savedBlank.status,200,savedBlank.value.error);
   const blankInfo=(await req('weekly-template?week=9',null,teacher)).value;assert.equal(blankInfo.published,null);assert.deepEqual(blankInfo.draft.week.lessons[0].questions,[]);assert.deepEqual(blankInfo.draft.week.lessons[0].document.blocks,[]);
   assert.equal((await req('weekly-template',{week:blank,publish:true,draftRevision:savedBlank.value.draftRevision,assignments:[]},teacher)).status,400);
   const unsafe=structuredClone(week);unsafe.lessons[0].document.blocks[1].graph.expressions[0].expression='fetch(x)';assert.equal((await req('weekly-template',{week:unsafe,publish:false,draftRevision:savedBlank.value.draftRevision,assignments:[]},teacher)).status,400);
   first=await req('weekly-template',{week,publish:true,draftRevision:savedBlank.value.draftRevision,assignments:[]},teacher);assert.equal(first.status,200,first.value.error);
   assert.deepEqual((await req('lesson/9-one',null,student)).value.document.blocks.slice(1),mathBlocks);
   const next=structuredClone(week);next.lessons[0].document=rich('Version two');next.lessons[0].document.blocks.push(...structuredClone(mathBlocks));second=await req('weekly-template',{week:next,revision:first.value.revision,publish:true,assignments:[]},teacher);assert.equal(second.status,200,second.value.error);
   const history=(await req('weekly-history?week=9',null,teacher)).value;assert.equal(history.versions.length,2);
   const old=await req('weekly-history?week=9&version='+history.versions[1].id,null,teacher);assert.equal(old.value.content.lessons[0].document.blocks[0].content.content[0].content[0].text,'Version one');first.version=history.versions[1].id;
   assert.equal((await req('weekly-history?week=8&version='+first.version,null,teacher)).status,404);
  });
  await t.test('Restore creates only a new draft; stale tokens and CSRF cannot overwrite content',async()=>{
   assert.equal((await req('weekly-restore',{week:9,version:first.version,revision:'stale'},teacher)).status,409);
   assert.equal((await req('weekly-restore',{week:9,version:first.version,revision:second.value.revision},{cookie:teacher.cookie,csrf:'wrong'})).status,403);
   const response=await req('weekly-restore',{week:9,version:first.version,revision:second.value.revision},teacher);assert.equal(response.status,200,response.value.error);restoredToken=response.value.draftRevision;
   const info=(await req('weekly-template?week=9',null,teacher)).value;assert.equal(info.draft.restoredFrom,first.version);assert.notEqual(info.draftRevision,first.value.draftRevision);
   assert.equal((await req('lesson/9-one',null,student)).value.document.blocks[0].content.content[0].content[0].text,'Version two');
   assert.equal((await req('weekly-restore',{week:9,version:first.version,revision:second.value.revision},teacher)).status,409);
   assert.equal((await req('weekly-history?week=9',null,teacher)).value.versions.length,2);
  });
  await t.test('Reusable blocks are validated and private to their teacher, not merely their class',async()=>{
   const saved=await req('studio-templates',{name:'Fraction introduction',block:week.lessons[0].document.blocks[0]},teacher);assert.equal(saved.status,200);
   assert.equal((await req('studio-templates',null,teacher)).value.length,1);assert.equal((await req('studio-templates',null,admin)).value.length,0);
   const bad=structuredClone(week.lessons[0].document.blocks[0]);bad.content.content[0].content[1].attrs.latex='\\invalidMath';assert.equal((await req('studio-templates',{name:'Unsafe',block:bad},teacher)).status,400);
  });
  await t.test('Rich restored drafts, histories and templates survive restart and backup restoration',async()=>{
   await stop();await start();const info=(await req('weekly-template?week=9',null,teacher)).value;assert.equal(info.draftRevision,restoredToken);assert.equal(info.draft.week.lessons[0].document.blocks[0].content.content[0].content[0].text,'Version one');
   assert.deepEqual(info.draft.week.lessons[0].document.blocks.slice(1),mathBlocks);
   await stop();const backup=path.join(dir,'backup'),restore=path.join(dir,'restored');
   assert.equal(spawnSync(process.execPath,['--experimental-sqlite','scripts/backup.mjs',backup],{env,encoding:'utf8'}).status,0);
   assert.equal(spawnSync(process.execPath,['--experimental-sqlite','scripts/restore.mjs',backup],{env:{...env,DATA_DIR:restore},encoding:'utf8'}).status,0);
   const db=new DatabaseSync(path.join(restore,'school.sqlite'),{readOnly:true});try{assert.equal(JSON.parse(db.prepare("SELECT value FROM app_settings WHERE key='weekVersions'").get().value).length,2);assert.equal(JSON.parse(db.prepare("SELECT value FROM app_settings WHERE key='blockTemplates'").get().value).length,1);assert.deepEqual(JSON.parse(db.prepare("SELECT value FROM app_settings WHERE key='weekVersions'").get().value)[0].content.lessons[0].document.blocks.slice(1),mathBlocks);assert.deepEqual(Object.values(JSON.parse(db.prepare("SELECT value FROM app_settings WHERE key='weekDrafts'").get().value)).find(d=>d.week.id===9).week.lessons[0].document.blocks.slice(1),mathBlocks);assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);}finally{db.close();}
  });
 }finally{await stop();}
});
