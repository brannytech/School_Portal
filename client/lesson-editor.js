// The Lesson Studio's continuous editor: one document, text and lesson items together.
import {Editor,Node,Extension,mergeAttributes} from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import TextAlign from '@tiptap/extension-text-align';
import {Plugin,PluginKey,Selection,TextSelection,NodeSelection} from '@tiptap/pm/state';
import {Decoration,DecorationSet} from '@tiptap/pm/view';

// Synchronous focus: Tiptap's focus command waits a frame, which can steal focus from a field the user already moved to.
export function focusNow(editor,position=null){
 if(!editor||editor.isDestroyed)return;
 const {state,view}=editor;
 if(position==='start')view.dispatch(state.tr.setSelection(Selection.atStart(state.doc)));
 if(position==='end')view.dispatch(state.tr.setSelection(Selection.atEnd(state.doc)));
 view.focus();
}

const sameBlock=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

function findBlock(doc,id){let found=null;doc.descendants((node,pos)=>{if(found)return false;if(node.type.name==='lessonBlock'&&node.attrs.block.id===id){found={node,pos};return false;}});return found;}

export function selectedBlockId(editor){
 const selection=editor.state.selection;
 return selection instanceof NodeSelection&&selection.node.type.name==='lessonBlock'?selection.node.attrs.block.id:null;
}

// Place a lesson item at the caret and leave the caret on a writable line after it.
// options.select: keep the item selected (it needs input) instead of moving on.
export function insertBlock(editor,block,{select=false}={}){
 const {state,view}=editor,{schema}=state,{selection}=state;
 const item=schema.nodes.lessonBlock.create({block}),paragraph=schema.nodes.paragraph;
 let tr=state.tr,atomPos;
 if(selection instanceof NodeSelection){atomPos=selection.to;tr.insert(atomPos,item);}
 else{
  const $from=selection.$from,parent=$from.parent;
  if(parent.type===paragraph&&$from.depth===1){
   if(parent.content.size===0){atomPos=$from.before();tr.replaceWith(atomPos,$from.after(),item);}
   else if($from.parentOffset===parent.content.size){atomPos=$from.after();tr.insert(atomPos,item);}
   else if($from.parentOffset===0){atomPos=$from.before();tr.insert(atomPos,item);}
   else{const at=selection.from;tr.split(at);atomPos=tr.doc.resolve(at+1).before();tr.insert(atomPos,item);}
  }else{atomPos=$from.depth>=1?$from.after(1):tr.doc.content.size;tr.insert(atomPos,item);}
 }
 const afterPos=atomPos+item.nodeSize;
 if(tr.doc.nodeAt(afterPos)?.type!==paragraph)tr.insert(afterPos,paragraph.create());
 tr.setSelection(select?NodeSelection.create(tr.doc,atomPos):TextSelection.create(tr.doc,afterPos+1)).scrollIntoView();
 view.dispatch(tr);
 if(!select)view.focus();
 return {pos:atomPos,afterPos};
}

