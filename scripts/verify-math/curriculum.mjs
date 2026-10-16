import assert from 'node:assert/strict';
import {curriculum} from '../../curriculum.mjs';
import {calculate,checkAnswer} from '../../dist/domain.js';
let checked=0;
function audit(q){const {operation,args,decimals}=q.proof;const [a,b,c,d]=args;let n;
 switch(operation){
 case 'power':n=Array(b).fill(a).reduce((p,v)=>p*v,1);break;
 case 'base-decode':n=[...a].reverse().reduce((sum,digit,p)=>sum+Number(digit)*b**p,0);break;
 case 'base-encode':assert.equal(parseInt(q.answer,b),a);checked++;return;
 case 'cross-base':assert.equal(parseInt(q.answer,c),parseInt(a,b));checked++;return;
 case 'base-operation':{const value=parseInt(q.answer,c);if(d===0||d===4)assert.equal(value-b,a);if(d===1)assert.equal(value+b,a);if(d===2)assert.equal(value/b,a);if(d===3)assert.equal(value*b,a);checked++;return;}
 case 'expression':assert(/^[0-9eE+*\/().^\s-]+$/.test(a));n=Function('\"use strict\"; return ('+a.replaceAll('^','**')+')')();break;
 case 'fractional':n=Math.round(Math.exp(c/b*Math.log(a)));break;
 case 'index-solve':n=Math.round(Math.log(b)/Math.log(a))-c;break;
 case 'log':n=Math.log(a)/Math.LN10;break;
 case 'characteristic':n=Math.floor(Math.log(a)/Math.LN10);break;
 case 'mantissa':{const log=Math.log(a)/Math.LN10;n=log-Math.floor(log);break;}
 case 'antilog':n=Math.exp(a*Math.LN10);break;
 case 'root':n=b===2?Math.sqrt(a):Math.cbrt(a);break;
 case 'product':n=Array(b).fill(a).reduce((sum,v)=>sum+v,0);break;
 case 'compound':{n=a;for(let year=0;year<c;year++)n+=n*b/100;break;}
 case 'decay':{n=a;for(let year=0;year<c;year++)n-=n*b/100;break;}
 case 'linear':n=d?c/a-b:(c-b)*a;break;
 case 'inverse':n=a*b/c;break;
 case 'direct':n=a/b*c;break;
 case 'partial':n=a+Array(c).fill(b).reduce((sum,v)=>sum+v,0);break;
 case 'joint':n=a/(b*c);break;
 case 'formula':for(const y of [3,9,17])assert(Math.abs(b*calculate(q.answer,{y})+c-y)<1e-8);checked++;return;
 case 'rearrange':n=(a-b)/c;break;
 case 'perimeter':n=(a-2*b)/2;break;
 case 'last-term':n=(2*a-b*c)/c;break;
 case 'energy':n=Math.sqrt(2*a/b);break;
 case 'factor-subject':n=a/(b+1);break;
 case 'smaller-root':n=(a-Math.sqrt(a*a-4*b))/2;assert(Math.abs(n*n-a*n+b)<1e-7);break;
 case 'discriminant':n=b*b-4*a*c;break;
 case 'axis':n=-b/(2*a);break;
 case 'quadratic':n=(a*d+b)*d+c;break;
 case 'find-base':{const [c1,d1,v]=args;n=(v-d1)/c1;assert(Number.isInteger(n)&&n>Math.max(c1,d1));break;}
 case 'log-law':n=a?Math.log10(b)-Math.log10(c):Math.log10(b)+Math.log10(c);break;
 case 'interest-earned':n=a*(1+b/100)**c-a;break;
 case 'ci-minus-si':n=a*((1+b/100)**c-1)-a*b*c/100;break;
 case 'simul':{const [p1,q1,r1,p2,q2,r2,which]=args,det=p1*q2-p2*q1,x=(r1*q2-r2*q1)/det,y=(p1*r2-p2*r1)/det;assert(Math.abs(p1*x+q1*y-r1)<1e-9&&Math.abs(p2*x+q2*y-r2)<1e-9);n=which?y:x;break;}
 case 'inverse-square':n=a*b*b/(c*c);break;
 case 'lens':n=1/(1/a-1/b);break;
 case 'kinematic':n=2*(a-b*c)/(c*c);break;
 case 'sum-product':n=args[2]?-(a+b):a*b;break;
 case 'rect-width':n=(-a+Math.sqrt(a*a+4*b))/2;assert(Math.abs(n*(n+a)-b)<1e-9);break;
 default:assert.fail('Missing audit '+operation);
 }
 if(decimals!==undefined)n=Number(n.toFixed(decimals));assert(Math.abs(Number(q.answer)-n)<=(q.tolerance||1e-7),q.prompt+' => '+q.answer+' vs '+n);assert(checkAnswer(q,q.answer));checked++;
}
let lessonCount=0,itemCount=0;
for(const week of curriculum){assert.equal(week.quiz.length,20);assert.equal(week.lessons.length,5);assert.equal(new Set(week.quiz.map(q=>q.id)).size,20);for(const lesson of week.lessons){lessonCount++;itemCount+=60;assert.equal(lesson.questions.length,60);assert(lesson.example&&lesson.steps?.length===3&&lesson.explain&&lesson.discovery&&lesson.commonMistake,lesson.title+' is missing teaching content');assert.equal(lesson.questions.filter(q=>q.stage==='diagnostic').length,5);assert.equal(lesson.questions.filter(q=>q.stage==='quiz').length,10);assert(new Set(lesson.questions.map(q=>q.id)).size===60);assert.equal(new Set(lesson.questions.map(q=>q.prompt)).size,60,lesson.title+' has repeated prompts');lesson.questions.forEach(audit);audit(lesson.example);}week.quiz.forEach(audit);itemCount+=20;}
let antilogCells=0;for(let row=0;row<100;row++)for(let column=0;column<10;column++){const input=row/100+column/1000,display=Number((10**input).toFixed(3));assert(Math.abs(display-Math.exp(input*Math.LN10))<=.00051);antilogCells++;}
console.log(JSON.stringify({verifiedInstances:checked,assessmentItems:itemCount,lessons:lessonCount,subtopicItems:60,topicMasteryItems:20}));
console.log(JSON.stringify({antilogTableCells:antilogCells}));
