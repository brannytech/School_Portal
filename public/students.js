'use strict';
const canRegisterRoster=()=>user?.role==='ADMIN'||user?.role==='TEACHER'&&user.privileges?.registerStudents===true;
const canManageRoster=()=>user?.role==='ADMIN'||user?.role==='TEACHER'&&user.privileges?.manageStudents===true;
const rosterClasses=()=>user?.role==='ADMIN'?state.classes:[...new Set((state.allocations||[]).map(a=>a.class))];
const rosterFilters={search:'',class:'',status:'',page:1,pageSize:20};
let rosterData=null,rosterContext='',rosterRequest=0,rosterTimer;
names.students='Students';

function studentPage(){return staff()?heading('Your students.','Find registered students by name, email or admission number. Access follows your assigned classes.')+studentDirectory():empty('Staff access required','Your personal profile is available at the top right.','lock');}
function studentDirectory(){
 const context=user.id+'|'+academicId;
 if(rosterContext!==context){Object.assign(rosterFilters,{search:'',class:'',status:'',page:1,pageSize:20});rosterContext=context;rosterData=null;}
 const classes=rosterClasses();if(rosterFilters.class&&!classes.includes(rosterFilters.class))rosterFilters.class='';
 return `<section class="card gap" id="student-directory"><div class="section-head"><h2>Registered students</h2><div class="row">${canRegisterRoster()?btn('add-user',user.role==='ADMIN'?'Add student / teacher':'Register student','primary'):''}${user.role==='ADMIN'?btn('import-students','Import CSV')+btn('export-students','Export CSV'):''}</div></div>
 ${user.role==='TEACHER'?`<p class="small muted">${canRegisterRoster()?'Student registration enabled.':'Registration requires admin permission.'} ${canManageRoster()?'Student access management enabled.':'Approval and access changes require admin permission.'}</p>`:''}
 <div class="roster-filters"><div class="field"><label for="student-search">Search students</label><input id="student-search" type="search" placeholder="Name, email or admission number" maxlength="160" value="${esc(rosterFilters.search)}" autocomplete="off"></div><div class="field"><label for="student-class-filter">Class</label><select id="student-class-filter"><option value="">${user.role==='ADMIN'?'All classes':'All assigned classes'}</option>${options(classes,rosterFilters.class)}</select></div><div class="field"><label for="student-status-filter">Status</label><select id="student-status-filter"><option value="">All statuses</option>${options(['ACTIVE','PENDING','REJECTED','SUSPENDED','DEACTIVATED','REMOVED'],rosterFilters.status)}</select></div><div class="field"><label for="student-page-size">Per page</label><select id="student-page-size">${options([10,20,50],rosterFilters.pageSize)}</select></div></div>
 <div id="student-roster-results" aria-busy="true"><p role="status" class="small muted">Loading students…</p></div></section>`;
}
function rosterResults(data){
 if(!data.students.length)return `<p role="status" class="muted small">No students match these filters.</p>${btn('roster-reset','Clear filters')}`;
 return `<p class="small muted" role="status">Showing ${(data.page-1)*data.pageSize+1}–${Math.min(data.page*data.pageSize,data.total)} of ${data.total} students</p><div class="table-wrap"><table class="roster-table"><thead><tr><th scope="col">Student</th><th scope="col">Class</th><th scope="col">Status</th><th scope="col">Actions</th></tr></thead><tbody>${data.students.map(student=>`<tr><td><strong>${esc(student.name)}</strong><br><small class="muted">${esc(student.email)}</small><br><small class="muted">${esc(student.admission||'No admission number')}</small>${student.photoRequired&&!student.photoId?'<br><span class="badge orange">Initial photo needed</span>':''}</td><td>${esc(student.class)}</td><td><span class="badge ${student.status==='ACTIVE'?'':'gray'}">${esc(student.status)}</span></td><td><div class="row roster-actions">${btn('roster-profile','Profile','',`data-id="${student.id}" aria-label="Profile for ${esc(student.name)}"`)}${student.status==='ACTIVE'?btn('monitor-from-roster','Progress','',`data-id="${student.id}" aria-label="Progress for ${esc(student.name)}"`):''}${canManageRoster()?btn('roster-access','Manage access','',`data-id="${student.id}" aria-label="Manage access for ${esc(student.name)}"`)+btn('roster-move','Move class','',`data-id="${student.id}" aria-label="Move class for ${esc(student.name)}"`):''}${user.role==='ADMIN'?btn('advanced-account-recovery','Recovery','',`data-id="${student.id}" aria-label="Recovery token for ${esc(student.name)}"`):''}</div></td></tr>`).join('')}</tbody></table></div><nav class="roster-pagination row between gap" aria-label="Student list pages"><div class="row">${btn('roster-previous','Previous','',`${data.page===1?'disabled':''}`)}<span class="small">Page ${data.page} of ${data.pages}</span>${btn('roster-next','Next','',`${data.page===data.pages?'disabled':''}`)}</div><form data-form="roster-page" class="row"><label for="student-jump-page" class="small">Go to page</label><input id="student-jump-page" name="page" type="number" min="1" max="${data.pages}" value="${data.page}" required><button type="submit">Go</button></form></nav>`;
}
async function loadRoster(){
 const holder=document.querySelector('#student-roster-results');if(!holder||!staff())return;
 const request=++rosterRequest,account=user.id,context=academicId;
 holder.setAttribute('aria-busy','true');holder.innerHTML='<p class="small muted" role="status">Loading students…</p>';
 try{const data=await api('students?'+new URLSearchParams({sessionId:academicId,search:rosterFilters.search,studentClass:rosterFilters.class,status:rosterFilters.status,page:rosterFilters.page,pageSize:rosterFilters.pageSize}));if(request!==rosterRequest||user?.id!==account||academicId!==context||!holder.isConnected)return;rosterData=data;rosterFilters.page=data.page;holder.innerHTML=rosterResults(data);}
 catch(error){if(request===rosterRequest&&holder.isConnected)holder.innerHTML=`<p class="error" role="alert">${esc(error.message)}</p>${btn('roster-retry','Retry')}`;}
 finally{if(request===rosterRequest)holder.setAttribute('aria-busy','false');}
}
const renderBeforeDirectory=render;
render=function(){renderBeforeDirectory();if(!user||!staff())return;if(document.querySelector('#student-directory'))loadRoster();};
function rosterPerson(id){return rosterData?.students.find(s=>s.id===id);}
document.addEventListener('input',event=>{if(event.target.id!=='student-search')return;rosterFilters.search=event.target.value;rosterFilters.page=1;clearTimeout(rosterTimer);rosterTimer=setTimeout(loadRoster,250);});
document.addEventListener('change',event=>{
 const fields={'student-class-filter':'class','student-status-filter':'status','student-page-size':'pageSize'},key=fields[event.target.id];if(key){rosterFilters[key]=key==='pageSize'?Number(event.target.value):event.target.value;rosterFilters.page=1;loadRoster();}
 if(event.target.id==='privilege-teacher'){const teacher=state.teachers.find(t=>t.id===event.target.value),form=event.target.form;if(teacher){form.elements.registerStudents.checked=!!teacher.privileges?.registerStudents;form.elements.manageStudents.checked=!!teacher.privileges?.manageStudents;}}
});
document.addEventListener('click',event=>{
 const button=event.target.closest('[data-action]');if(!button)return;const action=button.dataset.action;
 if(action==='roster-retry')loadRoster();
 if(action==='roster-next'||action==='roster-previous'){rosterFilters.page+=action==='roster-next'?1:-1;loadRoster();}
 if(action==='roster-reset'){Object.assign(rosterFilters,{search:'',class:'',status:'',page:1});render();}
 const person=rosterPerson(button.dataset.id);
 if(action==='roster-profile'&&person)openAccount(person);
 if(action==='roster-access'&&person)modal('Manage student access',`<p>${esc(person.name)} · ${esc(person.class)}</p><form data-form="roster-access" data-id="${person.id}">${select('status','Account status',options(['ACTIVE','PENDING','REJECTED','SUSPENDED','DEACTIVATED','REMOVED'],person.status))}${area('reason','Reason','Record the reason for this change.',false)}<p class="small muted">Removal preserves the student’s learning records. Approval requires an initial profile photo.</p><button class="primary">Save access</button><p role="alert" class="error roster-error"></p></form>`);
 if(action==='roster-move'&&person)modal('Move student to another class',`<p>${esc(person.name)} · ${esc(person.class)}</p><form data-form="roster-move" data-id="${person.id}" data-status="${person.status}">${select('newClass','Destination class',options(rosterClasses(),person.class))}<p class="small muted">Previous academic sessions retain their original class records.</p><button class="primary">Move student</button><p role="alert" class="error roster-error"></p></form>`);
 if(action==='roster-teacher-privileges'){
  if(!state.teachers.length){toast('Add a teacher and assign their classes first.');return;}
  const teacher=state.teachers.find(t=>t.id===button.dataset.id)||state.teachers[0];modal('Assign teacher privileges',`<form data-form="roster-privileges">${select('teacher','Teacher',options(state.teachers,teacher.id)).replace('for="teacher"','for="privilege-teacher"').replace('id="teacher"','id="privilege-teacher"')}<label class="privilege-choice"><input type="checkbox" name="registerStudents" ${teacher.privileges?.registerStudents?'checked':''}><span><strong>Register students</strong><small>Create pending student accounts and upload initial photos in assigned classes.</small></span></label><label class="privilege-choice"><input type="checkbox" name="manageStudents" ${teacher.privileges?.manageStudents?'checked':''}><span><strong>Manage student access</strong><small>Approve, reject, suspend, remove and move students between assigned classes; update profile photos.</small></span></label><p class="small muted">Clearing a permission revokes it immediately. Teachers cannot grant permissions or create staff accounts.</p><button class="primary">Save privileges</button><p role="alert" class="error roster-error"></p></form>`);
 }
});
document.addEventListener('submit',async event=>{
 const form=event.target,type=form.dataset.form;if(!type?.startsWith('roster-'))return;
 event.preventDefault();event.stopImmediatePropagation();
 if(type==='roster-page'){rosterFilters.page=Number(form.elements.page.value);loadRoster();return;}
 const button=form.querySelector('button[type="submit"],button.primary');if(button.disabled)return;button.disabled=true;
 try{
  if(type==='roster-privileges')await api('teacher-privileges',{id:form.elements.teacher.value,registerStudents:form.elements.registerStudents.checked,manageStudents:form.elements.manageStudents.checked});
  if(type==='roster-access')await api('student-status',{id:form.dataset.id,status:form.elements.status.value,reason:form.elements.reason.value});
  if(type==='roster-move')await api('student-status',{id:form.dataset.id,status:form.dataset.status,newClass:form.elements.newClass.value});
  closeModal();await refresh();render();toast(type==='roster-privileges'?'Teacher privileges updated.':'Student record updated.');
 }catch(error){form.querySelector('.roster-error').textContent=error.message;button.disabled=false;}
},true);
