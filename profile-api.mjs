import {randomUUID} from 'node:crypto';
import {db, save, dataDir} from './store.mjs';
import {cleanImage} from './images.mjs';
import {storeFile, streamFile} from './storage.mjs';

// Account photos follow the account across academic sessions. Metadata is persisted
// in app_settings; the image itself stays in the existing private storage provider.
export async function profileApi({endpoint, method, url, req, res, u, body, json, fail, audit, rate}) {
 if(endpoint.startsWith('profile-photo/') && method==='GET') {
  const target=db.users.find(v=>v.id===endpoint.slice('profile-photo/'.length));
  if(!target || (target.id!==u.id && u.role!=='ADMIN')) fail(404,'Profile photo not found.');
  const photo=(db.profilePhotos||[]).find(p=>p.id===target.photoId && p.owner===target.id);
  if(!photo) fail(404,'Profile photo not found.');
  await streamFile(dataDir,photo,req,res);
  return true;
 }
 if(endpoint!=='profile-photo' || method!=='PUT') return false;
 rate('profile-photo:'+u.id,30);
 const staged=url.searchParams.get('newStudent')==='true';
 const target=staged?null:db.users.find(v=>v.id===(url.searchParams.get('student')||u.id));
 if(staged && u.role!=='ADMIN') fail(403,'Only an administrator can register a student photo.');
 if(!staged && (!target || (target.id!==u.id && u.role!=='ADMIN'))) fail(403,'You can only update your own profile photo.');
 if(!staged && u.role==='STUDENT' && !target.photoId) fail(403,'Ask your administrator to add your initial profile photo first.');
 const cleaned=cleanImage(await body(req,700*1024));
 const photo={id:randomUUID(),owner:target?.id||null,uploader:u.id,type:cleaned.type,size:cleaned.bytes.length,created:new Date().toISOString()};
 photo.storage=await storeFile(dataDir,photo.id,cleaned.bytes,photo.type);
 db.profilePhotos??=[];
 db.profilePhotos.push(photo);
 if(target) {target.photoId=photo.id;audit(u,`Updated profile photo for ${target.name}`);}
 await save();
 json({id:photo.id},201);
 return true;
}

export function registrationPhoto(u,b,fail) {
 const photo=(db.profilePhotos||[]).find(p=>p.id===b.photoId && p.uploader===u.id && !p.owner);
 if(b.photoId && !photo) fail(400,'Upload a new photo for this student registration.');
 if(b.role!=='TEACHER' && !photo && b.import!==true) fail(400,'Upload the student’s initial profile photo before creating the account.');
 return photo;
}
