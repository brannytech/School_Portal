// Create a new school (its own database and uploads folder) on this installation.
// Run it while the app is stopped (or use the platform screen when it exists), then start the app.
//   npm run create-school -- --code greenfield --name "Greenfield College" --admin-email head@greenfield.example
// A temporary password is generated and printed once; the administrator must change it at first sign-in.
import {randomBytes} from 'node:crypto';
const args=process.argv.slice(2),get=n=>{const i=args.indexOf('--'+n);return i>=0?args[i+1]:undefined;};
const code=get('code'),name=get('name')||code,email=get('admin-email'),password=get('password')||`Lab-${randomBytes(3).toString('hex')}-${randomBytes(3).toString('hex')}-${randomBytes(3).toString('hex')}`;
if(!code||!email){console.error('Usage: npm run create-school -- --code <short-code> --name "<School name>" --admin-email <email> [--password <temporary password>]');process.exit(1);}
const {createSchool,rootDir}=await import('../store.mjs');
try{
 await createSchool({code,name,adminEmail:email,adminPassword:password});
 console.log(`\nSchool created.\n  School code: ${code}\n  Name:        ${name}\n  Admin email: ${email}\n  Temporary password: ${password}\n  Data folder: ${rootDir}${code==='main'?'':'/schools/'+code}\nGive the school code and the temporary password to the administrator. They must change the password at first sign-in.\nRestart the app so it picks up the new school.\n`);
 process.exit(0);
}catch(e){console.error(e.message);process.exit(1);}
