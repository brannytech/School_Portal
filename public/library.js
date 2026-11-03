'use strict';
// "Add from library": copy ready-made weeks into your own course, then edit and release them in the Content Studio.
const baseRenderForLibrary=render;
render=function(){baseRenderForLibrary();if(staff()&&['teaching','admin'].includes(page)){const open=document.querySelector('[data-action="studio-open"]');if(open&&!document.querySelector('[data-action="library-open"]'))open.insertAdjacentHTML('afterend',' '+btn('library-open','Add from library'));}};
async function openLibrary(){
 let data;try{data=await api('library');}catch(e){toast(e.message);return;}
 const allowed=user.role==='ADMIN'?null:(state.allocations||[]);
 const classes=allowed?[...new Set(allowed.map(a=>a.class))]:(state.classes||['JSS1','JSS2','JSS3','SS1','SS2','SS3']);
 const subjects=allowed?[...new Set(allowed.map(a=>a.subject))]:(state.subjects||[]);
 modal('Lesson library',`<p class="small muted">Copy ready-made weeks into your own course. The copy is yours to edit; changing it never changes the library or any other school. Copied weeks stay locked to students until you release them.</p>
 ${data.items.length?data.items.map((item,n)=>`<form class="card gap" data-library-form="${esc(item.id)}"><h3>${esc(item.title)} <span class="badge gray">version ${item.version}</span></h3>
  ${item.newerAvailable?'<p class="small success" role="status">A newer version of this item is available. Copy a week again into a new term or class to receive it; your own edits are never overwritten.</p>':''}
  <fieldset class="stack" style="border:0;padding:0"><legend class="small">Weeks to copy</legend>${item.weeks.map(w=>`<label class="row"><input type="checkbox" name="weeks" value="${w.id}" checked> Week ${w.id}: ${esc(w.title)} <span class="muted small">(${w.lessons} lessons)</span></label>`).join('')}</fieldset>
  <div class="grid three"><div class="field"><label for="lib-class-${n}">Class</label><select id="lib-class-${n}" name="class">${classes.map(c=>`<option ${c===item.class?'selected':''}>${esc(c)}</option>`).join('')}</select></div>
  <div class="field"><label for="lib-subject-${n}">Subject</label><select id="lib-subject-${n}" name="subject">${subjects.map(c=>`<option ${c===item.subject?'selected':''}>${esc(c)}</option>`).join('')}</select></div>
  <div class="field"><label for="lib-term-${n}">Term</label><select id="lib-term-${n}" name="term">${[1,2,3].map(t=>`<option value="${t}" ${t===item.term?'selected':''}>Term ${t}</option>`).join('')}</select></div></div>
  ${item.copied.length?`<p class="small muted">Already copied from this item: weeks ${[...new Set(item.copied.map(c=>c.week))].join(', ')}.</p>`:''}
  <div class="form-actions"><button class="primary" type="submit">Copy selected weeks</button></div><p class="small" role="status" data-library-message></p></form>`).join(''):'<p class="muted">The library is empty for now. Ready-made lessons appear here when the platform owner adds them. You can still write your own in the Content Studio.</p>'}`);
}
document.addEventListener('click',e=>{if(e.target.closest('[data-action="library-open"]'))openLibrary();});
document.addEventListener('submit',async e=>{
 const form=e.target.closest?.('[data-library-form]');if(!form)return;e.preventDefault();
 const f=new FormData(form),message=form.querySelector('[data-library-message]');
 try{const r=await api('library-copy',{id:form.dataset.libraryForm,weeks:f.getAll('weeks').map(Number),class:f.get('class'),subject:f.get('subject'),term:Number(f.get('term'))});
  message.className='small success';message.textContent=r.copied.length?`Copied weeks ${r.copied.join(', ')}. Open the Content Studio to edit them, then release them to students when ready.${r.message?' '+r.message:''}`:(r.message||'Nothing was copied.');
  if(r.copied.length&&typeof navigate==='function')navigate(page);}
 catch(err){message.className='small error';message.textContent=err.message;}
});
