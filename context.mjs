import {AsyncLocalStorage} from 'node:async_hooks';
export const requestScope=new AsyncLocalStorage();
export const academicSession=()=>requestScope.getStore()?.sessionId;
export const academicKey=(c,s,t,session=academicSession())=>`${session}|${c}:${s}:${t}`;
