'use client'
import {useEffect,useState,useCallback} from 'react'
import type {ScheduleTemplateOption} from '@/lib/schedule-template-utils'
import type {MakeupBusy} from '@/lib/admin-makeup-workspace'
export function useMakeupOptions(enabled:boolean,context?:{parentId:string;children:Array<string|null>;month:string;legacy?:boolean}){
 const scope=context?new URLSearchParams({parent:context.parentId,children:context.children.map(id=>id||'self').join(','),month:context.month,legacy:String(Boolean(context.legacy))}).toString():''
 const [busy,setBusy]=useState<MakeupBusy[]>([])
 const [templates,setTemplates]=useState<ScheduleTemplateOption[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(false),[version,setVersion]=useState(0)
 const [loadedVersion,setLoadedVersion]=useState<string|null>(null)
 const retry=useCallback(()=>setVersion(v=>v+1),[])
 useEffect(()=>{if(!enabled){setLoadedVersion(null);return}const controller=new AbortController();setTemplates([]);setError('');setLoading(true);setLoadedVersion(null)
  void fetch('/api/admin/makeup/options'+(scope?'?'+scope:''),{cache:'no-store',signal:controller.signal}).then(async r=>{const data=await r.json();if(!r.ok||!Array.isArray(data.templates)||scope&&!Array.isArray(data.busy))throw Error(data.error||'อ่านรอบเรียนไม่สำเร็จ');if(!controller.signal.aborted){setTemplates(data.templates);setBusy(data.busy||[]);setLoadedVersion(version+scope)}}).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'อ่านรอบเรียนไม่สำเร็จ')}).finally(()=>{if(!controller.signal.aborted)setLoading(false)})
  return()=>controller.abort()
 },[enabled,version,scope]);return{templates,busy,error,loading,retry,ready:enabled&&!loading&&loadedVersion===version+scope}
}
