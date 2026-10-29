// Authoring guidance only. The server remains authoritative for publication.
import {validateLessonDocument,documentForLesson} from './lesson-document.js';
const filled=v=>typeof v==='string'&&v.trim().length>0;
// severity 'error' blocks release of the affected subtopic; 'warning' is advice only (e.g. questions still to be written).
export function publicationIssues(week,targets=null){
 const issues=[],add=(message,target={},severity='error')=>issues.push({message,severity,...target});
 const aimed=id=>!targets||targets.has(id);
 if(!filled(week.title))add('Give this week a topic.',{path:'week.title'});
 if(!week.lessons?.length)add('Add at least one subtopic.');
 function questions(list,lessonId,bank){
  const label=bank==='quiz'?'Weekly quiz':'Practice';
  if(!list?.length){add(label+(bank==='quiz'?': no weekly quiz questions yet.':': no practice questions yet.'),{lessonId,bank},'warning');return;}
  list.forEach((q,index)=>{const target={lessonId,bank,index},prefix=label+' question '+(index+1)+': ';
   for(const [key,text]of [['prompt','write the question.'],['answer','set the correct answer.'],['explanation','add feedback explaining the answer.']])if(!filled(q[key]))add(prefix+text,{...target,path:bank+'.'+key});
   if(q.kind==='choice'&&((q.options||[]).length<2||q.options.some(v=>!filled(v))||!q.options.includes(q.answer)))add(prefix+'provide at least two choices and select an answer from them.',{...target,path:bank+'.options'});
   if(q.kind==='boolean'&&filled(q.answer)&&!['true','false'].includes(q.answer.toLowerCase()))add(prefix+'choose True or False.',{...target,path:bank+'.answer'});
  });
 }
 for(const [i,lesson]of (week.lessons||[]).entries()){
  const target={lessonId:lesson.id},name=lesson.title?.trim()||'Subtopic '+(i+1);
  if(!aimed(lesson.id)){continue;}
  if(!filled(lesson.title))add('Give subtopic '+(i+1)+' a title.',{...target,path:'lesson.title'});
  const doc=documentForLessonSafe(lesson);
  if(!doc||!doc.blocks.length)add(name+': add some teaching content.',target);
  else try{validateLessonDocument(doc);}catch(error){const block=doc.blocks.find(block=>{try{validateLessonDocument({schemaVersion:1,blocks:[block]});return false;}catch{return true;}});add(name+': review the lesson item settings. '+error.message,{...target,...(block?{blockId:block.id}:{}),...(block?.type==='video'?{path:'block.video'}:{})});}
  questions(lesson.questions,lesson.id,'practice');
 }
 questions(week.quiz,week.lessons?.[0]?.id,'quiz');
 return issues;
}
function documentForLessonSafe(lesson){try{return lesson.document??documentForLesson(lesson);}catch{return null;}}
