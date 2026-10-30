// Publish dialog and release wording. Pure: studio.js owns state and events.
import {publicationIssues} from '../studio-checks.js';
import {esc,button} from './ui.js';

export const lessonName=(lesson,index)=>lesson.title?.trim()||'Untitled subtopic '+(index+1);

export function releaseLabel(release){
 if(!release)return 'Not published';
 if(release.available)return 'Live';
 if(release.status==='SCHEDULED')return 'Scheduled '+new Date(release.releaseAt).toLocaleString('en-NG',{timeZone:'Africa/Lagos',dateStyle:'medium',timeStyle:'short'});
 return ({DRAFT:'Draft',LOCKED:'Locked',ARCHIVED:'Archived'})[release.status]||'Not published';
}

export function publishedMessage(result){
 const n=result.released?.length||0,what=n===1?'1 subtopic':n+' subtopics';
 const detail=({SCHEDULED:what+' scheduled for release.',DRAFT:what+' kept as draft (hidden from students).',LOCKED:what+' saved and locked.'})[result.mode]||what+' now live for students.';
 return 'Published: '+detail+(result.pendingEdits?.length?' Edits to '+result.pendingEdits.length+' other subtopic'+(result.pendingEdits.length===1?'':'s')+' are still a private draft.':'');
}

export function checklistHTML(issues,all){return '<ol class="studio-checklist">'+issues.map(issue=>`<li>${esc(issue.message)} ${button('fix-issue','Go to this item',`data-issue="${all.indexOf(issue)}"`)}</li>`).join('')+'</ol>';}

export function reviewHTML(week){
 const issues=publicationIssues(week),errors=issues.filter(i=>i.severity==='error'),warnings=issues.filter(i=>i.severity==='warning');
 return {issues,html:`<div class="st-actions"><h3>${errors.length?'Fix these before publishing':'Your week is ready'}</h3>${button('hide-panel','Close checklist')}</div>${errors.length?'<h4>Must fix</h4>'+checklistHTML(errors,issues):'<p>Every subtopic has a title and teaching content.</p>'}${warnings.length?'<h4>Suggestions (you can still publish)</h4>'+checklistHTML(warnings,issues):''}<p class="small muted">Save draft keeps unfinished work private at any time.</p>`,errors:errors.length};
}

export function publishDialog(week,publish,releases){
 const issues=publicationIssues(week),inScope=i=>!i.lessonId||publish.selected.has(i.lessonId);
 const errors=issues.filter(i=>i.severity==='error'&&inScope(i)),skipped=issues.filter(i=>i.severity==='error'&&!inScope(i)),warnings=issues.filter(i=>i.severity==='warning'&&inScope(i));
 const count=publish.selected.size,needDate=publish.mode==='SCHEDULED'&&!publish.releaseAt,can=count>0&&!errors.length&&!needDate;
 const modes=[['NOW','Publish now','Students can open it straight away.'],['SCHEDULED','Schedule','Opens automatically at the date and time you choose.'],['LOCKED','Publish but keep locked','Saved for the class; students cannot open it until you unlock it.'],['DRAFT','Keep as draft','Hidden from students.']];
 const html=`<div class="st-actions"><h3>Publish week ${week.id}</h3>${button('hide-panel','Cancel')}</div>
 <fieldset class="studio-publish-lessons"><legend>Which subtopics?</legend><div class="st-actions">${button('publish-pick','Whole week','data-scope="all"')}${button('publish-pick','Only subtopics not yet live','data-scope="new"')}${button('publish-pick','None','data-scope="none"')}</div><p class="small muted">Subtopics you leave out keep what students see now. Your edits to them stay in your private draft.</p>
 ${week.lessons.map((l,i)=>`<label class="row"><input type="checkbox" data-publish-lesson value="${esc(l.id)}" ${publish.selected.has(l.id)?'checked':''}> <span><strong>${esc(lessonName(l,i))}</strong> <span class="small muted">· now: ${esc(releaseLabel(releases[l.id]))}</span></span></label>`).join('')}</fieldset>
 <fieldset class="studio-publish-mode"><legend>When should students see it?</legend>${modes.map(([v,l,d])=>`<label class="row"><input type="radio" name="publish-mode" data-publish-mode value="${v}" ${publish.mode===v?'checked':''}> <span><strong>${l}</strong><br><span class="small muted">${d}</span></span></label>`).join('')}${publish.mode==='SCHEDULED'?`<label>Release date and time<input type="datetime-local" data-publish-at value="${esc(publish.releaseAt)}"></label>`:''}</fieldset>
 ${errors.length?'<h4>Must fix first</h4>'+checklistHTML(errors,issues):''}${skipped.length?'<h4>Not ready, so not included</h4>'+checklistHTML(skipped,issues):''}${warnings.length?'<h4>Suggestions (you can still publish)</h4>'+checklistHTML(warnings,issues):''}
 <div class="st-actions">${button('publish-confirm',count===1?'Publish 1 subtopic':'Publish '+count+' subtopics',`class="primary" ${can?'':'disabled'}`)}${count===0?'<span class="small">Choose at least one subtopic.</span>':needDate?'<span class="small">Choose a release date.</span>':''}</div>`;
 return {html,issues};
}

// Subtopics that have no blocking problem start ticked.
export function defaultSelection(week){
 return new Set(week.lessons.filter(l=>!publicationIssues(week,new Set([l.id])).some(i=>i.severity==='error'&&i.lessonId===l.id)).map(l=>l.id));
}
