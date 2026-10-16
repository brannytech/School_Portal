import fs from 'node:fs';
import path from 'node:path';
import {openDatabase} from '../database.mjs';
const directory=path.resolve(process.env.DATA_DIR||'data');
const destination=path.resolve(process.argv[2]||path.join('backups','school-'+new Date().toISOString().replace(/[:.]/g,'-')));
if(destination.startsWith(path.resolve('public')+path.sep)||destination===directory||directory.startsWith(destination+path.sep))throw Error('Use a private backup folder outside public and outside the database directory.');
fs.mkdirSync(destination,{recursive:true});const sql=await openDatabase(directory);
try{
 const tables=sql.kind==='sqlite'?(await sql.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY rowid")).map(r=>r.name):(await sql.all("SELECT table_name AS name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name")).map(r=>r.name);
 const snapshot={format:1,created:new Date().toISOString(),driver:sql.kind,tables:{}};
 await sql.exec('BEGIN');try{for(const name of tables){if(name==='auth_sessions'||name==='recovery_tokens')continue;if(!/^[a-z_]+$/.test(name))throw Error('Unsupported table name.');snapshot.tables[name]=await sql.all(`SELECT * FROM ${name}`);}await sql.exec('COMMIT');}catch(e){await sql.exec('ROLLBACK');throw e;}
 fs.writeFileSync(path.join(destination,'database-backup.json'),JSON.stringify(snapshot),{mode:0o600});
 if(process.env.STORAGE_DRIVER!=='s3'&&fs.existsSync(path.join(directory,'uploads')))fs.cpSync(path.join(directory,'uploads'),path.join(destination,'uploads'),{recursive:true});
 fs.writeFileSync(path.join(destination,'README.txt'),'PRIVATE SCHOOL BACKUP. Contains account hashes and student records. Restrict access, encrypt offsite copies and never commit this directory. S3 media requires a separate versioned bucket backup. Authentication sessions and recovery tokens are excluded.\n');
 console.log('Private backup completed: '+destination);
}finally{await sql.close();}
