import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blocksToDoc,docToBlocks,newBlock,hasContent} from '../public/studio/document-model.js';
import {applyBlockEdit} from '../public/studio/inspector.js';

const text=t=>({type:'paragraph',content:[{type:'text',text:t}]});
const rich=(id,...nodes)=>({id,type:'rich-text',content:{type:'doc',content:nodes}});

test('blocks round-trip through the editor document in order',()=>{
 const eq=newBlock('equation',{latex:'a=b'}),blocks=[rich('r1',text('Intro')),eq,rich('r2',text('After'))];
 const back=docToBlocks(blocksToDoc(blocks));
 assert.deepEqual(back.map(b=>b.type),['rich-text','equation','rich-text']);
 assert.equal(back[1].latex,'a=b');assert.equal(back[1].id,eq.id);
});
test('an editable line always follows a trailing item and empty lines are dropped on save',()=>{
 const doc=blocksToDoc([newBlock('table')]);
 assert.equal(doc.content.at(-1).type,'paragraph');
 assert.deepEqual(docToBlocks(doc).map(b=>b.type),['table']);
 assert.deepEqual(docToBlocks(blocksToDoc([])),[]);
});
test('legacy heading, paragraph and separator blocks open as editor text',()=>{
 const doc=blocksToDoc([{id:'h',type:'heading',level:2,text:'Title'},{id:'p',type:'paragraph',text:'Body'},{id:'s',type:'separator'}]);
 assert.deepEqual(doc.content.slice(0,3).map(n=>n.type),['heading','paragraph','horizontalRule']);
 const saved=docToBlocks(doc);assert.equal(saved.length,1);assert.equal(saved[0].type,'rich-text');
});
test('inline equations count as content, blank text does not',()=>{
 assert.equal(hasContent({type:'paragraph',content:[{type:'inlineMath',attrs:{latex:'x'}}]}),true);
 assert.equal(hasContent({type:'paragraph',content:[{type:'text',text:'  '}]}),false);
});
test('newBlock gives independent defaults',()=>{
 const a=newBlock('table'),b=newBlock('table');a.rows[0][0]='x';
 assert.equal(b.rows[0][0],'');assert.notEqual(a.id,b.id);
});
test('applyBlockEdit changes one field on a copy',()=>{
 const block=newBlock('objectives'),next=applyBlockEdit(block,'block.items','One\nTwo');
 assert.deepEqual(next.block.items,['One','Two']);assert.deepEqual(block.items,[]);
 assert.equal(applyBlockEdit(newBlock('hint'),'block.text','Hi').block.text,'Hi');
 assert.equal(applyBlockEdit(newBlock('table'),'block.rows.0.1','5').block.rows[0][1],'5');
});
test('applyBlockEdit validates video links and unknown fields',()=>{
 assert.equal(applyBlockEdit(newBlock('video'),'block.video','https://youtu.be/dQw4w9WgXcQ').block.videoId,'dQw4w9WgXcQ');
 assert(applyBlockEdit(newBlock('video'),'block.video','http://example.com/x').error);
 assert(applyBlockEdit(newBlock('hint'),'block.nothing.deep','x').error);
});
