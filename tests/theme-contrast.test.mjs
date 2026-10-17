import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css=fs.readFileSync(new URL('../public/brand.css',import.meta.url),'utf8');
function luminance(hex){const rgb=hex.match(/[0-9a-f]{2}/gi).map(n=>Number.parseInt(n,16)/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);return rgb.reduce((sum,n,i)=>sum+n*[.2126,.7152,.0722][i],0);}
function contrast(a,b){const values=[luminance(a),luminance(b)].sort((a,b)=>b-a);return (values[0]+.05)/(values[1]+.05);}
for(const theme of [':root','body.dark'])test(`School ${theme===':root'?'light':'dark'} theme maintains readable text contrast`,()=>{
 const block=css.slice(css.indexOf(theme+' {')).split('}')[0];
 const colours=Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map(m=>[m[1],m[2]]));
 for(const background of ['paper','bg','soft'])for(const foreground of ['ink','muted','green'])assert(contrast(colours[foreground],colours[background])>=4.5,`${foreground} on ${background} must meet 4.5:1`);
 assert(contrast('#ffffff',colours.button)>=4.5,'Primary button text');
 assert(contrast('#ffffff',colours['button-hover'])>=4.5,'Hovered button text');
 assert(contrast(colours['rose-ink'],colours.rose)>=4.5,'Feedback and sign-out text');
 assert(contrast(colours.focus,colours.paper)>=3,'Keyboard focus indicator');
});
