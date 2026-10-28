import {documentForLesson,validateLessonDocument,youtubeVideoId,safeLink} from './lesson-document.js';
import {renderLessonDocument,hydrateLessonMath} from './lesson-renderer.js';
import {defaultGraph,defaultTool} from './math-engine.js';
import {publicationIssues} from './studio-checks.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button=(action,label,extra='')=>`<button type="button" data-studio="${action}" ${extra}>${label}</button>`;
const input=(label,path,value='',type='text')=>`<label>${label}<input data-path="${path}" type="${type}" value="${esc(value)}"></label>`;
const area=(label,path,value='')=>`<label>${label}<textarea data-path="${path}">${esc(value)}</textarea></label>`;
const uid=()=>crypto.randomUUID();
const richText=text=>({type:'doc',content:[{type:'paragraph',...(text?{content:[{type:'text',text}]}:{})}]});
const types=[['rich-text','Formatted text'],['heading','Heading'],['paragraph','Plain paragraph'],['equation','Equation'],['worked-example','Worked example'],['objectives','Learning objectives'],['table','Table'],['real-life','Real-life application'],['experiment','Experiment instructions'],['video','YouTube video'],['widget','Existing topic tool'],['summary','Summary'],['hint','Hint'],['warning','Important note'],['separator','Separator']];
types.splice(4,0,['graph','Interactive graph'],['math-tool','Mathematics toolkit']);
const newBlock=type=>({id:uid(),type,...({'rich-text':{content:richText('')},graph:{graph:defaultGraph()},'math-tool':{config:defaultTool()},heading:{text:'Heading',level:2},paragraph:{text:''},equation:{latex:'x^2-2x-3=0',displayMode:true},'worked-example':{prompt:'',explanation:'',answer:'',steps:[]},objectives:{items:[]},summary:{items:[]},table:{caption:'Table of values',headers:['x','y'],rows:[['',''],['','']]},'real-life':{text:''},experiment:{text:''},video:{videoId:''},widget:{tool:'topic'},hint:{text:''},warning:{text:''},separator:{}}[type])});

