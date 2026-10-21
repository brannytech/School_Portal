// The HTTP API and browser use the same pure content contract.
export {validateLessonDocument,legacyLessonToDocument,documentForLesson,studentLesson} from './public/lesson-document.js';
import {validateLessonDocument} from './public/lesson-document.js';
import {createHash,randomUUID} from 'node:crypto';

// SQL reconstructs object properties and question-bank order; those incidental orders
// must not invalidate a saved draft after restart. Document block order stays significant.
export function contentRevision(value){
 const canonical=(item,key='')=>{
  if(Array.isArray(item)){const values=['questions','quiz'].includes(key)&&item.every(v=>v&&typeof v.id==='string')?[...item].sort((a,b)=>a.id.localeCompare(b.id)):item;return values.map(v=>canonical(v));}
  if(item&&typeof item==='object')return Object.fromEntries(Object.keys(item).sort().map(k=>[k,canonical(item[k],k)]));
  return item;
 };
 return value==null?null:createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}
export const legacyContentKeys=['objectives','explain','realLife','experiment','summary','videoUrl','example'];

export function mergeWeekContent(input,previous){
 const merged={...structuredClone(previous||{}),...structuredClone(input)};
 if(Array.isArray(input.lessons))merged.lessons=input.lessons.map(lesson=>{
  const old=previous?.lessons?.find(v=>v.id===lesson.id),next={...structuredClone(old||{}),...lesson};
  if(old?.document){
   // This form cannot reconcile legacy edits with an unchanged structured document.
   const sameDocument=lesson.document===undefined||JSON.stringify(lesson.document)===JSON.stringify(old.document);
   if(sameDocument&&legacyContentKeys.some(key=>Object.hasOwn(lesson,key)&&JSON.stringify(lesson[key])!==JSON.stringify(old[key])))throw Object.assign(Error('This subtopic uses structured content. Update its document rather than its legacy text fields.'),{status:409});
  }
  if(Array.isArray(lesson.questions))next.questions=lesson.questions.map(q=>({...structuredClone(old?.questions?.find(v=>v.id===q.id)||{}),...q}));
  if(lesson.example&&old?.example)next.example={...structuredClone(old.example),...lesson.example};
  return next;
 });
 if(Array.isArray(input.quiz))merged.quiz=input.quiz.map(q=>({...structuredClone(previous?.quiz?.find(v=>v.id===q.id)||{}),...q}));
 return merged;
}
export function validateWeekDocuments(week){
 const fail=message=>{throw Object.assign(Error(message),{status:400});};
 if(!week||typeof week!=='object'||!Array.isArray(week.lessons)||week.lessons.length>30||!Array.isArray(week.quiz??[])||(week.quiz?.length||0)>100)fail('Provide a weekly lesson list (up to 30 subtopics) and quiz list (up to 100 questions).');
 for(const lesson of week.lessons){
  if(!lesson||typeof lesson!=='object'||Array.isArray(lesson))fail('Each subtopic must be an object.');
  for(const key of ['objectives','summary','questions'])if(lesson[key]!==undefined&&(!Array.isArray(lesson[key])||lesson[key].length>100))fail('Subtopic '+key+' must be a list of at most 100 entries.');
  for(const q of [...(lesson.questions||[]),...(lesson.example?[lesson.example]:[])])if(!q||typeof q!=='object'||Array.isArray(q)||q.options!==undefined&&!Array.isArray(q.options))fail('Questions need an object with a valid options list.');
  if(lesson.document!==undefined)lesson.document=validateLessonDocument(lesson.document);
 }
 for(const q of week.quiz||[])if(!q||typeof q!=='object'||Array.isArray(q)||q.options!==undefined&&!Array.isArray(q.options))fail('Quiz questions need an object with a valid options list.');
 return week;
}
export function assignDraftIds(week){
 for(const lesson of week.lessons||[]){lesson.id||=week.id+'-'+randomUUID();for(const q of lesson.questions||[])q.id||=randomUUID();if(lesson.example)lesson.example.id||=randomUUID();}
 for(const q of week.quiz||[])q.id||=randomUUID();
 const unique=(values,label)=>{if(new Set(values).size!==values.length||values.some(id=>typeof id!=='string'||!id||id.length>100))throw Object.assign(Error(label+' need unique text IDs of at most 100 characters.'),{status:400});};
 unique((week.lessons||[]).map(l=>l.id),'Subtopics');
 for(const lesson of week.lessons||[]){if(!lesson.id.startsWith(week.id+'-'))throw Object.assign(Error('Subtopic IDs must belong to the learning week.'),{status:400});unique((lesson.questions||[]).map(q=>q.id),'Practice questions');}
 unique((week.quiz||[]).map(q=>q.id),'Quiz questions');return week;
}
