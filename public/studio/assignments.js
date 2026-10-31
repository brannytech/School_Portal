// Assignment authoring in Lesson Studio: outline entries, settings panel, release and copy dialogs.
// Pure HTML builders; studio.js owns state and events.
import {esc,button,input,select,check} from './ui.js';

export const STATUS_LABELS={DRAFT:'Draft',LOCKED:'Locked',SCHEDULED:'Scheduled',PUBLISHED:'Released'};
export const SCOPE_LABELS={LESSON:'After one subtopic',GENERAL:'General (any or several subtopics)',WEEK_END:'End of the week'};
export const MODE_LABELS={PHOTO:'Students write in their notebook and upload a photo',ONLINE:'Students answer questions on the platform'};
export const newAssignment=week=>({week,title:'New assignment',scope:'GENERAL',lessons:[],mode:'PHOTO',max:10,due:'',resubmission:false,autoGrade:'IMMEDIATE',showAnswers:true,questions:[],document:{schemaVersion:1,blocks:[]}});
export const assignmentQuestions=a=>a?.questions||[];

export function assignmentStatus(a){
 if(!a)return 'none';
 if(a.status==='PUBLISHED')return a.available===false?'waiting':'live';
 return (a.status||'LOCKED').toLowerCase();
}
export function assignmentChip(a){
 if(a.status==='PUBLISHED'&&a.available===false)return 'Waiting for lesson';
 if(a.status==='SCHEDULED')return 'Scheduled';
 return STATUS_LABELS[a.status]||'Locked';
}

export function assignmentOutlineHTML(list,currentId,pane){
 return `<h3>Assignments</h3>${list.length?`<ol class="st-lessons">${list.map(a=>`<li><button type="button" data-studio="select-assignment" data-id="${esc(a.id)}" ${a.id===currentId&&pane==='assignment'?'aria-current="true"':''}><span data-outline-assignment="${esc(a.id)}">${esc(a.title||'Untitled assignment')}</span><span class="st-chip st-chip-${esc(assignmentStatus(a))}">${esc(assignmentChip(a))}</span></button></li>`).join('')}</ol>`:'<p class="small muted">No assignment yet. Write one when you are ready to give homework.</p>'}${button('new-assignment','+ New assignment','class="st-add"')}`;
}

export function assignmentTabsHTML(a,tab){
 const questions=assignmentQuestions(a).length;
 return `<div class="st-tabs" role="tablist"><button type="button" role="tab" data-studio="assign-tab" data-tab="write" aria-selected="${tab==='write'}">Instructions</button>${a.mode==='ONLINE'?`<button type="button" role="tab" data-studio="assign-tab" data-tab="questions" aria-selected="${tab==='questions'}">Questions (${questions})</button>`:''}</div>`;
}

