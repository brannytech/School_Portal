import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import {checkAnswer,gradeAssessment} from '../dist/domain.js';
import {questionsFromCSV,parseCSV} from '../public/studio/questions.js';

test('grading: several correct answers, accepted alternatives, tolerance and marks',()=>{
 const multi={id:'m',prompt:'',explanation:'',kind:'multi',options:['2','3','4','5'],answers:['2','3'],answer:'2|3'};
 assert.equal(checkAnswer(multi,'3|2'),true,'order does not matter');
 assert.equal(checkAnswer(multi,['2','3']),true);
 assert.equal(checkAnswer(multi,'2'),false,'partial answers are wrong');
 assert.equal(checkAnswer(multi,'2|3|4'),false,'extra choices are wrong');
 assert.equal(checkAnswer(multi,''),false);
 const short={id:'s',prompt:'',explanation:'',kind:'short',answer:'photosynthesis',accepted:['Photo synthesis','the process of photosynthesis']};
 assert.equal(checkAnswer(short,'Photo Synthesis'),true);assert.equal(checkAnswer(short,'respiration'),false);
 const num={id:'n',prompt:'',explanation:'',kind:'numeric',answer:'3.14',tolerance:0.01,accepted:['pi']};
 assert.equal(checkAnswer(num,'3.145'),true);assert.equal(checkAnswer(num,'3.2'),false);assert.equal(checkAnswer(num,'PI'),true);
 const result=gradeAssessment([{...num,marks:3},{...short,marks:1}],{n:'3.14',s:'wrong'});
 assert.equal(result.correct,1);assert.equal(result.marks,3);assert.equal(result.possibleMarks,4);assert.equal(result.percentage,75);
 const plain=gradeAssessment([{...num},{...short}],{n:'3.14',s:'wrong'});assert.equal(plain.percentage,50,'questions without marks count as one mark each');
});

test('CSV import reads quoted cells, letters and several answers, and reports bad rows',()=>{
 assert.deepEqual(parseCSV('a,"b, c","say ""hi"""\n1,2,3'),[['a','b, c','say "hi"'],['1','2','3']]);
 const csv=['kind,prompt,optionA,optionB,optionC,optionD,answer,marks,hint,explanation',
  'choice,"Which is prime?",4,6,7,9,C,1,,Seven has two factors.',
  'multi,Pick the even numbers,2,3,4,5,A|C,2,Think of 2s,2 and 4 are even.',
  'numeric,What is 6 x 7?,,,,,42,,,Multiply.',
  'boolean,Zero is even,,,,,true,,,Yes.',
  'choice,Only one choice,A,,,,A,,,x',
  'riddle,What?,,,,,x,,,x',
  'short,,,,,,x,,,x',
  'choice,Bad letter,1,2,,,D,,,x',
  'numeric,Too many marks,,,,,1,500,,x'].join('\n');
 let n=0;const {questions,errors}=questionsFromCSV(csv,{stage:'quiz',makeId:()=>'id'+(++n)});
 assert.deepEqual(questions.map(q=>q.kind),['choice','multi','numeric','boolean']);
 assert.equal(questions[0].answer,'7');assert.deepEqual(questions[1].answers,['2','4']);assert.equal(questions[1].answer,'2|4');assert.equal(questions[1].marks,2);
 assert(questions.every(q=>q.stage==='quiz'));assert.equal(errors.length,5);
 assert(errors.some(e=>/riddle/.test(e)));assert(errors.some(e=>/empty/.test(e)));assert(errors.some(e=>/at least two/.test(e)));
});

