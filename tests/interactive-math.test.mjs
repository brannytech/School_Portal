import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compileExpression,defaultGraph,validateGraph,graphKinds,defaultTool,validateTool,toolKinds,graphFunctions,graphFeatures,quadraticFeatures,polynomialCoefficients,sampleSegments,checkGraphExercise,matrixOperation,determinant,geometryMeasures,transformPoints,convertBase} from '../public/math-engine.js';
import {validateLessonDocument,studentLesson} from '../public/lesson-document.js';
import {graphSVG,graphEquation} from '../public/math-interactives.js';
import {renderLessonDocument} from '../public/lesson-renderer.js';
const close=(a,b,t=1e-10)=>assert(Math.abs(a-b)<=t,`${a} differs from ${b}`);

test('Bounded arithmetic respects precedence, factorials, angle units and real domains',()=>{
 for(const [source,result]of [['-2^2',-4],['2^3^2',512],['(1/2)+(3/4)',1.25],['5!',120],['sqrt(16)+log(100)+ln(e)',7],['2(3+4)',14]])close(compileExpression(source,[])(),result);
 close(compileExpression('sin(30)',[],'degrees')(),.5);close(compileExpression('cos(pi)',[])(),-1);
 for(const source of ['sqrt(-1)','ln(0)','1/0','(-1)!','171!','2^1000','tan(pi/2)'])assert.throws(()=>compileExpression(source,[])());
 assert.throws(()=>compileExpression('tan(90)',[],'degrees')());
 for(const source of ['globalThis.process.exit()','constructor(1)','x=1','<img>','alert(1)','a'.repeat(241),'('.repeat(25)+'1'+')'.repeat(25)])assert.throws(()=>compileExpression(source));
});
test('All fifteen graph families and seven toolkit definitions validate and remain editable data',()=>{
 for(const kind of graphKinds){const g=defaultGraph(kind);assert.deepEqual(validateGraph(g),g);const html=graphSVG(g);assert(html.includes('<svg'));assert(!/NaN|Infinity/.test(html),kind);}
 for(const kind of toolKinds)assert.deepEqual(validateTool(defaultTool(kind)),defaultTool(kind));
 const g=defaultGraph();g.title='<img src=x onerror=alert(1)>';const d={schemaVersion:1,blocks:[{id:'graph',type:'graph',graph:g},{id:'matrix',type:'math-tool',config:defaultTool()}]};
 assert.deepEqual(validateLessonDocument(d),d);assert(!renderLessonDocument(d).includes('<img'));assert(!graphSVG(g).includes('<img'));assert.deepEqual(studentLesson({document:d,questions:[]}).document,d);
});
test('Graph schema rejects injection, unexpected fields, broken intervals and oversized inputs',()=>{
 for(const mutate of [g=>g.expressions[0].expression='fetch(x)',g=>g.viewport.xMax=g.viewport.xMin,g=>g.parameters[0].step=0,g=>g.parameters.push(g.parameters[0]),g=>g.parameters[0].value=Infinity,g=>g.script='alert(1)',g=>g.features.grid='yes',g=>g.points=Array(81).fill([0,0]),g=>g.exercise={xs:[99],tolerance:.1}]){const g=defaultGraph();mutate(g);assert.throws(()=>validateGraph(g),e=>e.status===400);}
 const histogram=defaultGraph('histogram');histogram.data[1].from=1;assert.throws(()=>validateGraph(histogram));
 const pie=defaultGraph('pie');pie.data.forEach(d=>d.value=0);assert.throws(()=>validateGraph(pie));
});
test('Quadratic features match independent factorisation and coefficient changes, including degeneracy',()=>{
 const g=defaultGraph(),f=graphFeatures(g);assert.deepEqual(f.roots,[-1,3]);assert.deepEqual(f.vertex,[1,-4]);assert.equal(f.axis,1);assert.equal(f.yIntercept,-3);assert.equal(f.opens,'upward');
 assert.deepEqual([-2,-1,0,1,2,3,4].map(x=>graphFunctions(g)[0](x)),[5,0,-3,-4,-3,0,5]);
 const inverted=graphFeatures(g,{a:-1,b:-2,c:-3});assert.equal(inverted.opens,'downward');assert.deepEqual(inverted.roots,[]);
 assert.equal(graphFunctions(g,{a:1,b:-2,c:7})[0](0),7);
 assert.deepEqual(quadraticFeatures(0,2,-6).roots,[3]);assert.equal(quadraticFeatures(0,0,0).allRoots,true);assert.deepEqual(quadraticFeatures(1,-2,1).roots,[1]);
 assert.deepEqual(polynomialCoefficients('x² - 2x - 3',{}),[1,-2,-3]);assert.equal(polynomialCoefficients('sin(x)',{}),null);
 assert.equal(graphEquation(g),'y = x² − 2x − 3');assert.equal(graphEquation(g,{a:-1,b:-2,c:4}),'y = −x² − 2x + 4');
});
test('Domain gaps break sampled curves and strict inequalities use dashed boundaries',()=>{
 const g=defaultGraph('reciprocal');g.expressions=[{expression:'1/x',relation:'='}];const segments=sampleSegments(graphFunctions(g)[0],g.viewport);assert(segments.length>=2);assert(segments.every(s=>s.every(p=>p[0]<0)||s.every(p=>p[0]>0)));
 const log=defaultGraph('logarithmic');log.expressions=[{expression:'ln(x)',relation:'='}];assert(sampleSegments(graphFunctions(log)[0],log.viewport).every(s=>s.every(p=>p[0]>0)));
 g.expressions=[{expression:'2*x+1',relation:'>'}];const strict=graphSVG(g);assert(strict.includes('graph-shade'));assert(strict.includes('stroke-dasharray="7 5"'));g.expressions[0].relation='>=';assert(!graphSVG(g).includes('stroke-dasharray="7 5"'));
});
test('Graph practice distinguishes table errors from point-placement errors within tolerance',()=>{
 const g=defaultGraph();g.exercise={xs:[-2,-1,0],tolerance:.15};validateGraph(g);
 const results=checkGraphExercise(g,[{table:5,point:[-2,4]},{table:1,point:[-.95,0]},{table:-3.1,point:[0,-3.1]}]);
 assert.deepEqual(results.map(r=>[r.table,r.point]),[[true,false],[false,true],[true,true]]);
 assert(checkGraphExercise(g,[]).every(r=>!r.table&&!r.point));
});
test('Matrix operations match independent 2x2/3x3 inverse and Cramer results; invalid domains fail',()=>{
 const a=[[2,1],[3,4]],b=[[1,2],[3,4]];assert.equal(determinant(a),5);
 assert.deepEqual(matrixOperation('inverse',a).result,[[.8,-.2],[-.6,.4]]);
 close(matrixOperation('inverse',[[1e-10,0],[0,1e-10]]).result[0][0],1e10,.00001);
 assert.deepEqual(matrixOperation('add',a,b).result,[[3,3],[6,8]]);assert.deepEqual(matrixOperation('subtract',a,b).result,[[1,-1],[0,0]]);
 assert.deepEqual(matrixOperation('scalar',a,null,2).result,[[4,2],[6,8]]);assert.deepEqual(matrixOperation('transpose',[[1,2,3],[4,5,6]]).result,[[1,4],[2,5],[3,6]]);
 assert.deepEqual(matrixOperation('multiply',a,b).result,[[5,8],[15,22]]);assert.deepEqual(matrixOperation('cramer',a,[[5],[15]]).result,[[1],[3]]);
 const c=[[1,2,3],[0,1,4],[5,6,0]],expected=[[-24,18,5],[20,-15,-4],[-5,4,1]];assert.equal(determinant(c),1);assert.deepEqual(matrixOperation('inverse',c).result,expected);assert.deepEqual(matrixOperation('multiply',c,expected).result,[[1,0,0],[0,1,0],[0,0,1]]);
 for(const fn of [()=>matrixOperation('inverse',[[1,2],[2,4]]),()=>matrixOperation('add',a,[[1]]),()=>matrixOperation('multiply',a,[[1,2]]),()=>determinant([[1,2]]),()=>matrixOperation('cramer',a,b)])assert.throws(fn);
});
test('Geometry computes a 3-4-5 triangle, circle, right angle and rigid transformations',()=>{
 const pts=[[0,0],[4,0],[0,3]],m=geometryMeasures(pts);assert.equal(m.area,6);assert.deepEqual(m.lengths,[4,5,3]);assert.deepEqual(m.midpoint,[2,0]);close(geometryMeasures([[1,0],[0,0],[0,1]],'angle').angle,90);
 close(geometryMeasures([[0,0],[3,0]],'circle').area,9*Math.PI);
 const transformed=transformPoints(pts,{dx:3,dy:-2,rotation:90,reflect:true});close(geometryMeasures(transformed).area,6);close(transformed[1][0],3);close(transformed[1][1],-6);
 const invalid=defaultTool('geometry');invalid.settings.points=[[0,0]];assert.throws(()=>validateTool(invalid));
});
test('Base conversion is exact for large signed integers and validates digits',()=>{
 assert.equal(convertBase('1101',2,10).result,'13');assert.equal(convertBase('-FF',16,2).result,'-11111111');
 const n='123456789012345678901234567890';assert.equal(convertBase(convertBase(n,10,16).result,16,10).result,n);
 for(const args of [['12',2,10],['1.5',10,2],['',10,2],['1',1,2],['1',10,17]])assert.throws(()=>convertBase(...args));
});
