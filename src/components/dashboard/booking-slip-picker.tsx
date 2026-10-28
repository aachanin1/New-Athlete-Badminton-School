'use client'
import Image from 'next/image'
import {useEffect,useRef,useState} from 'react'
import {Upload} from 'lucide-react'
import {Button} from '@/components/ui/button'

export function BookingSlipPicker({file,onFile,disabled}:{file:File|null;onFile:(f:File|null)=>void;disabled:boolean}){
 const input=useRef<HTMLInputElement>(null),[preview,setPreview]=useState(''),[error,setError]=useState('')
 useEffect(()=>{if(!file){setPreview('');return}const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url)},[file])
 return <div className="space-y-3"><h2 className="font-bold">2. แนบสลิปการโอนเงิน</h2>
  <input ref={input} className="hidden" type="file" accept="image/jpeg,image/png,image/webp" aria-label="รูปสลิปการโอนเงิน" disabled={disabled} onChange={e=>{const f=e.target.files?.[0];e.target.value='';if(!f)return;if(!['image/jpeg','image/png','image/webp'].includes(f.type.toLowerCase())){setError('รูปนี้ไม่รองรับ กรุณาเลือก JPEG, PNG หรือ WebP');return}if(!f.size||f.size>4*1024*1024){setError('รูปต้องมีขนาดไม่เกิน 4 MB กรุณาเลือกรูปที่เล็กลง');return}setError('');onFile(f)}}/>
  {preview&&<div className="rounded-xl border bg-gray-50 p-3"><Image unoptimized src={preview} alt="ภาพตัวอย่างสลิปที่เลือก ยังไม่ได้ส่ง" width={600} height={500} className="mx-auto max-h-64 w-auto max-w-full rounded-lg object-contain"/><p className="mt-2 break-all text-sm">{file?.name}</p><p role="status" className="mt-1 font-semibold text-blue-800">เลือกรูปแล้ว — กดส่งสลิปเพื่อยืนยัน</p></div>}
  <Button type="button" variant="outline" className="min-h-16 w-full border-dashed border-blue-300 bg-blue-50 text-blue-900" disabled={disabled} onClick={()=>input.current?.click()}><Upload className="mr-2 h-5 w-5"/>{file?'เปลี่ยนรูปสลิป':'เลือกหรือถ่ายรูปสลิป'}</Button>
  {file&&<Button type="button" variant="ghost" className="text-red-700" disabled={disabled} onClick={()=>{onFile(null);setError('')}}>นำรูปออก</Button>}
  {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
  {!file&&<p className="text-sm text-gray-500">ยังไม่ได้เลือกรูปสลิป · JPEG, PNG หรือ WebP ไม่เกิน 4 MB</p>}
 </div>
}
