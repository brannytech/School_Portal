// The shared curriculum library: ready-made weeks that a school can copy into its own courses.
// The library is read-only code and data. A copy is an ordinary week in the school's own database,
// locked to students until the teacher releases it. Editing the copy never changes the library or any other school.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {db,save} from './store.mjs';
import {academicSession,academicKey} from './context.mjs';

// The library ships EMPTY. Items are JSON files in the library folder (LIBRARY_DIR, default ./library) with the shape
// {id, title, class, subject, term, version, weeks}. Create them from a finished course with `npm run library-export`.
const libraryDir=()=>process.env.LIBRARY_DIR?pathToFileURL(path.resolve(process.env.LIBRARY_DIR)+path.sep):new URL('./library/',import.meta.url);
const validItem=v=>v&&typeof v.id==='string'&&/^[a-z0-9-]{3,80}$/.test(v.id)&&typeof v.title==='string'&&Array.isArray(v.weeks)&&v.weeks.length>0&&v.weeks.every(w=>Number.isInteger(w.id)&&w.id>0&&typeof w.title==='string'&&Array.isArray(w.quiz)&&Array.isArray(w.lessons)&&w.lessons.every(l=>l&&typeof l.id==='string'&&Array.isArray(l.questions)));
function folderItems(){
 const dir=libraryDir();if(!fs.existsSync(dir))return [];
 return fs.readdirSync(dir).filter(f=>f.endsWith('.json')).flatMap(f=>{try{const v=JSON.parse(fs.readFileSync(new URL(f,dir),'utf8'));return validItem(v)?[v]:[];}catch{return [];}});
}
export const libraryItems=()=>{const seen=new Set();return folderItems().filter(i=>!seen.has(i.id)&&seen.add(i.id));};
const summary=i=>({id:i.id,title:i.title,class:i.class,subject:i.subject,term:i.term,version:i.version||1,weeks:i.weeks.map(w=>({id:w.id,title:w.title,lessons:(w.lessons||[]).length}))});

export async function libraryApi({endpoint,method,b,u,json,fail,audit}){
 if(endpoint!=='library'&&endpoint!=='library-copy')return false;
 if(u.role==='STUDENT')fail(403,'The lesson library is for teachers and administrators.');
 if(endpoint==='library'&&method==='GET'){
  const copies=db.libraryCopies||[];
  json({items:libraryItems().map(i=>{const mine=copies.filter(c=>c.libraryId===i.id);return {...summary(i),copied:mine.map(({week,version,class:c,subject,term,at})=>({week,version,class:c,subject,term,at})),newerAvailable:mine.some(c=>(i.version||1)>c.version)};})});return true;
 }
 if(endpoint==='library-copy'&&method==='POST'){
  const item=libraryItems().find(i=>i.id===b.id);if(!item)fail(404,'That library item does not exist.');
  const c=String(b.class||item.class),s=String(b.subject||item.subject),t=Number(b.term||item.term),sid=academicSession()||db.currentSessionId;
  if(!db.classes.includes(c)||!db.subjects.includes(s)||![1,2,3].includes(t))fail(400,'Choose a valid class, subject and term.');
  if(u.role!=='ADMIN'&&!db.allocations.some(a=>a.teacher===u.id&&a.class===c&&a.subject===s&&a.sessionId===sid))fail(403,'You are not assigned to teach that class and subject.');
  const wanted=Array.isArray(b.weeks)&&b.weeks.length?b.weeks.map(Number):item.weeks.map(w=>w.id);
  const picked=wanted.map(id=>item.weeks.find(w=>w.id===id)).filter(Boolean);if(!picked.length)fail(400,'Choose at least one week from the library.');
  const key=academicKey(c,s,t,sid);db.courses??={};const current=db.courses[key]||[];
  const copied=[],skipped=[];
  for(const w of picked){if(current.some(x=>x.id===w.id)){skipped.push(w.id);continue;}current.push(structuredClone(w));copied.push(w.id);}
  if(copied.length){current.sort((a,b)=>a.id-b.id);db.courses[key]=current;db.libraryCopies??=[];for(const week of copied)db.libraryCopies.push({libraryId:item.id,version:item.version||1,week,class:c,subject:s,term:t,sessionId:sid,by:u.id,at:new Date().toISOString()});audit(u,`Copied library weeks ${copied.join(', ')} (${item.title}) into ${c} ${s} term ${t}`);await save();}
  json({copied,skipped,message:skipped.length?`Weeks ${skipped.join(', ')} already exist in your course, so they were not replaced.`:''});return true;
 }
 return false;
}