// Put the caret on the line after an item (creating it if needed): the "continue writing" move.
export function continueAfter(editor,id){
 const hit=findBlock(editor.state.doc,id);if(!hit)return false;
 const {view,state}=editor,after=hit.pos+hit.node.nodeSize;let tr=state.tr;
 if(tr.doc.nodeAt(after)?.type!==state.schema.nodes.paragraph)tr=tr.insert(after,state.schema.nodes.paragraph.create());
 view.dispatch(tr.setSelection(TextSelection.create(tr.doc,after+1)).scrollIntoView());view.focus();return true;
}
export function updateBlock(editor,block){
 const hit=findBlock(editor.state.doc,block.id);if(!hit)return false;
 const {view,state}=editor;view.dispatch(state.tr.setNodeMarkup(hit.pos,undefined,{block}));return true;
}
export function getBlock(editor,id){return findBlock(editor.state.doc,id)?.node.attrs.block||null;}
export function blockIds(editor){const ids=[];editor.state.doc.descendants(node=>{if(node.type.name==='lessonBlock')ids.push(node.attrs.block.id);});return ids;}
export function selectBlock(editor,id){
 const hit=findBlock(editor.state.doc,id);if(!hit)return false;
 const {view,state}=editor;view.dispatch(state.tr.setSelection(NodeSelection.create(state.doc,hit.pos)).scrollIntoView());return true;
}
export function removeBlock(editor,id){
 const hit=findBlock(editor.state.doc,id);if(!hit)return false;
 const {view,state}=editor;let tr=state.tr.delete(hit.pos,hit.pos+hit.node.nodeSize);
 const near=Math.min(hit.pos,tr.doc.content.size);tr=tr.setSelection(Selection.near(tr.doc.resolve(near),-1));view.dispatch(tr);view.focus();return true;
}
export function duplicateBlock(editor,id,newId){
 const hit=findBlock(editor.state.doc,id);if(!hit)return false;
 const copy=structuredClone(hit.node.attrs.block);copy.id=newId;
 const {view,state}=editor,end=hit.pos+hit.node.nodeSize;view.dispatch(state.tr.insert(end,state.schema.nodes.lessonBlock.create({block:copy})).setSelection(NodeSelection.create(state.doc,hit.pos)));
 selectBlock(editor,newId);return copy;
}
export function moveBlock(editor,id,direction){
 const hit=findBlock(editor.state.doc,id);if(!hit)return false;
 const {view,state}=editor,{doc}=state,$pos=doc.resolve(hit.pos),index=$pos.index();
 const target=direction<0?index-1:index+1;if(target<0||target>=doc.childCount)return false;
 let start=0;for(let i=0;i<Math.min(index,target);i++)start+=doc.child(i).nodeSize;
 const first=doc.child(Math.min(index,target)),second=doc.child(Math.max(index,target));
 const tr=state.tr.replaceWith(start,start+first.nodeSize+second.nodeSize,[second,first]);
 const newPos=direction<0?start:start+second.nodeSize;view.dispatch(tr.setSelection(NodeSelection.create(tr.doc,newPos)).scrollIntoView());return true;
}

