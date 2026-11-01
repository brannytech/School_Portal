import fs from 'node:fs';
import path from 'node:path';
import {openDatabase,loadDatabase,relationalStore,entityTables,durableSessions} from './database.mjs';
import {academicSession,academicKey,requestScope} from './context.mjs';
import {curriculum as weeks} from './curriculum.mjs';
import {randomBytes,scryptSync,timingSafeEqual,createHmac} from 'node:crypto';
export const rootDir=path.resolve(process.env.DATA_DIR||'data');
fs.mkdirSync(rootDir,{recursive:true});
export const hash=password=>{const salt=randomBytes(16).toString('hex');return salt+':'+scryptSync(password,salt,64).toString('hex');};
export const matches=(p,h)=>{try{const [salt,key]=h.split(':');return timingSafeEqual(scryptSync(p,salt,64),Buffer.from(key,'hex'));}catch{return false;}};
export const sampleMode=()=>Boolean(process.env.DEMO_PASSWORD)||process.env.SEED_SAMPLE_DATA==='true'||process.env.DEMO_MODE==='true';
const tempPassword=()=>{const w=()=>randomBytes(3).toString('hex');return `Lab-${w()}-${w()}-${w()}`;};
export function cleanSeed(admin){
 const {email,password}=admin;
 return {clean:true,users:[{id:'initial-admin',name:'School Administrator',email,role:'ADMIN',status:'ACTIVE',password:hash(password),mustChangePassword:true}],assignments:[],currentTerm:1,allocations:[],classes:['JSS1','JSS2','JSS3','SS1','SS2','SS3'],subjects:['Mathematics','English Language','Physics','Chemistry','Biology'],unlocks:{},termLocks:[],submissions:[],files:[],progress:[],reflections:[],questions:[],scores:[],resources:[],audit:[]};
}
export function seed(){const password=hash(process.env.DEMO_PASSWORD||randomBytes(24).toString('hex'));return {users:[
 {id:'admin',name:'Olawale Admin',email:'admin@olawaleslab.school',role:'ADMIN',status:'ACTIVE',password},
 {id:'teacher',name:'Mrs. Adebayo',email:'teacher@olawaleslab.school',role:'TEACHER',status:'ACTIVE',password},
 {id:'student',name:'Ayomide Johnson',email:'student@olawaleslab.school',role:'STUDENT',status:'ACTIVE',class:'SS1',admission:'GF/2026/001',password},
 {id:'student2',name:'Chisom Okafor',email:'chisom@olawaleslab.school',role:'STUDENT',status:'ACTIVE',class:'SS1',admission:'GF/2026/002',password},
 {id:'pending',name:'Tobi Williams',email:'pending@olawaleslab.school',role:'STUDENT',status:'PENDING',class:'SS1',admission:'GF/2026/003',password}],
 assignments:[{id:'assignment1',title:'Number bases in everyday life',instructions:'Convert 25 from base ten to binary. Explain your steps. Then write a short example of how binary is used in a phone. Photograph all pages of your working.',class:'SS1',subject:'Mathematics',term:1,due:'2026-10-23',teacher:'teacher',resubmission:false}],
 currentTerm:1,allocations:[{teacher:'teacher',class:'SS1',subject:'Mathematics'}],classes:['JSS1','JSS2','JSS3','SS1','SS2','SS3'],subjects:['Mathematics','English Language','Physics','Chemistry','Biology'],
 unlocks:{'SS1:Mathematics:1':[1]},termLocks:[],submissions:[],files:[],progress:[],reflections:[],questions:[{id:'question1',student:'student2',name:'Chisom Okafor',class:'SS1',subject:'Mathematics',term:1,lesson:'1-1',text:'Why can we only use 0 and 1 in base two?',replies:[{name:'Mrs. Adebayo',role:'TEACHER',text:'Because each digit must be less than the base. In base two, the allowed digits are 0 and 1.'}],created:new Date().toISOString()}],
 scores:[{id:'score1',student:'student',class:'SS1',subject:'Mathematics',term:1,type:'Test',score:18,max:20,remark:'A strong start. Keep showing your working.'}],
 resources:[],audit:[]};}

