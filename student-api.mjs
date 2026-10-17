import {randomUUID} from 'node:crypto';
import {db,save,hash} from './store.mjs';
import {academicSession} from './context.mjs';
import {registrationPhoto} from './profile-api.mjs';
import {assignedClasses,studentClass,hasStudentPrivilege,canViewStudent} from './student-access.mjs';

const text=(value,max=160)=>String(value??'').trim().slice(0,max);
const publicStudent=student=>({id:student.id,name:student.name,email:student.email,role:student.role,status:student.status,class:studentClass(student)||student.class,admission:student.admission||'',photoId:student.photoId,photoRequired:student.photoRequired,registeredBy:student.registeredBy});
export async function studentApi({endpoint,method,b,url,u,c,json,fail,audit,sessions}) {
 if(endpoint==='teacher-privileges'&&method==='POST') {
  if(u.role!=='ADMIN')fail(403,'Only administrators can assign teacher privileges.');
  const teacher=db.users.find(v=>v.id===b.id&&v.role==='TEACHER');if(!teacher)fail(404,'Teacher not found.');
  if(typeof b.registerStudents!=='boolean'||typeof b.manageStudents!=='boolean')fail(400,'Choose the teacher’s registration and student-management privileges.');
  teacher.privileges={registerStudents:b.registerStudents,manageStudents:b.manageStudents};
  audit(u,`Teacher privileges for ${teacher.name}: registration ${b.registerStudents?'on':'off'}, student management ${b.manageStudents?'on':'off'}`);
  await save();json({id:teacher.id,privileges:teacher.privileges});return true;
 }
 if(endpoint==='students'&&method==='GET') {
  if(!['ADMIN','TEACHER'].includes(u.role))fail(403,'Staff access required.');
  const classes=assignedClasses(u),filter=text(url.searchParams.get('studentClass')),status=text(url.searchParams.get('status')),search=text(url.searchParams.get('search')).toLocaleLowerCase();
  if(filter&&!classes.includes(filter))fail(403,'This class is not assigned to you.');
  const statuses=['PENDING','ACTIVE','REJECTED','REMOVED','SUSPENDED','DEACTIVATED'];if(status&&!statuses.includes(status))fail(400,'Choose a valid student status.');
  const size=Number(url.searchParams.get('pageSize')||20),requestedPage=Number(url.searchParams.get('page')||1);
  if(![10,20,50].includes(size)||!Number.isSafeInteger(requestedPage)||requestedPage<1)fail(400,'Choose a valid page and page size.');
  const scoped=db.users.filter(v=>canViewStudent(u,v)).map(publicStudent);
  const filtered=scoped.filter(v=>(!filter||v.class===filter)&&(!status||v.status===status)&&(!search||[v.name,v.email,v.admission].some(x=>String(x||'').toLocaleLowerCase().includes(search))));
  filtered.sort((a,b)=>a.name.localeCompare(b.name,'en',{numeric:true,sensitivity:'base'})||a.id.localeCompare(b.id));
  const total=filtered.length,pages=Math.max(1,Math.ceil(total/size)),page=Math.min(requestedPage,pages);
  json({students:filtered.slice((page-1)*size,page*size),total,pages,page,pageSize:size,classes,counts:Object.fromEntries(statuses.map(s=>[s,scoped.filter(v=>v.status===s).length]))});return true;
 }
 if(endpoint==='add-user'&&method==='POST') {
  if(!hasStudentPrivilege(u,'registerStudents'))fail(403,'Your administrator must grant student-registration access.');
  if(u.role!=='ADMIN'&&b.role!=='STUDENT')fail(403,'Teachers can register student accounts only.');
  if(!assignedClasses(u).includes(c))fail(403,'Choose one of your assigned classes.');
  if(u.role!=='ADMIN'&&academicSession()!==db.currentSessionId)fail(403,'Register students in the current academic session.');
  const email=text(b.email).toLowerCase(),name=text(b.name,100);if(!name)fail(400,'Name is required.');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail(400,'Enter a valid email.');
  if(db.users.some(v=>v.email===email))fail(409,'Email already exists.');
  if(String(b.password||'').length<10)fail(400,'Use a password of at least 10 characters.');
  const admission=text(b.admission,80);if(admission&&db.users.some(v=>v.role==='STUDENT'&&v.admission===admission))fail(409,'Admission number already exists.');
  const photo=registrationPhoto(u,b,fail),teacher=b.role==='TEACHER';
  const account={id:randomUUID(),name,email,password:hash(b.password),role:teacher?'TEACHER':'STUDENT',status:teacher?'ACTIVE':'PENDING',class:c,admission,photoRequired:!teacher,photoId:photo?.id,registeredBy:u.id};
  if(photo)photo.owner=account.id;db.users.push(account);audit(u,`Registered ${account.role}: ${name} (${c})`);await save();json(publicStudent(account),201);return true;
 }
 if(endpoint==='student-status'&&method==='POST') {
  if(!hasStudentPrivilege(u,'manageStudents'))fail(403,'Your administrator must grant student-management access.');
  const student=db.users.find(v=>v.id===b.id&&v.role==='STUDENT');if(!student||!canViewStudent(u,student))fail(404,'Student not found in your assigned classes.');
  if(!['ACTIVE','REJECTED','REMOVED','PENDING','SUSPENDED','DEACTIVATED'].includes(b.status))fail(400,'Invalid student status.');
  if(b.newClass&&!assignedClasses(u).includes(b.newClass))fail(403,'The destination class is not assigned to you.');
  if(b.status==='ACTIVE'&&student.photoRequired&&!student.photoId)fail(400,'Upload the student’s initial profile photo before approval.');
  // Validate all changes before mutating or revoking sessions.
  student.status=b.status;student.reason=text(b.reason,500);if(b.status!=='ACTIVE')await sessions.revoke(student.id);
  if(b.newClass){const enrolment=db.enrolments.find(v=>v.student===student.id&&v.sessionId===academicSession());if(enrolment)enrolment.class=b.newClass;if(academicSession()===db.currentSessionId)student.class=b.newClass;}
  audit(u,`${student.name}: ${b.status}${b.newClass?' → '+b.newClass:''}`);await save();json({ok:true});return true;
 }
 return false;
}
