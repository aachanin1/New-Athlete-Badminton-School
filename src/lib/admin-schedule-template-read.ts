import 'server-only'
import {getServiceRoleClient} from '@/lib/auth/admin'
import type {CourseTypeName} from '@/types/database'
interface Row{id:string;branch_id:string;course_type_id:string;day_of_week:number;start_time:string;end_time:string;is_active:boolean;notes:string|null;branches:{name:string;slug:string}|null;course_types:{name:CourseTypeName}|null}
const courseNames={kids_group:'เด็กกลุ่ม',adult_group:'ผู้ใหญ่กลุ่ม',private:'Private'}
const days=['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์']
export async function readAdminScheduleTemplates(q:URLSearchParams){
 const rows:Row[]=[],client=getServiceRoleClient()
 for(let offset=0;;offset+=1000){const {data,error}=await client.from('schedule_templates').select('id,branch_id,course_type_id,day_of_week,start_time,end_time,is_active,notes,branches(name,slug),course_types(name)').order('id').range(offset,offset+999);if(error)throw Error('อ่านรอบเรียนไม่สำเร็จ');rows.push(...(data||[]) as unknown as Row[]);if(!data||data.length<1000)break}
 const all=rows.map(t=>({...t,branch_slug:t.branches?.slug||'',branch_name:t.branches?.name||'ไม่ทราบสาขา',course_type_name:t.course_types?.name||'kids_group',start_time:t.start_time.slice(0,5),end_time:t.end_time.slice(0,5)}))
 const search=q.get('search')?.trim().toLowerCase()||'',branch=q.get('branch')||'all',course=q.get('course')||'all',status=q.get('status')||'active',page=Number(q.get('page')||1)
 const filtered=all.filter(t=>{
  if(branch!=='all'&&t.branch_id!==branch||course!=='all'&&t.course_type_name!==course||status==='active'&&!t.is_active||status==='inactive'&&t.is_active)return false
  return !search||[t.branch_name,t.branch_slug,courseNames[t.course_type_name],days[t.day_of_week],t.start_time,t.end_time,t.notes||''].some(v=>v.toLowerCase().includes(search))
 }).sort((a,b)=>a.branch_name.localeCompare(b.branch_name,'th')||a.course_type_name.localeCompare(b.course_type_name)||a.day_of_week-b.day_of_week||a.start_time.localeCompare(b.start_time)||a.id.localeCompare(b.id))
 return {items:filtered.slice((page-1)*50,page*50),total:filtered.length,page,pageSize:50,stats:{total:all.length,active:all.filter(t=>t.is_active).length,inactive:all.filter(t=>!t.is_active).length,branches:new Set(all.map(t=>t.branch_id)).size,private:all.filter(t=>t.course_type_name==='private').length}}
}
