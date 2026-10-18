import {db} from './store.mjs';
import {academicSession} from './context.mjs';

export function adminDirectory({endpoint,method,url,u,json,fail}){
 if(endpoint!=='admin-directory'||method!=='GET')return false;
 if(u.role!=='ADMIN')fail(403,'Administrator access required.');
 const p=url.searchParams,kind=p.get('kind')||'teachers',search=(p.get('search')||'').trim().slice(0,160).toLocaleLowerCase();
 const classFilter=p.get('filterClass')||'',subject=p.get('filterSubject')||'',assignment=p.get('assignment')||'',status=p.get('status')||'';
 const size=Number(p.get('pageSize')||10),requested=Number(p.get('page')||1);
 if(!['teachers','subjects','allocations'].includes(kind)||![10,20,50].includes(size)||!Number.isSafeInteger(requested)||requested<1)fail(400,'Choose a valid directory, page and page size.');
 if(classFilter&&!db.classes.includes(classFilter)||subject&&!db.subjects.includes(subject)||assignment&&!['assigned','unassigned'].includes(assignment)||status&&!['ACTIVE','PENDING','REJECTED','REMOVED','SUSPENDED','DEACTIVATED'].includes(status))fail(400,'Choose valid directory filters.');
 const teachers=db.users.filter(t=>t.role==='TEACHER'),names=new Map(teachers.map(t=>[t.id,t])),allocations=db.allocations.filter(a=>a.sessionId===academicSession());
 const matches=a=>(!classFilter||a.class===classFilter)&&(!subject||a.subject===subject);
 const contains=values=>!search||values.some(v=>String(v||'').toLocaleLowerCase().includes(search));
 let rows;
 if(kind==='teachers')rows=teachers.flatMap(t=>{
  const all=allocations.filter(a=>a.teacher===t.id),selected=all.filter(matches);
  if(status&&t.status!==status||assignment==='assigned'&&!all.length||assignment==='unassigned'&&all.length||(classFilter||subject)&&!selected.length||!contains([t.name,t.email,...selected.flatMap(a=>[a.class,a.subject])]))return [];
  return [{id:t.id,name:t.name,email:t.email,status:t.status,privileges:t.privileges||{},classes:[...new Set(selected.map(a=>a.class))].sort(),subjects:[...new Set(selected.map(a=>a.subject))].sort(),assignmentCount:all.length}];
 });
 if(kind==='subjects')rows=db.subjects.flatMap(name=>{
  const all=allocations.filter(a=>a.subject===name),selected=all.filter(matches);
  if(subject&&name!==subject||classFilter&&!selected.length||assignment==='assigned'&&!all.length||assignment==='unassigned'&&all.length||!contains([name,...selected.map(a=>names.get(a.teacher)?.name)]))return [];
  return [{id:name,name,teacherCount:new Set(selected.map(a=>a.teacher)).size,classes:[...new Set(selected.map(a=>a.class))].sort(),assignmentCount:all.length}];
 });
 if(kind==='allocations')rows=allocations.filter(a=>matches(a)&&(!status||names.get(a.teacher)?.status===status)&&assignment!=='unassigned'&&contains([names.get(a.teacher)?.name,names.get(a.teacher)?.email,a.subject,a.class])).map(a=>({id:a.id,name:names.get(a.teacher)?.name||'Unknown teacher',email:names.get(a.teacher)?.email||'',teacher:a.teacher,class:a.class,subject:a.subject}));
 rows.sort((a,b)=>a.name.localeCompare(b.name,'en',{numeric:true,sensitivity:'base'})||a.id.localeCompare(b.id));
 const total=rows.length,pages=Math.max(1,Math.ceil(total/size)),page=Math.min(requested,pages);
 json({kind,items:rows.slice((page-1)*size,page*size),total,page,pages,pageSize:size});return true;
}
