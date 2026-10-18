import {sql} from './store.mjs';

export async function recordStudentPresence(user){
 if(user.role!=='STUDENT')return;
 const previous=(await sql.all('SELECT last_seen FROM student_presence WHERE user_id=?',[user.id]))[0];
 if(previous&&Date.now()-Date.parse(previous.last_seen)<30000)return previous.last_seen;
 const stamp=new Date().toISOString();
 await sql.run('INSERT INTO student_presence(user_id,last_seen) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET last_seen=excluded.last_seen',[user.id,stamp]);
 return stamp;
}
