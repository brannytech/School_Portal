import {test} from 'node:test';
import assert from 'node:assert/strict';
import {studentSupport} from '../support.mjs';
import {filterPeriod,subjectSection,subjectComment,homeSuggestions,overallComment,buildReport} from '../report.mjs';

const NOW=Date.parse('2026-11-03T12:00:00Z'),DAY=86400000,ago=d=>new Date(NOW-d*DAY).toISOString();
const wk=(id,skills)=>({id,title:'Topic '+id,releasedAt:ago(2),lessons:[{id:id+'-1',questions:skills.map((sk,i)=>({id:'q'+i,prompt:'Q'+i,stage:'practice',...(sk?{skill:sk}:{})}))}]});
const tries=(student,w,n,right,daysAgo=1)=>Array.from({length:n},(_,i)=>({student,lesson:w+'-1',question:'q'+i,correct:i<right,response:'x',at:ago(daysAgo)}));
const base=(extra={})=>({assignments:[],submissions:[],reflections:[],progress:[],assessmentAttempts:[],practiceAttempts:[],...extra});
const ayo={id:'s',name:'Ayomide Johnson',admission:'GF/1',class:'SS1'};

test('the report figures equal the Monitor figures for the same child',()=>{
 const weeks=[wk(1,Array(12).fill('Fractions')),wk(2,Array(12).fill('Indices'))];
 const records=base({practiceAttempts:[...tries('s',1,12,4),...tries('s',2,12,11)]});
 const monitor=studentSupport(ayo,weeks,records,{now:NOW});
 const section=subjectSection({student:ayo,subject:'Mathematics',teacher:'Mr A',weeks,records,now:NOW});
 assert.equal(section.overall,Math.round(monitor.overall));assert.equal(section.band,monitor.overallBand);assert.equal(section.trend,monitor.trend);
 assert.deepEqual(section.weaknesses.map(w=>w.topic),['Topic 1']);assert.deepEqual(section.strengths.map(w=>w.topic),['Topic 2']);
});

test('only work inside the period counts',()=>{
 const weeks=[wk(1,Array(12).fill(null))];
 const records=base({practiceAttempts:[...tries('s',1,12,12,20),...tries('s',1,12,0,2)]}); // good 20 days ago, bad lately (same questions: first try counts)
 const recent=filterPeriod(records,{from:ago(5).slice(0,10)});
 assert.equal(recent.practiceAttempts.length,12);
 const all=filterPeriod(records,{});assert.equal(all.practiceAttempts.length,24);
 const section=subjectSection({student:ayo,subject:'Mathematics',weeks,records,now:NOW,period:{from:ago(5).slice(0,10)}});
 assert.equal(section.overall,0);
});

test('every number in a comment appears in the figures; thin evidence is described, not labelled weak',()=>{
 const weeks=[wk(1,Array(12).fill('Fractions')),wk(2,['A','A'])];
 const records=base({practiceAttempts:[...tries('s',1,12,4),...tries('s',2,2,0)],assignments:[{id:'a',week:1}],submissions:[{student:'s',kind:'assignment',assignment:'a',late:true,created:ago(1)}]});
 const section=subjectSection({student:ayo,subject:'Mathematics',weeks,records,now:NOW});
 const text=subjectComment(ayo.name,section);
 const allowed=new Set(JSON.stringify(section).match(/\d+/g));
 for(const n of text.match(/\d+/g)||[])assert.ok(allowed.has(n),`number ${n} in "${text}" is not in the figures`);
 assert.match(text,/Not enough work yet to judge understanding in Topic 2/);assert.ok(!/Topic 2 \(\d/.test(text.replace(/Topic 2\./,'')),'thin topic is not scored');
 assert.match(text,/Assignments handed in: 1 of 1 \(1 late\)/);
});

test('a child with no work gets an honest sentence, not a verdict',()=>{
 const section=subjectSection({student:ayo,subject:'Mathematics',weeks:[wk(1,[null])],records:base(),now:NOW});
 assert.equal(section.overall,null);
 assert.match(subjectComment(ayo.name,section),/not enough work yet to judge Ayomide's understanding in Mathematics/);
 assert.match(overallComment(ayo.name,[section]),/not done enough work/);
 assert.match(homeSuggestions(ayo.name,[section])[0],/log in and complete the first practice set/);
});

test('home suggestions are specific, realistic and at most three',()=>{
 const weeks=[wk(1,Array(12).fill('Fractions'))];
 const section=subjectSection({student:ayo,subject:'Mathematics',weeks,records:base({practiceAttempts:tries('s',1,12,2)}),now:NOW});
 const tips=homeSuggestions(ayo.name,[section,section,section,section]);
 assert.ok(tips.length>=1&&tips.length<=3);assert.match(tips[0],/10 minutes of practice on "Fractions", three evenings a week/);
});

test('buildReport carries school, child, glance, sections, comments and the footer',()=>{
 const weeks=[wk(1,Array(12).fill('Fractions'))];
 const section=subjectSection({student:ayo,subject:'Mathematics',teacher:'Mr A',weeks,records:base({practiceAttempts:tries('s',1,12,9)}),now:NOW});
 const r=buildReport({student:ayo,school:{name:'Grace-Field College'},session:'2026/2027',term:'First term',period:{from:'2026-09-14',to:'2026-10-31'},sections:[section]});
 assert.equal(r.student.admission,'GF/1');assert.equal(r.glance.overall,75);assert.equal(r.glance.band,'Proficient');assert.equal(r.sections[0].comment,subjectComment(ayo.name,section));
 assert.match(r.footer,/confidential/);assert.ok(r.overallComment.includes('75%'));
});
