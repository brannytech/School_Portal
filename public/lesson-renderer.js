import {documentForLesson,validateLessonDocument} from './lesson-document.js';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paragraph=value=>`<div class="course-text">${escape(value)}</div>`;
const list=values=>`<ul>${values.map(value=>`<li>${escape(value)}</li>`).join('')}</ul>`;
function renderBlock(block,renderWidget){
 switch(block.type){
  case 'heading':return `<h${block.level}>${escape(block.text)}</h${block.level}>`;
  case 'paragraph':return paragraph(block.text);
  case 'equation':return `<figure class="lesson-equation ${block.displayMode?'display-equation':''}"><code aria-label="Mathematical source">${escape(block.latex)}</code></figure>`;
  case 'objectives':return list(block.items);
  case 'summary':return '<h3>Remember these ideas</h3>'+list(block.items);
  case 'worked-example':return '<h3>Worked example</h3>'+paragraph(block.prompt)+`<details><summary>Show the method</summary>${paragraph(block.explanation)}${block.steps?.length?list(block.steps):''}<strong>${escape(block.answer)}</strong></details>`;
  case 'real-life':return '<h3>A real-life connection</h3>'+paragraph(block.text);
  case 'experiment':return '<h3>Try an experiment</h3>'+paragraph(block.text);
  case 'hint':case 'warning':return `<aside class="callout"><strong>${block.type==='hint'?'Hint':'Important note'}</strong>${paragraph(block.text)}</aside>`;
  case 'separator':return '<hr class="divider">';
  case 'table':return `<div class="table-wrap"><table><caption>${escape(block.caption)}</caption><thead><tr>${block.headers.map(value=>`<th scope="col">${escape(value)}</th>`).join('')}</tr></thead><tbody>${block.rows.map(row=>`<tr>${row.map(value=>`<td>${escape(value)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  case 'video':return `<h3>Watch and learn</h3><div class="course-video"><iframe loading="lazy" src="https://www.youtube-nocookie.com/embed/${block.videoId}" title="Lesson video" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`;
  case 'widget':return renderWidget?renderWidget():'';
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
