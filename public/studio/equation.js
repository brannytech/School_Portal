// The equation editor: visual (MathLive) or LaTeX source, with a live preview.
import {esc} from './ui.js';

const SYMBOLS={fraction:'\\frac{a}{b}',power:'x^2',root:'\\sqrt{x}',pi:'\\pi',theta:'\\theta',sum:'\\sum_{i=1}^{n}i',integral:'\\int_0^1 x\\,dx',le:'\\le',ge:'\\ge',pm:'\\pm',log:'\\log_{10}(x)',trig:'\\sin(x)'};
const SYMBOL_LABELS=[['fraction','Fraction'],['power','Power'],['root','Root'],['pi','π'],['theta','θ'],['sum','Σ'],['integral','Integral'],['le','≤'],['ge','≥'],['pm','±'],['log','Log'],['trig','Trig']];
const b=(action,label,extra='')=>`<button type="button" data-eq="${action}" ${extra}>${label}</button>`;

// Mounts the editor in `container`. onApply(latex) receives valid LaTeX; onCancel() closes without change.
export async function mountEquationPanel(container,{latex='',title='Equation',applyLabel='Insert equation',focus=true,onApply,onCancel}){
 let current=latex,valid=true,gone=false,mathModule=null,field=null;
 container.innerHTML=`${title?`<div class="st-inspector-head"><h3>${esc(title)}</h3>${b('cancel','Close')}</div>`:''}
 <div class="st-actions st-symbols">${SYMBOL_LABELS.map(([key,label])=>b('symbol',label,`data-symbol="${key}"`)).join('')}</div>
 <label>Editing mode<select data-eq-mode><option value="visual">Visual editor</option><option value="source">LaTeX source</option></select></label>
 <div data-eq-visual><p role="status">Loading visual equation editor…</p></div>
 <label data-eq-source hidden>LaTeX<textarea data-latex rows="3">${esc(latex)}</textarea></label>
 <details><summary>Fraction and matrix templates</summary>
  <div class="st-actions"><label>Numerator<input data-numerator value="2x+3"></label><label>Denominator<input data-denominator value="x-1"></label>${b('fraction-template','Use fraction')}</div>
  <div class="st-actions"><label>Matrix rows<input data-matrix-rows type="number" min="1" max="6" value="2"></label><label>Matrix columns<input data-matrix-columns type="number" min="1" max="6" value="2"></label>${b('matrix-resize','Resize matrix')}</div>
  <div data-matrix-grid></div>${b('matrix-template','Use matrix')}
 </details>
 <div data-eq-preview class="st-equation-preview" aria-label="Equation preview"></div>
 <p data-eq-error class="error" role="alert"></p>
 <div class="st-actions">${b('apply',applyLabel,'class="primary"')}${b('keyboard','Math keyboard')}</div>`;
 const q=selector=>container.querySelector(selector);
 const drawMatrix=()=>{
  const previous=new Map([...container.querySelectorAll('[data-matrix-cell]')].map(cell=>[cell.dataset.row+':'+cell.dataset.col,cell.value]));
  const rows=Math.max(1,Math.min(6,Number(q('[data-matrix-rows]').value)||2)),cols=Math.max(1,Math.min(6,Number(q('[data-matrix-columns]').value)||2));
  q('[data-matrix-grid]').innerHTML=Array.from({length:rows},(_,r)=>`<div class="st-actions">${Array.from({length:cols},(_,c)=>`<label>Row ${r+1}, column ${c+1}<input data-matrix-cell data-row="${r}" data-col="${c}" value="${esc(previous.get(r+':'+c)??(r===c?'1':'0'))}"></label>`).join('')}</div>`).join('');
 };
 const preview=async()=>{
  const box=q('[data-eq-preview]');if(!box)return;const source=current;
  try{const {mathHTML}=await import('/vendor/math-render.js');if(gone||source!==current)return;box.innerHTML=mathHTML(source,true);q('[data-eq-error]').textContent='';valid=true;}
  catch{if(gone)return;q('[data-eq-error]').textContent='This equation could not be parsed. Check its commands, brackets and matrix cells.';valid=false;}
 };
 const set=value=>{current=value;if(field)field.value=value;q('[data-latex]').value=value;return preview();};
 const onClick=async event=>{
  const target=event.target.closest('[data-eq]');if(!target)return;event.preventDefault();const action=target.dataset.eq;
  if(action==='cancel'){hide();onCancel?.();return;}
  if(action==='symbol')await set(SYMBOLS[target.dataset.symbol]);
  if(action==='fraction-template')await set('\\frac{'+q('[data-numerator]').value+'}{'+q('[data-denominator]').value+'}');
  if(action==='matrix-template'){const rows=new Map();for(const cell of container.querySelectorAll('[data-matrix-cell]')){if(!rows.has(cell.dataset.row))rows.set(cell.dataset.row,[]);rows.get(cell.dataset.row).push(cell.value);}await set('\\begin{pmatrix}'+[...rows.values()].map(row=>row.join('&')).join('\\\\')+'\\end{pmatrix}');}
  if(action==='matrix-resize')drawMatrix();
  if(action==='keyboard'){field?.focus();mathModule?.showMathKeyboard(container);}
  if(action==='apply'){
   if(q('[data-eq-mode]').value==='source')current=q('[data-latex]').value;
   await preview();if(!valid)return;hide();onApply?.(current);
  }
 };
 const onInput=event=>{
  if(event.target.matches('[data-latex]')){current=event.target.value;if(field)field.value=current;preview();}
  if(event.target.matches('[data-eq-mode]')){q('[data-eq-visual]').hidden=event.target.value==='source';q('[data-eq-source]').hidden=event.target.value!=='source';}
 };
 const hide=()=>{mathModule?.hideMathKeyboard?.();};
 container.addEventListener('click',onClick);container.addEventListener('input',onInput);
 drawMatrix();
 try{
  mathModule=await import('/vendor/math-input.js');
  if(!gone&&container.isConnected){field=mathModule.makeMathField(current,value=>{if(q('[data-eq-mode]')?.value==='source')return;current=value;q('[data-latex]').value=value;preview();});q('[data-eq-visual]').replaceChildren(field);if(focus)field.focus();}
 }catch{if(!gone)q('[data-eq-visual]').textContent='Visual input could not load. Reconnect, or use LaTeX source.';}
 await preview();
 return {destroy(){gone=true;hide();container.removeEventListener('click',onClick);container.removeEventListener('input',onInput);}};
}
