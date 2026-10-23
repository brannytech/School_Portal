import {MathfieldElement} from 'mathlive';
MathfieldElement.fontsDirectory='/vendor/mathlive-fonts';
MathfieldElement.soundsDirectory=null;
export function makeMathField(value,onInput){
 const field=new MathfieldElement();field.value=value;field.mathVirtualKeyboardPolicy='manual';field.setAttribute('aria-label','Visual equation editor');field.addEventListener('input',()=>onInput(field.value));return field;
}
export function showMathKeyboard(container){window.mathVirtualKeyboard.container=container;window.mathVirtualKeyboard.show();}
export function hideMathKeyboard(){window.mathVirtualKeyboard?.hide();}
