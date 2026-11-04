// Give a school's administrator a new temporary password. Run it while the app is stopped.
//   npm run reset-admin                        (the first school on this installation)
//   npm run reset-admin -- --school greenfield
//   npm run reset-admin -- --password "a-long-temporary-password"
// The administrator must choose their own password at the next sign-in. Nothing else changes.
import {randomBytes} from 'node:crypto';
const args=process.argv.slice(2),get=n=>{const i=args.indexOf('--'+n);return i>=0?args[i+1]:undefined;};
const store=await import('../store.mjs');
const code=(get('school')||store.DEFAULT_CODE).toLowerCase();
const password=get('password')||`Lab-${randomBytes(3).toString('hex')}-${randomBytes(3).toString('hex')}-${randomBytes(3).toString('hex')}`;
if(password.length<12){console.error('Use a temporary password of at least 12 characters.');process.exit(1);}
try{
 const email=await store.resetSchoolAdmin(code,password);
 console.log(`\nAdministrator password reset.\n  School code: ${code}\n  Email:       ${email}\n  Temporary password: ${password}\n  Data folder: ${store.dataFolder()}\nStart the app, sign in with these details, and choose a new password when asked.\n`);
 process.exit(0);
}catch(error){console.error('\nCould not reset: '+error.message+'\nCheck that you are in the app folder and that DATA_DIR (if you use one) points to the same data folder you start the app with.\n  Data folder used: '+store.dataFolder()+'\n');process.exit(1);}
