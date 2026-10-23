import {test} from 'node:test';
import assert from 'node:assert/strict';
import {publicationIssues} from '../public/studio-checks.js';
const question={id:'q',prompt:'Name a state of matter.',kind:'short',answer:'solid',explanation:'Solids retain their shape.'};
const week=()=>({id:9,title:'Matter',lessons:[{id:'9-one',title:'States of matter',document:{schemaVersion:1,blocks:[{id:'intro',type:'paragraph',text:'Matter can be solid, liquid or gas.'}]},questions:[structuredClone(question)]}],quiz:[structuredClone(question)]});
test('Publication guidance identifies blank week, lesson, content and question sections with actionable targets',()=>{
 const issues=publicationIssues({title:'',lessons:[{id:'9-one',title:'',document:{schemaVersion:1,blocks:[]},questions:[]}],quiz:[]});
 assert(issues.some(i=>i.path==='week.title'));assert(issues.some(i=>i.lessonId==='9-one'&&i.path==='lesson.title'));assert(issues.some(i=>i.bank==='practice'));assert(issues.some(i=>i.bank==='quiz'));
 assert.deepEqual(publicationIssues(week()),[]);
});
test('Question guidance catches missing feedback, malformed choices and false true/false answers',()=>{
 const w=week(),q=w.lessons[0].questions[0];q.explanation=' ';assert(publicationIssues(w).some(i=>i.path==='practice.explanation'&&i.index===0));q.explanation='A state of matter.';q.kind='choice';q.options=['solid'];assert(publicationIssues(w).some(i=>i.path==='practice.options'));q.options=['solid','gas'];assert.deepEqual(publicationIssues(w),[]);q.answer='plasma';assert(publicationIssues(w).some(i=>i.path==='practice.options'));q.kind='boolean';q.answer='yes';assert(publicationIssues(w).some(i=>i.path==='practice.answer'));q.answer='true';assert.deepEqual(publicationIssues(w),[]);
});
test('Guidance tolerates legacy content and catches unsafe structured item definitions without mutating content',()=>{
 const w=week();delete w.lessons[0].document;w.lessons[0].explain='An ordinary legacy explanation.';const before=structuredClone(w);assert.deepEqual(publicationIssues(w),[]);assert.deepEqual(w,before);
 w.lessons[0].document={schemaVersion:1,blocks:[{id:'bad',type:'video',videoId:''}]};assert(publicationIssues(w).some(i=>i.message.includes('review the lesson item settings')));
});
