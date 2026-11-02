import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import zlib from 'node:zlib';

const chunk=(type,data)=>{const body=Buffer.concat([Buffer.from(type),data]),out=Buffer.alloc(12+data.length);out.writeUInt32BE(data.length,0);body.copy(out,4);out.writeUInt32BE(zlib.crc32(body),8+data.length);return out;};
function png(){const header=Buffer.alloc(13);header.writeUInt32BE(1,0);header.writeUInt32BE(1,4);header[8]=8;header[9]=2;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(Buffer.from([0,200,30,30]))),chunk('IEND',Buffer.alloc(0))]);}

test('Platform owner creates schools; each school has its own identity; suspended schools are closed',async()=>{
 const dir=path.resolve('test-results','school-identity-'+Date.now());fs.mkdirSync(dir,{recursive:true});
 let base='',output='';
 const server=spawn(process.execPath,['--experimental-sqlite','server.mjs'],{env:{...process.env,NODE_ENV:'production',DEMO_MODE:'false',DATA_DIR:dir,PORT:'0',SESSION_SECRET:'a-test-only-secret-that-is-long-enough-for-isolated-tests',ADMIN_EMAIL:'head@main.test',ADMIN_PASSWORD:'Main-initial-password-1!',PLATFORM_OWNER_EMAIL:'owner@platform.test',PLATFORM_OWNER_PASSWORD:'Owner-initial-password-1!'},stdio:['ignore','pipe','pipe']});
 server.stdout.on('data',b=>{output+=b;base=output.match(/ready at (http:\/\/127\.0\.0\.1:\d+)/)?.[1]||'';});server.stderr.on('data',b=>output+=b);
 try{
  for(let i=0;i<150&&!base;i++)await new Promise(r=>setTimeout(r,100));assert(base,output);
  const call=async(prefix,route,data,s={},method)=>{const r=await fetch(base+'/api/'+prefix+route,{method:method||(data?'POST':'GET'),headers:{'Content-Type':'application/json',Cookie:s.cookie||'','X-CSRF-Token':s.csrf||''},...(data?{body:JSON.stringify(data)}:{})});return {status:r.status,value:await r.json().catch(()=>null),cookie:r.headers.get('set-cookie')?.split(';')[0],type:r.headers.get('content-type')};};
  const owner=(route,data,s,m)=>call('platform/',route,data,s,m),app=(route,data,s,m)=>call('',route,data,s,m);

  // Owner: sign in, forced password change, then manage schools.
  assert.equal((await owner('schools')).status,401,'nothing without signing in');
  assert.equal((await owner('login',{email:'owner@platform.test',password:'wrong'})).status,401);
  const first=await owner('login',{email:'owner@platform.test',password:'Owner-initial-password-1!'});assert.equal(first.status,200);assert.equal(first.value.mustChange,true);
  let o={cookie:first.cookie,csrf:first.value.csrf};
  assert.equal((await owner('schools',null,o)).status,403,'must change the password first');
  assert.equal((await owner('change-password',{currentPassword:'Owner-initial-password-1!',newPassword:'short'},o)).status,400);
  assert.equal((await owner('change-password',{currentPassword:'Owner-initial-password-1!',newPassword:'Owner-chosen-password-1!'},o)).status,200);
  assert.equal((await owner('schools',null,{cookie:o.cookie,csrf:''},'POST')).status===200,false);
  const alpha=await owner('create-school',{code:'alpha',name:'Alpha High School',adminEmail:'head@alpha.test'},o);assert.equal(alpha.status,201,JSON.stringify(alpha.value));
  const beta=await owner('create-school',{code:'beta',name:'Beta College',adminEmail:'head@beta.test'},o);assert.equal(beta.status,201);
  assert.equal((await owner('create-school',{code:'alpha',name:'Again',adminEmail:'x@y.test'},o)).status,409);
  const listing=await owner('schools',null,o);assert.deepEqual(listing.value.schools.map(s=>s.code).sort(),['alpha','beta','main']);
  assert.deepEqual(Object.keys(listing.value.schools[0]).sort(),['code','createdAt','lastActivity','name','status','storageBytes','students','teachers'],'only counts and health');
  assert(!JSON.stringify(listing.value).includes('head@alpha.test')&&!/password/i.test(JSON.stringify(listing.value)),'no people or secrets in the owner listing');

  // A school administrator has no access to the owner screen.
  const a1=await app('login',{school:'alpha',email:'head@alpha.test',password:alpha.value.temporaryPassword});assert.equal(a1.status,200);
  assert.equal((await app('change-password',{currentPassword:alpha.value.temporaryPassword,newPassword:'Alpha-chosen-password-1!'},{cookie:a1.cookie,csrf:a1.value.csrf})).status,200);
  const a2=await app('login',{school:'alpha',email:'head@alpha.test',password:'Alpha-chosen-password-1!'});const admin={cookie:a2.cookie,csrf:a2.value.csrf};
  assert.equal((await owner('schools',null,{cookie:admin.cookie.replace('lab_session=','lab_platform=')})).status,401);

  // School identity: name, colour, crest. Bad colours and non-images are refused.
  assert.equal((await app('brand-settings',{name:'Alpha High School',accent:'#ffff00'},admin)).status,400,'too light for white text');
  assert.equal((await app('brand-settings',{name:'Alpha High School',accent:'red'},admin)).status,400);
  const saved=await app('brand-settings',{name:'Alpha High',motto:'Study well',shortName:'AHS',accent:'#8a1c1c',address:'1 Alpha Road',phone:'0800',principal:'Mrs Alpha'},admin);assert.equal(saved.status,200,JSON.stringify(saved.value));
  assert.equal((await app('brand-image',{kind:'crest',data:Buffer.from('not an image at all').toString('base64')},admin)).status,400);
  assert.equal((await app('brand-image',{kind:'crest',data:'A'.repeat(3_000_001)},admin)).status,400);
  assert.equal((await app('brand-image',{kind:'crest',data:png().toString('base64')},admin)).status,200);
  const cfgA=await app('config?school=alpha'),cfgB=await app('config?school=beta');
  assert.equal(cfgA.value.brand.name,'Alpha High');assert.equal(cfgA.value.brand.accent,'#8a1c1c');assert(cfgA.value.brand.crest.startsWith('/api/brand/crest?school=alpha'));
  assert.equal(cfgB.value.brand.name,'Beta College');assert.equal(cfgB.value.brand.crest,null,'a new school has neutral branding');assert.equal(cfgB.value.brand.accent,'');
  const img=await fetch(base+cfgA.value.brand.crest);assert.equal(img.status,200);assert.equal(img.headers.get('content-type'),'image/png');
  assert.equal((await fetch(base+'/api/brand/crest?school=beta')).status,404,'school B has no crest, and never serves A\'s');
  assert.equal((await fetch(base+'/api/brand/crest?school=nope')).status,404);
  // Only that school's administrator can change it.
  const beta1=await app('login',{school:'beta',email:'head@beta.test',password:beta.value.temporaryPassword});
  assert.equal((await app('brand-settings',{name:'Hijack'},{cookie:beta1.cookie,csrf:beta1.value.csrf})).status===200,false,'forced password change comes first');
  assert.equal((await app('config?school=alpha')).value.brand.name,'Alpha High');

  // Suspend and reopen.
  assert.equal((await owner('school-status',{code:'alpha',status:'SUSPENDED'},o)).status,200);
  assert.equal((await app('login',{school:'alpha',email:'head@alpha.test',password:'Alpha-chosen-password-1!'})).status,404,'suspended schools are closed');
  assert.equal((await app('me',null,admin)).status,401,'existing sessions stop working');
  assert.equal((await owner('school-status',{code:'alpha',status:'ACTIVE'},o)).status,200);
  assert.equal((await app('login',{school:'alpha',email:'head@alpha.test',password:'Alpha-chosen-password-1!'})).status,200,'reopened with data intact');
  assert.equal((await app('config?school=alpha')).value.brand.name,'Alpha High');

  // Reset a school admin's password: forced change, old password stops working.
  const reset=await owner('reset-admin',{code:'alpha'},o);assert.equal(reset.status,200);
  assert.equal((await app('login',{school:'alpha',email:'head@alpha.test',password:'Alpha-chosen-password-1!'})).status,401);
  const again=await app('login',{school:'alpha',email:'head@alpha.test',password:reset.value.temporaryPassword});assert.equal(again.status,200);assert.equal(again.value.user.mustChangePassword,true);

  // The owner screen is a plain page that never needs a school code.
  assert.equal((await fetch(base+'/platform')).status,200);
 }finally{server.kill();}
});
