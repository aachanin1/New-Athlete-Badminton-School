import type {CourseTypeName} from '@/types/database'
export const ADMIN_COURSES:Record<CourseTypeName,{label:string;className:string}>={
 kids_group:{label:'เด็กกลุ่ม',className:'border-blue-200 bg-blue-50 text-blue-700'},
 adult_group:{label:'ผู้ใหญ่กลุ่ม',className:'border-emerald-200 bg-emerald-50 text-emerald-700'},
 private:{label:'Private',className:'border-orange-200 bg-orange-50 text-orange-700'},
}
