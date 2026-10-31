import {test} from 'node:test';
import assert from 'node:assert/strict';
import {studentWorkSummary} from '../monitoring.mjs';

test('monitoring counts late assignment submissions per student',()=>{
 const week={id:1,title:'W1',lessons:[{id:'1-a',questions:[]}],quiz:[]};
 const assignments=[{id:'a1',week:1},{id:'a2',week:1},{id:'a3',week:1}];
 const submissions=[
  {student:'s1',kind:'assignment',assignment:'a1',late:true},
  {student:'s1',kind:'assignment',assignment:'a2',late:false},
  {student:'s1',kind:'assignment',assignment:'other',late:true}, // not in the monitored weeks
  {student:'s1',kind:'note',late:true}, // notes are not assignments
  {student:'s2',kind:'assignment',assignment:'a3',late:true},
 ];
 const summary=studentWorkSummary({id:'s1',name:'Ada',email:'a@x',status:'ACTIVE'},[week],{assignments,submissions});
 assert.equal(summary.lateSubmissions,1);
 assert.equal(studentWorkSummary({id:'s3',name:'Bayo',email:'b@x',status:'ACTIVE'},[week],{assignments,submissions}).lateSubmissions,0);
});
