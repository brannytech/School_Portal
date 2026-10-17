import fs from 'node:fs';
import path from 'node:path';
import {openDatabase,loadDatabase,relationalStore,entityTables} from './database.mjs';
import {academicSession,academicKey} from './context.mjs';
import {curriculum as weeks} from './curriculum.mjs';
import {randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
export const dataDir=path.resolve(process.env.DATA_DIR||'data');
fs.mkdirSync(dataDir,{recursive:true});
export const hash=password=>{const salt=randomBytes(16).toString('hex');return salt+':'+scryptSync(password,salt,64).toString('hex');};
export const matches=(p,h)=>{try{const [salt,key]=h.split(':');return timingSafeEqual(scryptSync(p,salt,64),Buffer.from(key,'hex'));}catch{return false;}};
const file=path.join(dataDir,'database.json');
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

export const sql=await openDatabase(dataDir);
const persistence=relationalStore(sql);
const existing=await loadDatabase(sql);
const legacy=!existing&&fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):null;
export let db=existing||legacy||seed();
const year=new Date().getFullYear()-(new Date().getMonth()<8?1:0);
const sessionName=process.env.INITIAL_SESSION||year+'/'+(year+1);
db.school??={id:'grace-field',name:'Grace-Field College, Ibadan',motto:'Raising young minds for future impact.'};
db.sessions??=[{id:'initial-session',name:sessionName,currentTerm:db.currentTerm||1}];
db.currentSessionId??=db.sessions[0].id;
db.policy??={developing:50,proficient:70,mastered:85,completion:60,noteMaximum:10,noteIncludedInCA:false};
db.appSecret??=process.env.SESSION_SECRET||randomBytes(32).toString('hex');
db.enrolments??=db.users.filter(u=>u.role==='STUDENT').map(u=>({id:u.id+'|'+db.currentSessionId,student:u.id,class:u.class,sessionId:db.currentSessionId}));
for(const key of [...Object.keys(entityTables),'versions','markingHistory','notifications','resetTokens','audit','recoveryRequests'])db[key]??=[];
for(const a of db.allocations){a.id??=randomBytes(16).toString('hex');a.sessionId??=db.currentSessionId;}
db.courses??={};
for(const key of Object.keys(db.courses))if(!key.includes('|')){db.courses[db.currentSessionId+'|'+key]=db.courses[key];delete db.courses[key];}
const initialKey=db.currentSessionId+'|SS1:Mathematics:1';if(!Object.keys(db.courses).length)db.courses[initialKey]=structuredClone(weeks);if((db.curriculumVersion||0)<3){for(const [key,course]of Object.entries(db.courses))if(key.endsWith('|SS1:Mathematics:1')&&course.length===8&&(course[0].lessons[0].questions[0]?.id==='w1q0'||course[0].lessons[0].questions[0]?.id?.startsWith('bank-'))){db.legacyCourseBackups??={};db.legacyCourseBackups[key]=structuredClone(course);db.courses[key]=structuredClone(weeks);}db.curriculumVersion=3;}
if((db.curriculumVersion||0)<4){for(const [key,course]of Object.entries(db.courses))if(key.endsWith('|SS1:Mathematics:1')&&course.length===8&&course.every(w=>w.lessons.length===3&&w.lessons[0].questions[0]?.id?.startsWith('bank-'))){course.forEach((w,t)=>{w.lessons.push(...structuredClone(weeks[t].lessons.slice(3)));});}db.curriculumVersion=4;}
for(const key of Object.keys(db.unlocks))if(!key.includes('|')){db.unlocks[db.currentSessionId+'|'+key]=db.unlocks[key];delete db.unlocks[key];}
db.termLocks=db.termLocks.map(k=>k.includes('|')?k:db.currentSessionId+'|'+k);
export async function save(){
 for(const key of Object.keys(entityTables))for(const value of db[key]){value.id??=randomBytes(16).toString('hex');value.sessionId??=academicSession()||db.currentSessionId;}
 for(const a of db.allocations){a.id??=randomBytes(16).toString('hex');a.sessionId??=academicSession()||db.currentSessionId;}
 for(const u of db.users)if(u.role==='STUDENT'&&!db.enrolments.some(e=>e.student===u.id&&e.sessionId===(academicSession()||db.currentSessionId)))db.enrolments.push({id:u.id+'|'+(academicSession()||db.currentSessionId),student:u.id,class:u.class,sessionId:academicSession()||db.currentSessionId});
 try{await persistence.persist(db);}catch(e){const restored=await loadDatabase(sql);if(restored)db=restored;throw e;}
}
db.demoData??=db.users.some(u=>u.id==='student'&&u.email==='student@olawaleslab.school');
if(process.env.NODE_ENV==='production'){
 if(existing&&db.demoData)throw Error('Use a separate production DATA_DIR; this database contains development sandbox accounts.');
 if(!process.env.SESSION_SECRET||process.env.SESSION_SECRET.length<32)throw Error('Production requires a SESSION_SECRET of at least 32 characters.');
 if(!existing&&!legacy){if(!process.env.ADMIN_EMAIL||!process.env.ADMIN_PASSWORD||process.env.ADMIN_PASSWORD.length<14)throw Error('First production start requires ADMIN_EMAIL and a 14+ character ADMIN_PASSWORD.');db.demoData=false;db.users=[{id:'initial-admin',name:'School Administrator',email:process.env.ADMIN_EMAIL.toLowerCase(),role:'ADMIN',status:'ACTIVE',password:hash(process.env.ADMIN_PASSWORD)}];db.enrolments=[];db.allocations=[];for(const key of Object.keys(entityTables))db[key]=[];}
 if(legacy)throw Error('A legacy demo database cannot be implicitly imported into production. Use a fresh DATA_DIR and the documented reviewed migration procedure.');
 db.appSecret=process.env.SESSION_SECRET;
}
await save();
