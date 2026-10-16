import {test} from 'node:test';
import assert from 'node:assert/strict';
import {curriculum} from '../curriculum.mjs';

test('every topic has five complete, distinct lessons and a 20-question mastery set',()=>{
 assert.equal(curriculum.length,8);
 for(const week of curriculum){
  assert.equal(week.lessons.length,5);
  assert.deepEqual(week.lessons.map(l=>l.id),[1,2,3,4,5].map(n=>`${week.id}-${n}`));
  assert.equal(new Set(week.lessons.map(l=>l.title)).size,5);
  assert.equal(new Set(week.lessons.map(l=>l.explain)).size,5,'lesson explanations must differ within a topic');
  assert.equal(week.quiz.length,20);
  for(const lesson of week.lessons){
   assert.equal(lesson.questions.length,60);
   assert.equal(new Set(lesson.questions.map(q=>q.id)).size,60);
   assert.equal(new Set(lesson.questions.map(q=>q.prompt)).size,60);
   assert(lesson.example&&lesson.steps.length===3&&lesson.commonMistake&&lesson.discovery);
  }
 }
});

test('the mastery set samples every lesson of the topic',()=>{
 for(const week of curriculum)assert.deepEqual([...new Set(week.quiz.map(q=>q.objective))].sort(),[1,2,3,4,5].map(n=>`${week.id}.${n}`));
});
