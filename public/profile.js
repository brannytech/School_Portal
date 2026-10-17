'use strict';

function profileAvatar(account,large=false) {
 return `<span class="avatar${large?' avatar-large':''}">${account.photoId?`<img src="/api/profile-photo/${encodeURIComponent(account.id)}?v=${encodeURIComponent(account.photoId)}" alt="${esc(account.name)}’s profile photo">`:esc(initials(account.name))}</span>`;
}
function profileButton(account,sidebar=false) {
 return `<button class="account-button${sidebar?' account-summary':''}" data-action="account-open" aria-label="Open profile and sign out" aria-haspopup="dialog">${profileAvatar(account)}${sidebar?`<span><strong>${esc(account.name)}</strong><small>View profile · Sign out</small></span>`:'<span class="account-label">Profile</span>'}</button>`;
}
const renderWithSchoolBrand=render;
render=function() {
 renderWithSchoolBrand();
 if(!user)return;
 const avatar=document.querySelector('.topbar>.row>.avatar');
 if(avatar)avatar.outerHTML=profileButton(user);
 const school=document.querySelector('.sidebar>.school');
 if(school)school.innerHTML=profileButton(user,true);
 const footer=document.querySelector('.sidebar-bottom .profile');
 if(footer)footer.innerHTML=btn('logout',icon('logout')+' Sign out','subtle account-footer-logout');
};

function registrationPhotoFields() {
 return `<div class="field profile-photo-field"><label for="registration-photo">Initial profile photo <span class="muted">(required for students)</span></label><input id="registration-photo" name="profilePhoto" type="file" accept="image/jpeg,image/png" required aria-describedby="registration-photo-help"><p id="registration-photo-help" class="small muted">Upload the student’s photo. They can update it later from Profile. JPEG or PNG, up to 10 MB before compression.</p><div class="profile-photo-preview"></div></div>`;
}
function openAccount(account=user) {
 const own=account.id===user.id;
 const photoHelp=own?'Choose a clear photo of yourself.':'Upload a clear photo of this student.';
 const canUpdate=user.role==='ADMIN'||account.role!=='STUDENT'||!!account.photoId;
 modal(own?'Your profile':`${account.name} · Student profile`,
  `<section class="account-details">${profileAvatar(account,true)}<h3>${esc(account.name)}</h3><p class="muted small">${esc(account.email)}</p><div class="row account-badges"><span class="badge">${esc(account.role==='STUDENT'?account.class:account.role==='ADMIN'?'Administrator':'Teacher')}</span>${account.admission?`<span class="badge gray">${esc(account.admission)}</span>`:''}<span class="badge gray">${esc(account.status)}</span></div></section>
  ${canUpdate?`<form data-form="account-photo" data-id="${esc(account.id)}" class="gap"><div class="field"><label for="profile-photo">${account.photoId?'Update profile photo':'Upload initial profile photo'}</label><input id="profile-photo" name="profilePhoto" type="file" accept="image/jpeg,image/png" required aria-describedby="profile-photo-help"><p id="profile-photo-help" class="small muted">${photoHelp} JPEG or PNG, up to 10 MB before compression.</p><div class="profile-photo-preview"></div></div><p class="error" role="alert" id="profile-photo-error"></p><button class="primary" type="submit">Save photo</button></form>`:'<p class="callout small">Your administrator needs to upload your initial photo. Once added, you can update it here.</p>'}
  ${own?`<hr class="divider"><button class="danger account-logout" data-action="account-logout">${icon('logout')} Sign out of Olawale’s Lab</button>`:''}`);
}

async function uploadProfilePhoto(file,{newStudent=false,student=''}={}) {
 if(!['image/jpeg','image/png'].includes(file.type))throw Error('Choose a JPEG or PNG photo.');
 if(file.size>10*1024*1024)throw Error('Choose a photo smaller than 10 MB.');
 const image=await createImageBitmap(file),canvas=document.createElement('canvas');
 const scale=Math.min(1,640/Math.max(image.width,image.height));
 canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
 const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);image.close();
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.85));
 if(!blob)throw Error('This photo could not be read. Choose another JPEG or PNG.');
 const params=new URLSearchParams({sessionId:academicId});
 if(newStudent)params.set('newStudent','true');else if(student)params.set('student',student);
 const response=await fetch('/api/profile-photo?'+params,{method:'PUT',credentials:'same-origin',headers:{'X-CSRF-Token':csrf,'Content-Type':'image/jpeg'},body:blob});
 const result=await response.json();if(!response.ok)throw Error(result.error||'Photo could not be saved. Try again.');return result;
}

let accountSigningOut=false;
document.addEventListener('click',async event=>{
 const button=event.target.closest('[data-action]');if(!button)return;
 if(button.dataset.action==='account-open')openAccount();
 if(button.dataset.action==='account-student') {const account=state.students.find(s=>s.id===button.dataset.id);if(account)openAccount(account);}
 if(button.dataset.action==='account-logout'&&!accountSigningOut) {
  accountSigningOut=true;button.disabled=true;
  try {await api('logout',{});closeModal();for(const entry of uploadPages.values())URL.revokeObjectURL(entry.url);uploadPages.clear();files=[];recovered.clear();currentAssessment=null;user=null;csrf='';state=null;auth();toast('You have signed out.');}
  catch(error){toast(error.message);button.disabled=false;}
  finally{accountSigningOut=false;}
 }
});
document.addEventListener('change',event=>{
 const form=event.target.closest('form');
 if(form?.dataset.form==='add-user'&&event.target.name==='role')form.elements.profilePhoto.required=event.target.value==='STUDENT';
 if(event.target.name!=='profilePhoto')return;
 const preview=form?.querySelector('.profile-photo-preview');if(!preview)return;
 if(preview.dataset.url)URL.revokeObjectURL(preview.dataset.url);
 const file=event.target.files?.[0];preview.replaceChildren();delete preview.dataset.url;
 if(file&&['image/jpeg','image/png'].includes(file.type)) {const img=document.createElement('img');img.alt='Selected profile photo preview';img.src=URL.createObjectURL(file);preview.dataset.url=img.src;preview.append(img);}
});
document.addEventListener('submit',async event=>{
 const form=event.target;if(form.dataset.form!=='account-photo')return;
 event.preventDefault();event.stopImmediatePropagation();
 const button=form.querySelector('[type="submit"]');if(button.disabled)return;
 button.disabled=true;button.textContent='Saving photo…';
 const errorBox=form.querySelector('[role="alert"]');errorBox.textContent='';
 try {await uploadProfilePhoto(new FormData(form).get('profilePhoto'),{student:form.dataset.id});const id=form.dataset.id;const preview=form.querySelector('.profile-photo-preview');if(preview?.dataset.url)URL.revokeObjectURL(preview.dataset.url);await refresh();render();openAccount(id===user.id?user:state.students.find(s=>s.id===id));toast('Profile photo updated.');}
 catch(error){errorBox.textContent=error.message;button.disabled=false;button.textContent='Save photo';}
},true);
const closeProfileModal=closeModal;
closeModal=function(){document.querySelectorAll('.profile-photo-preview[data-url]').forEach(p=>URL.revokeObjectURL(p.dataset.url));closeProfileModal();};
boot();
