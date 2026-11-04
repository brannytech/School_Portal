import {test} from 'node:test';
import assert from 'node:assert/strict';
import {studentSupport,classSupport,topicEvidence,trendOf,defaultSupportSettings} from '../support.mjs';

const NOW=Date.parse('2026-11-03T12:00:00Z'),DAY=86400000,ago=d=>new Date(NOW-d*DAY).toISOString();
const q=i=>({id:'q'+i,prompt:'Question '+i,stage:'practice'});
const week=(id,releasedDaysAgo)=>({id,title:'Topic '+id,releasedAt:releasedDaysAgo==null?null:ago(releasedDaysAgo),lessons:[{id:id+'-1',questions:Array.from({length:12},(_,i)=>q(i))}]});
// n first-try attempts, the first `right` of them correct
const attempts=(student,w,n,right,daysAgo=1)=>Array.from({length:n},(_,i)=>({student,lesson:w+'-1',question:'q'+i,correct:i<right,response:i<right?'1':'7',at:ago(daysAgo)}));
const quiz=(student,w,percentage,daysAgo=1)=>({student,kind:'quiz',status:'SUBMITTED',week:w,lesson:w+'-1',percentage,submitted:ago(daysAgo)});
const run=(student,weeks,records,extra={})=>studentSupport({id:student,name:student},weeks,{assignments:[],submissions:[],reflections:[],progress:[],assessmentAttempts:[],practiceAttempts:[],...records},{now:NOW,...extra});

test('a child who did nothing is "no evidence yet", not weak',()=>{
 const r=run('s',[week(1,1)],{});
 assert.equal(r.status,'no_evidence');assert.equal(r.topics[0].level,'none');assert.equal(r.topics[0].band,null);assert.equal(r.topics[0].score,null);
});

test('two answers is thin evidence and is never labelled weak',()=>{
 const r=run('s',[week(1,1)],{practiceAttempts:attempts('s',1,2,0)});
 assert.equal(r.topics[0].level,'thin');assert.equal(r.topics[0].band,null);assert.ok(!r.flags.some(f=>f.code==='struggling'));
});

test('understanding combines practice 30%, quiz 40%, assignment 30% and shows its evidence',()=>{
 const records={practiceAttempts:attempts('s',1,10,8),assessmentAttempts:[quiz('s',1,60)],assignments:[{id:'a',week:1}],submissions:[{student:'s',kind:'assignment',assignment:'a',score:9,max:10}]};
 const t=topicEvidence('s',week(1,1),{assignments:[],submissions:[],assessmentAttempts:[],practiceAttempts:[],...records});
 assert.equal(t.score,0.3*80+0.4*60+0.3*90);assert.equal(t.level,'enough');assert.equal(t.band,'Proficient');
 assert.match(t.evidence.text,/10 answers, 1 quiz, 1 marked assignment/);
});

test('a missing source shares its weight; only the first try counts for practice',()=>{
 const retries=[...attempts('s',1,8,0),...attempts('s',1,8,8,0)]; // wrong first, right later
 const t=topicEvidence('s',week(1,1),{practiceAttempts:retries,assessmentAttempts:[quiz('s',1,100)],submissions:[],assignments:[]});
 assert.equal(t.sources.practice,0);assert.equal(t.score,Math.round((0*30+100*40)/70*10)/10);
});

test('struggling: enough evidence and below 50 gives a severe flag, reason and action',()=>{
 const r=run('s',[week(1,1)],{practiceAttempts:attempts('s',1,10,3)});
 const f=r.flags.find(f=>f.code==='struggling');assert.ok(f&&f.severe&&f.action&&/30%/.test(f.reason));assert.equal(r.status,'needs_support');
});

test('slipping: a drop of 15 or more against the previous topic',()=>{
 const r=run('s',[week(1,10),week(2,3)],{practiceAttempts:[...attempts('s',1,10,9),...attempts('s',2,10,6)]});
 assert.ok(r.flags.some(f=>f.code==='slipping'));assert.equal(r.status,'needs_support');
});

test('trend needs enough evidence in both periods',()=>{
 const t=(week,score,level='enough')=>({week,score,level});
 assert.deepEqual(trendOf([t(1,80),t(2,50,'thin')]),{trend:null,change:null});
 assert.equal(trendOf([t(1,50),t(2,70)]).trend,'improving');assert.equal(trendOf([t(1,70),t(2,72)]).trend,'steady');assert.equal(trendOf([t(1,80),t(2,60)]).trend,'slipping');
});