const appSecretFor=slug=>createHmac('sha256',process.env.SESSION_SECRET).update('school:'+slug).digest('hex');
// ---------------------------------------------------------------------------------------------
// Schools (tenants). Every school has its own database and its own uploads folder, so one school's
// data is never even loaded while another school's request runs. The first school uses the data
// folder itself (so an existing single-school install keeps working); the others live in schools/<code>/.
// ---------------------------------------------------------------------------------------------
export const DEFAULT_CODE=process.env.SCHOOL_CODE||'main';
export const validCode=v=>typeof v==='string'&&/^[a-z0-9][a-z0-9-]{1,30}$/.test(v)&&!['schools','uploads','platform','admin','api','www'].includes(v);
const registryFile=path.join(rootDir,'schools.json');
const readRegistry=()=>{try{return JSON.parse(fs.readFileSync(registryFile,'utf8'));}catch{return {schools:[]};}};
const writeRegistry=r=>{const tmp=registryFile+'.tmp';fs.writeFileSync(tmp,JSON.stringify(r,null,1),{mode:0o600});fs.renameSync(tmp,registryFile);};
const schoolDir=(code)=>code===DEFAULT_CODE?rootDir:path.join(rootDir,'schools',code);
async function loadTenant(slug,dir,{admin,name}={}){
 const isDefault=slug===DEFAULT_CODE;
 fs.mkdirSync(dir,{recursive:true});
 const generated=!admin;admin??=process.env.ADMIN_PASSWORD?{email:(process.env.ADMIN_EMAIL||'admin@school.local').toLowerCase(),password:process.env.ADMIN_PASSWORD}:{email:(process.env.ADMIN_EMAIL||'admin@school.local').toLowerCase(),password:tempPassword()};
 const firstRun=generated&&!process.env.ADMIN_PASSWORD?admin:null;
const sql=await openDatabase(dir,{schema:isDefault?undefined:slug});
const persistence=relationalStore(sql);
const existing=await loadDatabase(sql);
const file=path.join(dir,'database.json');
const legacy=isDefault&&!existing&&fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):null;
let db=existing||legacy||(isDefault&&sampleMode()?seed():cleanSeed(admin));
const year=new Date().getFullYear()-(new Date().getMonth()<8?1:0);
const sessionName=process.env.INITIAL_SESSION||year+'/'+(year+1);
db.school??=isDefault?{id:'grace-field',name:name||'Grace-Field College, Ibadan',motto:'Raising young minds for future impact.'}:{id:slug,name:name||slug,motto:''};
db.sessions??=[{id:'initial-session',name:sessionName,currentTerm:db.currentTerm||1}];
db.currentSessionId??=db.sessions[0].id;
db.policy??={developing:50,proficient:70,mastered:85,completion:60,noteMaximum:10,noteIncludedInCA:false};
db.appSecret??=process.env.SESSION_SECRET?appSecretFor(slug):randomBytes(32).toString('hex');
db.enrolments??=db.users.filter(u=>u.role==='STUDENT').map(u=>({id:u.id+'|'+db.currentSessionId,student:u.id,class:u.class,sessionId:db.currentSessionId}));
for(const key of [...Object.keys(entityTables),'versions','markingHistory','notifications','resetTokens','audit','recoveryRequests'])db[key]??=[];
for(const a of db.allocations){a.id??=randomBytes(16).toString('hex');a.sessionId??=db.currentSessionId;}
db.courses??={};
for(const key of Object.keys(db.courses))if(!key.includes('|')){db.courses[db.currentSessionId+'|'+key]=db.courses[key];delete db.courses[key];}
const initialKey=db.currentSessionId+'|SS1:Mathematics:1';if(!db.clean&&!Object.keys(db.courses).length)db.courses[initialKey]=structuredClone(weeks);if((db.curriculumVersion||0)<3){for(const [key,course]of Object.entries(db.courses))if(key.endsWith('|SS1:Mathematics:1')&&course.length===8&&(course[0].lessons[0].questions[0]?.id==='w1q0'||course[0].lessons[0].questions[0]?.id?.startsWith('bank-'))){db.legacyCourseBackups??={};db.legacyCourseBackups[key]=structuredClone(course);db.courses[key]=structuredClone(weeks);}db.curriculumVersion=3;}
if((db.curriculumVersion||0)<4){for(const [key,course]of Object.entries(db.courses))if(key.endsWith('|SS1:Mathematics:1')&&course.length===8&&course.every(w=>w.lessons.length===3&&w.lessons[0].questions[0]?.id?.startsWith('bank-'))){course.forEach((w,t)=>{w.lessons.push(...structuredClone(weeks[t].lessons.slice(3)));});}db.curriculumVersion=4;}
for(const key of Object.keys(db.unlocks))if(!key.includes('|')){db.unlocks[db.currentSessionId+'|'+key]=db.unlocks[key];delete db.unlocks[key];}
db.termLocks=db.termLocks.map(k=>k.includes('|')?k:db.currentSessionId+'|'+k);
async function save(){
 for(const key of Object.keys(entityTables))for(const value of db[key]){value.id??=randomBytes(16).toString('hex');value.sessionId??=academicSession()||db.currentSessionId;}
 for(const a of db.allocations){a.id??=randomBytes(16).toString('hex');a.sessionId??=academicSession()||db.currentSessionId;}
 for(const u of db.users)if(u.role==='STUDENT'&&!db.enrolments.some(e=>e.student===u.id&&e.sessionId===(academicSession()||db.currentSessionId)))db.enrolments.push({id:u.id+'|'+(academicSession()||db.currentSessionId),student:u.id,class:u.class,sessionId:academicSession()||db.currentSessionId});
 try{await persistence.persist(db);}catch(e){const restored=await loadDatabase(sql);if(restored)db=restored;throw e;}
}
if(!isDefault)db.demoData=false;
db.demoData??=db.users.some(u=>u.id==='student'&&u.email==='student@olawaleslab.school');
if(process.env.NODE_ENV==='production'){
 if(existing&&db.demoData)throw Error('Use a separate production DATA_DIR; this database contains development sandbox accounts.');
 if(!process.env.SESSION_SECRET||process.env.SESSION_SECRET.length<32)throw Error('Production requires a SESSION_SECRET of at least 32 characters.');
 if(!existing&&!legacy&&isDefault){if(!process.env.ADMIN_EMAIL||!process.env.ADMIN_PASSWORD||process.env.ADMIN_PASSWORD.length<14)throw Error('First production start requires ADMIN_EMAIL and a 14+ character ADMIN_PASSWORD.');db.demoData=false;db.users=[{id:'initial-admin',name:'School Administrator',email:process.env.ADMIN_EMAIL.toLowerCase(),role:'ADMIN',status:'ACTIVE',password:hash(process.env.ADMIN_PASSWORD),mustChangePassword:true}];db.clean=true;db.enrolments=[];db.allocations=[];for(const key of Object.keys(entityTables))db[key]=[];}
 if(legacy)throw Error('A legacy demo database cannot be implicitly imported into production. Use a fresh DATA_DIR and the documented reviewed migration procedure.');
 db.appSecret=appSecretFor(slug);
}
await save();
if(firstRun&&isDefault){const note=path.join(dir,'FIRST-LOGIN.txt');fs.writeFileSync(note,`First sign-in\nEmail:    ${firstRun.email}\nPassword: ${firstRun.password}\nYou will be asked to choose a new password immediately. This file is deleted afterwards.\n`,{mode:0o600});console.log(`\n=====================================================\n  FIRST RUN - administrator account created\n  Email:    ${firstRun.email}\n  Password: ${firstRun.password}\n  (temporary - you must change it at first sign-in)\n=====================================================\n`);}

