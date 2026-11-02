'use strict';
// School profile card for the administrator: name, motto, colour, crest, building photo and report header lines.
let schoolProfile=null;
function schoolProfileCard(){
 return `<section class="card gap" id="school-profile"><div class="section-head"><h2>School profile</h2></div><p class="small muted">This is what your students and staff see on the sign-in page and inside the app. It is only ever shown for your school.</p><div id="school-profile-body" aria-busy="true"><p class="small muted" role="status">Loading…</p></div></section>`;
}
const baseAdminView=admin;
admin=function(){const html=baseAdminView();const marker='<section class="card gap" id="admin-directory">';setTimeout(loadSchoolProfile,0);return html.includes(marker)?html.replace(marker,schoolProfileCard()+marker):html;};
async function loadSchoolProfile(){
 const holder=document.querySelector('#school-profile-body');if(!holder||user?.role!=='ADMIN')return;
 try{schoolProfile=await api('brand-settings');renderSchoolProfile(holder);}catch(e){holder.innerHTML=`<p class="error" role="alert">${esc(e.message)}</p>`;}
 finally{holder.setAttribute('aria-busy','false');}
}
function renderSchoolProfile(holder){
 const b=schoolProfile;
 const picture=(kind,label,url)=>`<div class="field"><label>${label}</label><div class="row">${url?`<img src="${esc(url)}" alt="${esc(label)} preview" style="max-height:64px;max-width:120px;border-radius:8px;border:1px solid var(--line)">`:'<span class="small muted">None yet</span>'}</div><div class="row"><input type="file" accept="image/png,image/jpeg" data-brand-file="${kind}" aria-label="Choose ${esc(label)}">${url?btn('brand-remove','Remove','subtle',`data-kind="${kind}"`):''}</div><small class="muted">PNG or JPEG, under 2 MB.</small></div>`;
 holder.innerHTML=`<form id="school-profile-form" class="grid form-grid">
  ${field('name','School name','text',b.name)}${field('shortName','Short name (for the badge)','text',b.shortName,false)}
  ${field('motto','Motto','text',b.motto,false)}
  <div class="field"><label for="accent">Main colour</label><div class="row"><input id="accent" name="accent" type="color" value="${esc(b.accent||'#0064a8')}" aria-describedby="accent-help"><button type="button" class="subtle" data-brand-default-colour>Use the default colour</button></div><small id="accent-help" class="muted">Dark enough for white text. Leave as the default if unsure.</small></div>
  ${field('principal','Principal (shown on reports)','text',b.principal,false)}${field('phone','Phone (shown on reports)','tel',b.phone,false)}
  ${field('address','Address (shown on reports)','text',b.address,false)}
  ${picture('crest','School crest',b.crest)}${picture('photo','Building photo (sign-in page)',b.photo)}
  <div class="form-actions" style="grid-column:1/-1"><button class="primary" type="submit">Save school profile</button></div><p id="school-profile-message" role="status" class="small" style="grid-column:1/-1"></p></form>`;
}
const profileMessage=(t,bad)=>{const m=document.querySelector('#school-profile-message');if(m){m.textContent=t;m.className='small '+(bad?'error':'success');}};
async function refreshBrand(){publicConfig=await api('config');applyBrand();const side=document.querySelector('.sidebar .school');if(side)side.innerHTML=`${crestHTML()}<span>${esc(schoolBrand().name.toUpperCase())}<br>${esc(schoolBrand().motto)}</span>`;}
document.addEventListener('submit',async e=>{
 if(e.target.id!=='school-profile-form')return;e.preventDefault();
 const f=new FormData(e.target),data=Object.fromEntries(f.entries());if(e.target.dataset.defaultColour==='1')data.accent='';
 try{const r=await api('brand-settings',data);schoolProfile={...schoolProfile,...r.brand,address:data.address,phone:data.phone,principal:data.principal};await refreshBrand();profileMessage('School profile saved.');}
 catch(err){profileMessage(err.message,true);}
});
document.addEventListener('click',async e=>{
 const d=e.target.closest('[data-brand-default-colour]');if(d){const form=d.closest('form');form.accent.value='#0064a8';form.dataset.defaultColour='1';return;}
 const r=e.target.closest('[data-action="brand-remove"]');if(r){try{await api('brand-image',{kind:r.dataset.kind,remove:true});await loadSchoolProfile();await refreshBrand();}catch(err){profileMessage(err.message,true);}}
});
document.addEventListener('input',e=>{if(e.target.id==='accent')e.target.form.dataset.defaultColour='';});
document.addEventListener('change',async e=>{
 const el=e.target;if(!el.matches?.('[data-brand-file]'))return;const file=el.files?.[0];if(!file)return;
 if(file.size>2*1024*1024){profileMessage('Choose an image under 2 MB.',true);el.value='';return;}
 const data=await new Promise(res=>{const r=new FileReader();r.onload=()=>res(r.result);r.readAsDataURL(file);});
 try{await api('brand-image',{kind:el.dataset.brandFile,data});await loadSchoolProfile();await refreshBrand();profileMessage('Image updated.');}catch(err){profileMessage(err.message,true);el.value='';}
});
