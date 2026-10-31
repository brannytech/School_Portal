// Question authoring for subtopic practice and the weekly quiz.
// Prompts may contain inline mathematics between dollar signs, e.g. "Solve $x^2-4=0$".
import {esc,button,input,area,select} from './ui.js';

export const KIND_NAMES={numeric:'Number answer',choice:'Multiple choice (one answer)',multi:'Multiple choice (several answers)',boolean:'True or false',short:'Short written answer',expression:'Mathematical expression',fill:'Fill in the blank'};
export const DIFFICULTIES=['Beginner','Intermediate','Advanced','Challenge','Exam-style'];
export const newQuestion=(id,stage='practice')=>({id,prompt:'',kind:'numeric',answer:'',explanation:'',stage});
export const practiceOf=lesson=>(lesson?.questions||[]).filter(q=>q.stage!=='quiz');

// The "correct answer" control for the question's kind.
export function answerInput(q,prefix){
 if(q.kind==='multi'){
  const options=(q.options||[]).filter(v=>v.trim()),chosen=new Set(q.answers||[]);
  return `<fieldset class="st-multi"><legend>Tick every correct choice</legend>${options.length?options.map(v=>`<label class="st-check"><input type="checkbox" data-path="${prefix}.answers" value="${esc(v)}" ${chosen.has(v)?'checked':''}> <span>${esc(v)}</span></label>`).join(''):'<p class="small muted">Add at least two choices above first.</p>'}</fieldset>`;
 }
 if(q.kind==='choice'||q.kind==='boolean'){
  const options=q.kind==='choice'?(q.options||[]).filter(v=>v.trim()):['true','false'];
  return `<label>Correct answer<select data-path="${prefix}.answer"><option value="">Choose the correct answer</option>${options.map(v=>`<option value="${esc(v)}" ${v===q.answer?'selected':''}>${esc(q.kind==='boolean'?(v==='true'?'True':'False'):v)}</option>`).join('')}${q.answer&&!options.includes(q.answer)?`<option selected value="${esc(q.answer)}">${esc(q.answer)} — update to match a choice</option>`:''}</select></label>`;
 }
 return input('Correct answer',prefix+'.answer',q.answer);
}

// Extra settings that depend on the kind: other accepted answers and tolerance.
export function kindSettings(q,prefix){
 let html='';
 if(['numeric','short','fill','expression'].includes(q.kind))html+=area('Other accepted answers (one per line, optional)',prefix+'.accepted',(q.accepted||[]).join('\n'),'rows="2"');
 if(['numeric','expression'].includes(q.kind))html+=input('Allowed difference (tolerance, optional)',prefix+'.tolerance',q.tolerance??'','number','step="any" min="0"');
 return html;
}

export function questionPanelHTML({questions,index,quiz,bank}){
 const prefix=bank||(quiz?'quiz':'practice'),i=Math.max(0,Math.min(index,questions.length-1)),q=questions[i];
 return `<section class="st-bank" data-bank-panel="${prefix}"><div class="st-pane-head"><h2>${prefix==='assign'?'Assignment questions':quiz?'Weekly quiz':'Practice questions'}</h2><span class="small muted">${questions.length} question${questions.length===1?'':'s'}</span></div>
 <p class="small muted">${prefix==='assign'?'Students answer these on the platform. Answers stay hidden until they submit.':quiz?'This quiz covers the whole week.':'These questions belong to the selected subtopic.'} ${prefix==='assign'?'Add at least one question before releasing an online assignment.':'Questions are optional: you can publish a lesson without them.'}</p>
 ${q?`<label>Choose a question to edit<select data-bank="${prefix}">${questions.map((v,n)=>`<option value="${n}" ${i===n?'selected':''}>${n+1}. ${esc((v.prompt||'').slice(0,60)||'New question')}</option>`).join('')}</select></label>
 ${area('Question (use $…$ for a formula, e.g. $x^2-4=0$)',prefix+'.prompt',q.prompt)}
 <label>How should the student answer?<select data-question-kind="${prefix}">${Object.entries(KIND_NAMES).map(([kind,label])=>`<option value="${kind}" ${q.kind===kind?'selected':''}>${label}</option>`).join('')}${!KIND_NAMES[q.kind]?`<option selected value="${esc(q.kind)}">Existing ${esc(q.kind)} question (retained)</option>`:''}</select></label>
 ${q.kind==='choice'||q.kind==='multi'?area('Choices (one per line)',prefix+'.options',(q.options||[]).join('\n')):''}
 <div data-answer-wrap="${prefix}">${answerInput(q,prefix)}</div>${kindSettings(q,prefix)}
 <div class="st-row">${input('Marks',prefix+'.marks',q.marks??1,'number','min="1" max="100" step="any"')}${select('Difficulty',prefix+'.difficulty',DIFFICULTIES.map(v=>[v,v]),q.difficulty||'Beginner')}</div>
 ${input('Hint (optional)',prefix+'.hint',q.hint||'')}${area('Feedback / worked solution',prefix+'.explanation',q.explanation)}`:'<p>No questions yet.</p>'}
 <div class="st-actions">${button('add-'+prefix,'Add question')}${q?button('duplicate-'+prefix,'Duplicate')+button('up-'+prefix,'↑ Move up',i?'':'disabled')+button('down-'+prefix,'↓ Move down',i<questions.length-1?'':'disabled')+button('remove-'+prefix,'Delete selected question','class="danger"'):''}</div>
 <details class="st-import"><summary>Import questions from a spreadsheet (CSV)</summary>
  <p class="small muted">Columns: <code>kind, prompt, optionA, optionB, optionC, optionD, answer, marks, hint, explanation</code>. Kinds: ${Object.keys(KIND_NAMES).join(', ')}. For several correct answers write the letters or choices joined with |, e.g. <code>A|C</code>.</p>
  <label>Paste CSV rows<textarea data-csv="${prefix}" rows="5" placeholder="choice,Which is a prime?,4,6,7,9,C,1,,7 has only two factors."></textarea></label>
  <div class="st-actions">${button('import-'+prefix,'Import questions')}</div><p class="small" role="status" data-csv-report="${prefix}"></p></details></section>`;
}

