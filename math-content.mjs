import katex from 'katex';
import {mathOptions} from './public/math-options.js';
export function validateMathLatex(latex){
 try{katex.renderToString(latex,{...mathOptions,macros:{}});}catch{throw Object.assign(Error('Equation could not be parsed. Check its commands, brackets and matrix cells.'),{status:400});}
}
export function validateDocumentMath(document){
 const walk=node=>{if(node.type==='inlineMath')validateMathLatex(node.attrs.latex);for(const child of node.content||[])walk(child);};
 for(const block of document.blocks){if(block.type==='equation')validateMathLatex(block.latex);if(block.type==='rich-text')walk(block.content);}
}
