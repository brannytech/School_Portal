import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
for(const file of ['server.mjs','store.mjs','database.mjs','lms-api.mjs','curriculum.mjs','storage.mjs','public/app.js','public/upgrade.js']){
 const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(result.status!==0){console.error(result.stderr);process.exit(1);}
}
for(const file of ['public/index.html','public/style.css','public/manifest.webmanifest','dist/domain.js','migrations/001_relational.sql'])if(!fs.existsSync(file))throw Error('Missing build output '+file);
console.log('Strict TypeScript core and application syntax build passed.');
