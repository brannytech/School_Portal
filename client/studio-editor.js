import {Editor,Node,mergeAttributes} from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import TextAlign from '@tiptap/extension-text-align';
import {Selection} from '@tiptap/pm/state';

// Synchronous focus: Tiptap's own focus command defers to the next animation frame, which steals focus from a field the user has already moved to.
export function focusNow(editor,position=null){
 if(!editor||editor.isDestroyed)return;
 const {state,view}=editor;
 if(position==='start')view.dispatch(state.tr.setSelection(Selection.atStart(state.doc)));
 if(position==='end')view.dispatch(state.tr.setSelection(Selection.atEnd(state.doc)));
 view.focus();
}

export function createRichEditor({element,content,onUpdate,onEquation}){
 const InlineMath=Node.create({
  name:'inlineMath',group:'inline',inline:true,atom:true,
  addAttributes(){return {latex:{default:'x^2'}};},
  parseHTML(){return [{tag:'span[data-inline-math]',getAttrs:element=>({latex:element.getAttribute('data-inline-math')})}];},
  renderHTML({HTMLAttributes}){return ['span',mergeAttributes({'data-inline-math':HTMLAttributes.latex},HTMLAttributes),HTMLAttributes.latex];},
  addNodeView(){return ({node,editor,getPos})=>{const dom=document.createElement('span');dom.className='studio-inline-equation';dom.textContent=node.attrs.latex;dom.tabIndex=0;dom.setAttribute('role','button');dom.setAttribute('aria-label','Edit inline equation');const url='/vendor/math-render.js';import(url).then(({mathHTML})=>{if(dom.isConnected)dom.innerHTML=mathHTML(node.attrs.latex);}).catch(()=>{});const edit=()=>onEquation({editor,position:getPos(),latex:node.attrs.latex});dom.addEventListener('click',edit);dom.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();edit();}});return {dom};};}
 });
 return new Editor({element,content,extensions:[StarterKit.configure({code:false,codeBlock:false,strike:false,heading:{levels:[1,2,3,4]},link:{openOnClick:false,defaultProtocol:'https',protocols:['https','mailto'],isAllowedUri:url=>/^(https:|mailto:)/i.test(url)}}),Subscript,Superscript,TextAlign.configure({types:['heading','paragraph']}),InlineMath],editorProps:{attributes:{'aria-label':'Rich lesson text',role:'textbox','aria-multiline':'true'}},onUpdate:({editor})=>onUpdate(editor.getJSON())});
}
