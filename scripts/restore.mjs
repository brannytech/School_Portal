import fs from 'node:fs';
import path from 'node:path';
import {openDatabase} from '../database.mjs';
const source=path.resolve(process.argv[2]||'');if(!process.argv[2])throw Error('Usage: npm run restore -- <backup-folder>. Set DATA_DIR to a fresh directory first.');
const directory=path.resolve(process.env.DATA_DIR||'data');fs.mkdirSync(directory,{recursive:true});const sql=await openDatabase(directory);
try{
 if((await sql.all('SELECT id FROM users LIMIT 1')).length)throw Error('Restore requires an empty target database. Existing school records will not be overwritten.');
 const snapshot=JSON.parse(fs.readFileSync(path.join(source,'database-backup.json'),'utf8'));if(snapshot.format!==1)throw Error('Unsupported backup format.');
 const tables=['schools','app_settings','academic_sessions','academic_terms','classes','subjects','users','enrolments','teacher_assignments','courses','course_weeks','lessons','question_items','access_rules','assignments','files','submissions','submission_versions','marking_history','progress','practice_attempts','assessment_attempts','reflections','discussions','discussion_replies','scores','score_history','resources','lesson_releases','announcements','notifications','audit_logs'];
 await sql.exec('BEGIN');try{for(const table of tables){for(const row of snapshot.tables[table]||[]){const columns=Object.keys(row);if(columns.some(c=>!/^[a-z_]+$/.test(c)))throw Error('Invalid backup columns.');await sql.run(`INSERT INTO ${table}(${columns.join(',')}) VALUES (${columns.map(()=>'?').join(',')})`,Object.values(row));}}await sql.exec('COMMIT');}catch(e){await sql.exec('ROLLBACK');throw e;}
 if(fs.existsSync(path.join(source,'uploads')))fs.cpSync(path.join(source,'uploads'),path.join(directory,'uploads'),{recursive:true});
 console.log('Backup restored into empty database. All users must sign in again.');
}finally{await sql.close();}
