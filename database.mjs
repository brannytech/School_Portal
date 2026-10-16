import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

export async function openDatabase(directory){
 let sql;
 if(process.env.DATABASE_URL?.startsWith('postgres')){
  const {Client}=await import('pg');const client=new Client({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_SSL==='true'?{rejectUnauthorized:true}:undefined});await client.connect();
  const query=(s,p=[])=>client.query(s.replace(/\?/g,()=>`$${++query.index}`),p);query.index=0;
  sql={kind:'postgresql',async all(s,p=[]){let i=0;return(await client.query(s.replace(/\?/g,()=>`$${++i}`),p)).rows;},async run(s,p=[]){let i=0;return client.query(s.replace(/\?/g,()=>`$${++i}`),p);},async exec(s){return client.query(s);},async close(){await client.end();}};
 }else{
  const {DatabaseSync}=await import('node:sqlite');const handle=new DatabaseSync(path.join(directory,'school.sqlite'));handle.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
  sql={kind:'sqlite',async all(s,p=[]){return handle.prepare(s).all(...p);},async run(s,p=[]){return handle.prepare(s).run(...p);},async exec(s){handle.exec(s);},async close(){handle.close();},handle};
 }
 await sql.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
 for(const file of fs.readdirSync(new URL('./migrations/',import.meta.url)).filter(v=>v.endsWith('.sql')).sort()){
  if((await sql.all('SELECT version FROM schema_migrations WHERE version=?',[file])).length)continue;
  await sql.exec('BEGIN');try{await sql.exec(fs.readFileSync(new URL('./migrations/'+file,import.meta.url),'utf8'));await sql.run('INSERT INTO schema_migrations(version,applied_at) VALUES (?,?)',[file,new Date().toISOString()]);await sql.exec('COMMIT');}catch(e){await sql.exec('ROLLBACK');throw e;}
 }
 return sql;
}

export const entityTables={assignments:'assignments',files:'files',submissions:'submissions',progress:'progress',practiceAttempts:'practice_attempts',assessmentAttempts:'assessment_attempts',reflections:'reflections',questions:'discussions',scores:'scores',resources:'resources',releases:'lesson_releases',announcements:'announcements'};
const studentEntities=new Set(['submissions','progress','practiceAttempts','assessmentAttempts','reflections','questions','scores']);
const payload=v=>JSON.stringify(v);
export async function loadDatabase(sql){
 const settings=await sql.all('SELECT key,value FROM app_settings');if(!settings.length)return null;const db=Object.fromEntries(settings.map(v=>[v.key,JSON.parse(v.value)]));
 db.school=(await sql.all('SELECT * FROM schools'))[0];db.sessions=(await sql.all('SELECT * FROM academic_sessions')).map(v=>({id:v.id,name:v.name,currentTerm:v.current_term}));
 db.classes=(await sql.all('SELECT name FROM classes')).map(v=>v.name);db.subjects=(await sql.all('SELECT name FROM subjects')).map(v=>v.name);
 db.users=(await sql.all('SELECT * FROM users')).map(v=>({...JSON.parse(v.profile),id:v.id,email:v.email,name:v.name,role:v.role,status:v.status,password:v.password_hash}));
 db.enrolments=(await sql.all('SELECT * FROM enrolments')).map(v=>({id:v.id,student:v.student_id,sessionId:v.session_id,class:v.class_id}));
 db.allocations=(await sql.all('SELECT * FROM teacher_assignments')).map(v=>({id:v.id,teacher:v.teacher_id,sessionId:v.session_id,class:v.class_id,subject:v.subject_id}));
 for(const [key,table]of Object.entries(entityTables))db[key]=(await sql.all(`SELECT content FROM ${table}`)).map(v=>JSON.parse(v.content));
 for(const [key,table]of Object.entries({versions:'submission_versions',markingHistory:'marking_history',notifications:'notifications',audit:'audit_logs',resetTokens:'recovery_tokens',scoreHistory:'score_history'}))db[key]=(await sql.all(`SELECT content FROM ${table}`)).map(v=>JSON.parse(v.content));
 for(const q of db.questions){const replies=(await sql.all('SELECT content FROM discussion_replies WHERE discussion_id=? ORDER BY position',[q.id])).map(r=>JSON.parse(r.content));if(replies.length||!q.replies)q.replies=replies;}
 db.courses={};for(const c of await sql.all('SELECT * FROM courses')){const ws=[];for(const w of await sql.all('SELECT * FROM course_weeks WHERE course_id=? ORDER BY week_number',[c.id])){const week=JSON.parse(w.content);week.lessons=[];for(const l of await sql.all('SELECT * FROM lessons WHERE week_id=? ORDER BY lesson_key',[w.id])){const lesson=JSON.parse(l.content);lesson.questions=(await sql.all('SELECT content FROM question_items WHERE lesson_id=? AND stage=? ORDER BY question_key',[l.id,'lesson'])).map(v=>JSON.parse(v.content));week.lessons.push(lesson);}week.quiz=(await sql.all('SELECT content FROM question_items WHERE week_id=? AND stage=? ORDER BY question_key',[w.id,'mastery'])).map(v=>JSON.parse(v.content));ws.push(week);}db.courses[c.id]=ws;}
 db.unlocks={};db.termLocks=[];for(const r of await sql.all('SELECT id,content FROM access_rules')){const rule=JSON.parse(r.content);db.unlocks[r.id]=rule.weeks;if(rule.locked)db.termLocks.push(r.id);}
 return db;
}

