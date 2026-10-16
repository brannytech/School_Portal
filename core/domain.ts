export type Role = 'ADMIN' | 'TEACHER' | 'STUDENT';
export type AccountStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED' | 'REJECTED' | 'REMOVED';
export type ReleaseStatus = 'DRAFT' | 'SCHEDULED' | 'LOCKED' | 'UNLOCKED' | 'ARCHIVED';
export interface Question {
  id: string; prompt: string; answer: string; explanation: string;
  kind: 'numeric' | 'choice' | 'boolean' | 'short' | 'fill' | 'matching' | 'steps' | 'graph' | 'expression';
  tolerance?: number; variables?: string[]; options?: string[];
  difficulty?: string; stage?: 'diagnostic' | 'practice' | 'application' | 'quiz';
}
export interface MasteryPolicy { developing: number; proficient: number; mastered: number; completion: number; noteMaximum: number; noteIncludedInCA: boolean; }
export const defaultPolicy: MasteryPolicy = {developing:50,proficient:70,mastered:85,completion:60,noteMaximum:10,noteIncludedInCA:false};
export function masteryBand(score:number,policy:MasteryPolicy=defaultPolicy):string {
  if(score>=policy.mastered)return 'Mastered'; if(score>=policy.proficient)return 'Proficient'; if(score>=policy.developing)return 'Developing';return 'Needs Improvement';
}
export function normaliseAnswer(value:unknown):string {return String(value??'').trim().toLowerCase().replace(/[−–]/g,'-').replace(/\s+/g,'');}
export function calculate(expression:string,variables:Record<string,number>={}):number {
  const source=expression.replace(/×/g,'*').replace(/÷/g,'/').replace(/[−–]/g,'-').replace(/²/g,'^2').replace(/³/g,'^3').replace(/π/g,'pi').replace(/\s+/g,'').toLowerCase();
  const raw=source.match(/(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|[a-z]+|[()+\-*/^]/g)||[];
  if(raw.join('')!==source||raw.length>150)throw Error('Use numbers, variables and supported mathematical operations.');
  const tokens:string[]=[];for(const token of raw){const prev=tokens.at(-1);if(prev&&(prev===')'||/^\d|^\./.test(prev)||prev in variables||prev==='pi')&&(token==='('||/^\d|^\./.test(token)||/^[a-z]/.test(token)))tokens.push('*');tokens.push(token);}
  let index=0;
  function atom():number {const token=tokens[index++];if(!token)throw Error('Incomplete expression.');if(token==='-')return -expressionAt(3);if(token==='+')return expressionAt(3);if(token==='('){const n=expressionAt(0);if(tokens[index++]!==')')throw Error('Close the bracket.');return n;}if(token==='pi')return Math.PI;if(token in variables)return variables[token]!;if(['sqrt','log','ln','sin','cos','tan','abs','exp'].includes(token)){if(tokens[index++]!=='(')throw Error('Use brackets after a function.');const n=expressionAt(0);if(tokens[index++]!==')')throw Error('Close the bracket.');const f:Record<string,(x:number)=>number>={sqrt:Math.sqrt,log:Math.log10,ln:Math.log,sin:Math.sin,cos:Math.cos,tan:Math.tan,abs:Math.abs,exp:Math.exp};return f[token]!(n);}if(!/^(?:\d|\.)/.test(token))throw Error('Unknown variable or operation.');return Number(token);}
  function expressionAt(min:number):number {let left=atom();while(index<tokens.length){const op=tokens[index]!,precedence=op==='+'||op==='-'?1:op==='*'||op==='/'?2:op==='^'?3:0;if(!precedence||precedence<min)break;index++;const right=expressionAt(precedence+(op==='^'?0:1));left=op==='+'?left+right:op==='-'?left-right:op==='*'?left*right:op==='/'?left/right:Math.pow(left,right);}return left;}
  const result=expressionAt(0);if(index!==tokens.length||!Number.isFinite(result)||Math.abs(result)>1e100)throw Error('This expression is undefined or outside the calculator range.');return result;
}
export function checkAnswer(question:Question,response:unknown):boolean {
  const answer=normaliseAnswer(response),expected=normaliseAnswer(question.answer);
  if(!answer)return false;if(answer===expected)return true;
  if(['short','choice','boolean','matching','steps','fill'].includes(question.kind))return false;
  const tolerance=question.tolerance??0.00001;
  if(question.kind==='expression'){
    const variables=question.variables||['x'];let checked=0;
    for(const n of [1.3,2.7,4.1,7.9,11.2]){const context=Object.fromEntries(variables.map((v,i)=>[v,n+i*.73]));try{const a=calculate(answer,context),b=calculate(expected,context);if(Math.abs(a-b)>tolerance*Math.max(1,Math.abs(b)))return false;checked++;}catch{return false;}}
    return checked===5; // Bounded numerical equivalence, not a symbolic proof.
  }
  try{return Math.abs(calculate(answer)-calculate(expected))<=tolerance;}catch{return false;}
}
export function gradeAssessment(questions:Question[],answers:Record<string,unknown>){
  const results=questions.map(q=>({question:q.id,correct:checkAnswer(q,answers[q.id]),answer:q.answer,explanation:q.explanation}));
  const correct=results.filter(r=>r.correct).length;return {correct,total:questions.length,percentage:questions.length?Math.round(correct/questions.length*100):0,results};
}
