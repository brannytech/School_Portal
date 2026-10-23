import katex from 'katex';
import {mathOptions} from '../public/math-options.js';
export function mathHTML(latex,displayMode=false){return katex.renderToString(latex,{...mathOptions,displayMode,macros:{}});}
