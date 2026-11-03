// School identity: name, motto, colour, crest, building photo and report header lines.
// Everything here lives in the current school's own database and folder (see store.mjs).
import {randomBytes} from 'node:crypto';
import {db,save,tenantDir,storagePrefix,currentTenant,assertStorageAvailable} from './store.mjs';
import {validateFile,storeFile,streamFile} from './storage.mjs';

const HEX=/^#[0-9a-f]{6}$/i;
const luminance=hex=>{const c=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.03928?v/12.92:((v+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2];};
// Button text is white, so the accent must have enough contrast against white (WCAG AA for text: 4.5).
export const contrastWithWhite=hex=>1.05/(luminance(hex)+.05);
const clean=(v,max)=>String(v??'').replace(/[\u0000-\u001f<>]/g,'').trim().slice(0,max);

// What anyone may see before signing in. The first school keeps its original crest and photo until it uploads its own.
export function publicBrand(){
 const b=db.branding||{},t=currentTenant(),url=k=>`/api/brand/${k}?school=${encodeURIComponent(t.slug)}&v=${b.version||0}`;
 return {code:t.slug,name:db.school.name,motto:db.school.motto||'',shortName:b.shortName||'',accent:b.accent||'',
  crest:b.crest?url('crest'):(t.isDefault?'/assets/school-logo.webp':null),photo:b.photo?url('photo'):(t.isDefault?'/assets/school-building.webp':null)};
}

export async function serveBrandImage(kind,req,res,fail){
 const file=(db.branding||{})[kind];if(!['crest','photo'].includes(kind)||!file)fail(404,'Not found.');
 await streamFile(tenantDir(),{id:file.id,type:file.type,storage:file.storage},req,res,'public, max-age=86400',storagePrefix());
}

export async function brandingApi({endpoint,method,b,u,json,fail,audit}){
 if(endpoint!=='brand-settings'&&endpoint!=='brand-image')return false;
 if(u.role!=='ADMIN')fail(403,'Only the school administrator can change the school profile.');
 db.branding??={};const branding=db.branding;
 if(endpoint==='brand-settings'&&method==='GET'){json({...publicBrand(),address:branding.address||'',phone:branding.phone||'',principal:branding.principal||''});return true;}
 if(endpoint==='brand-settings'&&method==='POST'){
  const name=clean(b.name,120);if(name.length<2)fail(400,'Enter the school name.');
  const accent=String(b.accent||'').trim();if(accent&&!HEX.test(accent))fail(400,'Choose a colour like #1b5e20.');
  if(accent&&contrastWithWhite(accent)<4.5)fail(400,'That colour is too light for white text. Choose a darker colour.');
  db.school.name=name;db.school.motto=clean(b.motto,160);
  Object.assign(branding,{shortName:clean(b.shortName,20),accent:accent.toLowerCase(),address:clean(b.address,200),phone:clean(b.phone,40),principal:clean(b.principal,100)});
  audit(u,'Updated the school profile');await save();json({ok:true,brand:publicBrand()});return true;
 }
 if(endpoint==='brand-image'&&method==='POST'){
  const kind=b.kind;if(!['crest','photo'].includes(kind))fail(400,'Choose crest or photo.');
  if(b.remove){delete branding[kind];branding.version=(branding.version||0)+1;audit(u,`Removed the school ${kind}`);await save();json({ok:true,brand:publicBrand()});return true;}
  const raw=String(b.data||'').replace(/^data:[^,]*,/,'');if(!raw||raw.length>3_000_000)fail(400,'Choose an image under 2 MB.');
  const bytes=Buffer.from(raw,'base64');if(bytes.length>2*1024*1024)fail(400,'Choose an image under 2 MB.');
  const image=validateFile(bytes,'lesson-image');assertStorageAvailable(image.bytes.length);
  const id=`brand-${kind}-${randomBytes(6).toString('hex')}`;
  const storage=await storeFile(tenantDir(),id,image.bytes,image.type,storagePrefix());
  branding[kind]={id,type:image.type,storage};branding.version=(branding.version||0)+1;audit(u,`Changed the school ${kind}`);await save();json({ok:true,brand:publicBrand()});return true;
 }
 return false;
}
