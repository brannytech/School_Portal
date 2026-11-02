import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

// Object storage keys must differ per school, so one school's file can never be addressed through another.
test('Each school stores files under its own prefix and folder',()=>{
 const dir=path.resolve('test-results','prefix-'+Date.now());fs.mkdirSync(dir,{recursive:true});
 const script=`
  const {createSchool,findSchool,storagePrefix,tenantDir,DEFAULT_CODE}=await import('./store.mjs');
  const {requestScope}=await import('./context.mjs');
  await createSchool({code:'beta',name:'Beta',adminEmail:'h@beta.test',adminPassword:'Beta-initial-password-1!'});
  const inSchool=(code,fn)=>requestScope.run({tenant:findSchool(code)},fn);
  console.log(JSON.stringify({main:inSchool(DEFAULT_CODE,()=>[storagePrefix(),tenantDir()]),beta:inSchool('beta',()=>[storagePrefix(),tenantDir()])}));
  process.exit(0);`;
 const r=spawnSync(process.execPath,['--experimental-sqlite','--no-warnings','--input-type=module','-e',script],{env:{...process.env,DATA_DIR:dir,DATABASE_URL:'',ADMIN_EMAIL:'h@main.test',ADMIN_PASSWORD:'Main-initial-password-1!'},encoding:'utf8'});
 assert.equal(r.status,0,r.stderr);const v=JSON.parse(r.stdout.trim().split('\n').pop());
 assert.equal(v.main[0],'private/');assert.equal(v.beta[0],'schools/beta/private/');
 assert.equal(v.main[1],dir);assert.equal(v.beta[1],path.join(dir,'schools','beta'));
});
