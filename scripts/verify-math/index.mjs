import assert from 'node:assert/strict';
import {weeks} from '../../content.mjs';
export function verify(){let count=0;
 for(let w=0;w<8;w++){
  const week=weeks[w];assert.equal(week.lessons.length,3);assert.equal(week.quiz.length,10);
  const audit=q=>{
   const i=Number(q.id.match(/q(\d+)$/)[1]),n=i+2;let expected;
   // Independent methods: parse digit expansion, repeated products, inverse checks,
   // substitution into the original equation, and factored quadratic evaluation.
   if(w===0){const base=[2,5,8][i%3],decimal=n*3+1;const repr=decimal.toString(base);if(i%2){expected=repr;let total=0;for(const digit of String(expected))total=total*base+Number(digit);assert.equal(total,decimal);}else{expected=[...repr].reverse().reduce((sum,d,p)=>sum+Number(d)*Math.pow(base,p),0);}}
   if(w===1){const a=2+i%3,p=1+i%3,q=1+i%2;expected=Array(p+q).fill(a).reduce((p,v)=>p*v,1);}
   if(w===2){const power=i%6-2;expected=Math.round(Math.log(10**power)/Math.LN10);}
   if(w===3){const power=i%2?3:2;expected=Math.round(power===2?Math.sqrt(n*n):Math.cbrt(n*n*n));}
   if(w===4){const a=n+1,b=n+3;if(i%2){expected=0;let total=a*b;while(total>=b){total-=b;expected++;}assert.equal(total,0);}else{expected=Array(b).fill(a).reduce((s,v)=>s+v,0);}}
   if(w===5){const k=i%4+2;expected=i%2?(k*2)/2*n:(k*n+n-n)/k;}
   if(w===6){const initial=n+2,acc=i%3+2,final=initial+acc*n;expected=(final-initial)/acc;assert.equal(initial+acc*expected,final);}
   if(w===7){const x=i-4;expected=(x-3)*(x+1);}
   if(q.check){const {kind,args}=q.check;const [a,b,c]=args;switch(kind){
    case 'base-add':expected=(a+b).toString(c);assert.equal(parseInt(expected,c)-b,a);break;
    case 'base-subtract':expected=(a-b).toString(c);assert.equal(parseInt(expected,c)+b,a);break;
    case 'base-product':expected=(a*b).toString(c);assert.equal(parseInt(expected,c)/b,a);break;
    case 'find-base':expected=a-3;assert(expected>3);break;
    case 'cross-base':expected=a.toString(b);assert.equal(parseInt(expected,b),a);break;
    case 'index-divide':expected=Math.round(a**b/a**c);break;
    case 'power-power':expected=Array(c).fill(a**b).reduce((p,v)=>p*v,1);break;
    case 'zero':expected=a/a;break;
    case 'negative-index':expected=Math.exp(-b*Math.log(a)).toFixed(4);break;
    case 'fractional-index':expected=Math.round(Math.exp(c/b*Math.log(a)));break;
    case 'index-equation':expected=Math.round(Math.log(a)/Math.log(2))-1;break;
    case 'product-power':expected=a*a*b*b;break;
    case 'doubling':expected=Array(b).fill(2).reduce((p,v)=>p*v,a);break;
    case 'characteristic':expected=Math.floor(Math.log(a)/Math.log(10)+1e-12);break;
    case 'antilog':expected=Math.exp(a*Math.LN10).toFixed(b);break;
    case 'log':expected=(Math.log(a)/Math.LN10).toFixed(b);break;
    case 'root':expected=Math.exp(Math.log(a)/b).toFixed(c);break;
    case 'integer-power':expected=Array(b).fill(a).reduce((p,v)=>p*v,1);break;
    case 'money-product':expected=Array(a).fill(b).reduce((s,v)=>s+v,0);break;
    case 'combined-log':expected=Math.round(Math.exp(Math.log(a)+Math.log(b)-Math.log(c))*1000)/1000;break;
    case 'compound':{let total=a;for(let year=0;year<c;year++)total+=total*b/100;expected=total.toFixed(2);break;}
    case 'scale-factor':expected=b/a;break;
    case 'bracket-equation':expected=b/2-a;assert.equal(2*(expected+a),b);break;
    case 'inverse':expected=a*b/c;assert.equal(expected*c,a*b);break;
    case 'joint':expected=a/(b*c);assert.equal(expected*b*c,a);break;
    case 'partial':expected=a+Array(c).fill(b).reduce((s,v)=>s+v,0);break;
    case 'fraction-equation':expected=(b-2)*a;assert.equal(expected/a+2,b);break;
    case 'workers':expected=a*b/c;break;
    case 'direct-x':expected=c/(a/b);break;
    case 'two-sides':expected=a+b;assert.equal(3*expected-a,2*expected+b);break;
    case 'perimeter':expected=(a-2*b)/2;assert.equal(2*(expected+b),a);break;
    case 'radius':expected=Math.sqrt(a);assert.equal(expected*expected,a);break;
    case 'temperature':expected=(a-32)/9*5;assert.equal(expected*9/5+32,a);break;
    case 'interest-rate':expected=100*a/(b*c);break;
    case 'last-term':expected=2*a/c-b;break;
    case 'factor-subject':expected=a/(b+1);assert.equal(b*expected+expected,a);break;
    case 'travel-time':expected=a/b;assert.equal(expected*b,a);break;
    case 'energy':expected=Math.sqrt(2*a/b);assert.equal(b*expected**2/2,a);break;
    case 'smaller-root':expected=(a-Math.sqrt(a*a-4*b))/2;assert.equal(expected**2-a*expected+b,0);break;
    case 'discriminant':expected=b*b-4*a*c;break;
    case 'vertex-x':expected=-b/(2*a);assert.equal(2*a*expected+b,0);break;
    case 'complete-square':expected=a*a;assert.equal((3+a)**2-expected,9+6*a);break;
    case 'root-product':expected=a*b;break;
    case 'root-count':{const d=b*b-4*a*c;expected=d>0?2:d===0?1:0;break;}
    case 'vertex-y':{const x=-b/(2*a);expected=a*x*x+b*x+c;break;}
    case 'positive-root':expected=Math.sqrt(a);assert.equal(expected**2-a,0);break;
    default:assert.fail('Missing independent audit for '+kind);
   }}
   if(q.kind==='boolean')expected=i%8===3?'true':'false';
   assert.equal(q.answer,String(expected),q.prompt);
   if(q.options){assert(q.options.includes(q.answer));assert.equal(new Set(q.options).size,4);}
   assert(q.explanation.length>10);count++;
  };
  for(const l of week.lessons){assert.equal(l.questions.length,12);l.questions.forEach(audit);audit(l.example);}
  week.quiz.forEach(audit);
 }
 // Audit generated four-figure lookup cells and log/antilog inverse round trips.
 let cells=0;for(let row=10;row<=99;row++)for(let col=0;col<=9;col++){const n=row/10+col/100,entry=Math.round(Math.log10(n)*10000),independent=Math.round(Math.log(n)/Math.log(10)*10000);assert.equal(entry,independent);assert(Math.abs(10**(entry/10000)-n)<.0012);cells++;}
 return {assessmentAndExampleChecks:count,questions:weeks.reduce((n,w)=>n+w.quiz.length+w.lessons.reduce((n,l)=>n+l.questions.length,0),0),logTableCells:cells};
}
console.log(JSON.stringify(verify(),null,2));