export function relationalStore(sql){
 let previous=new Map();
 async function persist(db){
  const rows=new Map();const add=(table,row)=>{if(!rows.has(table))rows.set(table,[]);rows.get(table).push(row);};
  add('schools',{id:db.school.id,name:db.school.name,motto:db.school.motto});
  for(const s of db.sessions)add('academic_sessions',{id:s.id,school_id:db.school.id,name:s.name,current_term:s.currentTerm});
  for(const session of db.sessions)for(const number of [1,2,3])add('academic_terms',{id:session.id+'|'+number,session_id:session.id,number,title:['First Term','Second Term','Third Term'][number-1]});
  for(const name of db.classes)add('classes',{id:name,name});for(const name of db.subjects)add('subjects',{id:name,name});
  for(const u of db.users){const {password,...profile}=u;add('users',{id:u.id,school_id:db.school.id,email:u.email,name:u.name,role:u.role,status:u.status,password_hash:password,profile:payload(profile)});}
  for(const v of db.enrolments)add('enrolments',{id:v.id,student_id:v.student,session_id:v.sessionId,class_id:v.class});
  for(const v of db.allocations)add('teacher_assignments',{id:v.id,teacher_id:v.teacher,session_id:v.sessionId,class_id:v.class,subject_id:v.subject});
  for(const [id,weeks]of Object.entries(db.courses)){const [sessionId,scope]=id.split('|'),[c,s,t]=scope.split(':');add('courses',{id,session_id:sessionId,class_id:c,subject_id:s,term:Number(t)});for(const w of weeks){const wid=id+'|'+w.id;const {lessons,quiz,...content}=w;add('course_weeks',{id:wid,course_id:id,week_number:w.id,title:w.title,content:payload(content)});for(const l of lessons){const lid=wid+'|'+l.id,{questions,...lc}=l;add('lessons',{id:lid,week_id:wid,lesson_key:l.id,title:l.title,content:payload(lc)});for(const q of questions)add('question_items',{id:lid+'|'+q.id,week_id:wid,lesson_id:lid,question_key:q.id,stage:'lesson',difficulty:q.difficulty||'Beginner',question_type:q.kind,content:payload(q)});}for(const q of quiz)add('question_items',{id:wid+'|mastery|'+q.id,week_id:wid,lesson_id:null,question_key:q.id,stage:'mastery',difficulty:q.difficulty||'Challenge',question_type:q.kind,content:payload(q)});}}
  for(const id of new Set([...Object.keys(db.unlocks),...db.termLocks])){const [sessionId,k]=id.split('|'),[c,s,t]=k.split(':');add('access_rules',{id,session_id:sessionId,class_id:c,subject_id:s,term:Number(t),content:payload({weeks:db.unlocks[id]||[],locked:db.termLocks.includes(id)})});}
  for(const [key,table]of Object.entries(entityTables))for(const v of db[key]){const row={id:v.id,session_id:v.sessionId,class_id:v.class,subject_id:v.subject,term:v.term,content:payload(key==='questions'?(({replies,...q})=>q)(v):v)};if(studentEntities.has(key))row.student_id=v.student;if(key==='files')row.owner_id=v.student;if(key==='assignments')row.teacher_id=v.teacher||null;if(key==='submissions')row.assignment_id=v.assignment||null;add(table,row);}
  for(const q of db.questions)for(const [position,r]of q.replies.entries())add('discussion_replies',{id:q.id+'|'+position,discussion_id:q.id,author_id:r.author||db.users.find(u=>u.name===r.name)?.id||null,position,content:payload(r)});
  for(const v of db.scoreHistory||[])add('score_history',{id:v.id,score_id:v.score,teacher_id:v.teacher,content:payload(v)});
  for(const v of db.versions)add('submission_versions',{id:v.id,submission_id:v.submission,content:payload(v)});
  for(const v of db.markingHistory)add('marking_history',{id:v.id,submission_id:v.submission,teacher_id:v.teacher,content:payload(v)});
  for(const v of db.notifications)add('notifications',{id:v.id,recipient_id:v.recipient,content:payload(v)});
  for(const v of db.audit)add('audit_logs',{id:v.id,user_id:v.user,occurred_at:v.at,content:payload(v)});
  for(const v of db.resetTokens)add('recovery_tokens',{id:v.id,user_id:v.user,expires_at:v.expires,content:payload(v)});
  const exclude=new Set(['scoreHistory','school','sessions','classes','subjects','users','enrolments','allocations','courses','unlocks','termLocks','versions','markingHistory','notifications','audit','resetTokens',...Object.keys(entityTables)]);
  for(const [key,value]of Object.entries(db))if(!exclude.has(key))add('app_settings',{key,value:payload(value)});
  const next=new Map();await sql.exec('BEGIN');try{
   for(const [table,values]of rows){const map=new Map();for(const v of values){const key=v.id??v.key,json=payload(v);map.set(key,json);if(previous.get(table)?.get(key)===json)continue;const columns=Object.keys(v),primary=table==='app_settings'?'key':'id';await sql.run(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(()=>'?').join(',')}) ON CONFLICT(${primary}) DO UPDATE SET ${columns.filter(k=>k!==primary).map(k=>`${k}=excluded.${k}`).join(',')}`,Object.values(v));}next.set(table,map);}
   for(const [table,map]of [...previous].reverse())for(const key of map.keys())if(!next.get(table)?.has(key))await sql.run(`DELETE FROM ${table} WHERE ${table==='app_settings'?'key':'id'}=?`,[key]);
   await sql.exec('COMMIT');previous=next;
  }catch(e){await sql.exec('ROLLBACK');throw e;}
 }
 return {persist};
}

export function durableSessions(sql){const digest=id=>createHash('sha256').update(String(id||'')).digest('hex');return {
 async get(id){const row=(await sql.all('SELECT content FROM auth_sessions WHERE id=?',[digest(id)]))[0];return row?JSON.parse(row.content):undefined;},
 async set(id,value){await sql.run('INSERT INTO auth_sessions(id,user_id,expires_at,content) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET content=excluded.content,expires_at=excluded.expires_at',[digest(id),value.user,value.expires,payload(value)]);},
 async delete(id){await sql.run('DELETE FROM auth_sessions WHERE id=?',[digest(id)]);},
 async revoke(user){await sql.run('DELETE FROM auth_sessions WHERE user_id=?',[user]);}
};}
