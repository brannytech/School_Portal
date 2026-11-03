import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

// A performance budget for students with little data. Raise a limit only on purpose.
const LOGIN_PAGE_BUDGET=130*1024;
test('Login page stays within its data budget; repeat visits cost almost nothing',async()=>{
 const dir=path.resolve('test-results','performance-'+Date.now());fs.mkdirSync(dir,{recursive:true});
 let base='',output='';
 const server=spawn(process.execPath,['--experimental-sqlite','server.mjs'],{env:{...process.env,NODE_ENV:'production',DEMO_MODE:'false',DATABASE_URL:'',DATA_DIR:dir,PORT:'0',SESSION_SECRET:'a-test-only-secret-that-is-long-enough-for-isolated-tests',ADMIN_EMAIL:'head@main.test',ADMIN_PASSWORD:'Main-initial-password-1!'},stdio:['ignore','pipe','pipe']});
 server.stdout.on('data',b=>{output+=b;base=output.match(/ready at (http:\/\/127\.0\.0\.1:\d+)/)?.[1]||'';});server.stderr.on('data',b=>output+=b);
 try{
  for(let i=0;i<150&&!base;i++)await new Promise(r=>setTimeout(r,100));assert(base,output);
  const get=(url,headers={})=>fetch(base+url,{headers:{'Accept-Encoding':'br, gzip',...headers}});
  const html=await(await get('/')).text();
  const assets=[...html.matchAll(/(?:src|href)="(\/[^"]+\.(?:js|css))"/g)].map(m=>m[1]);assert(assets.length>5);
  const config=await(await get('/api/config')).json();
  const pictures=[config.brand.crest,config.brand.photo].filter(Boolean);
  let total=Number((await get('/')).headers.get('content-length')||0),raw=0;
  const seen={};
  for(const url of [...assets,...pictures]){
   const r=await get(url);assert.equal(r.status,200,url);const bytes=(await r.arrayBuffer()).byteLength;
   const wire=Number(r.headers.get('content-length')||bytes);total+=wire;seen[url]={wire,etag:r.headers.get('etag'),encoding:r.headers.get('content-encoding')};
   if(/\.(js|css)$/.test(url))assert(['br','gzip'].includes(r.headers.get('content-encoding')),url+' is compressed');
  }
  console.log(`      login page on the wire: ${(total/1024).toFixed(1)} KB`);
  assert(total<LOGIN_PAGE_BUDGET,`login page is ${(total/1024).toFixed(1)} KB, budget ${LOGIN_PAGE_BUDGET/1024} KB`);
  // Repeat visit: every file answers 304 with no body.
  for(const [url,info] of Object.entries(seen)){const r=await get(url,{'If-None-Match':info.etag});assert.equal(r.status,304,url+' revalidates with 304');assert.equal((await r.arrayBuffer()).byteLength,0);}
  // Pictures are cacheable for days; scripts always revalidate.
  assert(/max-age=\d{5,}/.test((await get(pictures[0])).headers.get('cache-control')||''),'the crest is cached');
  assert.equal((await get(assets.find(a=>a.endsWith('.js')))).headers.get('cache-control'),'no-cache');
 }finally{server.kill();}
});
