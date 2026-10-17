import {db} from './store.mjs';
import {academicSession} from './context.mjs';

export const studentClass=student=>db.enrolments.find(e=>e.student===student.id&&e.sessionId===academicSession())?.class;
export const assignedClasses=user=>user.role==='ADMIN'?db.classes:[...new Set(db.allocations.filter(a=>a.teacher===user.id&&a.sessionId===academicSession()).map(a=>a.class))];
export const hasStudentPrivilege=(user,name)=>user.role==='ADMIN'||user.role==='TEACHER'&&user.privileges?.[name]===true;
export const canViewStudent=(user,student)=>student?.role==='STUDENT'&&(user.role==='ADMIN'||user.role==='TEACHER'&&assignedClasses(user).includes(studentClass(student)));
export const canEditStudentPhoto=(user,student)=>canViewStudent(user,student)&&(hasStudentPrivilege(user,'manageStudents')||!student.photoId&&hasStudentPrivilege(user,'registerStudents'));
