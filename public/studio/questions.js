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

function imageField(q,prefix){
 const img=q.image;
 return `<div class="st-qimage"><span class="small"><strong>Picture (optional)</strong></span>${img?.fileId?`<img class="st-image-thumb" src="/api/media/${encodeURIComponent(img.fileId)}" alt="">`:''}<div class="st-actions">${button('qimage-pick-'+prefix,img?.fileId?'Replace picture':'Add a picture or diagram')}${img?.fileId?button('qimage-remove-'+prefix,'Remove picture'):''}</div>${img?.fileId?input('Describe the picture for learners who cannot see it',prefix+'.imageAlt',img.alt||'','text','maxlength="300"'):''}</div>`;
}
export function questionPanelHTML({questions,index,quiz,bank}){
 const prefix=bank||(quiz?'quiz':'practice'),i=Math.max(0,Math.min(index,questions.length-1)),q=questions[i];
 return `<section class="st-bank" data-bank-panel="${prefix}"><div class="st-pane-head"><h2>${prefix==='assign'?'Assignment questions':quiz?'Weekly quiz':'Practice questions'}</h2><span class="small muted">${questions.length} question${questions.length===1?'':'s'}</span></div>
 <p class="small muted">${prefix==='assign'?'Students answer these on the platform. Answers stay hidden until they submit.':quiz?'This quiz covers the whole week.':'These questions belong to the selected subtopic.'} ${prefix==='assign'?'Add at least one question before releasing an online assignment.':'Questions are optional: you can publish a lesson without them.'}</p>
 ${q?`<label>Choose a question to edit<select data-bank="${prefix}">${questions.map((v,n)=>`<option value="${n}" ${i===n?'selected':''}>${n+1}. ${esc((v.prompt||'').slice(0,60)||'New question')}</option>`).join('')}</select></label>
 ${area('Question (use $…$ for a formula, e.g. $x^2-4=0$)',prefix+'.prompt',q.prompt)}
 ${imageField(q,prefix)}
 <label>How should the student answer?<select data-question-kind="${prefix}">${Object.entries(KIND_NAMES).map(([kind,label])=>`<option value="${kind}" ${q.kind===kind?'selected':''}>${label}</option>`).join('')}${!KIND_NAMES[q.kind]?`<option selected value="${esc(q.kind)}">Existing ${esc(q.kind)} question (retained)</option>`:''}</select></label>
 ${q.kind==='choice'||q.kind==='multi'?area('Choices (one per line)',prefix+'.options',(q.options||[]).join('\n')):''}
 <div data-answer-wrap="${prefix}">${answerInput(q,prefix)}</div>${kindSettings(q,prefix)}
 <div class="st-row">${input('Marks',prefix+'.marks',q.marks??1,'number','min="1" max="100" step="any"')}${select('Difficulty',prefix+'.difficulty',DIFFICULTIES.map(v=>[v,v]),q.difficulty||'Beginner')}</div>
 ${input('Hint (optional)',prefix+'.hint',q.hint||'')}${area('Feedback / worked solution',prefix+'.explanation',q.explanation)}`:'<p>No questions yet.</p>'}
 <div class="st-actions">${button('add-'+prefix,'Add question')}${q?button('duplicate-'+prefix,'Duplicate')+button('up-'+prefix,'↑ Move up',i?'':'disabled')+button('down-'+prefix,'↓ Move down',i<questions.length-1?'':'disabled')+button('remove-'+prefix,'Delete selected question','class="danger"'):''}</div>
 <details class="st-import"><summary>Import questions (paste, spreadsheet or file)</summary>
  <p class="small muted">Paste questions copied from <strong>Excel or Google Sheets</strong>, choose a <strong>CSV file</strong>, or paste <strong>numbered questions</strong> from a document. With a header row the columns can be in any order: <code>question, type, A, B, C, D, answer, marks, hint, explanation</code>. For several correct answers write <code>A|C</code>. Types: ${Object.keys(KIND_NAMES).join(', ')}.</p>
  <p class="small muted">Plain text example: <code>1. Which is prime? A. 4 B. 6 C. 7 D. 9 Answer: C</code> (each option and the answer on its own line).</p>
  <label>Choose a file (.csv, .tsv or .txt)<input type="file" accept=".csv,.tsv,.txt,text/csv,text/plain,text/tab-separated-values" data-csv-file="${prefix}"></label>
  <label>Or paste your questions here<textarea data-csv="${prefix}" rows="6" placeholder="choice,Which is a prime?,4,6,7,9,C,1,,7 has only two factors."></textarea></label>
  <div class="st-actions">${button('import-'+prefix,'Import questions')}<a class="button" download="questions-template.csv" href="data:text/csv;charset=utf-8,${encodeURIComponent(IMPORT_TEMPLATE)}">Download a template</a></div><p class="small" role="status" data-csv-report="${prefix}"></p></details></section>`;
}

