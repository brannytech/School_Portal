import fs from 'node:fs';
import path from 'node:path';
import {randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
export const dataDir=path.resolve(process.env.DATA_DIR||'data');
fs.mkdirSync(dataDir,{recursive:true});
export const hash=password=>{const salt=randomBytes(16).toString('hex');return salt+':'+scryptSync(password,salt,64).toString('hex');};
export const matches=(p,h)=>{try{const [salt,key]=h.split(':');return timingSafeEqual(scryptSync(p,salt,64),Buffer.from(key,'hex'));}catch{return false;}};
const file=path.join(dataDir,'database.json');
export function seed(){const password=hash(process.env.DEMO_PASSWORD||'Learn@2026!');return {users:[
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
export let db=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):seed();
export function save(){const temp=file+'.tmp';fs.writeFileSync(temp,JSON.stringify(db,null,2));for(let attempt=0;;attempt++){try{fs.renameSync(temp,file);break;}catch(e){if(attempt>=4||!['EPERM','EBUSY','EACCES'].includes(e.code))throw e;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,20*(attempt+1));}}}
if(!fs.existsSync(file))save();
