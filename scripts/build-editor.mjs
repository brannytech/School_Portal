import fs from 'node:fs';
import path from 'node:path';
import {build} from 'esbuild';
const target='public/vendor';fs.mkdirSync(target,{recursive:true});
const result=await build({entryPoints:{'studio-editor':'client/studio-editor.js','lesson-editor':'client/lesson-editor.js','math-render':'client/math-render.js','math-input':'client/math-input.js'},outdir:target,bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,legalComments:'eof',logLevel:'warning',metafile:true});
fs.copyFileSync('node_modules/katex/dist/katex.min.css',path.join(target,'katex.min.css'));
fs.cpSync('node_modules/katex/dist/fonts',path.join(target,'fonts'),{recursive:true});
fs.cpSync('node_modules/mathlive/fonts',path.join(target,'mathlive-fonts'),{recursive:true});
const packages=new Set(['esbuild']);for(const file of Object.keys(result.metafile.inputs)){if(!file.includes('node_modules/'))continue;const parts=file.split('node_modules/').at(-1).split('/');packages.add(parts[0].startsWith('@')?parts.slice(0,2).join('/'):parts[0]);}
const licenses={};for(const name of [...packages].sort()){const data=JSON.parse(fs.readFileSync('node_modules/'+name+'/package.json'));licenses[name]={version:data.version,license:data.license};const file=['LICENSE','LICENSE.txt','LICENSE.md'].find(file=>fs.existsSync('node_modules/'+name+'/'+file));if(file)fs.copyFileSync('node_modules/'+name+'/'+file,path.join(target,name.replaceAll('/','-')+'-LICENSE.txt'));}
fs.writeFileSync(path.join(target,'DEPENDENCIES.json'),JSON.stringify(licenses,null,2));
console.log('Built local editor/math bundles, styles, fonts and license notices.');