export function createLessonEditor({element,content,renderBlock,onPaint,onChange,onSelect,onEquation,onFiles,slashItems=[],onSlash}){
 const LessonBlock=Node.create({
  name:'lessonBlock',group:'block',atom:true,selectable:true,draggable:true,
  addAttributes(){return {block:{default:null}};},
  parseHTML(){return [{tag:'div[data-lesson-block]',getAttrs:el=>({block:JSON.parse(el.getAttribute('data-lesson-block'))})}];},
  renderHTML({node,HTMLAttributes}){return ['div',mergeAttributes({'data-lesson-block':JSON.stringify(node.attrs.block)},HTMLAttributes)];},
  addNodeView(){return ({node})=>{
   const dom=document.createElement('div');dom.className='lesson-item';dom.contentEditable='false';
   let current=node.attrs.block;
   const paint=()=>{dom.dataset.type=current.type;dom.dataset.blockId=current.id;dom.innerHTML=renderBlock(current);onPaint?.(dom);};
   paint();
   return {dom,update(next){if(next.type.name!=='lessonBlock')return false;if(!sameBlock(next.attrs.block,current)){current=next.attrs.block;paint();}return true;},selectNode(){dom.classList.add('is-selected');},deselectNode(){dom.classList.remove('is-selected');},stopEvent(){return false;},ignoreMutation(){return true;}};
  };}
 });
 const InlineMath=Node.create({
  name:'inlineMath',group:'inline',inline:true,atom:true,
  addAttributes(){return {latex:{default:'x^2'}};},
  parseHTML(){return [{tag:'span[data-inline-math]',getAttrs:el=>({latex:el.getAttribute('data-inline-math')})}];},
  renderHTML({HTMLAttributes}){return ['span',mergeAttributes({'data-inline-math':HTMLAttributes.latex},HTMLAttributes),HTMLAttributes.latex];},
  addNodeView(){return ({node,getPos,editor})=>{const dom=document.createElement('span');dom.className='studio-inline-equation';dom.textContent=node.attrs.latex;dom.tabIndex=0;dom.setAttribute('role','button');dom.setAttribute('aria-label','Edit inline equation');import('/vendor/math-render.js').then(({mathHTML})=>{if(dom.isConnected)dom.innerHTML=mathHTML(node.attrs.latex);}).catch(()=>{});const edit=()=>onEquation?.({editor,position:getPos(),latex:node.attrs.latex});dom.addEventListener('click',edit);dom.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();edit();}});return {dom};};}
 });
 // A document always ends with a writable line.
 const TrailingLine=Extension.create({name:'trailingLine',addProseMirrorPlugins(){return [new Plugin({key:new PluginKey('trailingLine'),appendTransaction(_,__,state){const last=state.doc.lastChild;if(last&&last.type.name==='paragraph')return null;return state.tr.insert(state.doc.content.size,state.schema.nodes.paragraph.create());}})];}});

 // "/" menu: type a slash on an empty or fresh line to add an item without leaving the keyboard.
 const SlashMenu=Extension.create({name:'slashMenu',addProseMirrorPlugins(){
  const editorRef=()=>this.editor;let popup=null,items=[],index=0,range=null;
  const close=()=>{popup?.remove();popup=null;range=null;items=[];};
  const draw=view=>{
   if(!items.length){close();return;}
   const host=element.closest('dialog')||document.body;
   if(!popup){popup=document.createElement('div');popup.className='studio-slash';popup.setAttribute('role','listbox');popup.setAttribute('aria-label','Add to lesson');host.append(popup);}
   popup.innerHTML=items.map((item,i)=>`<div role="option" id="slash-${item.id}" data-slash="${item.id}" aria-selected="${i===index}" class="${i===index?'is-active':''}"><strong>${item.label}</strong><span>${item.hint||''}</span></div>`).join('');
   const coords=view.coordsAtPos(range.to);popup.style.left=Math.min(coords.left,window.innerWidth-280)+'px';popup.style.top=coords.bottom+6+'px';
   popup.onmousedown=event=>{event.preventDefault();const row=event.target.closest('[data-slash]');if(row)pick(view,items.find(item=>item.id===row.dataset.slash));};
  };
  const pick=(view,item)=>{if(!item||!range)return;const {from,to}=range;close();view.dispatch(view.state.tr.delete(from,to));onSlash?.(item.id);};
  const scan=view=>{
   const {selection}=view.state;if(!selection.empty||selection.$from.parent.type.name!=='paragraph'){close();return;}
   const text=selection.$from.parent.textBetween(0,selection.$from.parentOffset,null,'￼'),match=/(?:^|\s)\/([\w -]{0,24})$/.exec(text);
   if(!match){close();return;}
   const query=match[1].toLowerCase().trim(),start=selection.from-match[1].length-1;
   const found=slashItems.filter(item=>!query||item.label.toLowerCase().includes(query)||(item.keywords||'').includes(query));
   if(found.length!==items.length||found.some((item,i)=>item.id!==items[i]?.id))index=0;
   items=found;range={from:start,to:selection.from};draw(view);
  };
  return [new Plugin({
   key:new PluginKey('slashMenu'),
   view:()=>({update:view=>scan(view),destroy:close}),
   props:{
    handleKeyDown(view,event){
     if(!popup)return false;
     if(event.key==='ArrowDown'){index=(index+1)%items.length;draw(view);return true;}
     if(event.key==='ArrowUp'){index=(index+items.length-1)%items.length;draw(view);return true;}
     if(event.key==='Enter'||event.key==='Tab'){pick(view,items[index]);return true;}
     if(event.key==='Escape'){close();return true;}
     return false;
    },
    decorations(state){
     const {selection}=state;if(!selection.empty)return null;const parent=selection.$from.parent;
     if(parent.type.name!=='paragraph'||parent.content.size!==0||selection.$from.depth!==1)return null;
     return DecorationSet.create(state.doc,[Decoration.node(selection.$from.before(),selection.$from.after(),{class:'is-empty-line','data-placeholder':'Write here, or type / to add an equation, image, graph…'})]);
    }
   }
  })];
 }});

 const editor=new Editor({
  element,content,
  extensions:[StarterKit.configure({code:false,codeBlock:false,strike:false,heading:{levels:[1,2,3,4]},link:{openOnClick:false,defaultProtocol:'https',protocols:['https','mailto'],isAllowedUri:url=>/^(https:|mailto:)/i.test(url)}}),Subscript,Superscript,TextAlign.configure({types:['heading','paragraph']}),InlineMath,LessonBlock,TrailingLine,SlashMenu],
  editorProps:{
   attributes:{'aria-label':'Lesson page. Type to write, or type a slash to add an item.',role:'textbox','aria-multiline':'true'},
   handlePaste(view,event){const files=[...event.clipboardData?.files||[]].filter(f=>f.type.startsWith('image/'));if(files.length){event.preventDefault();onFiles?.(files);return true;}return false;},
   handleDrop(view,event){const files=[...event.dataTransfer?.files||[]].filter(f=>f.type.startsWith('image/'));if(files.length){event.preventDefault();onFiles?.(files);return true;}return false;}
  },
  onUpdate:({editor:e})=>onChange?.(e.getJSON()),
  onSelectionUpdate:({editor:e})=>onSelect?.(selectedBlockId(e))
 });
 return editor;
}