test('behind: a topic released more than 5 days ago with no activity',()=>{
 assert.ok(run('s',[week(1,6)],{}).flags.some(f=>f.code==='behind'));
 assert.ok(!run('s',[week(1,3)],{}).flags.some(f=>f.code==='behind'));
});

test('guessing: many tries before a correct answer',()=>{
 const rows=Array.from({length:6},(_,i)=>[0,1,2].map(n=>({student:'s',lesson:'1-1',question:'q'+i,correct:n===2,response:'x',at:new Date(NOW-DAY+n*1000+i*10000).toISOString()}))).flat();
 const r=run('s',[week(1,1)],{practiceAttempts:rows});
 assert.ok(r.flags.some(f=>f.code==='guessing'));
});

test('overconfident: confidence 4 or 5 with a low score',()=>{
 const r=run('s',[week(1,1)],{practiceAttempts:attempts('s',1,10,3),reflections:[{student:'s',confidence:5,question:'None'}]});
 assert.ok(r.flags.some(f=>f.code==='overconfident'));
});

test('asked for help: an open question counts, "None" does not',()=>{
 assert.ok(run('s',[week(1,1)],{reflections:[{student:'s',question:'How do I divide fractions?'}]}).flags.some(f=>f.code==='asked_help'));
 assert.ok(!run('s',[week(1,1)],{reflections:[{student:'s',question:'None for now'}]}).flags.some(f=>f.code==='asked_help'));
});

test('late pattern and missing work',()=>{
 const assignments=['a','b','c','d'].map((id,i)=>({id,week:1}));
 const subs=['a','b'].map((id,i)=>({student:'s',kind:'assignment',assignment:id,late:true,created:ago(5-i)}));
 const r=run('s',[week(1,1)],{assignments,submissions:subs});
 assert.ok(r.flags.some(f=>f.code==='late_pattern'));assert.ok(r.flags.some(f=>f.code==='missing_work'));
});

test('inactive: nothing for 7 days after earlier activity is severe; presence counts as activity',()=>{
 const old=attempts('s',1,10,9,9);
 assert.ok(run('s',[week(1,20)],{practiceAttempts:old}).flags.some(f=>f.code==='inactive'));
 assert.ok(!run('s',[week(1,20)],{practiceAttempts:old},{lastSeen:ago(1)}).flags.some(f=>f.code==='inactive'));
});

test('excelling and on track',()=>{
 const progress=Array.from({length:2},(_,i)=>({student:'s',lesson:(i+1)+'-1',complete:true,contentConsumedAt:ago(2)}));
 const records={practiceAttempts:[...attempts('s',1,10,10,2),...attempts('s',2,10,10,1)],assessmentAttempts:[quiz('s',1,95,2),quiz('s',2,92)],progress};
 assert.equal(run('s',[week(1,4),week(2,2)],records).status,'excelling');
 assert.equal(run('s',[week(1,4)],{practiceAttempts:attempts('s',1,10,7)}).status,'on_track');
});

test('class view sorts by priority, counts statuses and lists topics to reteach with the common wrong answer',()=>{
 const students=['weak','strong','blank'].map(id=>({id,name:id}));
 const records={assignments:[],submissions:[],reflections:[],progress:[],assessmentAttempts:[],practiceAttempts:[...attempts('weak',1,10,2),...attempts('strong',1,10,10)]};
 const result=classSupport(students,[week(1,1)],records,{now:NOW,records});
 assert.deepEqual(result.students.map(s=>s.id),['weak','blank','strong']);
 assert.equal(result.counts.needs_support,1);assert.equal(result.counts.no_evidence,1);
 assert.equal(result.reteach.length,1);assert.equal(result.reteach[0].commonMistakes[0].commonWrongAnswer,'7');
});

test('thresholds are editable settings',()=>{
 const strict={...defaultSupportSettings,bands:{developing:80,proficient:90,mastered:95}};
 assert.ok(run('s',[week(1,1)],{practiceAttempts:attempts('s',1,10,7)},{settings:strict}).flags.some(f=>f.code==='struggling'));
});
