// Question authoring panels for subtopic practice and the weekly quiz.
import {esc,button,input,area} from './ui.js';

export const KIND_NAMES={numeric:'Number answer',choice:'Multiple choice',boolean:'True or false',short:'Short written answer',expression:'Mathematical expression',fill:'Fill in the blank'};
export const newQuestion=(id,stage='practice')=>({id,prompt:'',kind:'numeric',answer:'',explanation:'',stage});
export const practiceOf=lesson=>(lesson?.questions||[]).filter(q=>q.stage!=='quiz');

export function answerInput(q,prefix){
 if(q.kind==='choice'||q.kind==='boolean'){
  const options=q.kind==='choice'?(q.options||[]).filter(v=>v.trim()):['true','false'];
  return `<label>Correct answer<select data-path="${prefix}.answer"><option value="">Choose the correct answer</option>${options.map(v=>`<option value="${esc(v)}" ${v===q.answer?'selected':''}>${esc(q.kind==='boolean'?(v==='true'?'True':'False'):v)}</option>`).join('')}${q.answer&&!options.includes(q.answer)?`<option selected value="${esc(q.answer)}">${esc(q.answer)} — update to match a choice</option>`:''}</select></label>`;
 }
 return input('Correct answer',prefix+'.answer',q.answer);
}

export function questionPanelHTML({questions,index,quiz}){
 const prefix=quiz?'quiz':'practice',i=Math.max(0,Math.min(index,questions.length-1)),q=questions[i];
 return `<section class="st-bank" data-bank-panel="${prefix}"><div class="st-pane-head"><h2>${quiz?'Weekly quiz':'Practice questions'}</h2><span class="small muted">${questions.length} question${questions.length===1?'':'s'}</span></div>
 <p class="small muted">${quiz?'This quiz covers the whole week.':'These questions belong to the selected subtopic.'} Answers stay hidden from students until they submit. Questions are optional: you can publish a lesson without them.</p>
 ${q?`<label>Choose a question to edit<select data-bank="${prefix}">${questions.map((v,n)=>`<option value="${n}" ${i===n?'selected':''}>${n+1}. ${esc(v.prompt.slice(0,60)||'New question')}</option>`).join('')}</select></label>${area('Question',prefix+'.prompt',q.prompt)}
 <label>How should the student answer?<select data-question-kind="${prefix}">${Object.entries(KIND_NAMES).map(([kind,label])=>`<option value="${kind}" ${q.kind===kind?'selected':''}>${label}</option>`).join('')}${!KIND_NAMES[q.kind]?`<option selected value="${esc(q.kind)}">Existing ${esc(q.kind)} question (retained)</option>`:''}</select></label>
 ${q.kind==='choice'?area('Choices (one per line)',prefix+'.options',(q.options||[]).join('\n')):''}${answerInput(q,prefix)}${area('Feedback / worked solution',prefix+'.explanation',q.explanation)}`:'<p>No questions yet.</p>'}
 <div class="st-actions">${button('add-'+prefix,'Add question')}${q?button('remove-'+prefix,'Delete selected question','class="danger"'):''}</div></section>`;
}
