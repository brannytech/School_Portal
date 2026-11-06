// Parent report (plan section 13): preview, edit the wording, save, release, print or save as PDF. No public links.
let reportState={student:'',from:'',to:'',reports:[],savedId:'',status:'',students:null,versions:[]};
const reportTone={DRAFT:'Draft',REVIEWED:'Reviewed',RELEASED:'Released'};
const reportDate=v=>v?new Date(v).toLocaleDateString('en-NG',{day:'numeric',month:'short',year:'numeric',timeZone:'Africa/Lagos'}):'';
function reportShell(){
 return `<section class="card report-controls"><h3>Parent report</h3><p class="small muted">One to two pages per child, built from the same figures as the Support board. You can edit the wording before it is saved. Release is by the administrator. Nothing is sent to anyone: download or print it and share it through the school's usual channel.</p>
 <div class="report-form"><div class="field"><label for="rp-s">Child</label><select id="rp-s"><option value="">Loading…</option></select></div><div class="field"><label for="rp-f">From (optional)</label><input id="rp-f" type="date" value="${esc(reportState.from)}"></div><div class="field"><label for="rp-t">To (optional)</label><input id="rp-t" type="date" value="${esc(reportState.to)}"></div></div>
 <p class="small muted">Leave the dates empty to use all work this term.</p>${btn('report-preview','Preview this child','primary')} ${btn('report-class','Preview the whole class')}<p class="error" role="alert" id="report-error"></p></section><div id="report-out" aria-live="polite"></div>`;
}
async function reportLoadStudents(){
 const select=document.querySelector('#rp-s');if(!select||reportState.students===false)return;
 try{if(!reportState.students)reportState.students=(await api('support?'+new URLSearchParams(ctx()))).students.map(x=>({id:x.id,name:x.name})).sort((a,b)=>a.name.localeCompare(b.name));
  select.innerHTML=reportState.students.map(x=>`<option value="${esc(x.id)}" ${x.id===reportState.student?'selected':''}>${esc(x.name)}</option>`).join('')||'<option value="">No students in this class</option>';}
 catch(error){select.innerHTML='<option value="">Could not load</option>';}
}
function reportParams(extra={}){return new URLSearchParams({...ctx(),...(reportState.from?{from:reportState.from}:{}),...(reportState.to?{to:reportState.to}:{}),...extra});}
function reportSheet(r,{editable=true,index=0}={}){
 const g=r.glance,period=r.period.from||r.period.to?`${reportDate(r.period.from)||'start'} to ${reportDate(r.period.to)||'today'}`:'All work this term';
 const crest=schoolBrand().crest?`<img class="report-crest" src="${esc(schoolBrand().crest)}" alt="">`:'';
 const rows=r.sections.map(s=>`<tr><td>${esc(s.subject)}</td><td>${esc(s.teacher||'')}</td><td>${s.overall===null?'Not enough work yet':s.overall+'%'}</td><td>${esc(s.band||'–')}</td><td>${s.engagement===null?'–':s.engagement+'%'}</td><td>${s.assignments.submitted}/${s.assignments.assigned}${s.assignments.late?` (${s.assignments.late} late)`:''}</td><td>${s.trend==='improving'?'Improving':s.trend==='slipping'?'Slipping':s.trend==='steady'?'Steady':'–'}</td></tr>`).join('');
 const analysis=r.sections.map((s,i)=>`<div class="report-subject"><h4>${esc(s.subject)}</h4>
  <p class="small"><strong>Strengths:</strong> ${s.strengths.length?s.strengths.map(x=>esc(x.topic)+' ('+x.score+'%)').join(', '):'None measured yet'}<br><strong>Needs help:</strong> ${s.weaknesses.length?s.weaknesses.map(x=>esc(x.topic)+' ('+x.score+'%, '+x.answers+' answers)').join(', '):'None'}${s.skillNeedsHelp.length?'<br><strong>Skill to practise:</strong> '+s.skillNeedsHelp.map(x=>esc(x.name)+' ('+x.score+'%)').join(', '):''}${s.tests.length?'<br><strong>Tests:</strong> '+s.tests.map(x=>esc(x.type)+' '+x.score+'/'+x.max).join(', '):''}</p>
  ${editable?`<textarea class="report-edit" data-report-subject="${esc(s.subject)}" rows="3" maxlength="1500" aria-label="${esc(s.subject)} comment">${esc(s.comment)}</textarea>`:`<p>${esc(s.comment)}</p>`}</div>`).join('');
 const tips=r.homeSuggestions.join('\n');
 return `<article class="report-sheet" data-report-index="${index}"><header class="report-head">${crest}<div><h2>${esc(r.school.name)}</h2>${r.school.motto?`<p class="small">${esc(r.school.motto)}</p>`:''}${r.school.address||r.school.phone?`<p class="small">${esc([r.school.address,r.school.phone].filter(Boolean).join(' · '))}</p>`:''}</div><div class="report-title"><strong>PROGRESS REPORT</strong><span class="small">${esc(period)}</span><span class="small">Generated ${esc(reportDate(r.generatedAt))}</span></div></header>
 <div class="report-child"><div><strong>${esc(r.student.name)}</strong></div><div>Admission: ${esc(r.student.admission||'–')}</div><div>Class: ${esc(r.student.class)}</div><div>Session: ${esc(r.session)} · Term ${esc(r.term)}</div></div>
 <section><h3>At a glance</h3><p>Understanding: <strong>${g.overall===null?'Not enough work yet to judge':g.overall+'% ('+esc(g.band)+')'}</strong> · Lessons completed: <strong>${g.engagement===null?'–':g.engagement+'%'}</strong> · Assignments handed in: <strong>${g.assignments.submitted} of ${g.assignments.assigned}</strong>${g.assignments.late?` (${g.assignments.late} late)`:''}</p></section>
 <section><h3>Subjects</h3><div class="table-wrap"><table><thead><tr><th>Subject</th><th>Teacher</th><th>Understanding</th><th>Band</th><th>Lessons done</th><th>Assignments</th><th>Trend</th></tr></thead><tbody>${rows||'<tr><td colspan="7">No subject has released work for this class yet.</td></tr>'}</tbody></table></div></section>
 <section><h3>Subject analysis</h3>${analysis}</section>
 <section><h3>Overall comment</h3>${editable?`<textarea class="report-edit" data-report-overall rows="4" maxlength="2000" aria-label="Overall comment">${esc(r.overallComment)}</textarea>`:`<p>${esc(r.overallComment)}</p>`}</section>
 <section><h3>Suggestions for home</h3>${editable?`<textarea class="report-edit" data-report-tips rows="4" maxlength="1500" aria-label="Home suggestions, one per line">${esc(tips)}</textarea><p class="small muted report-noprint">One suggestion per line, up to five.</p>`:`<ul>${r.homeSuggestions.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`}</section>
 <section class="report-sign"><div>Class teacher ______________________</div><div>Head teacher${r.school.principal?' ('+esc(r.school.principal)+')':''} ______________________</div></section>
 <footer class="small muted">${esc(r.footer)}<br>Generated by ${esc(r.school.name)} learning portal.</footer></article>`;
}
function reportActions(){
 return `<div class="report-actions report-noprint">${btn('report-save-draft','Save draft')} ${btn('report-save-reviewed','Mark as reviewed')} ${user.role==='ADMIN'?btn('report-release','Release','primary'):''} ${btn('report-print','Print / save as PDF')}</div>
 <p class="small muted report-noprint" id="report-status" role="status">${reportState.status?`Saved as ${reportTone[reportState.status]}.`:'Not saved yet.'}</p>`;
}
function reportCollect(){
 const sheet=document.querySelector('.report-sheet');if(!sheet)return {};
 const subjectComments=Object.fromEntries([...sheet.querySelectorAll('[data-report-subject]')].map(el=>[el.dataset.reportSubject,el.value]));
 return {subjectComments,overallComment:sheet.querySelector('[data-report-overall]')?.value||'',homeSuggestions:(sheet.querySelector('[data-report-tips]')?.value||'').split('\n').map(v=>v.trim()).filter(Boolean)};
}
document.addEventListener('change',event=>{
 if(event.target.id==='rp-s')reportState.student=event.target.value;
 if(event.target.id==='rp-f')reportState.from=event.target.value;
 if(event.target.id==='rp-t')reportState.to=event.target.value;
});
document.addEventListener('click',async event=>{
 const button=event.target.closest('[data-action^="report-"]');if(!button||!staff())return;const action=button.dataset.action,out=document.querySelector('#report-out'),error=document.querySelector('#report-error');
 if(error)error.textContent='';
 try{
  if(action==='report-preview'){
   const id=document.querySelector('#rp-s')?.value||reportState.student;if(!id){if(error)error.textContent='Choose a child first.';return;}
   reportState.student=id;reportState.savedId='';reportState.status='';out.innerHTML='<p class="muted">Building the report…</p>';
   const [{report},{reports}]=await Promise.all([api('report-draft?'+reportParams({student:id})),api('report-list?'+new URLSearchParams({...ctx(),student:id}))]);
   reportState.reports=[report];reportState.versions=reports;
   out.innerHTML=reportActions()+reportSheet(report)+reportVersions(reports);return;
  }
  if(action==='report-class'){
   out.innerHTML='<p class="muted">Building every report in the class…</p>';
   const {reports}=await api('report-draft?'+reportParams());reportState.reports=reports;
   out.innerHTML=`<p class="report-noprint small muted">${reports.length} drafts built from the current figures. Print them together (one child per page). To edit and release a report, preview that child on their own.</p><div class="report-actions report-noprint">${btn('report-print','Print / save all as PDF','primary')}</div>`+reports.map((r,i)=>reportSheet(r,{editable:false,index:i})).join('');return;
  }
  if(['report-save-draft','report-save-reviewed','report-release'].includes(action)){
   const status=action==='report-release'?'RELEASED':action==='report-save-reviewed'?'REVIEWED':'DRAFT';
   if(status==='RELEASED'&&!confirm('Release this report? A released report is saved as it is now and cannot be edited. You can start a new version later.'))return;
   const {report}=await api('report-save?'+reportParams(),{student:reportState.student,id:reportState.savedId||undefined,status,...reportCollect()});
   reportState.savedId=status==='RELEASED'?'':report.id;reportState.status=status;
   const {reports}=await api('report-list?'+new URLSearchParams({...ctx(),student:reportState.student}));reportState.versions=reports;
   document.querySelector('#report-status').textContent=`Saved as ${reportTone[status]}${status==='RELEASED'?' (version '+report.version+'). It is now fixed. Preview again to start a new version.':'.'}`;
   const holder=document.querySelector('#report-versions');if(holder)holder.outerHTML=reportVersions(reports);return;
  }
  if(action==='report-print'){reportPrint();return;}
  if(action==='report-open'){
   const {report}=await api('report-get?'+new URLSearchParams({...ctx(),id:button.dataset.id,download:'1'}));
   reportState.savedId='';reportState.status=report.status;out.innerHTML=`<div class="report-actions report-noprint">${btn('report-print','Print / save as PDF','primary')}</div><p class="small muted report-noprint">Saved ${esc(reportTone[report.status])} version ${report.version} (${esc(reportDate(report.created))}). The numbers and wording are exactly as saved.</p>`+reportSheet(report.data,{editable:false})+reportVersions(reportState.versions);return;
  }
 }catch(e){if(error)error.textContent=e.message;else toast(e.message);}
});
function reportVersions(list){
 return `<section class="card report-noprint" id="report-versions"><h3>Saved versions</h3>${list.length?`<ul class="support-plans">${list.map(v=>`<li class="support-plan">Version ${v.version} · <strong>${esc(reportTone[v.status])}</strong> · ${esc(reportDate(v.created))} by ${esc(v.createdBy||'')}${v.releasedAt?' · released '+esc(reportDate(v.releasedAt)):''}${v.downloads?' · opened '+v.downloads+' time'+(v.downloads===1?'':'s'):''} ${btn('report-open','Open','subtle','data-id="'+esc(v.id)+'"')}</li>`).join('')}</ul>`:'<p class="muted">Nothing saved for this child yet.</p>'}</section>`;
}
new MutationObserver(()=>{const select=document.querySelector('#rp-s');if(select&&!select.dataset.loaded){select.dataset.loaded='1';reportLoadStudents();}}).observe(document.body,{childList:true,subtree:true});

// Print in a clean frame so only the report pages are printed, one child per A4 page.
function reportPrint(){
 const sheets=[...document.querySelectorAll('.report-sheet')];if(!sheets.length)return;
 const html=sheets.map(sheet=>{const copy=sheet.cloneNode(true);
  copy.querySelectorAll('textarea').forEach(t=>{const p=document.createElement(t.hasAttribute('data-report-tips')?'ul':'p');if(t.hasAttribute('data-report-tips'))t.value.split('\n').filter(Boolean).forEach(line=>{const li=document.createElement('li');li.textContent=line;p.append(li);});else p.textContent=t.value;t.replaceWith(p);});
  copy.querySelectorAll('.report-noprint').forEach(n=>n.remove());return copy.outerHTML;}).join('');
 const frame=document.createElement('iframe');frame.setAttribute('aria-hidden','true');frame.style.cssText='position:fixed;right:0;bottom:0;width:0;height:0;border:0';document.body.append(frame);
 const doc=frame.contentDocument;doc.open();doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>Progress report</title><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/brand.css"><link rel="stylesheet" href="/monitoring.css"><style>@page{size:A4;margin:14mm}body{background:#fff}.report-sheet{border:0;margin:0 auto;padding:0;max-width:none;page-break-after:always}.report-sheet:last-child{page-break-after:auto}</style></head><body>${html}</body></html>`);doc.close();
 const go=()=>{frame.contentWindow.focus();frame.contentWindow.print();setTimeout(()=>frame.remove(),2000);};
 const imgs=[...doc.images];Promise.all(imgs.map(i=>i.complete?1:new Promise(r=>{i.onload=i.onerror=r;}))).then(()=>setTimeout(go,300));
}