export async function openContentStudio({host,context,api,week=1,onPublished,renderWidget}){
 if(host.open)throw Error('Close the current editor before opening Content Studio.');
 if(!document.querySelector('link[data-studio-style]')){const link=document.createElement('link');link.rel='stylesheet';link.href='/content-studio.css';link.dataset.studioStyle='true';document.head.append(link);}
 const editorModule=await import('/vendor/studio-editor.js'),{createRichEditor}=editorModule;
 const s={week:null,lessonId:null,blockId:null,revision:null,draftRevision:null,assignments:[],dirty:false,generation:0,saving:null,conflict:false,disposed:false,editor:null,undo:[],undoIndex:-1,templates:[],status:'Loading lesson…',loadWeek:week,questionIndex:0,quizIndex:0,releases:{},publish:null,bankOpen:{practice:false,quiz:false}};
 const call=(route,data)=>data?api(route,{...context,...data}):api(route+(route.includes('?')?'&':'?')+new URLSearchParams(context));
 const current=()=>s.week?.lessons.find(l=>l.id===s.lessonId);
 const blocks=()=>{const lesson=current();if(!lesson)return [];lesson.document??=documentForLesson(lesson);return lesson.document.blocks;};
 const selected=()=>blocks().find(b=>b.id===s.blockId);
 const destroyEditor=()=>{s.editor?.destroy();s.editor=null;};
 const status=message=>{s.status=message;const el=host.querySelector('[data-studio-status]');if(el)el.textContent=message;};
 function historyPoint(){const snapshot=JSON.stringify(s.week);if(s.undo[s.undoIndex]===snapshot)return;s.undo=s.undo.slice(0,s.undoIndex+1);s.undo.push(snapshot);if(s.undo.length>30)s.undo.shift();s.undoIndex=s.undo.length-1;}
 function changed(source='document'){s.lastEdit=source;s.dirty=true;s.generation++;status('Unsaved changes');updateReadiness();clearTimeout(s.autosave);clearTimeout(s.historyTimer);clearTimeout(s.previewTimer);s.previewTimer=setTimeout(()=>{if(s.disposed)return;const block=selected(),card=[...host.querySelectorAll('[data-block]')].find(el=>el.dataset.block===block?.id),preview=card?.querySelector('[data-block-preview]');if(block&&preview){preview.innerHTML='<summary>Student view of this item</summary>'+renderLessonDocument({schemaVersion:1,blocks:[block]},{renderWidget});hydrateLessonMath(preview);}},300);s.historyTimer=setTimeout(historyPoint,700);if(!s.conflict)s.autosave=setTimeout(()=>save(false),1300);}
 function mutate(fn){historyPoint();fn();changed();historyPoint();render();}
 const blankText=block=>{if(block.type!=='rich-text')return false;let used=false;const walk=node=>{if(node.type==='inlineMath'||(node.type==='text'&&node.text?.trim()))used=true;node.content?.forEach(walk);};walk(block.content||{});return !used;};
 // Focus synchronously (see focusNow): keystrokes typed straight after an insertion must land in the new line.
 function focusEditor(position=null){editorModule.focusNow(s.editor,position);}
 function insertLessonBlock(block){
  const list=blocks(),index=list.findIndex(b=>b.id===s.blockId),editor=selected()?.type==='rich-text'?s.editor:null;
  mutate(()=>{
   let at=index<0?list.length:index+1,remove=0,items=[block];
   if(editor&&block.type!=='rich-text'){
    const {doc,selection}=editor.state,before=doc.cut(0,selection.from),after=doc.cut(selection.to);
    const hasContent=node=>{let content=!!node.textContent.trim();node.descendants(child=>{if(child.type.name==='inlineMath')content=true;});return content;};
    // structuredClone: ProseMirror attribute objects have no prototype, which the lesson validator rejects.
    items=[...(hasContent(before)?[{...selected(),content:structuredClone(before.toJSON())}]:[]),block,...(hasContent(after)?[{id:uid(),type:'rich-text',content:structuredClone(after.toJSON())}]:[])];at=index;remove=1;
   }
   list.splice(at,remove,...items);
   // Every inserted item is followed by a writable line, created in the same undo step.
   if(block.type!=='rich-text'){const position=list.indexOf(block);if(list[position+1]?.type!=='rich-text')list.splice(position+1,0,{id:uid(),type:'rich-text',content:richText('')});}
   s.blockId=block.id;
  });
  afterInsert(block);
 }
 // Decide where the caret goes after an insertion: into the item if it needs input, otherwise onto the next line.
 function afterInsert(block){
  if(block.type==='rich-text'){switchTab('home');focusEditor();return;}
  if(block.type==='equation'){openEquation({kind:'block',id:block.id,latex:block.latex,fresh:true});return;}
  if(block.type==='widget'){continueWriting(block.id);return;}
  if(['graph','math-tool'].includes(block.type)){
   // The graph/toolkit controls mount asynchronously: hold focus on the item, then move it to the first control unless the teacher has already moved on.
   const card=host.querySelector('.studio-block.selected');card?.focus();
   (async()=>{for(let i=0;i<60&&!s.disposed;i++){const control=host.querySelector('.studio-block.selected [data-math-author] input, .studio-block.selected [data-math-author] select');if(control){if(document.activeElement===card||document.activeElement===document.body)control.focus();return;}await new Promise(resolve=>setTimeout(resolve,50));}})();
   return;
  }
  const field=host.querySelector('[data-item-editor] [data-path]');
  if(field){field.focus();field.scrollIntoView({block:'center'});return;}
  continueWriting(block.id);
 }
 function continueWriting(id=s.blockId){
  if(!current())return;
  const list=blocks(),index=list.findIndex(b=>b.id===id),next=list[index+1];
  s.tab='home';
  if(next?.type==='rich-text'){s.blockId=next.id;render();}
  else mutate(()=>{const block=newBlock('rich-text');list.splice(index<0?list.length:index+1,0,block);s.blockId=block.id;});
  focusEditor('start');host.querySelector('.studio-rich-editor')?.scrollIntoView({block:'nearest'});
 }
 async function save(publish=false,release=null){
  while(s.saving)await s.saving;if(s.disposed)return false;if(s.conflict){status('A newer edit exists. Reload latest before saving. Your changes remain in this editor.');return false;}
  if(!publish&&!s.dirty)return true;
  clearTimeout(s.autosave);const generation=s.generation,payload=structuredClone(s.week);status(publish?'Validating and publishing…':'Saving private draft…');
  const run=async()=>{
   try{
    if(publish)for(const lesson of payload.lessons){const list=lesson.document?.blocks;if(list?.some(block=>!blankText(block)))lesson.document.blocks=list.filter(block=>!blankText(block));}
    for(const lesson of payload.lessons)if(lesson.document)validateLessonDocument(lesson.document);
    const result=await call('weekly-template',{week:payload,assignments:s.assignments,revision:s.revision,draftRevision:s.draftRevision,publish,release});
    s.revision=result.revision;s.draftRevision=result.draftRevision;
    if(generation===s.generation){s.dirty=false;if(result.week&&typeof result.week==='object')s.week=result.week;status(publish?publishedMessage(result):'All changes saved at '+new Date().toLocaleTimeString('en-NG',{timeZone:'Africa/Lagos',hour:'2-digit',minute:'2-digit'}));}
    else{status(publish?'Published the saved revision. Newer changes are still a private draft.':'Newer changes are waiting to save…');s.autosave=setTimeout(()=>save(false),500);}
    if(publish){s.releases=await releaseMap();await onPublished?.();}return true;
   }catch(error){s.conflict=/changed|revision|another window|another teacher/i.test(error.message);status((s.conflict?'Save conflict. ':'Could not save. ')+error.message+' Your unsaved changes remain in this editor.');return false;}
  };
  s.saving=run();try{return await s.saving;}finally{s.saving=null;}
 }
 async function load(id,discard=false){
  if(!Number.isInteger(Number(id))||Number(id)<1||Number(id)>52)throw Error('Choose a learning week from 1 to 52.');
  if(!discard&&s.dirty&&!await save())return;
  const request=s.loadRequest=(s.loadRequest||0)+1;status('Loading week '+Number(id)+'…');host.setAttribute('aria-busy','true');const data=await call('weekly-template?week='+Number(id)),templates=await call('studio-templates');if(s.disposed||request!==s.loadRequest)return;destroyEditor();s.week=structuredClone(data.draft?.week||data.published||{id:Number(id),title:'',lessons:[],quiz:[],reflectionPrompt:'What did you learn and what needs more practice?'});
  s.revision=data.draft&&Object.hasOwn(data.draft,'baseRevision')?data.draft.baseRevision:data.revision;s.draftRevision=data.draftRevision;s.releases=data.releases||{};s.assignments=structuredClone(data.draft?.assignments||data.assignments||[]);s.lessonId=s.week.lessons[0]?.id||null;s.blockId=null;s.dirty=false;s.conflict=false;s.questionIndex=0;s.quizIndex=0;s.loadWeek=Number(id);s.undo=[];s.undoIndex=-1;historyPoint();s.templates=templates;s.status=data.draft?'Private draft loaded':'Published content loaded';host.removeAttribute('aria-busy');render();
 }
 function defaultQuestion(){return {id:uid(),prompt:'',kind:'numeric',answer:'',explanation:'',stage:'practice'};}
 function blankLesson(){return {id:s.week.id+'-'+uid(),title:'',minutes:20,explain:'',objectives:[],summary:[],document:{schemaVersion:1,blocks:[]},questions:[]};}
 const lessonName=(l,i)=>l.title?.trim()||'Untitled subtopic '+(i+1);
 const releaseLabel=id=>{const r=s.releases[id];if(!r)return 'Not published';if(r.available)return 'Live';if(r.status==='SCHEDULED')return 'Scheduled '+new Date(r.releaseAt).toLocaleString('en-NG',{timeZone:'Africa/Lagos',dateStyle:'medium',timeStyle:'short'});return ({DRAFT:'Draft',LOCKED:'Locked',ARCHIVED:'Archived'})[r.status]||'Not published';};
 async function releaseMap(){try{const data=await call('weekly-template?week='+Number(s.week.id));return data.releases||{};}catch{return s.releases;}}
 function publishedMessage(result){const n=result.released?.length||0,what=n===1?'1 subtopic':n+' subtopics';return 'Published: '+(result.mode==='SCHEDULED'?what+' scheduled for release.':result.mode==='DRAFT'?what+' kept as draft (hidden from students).':result.mode==='LOCKED'?what+' saved and locked.':what+' now live for students.');}
 function updateReadiness(){const node=host.querySelector('[data-readiness]');if(!node||!s.week)return;const all=publicationIssues(s.week),errors=all.filter(i=>i.severity==='error').length,warnings=all.length-errors;node.textContent=errors?errors+' thing'+(errors===1?'':'s')+' to fix before publishing':warnings?'Ready to publish · '+warnings+' suggestion'+(warnings===1?'':'s'):'Ready to publish';node.classList.toggle('is-ready',!errors);}
 function issueList(list){return '<ol class="studio-checklist">'+list.map(issue=>`<li>${esc(issue.message)} ${button('fix-issue','Go to this item',`data-issue="${s.issues.indexOf(issue)}"`)}</li>`).join('')+'</ol>';}
 function reviewPublication(){s.issues=publicationIssues(s.week);const errors=s.issues.filter(i=>i.severity==='error'),warnings=s.issues.filter(i=>i.severity==='warning');const panel=host.querySelector('[data-studio-panel]');panel.hidden=false;panel.innerHTML=`<div class="studio-actions"><h3>${errors.length?'Fix these before publishing':'Your week is ready'}</h3>${button('hide-panel','Close checklist')}</div>${errors.length?'<h4>Must fix</h4>'+issueList(errors):'<p>Every subtopic has a title and teaching content.</p>'}${warnings.length?'<h4>Suggestions (you can still publish)</h4>'+issueList(warnings):''}<p class="small muted">Save draft keeps unfinished work private at any time.</p>`;panel.scrollIntoView({block:'start'});return !errors.length;}
 function openPublish(){
  const lessons=s.week.lessons;if(!lessons.length){status('Add a subtopic before publishing.');return;}
  const ok=l=>!publicationIssues(s.week,new Set([l.id])).some(i=>i.severity==='error'&&i.lessonId===l.id);
  s.publish={mode:s.publish?.mode||'NOW',selected:new Set(lessons.filter(ok).map(l=>l.id)),releaseAt:s.publish?.releaseAt||''};
  s.issues=publicationIssues(s.week,s.publish.selected);renderPublish();
 }
 function renderPublish(){
  const p=s.publish,panel=host.querySelector('[data-studio-panel]');s.issues=publicationIssues(s.week);
  const inScope=i=>!i.lessonId||p.selected.has(i.lessonId);
  const errors=s.issues.filter(i=>i.severity==='error'&&inScope(i)),skipped=s.issues.filter(i=>i.severity==='error'&&!inScope(i)),warnings=s.issues.filter(i=>i.severity==='warning'&&inScope(i));
  const list=items=>'<ol class="studio-checklist">'+items.map(issue=>`<li>${esc(issue.message)} ${button('fix-issue','Go to this item',`data-issue="${s.issues.indexOf(issue)}"`)}</li>`).join('')+'</ol>';
  const count=p.selected.size,needDate=p.mode==='SCHEDULED'&&!p.releaseAt,can=count>0&&!errors.length&&!needDate;
  panel.hidden=false;panel.innerHTML=`<div class="studio-actions"><h3>Publish week ${s.week.id}</h3>${button('hide-panel','Cancel')}</div>
  <fieldset class="studio-publish-lessons"><legend>Which subtopics?</legend>${s.week.lessons.map((l,i)=>`<label class="row"><input type="checkbox" data-publish-lesson value="${esc(l.id)}" ${p.selected.has(l.id)?'checked':''}> <span><strong>${esc(lessonName(l,i))}</strong> <span class="small muted">· now: ${esc(releaseLabel(l.id))}</span></span></label>`).join('')}</fieldset>
  <fieldset class="studio-publish-mode"><legend>When should students see it?</legend>${[['NOW','Publish now','Students can open it straight away.'],['SCHEDULED','Schedule','Opens automatically at the date and time you choose.'],['LOCKED','Publish but keep locked','Saved for the class; students cannot open it until you unlock it.'],['DRAFT','Keep as draft','Hidden from students.']].map(([v,l,d])=>`<label class="row"><input type="radio" name="publish-mode" data-publish-mode value="${v}" ${p.mode===v?'checked':''}> <span><strong>${l}</strong><br><span class="small muted">${d}</span></span></label>`).join('')}${p.mode==='SCHEDULED'?`<label>Release date and time<input type="datetime-local" data-publish-at value="${esc(p.releaseAt)}"></label>`:''}</fieldset>
  ${errors.length?'<h4>Must fix first</h4>'+list(errors):''}${skipped.length?'<h4>Not ready, so not included</h4>'+list(skipped):''}${warnings.length?'<h4>Suggestions (you can still publish)</h4>'+list(warnings):''}
  <div class="studio-actions">${button('publish-confirm',count===1?'Publish 1 subtopic':'Publish '+count+' subtopics',`class="primary" ${can?'':'disabled'}`)}${count===0?'<span class="small">Choose at least one subtopic.</span>':needDate?'<span class="small">Choose a release date.</span>':''}</div>`;
  panel.scrollIntoView({block:'start'});
 }
 function answerInput(q,prefix){if(q.kind==='choice'||q.kind==='boolean'){const options=q.kind==='choice'?(q.options||[]).filter(v=>v.trim()):['true','false'];return `<label>Correct answer<select data-path="${prefix}.answer"><option value="">Choose the correct answer</option>${options.map(v=>`<option value="${esc(v)}" ${v===q.answer?'selected':''}>${esc(q.kind==='boolean'?(v==='true'?'True':'False'):v)}</option>`).join('')}${q.answer&&!options.includes(q.answer)?`<option selected value="${esc(q.answer)}">${esc(q.answer)} — update to match a choice</option>`:''}</select></label>`;}return input('Correct answer',prefix+'.answer',q.answer);}
 function questionPanel(quiz=false){
  const qs=quiz?s.week.quiz:(current()?.questions||[]).filter(q=>q.stage!=='quiz'),index=Math.max(0,Math.min(quiz?s.quizIndex:s.questionIndex,qs.length-1)),q=qs[index],prefix=quiz?'quiz':'practice';
  const names={numeric:'Number answer',choice:'Multiple choice',boolean:'True or false',short:'Short written answer',expression:'Mathematical expression',fill:'Fill in the blank'};
  return `<details class="studio-bank" data-bank-panel="${prefix}" ${s.bankOpen[prefix]?'open':''}><summary>${quiz?'End-of-week quiz':'Subtopic practice'} · ${qs.length} question(s)</summary><p class="small muted">${quiz?'This quiz covers the whole week.':'These questions belong to the selected subtopic.'} Answers are hidden from students until they submit.</p>${q?`<label>Choose a question to edit<select data-bank="${prefix}">${qs.map((v,i)=>`<option value="${i}" ${index===i?'selected':''}>${i+1}. ${esc(v.prompt.slice(0,60)||'New question')}</option>`).join('')}</select></label>${area('Question',prefix+'.prompt',q.prompt)}<label>How should the student answer?<select data-question-kind="${prefix}">${Object.entries(names).map(([kind,label])=>`<option value="${kind}" ${q.kind===kind?'selected':''}>${label}</option>`).join('')}${!names[q.kind]?`<option selected value="${esc(q.kind)}">Existing ${esc(q.kind)} question (retained)</option>`:''}</select></label>${q.kind==='choice'?area('Choices (one per line)',prefix+'.options',(q.options||[]).join('\n')):''}${answerInput(q,prefix)}${area('Feedback / worked solution',prefix+'.explanation',q.explanation)}`:'<p>No questions yet. Add your first question below.</p>'}<div class="studio-actions">${button('add-'+prefix,'Add question')}${q?button('remove-'+prefix,'Delete selected question'):''}</div></details>`;
 }
 function properties(block){
  if(!block)return '<p>Select a content block to edit it.</p>';
  let body='';
  if(block.type==='rich-text')body='<div class="studio-rich-editor"></div>';
  if(['graph','math-tool'].includes(block.type))body='<div data-math-author></div>';
  if(['heading','paragraph','hint','warning','real-life','experiment'].includes(block.type))body=area('Text','block.text',block.text)+(block.type==='heading'?input('Heading level (1–4)','block.level',block.level,'number'):'');
  if(block.type==='equation')body=button('equation','Edit equation visually')+`<p class="small muted">${esc(block.latex)}</p><label class="row"><input type="checkbox" data-equation-display ${block.displayMode?'checked':''}>Centred display equation</label>`;
  if(['objectives','summary'].includes(block.type))body=area('One point per line','block.items',block.items.join('\n'));
  if(block.type==='worked-example')body=area('Question / example','block.prompt',block.prompt)+area('Explanation','block.explanation',block.explanation)+input('Answer','block.answer',block.answer)+area('Reveal steps (one per line)','block.steps',(block.steps||[]).join('\n'));
  if(block.type==='video')body=input('HTTPS YouTube link','block.video',block.videoId?'https://www.youtube.com/watch?v='+block.videoId:'');
  if(block.type==='table')body=input('Caption','block.caption',block.caption)+`<div class="studio-table-edit">${block.headers.map((v,i)=>input('Column '+(i+1),'block.headers.'+i,v)).join('')}${block.rows.map((row,r)=>`<fieldset><legend>Row ${r+1}</legend>${row.map((v,c)=>input(block.headers[c]||'Value',`block.rows.${r}.${c}`,v)).join('')}</fieldset>`).join('')}</div><div class="studio-actions">${button('table-row','Add row')}${button('table-column','Add column')}${button('table-remove-row','Remove last row')}${button('table-remove-column','Remove last column')}</div>`;
  if(block.type==='widget')body='<p>The existing interactive tool follows this lesson’s class, subject, term and topic.</p>';
  return body+`<details class="gap"><summary>Reuse this block</summary><label>Template name<input data-template-name maxlength="100"></label>${button('save-template','Save private template')}</details>`;
 }
 function toolbar(){return `<div class="studio-toolbar" role="toolbar" aria-label="Text formatting"><div class="studio-ribbon-group"><div class="studio-ribbon-tools"><label class="sr-only" for="studio-heading">Text style</label><select id="studio-heading"><option value="0">Normal text</option>${[1,2,3,4].map(v=>`<option value="${v}">Heading ${v}</option>`).join('')}</select>${[['bold','<b>B</b>','Bold'],['italic','<i>I</i>','Italic'],['underline','<u>U</u>','Underline'],['subscript','x₂','x₂ subscript'],['superscript','x²','x² superscript']].map(([action,label,title])=>button('text-'+action,label,`aria-label="${title}" title="${title}"`)).join('')}</div><span>Text</span></div><div class="studio-ribbon-group"><div class="studio-ribbon-tools">${button('text-bullet','• Bullet list')}${button('text-ordered','1. Numbered list')}<label class="sr-only" for="studio-align">Text alignment</label><select id="studio-align">${['left','center','right','justify'].map(v=>`<option>${v}</option>`).join('')}</select>${button('text-quote','Quote')}</div><span>Paragraph</span></div></div>`;}
 function switchTab(tab){
  s.tab=tab;
  host.querySelectorAll('[data-ribbon-tab]').forEach(el=>{const active=el.dataset.ribbonTab===tab;el.setAttribute('aria-selected',String(active));el.tabIndex=active?0:-1;});
  host.querySelectorAll('[data-ribbon-page]').forEach(el=>el.hidden=el.dataset.ribbonPage!==tab);
 }
 function render(){
  if(s.disposed)return;
  host.querySelectorAll('[data-bank-panel]').forEach(el=>s.bankOpen[el.dataset.bankPanel]=el.open);
  if(s.forceBank){s.bankOpen[s.forceBank]=true;s.forceBank=null;}
  const previousBlockIndex=[...host.querySelectorAll('[data-block]')].findIndex(el=>el.dataset.block===s.blockId);
  destroyEditor();s.mathModule?.hideMathKeyboard();s.equationTarget=null;s.mathField=null;
  const lesson=current(),all=blocks();if(!all.some(b=>b.id===s.blockId))s.blockId=all[Math.min(Math.max(previousBlockIndex,0),all.length-1)]?.id||null;const block=selected();
  host.classList.add('content-studio-dialog');host.classList.remove('weekly-builder-dialog');
  const cards=all.map((b,index)=>{
   const active=b.id===s.blockId,label=types.find(v=>v[0]===b.type)?.[1]||b.type;
   return `<article class="studio-block ${active?'selected':''}" data-block="${b.id}" data-kind="${b.type}" tabindex="0" aria-label="${esc(label)}. Press Enter to write below."><header><button type="button" draggable="true" data-drag="${b.id}" aria-label="Drag lesson item ${index+1}">↕</button>${button('select',label,`data-id="${b.id}" aria-pressed="${active}"`)}</header>${active?`<div class="studio-item-editor" data-item-editor>${properties(b)}</div>`:''}<details data-block-preview open><summary>Student view of this item</summary>${renderLessonDocument({schemaVersion:1,blocks:[b]},{renderWidget})}</details>${active&&b.type!=='rich-text'?button('continue-writing','↵ Continue writing','class="studio-continue" title="Write below this item (Ctrl+Enter)"'):''}</article>`;
  }).join('');
  host.innerHTML=`<div class="studio-chrome"><header class="studio-header"><div class="studio-document-name"><span class="studio-app-mark">L</span><h2>Lesson Studio</h2><span class="studio-context">${esc(context.class)} · ${esc(context.subject)}</span></div><div class="studio-actions">${button('save','Save draft')}${button('preview','Preview','aria-label="Student preview"')}${button('publish','Publish','class="primary"')}${button('close','✕','aria-label="Close Content Studio"')}</div></header>
  <nav class="studio-tabs" role="tablist" aria-label="Lesson toolkits">${[['file','File'],['home','Home'],['insert','Insert'],['questions','Questions'],['review','Review']].map(([id,label])=>`<button type="button" role="tab" id="studio-tab-${id}" data-studio="ribbon" data-ribbon-tab="${id}" aria-controls="studio-ribbon-${id}" aria-selected="false" tabindex="-1">${label}</button>`).join('')}</nav>
  <section id="studio-ribbon-home" data-ribbon-page="home" role="tabpanel" aria-labelledby="studio-tab-home" class="studio-ribbon">${toolbar()}<div class="studio-ribbon-group"><div class="studio-ribbon-tools">${button('undo','↶','aria-label="Undo" title="Undo"')}${button('redo','↷','aria-label="Redo" title="Redo"')}${button('write','Text','title="Start or continue writing"')}</div><span>Editing</span></div>${block?`<div class="studio-ribbon-group"><div class="studio-ribbon-tools">${button('up','↑',`data-id="${block.id}" aria-label="Move item up"`)}${button('down','↓',`data-id="${block.id}" aria-label="Move item down"`)}${button('duplicate','Duplicate',`data-id="${block.id}"`)}${button('remove','Delete',`data-id="${block.id}"`)}</div><span>Selected item</span></div>`:''}</section>
  <section id="studio-ribbon-insert" data-ribbon-page="insert" role="tabpanel" aria-labelledby="studio-tab-insert" class="studio-ribbon" hidden><div class="studio-ribbon-group"><div class="studio-ribbon-tools">${[['rich-text','Text'],['equation','Equation'],['graph','Graph'],['table','Table'],['video','Video']].map(([type,label])=>button('insert',label,`data-type="${type}" aria-label="Add ${label.toLowerCase()}"`)).join('')}${button('text-link','Link')}${button('text-inline-equation','Inline equation')}</div><span>Add to lesson</span></div><div class="studio-ribbon-group studio-insert"><div class="studio-ribbon-tools"><select data-insert-type aria-label="More lesson items">${types.map(([type,label])=>`<option value="${type}" ${type===(s.insertType||'rich-text')?'selected':''}>${label}</option>`).join('')}</select>${button('insert','Insert')}</div><span>More items</span></div><details class="studio-saved-items"><summary>Saved items</summary><select data-template aria-label="Saved reusable item"><option value="">Choose saved item</option>${s.templates.map(v=>`<option value="${v.id}">${esc(v.name)}</option>`).join('')}</select>${button('insert-template','Insert saved item')}</details></section>
  <section id="studio-ribbon-file" data-ribbon-page="file" role="tabpanel" aria-labelledby="studio-tab-file" class="studio-dock studio-setup" hidden><div class="studio-scope"><label>Week<input data-load-week type="number" min="1" max="52" value="${s.loadWeek}"></label>${button('load','Load week')}${input('Weekly topic','week.title',s.week.title)}<label>Subtopic<select data-lesson>${s.week.lessons.map((l,i)=>`<option value="${esc(l.id)}" ${l.id===s.lessonId?'selected':''}>${esc(l.title||'Untitled subtopic '+(i+1))} · ${esc(releaseLabel(l.id))}</option>`).join('')}</select></label>${lesson?input('Minutes','lesson.minutes',lesson.minutes||20,'number'):''}</div><div class="studio-actions">${button('new-lesson','Add subtopic')}${button('blank-template','Start blank template')}${button('history','Version history')}${button('reload','Reload latest')}</div></section>
  <section id="studio-ribbon-questions" data-ribbon-page="questions" role="tabpanel" aria-labelledby="studio-tab-questions" class="studio-dock studio-properties" hidden>${lesson?questionPanel()+questionPanel(true):'<p>Add a subtopic in File to create questions.</p>'}</section>
  <section id="studio-ribbon-review" data-ribbon-page="review" role="tabpanel" aria-labelledby="studio-tab-review" class="studio-dock" hidden><div class="studio-actions">${button('check-ready','Check before publishing')}<span data-readiness role="status" aria-live="polite"></span></div><ul class="studio-release-list">${s.week.lessons.map((l,i)=>`<li><strong>${esc(lessonName(l,i))}</strong> · ${esc(releaseLabel(l.id))}</li>`).join('')}</ul><p class="small muted">Save draft keeps unfinished work private. Publish lets you release subtopics now, on a date, or keep them locked.</p></section></div>
  <section data-studio-panel hidden aria-label="Lesson dialog"></section>
  <div class="studio-workspace"><main class="studio-canvas" aria-label="Lesson page">${lesson?`<div class="studio-page-heading"><span>WEEK ${s.week.id} · ${esc(s.week.title||'Untitled topic')}</span><textarea data-path="lesson.title" rows="1" aria-label="Subtopic title" placeholder="Lesson title">${esc(lesson.title)}</textarea></div><div class="studio-block-list">${cards||button('write','Click here to start writing…','class="studio-start-writing"')}</div>`:`<div class="studio-empty"><h3>Your lesson starts here</h3>${button('start-document','Create a lesson','class="primary"')}</div>`}</main></div>
  <footer class="studio-statusbar"><span>Week ${s.week.id} · Term ${esc(context.term)}</span><span data-studio-status role="status" aria-live="polite">${esc(s.status)}</span></footer>`;
  switchTab(s.tab||'home');
  updateReadiness();
  if(block?.type==='rich-text')s.editor=createRichEditor({element:host.querySelector('.studio-rich-editor'),content:block.content,onUpdate:content=>{selected().content=structuredClone(content);changed('text');},onEquation:target=>openEquation({kind:'inline',...target})});
  hydrateLessonMath(host);
  if(['graph','math-tool'].includes(block?.type)){const element=host.querySelector('[data-math-author]'),id=block.id;import('./math-authoring.js').then(module=>{if(!element.isConnected)return;const update=value=>{const currentBlock=blocks().find(b=>b.id===id);if(currentBlock){currentBlock[block.type==='graph'?'graph':'config']=value;changed();}};if(block.type==='graph')module.mountGraphAuthor(element,block.graph,update);else module.mountToolAuthor(element,block.config,update);}).catch(error=>{if(element.isConnected)element.textContent=error.message;});}
  if(!host.open)host.showModal();
 }
 function writePath(path,value){
  const parts=path.split('.'),root=parts.shift();let target=root==='week'?s.week:root==='lesson'?current():root==='block'?selected():root==='quiz'?s.week.quiz[s.quizIndex]:(current()?.questions||[]).filter(q=>q.stage!=='quiz')[s.questionIndex];
  if(!target)return;const key=parts.pop();for(const part of parts)target=target[part];
  if(['items','steps','options'].includes(key))value=value.split('\n');if(key==='level'||key==='minutes')value=Number(value);
  if(root==='block'&&key==='video'){const id=youtubeVideoId(value);if(!id){status('Use a valid HTTPS YouTube video link.');return;}target.videoId=id;}else target[key]=value;changed();
 }
 async function preview(document,heading='Student preview'){
  const questionPreview=(questions,label)=>questions?.length?`<section data-question-preview><h4>${label}</h4>${questions.map((q,i)=>`<div class="studio-preview-question"><strong>${i+1}. ${esc(q.prompt||'Question still to be written')}</strong>${q.kind==='choice'?(q.options||[]).map(option=>`<label><input type="radio" disabled>${esc(option)}</label>`).join(''):q.kind==='boolean'?'<p>True / False</p>':'<p><input disabled placeholder="Student enters an answer" aria-label="Student answer"></p>'}</div>`).join('')}</section>`:'';
  const panel=host.querySelector('[data-studio-panel]');panel.hidden=false;panel.innerHTML=`<div class="studio-actions"><h3>${esc(heading)}</h3>${button('hide-panel','Close preview')}<label>Preview width<select data-preview-width><option value="360px">Mobile</option><option value="768px">Tablet</option><option value="100%">Desktop</option></select></label></div><p class="small muted">Review your lesson and questions at different screen sizes. Correct answers are hidden. Live question submission is available on the student learning page.</p><div class="studio-preview" style="width:360px">${renderLessonDocument(document,{renderWidget})}${questionPreview((current()?.questions||[]).filter(q=>q.stage!=='quiz'),'Subtopic practice')}${questionPreview(s.week.quiz,'End-of-week quiz')}</div>`;await hydrateLessonMath(panel);panel.scrollIntoView({block:'start'});
 }
 async function openEquation(target){
  const panel=host.querySelector('[data-studio-panel]');panel.hidden=false;s.equationTarget=target;
  const latex=target.latex??selected()?.latex??'';
  if(target.kind==='inline'&&target.position===undefined)target.insertionPosition=Math.min(target.editor.state.selection.to,target.editor.state.doc.content.size-1);
  panel.innerHTML=`<div class="studio-actions"><h3>Insert mathematics</h3>${button('hide-panel','Close equation editor')}</div><div class="studio-actions">${[['fraction','Fraction'],['power','Power'],['root','Root'],['pi','π'],['theta','θ'],['sum','Σ'],['integral','Integral'],['le','≤'],['ge','≥'],['pm','±'],['log','Log'],['trig','Trig']].map(([key,label])=>button('symbol',label,`data-symbol="${key}"`)).join('')}</div><label>Editing mode<select data-math-mode><option value="visual">Visual editor</option><option value="source">LaTeX source</option></select></label><div data-visual-math><p role="status">Loading visual equation editor…</p></div><label data-source-math hidden>LaTeX<textarea data-latex>${esc(latex)}</textarea></label><details><summary>Fraction / matrix templates</summary><div class="studio-actions"><label>Numerator<input data-numerator value="2x+3"></label><label>Denominator<input data-denominator value="x-1"></label>${button('fraction-template','Use fraction')}</div><div class="studio-actions"><label>Matrix rows<input data-matrix-rows type="number" min="1" max="6" value="2"></label><label>Matrix columns<input data-matrix-columns type="number" min="1" max="6" value="2"></label>${button('matrix-resize','Resize matrix')}</div><div data-matrix-grid></div>${button('matrix-template','Use matrix')}</details><div data-equation-preview class="studio-equation-preview"></div><p data-equation-error class="error" role="alert"></p><div class="studio-actions">${button('apply-equation','Insert / update equation','class="primary"')}${button('keyboard','Math keyboard')}</div>`;
  s.equationLatex=latex;const setLatex=value=>{if(panel.querySelector('[data-math-mode]')?.value==='source')return;s.equationLatex=value;const source=panel.querySelector('[data-latex]');if(source)source.value=value;showEquationPreview();};
  drawMatrix();
  try{const module=await import('/vendor/math-input.js');if(s.equationTarget!==target||!panel.isConnected)return;s.mathModule=module;s.mathField=module.makeMathField(s.equationLatex,setLatex);panel.querySelector('[data-visual-math]').replaceChildren(s.mathField);if(target.fresh||target.kind==='block')s.mathField.focus();}catch{panel.querySelector('[data-visual-math]').textContent='Visual input could not load. Reconnect, or use LaTeX source.';}
  await showEquationPreview();panel.scrollIntoView({block:'start'});
 }
 function drawMatrix(){const panel=host.querySelector('[data-studio-panel]'),previous=new Map([...panel.querySelectorAll('[data-matrix-cell]')].map(cell=>[cell.dataset.row+':'+cell.dataset.col,cell.value])),rows=Math.max(1,Math.min(6,Number(panel.querySelector('[data-matrix-rows]').value)||2)),cols=Math.max(1,Math.min(6,Number(panel.querySelector('[data-matrix-columns]').value)||2));panel.querySelector('[data-matrix-grid]').innerHTML=Array.from({length:rows},(_,r)=>`<div class="studio-actions">${Array.from({length:cols},(_,c)=>`<label>Row ${r+1}, column ${c+1}<input data-matrix-cell data-row="${r}" data-col="${c}" value="${esc(previous.get(r+':'+c)??(r===c?'1':'0'))}"></label>`).join('')}</div>`).join('');}
 async function showEquationPreview(){const panel=host.querySelector('[data-studio-panel]'),preview=panel?.querySelector('[data-equation-preview]');if(!preview)return;const source=s.equationLatex;try{const {mathHTML}=await import('/vendor/math-render.js');if(source!==s.equationLatex||!preview.isConnected)return;preview.innerHTML=mathHTML(source,true);panel.querySelector('[data-equation-error]').textContent='';s.equationValid=true;}catch{panel.querySelector('[data-equation-error]').textContent='This equation could not be parsed. Check its commands, brackets and matrix cells.';s.equationValid=false;}}
 async function showHistory(){
  if(s.dirty&&!await save())return;const data=await call('weekly-history?week='+s.week.id),panel=host.querySelector('[data-studio-panel]');panel.hidden=false;
  panel.innerHTML=`<div class="studio-actions"><h3>Published version history</h3>${button('hide-panel','Close history')}</div><p>Restoring creates a new private draft. Existing publications, student attempts and assignment settings are retained.</p><label>Version<select data-history-version>${data.current?'<option value="current">Current publication</option>':''}${data.versions.map(v=>`<option value="${v.id}">${esc(new Date(v.created).toLocaleString('en-NG',{timeZone:'Africa/Lagos'}))} · ${esc(v.teacher)} · ${esc(v.title)}</option>`).join('')}</select></label><div class="studio-actions">${button('history-view','View / compare')}${button('history-restore','Restore as new draft')}</div><div data-history-preview></div>`;panel.scrollIntoView({block:'start'});
 }
 async function close(){if(s.dirty&&!await save()){status('Save failed. Retry saving or choose Discard unsaved edits to close.');if(!host.querySelector('[data-studio="discard"]'))host.querySelector('.studio-header').insertAdjacentHTML('beforeend',button('discard','Discard unsaved edits'));return;}host.close();}
 function dispose(){s.disposed=true;clearTimeout(s.autosave);clearTimeout(s.historyTimer);clearTimeout(s.previewTimer);destroyEditor();s.mathModule?.hideMathKeyboard();host.classList.remove('content-studio-dialog');host.removeEventListener('click',click);host.removeEventListener('keydown',ribbonKeys);host.removeEventListener('input',change);host.removeEventListener('change',selectChange);host.removeEventListener('cancel',cancel);host.removeEventListener('dragstart',dragStart);host.removeEventListener('dragover',dragOver,true);host.removeEventListener('drop',drop,true);host.removeEventListener('dragend',dragEnd);window.removeEventListener('beforeunload',unload);window.removeEventListener('online',online);}
 async function click(event){
  const target=event.target.closest('[data-studio]');if(s.disposed)return;
  if(!target){const card=event.target.closest('[data-block]'),id=card?.dataset.block,block=blocks().find(b=>b.id===id);if(block?.type==='equation'&&event.target.closest('.math-source')){s.blockId=id;render();await openEquation({kind:'block',id,latex:block.latex});}else if(block&&s.blockId!==id){s.blockId=id;render();if(block.type==='rich-text')focusEditor();}return;}
  event.preventDefault();const action=target.dataset.studio;
  try{
   if(action==='ribbon'){switchTab(target.dataset.ribbonTab);return;}
   if(action==='continue-writing'){continueWriting();return;}
   if(action==='start-document'||action==='write'){
    if(!current())mutate(()=>{const lesson=blankLesson();s.week.lessons.push(lesson);s.lessonId=lesson.id;});
    if(selected()?.type!=='rich-text'){continueWriting();return;}
    switchTab('home');focusEditor('end');return;
   }
   if(action==='save')await save();if(action==='publish')openPublish();if(action==='publish-confirm'&&s.publish){const p=s.publish;if(await save(true,{mode:p.mode,releaseAt:p.releaseAt?new Date(p.releaseAt).toISOString():null,lessons:[...p.selected]})){s.publish=null;host.querySelector('[data-studio-panel]').hidden=true;render();}}if(action==='check-ready')reviewPublication();if(action==='close')await close();if(action==='discard')host.close();
   if(action==='fix-issue'){const issue=s.issues?.[Number(target.dataset.issue)];if(!issue)return;if(issue.lessonId)s.lessonId=issue.lessonId;if(issue.blockId)s.blockId=issue.blockId;if(issue.bank){s.forceBank=issue.bank;s[issue.bank==='quiz'?'quizIndex':'questionIndex']=issue.index||0;}s.tab=issue.bank?'questions':issue.path?.startsWith('week.')?'file':issue.path?'home':'insert';render();const el=issue.path?host.querySelector(`[data-path="${issue.path}"]`):host.querySelector(issue.bank?`[data-bank-panel="${issue.bank}"]`:'.studio-insert');if(el){for(let parent=el.closest('details');parent;parent=parent.parentElement?.closest('details'))parent.open=true;el.scrollIntoView({block:'center'});el.focus();}}
   if(action==='load')await load(host.querySelector('[data-load-week]').value);
   if(action==='reload')await load(s.week.id,true);
   if(action==='new-lesson')mutate(()=>{const lesson=blankLesson();s.week.lessons.push(lesson);s.lessonId=lesson.id;s.blockId=null;s.questionIndex=0;});
   if(action==='blank-template')mutate(()=>{const lesson=blankLesson();s.week={...s.week,title:'',subtitle:'',reflectionPrompt:'',lessons:[lesson],quiz:[]};s.lessonId=lesson.id;s.blockId=null;s.questionIndex=0;s.quizIndex=0;});
   if(action==='remove-practice'||action==='remove-quiz')mutate(()=>{if(action==='remove-quiz'){s.week.quiz.splice(s.quizIndex,1);s.quizIndex=Math.max(0,s.quizIndex-1);}else{const q=current().questions.filter(q=>q.stage!=='quiz')[s.questionIndex];current().questions=current().questions.filter(v=>v!==q);s.questionIndex=Math.max(0,s.questionIndex-1);}});
   if(action==='select'){s.blockId=target.dataset.id;render();}
   if(action==='insert'){if(!current()){status('Create a lesson first, or add a subtopic in File.');return;}const type=target.dataset.type||s.insertType||'rich-text';if(type==='rich-text')s.tab='home';insertLessonBlock(newBlock(type));}
   if(action==='insert-template'){const template=s.templates.find(v=>v.id===host.querySelector('[data-template]').value);if(template)insertLessonBlock({...structuredClone(template.block),id:uid()});}
   if(['up','down','remove','duplicate'].includes(action))mutate(()=>{const all=blocks(),index=all.findIndex(b=>b.id===target.dataset.id);if(index<0)return;if(action==='remove')all.splice(index,1);if(action==='duplicate'){const copy={...structuredClone(all[index]),id:uid()};all.splice(index+1,0,copy);s.blockId=copy.id;}if(action==='up'&&index>0)[all[index-1],all[index]]=[all[index],all[index-1]];if(action==='down'&&index<all.length-1)[all[index+1],all[index]]=[all[index],all[index+1]];});
   if(action==='undo'||action==='redo'){if(s.lastEdit==='text'&&s.editor&&(action==='undo'?s.editor.can().undo():s.editor.can().redo())){s.editor.chain().focus()[action]().run();focusEditor();}else{historyPoint();const index=s.undoIndex+(action==='undo'?-1:1);if(index>=0&&index<s.undo.length){s.undoIndex=index;s.week=JSON.parse(s.undo[index]);changed();render();}}}
   if(action.startsWith('text-')){
    if(!s.editor){status('Select a formatted-text block to use the text toolbar.');return;}const command=action.slice(5),chain=s.editor.chain().focus();
    if(command==='inline-equation'){await openEquation({kind:'inline',editor:s.editor});return;}
    if(command==='link'){const panel=host.querySelector('[data-studio-panel]');panel.hidden=false;panel.innerHTML='<label>Full HTTPS or mailto link<input data-link-url type="url"></label>'+button('apply-link','Apply link')+button('remove-link','Remove link');return;}
    const method={bold:'toggleBold',italic:'toggleItalic',underline:'toggleUnderline',subscript:'toggleSubscript',superscript:'toggleSuperscript',bullet:'toggleBulletList',ordered:'toggleOrderedList',quote:'toggleBlockquote'}[command];if(method){chain[method]().run();focusEditor();}
   }
   if(action==='apply-link'){const href=safeLink(host.querySelector('[data-link-url]').value);if(!href)throw Error('Use a full HTTPS or mailto address.');s.editor.chain().focus().setLink({href}).run();focusEditor();host.querySelector('[data-studio-panel]').hidden=true;}
   if(action==='remove-link'){s.editor?.chain().focus().unsetLink().run();focusEditor();host.querySelector('[data-studio-panel]').hidden=true;}
   if(action==='equation')await openEquation({kind:'block',id:selected().id,latex:selected().latex});
   if(action==='symbol'||action==='fraction-template'||action==='matrix-template'){
    let latex={fraction:'\\frac{a}{b}',power:'x^2',root:'\\sqrt{x}',pi:'\\pi',theta:'\\theta',sum:'\\sum_{i=1}^{n}i',integral:'\\int_0^1 x\\,dx',le:'\\le',ge:'\\ge',pm:'\\pm',log:'\\log_{10}(x)',trig:'\\sin(x)'}[target.dataset.symbol];
    if(action==='fraction-template')latex='\\frac{'+host.querySelector('[data-numerator]').value+'}{'+host.querySelector('[data-denominator]').value+'}';
    if(action==='matrix-template'){const rows=new Map();for(const cell of host.querySelectorAll('[data-matrix-cell]')){if(!rows.has(cell.dataset.row))rows.set(cell.dataset.row,[]);rows.get(cell.dataset.row).push(cell.value);}latex='\\begin{pmatrix}'+[...rows.values()].map(row=>row.join('&')).join('\\\\')+'\\end{pmatrix}';}
    s.equationLatex=latex;if(s.mathField)s.mathField.value=latex;host.querySelector('[data-latex]').value=latex;await showEquationPreview();
   }
   if(action==='matrix-resize')drawMatrix();if(action==='keyboard'){s.mathField?.focus();s.mathModule?.showMathKeyboard(host.querySelector('[data-studio-panel]'));}
   if(action==='apply-equation'){
    if(host.querySelector('[data-math-mode]')?.value==='source')s.equationLatex=host.querySelector('[data-latex]').value;await showEquationPreview();if(!s.equationValid)return;const target=s.equationTarget;
    if(target.kind==='block')mutate(()=>{const block=blocks().find(b=>b.id===target.id);block.latex=s.equationLatex;});
    else{if(target.position!==undefined){target.editor.chain().focus().setNodeSelection(target.position).updateAttributes('inlineMath',{latex:s.equationLatex}).setTextSelection(target.position+1).run();editorModule.focusNow(target.editor);}else target.editor.chain().focus().insertContentAt(target.insertionPosition,{type:'inlineMath',attrs:{latex:s.equationLatex}}).setTextSelection(target.insertionPosition+1).run();editorModule.focusNow(target.editor);}
    s.mathModule?.hideMathKeyboard();s.equationTarget=null;host.querySelector('[data-studio-panel]').hidden=true;
    if(target.kind==='block')continueWriting(target.id);
   }
   if(action==='preview'&&current())await preview({schemaVersion:1,blocks:blocks()});
   if(action==='hide-panel'){const fresh=s.equationTarget?.fresh?s.equationTarget.id:null;s.equationTarget=null;s.mathModule?.hideMathKeyboard();host.querySelector('[data-studio-panel]').hidden=true;if(fresh)continueWriting(fresh);}
   if(action==='history')await showHistory();
   if(action==='history-view'){
    const version=host.querySelector('[data-history-version]').value,record=await call('weekly-history?week='+s.week.id+'&version='+encodeURIComponent(version)),lesson=record.content.lessons.find(l=>l.id===s.lessonId)||record.content.lessons[0],preview=host.querySelector('[data-history-preview]');
    preview.innerHTML=`<div class="studio-comparison"><section><h4>Current draft</h4>${current()?renderLessonDocument({schemaVersion:1,blocks:blocks()}):''}</section><section><h4>Selected publication</h4>${lesson?renderLessonDocument(documentForLesson(lesson)):''}</section></div>`;await hydrateLessonMath(preview);
   }
   if(action==='history-restore'){const version=host.querySelector('[data-history-version]').value;await call('weekly-restore',{week:s.week.id,version,revision:s.revision,draftRevision:s.draftRevision});await load(s.week.id,true);status('Historical content restored as a new private draft. Publish only after reviewing it.');}
   if(action==='save-template'){const record=await call('studio-templates',{name:host.querySelector('[data-template-name]').value,block:selected()});s.templates.push(record);status('Private reusable block saved.');render();}
   if(action==='add-practice')mutate(()=>{current().questions.push(defaultQuestion());s.questionIndex=current().questions.filter(q=>q.stage!=='quiz').length-1;s.forceBank='practice';});
   if(action==='add-quiz')mutate(()=>{s.week.quiz.push({...defaultQuestion(),stage:'quiz'});s.quizIndex=s.week.quiz.length-1;s.forceBank='quiz';});
   if(action.startsWith('table-'))mutate(()=>{const block=selected();if(action==='table-row'&&block.rows.length<40)block.rows.push(block.headers.map(()=>''));if(action==='table-column'&&block.headers.length<12){block.headers.push('Column '+(block.headers.length+1));block.rows.forEach(row=>row.push(''));}if(action==='table-remove-row')block.rows.pop();if(action==='table-remove-column'&&block.headers.length>1){block.headers.pop();block.rows.forEach(row=>row.pop());}});
  }catch(error){status(error.message);}
 }
 function change(event){if(event.target.dataset.path){const path=event.target.dataset.path;writePath(path,event.target.value);if(path.endsWith('.options')){const prefix=path.split('.')[0],q=prefix==='quiz'?s.week.quiz[s.quizIndex]:current().questions.filter(q=>q.stage!=='quiz')[s.questionIndex],wrapper=document.createElement('div');wrapper.innerHTML=answerInput(q,prefix);const answer=host.querySelector(`[data-path="${prefix}.answer"]`);if(answer)answer.innerHTML=wrapper.querySelector('select').innerHTML;}}if(event.target.matches('[data-latex]')){s.equationLatex=event.target.value;if(s.mathField)s.mathField.value=s.equationLatex;showEquationPreview();}}
 async function selectChange(event){const el=event.target;
  if(el.matches('[data-insert-type]'))s.insertType=el.value;
  if(el.matches('[data-lesson]')){if(s.dirty&&!await save())return;s.lessonId=el.value;s.blockId=null;s.questionIndex=0;render();}
  if(el.dataset.bank){s[el.dataset.bank==='quiz'?'quizIndex':'questionIndex']=Number(el.value);render();}
  if(el.dataset.questionKind){const q=el.dataset.questionKind==='quiz'?s.week.quiz[s.quizIndex]:current().questions.filter(q=>q.stage!=='quiz')[s.questionIndex];q.kind=el.value;if(q.kind==='choice')q.options??=['',''];changed();render();}
  if(el.id==='studio-heading'&&s.editor){{if(el.value==='0')s.editor.chain().focus().setParagraph().run();else s.editor.chain().focus().setHeading({level:Number(el.value)}).run();focusEditor();}}
  if(el.id==='studio-align'&&s.editor){s.editor.chain().focus().setTextAlign(el.value).run();focusEditor();}
  if(el.matches('[data-equation-display]')){selected().displayMode=el.checked;changed();}
  if(el.matches('[data-publish-lesson]')&&s.publish){el.checked?s.publish.selected.add(el.value):s.publish.selected.delete(el.value);renderPublish();}
  if(el.matches('[data-publish-mode]')&&s.publish){s.publish.mode=el.value;renderPublish();}
  if(el.matches('[data-publish-at]')&&s.publish){s.publish.releaseAt=el.value;renderPublish();}
  if(el.matches('[data-preview-width]'))host.querySelector('.studio-preview').style.width=el.value;
  if(el.matches('[data-math-mode]')){host.querySelector('[data-visual-math]').hidden=el.value==='source';host.querySelector('[data-source-math]').hidden=el.value!=='source';}
 }
 function dragStart(event){const grip=event.target.closest('[data-drag]');if(grip){s.dragId=grip.dataset.drag;event.dataTransfer.setData('text/plain',s.dragId);}}
 function dragOver(event){if(s.dragId&&event.target.closest('[data-block]')){event.preventDefault();event.stopPropagation();}}
 function drop(event){const to=event.target.closest('[data-block]')?.dataset.block;if(!s.dragId||!to)return;event.preventDefault();event.stopPropagation();mutate(()=>{const list=blocks(),from=list.findIndex(b=>b.id===s.dragId),index=list.findIndex(b=>b.id===to);if(from>=0&&index>=0)list.splice(index,0,list.splice(from,1)[0]);});s.dragId=null;}
 function dragEnd(){s.dragId=null;}
 function ribbonKeys(event){
  const card=event.target.closest('[data-block]');
  if(card&&event.key==='Enter'&&!event.shiftKey&&(event.ctrlKey||event.metaKey||event.target===card||event.target.matches('[data-path="block.video"]')||card.dataset.kind==='heading'&&event.target.matches('[data-path="block.text"]'))){
   if(event.target.matches('[data-path="block.video"]')&&!youtubeVideoId(event.target.value)){status('Use a valid HTTPS YouTube video link before continuing.');return;}
   event.preventDefault();continueWriting(card.dataset.block);return;
  }
  if(!event.target.matches('[data-ribbon-tab]'))return;const tabs=[...host.querySelectorAll('[data-ribbon-tab]')],index=tabs.indexOf(event.target);let next;if(event.key==='ArrowRight')next=(index+1)%tabs.length;if(event.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;if(event.key==='Home')next=0;if(event.key==='End')next=tabs.length-1;if(next!==undefined){event.preventDefault();switchTab(tabs[next].dataset.ribbonTab);tabs[next].focus();}
 }
 function unload(event){if(s.dirty){event.preventDefault();event.returnValue='';}}
 function online(){if(s.dirty&&!s.conflict)save();}
 function cancel(event){event.preventDefault();close();}
 host.addEventListener('click',click);host.addEventListener('keydown',ribbonKeys);host.addEventListener('input',change);host.addEventListener('change',selectChange);host.addEventListener('cancel',cancel);host.addEventListener('close',dispose,{once:true});host.addEventListener('dragstart',dragStart);host.addEventListener('dragover',dragOver,true);host.addEventListener('drop',drop,true);host.addEventListener('dragend',dragEnd);window.addEventListener('beforeunload',unload);window.addEventListener('online',online);
 try{await load(week);}catch(error){dispose();throw error;}
}