test('server validates new fields and students never receive answers',async()=>{
 const dir=path.resolve('test-results','question-authoring-'+Date.now());fs.mkdirSync(dir,{recursive:true});
 const env={...process.env,DATA_DIR:dir,PORT:'0',NODE_ENV:'test',DEMO_PASSWORD:'Learn@2026!'};
 let root='',output='';const server=spawn(process.execPath,['--experimental-sqlite','server.mjs'],{env,stdio:['ignore','pipe','pipe']});server.stdout.on('data',b=>{output+=b;root=output.match(/ready at (http:\/\/127\.0\.0\.1:\d+)/)?.[1]||'';});server.stderr.on('data',b=>output+=b);
 try{
  for(let i=0;i<150&&!root;i++)await new Promise(r=>setTimeout(r,100));assert(root,output);
  const req=async(route,data,s={})=>{const r=await fetch(root+'/api/'+route,{method:data?'POST':'GET',headers:{Cookie:s.cookie||'','X-CSRF-Token':s.csrf||'','Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})});return {status:r.status,value:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};};
  const login=async role=>{const r=await req('login',{email:role+'@olawaleslab.school',password:'Learn@2026!'});assert.equal(r.status,200);return {cookie:r.cookie,csrf:r.value.csrf};};
  const teacher=await login('teacher'),student=await login('student');
  const lesson=questions=>({id:'14-a',title:'Questions',minutes:15,document:{schemaVersion:1,blocks:[{id:'p1',type:'paragraph',text:'Note.'}]},questions});
  const save=async(questions,quiz=[])=>{const now=(await req('weekly-template?week=14',null,teacher)).value;return req('weekly-template',{week:{id:14,title:'Questions',subtitle:'',lessons:[lesson(questions)],quiz},assignments:[],publish:true,release:{mode:'NOW',lessons:['14-a']},...(now.published?{revision:now.revision,draftRevision:now.draftRevision}:{})},teacher);};
  const multi={id:'q1',prompt:'Pick the even numbers: $2$, $3$, $4$',kind:'multi',options:['2','3','4'],answers:['2','4'],explanation:'Even numbers divide by 2.',marks:2,hint:'Look at the last digit.'};
  const short={id:'q2',prompt:'Name the gas plants release.',kind:'short',answer:'oxygen',accepted:['O2','dioxygen'],explanation:'Photosynthesis releases oxygen.'};
  const num={id:'q3',prompt:'Value of pi to 2 d.p.',kind:'numeric',answer:'3.14',tolerance:0.01,explanation:'pi = 3.14159…'};
  const ok=await save([multi,short,num]);assert.equal(ok.status,200,JSON.stringify(ok.value));

  for(const [bad,pattern] of [
   [{...multi,answers:[]},/at least one correct/i],[{...multi,answers:['9']},/listed choices/i],[{...multi,options:['2']},/at least two choices/i],[{...multi,options:['2|3','4']},/at least two choices/i],
   [{...short,marks:0},/Marks/],[{...short,marks:101},/Marks/],[{...short,marks:'many'},/Marks/]]){
   const r=await save([bad]);assert.equal(r.status,400,JSON.stringify(bad));assert.match(r.value.error,pattern);
  }

  const seen=(await req('lesson/14-a',null,student));assert.equal(seen.status,200);
  const questions=seen.value.questions;assert.equal(questions.length,3);
  for(const q of questions){for(const secret of ['answer','answers','accepted','explanation'])assert.equal(q[secret],undefined,secret+' must not reach students');}
  assert.deepEqual(questions[0].options,['2','3','4']);assert.equal(questions[0].marks,2);assert.equal(questions[0].hint,'Look at the last digit.');
  const attempt=(question,answer)=>req('practice',{lesson:'14-a',question,answer},student);
  assert.equal((await attempt('q1','4|2')).value.correct,true,'several answers join with |');
  assert.equal((await attempt('q1','2')).value.correct,false);
  assert.equal((await attempt('q2','o2')).value.correct,true,'accepted alternative');
  assert.equal((await attempt('q3','3.145')).value.correct,true,'tolerance');
  assert.equal((await attempt('q3','3.3')).value.correct,false);
 }finally{server.kill();}
});
