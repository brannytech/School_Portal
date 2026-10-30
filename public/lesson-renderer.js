import {documentForLesson,validateLessonDocument} from './lesson-document.js';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paragraph=value=>`<div class="course-text">${escape(value)}</div>`;
const list=values=>`<ul>${values.map(value=>`<li>${escape(value)}</li>`).join('')}</ul>`;
const math=(latex,display=false)=>`<span class="math-source" data-math-tex="${escape(latex)}" data-math-display="${display}"><code aria-label="Mathematical source">${escape(latex)}</code></span>`;
function rich(node){
 if(node.type==='text'){let result=escape(node.text);for(const mark of node.marks||[]){const tag={bold:'strong',italic:'em',underline:'u',subscript:'sub',superscript:'sup'}[mark.type];result=tag?`<${tag}>${result}</${tag}>`:`<a href="${escape(mark.attrs.href)}" rel="noopener noreferrer">${result}</a>`;}return result;}
 if(node.type==='inlineMath')return math(node.attrs.latex);
 if(node.type==='hardBreak')return '<br>';if(node.type==='horizontalRule')return '<hr class="divider">';
 const content=(node.content||[]).map(rich).join('');if(node.type==='doc')return content;
 const tag={paragraph:'p',bulletList:'ul',orderedList:'ol',listItem:'li',blockquote:'blockquote',heading:'h'+node.attrs?.level}[node.type];
 return `<${tag}${node.attrs?.textAlign?` class="rich-align-${node.attrs.textAlign}"`:''}${node.type==='orderedList'&&node.attrs?.start?` start="${node.attrs.start}"`:''}${node.type==='orderedList'&&node.attrs?.type?` type="${node.attrs.type}"`:''}>${content}</${tag}>`;
}
export function renderBlock(block,renderWidget){
 switch(block.type){
  case 'heading':return `<h${block.level}>${escape(block.text)}</h${block.level}>`;
  case 'paragraph':return paragraph(block.text);
  case 'rich-text':return `<div class="lesson-rich-text">${rich(block.content)}</div>`;
  case 'equation':return `<figure class="lesson-equation ${block.displayMode?'display-equation':''}">${math(block.latex,block.displayMode)}</figure>`;
  case 'objectives':return list(block.items);
  case 'summary':return '<h3>Remember these ideas</h3>'+list(block.items);
  case 'worked-example':return '<h3>Worked example</h3>'+paragraph(block.prompt)+`<details><summary>Show the method</summary>${paragraph(block.explanation)}${block.steps?.length?list(block.steps):''}<strong>${escape(block.answer)}</strong></details>`;
  case 'real-life':return '<h3>A real-life connection</h3>'+paragraph(block.text);
  case 'experiment':return '<h3>Try an experiment</h3>'+paragraph(block.text);
  case 'hint':case 'warning':return `<aside class="callout"><strong>${block.type==='hint'?'Hint':'Important note'}</strong>${paragraph(block.text)}</aside>`;
  case 'separator':return '<hr class="divider">';
  case 'table':return `<div class="table-wrap"><table><caption>${escape(block.caption)}</caption><thead><tr>${block.headers.map(value=>`<th scope="col">${escape(value)}</th>`).join('')}</tr></thead><tbody>${block.rows.map(row=>`<tr>${row.map(value=>`<td>${escape(value)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  case 'video':return `<h3>Watch and learn</h3><div class="course-video"><iframe loading="lazy" src="https://www.youtube-nocookie.com/embed/${block.videoId}" title="Lesson video" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`;
  case 'image':return `<figure class="lesson-image lesson-image-${block.width} lesson-image-${block.align}"><img src="/api/media/${encodeURIComponent(block.fileId)}" alt="${block.decorative?'':escape(block.alt)}" loading="lazy" decoding="async">${block.caption?`<figcaption>${escape(block.caption)}</figcaption>`:''}</figure>`;
  case 'widget':return renderWidget?renderWidget():'';
  case 'graph':return `<div class="math-interactive" data-math-graph="${escape(JSON.stringify(block.graph))}"><p>Interactive graph: ${escape(block.graph.title)}. Loading local graph controls…</p></div>`;
  case 'math-tool':return `<div class="math-interactive" data-math-tool="${escape(JSON.stringify(block.config))}"><p>Mathematics toolkit: ${escape(block.config.tool)}. Loading controls…</p></div>`;
 }
}
export function renderLessonDocument(document,{renderWidget}={}){
 // Invalid stored content fails visibly and locally rather than blanking the lesson.
 let valid;try{valid=validateLessonDocument(document);}catch{return '<p class="error" role="alert">This lesson content could not be displayed. Please ask your teacher to review it.</p>';}
 return `<div class="lesson-document">${valid.blocks.map(block=>`<section class="lesson-block" data-block-id="${block.id}">${renderBlock(block,renderWidget)}</section>`).join('')}</div>`;
}
export function renderLessonContent(lesson,options){
 try{return renderLessonDocument(documentForLesson(lesson),options);}catch{return '<p class="error" role="alert">This lesson content could not be displayed. Please ask your teacher to review it.</p>';}
}
let mathLibrary;
export async function hydrateLessonMath(root){
 await hydrateInteractives(root);
 const nodes=[...root.querySelectorAll('.math-source:not([data-typeset])')];if(!nodes.length)return;
 if(!document.querySelector('link[data-math-style]')){const link=document.createElement('link');link.rel='stylesheet';link.href='/vendor/katex.min.css';link.dataset.mathStyle='true';document.head.append(link);}
 try{const {mathHTML}=await (mathLibrary??=import('/vendor/math-render.js'));for(const node of nodes){if(!node.isConnected)continue;try{node.innerHTML=mathHTML(node.dataset.mathTex,node.dataset.mathDisplay==='true');node.dataset.typeset='true';}catch{node.classList.add('math-error');node.setAttribute('role','alert');node.title='Equation could not be parsed. Ask your teacher to review its source.';node.dataset.typeset='error';}}}catch{mathLibrary=null;for(const node of nodes)node.title='Equation display could not load. Reconnect to display the saved mathematical source.';}
}
let interactiveLibrary;
async function hydrateInteractives(root){
 const nodes=[...root.querySelectorAll('.math-interactive:not([data-ready])')];if(!nodes.length)return;
 if(!document.querySelector('link[data-interactive-style]')){const link=document.createElement('link');link.rel='stylesheet';link.href='/math-interactives.css';link.dataset.interactiveStyle='true';document.head.append(link);}
 try{const module=await(interactiveLibrary??=import('./math-interactives.js'));for(const node of nodes){if(!node.isConnected||node.dataset.ready)continue;try{module.mountInteractive(node);node.dataset.ready='true';}catch(error){node.textContent=error.message;node.setAttribute('role','alert');}}}catch{interactiveLibrary=null;for(const node of nodes)node.textContent='Interactive controls could not load. Reconnect and reopen this lesson.';}
}
