// Create the platform owner, or give the owner a new temporary password. Run it while the app is stopped.
//   npm run reset-owner -- --email you@example.com
//   npm run reset-owner -- --email you@example.com --password "a-long-temporary-password"
// The owner console is separate from every school: its own sign-in at /platform, its own small database
// (platform.sqlite), and it can see school counts and health but never a student's records.
import {randomBytes} from 'node:crypto';
const args=process.argv.slice(2),get=n=>{const i=args.indexOf('--'+n);return i>=0?args[i+1]:undefined;};
const email=get('email')||process.env.PLATFORM_OWNER_EMAIL;
const password=get('password')||`Lab-${randomBytes(3).toString('hex')}-${randomBytes(3).toString('hex')}-${randomBytes(3).toString('hex')}`;
if(!email){console.error('Usage: npm run reset-owner -- --email you@example.com [--password <12+ characters>]');process.exit(1);}
try{
  process.env.PLATFORM_NO_AUTO='1';const {setOwner}=await import('../platform.mjs'),{dataFolder}=await import('../store.mjs');
 const done=await setOwner(email,password);
 console.log(`\nPlatform owner ${done}.\n  Email:    ${email.toLowerCase()}\n  Temporary password: ${password}\n  Owner console: http://127.0.0.1:${process.env.PORT||3000}/platform   (start the app first with npm start)\n  Data folder: ${dataFolder()}\nSign in there and choose your own password when asked.\n`);
 process.exit(0);
}catch(error){console.error('\nCould not set the owner: '+error.message+'\n');process.exit(1);}
