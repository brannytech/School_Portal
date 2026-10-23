// Shared bounded mathematical definitions. No source is evaluated as JavaScript.
const fail=message=>{throw Object.assign(new Error('Mathematics: '+message),{status:400});};
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
function shape(v,keys){if(!plain(v)||Object.keys(v).some(k=>!keys.includes(k)))fail('unsupported definition or field.');}
function finite(v,min=-1e6,max=1e6){if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)fail('use a finite number from '+min+' to '+max+'.');return v;}
function string(v,max=200){if(typeof v!=='string'||v.length>max)fail('text exceeds its limit.');return v;}
export const graphKinds=['linear','quadratic','cubic','reciprocal','exponential','logarithmic','trigonometric','simultaneous','linear-inequality','quadratic-inequality','points','table','bar','histogram','pie'];
export const toolKinds=['matrix','geometry','bases','indices','variation','formula','calculator'];
const functions=Object.freeze({sqrt:Math.sqrt,log:Math.log10,ln:Math.log,exp:Math.exp,abs:Math.abs,sin:Math.sin,cos:Math.cos,tan:x=>Math.abs(Math.cos(x))<1e-12?NaN:Math.tan(x)});
export function compileExpression(input,variables=['x','a','b','c','k'],angle='radians'){
 const source=string(input,240).replace(/²/g,'^2').replace(/³/g,'^3').replace(/π/g,'pi').replace(/[−–]/g,'-').replace(/×/g,'*').replace(/÷/g,'/').replace(/\s+/g,'').toLowerCase();
 const raw=source.match(/(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|[a-z]+|[()+\-*/^!]/g)||[];
 if(!source||raw.join('')!==source||raw.length>120)fail('use numbers, x, parameters, + − × ÷ ^ and supported functions.');
 const names=new Set(variables),tokens=[];
 for(const token of raw){const p=tokens.at(-1),end=p&&(p===')'||p==='!'||/^[\d.]/.test(p)||names.has(p)||['pi','e'].includes(p)),start=token==='('||/^[\d.a-z]/.test(token);if(end&&start)tokens.push('*');tokens.push(token);}
 let i=0,depth=0;
 function atom(){if(++depth>24)fail('expression is nested too deeply.');const t=tokens[i++];let n;
  if(t==='+'||t==='-')n={op:t==='-'?'neg':'pos',args:[expression(3)]};
  else if(t==='('){n=expression(0);if(tokens[i++]!==')')fail('close the bracket.');}
  else if(Object.hasOwn(functions,t)){if(tokens[i++]!=='(')fail('use brackets after '+t+'.');n={op:t,args:[expression(0)]};if(tokens[i++]!==')')fail('close the function bracket.');}
  else if(t==='pi'||t==='e')n={number:t==='pi'?Math.PI:Math.E};
  else if(names.has(t))n={variable:t};
  else if(/^(?:\d|\.)/.test(t||''))n={number:finite(Number(t),-1e100,1e100)};
  else fail('unknown variable or incomplete expression.');
  while(tokens[i]==='!'){i++;n={op:'factorial',args:[n]};}depth--;return n;
 }
 function expression(min){let left=atom();while(i<tokens.length){const op=tokens[i],p={'+':1,'-':1,'*':2,'/':2,'^':3}[op]||0;if(!p||p<min)break;i++;left={op,args:[left,expression(p+(op==='^'?0:1))]};}return left;}
 const tree=expression(0);if(i!==tokens.length)fail('unexpected expression token.');
 function run(n,values){if(Object.hasOwn(n,'number'))return n.number;if(n.variable){if(!Object.hasOwn(values,n.variable))fail('missing parameter '+n.variable+'.');return finite(values[n.variable],-1e100,1e100);}const a=run(n.args[0],values),b=n.args[1]?run(n.args[1],values):0;switch(n.op){case '+':return a+b;case '-':return a-b;case '*':return a*b;case '/':return a/b;case '^':return a**b;case 'neg':return -a;case 'pos':return a;case 'factorial':{if(!Number.isInteger(a)||a<0||a>170)return NaN;let r=1;for(let j=2;j<=a;j++)r*=j;return r;}default:return functions[n.op](['sin','cos','tan'].includes(n.op)&&angle==='degrees'?a*Math.PI/180:a);}}
 return values=>{const v=run(tree,values||{});if(!Number.isFinite(v)||Math.abs(v)>1e100)fail('expression is undefined or outside the numeric range.');return v;};
}
export function defaultGraph(kind='quadratic'){
 const expressions={linear:['a*x+b'],quadratic:['a*x^2+b*x+c'],cubic:['a*x^3+b*x+c'],reciprocal:['a/(x-b)+c'],exponential:['a*exp(b*x)+c'],logarithmic:['a*ln(x-b)+c'],trigonometric:['a*sin(b*x)+c'],simultaneous:['a*x+b','-x+c'],'linear-inequality':['a*x+b'],'quadratic-inequality':['a*x^2+b*x+c']};
 return {kind,title:kind==='quadratic'?'Quadratic explorer':kind.replaceAll('-',' ')+' explorer',expressions:(expressions[kind]||[]).map(expression=>({expression,relation:kind.endsWith('inequality')?'>=':'='})),viewport:{xMin:-4,xMax:6,yMin:-6,yMax:10},parameters:['a','b','c'].map((name,i)=>({name,value:[1,-2,-3][i],min:-10,max:10,step:.1,enabled:kind==='quadratic'})),features:{grid:true,axes:true,roots:true,vertex:true,table:true},angle:'radians',points:[[-2,5],[-1,0],[0,-3],[1,-4],[2,-3],[3,0],[4,5]],data:kind==='histogram'?[{label:'0–2',value:4,from:0,to:2},{label:'2–5',value:6,from:2,to:5}]:[{label:'A',value:3},{label:'B',value:5},{label:'C',value:2}],exercise:null};
}
export function validateGraph(input){
 shape(input,['kind','title','expressions','viewport','parameters','features','angle','points','data','exercise']);if(!graphKinds.includes(input.kind))fail('unsupported graph kind.');string(input.title,160);
 shape(input.viewport,['xMin','xMax','yMin','yMax']);const v=input.viewport;for(const key of ['xMin','xMax','yMin','yMax'])finite(v[key]);if(!(v.xMax-v.xMin>=.001&&v.yMax-v.yMin>=.001))fail('axis maximum must exceed minimum by at least 0.001.');
 if(!Array.isArray(input.parameters)||input.parameters.length>4)fail('use at most four parameters.');const names=new Set();for(const p of input.parameters){shape(p,['name','value','min','max','step','enabled']);if(!['a','b','c','k'].includes(p.name)||names.has(p.name))fail('parameter names must be unique a, b, c or k.');names.add(p.name);finite(p.min,-1000,1000);finite(p.max,-1000,1000);finite(p.value,p.min,p.max);finite(p.step,.001,100);if(p.max<=p.min||(p.max-p.min)/p.step>20000||typeof p.enabled!=='boolean')fail('invalid slider range.');}
 if(!['radians','degrees'].includes(input.angle))fail('choose degrees or radians.');
 if(!Array.isArray(input.expressions)||input.expressions.length>3)fail('use at most three expressions.');for(const e of input.expressions){shape(e,['expression','relation']);if(!['=','>','>=','<','<='].includes(e.relation))fail('invalid inequality.');compileExpression(e.expression,['x',...names],input.angle);}
 const dataOnly=['points','table','bar','histogram','pie'].includes(input.kind);if(!dataOnly&&!input.expressions.length)fail('enter a graph expression.');
 shape(input.features,['grid','axes','roots','vertex','table']);for(const name of ['grid','axes','roots','vertex','table'])if(typeof input.features[name]!=='boolean')fail('invalid graph toggle.');
 if(!Array.isArray(input.points)||input.points.length>80)fail('use at most 80 points.');input.points.forEach(p=>{if(!Array.isArray(p)||p.length!==2)fail('points need x and y.');p.forEach(n=>finite(n));});
 if(!Array.isArray(input.data)||input.data.length>40)fail('use at most 40 chart entries.');let previous=-Infinity;for(const d of input.data){shape(d,input.kind==='histogram'?['label','value','from','to']:['label','value']);string(d.label,80);finite(d.value,0);if(input.kind==='histogram'){finite(d.from);finite(d.to);if(d.to<=d.from||d.from<previous||!Number.isFinite(d.value/(d.to-d.from)))fail('histogram bins must be ordered, nonoverlapping intervals.');previous=d.to;}}
 if(['bar','histogram','pie'].includes(input.kind)&&(!input.data.length||!input.data.some(d=>d.value>0)))fail('charts need positive data.');
 if(input.exercise!==null){shape(input.exercise,['xs','tolerance']);if(dataOnly||input.expressions.length!==1||input.expressions[0].relation!=='=')fail('graph exercises require one function.');if(!Array.isArray(input.exercise.xs)||!input.exercise.xs.length||input.exercise.xs.length>15)fail('use 1–15 exercise x values.');input.exercise.xs.forEach(n=>finite(n,v.xMin,v.xMax));finite(input.exercise.tolerance,.001,1);for(const x of input.exercise.xs)compileExpression(input.expressions[0].expression,['x',...names],input.angle)({...parameterValues(input),x});}
 return structuredClone(input);
}
export const parameterValues=g=>Object.fromEntries(g.parameters.map(p=>[p.name,p.value]));
export function graphFunctions(g,values=parameterValues(g)){return g.expressions.map(e=>{const fn=compileExpression(e.expression,['x',...g.parameters.map(p=>p.name)],g.angle);return x=>{try{return fn({...values,x});}catch{return NaN;}};});}
export function sampleSegments(fn,viewport,count=600){
 const {xMin,xMax,yMin,yMax}=viewport,segments=[];let segment=[],last;const span=yMax-yMin;
 for(let i=0;i<=count;i++){const x=xMin+(xMax-xMin)*i/count,y=fn(x),mid=last?fn((x+last[0])/2):y;const ok=Number.isFinite(y)&&y>=yMin&&y<=yMax&&Number.isFinite(mid)&&(!last||Math.abs(y-last[1])<span*.5&&Math.abs(mid-(y+last[1])/2)<span*.04);
  if(!ok){if(segment.length>1)segments.push(segment);segment=[];}if(Number.isFinite(y)&&y>=yMin&&y<=yMax)segment.push([x,y]);last=Number.isFinite(y)?[x,y]:null;
 }if(segment.length>1)segments.push(segment);return segments;
}
export function quadraticFeatures(a,b,c){
 [a,b,c].forEach(n=>finite(n));if(a===0)return b===0?{roots:[],constant:c,allRoots:c===0,yIntercept:c}:{roots:[-c/b],linear:true,yIntercept:c};
 const discriminant=b*b-4*a*c,x=-b/(2*a);let roots=[];if(discriminant===0)roots=[x];else if(discriminant>0){const q=-.5*(b+(b>=0?1:-1)*Math.sqrt(discriminant));roots=[q/a,c/q].sort((p,q)=>p-q);}
 return {roots,discriminant,vertex:[x,a*x*x+b*x+c],axis:x,yIntercept:c,opens:a>0?'upward':'downward'};
}
// Polynomial recognition uses bounded algebra, not fitting sampled function values.
export function polynomialCoefficients(source,values){
 const s=source.replace(/²/g,'^2').replace(/³/g,'^3').replace(/[−–]/g,'-').replace(/×/g,'*').replace(/÷/g,'/').replace(/\s+/g,'').toLowerCase(),raw=s.match(/(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|[a-z]+|[()+\-*/^]/g)||[];if(raw.join('')!==s)return null;const tokens=[];for(const t of raw){const p=tokens.at(-1),end=p&&(p===')'||/^[\d.]/.test(p)||p==='x'||Object.hasOwn(values,p)),start=t==='('||/^[\d.a-z]/.test(t);if(end&&start)tokens.push('*');tokens.push(t);}let i=0;
 const add=(a,b,sign=1)=>Array.from({length:Math.max(a.length,b.length)},(_,j)=>(a[j]||0)+sign*(b[j]||0));
 const mul=(a,b)=>{if(a.length+b.length>5)throw Error();const r=Array(a.length+b.length-1).fill(0);a.forEach((x,j)=>b.forEach((y,k)=>r[j+k]+=x*y));return r;};
 function atom(){const t=tokens[i++];if(t==='-')return expr(3).map(x=>-x);if(t==='+')return expr(3);if(t==='('){const r=expr(0);if(tokens[i++]!==')')throw Error();return r;}if(t==='x')return [0,1];if(Object.hasOwn(values,t))return [values[t]];if(/^[\d.]/.test(t||''))return [Number(t)];throw Error();}
 function expr(min){let a=atom();while(i<tokens.length){const t=tokens[i],p={'+':1,'-':1,'*':2,'/':2,'^':3}[t]||0;if(!p||p<min)break;i++;const b=expr(p+(t==='^'?0:1));if(t==='+')a=add(a,b);if(t==='-')a=add(a,b,-1);if(t==='*')a=mul(a,b);if(t==='/'){if(b.length!==1||b[0]===0)throw Error();a=a.map(x=>x/b[0]);}if(t==='^'){if(b.length!==1||!Number.isInteger(b[0])||b[0]<0||b[0]>2)throw Error();let r=[1];for(let j=0;j<b[0];j++)r=mul(r,a);a=r;}}return a;}
 try{const p=expr(0);while(p.length>1&&p.at(-1)===0)p.pop();return i===tokens.length&&p.length<=3&&p.every(Number.isFinite)?[p[2]||0,p[1]||0,p[0]||0]:null;}catch{return null;}
}
export function graphFeatures(g,values=parameterValues(g)){const p=g.expressions[0]&&polynomialCoefficients(g.expressions[0].expression,values);return p?quadraticFeatures(...p):null;}
export function checkGraphExercise(g,responses){const fn=graphFunctions(g)[0],t=g.exercise.tolerance;return g.exercise.xs.map((x,i)=>{const expected=fn(x),r=responses[i]||{},table=typeof r.table==='number'&&Number.isFinite(r.table)&&Math.abs(r.table-expected)<=t,point=Array.isArray(r.point)&&r.point.length===2&&r.point.every(Number.isFinite)&&Math.hypot(r.point[0]-x,r.point[1]-expected)<=t;return {x,expected,table,point};});}
export function validateMatrix(a){if(!Array.isArray(a)||!a.length||a.length>3||!Array.isArray(a[0])||!a[0].length||a[0].length>3||a.some(r=>!Array.isArray(r)||r.length!==a[0].length))fail('use a rectangular matrix from 1×1 to 3×3.');a.flat().forEach(n=>finite(n));return a;}
export function determinant(a){validateMatrix(a);if(a.length!==a[0].length)fail('determinants need a square matrix.');if(a.length===1)return a[0][0];return a[0].reduce((s,v,j)=>s+(-1)**j*v*determinant(a.slice(1).map(r=>r.filter((_,k)=>k!==j))),0);}
export function matrixOperation(op,a,b,scalar=1){validateMatrix(a);const steps=[];let result;
 if(['add','subtract','multiply','cramer'].includes(op))validateMatrix(b);
 if(['add','subtract'].includes(op)){if(a.length!==b.length||a[0].length!==b[0].length)fail('addition/subtraction need matching dimensions.');result=a.map((r,i)=>r.map((v,j)=>op==='add'?v+b[i][j]:v-b[i][j]));steps.push('Combine corresponding entries.');}
 else if(op==='scalar'){finite(scalar);result=a.map(r=>r.map(v=>v*scalar));steps.push('Multiply every entry by '+scalar+'.');}
 else if(op==='transpose'){result=a[0].map((_,j)=>a.map(r=>r[j]));steps.push('Exchange rows and columns.');}
 else if(op==='multiply'){if(a[0].length!==b.length)fail('A columns must equal B rows.');result=a.map((r,i)=>b[0].map((_,j)=>{const products=r.map((v,k)=>v*b[k][j]);steps.push(`Entry ${i+1},${j+1}: ${products.join(' + ')}`);return products.reduce((s,v)=>s+v,0);}));}
 else if(['determinant','inverse','cramer'].includes(op)){const d=determinant(a);steps.push('Expand determinant along the first row: det(A) = '+d+'.');if(op==='determinant')result=d;else{if(d===0||Math.abs(d)<Number.EPSILON*100*Math.max(...a.flat().map(Math.abs))**a.length)fail('matrix is singular or too ill-conditioned for a reliable inverse.');if(op==='cramer'){if(b.length!==a.length||b[0].length!==1)fail('Cramer needs a column vector B.');result=a[0].map((_,j)=>{const dj=determinant(a.map((r,i)=>r.map((v,k)=>k===j?b[i][0]:v)));steps.push(`x${j+1} = det(A${j+1}) / det(A) = ${dj} / ${d}`);return [dj/d];});}else{result=a.map((_,i)=>a.map((__,j)=>a.length===1?1/d:(-1)**(i+j)*determinant(a.filter((_,r)=>r!==j).map(r=>r.filter((_,c)=>c!==i)))/d));steps.push('Transpose the cofactor matrix and divide every entry by det(A).');}}}
 else fail('unsupported matrix operation.');if(!(Array.isArray(result)?result.flat():[result]).every(Number.isFinite))fail('matrix result is outside numeric range.');return {result,steps};
}
export function geometryMeasures(points,kind='polygon'){
 const lengths=points.map((p,i)=>Math.hypot(p[0]-points[(i+1)%points.length][0],p[1]-points[(i+1)%points.length][1]));
 const area=Math.abs(points.reduce((s,p,i)=>s+p[0]*points[(i+1)%points.length][1]-p[1]*points[(i+1)%points.length][0],0))/2;
 const p=points[0],q=points[1],r=points[2];let angle=null;if(r){const u=[p[0]-q[0],p[1]-q[1]],v=[r[0]-q[0],r[1]-q[1]],d=Math.hypot(...u)*Math.hypot(...v);if(d)angle=Math.acos(Math.max(-1,Math.min(1,(u[0]*v[0]+u[1]*v[1])/d)))*180/Math.PI;}
 return {lengths,area:kind==='circle'?Math.PI*lengths[0]**2:area,angle,radius:kind==='circle'?lengths[0]:null,midpoint:[(p[0]+q[0])/2,(p[1]+q[1])/2]};
}
export function transformPoints(points,{dx=0,dy=0,rotation=0,reflect=false}={}){const t=rotation*Math.PI/180;return points.map(([x,y])=>{if(reflect)x=-x;return [x*Math.cos(t)-y*Math.sin(t)+dx,x*Math.sin(t)+y*Math.cos(t)+dy];});}
export function defaultTool(tool='matrix'){const settings={matrix:{a:[[2,1],[3,4]],b:[[1,0],[0,1]],operation:'inverse',scalar:2},geometry:{kind:'triangle',points:[[0,0],[4,0],[0,3]],viewport:{xMin:-6,xMax:6,yMin:-6,yMax:6}},bases:{number:'1101',from:2,to:10},indices:{base:2,p:3,q:4},variation:{mode:'direct',k:3,x:2,z:4},formula:{v:20,u:5,a:3},calculator:{expression:'sqrt(16)+2^3',angle:'radians'}};return {tool,settings:structuredClone(settings[tool])};}
export function validateTool(input){shape(input,['tool','settings']);if(!toolKinds.includes(input.tool))fail('unsupported toolkit.');const s=input.settings;
 if(input.tool==='matrix'){shape(s,['a','b','operation','scalar']);validateMatrix(s.a);validateMatrix(s.b);finite(s.scalar);if(!['add','subtract','scalar','multiply','transpose','determinant','inverse','cramer'].includes(s.operation))fail('invalid matrix operation.');}
 if(input.tool==='geometry'){shape(s,['kind','points','viewport']);if(!['line','angle','triangle','circle','polygon'].includes(s.kind))fail('unsupported geometry primitive.');if(!Array.isArray(s.points)||s.points.length<2||s.points.length>8||(s.kind==='polygon'&&s.points.length<3)||(['angle','triangle'].includes(s.kind)&&s.points.length!==3)||(['line','circle'].includes(s.kind)&&s.points.length!==2))fail('invalid geometry point count.');s.points.forEach(p=>{if(!Array.isArray(p)||p.length!==2)fail('geometry points need x,y.');p.forEach(n=>finite(n,-1000,1000));});shape(s.viewport,['xMin','xMax','yMin','yMax']);for(const key of ['xMin','xMax','yMin','yMax'])finite(s.viewport[key],-1000,1000);if(s.viewport.xMax-s.viewport.xMin<.1||s.viewport.yMax-s.viewport.yMin<.1)fail('invalid geometry viewport.');}
 if(input.tool==='bases'){shape(s,['number','from','to']);string(s.number,40);for(const b of [s.from,s.to])if(!Number.isInteger(b)||b<2||b>16)fail('bases must be integers 2–16.');convertBase(s.number,s.from,s.to);}
 if(input.tool==='indices'){shape(s,['base','p','q']);for(const key of ['base','p','q'])finite(s[key],-1000,1000);}
 if(input.tool==='variation'){shape(s,['mode','k','x','z']);if(!['direct','inverse','joint'].includes(s.mode))fail('invalid variation mode.');[s.k,s.x,s.z].forEach(n=>finite(n));}
 if(input.tool==='formula'){shape(s,['v','u','a']);for(const key of ['v','u','a'])finite(s[key]);}
 if(input.tool==='calculator'){shape(s,['expression','angle']);if(!['radians','degrees'].includes(s.angle))fail('invalid angle unit.');compileExpression(s.expression,[],s.angle);}
 return structuredClone(input);
}
export function convertBase(source,from,to){if(!Number.isInteger(from)||!Number.isInteger(to)||from<2||from>16||to<2||to>16)fail('bases must be 2–16.');string(source,40);const digits=source.toUpperCase(),negative=digits.startsWith('-'),body=negative?digits.slice(1):digits;if(!body||!/^[0-9A-F]+$/.test(body))fail('enter a whole number with valid digits.');let value=0n;const terms=[];for(const [i,c]of [...body].entries()){const n=parseInt(c,16);if(n>=from)fail('digit '+c+' is invalid in base '+from+'.');value=value*BigInt(from)+BigInt(n);terms.push(`${n}(${from}^${body.length-i-1})`);}if(negative)value=-value;return {result:value.toString(to).toUpperCase(),decimal:value.toString(),expanded:(negative?'-(':'')+terms.join(' + ')+(negative?')':'')};}