// ---------- Question import (pure, so it can be tested) ----------
// Accepts: cells pasted from Excel or Google Sheets (tab separated), CSV files (comma or semicolon),
// any column order when there is a header row, and plain numbered questions typed in a document.
export function parseCSV(text,delimiter=','){
 const rows=[];let row=[],cell='',quoted=false;
 const source=String(text||'').replace(/^﻿/,'');
 for(let i=0;i<source.length;i++){
  const ch=source[i];
  if(quoted){if(ch==='"'){if(source[i+1]==='"'){cell+='"';i++;}else quoted=false;}else cell+=ch;}
  else if(ch==='"'&&!cell)quoted=true;
  else if(ch===delimiter){row.push(cell);cell='';}
  else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&source[i+1]==='\n')i++;row.push(cell);cell='';if(row.some(v=>v.trim()))rows.push(row);row=[];}
  else cell+=ch;
 }
 row.push(cell);if(row.some(v=>v.trim()))rows.push(row);
 return rows;
}

const squash=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const KIND_ALIASES={choice:'choice',mcq:'choice',single:'choice',singleanswer:'choice',multiplechoice:'choice',multiplechoiceoneanswer:'choice',objective:'choice',
 multi:'multi',multiple:'multi',multipleanswer:'multi',multipleanswers:'multi',multiplechoiceseveralanswers:'multi',checkbox:'multi',
 boolean:'boolean',truefalse:'boolean',tf:'boolean',trueorfalse:'boolean',
 numeric:'numeric',number:'numeric',numberanswer:'numeric',numerical:'numeric',
 short:'short',shortanswer:'short',shortwrittenanswer:'short',text:'short',written:'short',
 expression:'expression',mathematicalexpression:'expression',algebra:'expression',
 fill:'fill',fillin:'fill',fillintheblank:'fill',fillintheblanks:'fill',blank:'fill'};
const FIELD_ALIASES={kind:['kind','type','questiontype'],prompt:['prompt','question','questions','q','text','questiontext'],
 a:['optiona','a','choicea','option1','1'],b:['optionb','b','choiceb','option2','2'],c:['optionc','c','choicec','option3','3'],d:['optiond','d','choiced','option4','4'],
 e:['optione','e','choicee','option5'],f:['optionf','f','choicef','option6'],
 answer:['answer','answers','correct','correctanswer','correctoption','key','ans'],marks:['marks','mark','score','points'],hint:['hint'],
 explanation:['explanation','feedback','solution','workedsolution','reason','workings']};
const DEFAULT_ORDER=['kind','prompt','a','b','c','d','answer','marks','hint','explanation'];

function detectDelimiter(text){
 const lines=String(text||'').split(/\r?\n/).filter(l=>l.trim()).slice(0,5);
 const count=(ch)=>lines.reduce((n,l)=>n+l.split(ch).length-1,0);
 const tab=count('\t'),semi=count(';'),comma=count(',');
 if(tab>=lines.length&&tab>0)return '\t';
 if(semi>comma&&semi>=lines.length)return ';';
 return ',';
}
const looksLikePlainText=text=>{
 const lines=String(text||'').split(/\r?\n/);
 return lines.some(l=>/^\s*\(?[A-Fa-f][.):]\s+\S/.test(l))&&lines.some(l=>/^\s*(correct\s+)?(answer|ans|key)\s*[:=-]/i.test(l))&&!/\t/.test(text);
};

function finishQuestion(raw,{stage,makeId,label},questions,errors){
 const {kindRaw,prompt,options,answerRaw,marksRaw,hint,explanation}=raw;
 let kind=KIND_ALIASES[squash(kindRaw)]||'';
 if(kindRaw&&!kind){errors.push(`${label}: “${kindRaw}” is not a question type. Use: ${Object.keys(KIND_NAMES).join(', ')}.`);return;}
 if(!prompt){errors.push(`${label}: the question is empty.`);return;}
 if(!answerRaw){errors.push(`${label}: there is no answer.`);return;}
 if(!kind){
  if(options.length>=2)kind=/[|;]|^[A-Fa-f]\s*[,&]\s*[A-Fa-f]/.test(answerRaw)||/^[A-Fa-f]{2,}$/.test(answerRaw)?'multi':'choice';
  else if(/^(true|false)$/i.test(answerRaw))kind='boolean';
  else if(/^-?[\d.,/]+$/.test(answerRaw))kind='numeric';
  else kind='short';
 }
 const q={id:makeId?makeId():'q'+Math.random().toString(36).slice(2),prompt,kind,answer:answerRaw,explanation:explanation||'See the worked solution with your teacher.',stage};
 if(kind==='choice'||kind==='multi'){
  q.options=options;
  if(q.options.length<2){errors.push(`${label}: a multiple-choice question needs at least two choices.`);return;}
  const pick=token=>/^[A-F]$/i.test(token)?q.options[token.toUpperCase().charCodeAt(0)-65]:token;
  const tokens=kind==='multi'
   ?(/^[A-Fa-f]{2,}$/.test(answerRaw)?answerRaw.split(''):answerRaw.split(/[|;]|,\s*(?=[A-Fa-f]\b)|\s+and\s+/i))
   :[answerRaw];
  const picks=tokens.map(v=>pick(v.trim())).filter(v=>v!==undefined&&v!=='');
  if(!picks.length||picks.some(v=>!q.options.includes(v))){errors.push(`${label}: the answer must be one of the choices (A–F or the choice text).`);return;}
  if(kind==='choice'){if(picks.length!==1){errors.push(`${label}: a single-answer question has exactly one correct choice.`);return;}q.answer=picks[0];}
  else{q.answers=picks;q.answer=picks.join('|');}
 }
 if(kind==='boolean'){const v=answerRaw.toLowerCase();if(!['true','false','t','f'].includes(v)){errors.push(`${label}: a true/false answer must be true or false.`);return;}q.answer=v[0]==='t'?'true':'false';}
 if(marksRaw){const marks=Number(marksRaw);if(!Number.isFinite(marks)||marks<=0||marks>100){errors.push(`${label}: marks must be from 1 to 100.`);return;}q.marks=marks;}
 if(hint)q.hint=hint;
 questions.push(q);
}

