import {formatThaiDateWithWeekday} from '@/lib/date-format'
import {getReviewGroupKey,isReviewOrEvidenceSession,isAttendanceReviewSession,isCoachEvidenceReviewSession,isMissedSession,type BookingSessionData,type ReviewFilter} from '@/lib/admin-makeup-read-model'

export function selectMakeupReview(sessions:BookingSessionData[],filter:ReviewFilter,page:number,pageSize:number,detail?:string) {
 const all=sessions.filter(isReviewOrEvidenceSession)
 const target=(s:BookingSessionData)=>filter.session?s.id===filter.session:filter.date?s.date===filter.date:false
 const scoped=all.filter(s=>(filter.branch==='all'||s.branch_id===filter.branch)&&(filter.course==='all'||s.course_type===filter.course))
 const match=new Set(scoped.filter(s=>{
  if(filter.status==='no_coach'&&s.coach_name)return false
  if(filter.status==='waiting_attendance'&&!isAttendanceReviewSession(s))return false
  if(filter.status==='coach_evidence'&&!isCoachEvidenceReviewSession(s))return false
  if(filter.status==='coach_requested'&&!s.coach_review_requested_count)return false
  const query=filter.search.trim().toLowerCase()
  return !query||[s.learner_name,s.user_name,s.coach_name||'',s.branch_name,s.course_type,formatThaiDateWithWeekday(s.date)].some(v=>v.toLowerCase().includes(query))
 }).map(getReviewGroupKey))
 const groups=new Map<string,BookingSessionData[]>()
 for(const s of scoped)if(match.has(getReviewGroupKey(s)))groups.set(getReviewGroupKey(s),[...(groups.get(getReviewGroupKey(s))||[]),s])
 const ordered=[...groups.values()].sort((a,b)=>Number(b.some(target))-Number(a.some(target))||b[0].date.localeCompare(a[0].date)||b[0].start_time.localeCompare(a[0].start_time))
 const selected=ordered.slice((page-1)*pageSize,page*pageSize),found=detail?selected.find(rows=>getReviewGroupKey(rows[0])===detail):null
 return {sessions:detail?found||[]:selected.map(rows=>rows.find(target)||rows[0]),detailFound:!!found,groups:selected.map(rows=>({key:getReviewGroupKey(rows[0]),count:rows.length})),total:ordered.length,sessionTotal:ordered.flat().length,
  stats:{review:all.length,reviewNoCoach:all.filter(s=>!s.coach_name).length,reviewCoachEvidence:all.filter(isCoachEvidenceReviewSession).length}}
}

export function selectLegacyMakeup(sessions:BookingSessionData[],linked:BookingSessionData[],filter:ReviewFilter,page:number,pageSize:number,effective:boolean) {
 const sourceIds=new Set([...sessions,...linked].map(s=>s.rescheduled_from_id).filter(Boolean))
 const groups=new Map<string,BookingSessionData[]>()
 for(const s of sessions.filter(s=>isMissedSession(s)&&!(effective&&s.course_type==='kids_group'))){
  const id=s.child_id?`child:${s.child_id}`:s.user_id?`self:${s.user_id}`:null
  if(id)groups.set(id,[...(groups.get(id)||[]),s])
 }
 const expired=Date.now()>=Date.parse(`${new Date(Date.UTC(Number(sessions[0]?.date.slice(0,4)||2000),Number(sessions[0]?.date.slice(5,7)||1)+1,1)).toISOString().slice(0,10)}T00:00:00+07:00`)
 const ordered=[...groups.entries()].filter(([,rows])=>{
  const used=rows.some(s=>sourceIds.has(s.id))
  if(filter.status==='actionable'&&(used||expired)||filter.status==='expired'&&(!expired||used)||filter.status==='makeup'&&!used)return false
  if(filter.branch!=='all'&&!rows.some(s=>s.branch_id===filter.branch)||filter.course!=='all'&&!rows.some(s=>s.course_type===filter.course))return false
  return !filter.search||rows.some(s=>[s.learner_name,s.user_name,s.branch_name,s.course_type].some(v=>v.toLowerCase().includes(filter.search.toLowerCase())))
 }).sort((a,b)=>a[1][0].learner_name.localeCompare(b[1][0].learner_name,'th',{numeric:true,sensitivity:'base'})||a[0].localeCompare(b[0]))
 const chosen=ordered.slice((page-1)*pageSize,page*pageSize).flatMap(([,rows])=>rows),ids=new Set(chosen.map(s=>s.id))
 return {sessions:chosen,linkedSessions:linked.filter(s=>s.rescheduled_from_id&&ids.has(s.rescheduled_from_id)),total:ordered.length}
}
