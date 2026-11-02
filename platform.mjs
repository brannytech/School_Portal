// The platform owner: creates and suspends schools and resets school administrators' passwords.
// Owners live in their own small database, outside every school. They can see counts and health, never students' records.
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {openDatabase} from './database.mjs';
import {hash,matches,platformDir,createSchool,schoolList,setSchoolStatus,resetSchoolAdmin,setSchoolLimits} from './store.mjs';

// The owner database: a SQLite file next to the schools, or the "platform" schema when DATABASE_URL points at Postgres.
const db=await openDatabase(platformDir(),{schema:process.env.DATABASE_URL?.startsWith('postgres')?'platform':undefined,migrate:false,file:'platform.sqlite'});
for(const statement of [
 'CREATE TABLE IF NOT EXISTS owners (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, must_change INTEGER NOT NULL DEFAULT 1)',
 'CREATE TABLE IF NOT EXISTS owner_sessions (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, csrf TEXT NOT NULL, expires BIGINT NOT NULL)',
 'CREATE TABLE IF NOT EXISTS owner_audit (id TEXT PRIMARY KEY, at TEXT NOT NULL, owner_id TEXT NOT NULL, action TEXT NOT NULL)'])await db.exec(statement);
const one=async(sql,params=[])=>(await db.all(sql,params))[0];
const digest=v=>createHash('sha256').update(String(v||'')).digest('hex');
const temp=()=>{const w=()=>randomBytes(3).toString('hex');return `Lab-${w()}-${w()}-${w()}`;};
// The first owner is created from the environment; the password must be changed at first sign-in.
if(!await one('SELECT 1 AS x FROM owners')&&process.env.PLATFORM_OWNER_EMAIL&&String(process.env.PLATFORM_OWNER_PASSWORD||'').length>=12)
 await db.run('INSERT INTO owners(id,email,password_hash,must_change) VALUES (?,?,?,1)',[randomUUID(),process.env.PLATFORM_OWNER_EMAIL.toLowerCase(),hash(process.env.PLATFORM_OWNER_PASSWORD)]);
const audit=(owner,action)=>db.run('INSERT INTO owner_audit(id,at,owner_id,action) VALUES (?,?,?,?)',[randomUUID(),new Date().toISOString(),owner,action]);
const cookieValue=req=>(req.headers.cookie||'').match(/(?:^|; )lab_platform=([^;]+)/)?.[1]||'';
const cookie=(value,age)=>`lab_platform=${value}; HttpOnly; SameSite=Strict; Path=/api/platform; Max-Age=${age}${process.env.COOKIE_SECURE==='true'?'; Secure':''}`;

export async function platformApi({endpoint,method,b,req,res,json,fail,rate}){
 const route=endpoint.slice('platform/'.length);
 if(route==='status'&&method==='GET'){json({ready:Boolean(await one('SELECT 1 AS x FROM owners'))});return;}
 if(route==='login'&&method==='POST'){
  rate('platform-login:'+req.socket.remoteAddress,8);
  const owner=await one('SELECT * FROM owners WHERE email=?',[String(b.email||'').toLowerCase()]);
  if(!owner||!matches(String(b.password||''),owner.password_hash))fail(401,'Email or password is incorrect.');
  const id=randomBytes(32).toString('hex'),csrf=randomBytes(24).toString('hex');
  await db.run('INSERT INTO owner_sessions(id,owner_id,csrf,expires) VALUES (?,?,?,?)',[digest(id),owner.id,csrf,Date.now()+4*3600000]);
  res.setHeader('Set-Cookie',cookie(id,14400));await audit(owner.id,'Signed in');json({csrf,email:owner.email,mustChange:Boolean(owner.must_change)});return;
 }
 const sid=cookieValue(req),session=sid?await one('SELECT * FROM owner_sessions WHERE id=?',[digest(sid)]):null;
 if(!session||Number(session.expires)<Date.now())fail(401,'Please sign in.');
 const owner=await one('SELECT * FROM owners WHERE id=?',[session.owner_id]);if(!owner)fail(401,'Please sign in.');
 if(method!=='GET'&&req.headers['x-csrf-token']!==session.csrf)fail(403,'Session check failed. Refresh and try again.');
 if(route==='logout'&&method==='POST'){await db.run('DELETE FROM owner_sessions WHERE id=?',[digest(sid)]);res.setHeader('Set-Cookie',cookie('',0));json({ok:true});return;}
 if(route==='me'&&method==='GET'){json({email:owner.email,csrf:session.csrf,mustChange:Boolean(owner.must_change)});return;}
 if(route==='change-password'&&method==='POST'){
  if(!matches(String(b.currentPassword||''),owner.password_hash))fail(400,'Your current password is not correct.');
  if(String(b.newPassword||'').length<12)fail(400,'Use at least 12 characters.');
  await db.run('UPDATE owners SET password_hash=?,must_change=0 WHERE id=?',[hash(b.newPassword),owner.id]);
  await db.run('DELETE FROM owner_sessions WHERE owner_id=? AND id<>?',[owner.id,digest(sid)]);await audit(owner.id,'Changed password');json({ok:true});return;
 }
 if(owner.must_change)fail(403,'Choose a new password before continuing.');
 if(route==='schools'&&method==='GET'){json({schools:schoolList()});return;}
 if(route==='create-school'&&method==='POST'){
  const password=temp();await createSchool({code:b.code,name:b.name,adminEmail:b.adminEmail,adminPassword:password});
  await audit(owner.id,`Created school ${String(b.code).toLowerCase()}`);json({code:String(b.code).toLowerCase(),adminEmail:String(b.adminEmail).toLowerCase(),temporaryPassword:password},201);return;
 }
 if(route==='school-limits'&&method==='POST'){await setSchoolLimits(String(b.code||''),{students:b.students,storageMb:b.storageMb});await audit(owner.id,`Set limits of ${b.code}`);json({ok:true});return;}
 if(route==='school-status'&&method==='POST'){await setSchoolStatus(String(b.code||''),b.status);await audit(owner.id,`Set ${b.code} to ${b.status}`);json({ok:true});return;}
 if(route==='reset-admin'&&method==='POST'){const password=temp(),email=await resetSchoolAdmin(String(b.code||''),password);await audit(owner.id,`Reset administrator password of ${b.code}`);json({adminEmail:email,temporaryPassword:password});return;}
 fail(404,'Endpoint not found.');
}
