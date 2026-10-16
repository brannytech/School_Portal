import type {MasteryPolicy} from './domain.js';
export interface ResultPolicy extends MasteryPolicy {weights?:{test:number;exam:number;notes:number};}
export interface Mark {score:number;max:number;type?:string;published?:boolean;status?:string;}
export function summariseResults(scores:Mark[],notes:Mark[],policy:ResultPolicy){
 const weights=policy.weights||{test:40,exam:60,notes:0};const average=(list:Mark[])=>list.length?list.reduce((sum,v)=>sum+v.score/v.max*100,0)/list.length:null;
 const components={test:average(scores.filter(s=>s.type==='Test'&&s.published!==false)),exam:average(scores.filter(s=>s.type==='Exam'&&s.published!==false)),notes:policy.noteIncludedInCA?average(notes.filter(s=>s.status==='Marked'&&s.score!==null)):null};
 const required=(Object.keys(weights) as Array<keyof typeof weights>).filter(k=>weights[k]>0);const missing=required.filter(k=>components[k]===null);const total=missing.length?null:required.reduce((sum,k)=>sum+(components[k]||0)*weights[k]/100,0);
 return {components,weights,missing,total:total===null?null:Math.round(total*100)/100};
}
