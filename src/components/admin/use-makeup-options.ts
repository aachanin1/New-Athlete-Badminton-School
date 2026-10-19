'use client'
import {useEffect,useState,useCallback} from 'react'
import type {ScheduleTemplateOption} from '@/lib/schedule-template-utils'
export function useMakeupOptions(enabled:boolean){
 const [templates,setTemplates]=useState<ScheduleTemplateOption[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(false),[version,setVersion]=useState(0)
 const [loadedVersion,setLoadedVersion]=useState<number|null>(null)
 const retry=useCallback(()=>setVersion(v=>v+1),[])
 useEffect(()=>{if(!enabled){setLoadedVersion(null);return}const controller=new AbortController();setTemplates([]);setError('');setLoading(true);setLoadedVersion(null)
  void fetch('/api/admin/makeup/options',{cache:'no-store',signal:controller.signal}).then(async r=>{const data=await r.json();if(!r.ok||!Array.isArray(data.templates))throw Error(data.error||'อ่านรอบเรียนไม่สำเร็จ');if(!controller.signal.aborted){setTemplates(data.templates);setLoadedVersion(version)}}).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'อ่านรอบเรียนไม่สำเร็จ')}).finally(()=>{if(!controller.signal.aborted)setLoading(false)})
  return()=>controller.abort()
 },[enabled,version]);return{templates,error,loading,retry,ready:enabled&&loadedVersion===version}
}
