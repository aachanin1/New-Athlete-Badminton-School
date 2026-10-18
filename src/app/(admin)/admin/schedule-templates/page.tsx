import {createClient} from '@/lib/supabase/server'
import {ScheduleTemplatesClient} from '@/components/admin/schedule-templates-client'
import {requireSuperAdminPageAccess} from '@/lib/auth/admin'
import type {CourseTypeName} from '@/types/database'
export default async function ScheduleTemplatesPage({searchParams}:{searchParams?:Promise<Record<string,string|string[]|undefined>>}){
 await requireSuperAdminPageAccess()
 const client=await createClient(),q=searchParams?await searchParams:{}
 const [branches,courses]=await Promise.all([client.from('branches').select('id,name,slug').eq('is_active',true).order('name'),client.from('course_types').select('id,name').order('name')])
 if(branches.error||courses.error)throw Error('อ่านสาขาและประเภทคอร์สไม่สำเร็จ')
 return <ScheduleTemplatesClient branches={branches.data||[]} courseTypes={(courses.data||[]) as Array<{id:string;name:CourseTypeName}>} templates={[]} initialTab={q.tab==='closures'?'closures':'regular'}/>
}
