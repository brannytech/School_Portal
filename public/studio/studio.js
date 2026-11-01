// Lesson Studio: write a week of lessons as one continuous page, then publish when ready.
import {documentForLesson,safeLink} from '../lesson-document.js';
import {renderLessonDocument,renderBlock,hydrateLessonMath} from '../lesson-renderer.js';
import {defaultGraph,defaultTool} from '../math-engine.js';
import {blocksToDoc,docToBlocks,newBlock,uid,BLOCK_LABELS} from './document-model.js';
import {esc,button,input} from './ui.js';
import {blockInspectorHTML,lessonSettingsHTML,applyBlockEdit} from './inspector.js';
import {mountEquationPanel} from './equation.js';
import {lessonName,releaseLabel,publishedMessage,reviewHTML,publishDialog,defaultSelection} from './publish.js';
import {questionPanelHTML,newQuestion,practiceOf,answerInput,questionsFromCSV} from './questions.js';
import {newAssignment,assignmentOutlineHTML,assignmentTabsHTML,assignmentSettingsHTML,releasePanelHTML,copyPanelHTML} from './assignments.js';
import {pickImageFile,uploadLessonImage} from './media.js';

// What can be added to a lesson. `input` items open their settings straight away.
const ITEMS=[
 ['equation','Equation','A displayed formula','math formula fraction'],
 ['image','Image','Upload a picture or diagram','photo picture diagram'],
 ['graph','Interactive graph','Learners can explore a function','plot chart'],
 ['table','Table','Rows and columns','grid data'],
 ['video','YouTube video','Paste a link','movie watch'],
 ['worked-example','Worked example','Question, method and answer','example solution'],
 ['math-tool','Mathematics toolkit','Number line, bases and more','tool'],
 ['objectives','Learning objectives','A short list','goals'],
 ['summary','Summary','Key ideas to remember','recap'],
 ['real-life','Real-life application','Where this is used','context'],
 ['experiment','Experiment','Instructions to try','practical activity'],
 ['hint','Hint','A helpful nudge','tip'],
 ['warning','Important note','Something to watch out for','caution'],
 ['widget','Topic tool','The interactive tool for this topic','interactive'],
 ['divider','Divider line','A horizontal rule','separator line']
];
const NO_SETTINGS=new Set(['widget','divider']);

