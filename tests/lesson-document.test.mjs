import {test} from 'node:test';
import assert from 'node:assert/strict';
import {curriculum} from '../curriculum.mjs';
import {validateLessonDocument,legacyLessonToDocument,studentLesson,contentRevision,mergeWeekContent,assignDraftIds,validateWeekDocuments} from '../lesson-document.mjs';
import {renderLessonDocument,renderLessonContent} from '../public/lesson-renderer.js';

const doc=blocks=>({schemaVersion:1,blocks});
test('All forty legacy lessons adapt and render without changing the bank or source fields',()=>{
 const original=structuredClone(curriculum);
 for(const week of curriculum)for(const lesson of week.lessons){
  const adapted=legacyLessonToDocument(lesson);assert.deepEqual(adapted,legacyLessonToDocument(lesson));assert.deepEqual(validateLessonDocument(adapted),adapted);
  const html=renderLessonContent(lesson,{renderWidget:()=>'<div class="existing-widget"></div>'});
  const escaped=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  for(const value of [...lesson.objectives,lesson.explain,lesson.example.prompt,lesson.example.explanation,lesson.example.answer,lesson.realLife,...lesson.summary])assert(html.includes(escaped(value)),lesson.id+' missing legacy content');
  assert(lesson.experiment?html.includes(escaped(lesson.experiment)):html.includes('existing-widget'));
 }
 assert.deepEqual(curriculum,original);
});
test('Supported blocks use escaped text, bounded tables, safe video IDs and editable equation source',()=>{
 const source=doc([
  {id:'h',type:'heading',level:2,text:'A <script> is text'},
  {id:'p',type:'paragraph',text:'<img src=x onerror=alert(1)>'},
  {id:'eq',type:'equation',latex:'x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}',displayMode:true},
  {id:'t',type:'table',caption:'Values',headers:['x','y'],rows:[['1','-4']]},
  {id:'w',type:'worked-example',prompt:'Solve',explanation:'Factorise',answer:'2',steps:['Step 1','Step 2']},
  {id:'v',type:'video',videoId:'dQw4w9WgXcQ'},
  {id:'warn',type:'warning',text:'Check signs'},
  {id:'hint',type:'hint',text:'Try again'},
  {id:'s',type:'separator'}
 ]);
 const html=renderLessonDocument(source);assert(!html.includes('<script>'));assert(!html.includes('<img'));assert(html.includes('&lt;img'));assert(html.includes('scope="col"'));assert(html.includes('youtube-nocookie.com/embed/dQw4w9WgXcQ'));assert(html.includes('\\frac'));
 assert.deepEqual(validateLessonDocument(source),source);
});
test('Schema rejects unknown fields/types/versions, duplicate IDs, malformed/nested content and oversized payloads',()=>{
 for(const input of [
  null,{schemaVersion:2,blocks:[]},{schemaVersion:1,blocks:[],answer:'secret'},doc([{id:'x',type:'quiz',answer:'secret'}]),
  doc([{id:'x',type:'paragraph',text:'Hi',html:'<b>unsafe</b>'}]),doc([{id:'x',type:'paragraph',text:{children:[]}}]),
  doc([{id:'x',type:'paragraph',text:'Hi'},{id:'x',type:'paragraph',text:'Again'}]),doc([{id:'" onclick="x',type:'separator'}]),
  doc([{id:'x',type:'table',caption:'',headers:['x'],rows:[['1','2']]}]),doc([{id:'x',type:'video',videoId:'javascript:alert(1)'}]),
  doc([{id:'x',type:'equation',latex:'\\href{javascript:alert(1)}{x}',displayMode:true}]),
  doc([{id:'x',type:'equation',latex:'{x',displayMode:true}]),doc([{id:'x',type:'equation',latex:'{'.repeat(21)+'x'+'}'.repeat(21),displayMode:true}]),
  doc(Array.from({length:121},(_,i)=>({id:'b'+i,type:'separator'}))),doc([{id:'x',type:'paragraph',text:'x'.repeat(40001)}]),
  doc(Array.from({length:5},(_,i)=>({id:'b'+i,type:'paragraph',text:'x'.repeat(40000)})))
 ])assert.throws(()=>validateLessonDocument(input),error=>error.status===400);
 const invalid=renderLessonDocument({schemaVersion:100,blocks:[]});assert(invalid.includes('role="alert"'));
});
test('Student projection excludes archive/teacher metadata and question keys while exposing only deliberate worked examples',()=>{
 const lesson={...curriculum[0].lessons[0],privateAnswer:'never send',legacySnapshot:{questions:[{answer:'secret'}]}};
 const safe=studentLesson(lesson);assert(!('legacySnapshot'in safe));assert(!('privateAnswer'in safe));assert(!('answer'in safe.questions[0]));assert(!('proof'in safe.questions[0]));assert.equal(safe.example.answer,lesson.example.answer);
 assert(!('proof'in safe.example));
});
test('Lossless merging and stable IDs preserve metadata while preventing unchanged documents from hiding legacy edits',()=>{
 const prior={id:1,custom:{school:'kept'},lessons:[{id:'1-x',explain:'Original',discovery:'kept',questions:[{id:'q',prompt:'Old',proof:{kept:true}}]}],quiz:[]};
 const merged=mergeWeekContent({id:1,lessons:[{id:'1-x',explain:'Edited',questions:[{id:'q',prompt:'New'}]}],quiz:[]},prior);
 assert.deepEqual(merged.custom,prior.custom);assert.equal(merged.lessons[0].discovery,'kept');assert.deepEqual(merged.lessons[0].questions[0].proof,{kept:true});assert.equal(prior.lessons[0].explain,'Original');
 const original=structuredClone(prior);original.lessons[0].document=doc([{id:'p',type:'paragraph',text:'Structured'}]);
 assert.throws(()=>mergeWeekContent({id:1,lessons:[{id:'1-x',explain:'Stale text'}]},original),error=>error.status===409);
 const incomplete=assignDraftIds(validateWeekDocuments({id:9,lessons:[{title:'',questions:[{}]}],quiz:[{}]}));
 assert.deepEqual(assignDraftIds(structuredClone(incomplete)),incomplete);
 assert.equal(contentRevision({questions:[{id:'z',answer:'1'},{id:'a',answer:'2'}],a:1}),contentRevision({a:1,questions:[{answer:'2',id:'a'},{answer:'1',id:'z'}]}));
 assert.notEqual(contentRevision(doc([{id:'a',type:'separator'},{id:'b',type:'separator'}])),contentRevision(doc([{id:'b',type:'separator'},{id:'a',type:'separator'}])));
});
