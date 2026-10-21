// Restore the Phase 0 backup into a new private test directory and compare without logging records.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

assert(process.argv[2],'Usage: node --experimental-sqlite scripts/audit-backup.mjs <private-backup-directory>');
const source=path.resolve(process.argv[2]);
const snapshot=JSON.parse(fs.readFileSync(path.join(source,'database-backup.json'),'utf8'));
const destination=path.resolve('test-results','phase-0-restore-'+Date.now());
assert(!fs.existsSync(destination),'Restore target must be new.');
const result=spawnSync(process.execPath,['--experimental-sqlite','scripts/restore.mjs',source],{
 env:{...process.env,DATA_DIR:destination,DATABASE_URL:'',STORAGE_DRIVER:'local'},encoding:'utf8'
});
assert.equal(result.status,0,'Restore command failed; inspect private local output.');
const sql=new DatabaseSync(path.join(destination,'school.sqlite'),{readOnly:true});
try{
 const checked=[];
 for(const [table,rows]of Object.entries(snapshot.tables)){
  assert(/^[a-z_]+$/.test(table),'Unexpected table name.');
  if(table==='schema_migrations')continue; // Application stamps its own migration application times.
  const restored=sql.prepare(`SELECT * FROM ${table}`).all();
  const canonical=values=>JSON.stringify(values.map(row=>JSON.stringify(Object.fromEntries(Object.entries(row).sort(([a],[b])=>a.localeCompare(b))))).sort());
  assert(canonical(restored)===canonical(rows),'Record mismatch in '+table);
  checked.push(table);
 }
 assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM auth_sessions').get().n,0);
 assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM recovery_tokens').get().n,0);
 assert.equal(sql.prepare('PRAGMA foreign_key_check').all().length,0);
 let media=0;
 const uploads=path.join(source,'uploads');
 if(fs.existsSync(uploads))for(const item of fs.readdirSync(uploads,{withFileTypes:true})){
  if(!item.isFile())continue;
  const digest=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  assert(digest(path.join(uploads,item.name))===digest(path.join(destination,'uploads',item.name)),'Media mismatch.');media++;
 }
 const report={date:new Date().toISOString(),status:'PASSED',comparedTables:checked.length,mediaFiles:media,authenticationSessionsRestored:0,recoveryTokensRestored:0,foreignKeyViolations:0};
 fs.writeFileSync(path.join(destination,'verification.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({output:destination,...report}));
}finally{sql.close();}