export async function openContentStudio({host,context,api,allocations=[],week=1,onPublished,renderWidget,uploadImage}){
 if(!document.querySelector('link[data-math-style]')){const link=document.createElement('link');link.rel='stylesheet';link.href='/vendor/katex.min.css';link.dataset.mathStyle='true';document.head.append(link);}
 if(host.open)throw Error('Close the current editor before opening Content Studio.');
 if(!document.querySelector('link[data-studio-style]')){const link=document.createElement('link');link.rel='stylesheet';link.href='/content-studio.css';link.dataset.studioStyle='true';document.head.append(link);}
 const editorModule=await import('/vendor/lesson-editor.js');
 const s={
  week:null,lessonId:null,pane:'lesson',blockId:null,editor:null,releases:{},templates:[],assignments:[],
  revision:null,draftRevision:null,dirty:false,generation:0,saving:null,conflict:false,disposed:false,
  questionIndex:0,quizIndex:0,assignIndex:0,assignmentId:null,assignTab:'write',assignDirty:false,loadWeek:week,status:'Loading lesson…',publish:null,issues:[],equation:null,inspectorKey:null,pendingDelete:null
 };

 const call=(route,data)=>data?api(route,{...context,...data}):api(route+(route.includes('?')?'&':'?')+new URLSearchParams(context));
 const q=selector=>host.querySelector(selector);
 // On a small window the outline and settings become drawers, so the page keeps the whole screen.
 const narrow=()=>window.matchMedia('(max-width:1100px)').matches;
 function setDrawer(name,{focus=false}={}){
  s.drawer=name||'';const shell=q('.st-shell');if(!shell)return;
  if(name)shell.dataset.drawer=name;else delete shell.dataset.drawer;
  for(const b of host.querySelectorAll('[data-studio^="drawer-"][aria-expanded]'))b.setAttribute('aria-expanded',String(b.dataset.studio==='drawer-'+name));
  if(name&&focus)q(name==='outline'?'[data-outline]':'[data-inspector]')?.focus({preventScroll:true});
 }
 const current=()=>s.week?.lessons.find(l=>l.id===s.lessonId)||null;
 const currentAssignment=()=>s.assignments.find(a=>a.id===s.assignmentId)||null;
 // The page editor writes into whichever item is open: a subtopic or an assignment.
 const holder=()=>s.pane==='assignment'?currentAssignment():current();
 const lessonBlocks=item=>item?(item.document?.blocks??(item.scope!==undefined?[]:documentForLesson(item).blocks)):[];
 const selectedBlock=()=>s.editor&&s.blockId?editorModule.getBlock(s.editor,s.blockId):null;
 const panel=()=>q('[data-studio-panel]');
 function status(message){s.status=message;const el=q('[data-studio-status]');if(el)el.textContent=message;}

 // ---------- saving ----------
 function changed(){
  s.dirty=true;s.generation++;status('Unsaved changes');updateReadiness();
  clearTimeout(s.autosave);s.autosave=setTimeout(()=>save(false),1500);
 }
 async function save(publish=false,release=null){
  while(s.saving)await s.saving;if(s.disposed)return false;
  if(s.conflict){status('A newer edit exists. Reload latest before saving. Your changes remain in this editor.');return false;}
  if(!publish&&!s.dirty)return true;
  clearTimeout(s.autosave);const generation=s.generation,payload=structuredClone(s.week);
  status(publish?'Validating and publishing…':'Saving private draft…');
  const run=async()=>{
   try{
    const result=await call('weekly-template',{week:payload,assignments:[],revision:s.revision,draftRevision:s.draftRevision,publish,release});
    s.revision=result.revision;s.draftRevision=result.draftRevision;
    if(generation===s.generation){s.dirty=false;status(publish?publishedMessage(result):'All changes saved at '+new Date().toLocaleTimeString('en-NG',{timeZone:'Africa/Lagos',hour:'2-digit',minute:'2-digit'}));}
    else{status(publish?'Published the saved revision. Newer changes are still a private draft.':'Newer changes are waiting to save…');s.autosave=setTimeout(()=>save(false),500);}
    if(publish){s.releases=await releaseMap();renderOutline();await onPublished?.();}
    return true;
   }catch(error){
    s.conflict=/changed|revision|another window|another teacher/i.test(error.message);
    status((s.conflict?'Save conflict. ':'Could not save. ')+error.message+' Your unsaved changes remain in this editor.');return false;
   }
  };
  s.saving=run();try{return await s.saving;}finally{s.saving=null;}
 }
 async function releaseMap(){try{return (await call('weekly-template?week='+Number(s.week.id))).releases||{};}catch{return s.releases;}}
 async function load(id,discard=false){
  if(!Number.isInteger(Number(id))||Number(id)<1||Number(id)>52)throw Error('Choose a learning week from 1 to 52.');
  if(!discard&&s.dirty&&!await save())return;
  const request=s.loadRequest=(s.loadRequest||0)+1;status('Loading week '+Number(id)+'…');host.setAttribute('aria-busy','true');
  const data=await call('weekly-template?week='+Number(id)),templates=await call('studio-templates'),assignmentData=await call('assignments?week='+Number(id)).catch(()=>({assignments:[]}));
  if(s.disposed||request!==s.loadRequest)return;
  destroyEditor();
  s.week=structuredClone(data.draft?.week||data.published||{id:Number(id),title:'',subtitle:'',lessons:[],quiz:[],reflectionPrompt:'What did you learn and what needs more practice?'});
  s.revision=data.draft&&Object.hasOwn(data.draft,'baseRevision')?data.draft.baseRevision:data.revision;s.draftRevision=data.draftRevision;
  s.releases=data.releases||{};s.assignments=structuredClone(assignmentData.assignments||[]);s.assignmentId=null;s.assignTab='write';s.assignDirty=false;s.assignIndex=0;
  s.lessonId=s.week.lessons[0]?.id||null;s.pane='lesson';s.blockId=null;s.equation=null;s.dirty=false;s.conflict=false;s.questionIndex=0;s.quizIndex=0;s.loadWeek=Number(id);
  s.week.quiz??=[];for(const lesson of s.week.lessons)lesson.questions??=[];
  s.templates=templates;s.status=data.draft?'Private draft loaded':data.published?'Published content loaded':'New week. Add your first subtopic.';
  host.removeAttribute('aria-busy');render();
 }

 // ---------- the page (continuous editor) ----------
 function destroyEditor(){s.editor?.destroy();s.editor=null;}
 const placeholder=(title,hint)=>`<div class="lesson-item-placeholder"><strong>${esc(title)}</strong><span>${esc(hint)}</span></div>`;
 function previewHTML(block){
  try{
   if(block.type==='image'&&!block.fileId)return placeholder('Image','Choose an image in the panel on the right.');
   if(block.type==='video'&&!block.videoId)return placeholder('YouTube video','Paste a link in the panel on the right.');
   if(block.type==='widget')return placeholder('Topic tool','The interactive topic tool appears here for students.');
   return `<div class="lesson-document"><section class="lesson-block">${renderBlock(block,renderWidget)}</section></div>`;
  }catch{return placeholder(BLOCK_LABELS[block.type]||block.type,'This item needs attention.');}
 }
 function onEditorChange(json){
  const item=holder();if(!item)return;
  item.document={schemaVersion:1,blocks:docToBlocks(json)};if(s.pane==='assignment')assignmentChanged();else changed();
 }
 function onEditorSelect(id){
  if(s.placing||id===s.blockId)return;s.blockId=id;s.equation=null;renderInspector();
 }
 function mountEditor(){
  const element=q('[data-editor]'),lesson=holder();destroyEditor();if(!element||!lesson)return;
  s.editor=editorModule.createLessonEditor({
   element,content:blocksToDoc(lessonBlocks(lesson)),renderBlock:previewHTML,onPaint:dom=>hydrateLessonMath(dom),
   onChange:onEditorChange,onSelect:onEditorSelect,onEquation:openInlineEquation,onFiles:files=>addImages(files),
   slashItems:ITEMS.map(([id,label,hint,keywords])=>({id,label,hint,keywords})),onSlash:insertItem
  });
 }
 function focusEditor(position=null){editorModule.focusNow(s.editor,position);}

 async function insertItem(id){
  if(!s.editor||!holder())return;
  if(id==='divider'){s.editor.chain().focus().setHorizontalRule().run();return;}
  if(id==='image'){await addImages();return;}
  const extra=id==='graph'?{graph:defaultGraph()}:id==='math-tool'?{config:defaultTool()}:{};
  placeBlock(newBlock(id,extra),!NO_SETTINGS.has(id));
 }
 // Put an item on the page. Items that need input stay selected with their settings open;
 // the rest leave the caret on the next line. Either way the caret never jumps elsewhere.
 function placeBlock(block,needsInput){
  s.placing=true;try{editorModule.insertBlock(s.editor,block,{select:needsInput});}finally{s.placing=false;}
  s.blockId=needsInput?block.id:null;s.equation=null;renderInspector({focus:needsInput,force:true});
 }
 async function addImages(files=null){
  if(!s.editor||!holder())return;
  try{
   if(!uploadImage)throw Error('Image upload is not available here.');
   const list=files||[await pickImageFile()].filter(Boolean);
   for(const file of list){
    status('Uploading image…');const fileId=await uploadLessonImage(file,uploadImage);
    placeBlock(newBlock('image',{fileId}),true);status('Image added. Describe it for learners who cannot see it.');
   }
  }catch(error){status(error.message);}
 }
 function continueWriting(){
  if(!s.editor)return;const id=s.blockId;s.equation=null;
  if(id)editorModule.continueAfter(s.editor,id);else focusEditor('end');
  s.blockId=null;renderInspector({force:true});
 }
 function writeBlock(path,value){
  const block=selectedBlock();if(!block)return;
  const result=applyBlockEdit(block,path,value);if(result.error){status(result.error);return;}
  editorModule.updateBlock(s.editor,result.block);
 }

 // ---------- equations ----------
 function openInlineEquation(target){
  s.blockId=null;s.equation={kind:'inline',...target};
  if(target.position===undefined)s.equation.insertionPosition=Math.min(target.editor.state.selection.to,target.editor.state.doc.content.size-1);
  renderInspector({force:true});
 }
 function applyInlineEquation(latex){
  const target=s.equation;s.equation=null;const editor=target.editor;
  if(target.position!==undefined)editor.chain().focus().setNodeSelection(target.position).updateAttributes('inlineMath',{latex}).setTextSelection(target.position+1).run();
  else editor.chain().focus().insertContentAt(target.insertionPosition,{type:'inlineMath',attrs:{latex}}).setTextSelection(target.insertionPosition+1).run();
  editorModule.focusNow(editor);renderInspector({force:true});
 }

 // ---------- rendering ----------
 function render(){
  if(s.disposed)return;
  host.classList.add('content-studio-dialog');
  if(!q('.st-shell'))host.innerHTML=shellHTML();
  q('[data-context]').textContent=`${context.class} · ${context.subject} · Term ${context.term}`;
  renderOutline();renderMain();renderInspector({force:true});updateReadiness();status(s.status);
  if(!host.open)host.showModal();
 }
 function shellHTML(){
  return `<div class="st-shell"><header class="st-top"><button type="button" class="st-drawer-btn" data-studio="drawer-outline" aria-expanded="false" aria-controls="st-outline" aria-label="Show outline">☰<span> Outline</span></button><div class="st-brand"><span class="st-mark" aria-hidden="true">L</span><div><h2>Lesson Studio</h2><span class="studio-context" data-context></span></div></div>
  <div class="st-state"><span data-studio-status role="status" aria-live="polite"></span><span class="st-ready" data-readiness role="status"></span></div>
  <div class="st-top-actions"><button type="button" class="st-drawer-btn" data-studio="drawer-inspector" aria-expanded="false" aria-controls="st-inspector">⚙<span> Settings</span></button>${button('save','Save draft')}${button('preview','Preview','aria-label="Student preview"')}${button('publish','Publish','class="primary"')}${button('close','✕','aria-label="Close Lesson Studio"')}</div></header>
  <div class="st-body"><nav class="st-outline" id="st-outline" tabindex="-1" aria-label="Week outline" data-outline></nav><main class="st-main" data-main></main><aside class="st-inspector" id="st-inspector" tabindex="-1" aria-label="Item settings" data-inspector></aside><button type="button" class="st-scrim" data-studio="drawer-close" aria-label="Close panel" tabindex="-1"></button></div>
  <section class="st-overlay" data-studio-panel hidden aria-label="Lesson dialog"></section></div>`;
 }
 function renderOutline(){
  const el=q('[data-outline]');if(!el||!s.week)return;
  const lessons=s.week.lessons;
  el.innerHTML=`<div class="st-week"><label for="st-week-number">Week</label><div class="st-week-row">${button('week-prev','‹','aria-label="Previous week"')}<input id="st-week-number" data-load-week type="number" min="1" max="52" value="${s.loadWeek}">${button('week-next','›','aria-label="Next week"')}${button('load','Open')}</div></div>
  ${input('Weekly topic','week.title',s.week.title,'text','placeholder="e.g. Quadratic equations"')}
  <h3>Subtopics</h3><ol class="st-lessons">${lessons.map((l,i)=>`<li><button type="button" data-studio="select-lesson" data-id="${esc(l.id)}" ${l.id===s.lessonId&&!['quiz','assignment'].includes(s.pane)?'aria-current="true"':''}><span data-outline-title="${esc(l.id)}">${esc(lessonName(l,i))}</span><span class="st-chip st-chip-${esc((s.releases[l.id]?.available?'live':s.releases[l.id]?.status||'none').toLowerCase())}">${esc(releaseLabel(s.releases[l.id]))}</span></button></li>`).join('')}</ol>
  ${button('new-lesson','+ Add subtopic','class="st-add"')}
  <h3>This week</h3><div class="st-nav">${button('pane-quiz',`Weekly quiz (${(s.week.quiz||[]).length})`,s.pane==='quiz'?'aria-current="true"':'')}${button('history','Version history')}</div>
  ${assignmentOutlineHTML(s.assignments,s.assignmentId,s.pane)}`;
 }
 function renderMain(){
  const el=q('[data-main]');if(!el||!s.week)return;destroyEditor();
  const lesson=current();
  if(s.pane==='assignment'){
   const a=currentAssignment();if(!a){el.innerHTML='<div class="st-empty"><h3>Choose an assignment</h3></div>';return;}
   if(a.mode!=='ONLINE'&&s.assignTab==='questions')s.assignTab='write';
   if(s.assignTab==='questions'){el.innerHTML=assignmentTabsHTML(a,s.assignTab)+questionPanelHTML({questions:a.questions||[],index:s.assignIndex,bank:'assign'});return;}
   el.innerHTML=assignmentTabsHTML(a,s.assignTab)+toolbarHTML()+`<article class="st-page"><textarea data-path="assign.title" rows="1" aria-label="Assignment title" placeholder="Assignment title">${esc(a.title)}</textarea><div class="st-editor" data-editor></div></article>`;
   mountEditor();return;
  }
  if(s.pane==='quiz'){el.innerHTML=questionPanelHTML({questions:s.week.quiz||[],index:s.quizIndex,quiz:true});return;}
  if(!lesson){el.innerHTML=`<div class="st-empty"><h3>${s.week.lessons.length?'Choose a subtopic':'This week is empty'}</h3><p>Write your lesson as one continuous page: text, equations, images and graphs together.</p>${button('new-lesson','Create the first subtopic','class="primary"')}</div>`;return;}
  if(s.pane==='practice'){el.innerHTML=mainTabs(lesson)+questionPanelHTML({questions:practiceOf(lesson),index:s.questionIndex,quiz:false});return;}
  el.innerHTML=mainTabs(lesson)+toolbarHTML()+`<article class="st-page"><textarea data-path="lesson.title" rows="1" aria-label="Subtopic title" placeholder="Subtopic title">${esc(lesson.title)}</textarea><div class="st-editor" data-editor></div></article>`;
  mountEditor();
 }
 function mainTabs(lesson){
  return `<div class="st-tabs" role="tablist"><button type="button" role="tab" data-studio="pane-lesson" aria-selected="${s.pane==='lesson'}">Write</button><button type="button" role="tab" data-studio="pane-practice" aria-selected="${s.pane==='practice'}">Practice questions (${practiceOf(lesson).length})</button></div>`;
 }
 function toolbarHTML(){
  const tool=(action,label,title)=>button('text-'+action,label,`aria-label="${title}" title="${title}"`);
  return `<div class="st-toolbar" role="toolbar" aria-label="Formatting and insert">
  <label class="sr-only" for="studio-heading">Text style</label><select id="studio-heading"><option value="0">Normal text</option>${[1,2,3,4].map(v=>`<option value="${v}">Heading ${v}</option>`).join('')}</select>
  ${tool('bold','<b>B</b>','Bold')}${tool('italic','<i>I</i>','Italic')}${tool('underline','<u>U</u>','Underline')}${tool('subscript','x₂','Subscript')}${tool('superscript','x²','Superscript')}
  ${tool('bullet','• List','Bulleted list')}${tool('ordered','1. List','Numbered list')}${tool('quote','Quote','Quote')}
  <label class="sr-only" for="studio-align">Alignment</label><select id="studio-align">${['left','center','right','justify'].map(v=>`<option>${v}</option>`).join('')}</select>
  ${tool('link','Link','Add link')}${tool('inline-equation','∑ Inline','Inline equation in a sentence')}
  <details class="st-insert" data-insert-menu><summary>+ Insert</summary><div class="st-insert-list" role="menu">${ITEMS.map(([id,label,hint])=>button('insert',`<strong>${label}</strong><span>${hint}</span>`,`role="menuitem" data-type="${id}"`)).join('')}${s.templates.length?'<hr>'+s.templates.map(t=>button('insert-template',`<strong>${esc(t.name)}</strong><span>Saved item</span>`,`role="menuitem" data-id="${t.id}"`)).join(''):''}</div></details>
  ${button('undo','↶','aria-label="Undo" title="Undo"')}${button('redo','↷','aria-label="Redo" title="Redo"')}</div>`;
 }
 async function renderInspector({focus=false,force=false}={}){
  const el=q('[data-inspector]');if(!el||!s.week)return;
  if(focus&&narrow())setDrawer('inspector');
  const block=['lesson','assignment'].includes(s.pane)?selectedBlock():null;
  const key=s.equation?'inline-eq':block?block.id+block.type:'lesson:'+s.lessonId+':'+s.pane;
  if(!force&&key===s.inspectorKey)return;s.inspectorKey=key;
  const token=s.inspectorToken=(s.inspectorToken||0)+1,stale=()=>token!==s.inspectorToken;
  s.eqPanel?.destroy();s.eqPanel=null;
  if(s.equation){
   const target=s.equation;
   const mounted=await mountEquationPanel(el,{latex:target.latex??'',title:target.position!==undefined?'Edit inline equation':'Inline equation',applyLabel:'Insert in sentence',onApply:applyInlineEquation,onCancel:()=>{s.equation=null;editorModule.focusNow(target.editor);renderInspector({force:true});}});
   if(stale())mounted.destroy();else s.eqPanel=mounted;
   return;
  }
  if(block){
   const ids=editorModule.blockIds(s.editor);
   el.innerHTML=blockInspectorHTML(block,{canMoveUp:true,canMoveDown:true});
   if(block.type==='equation'){
    const id=block.id;
    const mounted=await mountEquationPanel(el.querySelector('[data-eq-host]'),{latex:block.latex,title:'',applyLabel:'Update equation',focus,onApply:latex=>{const b=editorModule.getBlock(s.editor,id);if(b){editorModule.updateBlock(s.editor,{...b,latex});}continueWriting();},onCancel:continueWriting});
    if(stale())mounted.destroy();else s.eqPanel=mounted;
   }else if(['graph','math-tool'].includes(block.type)){
    const host2=el.querySelector('[data-math-author]'),id=block.id;
    import('../math-authoring.js').then(module=>{
     if(!host2.isConnected)return;
     const update=value=>{const b=editorModule.getBlock(s.editor,id);if(b)editorModule.updateBlock(s.editor,{...b,[block.type==='graph'?'graph':'config']:value});};
     if(block.type==='graph')module.mountGraphAuthor(host2,block.graph,update);else module.mountToolAuthor(host2,block.config,update);
     if(focus){host2.querySelector('input,select')?.focus();}
    }).catch(error=>{if(host2.isConnected)host2.textContent=error.message;});
   }else if(focus){(block.type==='image'&&el.querySelector('[data-path="block.alt"]')||el.querySelector('[data-item-editor] [data-path],[data-item-editor] button'))?.focus();}
   void ids;return;
  }
  if(s.pane==='assignment'&&currentAssignment()&&s.assignTab==='write'){el.innerHTML=assignmentSettingsHTML(currentAssignment(),{lessons:s.week.lessons});return;}
  if(s.pane==='assignment'&&currentAssignment()){el.innerHTML=assignmentSettingsHTML(currentAssignment(),{lessons:s.week.lessons});return;}
  const lesson=current();
  if(s.pane==='lesson'&&lesson){const index=s.week.lessons.indexOf(lesson);el.innerHTML=lessonSettingsHTML(lesson,{index,count:s.week.lessons.length});}
  else el.innerHTML='<p class="small muted">Choose a subtopic to see its settings.</p>';
 }
 function updateReadiness(){
  clearTimeout(s.readyTimer);
  s.readyTimer=setTimeout(()=>{
   const node=q('[data-readiness]');if(s.disposed||!node||!s.week)return;
   const all=reviewHTML(s.week).issues,errors=all.filter(i=>i.severity==='error').length;
   node.textContent=errors?errors+' to fix before publishing':'Ready to publish';node.classList.toggle('is-ready',!errors);
  },300);
 }

 // ---------- dialogs: publish, preview, history ----------
 function showPanel(html){const el=panel();el.hidden=false;el.innerHTML=html;el.scrollTop=0;return el;}
 function hidePanel(){const el=panel();if(el){el.hidden=true;el.innerHTML='';}s.publish=null;}
 function openPublish(){
  if(!s.week.lessons.length){status('Add a subtopic before publishing.');return;}
  s.publish={mode:s.publish?.mode||'NOW',selected:defaultSelection(s.week),releaseAt:s.publish?.releaseAt||''};renderPublish();
 }
 function renderPublish(){const {html,issues}=publishDialog(s.week,s.publish,s.releases);s.issues=issues;showPanel(html);}
 function reviewPublication(){const result=reviewHTML(s.week);s.issues=result.issues;showPanel(result.html);}
 async function preview(){
  const lesson=current();if(!lesson)return;
  const questions=(list,label)=>list?.length?`<section data-question-preview><h4>${label}</h4>${list.map((item,i)=>`<div class="studio-preview-question"><strong>${i+1}. ${esc(item.prompt||'Question still to be written')}</strong>${item.kind==='choice'?(item.options||[]).map(option=>`<label><input type="radio" disabled>${esc(option)}</label>`).join(''):item.kind==='boolean'?'<p>True / False</p>':'<p><input disabled placeholder="Student enters an answer" aria-label="Student answer"></p>'}</div>`).join('')}</section>`:'';
  const doc={schemaVersion:1,blocks:lessonBlocks(lesson)};
  const el=showPanel(`<div class="st-actions"><h3>Student preview</h3>${button('hide-panel','Close preview')}<label>Preview width<select data-preview-width><option value="360px">Mobile</option><option value="768px">Tablet</option><option value="100%">Desktop</option></select></label></div><p class="small muted">Correct answers are hidden. Items that are not finished show a notice instead of content.</p><div class="studio-preview" style="width:360px">${renderLessonDocument(doc,{renderWidget})}${questions(practiceOf(lesson),'Subtopic practice')}${questions(s.week.quiz,'End-of-week quiz')}</div>`);
  await hydrateLessonMath(el);
 }
 async function showHistory(){
  if(s.dirty&&!await save())return;
  const data=await call('weekly-history?week='+s.week.id);
  showPanel(`<div class="st-actions"><h3>Published version history</h3>${button('hide-panel','Close history')}</div><p>Restoring creates a new private draft. Existing publications, student attempts and assignment settings are retained.</p><label>Version<select data-history-version>${data.current?'<option value="current">Current publication</option>':''}${data.versions.map(v=>`<option value="${v.id}">${esc(new Date(v.created).toLocaleString('en-NG',{timeZone:'Africa/Lagos'}))} · ${esc(v.teacher)} · ${esc(v.title)}</option>`).join('')}</select></label><div class="st-actions">${button('history-view','View / compare')}${button('history-restore','Restore as new draft')}</div><div data-history-preview></div>`);
 }

 // ---------- structure: subtopics and questions ----------
 const blankLesson=()=>({id:s.week.id+'-'+uid(),title:'',minutes:20,explain:'',objectives:[],summary:[],document:{schemaVersion:1,blocks:[]},questions:[]});
 async function selectLesson(id,pane='lesson'){if(s.assignDirty)await saveAssignment();s.assignmentId=null;s.lessonId=id;s.pane=pane;s.blockId=null;s.equation=null;s.questionIndex=0;render();}
 function addLesson(){const lesson=blankLesson();s.week.lessons.push(lesson);changed();selectLesson(lesson.id);focusEditor('start');}
 function moveLesson(direction){const list=s.week.lessons,i=list.findIndex(l=>l.id===s.lessonId),j=i+direction;if(i<0||j<0||j>=list.length)return;[list[i],list[j]]=[list[j],list[i]];changed();render();}
 function duplicateLesson(){const lesson=current();if(!lesson)return;const copy=structuredClone(lesson);copy.id=s.week.id+'-'+uid();copy.title=(lesson.title||'Untitled')+' (copy)';copy.questions=(copy.questions||[]).map(item=>({...item,id:uid()}));s.week.lessons.splice(s.week.lessons.indexOf(lesson)+1,0,copy);changed();selectLesson(copy.id);}
 function removeLesson(){
  const lesson=current();if(!lesson)return;
  if(s.pendingDelete!==lesson.id){s.pendingDelete=lesson.id;const b=q('[data-studio="lesson-remove"]');if(b)b.textContent='Click again to delete';return;}
  s.pendingDelete=null;const list=s.week.lessons,i=list.indexOf(lesson);list.splice(i,1);changed();selectLesson(list[Math.max(0,i-1)]?.id||null);
 }
 const questionList=prefix=>prefix==='quiz'?s.week.quiz:prefix==='assign'?(currentAssignment()?.questions||[]):practiceOf(current());
 const indexField=prefix=>({quiz:'quizIndex',assign:'assignIndex'}[prefix]||'questionIndex');
 const arrayOf=prefix=>prefix==='quiz'?s.week.quiz:currentAssignment().questions;
 const touch=prefix=>prefix==='assign'?assignmentChanged():changed();
 function writeQuestion(path,value){
  const parts=path.split('.'),prefix=parts[0],key=parts[1],item=questionList(prefix)[s[indexField(prefix)]];if(!item)return;
  if(key==='options'||key==='accepted')item[key]=value.split('\n');
  else if(key==='answers'){item.answers=[...host.querySelectorAll(`[data-path="${prefix}.answers"]:checked`)].map(e=>e.value);item.answer=item.answers.join('|');}
  else if(key==='imageAlt'){if(item.image)item.image.alt=value;}
  else if(key==='marks'||key==='tolerance'){if(value===''||!Number.isFinite(Number(value)))delete item[key];else item[key]=Number(value);}
  else item[key]=value;
  touch(prefix);
  if(key==='options'){const wrap=q(`[data-answer-wrap="${prefix}"]`);if(wrap){if(item.kind==='multi')item.answers=(item.answers||[]).filter(v=>(item.options||[]).includes(v));wrap.innerHTML=answerInput(item,prefix);}}
 }
 function moveQuestion(prefix,by){
  const list=questionList(prefix),field=indexField(prefix),from=s[field],to=from+by;if(to<0||to>=list.length)return;
  if(prefix!=='practice'){const list2=arrayOf(prefix);[list2[from],list2[to]]=[list2[to],list2[from]];}
  else{const lesson=current(),a=list[from],b=list[to],ia=lesson.questions.indexOf(a),ib=lesson.questions.indexOf(b);lesson.questions[ia]=b;lesson.questions[ib]=a;}
  s[field]=to;touch(prefix);refreshQuestions();
 }
 function duplicateQuestion(prefix){
  const list=questionList(prefix),field=indexField(prefix),item=list[s[field]];if(!item)return;
  const copy={...structuredClone(item),id:uid()};
  if(prefix!=='practice')arrayOf(prefix).splice(s[field]+1,0,copy);else{const lesson=current();lesson.questions.splice(lesson.questions.indexOf(item)+1,0,copy);}
  s[field]+=1;touch(prefix);refreshQuestions();
 }
 function importQuestions(prefix){
  const box=q(`[data-csv="${prefix}"]`),report=q(`[data-csv-report="${prefix}"]`);if(!box||!report)return;
  const {questions,errors}=questionsFromCSV(box.value,{stage:prefix==='quiz'?'quiz':prefix==='assign'?'assignment':'practice',makeId:uid});
  if(questions.length){if(prefix!=='practice')arrayOf(prefix).push(...questions);else current().questions.push(...questions);s[indexField(prefix)]=questionList(prefix).length-1;touch(prefix);refreshQuestions();}
  const after=q(`[data-csv-report="${prefix}"]`);
  if(after){after.textContent=`${questions.length} question${questions.length===1?'':'s'} imported.${errors.length?' Not imported: '+errors.join(' '):''}`;const d=after.closest('details');if(d)d.open=true;}
 }
 function refreshQuestions(){renderMain();renderOutline();updateReadiness();}

 // ---------- assignments (saved separately from the week, never published with it) ----------
 const savedAt=()=>'All changes saved at '+new Date().toLocaleTimeString('en-NG',{timeZone:'Africa/Lagos',hour:'2-digit',minute:'2-digit'});
 function assignmentChanged(){s.assignDirty=true;status('Unsaved changes');clearTimeout(s.assignTimer);s.assignTimer=setTimeout(saveAssignment,1500);}
 async function saveAssignment(){
  const a=currentAssignment();if(!a||!s.assignDirty)return true;
  clearTimeout(s.assignTimer);s.assignDirty=false;
  try{
   const payload=structuredClone(a);delete payload.submissions;delete payload.available;
   const result=await call('assignment-save',{assignment:payload});
   a.updatedAt=result.assignment.updatedAt;status(savedAt());return true;
  }catch(error){s.assignDirty=true;status(error.message);return false;}
 }
 function writeAssignment(path,value){
  const a=currentAssignment();if(!a)return;const key=path.split('.')[1];
  if(key==='title'){a.title=value;const label=q(`[data-outline-assignment="${CSS.escape(a.id)}"]`);if(label)label.textContent=value||'Untitled assignment';}
  else if(key==='lesson')a.lessons=value?[value]:[];
  else if(key==='lessons')a.lessons=[...host.querySelectorAll('[data-path="assign.lessons"]:checked')].map(e=>e.value);
  else if(key==='max')a.max=Number(value)||0;
  else if(key==='scope'){a.scope=value;if(value==='LESSON')a.lessons=a.lessons.slice(0,1);if(value==='WEEK_END')a.lessons=[];}
  else if(key==='mode'){a.mode=value;if(value!=='ONLINE')s.assignTab='write';}
  else a[key]=value;
  assignmentChanged();
  if(key==='mode'){renderMain();renderInspector({force:true});}else if(key==='scope')renderInspector({force:true});
 }
 async function selectAssignment(id){
  if(s.assignDirty&&!await saveAssignment())return;
  s.assignmentId=id;s.pane='assignment';s.assignTab='write';s.blockId=null;s.equation=null;s.assignIndex=0;s.pendingAssignDelete=null;render();
 }
 async function createAssignment(){
  if(s.assignDirty&&!await saveAssignment())return;
  const result=await call('assignment-save',{assignment:newAssignment(s.week.id)});
  s.assignments.push(result.assignment);await selectAssignment(result.assignment.id);
  const title=q('[data-path="assign.title"]');if(title){title.focus();title.select();}
  status('New assignment created. It stays locked until you release it.');
 }
 async function setRelease(a,body){
  const result=await call('assignment-release',{id:a.id,...body});
  Object.assign(a,result.assignment,{available:result.available});renderOutline();renderInspector({force:true});
  return result;
 }
 function openAssignRelease(){
  const a=currentAssignment();if(!a)return;
  saveAssignment().then(ok=>{if(ok)showPanel(releasePanelHTML(a));});
 }
 async function confirmAssignRelease(){
  const a=currentAssignment(),note=q('[data-assign-release-note]');if(!a)return;
  const mode=q('[data-assign-mode]:checked')?.value||'PUBLISHED',at=q('[data-assign-at]')?.value,due=q('[data-assign-due]')?.value;
  try{
   const result=await setRelease(a,{status:mode,due:mode==='LOCKED'?a.due:due,releaseAt:mode==='SCHEDULED'&&at?new Date(at).toISOString():null});
   hidePanel();status(mode==='PUBLISHED'?(result.available?'Released. Students can open it now.':'Released, but it opens when its subtopic is released.'):mode==='SCHEDULED'?'Scheduled.':'Kept locked.');
  }catch(error){if(note)note.textContent=error.message;status(error.message);}
 }
 function openAssignCopy(){
  const a=currentAssignment();if(!a)return;
  saveAssignment().then(ok=>{if(ok)showPanel(copyPanelHTML(a,{allocations,context,weekNumber:s.week.id}));});
 }
 async function confirmAssignCopy(){
  const a=currentAssignment(),note=q('[data-copy-note]');if(!a)return;
  const target={class:q('[data-copy-class]').value,subject:q('[data-copy-subject]').value,week:Number(q('[data-copy-week]').value)};
  try{
   await call('assignment-copy',{id:a.id,targets:[target]});
   const same=target.class===context.class&&target.subject===context.subject;
   hidePanel();status(`Copied to ${target.class} ${target.subject}, Week ${target.week}. It is locked there until you release it.`);
   if(same&&target.week===s.week.id){const fresh=await call('assignments?week='+s.week.id);s.assignments=fresh.assignments;renderOutline();}
  }catch(error){if(note)note.textContent=error.message;status(error.message);}
 }
 async function deleteAssignment(){
  const a=currentAssignment();if(!a)return;
  if(s.pendingAssignDelete!==a.id){s.pendingAssignDelete=a.id;const b=q('[data-studio="assign-delete"]');if(b)b.textContent='Click again to delete';return;}
  s.pendingAssignDelete=null;
  try{await call('assignment-delete',{id:a.id});s.assignments=s.assignments.filter(v=>v!==a);s.assignDirty=false;s.assignmentId=null;s.pane='lesson';render();status('Assignment deleted.');}
  catch(error){status(error.message);}
 }

 async function close(){
  if(s.assignDirty&&!await saveAssignment())return;
  if(s.dirty&&!await save()){status('Save failed. Retry saving or choose Discard unsaved edits to close.');if(!q('[data-studio="discard"]'))q('.st-top-actions').insertAdjacentHTML('beforeend',button('discard','Discard unsaved edits'));return;}
  host.close();
 }
 function dispose(){
  s.disposed=true;clearTimeout(s.autosave);destroyEditor();s.eqPanel?.destroy();
  host.classList.remove('content-studio-dialog');
  host.removeEventListener('click',onClick);host.removeEventListener('input',onInput);host.removeEventListener('change',onChange);host.removeEventListener('keydown',onKeydown);host.removeEventListener('mousedown',onMouseDown);host.removeEventListener('cancel',onCancel);
  window.removeEventListener('beforeunload',onUnload);window.removeEventListener('online',onOnline);
 }

 // ---------- events ----------
 const TEXT_COMMANDS={bold:'toggleBold',italic:'toggleItalic',underline:'toggleUnderline',subscript:'toggleSubscript',superscript:'toggleSuperscript',bullet:'toggleBulletList',ordered:'toggleOrderedList',quote:'toggleBlockquote'};
 async function onClick(event){
  const target=event.target.closest('[data-studio]');if(s.disposed||!target)return;
  event.preventDefault();const action=target.dataset.studio;
  if(action==='drawer-outline'||action==='drawer-inspector'){const name=action.slice(7);setDrawer(s.drawer===name?'':name,{focus:true});return;}
  if(action==='drawer-close'){setDrawer('');focusEditor();return;}
  if(narrow()&&target.closest('[data-outline]'))setDrawer('');
  try{
   if(action==='save'){await save();await saveAssignment();}
   else if(action==='publish')openPublish();
   else if(action==='publish-pick'&&s.publish){const scope=target.dataset.scope;s.publish.selected=new Set(scope==='none'?[]:s.week.lessons.filter(l=>scope==='all'||!s.releases[l.id]?.available).map(l=>l.id));renderPublish();}
   else if(action==='publish-confirm'&&s.publish){const p=s.publish;if(await save(true,{mode:p.mode,releaseAt:p.releaseAt?new Date(p.releaseAt).toISOString():null,lessons:[...p.selected]}))hidePanel();}
   else if(action==='close')await close();
   else if(action==='discard')host.close();
   else if(action==='preview')await preview();
   else if(action==='hide-panel')hidePanel();
   else if(action==='history')await showHistory();
   else if(action==='history-view'){
    const version=q('[data-history-version]').value,record=await call('weekly-history?week='+s.week.id+'&version='+encodeURIComponent(version)),lesson=record.content.lessons.find(l=>l.id===s.lessonId)||record.content.lessons[0],holder=q('[data-history-preview]');
    holder.innerHTML=`<div class="studio-comparison"><section><h4>Current draft</h4>${current()?renderLessonDocument({schemaVersion:1,blocks:lessonBlocks(current())}):''}</section><section><h4>Selected publication</h4>${lesson?renderLessonDocument(documentForLesson(lesson)):''}</section></div>`;await hydrateLessonMath(holder);
   }
   else if(action==='history-restore'){const version=q('[data-history-version]').value;await call('weekly-restore',{week:s.week.id,version,revision:s.revision,draftRevision:s.draftRevision});hidePanel();await load(s.week.id,true);status('Historical content restored as a new private draft. Publish only after reviewing it.');}
   else if(action==='load')await load(q('[data-load-week]').value);
   else if(action==='week-prev'||action==='week-next')await load(Math.max(1,Math.min(52,s.loadWeek+(action==='week-next'?1:-1))));
   else if(action==='new-lesson')addLesson();
   else if(action==='select-lesson')selectLesson(target.dataset.id);
   else if(action==='pane-lesson'||action==='pane-practice'){s.pane=action==='pane-lesson'?'lesson':'practice';s.blockId=null;render();}
   else if(action==='pane-quiz'){s.pane='quiz';s.blockId=null;render();}
   else if(action==='lesson-up')moveLesson(-1);
   else if(action==='lesson-down')moveLesson(1);
   else if(action==='lesson-duplicate')duplicateLesson();
   else if(action==='lesson-remove')removeLesson();
   else if(action==='insert'){target.closest('details')?.removeAttribute('open');await insertItem(target.dataset.type);}
   else if(action==='insert-template'){target.closest('details')?.removeAttribute('open');const t=s.templates.find(v=>v.id===target.dataset.id);if(t&&s.editor)placeBlock({...structuredClone(t.block),id:uid()},false);}
   else if(action==='continue-writing')continueWriting();
   else if(action==='image-pick'){const file=await pickImageFile();if(file){status('Uploading image…');const fileId=await uploadLessonImage(file,uploadImage);const b=selectedBlock();if(b){editorModule.updateBlock(s.editor,{...b,fileId});renderInspector({force:true});status('Image replaced.');}}}
   else if(action==='block-up'||action==='block-down'){if(s.blockId)editorModule.moveBlock(s.editor,s.blockId,action==='block-up'?-1:1);}
   else if(action==='block-duplicate'){if(s.blockId){const copy=editorModule.duplicateBlock(s.editor,s.blockId,uid());if(copy){s.blockId=copy.id;renderInspector({force:true});}}}
   else if(action==='block-remove'){if(s.blockId){editorModule.removeBlock(s.editor,s.blockId);s.blockId=null;renderInspector({force:true});}}
   else if(action==='save-template'){const record=await call('studio-templates',{name:q('[data-template-name]').value,block:selectedBlock()});s.templates.push(record);status('Private reusable item saved.');q('[data-insert-menu]')&&renderMain();}
   else if(action.startsWith('table-')){
    const block=selectedBlock();if(!block)return;const next=structuredClone(block);
    if(action==='table-row'&&next.rows.length<40)next.rows.push(next.headers.map(()=>''));
    if(action==='table-column'&&next.headers.length<12){next.headers.push('Column '+(next.headers.length+1));next.rows.forEach(row=>row.push(''));}
    if(action==='table-remove-row')next.rows.pop();
    if(action==='table-remove-column'&&next.headers.length>1){next.headers.pop();next.rows.forEach(row=>row.pop());}
    editorModule.updateBlock(s.editor,next);renderInspector({force:true});
   }
   else if(action==='undo'||action==='redo'){if(s.editor){s.editor.chain().focus()[action]().run();focusEditor();}}
   else if(action.startsWith('text-')){
    if(!s.editor){status('Open a subtopic to use the text tools.');return;}
    const command=action.slice(5);
    if(command==='inline-equation'){openInlineEquation({editor:s.editor});return;}
    if(command==='link'){showPanel('<div class="st-actions"><h3>Link</h3>'+button('hide-panel','Cancel')+'</div><label>Full HTTPS or mailto address<input data-link-url type="url" placeholder="https://"></label><div class="st-actions">'+button('apply-link','Apply link','class="primary"')+button('remove-link','Remove link')+'</div>');q('[data-link-url]').focus();return;}
    const method=TEXT_COMMANDS[command];if(method){s.editor.chain().focus()[method]().run();focusEditor();}
   }
   else if(action==='apply-link'){const href=safeLink(q('[data-link-url]').value);if(!href)throw Error('Use a full HTTPS or mailto address.');hidePanel();s.editor.chain().focus().setLink({href}).run();focusEditor();}
   else if(action==='remove-link'){hidePanel();s.editor?.chain().focus().unsetLink().run();focusEditor();}
   else if(action.startsWith('qimage-pick-')||action.startsWith('qimage-remove-')){
    const prefix=action.split('-')[2],item=questionList(prefix)[s[indexField(prefix)]];if(!item)return;
    if(action.startsWith('qimage-remove-'))delete item.image;
    else{if(!uploadImage)throw Error('Image upload is not available here.');const file=await pickImageFile();if(!file)return;status('Uploading picture…');const fileId=await uploadLessonImage(file,uploadImage);item.image={fileId,alt:item.image?.alt||''};status('Picture added. Describe it for learners who cannot see it.');}
    touch(prefix);refreshQuestions();
   }
   else if(action==='add-practice'){const lesson=current();lesson.questions.push(newQuestion(uid()));s.questionIndex=practiceOf(lesson).length-1;changed();refreshQuestions();}
   else if(action==='add-quiz'){s.week.quiz.push(newQuestion(uid(),'quiz'));s.quizIndex=s.week.quiz.length-1;changed();refreshQuestions();}
   else if(action==='remove-practice'){const lesson=current(),item=practiceOf(lesson)[s.questionIndex];lesson.questions=lesson.questions.filter(v=>v!==item);s.questionIndex=Math.max(0,s.questionIndex-1);changed();refreshQuestions();}
   else if(/^(duplicate|up|down|import)-(practice|quiz|assign)$/.test(action)){const [verb,prefix]=action.split('-');if(verb==='duplicate')duplicateQuestion(prefix);else if(verb==='import')importQuestions(prefix);else moveQuestion(prefix,verb==='up'?-1:1);}
   else if(action==='select-assignment')await selectAssignment(target.dataset.id);
   else if(action==='new-assignment')await createAssignment();
   else if(action==='assign-tab'){s.assignTab=target.dataset.tab;s.blockId=null;render();}
   else if(action==='assign-release')openAssignRelease();
   else if(action==='assign-release-confirm')await confirmAssignRelease();
   else if(action==='assign-lock'){const a=currentAssignment();if(a){await setRelease(a,{status:'LOCKED'});status('Locked. Students can no longer open it.');}}
   else if(action==='assign-copy')openAssignCopy();
   else if(action==='assign-copy-confirm')await confirmAssignCopy();
   else if(action==='assign-delete')await deleteAssignment();
   else if(action==='add-assign'){const a=currentAssignment();if(!a)return;(a.questions??=[]).push(newQuestion(uid(),'assignment'));s.assignIndex=a.questions.length-1;assignmentChanged();refreshQuestions();}
   else if(action==='remove-assign'){const a=currentAssignment();if(!a)return;a.questions.splice(s.assignIndex,1);s.assignIndex=Math.max(0,s.assignIndex-1);assignmentChanged();refreshQuestions();}
   else if(action==='remove-quiz'){s.week.quiz.splice(s.quizIndex,1);s.quizIndex=Math.max(0,s.quizIndex-1);changed();refreshQuestions();}
   else if(action==='fix-issue')goToIssue(s.issues?.[Number(target.dataset.issue)]);
  }catch(error){status(error.message);}
 }
 function goToIssue(issue){
  if(!issue)return;hidePanel();
  if(issue.bank==='quiz'){s.pane='quiz';s.quizIndex=issue.index||0;render();return;}
  if(issue.lessonId)s.lessonId=issue.lessonId;
  if(issue.bank){s.pane='practice';s.questionIndex=issue.index||0;render();return;}
  s.pane='lesson';s.blockId=null;render();
  if(issue.blockId&&s.editor){editorModule.selectBlock(s.editor,issue.blockId);s.blockId=issue.blockId;renderInspector({focus:true,force:true});return;}
  const field=issue.path?q(`[data-path="${issue.path}"]`):null;if(field){field.scrollIntoView({block:'center'});field.focus();}else focusEditor('end');
 }
 function onInput(event){
  const el=event.target,path=el.dataset?.path;
  if(el.matches?.('[data-publish-at]')&&s.publish){s.publish.releaseAt=el.value;renderPublish();return;}
  if(!path)return;
  const value=el.type==='checkbox'?el.checked:el.value,root=path.split('.')[0];
  if(root==='block'){writeBlock(path,value);return;}
  if(root==='week'){s.week[path.split('.')[1]]=value;changed();return;}
  if(root==='lesson'){
   const lesson=current();if(!lesson)return;const key=path.split('.')[1];lesson[key]=key==='minutes'?Number(value):value;changed();
   if(key==='title'){const label=q(`[data-outline-title="${CSS.escape(lesson.id)}"]`);if(label)label.textContent=lessonName(lesson,s.week.lessons.indexOf(lesson));}
   return;
  }
  if(root==='practice'||root==='quiz'||root==='assign'&&path.split('.')[1]!==undefined&&['prompt','options','answer','answers','accepted','explanation','hint','marks','tolerance','difficulty'].includes(path.split('.')[1]))writeQuestion(path,value);
  else if(root==='assign')writeAssignment(path,value,el);
 }
 async function onChange(event){
  const el=event.target;
  if(el.matches('[data-csv-file]')){
   const file=el.files?.[0],prefix=el.dataset.csvFile,report=q(`[data-csv-report="${prefix}"]`);if(!file)return;
   if(/\.xlsx?$/i.test(file.name)){if(report)report.textContent='Excel files cannot be read directly. In Excel choose File, Save As, CSV, or copy the cells and paste them in the box.';el.value='';return;}
   if(file.size>1024*1024){if(report)report.textContent='That file is too large (limit 1 MB).';el.value='';return;}
   const buffer=await file.arrayBuffer();let text=new TextDecoder('utf-8',{fatal:false}).decode(buffer);if(text.includes('\ufffd'))text=new TextDecoder('windows-1252').decode(buffer);
   const box=q(`[data-csv="${prefix}"]`);if(box)box.value=text;el.value='';importQuestions(prefix);return;
  }
  else if(el.matches('[data-publish-lesson]')&&s.publish){el.checked?s.publish.selected.add(el.value):s.publish.selected.delete(el.value);renderPublish();}
  else if(el.matches('[data-publish-mode]')&&s.publish){s.publish.mode=el.value;renderPublish();}
  else if(el.matches('[data-preview-width]'))q('.studio-preview').style.width=el.value;
  else if(el.dataset.bank){s[indexField(el.dataset.bank)]=Number(el.value);refreshQuestions();}
  else if(el.dataset.questionKind){const item=questionList(el.dataset.questionKind)[s[indexField(el.dataset.questionKind)]];item.kind=el.value;if(item.kind==='choice'||item.kind==='multi')item.options??=['',''];if(item.kind==='multi'){item.answers=[];item.answer='';}else delete item.answers;touch(el.dataset.questionKind);refreshQuestions();}
  else if(el.id==='studio-heading'&&s.editor){if(el.value==='0')s.editor.chain().focus().setParagraph().run();else s.editor.chain().focus().setHeading({level:Number(el.value)}).run();focusEditor();}
  else if(el.id==='studio-align'&&s.editor){s.editor.chain().focus().setTextAlign(el.value).run();focusEditor();}
  else if(el.matches('[data-load-week]')){/* opened with the Open button */}
 }
 function onKeydown(event){
  const field=event.target;
  if(event.key==='Escape'&&s.drawer&&panel().hidden){event.preventDefault();setDrawer('');focusEditor();return;}
  if(event.key==='Escape'&&!panel().hidden){event.preventDefault();event.stopPropagation();hidePanel();return;}
  if(!field.closest?.('[data-inspector]')||s.equation)return;
  const single=field.matches('input[type="text"],input[type="url"]')&&!field.closest('[data-eq-host]');
  if(event.key==='Enter'&&!event.shiftKey&&(single||event.ctrlKey||event.metaKey)){event.preventDefault();if(narrow())setDrawer('');continueWriting();}
  if(event.key==='Escape'&&s.editor){event.preventDefault();if(narrow())setDrawer('');focusEditor();}
 }
 // Toolbar buttons never take focus: the caret and selection stay where the teacher left them.
 function onMouseDown(event){if(event.target.closest('.st-toolbar button, .st-insert-list button, .studio-slash'))event.preventDefault();}
 const onUnload=event=>{if(s.dirty){event.preventDefault();event.returnValue='';}};
 const onOnline=()=>{if(s.dirty&&!s.conflict)save();};
 const onCancel=event=>{event.preventDefault();if(panel()&&!panel().hidden)hidePanel();else close();};

 host.addEventListener('click',onClick);host.addEventListener('input',onInput);host.addEventListener('change',onChange);host.addEventListener('keydown',onKeydown);host.addEventListener('mousedown',onMouseDown);host.addEventListener('cancel',onCancel);host.addEventListener('close',dispose,{once:true});
 window.addEventListener('beforeunload',onUnload);window.addEventListener('online',onOnline);
 try{await load(week);}catch(error){dispose();throw error;}
}
