// Creates a private .env.production for a real school installation. Never commit the file it writes.
import {randomBytes} from 'node:crypto';
import fs from 'node:fs';

const args=process.argv.slice(2),get=name=>{const i=args.indexOf('--'+name);return i>=0?args[i+1]:undefined;};
const email=(get('email')||'').trim().toLowerCase();
if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){console.error('Usage: npm run setup:production -- --email admin@yourschool.example [--data-dir data-production] [--port 3000] [--host 127.0.0.1] [--insecure-http] [--force]');process.exit(1);}
const file='.env.production';
if(fs.existsSync(file)&&!args.includes('--force')){console.error(file+' already exists. Use --force to replace it (this does not delete any school data).');process.exit(1);}
const dataDir=get('data-dir')||'data-production';
if(fs.existsSync(dataDir)&&fs.readdirSync(dataDir).some(n=>n!=='.gitkeep')){console.error(`${dataDir} is not empty. Choose a new --data-dir; production needs a fresh, empty directory.`);process.exit(1);}
const password=get('password')||randomBytes(15).toString('base64url');
if(password.length<14){console.error('The administrator password must be at least 14 characters.');process.exit(1);}
const lines=[
 'NODE_ENV=production','DEMO_MODE=false','SELF_REGISTRATION=false',
 'DATA_DIR='+dataDir,'HOST='+(get('host')||'127.0.0.1'),'PORT='+(get('port')||'3000'),
 'COOKIE_SECURE='+(args.includes('--insecure-http')?'false':'true'),
 'SESSION_SECRET='+randomBytes(48).toString('base64url'),
 'ADMIN_EMAIL='+email,'ADMIN_PASSWORD='+password,'STORAGE_DRIVER=local',''
];
fs.writeFileSync(file,lines.join('\n'),{mode:0o600});
console.log(`Wrote ${file}.\n\nFirst administrator\n  Email:    ${email}\n  Password: ${password}\n\nSave this password now; it is not shown again. Start the app with: npm run build && npm run start:production\nAfter your first successful sign-in, delete the ADMIN_PASSWORD line from ${file}.`);
