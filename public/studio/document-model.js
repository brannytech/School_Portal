// Pure conversion between the saved lesson format (a list of typed blocks) and the
// continuous editor document (one flow of text with "lessonBlock" items in it).
// The saved format stays exactly as the server validates it, so nothing is migrated.

export const ATOM_TYPES=['equation','graph','math-tool','table','video','image','worked-example','objectives','summary','real-life','experiment','hint','warning','widget'];
export const BLOCK_LABELS={'rich-text':'Text',heading:'Heading',paragraph:'Paragraph',equation:'Equation',graph:'Interactive graph','math-tool':'Mathematics toolkit',table:'Table',video:'YouTube video',image:'Image','worked-example':'Worked example',objectives:'Learning objectives',summary:'Summary','real-life':'Real-life application',experiment:'Experiment',hint:'Hint',warning:'Important note',widget:'Topic tool',separator:'Divider'};

const uid=()=>globalThis.crypto?.randomUUID?.()||'b'+Math.random().toString(36).slice(2)+Date.now().toString(36);
const paragraph=text=>({type:'paragraph',...(text?{content:[{type:'text',text}]}:{})});

export function hasContent(node){
 if(!node)return false;
 if(node.type==='text')return !!node.text?.trim();
 if(node.type==='inlineMath'||node.type==='horizontalRule')return true;
 return (node.content||[]).some(hasContent);
}

// blocks -> editor content (array of top-level nodes). Always ends with a writable paragraph.
export function blocksToContent(blocks=[]){
 const out=[];
 for(const block of blocks){
  if(block.type==='rich-text'){out.push(...structuredClone(block.content?.content||[]));continue;}
  if(block.type==='heading'){out.push({type:'heading',attrs:{level:block.level},...(block.text?{content:[{type:'text',text:block.text}]}:{})});continue;}
  if(block.type==='paragraph'){out.push(paragraph(block.text));continue;}
  if(block.type==='separator'){out.push({type:'horizontalRule'});continue;}
  out.push({type:'lessonBlock',attrs:{block:structuredClone(block)}});
 }
 const last=out.at(-1);
 if(!last||last.type==='lessonBlock')out.push(paragraph(''));
 return out;
}
export const blocksToDoc=blocks=>({type:'doc',content:blocksToContent(blocks)});

// editor JSON -> blocks. Runs of text become one rich-text block; empty runs vanish.
export function docToBlocks(doc){
 const blocks=[];let run=[];
 const flush=()=>{if(run.some(hasContent))blocks.push({id:uid(),type:'rich-text',content:{type:'doc',content:structuredClone(run)}});run=[];};
 for(const node of doc?.content||[]){
  if(node.type==='lessonBlock'){flush();blocks.push(structuredClone(node.attrs.block));}
  else run.push(node);
 }
 flush();
 return blocks;
}

export function newBlock(type,extra={}){
 const defaults={
  equation:{latex:'x^2-2x-3=0',displayMode:true},
  graph:null,'math-tool':null,
  table:{caption:'Table of values',headers:['x','y'],rows:[['',''],['','']]},
  video:{videoId:''},
  image:{fileId:'',alt:'',decorative:false,caption:'',width:'medium',align:'center'},
  'worked-example':{prompt:'',explanation:'',answer:'',steps:[]},
  objectives:{items:[]},summary:{items:[]},
  'real-life':{text:''},experiment:{text:''},hint:{text:''},warning:{text:''},
  widget:{tool:'topic'}
 };
 return {id:uid(),type,...(defaults[type]||{}),...extra};
}
export {uid};