return {slug,dir,sql,get db(){return db;},save,sessions:durableSessions(sql),uploadTokens:new Map(),isDefault};

}
const tenants=new Map();
let registry=readRegistry();
if(!registry.schools.length){registry={schools:[{code:DEFAULT_CODE,name:'',status:'ACTIVE',createdAt:new Date().toISOString()}]};writeRegistry(registry);}
for(const s of registry.schools)if(s.status!=='SUSPENDED')tenants.set(s.code,await loadTenant(s.code,schoolDir(s.code),{name:s.name||undefined}));
const first=tenants.get(DEFAULT_CODE)||[...tenants.values()][0];
export const schoolCodes=()=>registry.schools.map(s=>({code:s.code,name:tenants.get(s.code)?.db.school.name||s.name,status:s.status}));
export const schoolCount=()=>tenants.size;
export const findSchool=code=>typeof code==='string'?tenants.get(code.trim().toLowerCase()):undefined;
export const onlySchool=()=>tenants.size===1?first:undefined;
export async function createSchool({code,name,adminEmail,adminPassword}){
 code=String(code||'').trim().toLowerCase();
 if(!validCode(code))throw Object.assign(Error('School code: use 2 to 31 lowercase letters, numbers or hyphens.'),{status:400});
 if(registry.schools.some(s=>s.code===code))throw Object.assign(Error('That school code is already taken.'),{status:409});
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(adminEmail||'')))throw Object.assign(Error('Enter a valid administrator email.'),{status:400});
 if(String(adminPassword||'').length<10)throw Object.assign(Error('The temporary password needs at least 10 characters.'),{status:400});
 const tenant=await loadTenant(code,schoolDir(code),{name:String(name||code).trim().slice(0,120),admin:{email:String(adminEmail).toLowerCase(),password:adminPassword}});
 tenants.set(code,tenant);registry.schools.push({code,name:tenant.db.school.name,status:'ACTIVE',createdAt:new Date().toISOString()});writeRegistry(registry);
 return tenant;
}
// The tenant a request belongs to. Outside a request (start-up, scripts, tests) it is the first school.
export const currentTenant=()=>requestScope.getStore()?.tenant||first;
const view=(pick)=>new Proxy({},{
 get:(_,k)=>{const t=pick();const v=t[k];return typeof v==='function'?v.bind(t):v;},
 set:(_,k,v)=>{pick()[k]=v;return true;},
 has:(_,k)=>k in pick(),deleteProperty:(_,k)=>delete pick()[k],
 ownKeys:()=>Reflect.ownKeys(pick()),
 getOwnPropertyDescriptor:(_,k)=>{const o=pick();return k in o?{configurable:true,enumerable:true,writable:true,value:o[k]}:undefined;}
});
export const db=view(()=>currentTenant().db);
export const sql=view(()=>currentTenant().sql);
export const save=()=>currentTenant().save();
export const tenantDir=()=>currentTenant().dir;
export const storagePrefix=()=>currentTenant().isDefault?'private/':`schools/${currentTenant().slug}/private/`;
export const sessionStore=()=>currentTenant().sessions;
export const uploadLinks=()=>currentTenant().uploadTokens;
