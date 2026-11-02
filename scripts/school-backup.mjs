// Back up or restore ONE school (its database tables and uploaded files). Other schools are never touched.
//   npm run school-backup -- backup  --code alpha --out backups/alpha-2026-11-02
//   npm run school-backup -- restore --code alpha --from backups/alpha-2026-11-02 --yes
// Run with the app stopped. The backup holds that school's private data: store it like the live data.
// Files kept in S3 are not copied here; rely on bucket versioning or replication for them.
import fs from 'node:fs';
import path from 'node:path';
const args=process.argv.slice(2),mode=args[0],get=n=>{const i=args.indexOf('--'+n);return i>=0?args[i+1]:undefined;};
const code=get('code');
if(!['backup','restore'].includes(mode)||!code){console.error('Usage: npm run school-backup -- backup --code <code> --out <folder>\n       npm run school-backup -- restore --code <code> --from <folder> --yes');process.exit(1);}
const {schoolHandle}=await import('../store.mjs');
const school=schoolHandle(code);if(!school){console.error('That school is not active on this installation.');process.exit(1);}
const {sql,dir}=school;
// Tables in the order the migrations create them, which is a safe order for foreign keys.
const migrations=new URL('../migrations/',import.meta.url),tables=[];
for(const f of fs.readdirSync(migrations).filter(v=>v.endsWith('.sql')).sort())for(const m of fs.readFileSync(new URL(f,migrations),'utf8').matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g))if(!tables.includes(m[1]))tables.push(m[1]);
try{
 if(mode==='backup'){
  const out=get('out');if(!out){console.error('Choose --out <folder>.');process.exit(1);}
  fs.mkdirSync(out,{recursive:true});const data={format:1,school:code,createdAt:new Date().toISOString(),tables:{}};
  for(const t of tables)data.tables[t]=await sql.all(`SELECT * FROM ${t}`);
  fs.writeFileSync(path.join(out,'data.json'),JSON.stringify(data),{mode:0o600});
  if(fs.existsSync(path.join(dir,'uploads')))fs.cpSync(path.join(dir,'uploads'),path.join(out,'uploads'),{recursive:true});
  console.log(`Backed up ${code}: ${Object.values(data.tables).reduce((n,r)=>n+r.length,0)} rows, files copied to ${out}.`);
 }else{
  const from=get('from');if(!from||!args.includes('--yes')){console.error('Restore replaces ALL of this school\'s data. Add --from <folder> --yes to continue.');process.exit(1);}
  const data=JSON.parse(fs.readFileSync(path.join(from,'data.json'),'utf8'));if(data.school!==code){console.error(`That backup belongs to school "${data.school}", not "${code}".`);process.exit(1);}
  await sql.exec('BEGIN');
  try{
   for(const t of [...tables].reverse())await sql.run(`DELETE FROM ${t}`);
   for(const t of tables)for(const row of data.tables[t]||[]){const cols=Object.keys(row);await sql.run(`INSERT INTO ${t} (${cols.join(',')}) VALUES (${cols.map(()=>'?').join(',')})`,cols.map(c=>row[c]));}
   await sql.exec('COMMIT');
  }catch(e){await sql.exec('ROLLBACK');throw e;}
  fs.rmSync(path.join(dir,'uploads'),{recursive:true,force:true});if(fs.existsSync(path.join(from,'uploads')))fs.cpSync(path.join(from,'uploads'),path.join(dir,'uploads'),{recursive:true});
  console.log(`Restored ${code} from ${from}. Start the app again.`);
 }
 process.exit(0);
}catch(e){console.error(e.message);process.exit(1);}
