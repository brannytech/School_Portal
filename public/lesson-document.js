// Shared Phase 1 contract. Content is plain text, never teacher-supplied HTML or code.
export const documentLimits=Object.freeze({blocks:120,text:40000,characters:160000,items:100,rows:40,columns:12});
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
const invalid=message=>{throw Object.assign(new Error('Lesson content: '+message),{status:400});};
function shape(value,keys,label){
 if(!object(value))invalid(label+' must be an object.');
 if(Object.keys(value).some(key=>!keys.includes(key)))invalid(label+' contains an unsupported field.');
}
function text(value,label,max=documentLimits.text){
 if(typeof value!=='string'||value.length>max)invalid(label+' must be text of at most '+max+' characters.');
 return value;
}
function items(value,label){
 if(!Array.isArray(value)||value.length>documentLimits.items)invalid(label+' needs at most '+documentLimits.items+' entries.');
 return value.map(v=>text(v,label,4000));
}
export function youtubeVideoId(value){
 try{const u=new URL(value);if(u.protocol!=='https:')return null;const id=u.hostname==='youtu.be'?u.pathname.slice(1):['youtube.com','www.youtube.com','m.youtube.com','www.youtube-nocookie.com'].includes(u.hostname)?u.searchParams.get('v')||u.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1]:null;return /^[\w-]{11}$/.test(id||'')?id:null;}catch{return null;}
}
export function validateLessonDocument(input){
 shape(input,['schemaVersion','blocks'],'Document');
 if(input.schemaVersion!==1)invalid('unsupported schema version.');
 if(!Array.isArray(input.blocks)||input.blocks.length>documentLimits.blocks)invalid('use at most '+documentLimits.blocks+' blocks.');
 const ids=new Set();let characters=0;
 const blocks=input.blocks.map((block,index)=>{
  const label='Block '+(index+1);if(!object(block))invalid(label+' must be an object.');
  const fields={heading:['text','level'],paragraph:['text'],equation:['latex','displayMode'],objectives:['items'],summary:['items'],hint:['text'],warning:['text'], 'real-life':['text'],experiment:['text'],'worked-example':['prompt','explanation','answer','steps'],table:['caption','headers','rows'],video:['videoId'],widget:['tool'],separator:[]};
  if(!Object.hasOwn(fields,block.type))invalid(label+' has an unsupported block type.');
  shape(block,['id','type',...fields[block.type]],label);
  if(typeof block.id!=='string'||!/^[-\w]{1,100}$/.test(block.id)||ids.has(block.id))invalid(label+' needs a unique ID (letters, numbers, hyphens or underscores).');
  ids.add(block.id);const result={id:block.id,type:block.type};
  if(['paragraph','heading','hint','warning','real-life','experiment'].includes(block.type))result.text=text(block.text,label);
  if(block.type==='heading'){if(![1,2,3,4].includes(block.level))invalid(label+' heading level must be 1–4.');result.level=block.level;}
  if(block.type==='equation'){
   result.latex=text(block.latex,label+' equation',4000);
   if(typeof block.displayMode!=='boolean')invalid(label+' needs a displayMode boolean.');
   // Only mathematical source is accepted. Rendering is a text fallback in Phase 1.
   if(/\\(?:html\w*|href|url|includegraphics|input|include|def|gdef|newcommand|renewcommand|require|class|style)\b/i.test(result.latex))invalid(label+' equation contains an unsupported command.');
   let depth=0;for(let i=0;i<result.latex.length;i++){if(result.latex[i]==='\\'){i++;continue;}if(result.latex[i]==='{')depth++;if(result.latex[i]==='}'&&--depth<0)invalid(label+' equation has unmatched braces.');if(depth>20)invalid(label+' equation is nested too deeply.');}if(depth)invalid(label+' equation has unmatched braces.');
   result.displayMode=block.displayMode;
  }
  if(['objectives','summary'].includes(block.type))result.items=items(block.items,label);
  if(block.type==='worked-example'){
   for(const key of ['prompt','explanation','answer'])result[key]=text(block[key],label+' '+key);
   if(block.steps!==undefined)result.steps=items(block.steps,label+' steps');
  }
  if(block.type==='table'){
   result.caption=text(block.caption,label+' caption',1000);result.headers=items(block.headers,label+' headers');
   if(!result.headers.length||result.headers.length>documentLimits.columns||!Array.isArray(block.rows)||block.rows.length>documentLimits.rows)invalid(label+' table must have 1–12 columns and at most 40 rows.');
   result.rows=block.rows.map(row=>{if(!Array.isArray(row)||row.length!==result.headers.length)invalid(label+' table rows must match its headers.');return row.map(cell=>text(cell,label+' cell',4000));});
  }
  if(block.type==='video'){if(typeof block.videoId!=='string'||!/^[-\w]{11}$/.test(block.videoId))invalid(label+' needs a valid YouTube video ID.');result.videoId=block.videoId;}
  if(block.type==='widget'){if(block.tool!=='topic')invalid(label+' has an unsupported learning tool.');result.tool='topic';}
  if(block.type==='separator'&&Object.keys(block).length!==2)invalid(label+' separator contains unsupported properties.');
  characters+=JSON.stringify(result).length;if(characters>documentLimits.characters)invalid('document exceeds the total content limit.');
  return result;
 });
 return {schemaVersion:1,blocks};
}

// Reading a legacy lesson is an adapter operation; it never modifies or persists the source.
export function legacyLessonToDocument(lesson){
 const blocks=[],add=(type,data)=>blocks.push({id:'legacy-'+blocks.length,type,...data});
 const str=v=>String(v??'');
 if(lesson.objectives?.length)add('objectives',{items:lesson.objectives.map(str)});
 if(lesson.explain)add('paragraph',{text:str(lesson.explain)});
 if(lesson.example)add('worked-example',{prompt:str(lesson.example.prompt),explanation:str(lesson.example.explanation),answer:str(lesson.example.answer)});
 if(lesson.realLife)add('real-life',{text:str(lesson.realLife)});
 const videoId=youtubeVideoId(lesson.videoUrl);if(videoId)add('video',{videoId});
 if(lesson.experiment)add('experiment',{text:str(lesson.experiment)});else add('widget',{tool:'topic'});
 if(lesson.summary?.length)add('summary',{items:lesson.summary.map(str)});
 return {schemaVersion:1,blocks};
}
export function documentForLesson(lesson){return lesson.document===undefined?legacyLessonToDocument(lesson):validateLessonDocument(lesson.document);}

// Strict projection: unknown legacy fields and archival snapshots never reach a learner.
export function studentLesson(lesson){
 const output={};
 for(const key of ['id','week','order','day','title','minutes','objectives','explain','realLife','experiment','summary','videoUrl','commonMistake','discovery','confidencePrompt','steps'])if(lesson[key]!==undefined)output[key]=structuredClone(lesson[key]);
 if(lesson.example){output.example={};for(const key of ['id','prompt','kind','answer','explanation'])if(lesson.example[key]!==undefined)output.example[key]=structuredClone(lesson.example[key]);}
 try{output.document=documentForLesson(lesson);}catch{output.document={schemaVersion:1,blocks:[{id:'content-error',type:'warning',text:'This lesson content could not be displayed. Please ask your teacher to review it.'}]};}
 output.questions=(lesson.questions||[]).map(q=>Object.fromEntries(['id','prompt','kind','options','difficulty','hint','stage','objective','variables','tolerance'].filter(k=>q[k]!==undefined).map(k=>[k,structuredClone(q[k])])));
 return output;
}