// ---------- CSV import (pure, so it can be tested) ----------
export function parseCSV(text){
 const rows=[];let row=[],cell='',quoted=false;
 const source=String(text||'').replace(/^﻿/,'');
 for(let i=0;i<source.length;i++){
  const ch=source[i];
  if(quoted){if(ch==='"'){if(source[i+1]==='"'){cell+='"';i++;}else quoted=false;}else cell+=ch;}
  else if(ch==='"'&&!cell)quoted=true;
  else if(ch===','){row.push(cell);cell='';}
  else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&source[i+1]==='\n')i++;row.push(cell);cell='';if(row.some(v=>v.trim()))rows.push(row);row=[];}
  else cell+=ch;
 }
 row.push(cell);if(row.some(v=>v.trim()))rows.push(row);
 return rows;
}

export function questionsFromCSV(text,{stage='practice',makeId}={}){
 const rows=parseCSV(text),questions=[],errors=[];
 const header=rows[0]?.[0]?.trim().toLowerCase()==='kind'?rows.shift():null;void header;
 rows.forEach((cells,n)=>{
  const line=n+1,[kindRaw,prompt,a,b,c,d,answerRaw,marksRaw,hint,explanation]=cells.map(v=>(v??'').trim());
  const kind=(kindRaw||'').toLowerCase();
  if(!KIND_NAMES[kind]){errors.push(`Row ${line}: “${kindRaw}” is not a question kind.`);return;}
  if(!prompt){errors.push(`Row ${line}: the question is empty.`);return;}
  if(!answerRaw){errors.push(`Row ${line}: there is no answer.`);return;}
  const q={id:makeId?makeId():'q'+Math.random().toString(36).slice(2),prompt,kind,answer:answerRaw,explanation:explanation||'See the worked solution with your teacher.',stage};
  if(kind==='choice'||kind==='multi'){
   q.options=[a,b,c,d].filter(Boolean);
   if(q.options.length<2){errors.push(`Row ${line}: a multiple-choice question needs at least two choices.`);return;}
   const pick=token=>/^[A-D]$/i.test(token)?q.options[token.toUpperCase().charCodeAt(0)-65]:token;
   const picks=answerRaw.split('|').map(v=>pick(v.trim())).filter(v=>v!==undefined&&v!=='');
   if(!picks.length||picks.some(v=>!q.options.includes(v))){errors.push(`Row ${line}: the answer must be one of the choices (A–D or the choice text).`);return;}
   if(kind==='choice'){if(picks.length!==1){errors.push(`Row ${line}: a single-answer question has exactly one correct choice.`);return;}q.answer=picks[0];}
   else{q.answers=picks;q.answer=picks.join('|');}
  }
  if(kind==='boolean'){const v=answerRaw.toLowerCase();if(!['true','false'].includes(v)){errors.push(`Row ${line}: a true/false answer must be true or false.`);return;}q.answer=v;}
  if(marksRaw){const marks=Number(marksRaw);if(!Number.isFinite(marks)||marks<=0||marks>100){errors.push(`Row ${line}: marks must be from 1 to 100.`);return;}q.marks=marks;}
  if(hint)q.hint=hint;
  questions.push(q);
 });
 return {questions,errors};
}