export function assignmentSettingsHTML(a,{lessons=[]}={}){
 const lessonOptions=lessons.map((l,i)=>[l.id,l.title||'Subtopic '+(i+1)]);
 const linked=new Set(a.lessons||[]);
 const links=a.scope==='LESSON'
  ?select('Which subtopic does it follow?','assign.lesson',[['','Choose a subtopic'],...lessonOptions],a.lessons?.[0]||'')
  :a.scope==='GENERAL'
   ?`<fieldset class="st-multi"><legend>Subtopics it covers (optional)</legend>${lessonOptions.length?lessonOptions.map(([id,title])=>`<label class="st-check"><input type="checkbox" data-path="assign.lessons" value="${esc(id)}" ${linked.has(id)?'checked':''}> <span>${esc(title)}</span></label>`).join(''):'<p class="small muted">Add subtopics first.</p>'}</fieldset>`
   :'<p class="small muted">Given at the end of the week, covering everything taught.</p>';
 return `<div class="st-inspector-head"><h3>Assignment settings</h3></div><div class="st-fields">
 <p class="st-state"><span class="st-chip st-chip-${esc(assignmentStatus(a))}">${esc(assignmentChip(a))}</span> ${a.status==='PUBLISHED'?'Students can open it.':'Hidden from students until you release it.'}</p>
 <div class="st-actions">${a.status==='PUBLISHED'?button('assign-lock','Lock again'):''}${button('assign-release',a.status==='PUBLISHED'?'Change release…':'Release to students…','class="primary"')}</div>
 ${select('What is it about?','assign.scope',Object.entries(SCOPE_LABELS),a.scope)}${links}
 ${select('How do students answer?','assign.mode',Object.entries(MODE_LABELS),a.mode)}
 <div class="st-row">${input('Maximum marks','assign.max',a.max,'number','min="1" max="1000" step="any"')}${input('Deadline','assign.due',a.due||'','date')}</div>
 ${check('Students may resubmit or retake','assign.resubmission',a.resubmission)}
 ${a.mode==='ONLINE'?`${select('Marking','assign.autoGrade',[['IMMEDIATE','Show the score as soon as they submit'],['AFTER_REVIEW','Hold the score until I review']],a.autoGrade)}${check('Show correct answers and explanations after they submit','assign.showAnswers',a.showAnswers)}<p class="small muted">Online scores count toward each student’s progress and monitoring.</p>`:'<p class="small muted">You mark the photo and the score counts toward progress and monitoring.</p>'}
 <div class="st-actions st-block-actions">${button('assign-copy','Copy to another week or class…')}${button('assign-delete','Delete','class="danger"')}</div></div>`;
}

export function releasePanelHTML(a){
 const tomorrow=new Date(Date.now()+7*864e5).toISOString().slice(0,10);
 return `<div class="st-dialog"><h3>Release “${esc(a.title||'assignment')}”</h3>
 <p class="small muted">Release it when you have taught the topic in class. Until then students see it as locked.</p>
 <fieldset><legend>When can students open it?</legend>
 <label class="st-check"><input type="radio" name="assign-release-mode" value="PUBLISHED" data-assign-mode checked> <span>Now: I have taught this in class</span></label>
 <label class="st-check"><input type="radio" name="assign-release-mode" value="SCHEDULED" data-assign-mode> <span>At a date and time I choose</span></label>
 <label class="st-check"><input type="radio" name="assign-release-mode" value="LOCKED" data-assign-mode> <span>Keep locked for now</span></label></fieldset>
 <label>Release at<input type="datetime-local" data-assign-at></label>
 <label>Deadline<input type="date" data-assign-due value="${esc(a.due||tomorrow)}"></label>
 <p class="small" role="status" data-assign-release-note></p>
 <div class="st-actions">${button('assign-release-confirm','Confirm','class="primary"')}${button('hide-panel','Cancel')}</div></div>`;
}

export function copyPanelHTML(a,{allocations=[],context={},weekNumber=1}){
 const classes=[...new Set([context.class,...allocations.map(v=>v.class)].filter(Boolean))],subjects=[...new Set([context.subject,...allocations.map(v=>v.subject)].filter(Boolean))];
 const options=(list,current)=>list.map(v=>`<option ${v===current?'selected':''}>${esc(v)}</option>`).join('');
 return `<div class="st-dialog"><h3>Copy “${esc(a.title||'assignment')}”</h3>
 <p class="small muted">The copy starts locked, without a deadline, so you can adjust it before releasing. The week must already have lessons.</p>
 <label>Class<select data-copy-class>${options(classes,context.class)}</select></label>
 <label>Subject<select data-copy-subject>${options(subjects,context.subject)}</select></label>
 <label>Week<input type="number" min="1" max="52" value="${weekNumber}" data-copy-week></label>
 <p class="small" role="status" data-copy-note></p>
 <div class="st-actions">${button('assign-copy-confirm','Copy','class="primary"')}${button('hide-panel','Cancel')}</div></div>`;
}
