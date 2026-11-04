// Turn a finished course in one school into a shared library item (a JSON file in library/).
//   npm run library-export -- --code main --class SS1 --subject Mathematics --term 1 --id ss1-mathematics-term1 --title "SS1 Mathematics, First Term" [--weeks 1,2,3] [--out library]
// Run with the app stopped. Weeks that use pictures uploaded to that school are left out (the pictures belong to the school).
// If the item already exists its version number goes up by one, so schools see "newer version available".
import fs from 'node:fs';
import path from 'node:path';
const args=process.argv.slice(2),get=n=>{const i=args.indexOf('--'+n);return i>=0?args[i+1]:undefined;};
const [code,c,s,term,id,title]=['code','class','subject','term','id','title'].map(get);
if(!code||!c||!s||!term||!id||!title||!/^[a-z0-9-]{3,80}$/.test(id)){console.error('Usage: npm run library-export -- --code <school> --class <class> --subject <subject> --term <1|2|3> --id <lowercase-id> --title "<title>" [--weeks 1,2,3] [--out library]');process.exit(1);}
const {findSchool}=await import('../store.mjs');
const school=findSchool(code);if(!school){console.error('That school is not active on this installation.');process.exit(1);}
const db=school.db,sid=db.currentSessionId,key=`${sid}|${c}:${s}:${term}`,course=db.courses?.[key];
if(!course?.length){console.error(`No weeks found for ${c} ${s} term ${term} in the current session of ${code}.`);process.exit(1);}
const wanted=get('weeks')?get('weeks').split(',').map(Number):course.map(w=>w.id);
const fileIds=(db.files||[]).map(f=>f.id);
const weeks=[],left=[];
for(const w of course.filter(w=>wanted.includes(w.id))){const text=JSON.stringify(w);if(fileIds.some(f=>text.includes(f)))left.push(w.id);else weeks.push(structuredClone(w));}
if(!weeks.length){console.error('No shareable weeks. '+(left.length?`Weeks ${left.join(', ')} use pictures uploaded to this school.`:''));process.exit(1);}
const out=path.resolve(get('out')||'library');fs.mkdirSync(out,{recursive:true});
const file=path.join(out,id+'.json');let version=1;
if(fs.existsSync(file)){try{version=(JSON.parse(fs.readFileSync(file,'utf8')).version||1)+1;}catch{}}
fs.writeFileSync(file,JSON.stringify({id,title,class:c,subject:s,term:Number(term),version,weeks},null,1));
console.log(`Wrote ${file}: ${weeks.length} weeks, version ${version}.${left.length?` Left out (school pictures): weeks ${left.join(', ')}.`:''}\nCommit the file to share it with every school after the next deployment.`);
process.exit(0);