function fromPlainText(text,opts){
 const questions=[],errors=[];let cur=null,count=0;
 const flush=()=>{if(!cur)return;count++;finishQuestion({kindRaw:'',prompt:cur.prompt.join(' ').trim(),options:cur.options,answerRaw:cur.answer.trim(),marksRaw:cur.marks,hint:cur.hint,explanation:cur.explanation},{...opts,label:`Question ${count}`},questions,errors);cur=null;};
 for(const rawLine of String(text||'').split(/\r?\n/)){
  const line=rawLine.trim();if(!line){continue;}
  let m;
  if((m=/^(correct\s+)?(answer|ans|key)\s*[:=-]\s*(.+)$/i.exec(line))&&cur){cur.answer=m[3].replace(/^\(?([A-Fa-f])\)?[.)]?\s*$/,'$1');continue;}
  if((m=/^(explanation|feedback|solution|reason)\s*[:=-]\s*(.*)$/i.exec(line))&&cur){cur.explanation=m[2];continue;}
  if((m=/^hint\s*[:=-]\s*(.*)$/i.exec(line))&&cur){cur.hint=m[1];continue;}
  if((m=/^(marks?|points?)\s*[:=-]\s*([\d.]+)/i.exec(line))&&cur){cur.marks=m[2];continue;}
  if(cur&&(m=/^\(?([A-Fa-f])[.):]\s+(.+)$/.exec(line))){const want=cur.options.length;if(m[1].toUpperCase().charCodeAt(0)-65===want){cur.options.push(m[2].trim());continue;}}
  if(m=/^(?:q(?:uestion)?\s*)?(\d+)\s*[.):-]\s*(.+)$/i.exec(line)){flush();cur={prompt:[m[2]],options:[],answer:'',marks:'',hint:'',explanation:''};continue;}
  if(cur&&!cur.options.length&&!cur.answer)cur.prompt.push(line);
  else if(!cur){cur={prompt:[line],options:[],answer:'',marks:'',hint:'',explanation:''};}
  else if(cur.explanation)cur.explanation+=' '+line;
 }
 flush();
 return {questions,errors};
}

export function questionsFromCSV(text,{stage='practice',makeId}={}){
 if(!String(text||'').trim())return {questions:[],errors:['Nothing to import. Paste your questions or choose a file.']};
 if(looksLikePlainText(text))return fromPlainText(text,{stage,makeId});
 const rows=parseCSV(text,detectDelimiter(text)),questions=[],errors=[];
 // A header row is any first row that names at least two known columns; it can be in any order.
 let order=DEFAULT_ORDER;
 const names=(rows[0]||[]).map(squash);
 const mapped=names.map(n=>Object.keys(FIELD_ALIASES).find(k=>FIELD_ALIASES[k].includes(n))||null);
 if(mapped.filter(Boolean).length>=2&&mapped.includes('prompt')){order=mapped;rows.shift();}
 else if(names[0]==='kind'){rows.shift();}
 rows.forEach((cells,n)=>{
  const get=k=>{const at=order.indexOf(k);return at<0?'':(cells[at]??'').trim();};
  const label=`Row ${n+1}`;
  finishQuestion({kindRaw:get('kind'),prompt:get('prompt'),options:['a','b','c','d','e','f'].map(get).filter(Boolean),answerRaw:get('answer'),marksRaw:get('marks'),hint:get('hint'),explanation:get('explanation')},{stage,makeId,label},questions,errors);
 });
 return {questions,errors};
}

export const IMPORT_TEMPLATE='kind,prompt,optionA,optionB,optionC,optionD,answer,marks,hint,explanation\nchoice,Which of these is a prime number?,4,6,7,9,C,1,,7 has only two factors.\nmulti,Pick the even numbers,2,3,4,5,A|C,2,,2 and 4 divide by 2.\nboolean,A triangle has three sides.,,,,,true,1,,\nnumeric,What is 3 × 4?,,,,,12,1,,Three fours.\nshort,Name the longest side of a right-angled triangle.,,,,,hypotenuse,1,,\n';
