// The settings panel for the lesson item that is selected on the page.
import {BLOCK_LABELS} from './document-model.js';
import {youtubeVideoId} from '../lesson-document.js';
import {esc,button,input,area,select,check} from './ui.js';

const LIST_FIELDS=['items','steps','options'];

// Apply one edited field to a copy of the block. Returns {block} or {error}.
export function applyBlockEdit(block,path,value){
 const parts=path.replace(/^block\./,'').split('.'),key=parts.pop(),next=structuredClone(block);
 let target=next;for(const part of parts)target=target?.[part];
 if(target===undefined)return {error:'That field no longer exists.'};
 if(LIST_FIELDS.includes(key))value=String(value).split('\n');
 else if(key==='level')value=Number(value);
 else if(key==='video'){const id=youtubeVideoId(value);if(!id)return {error:'Use a valid HTTPS YouTube video link.'};target.videoId=id;return {block:next};}
 target[key]=value;return {block:next};
}

const tableEditor=block=>`<div class="st-table-edit">${block.headers.map((v,i)=>input('Column '+(i+1),'block.headers.'+i,v)).join('')}${block.rows.map((row,r)=>`<fieldset><legend>Row ${r+1}</legend>${row.map((v,c)=>input(block.headers[c]||'Value',`block.rows.${r}.${c}`,v)).join('')}</fieldset>`).join('')}</div><div class="st-actions">${button('table-row','Add row')}${button('table-column','Add column')}${button('table-remove-row','Remove last row')}${button('table-remove-column','Remove last column')}</div>`;

function fields(block){
 switch(block.type){
  case 'heading':case 'paragraph':case 'hint':case 'warning':case 'real-life':case 'experiment':return area('Text','block.text',block.text)+(block.type==='heading'?input('Heading level (1–4)','block.level',block.level,'number'):'');
  case 'objectives':case 'summary':return area('One point per line','block.items',block.items.join('\n'));
  case 'worked-example':return area('Question / example','block.prompt',block.prompt)+area('Explanation','block.explanation',block.explanation)+input('Answer','block.answer',block.answer)+area('Reveal steps (one per line)','block.steps',(block.steps||[]).join('\n'));
  case 'video':return input('HTTPS YouTube link','block.video',block.videoId?'https://www.youtube.com/watch?v='+block.videoId:'')+'<p class="small muted">Paste a youtube.com or youtu.be link, then press Enter to carry on writing.</p>';
  case 'table':return input('Caption','block.caption',block.caption)+tableEditor(block);
  case 'equation':return '<div data-eq-host></div>'+check('Centre as a display equation','block.displayMode',block.displayMode);
  case 'graph':case 'math-tool':return '<div data-math-author></div>';
  case 'widget':return '<p class="small muted">The existing interactive topic tool follows this lesson’s class, subject, term and topic.</p>';
  case 'image':return `${block.fileId?`<img class="st-image-thumb" src="/api/media/${encodeURIComponent(block.fileId)}" alt="">`:'<p class="small muted">No image chosen yet.</p>'}<div class="st-actions">${button('image-pick',block.fileId?'Replace image':'Choose image')}</div>`
   +area('Alternative text (what the image shows)','block.alt',block.alt,'rows="2" maxlength="500"')+'<p class="small muted">Required so learners who cannot see the picture know what it shows. Say what matters for learning, not “image of”.</p>'
   +check('This image is only decorative (no description needed)','block.decorative',block.decorative)
   +input('Caption (optional)','block.caption',block.caption)
   +select('Size','block.width',[['small','Small'],['medium','Medium'],['full','Full width']],block.width)
   +select('Alignment','block.align',[['left','Left'],['center','Centre'],['right','Right']],block.align);
  default:return '';
 }
}

export function blockInspectorHTML(block,{canMoveUp=true,canMoveDown=true}={}){
 const label=BLOCK_LABELS[block.type]||block.type;
 return `<div class="st-inspector-head"><h3>${esc(label)}</h3>${button('continue-writing','↵ Continue writing','title="Move to the line below this item (Enter or Ctrl+Enter)"')}</div>
 <div class="st-fields" data-item-editor>${fields(block)}</div>
 <div class="st-actions st-block-actions">${button('block-up','↑ Move up',canMoveUp?'':'disabled')}${button('block-down','↓ Move down',canMoveDown?'':'disabled')}${button('block-duplicate','Duplicate')}${button('block-remove','Delete','class="danger"')}</div>
 <details class="st-reuse"><summary>Reuse this item</summary><label>Template name<input data-template-name maxlength="100"></label>${button('save-template','Save private template')}</details>`;
}

export function lessonSettingsHTML(lesson,{index,count}){
 return `<div class="st-inspector-head"><h3>Subtopic</h3></div><div class="st-fields">${input('Minutes to complete','lesson.minutes',lesson.minutes||20,'number','min="1" max="240"')}</div>
 <div class="st-actions">${button('lesson-up','↑ Move up',index===0?'disabled':'')}${button('lesson-down','↓ Move down',index===count-1?'disabled':'')}${button('lesson-duplicate','Duplicate')}${button('lesson-remove','Delete subtopic','class="danger"')}</div>
 <p class="small muted">Select any item on the page to edit it here. Type <kbd>/</kbd> on an empty line to add an equation, image, graph, table or video.</p>`;
}
