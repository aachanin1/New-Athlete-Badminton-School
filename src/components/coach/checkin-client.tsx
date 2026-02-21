'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Camera, MapPin, CheckCircle2, AlertCircle, Loader2, ImageIcon,
} from 'lucide-react'

interface BranchOption {
  id: string
  name: string
}

interface CheckinHistory {
  id: string
  branchName: string
  checkinTime: string
  photoUrl: string | null
}

interface CheckinClientProps {
  branches: BranchOption[]
  todayCheckins: CheckinHistory[]
}

export function CheckinClient({ branches, todayCheckins }: CheckinClientProps) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [selectedBranch, setSelectedBranch] = useState(branches.length === 1 ? branches[0].id : '')
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [gettingLocation, setGettingLocation] = useState(false)
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setPhoto(file)
      const reader = new FileReader()
      reader.onload = () => setPhotoPreview(reader.result as string)
      reader.readAsDataURL(file)
    }
  }

  const getLocation = () => {
    if (!navigator.geolocation) {
      setError('เบราว์เซอร์ไม่รองรับ GPS')
      return
    }
    setGettingLocation(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setGettingLocation(false)
      },
      () => {
        setError('ไม่สามารถดึงตำแหน่งได้ กรุณาอนุญาตการเข้าถึงตำแหน่ง')
        setGettingLocation(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const handleSubmit = async () => {
    if (!selectedBranch) {
      setError('กรุณาเลือกสาขา')
      return
    }
    setLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('branchId', selectedBranch)
      if (photo) formData.append('photo', photo)
      if (location) {
        formData.append('lat', location.lat.toString())
        formData.append('lng', location.lng.toString())
      }

      const res = await fetch('/api/coach/checkin', {
        method: 'POST',
        body: formData,
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error); setLoading(false); return }

      setSuccess(true)
      setLoading(false)
      setTimeout(() => router.refresh(), 1500)
    } catch {
      setError('เกิดข้อผิดพลาด')
      setLoading(false)
    }
  }

  const fmtTime = (t: string) => new Date(t).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#153c85]">เช็คอิน</h1>
        <p className="text-gray-500 text-sm mt-1">เช็คอินก่อนเริ่มสอน พร้อมถ่ายรูป</p>
      </div>

      {success ? (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="py-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
            <p className="font-bold text-green-700 text-lg">เช็คอินสำเร็จ!</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-4 space-y-4">
            {error && (
              <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />{error}
              </div>
            )}

            {/* Branch selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">เลือกสาขา</label>
              <div className="grid grid-cols-2 gap-2">
                {branches.map((b) => (
                  <button key={b.id} onClick={() => setSelectedBranch(b.id)}
                    className={`p-3 rounded-lg border text-sm font-medium text-left transition-all ${selectedBranch === b.id ? 'border-[#2748bf] bg-[#2748bf]/5 text-[#2748bf]' : 'border-gray-200 hover:border-gray-300'}`}>
                    <MapPin className="h-4 w-4 mb-1" />{b.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Photo */}
            <div className="space-y-2">
              <label className="text-sm font-medium">ถ่ายรูป (ไม่บังคับ)</label>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoChange} className="hidden" />
              {photoPreview ? (
                <div className="relative">
                  <img src={photoPreview} alt="preview" className="w-full max-h-64 object-cover rounded-lg" />
                  <Button size="sm" variant="outline" className="absolute top-2 right-2" onClick={() => { setPhoto(null); setPhotoPreview(null) }}>เปลี่ยน</Button>
                </div>
              ) : (
                <button onClick={() => fileRef.current?.click()}
                  className="w-full border-2 border-dashed border-gray-200 rounded-lg p-8 text-center hover:border-[#2748bf] transition-colors">
                  <Camera className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm text-gray-400">กดเพื่อถ่ายรูปหรือเลือกไฟล์</p>
                </button>
              )}
            </div>

            {/* Location */}
            <div className="space-y-2">
              <label className="text-sm font-medium">ตำแหน่ง GPS (ไม่บังคับ)</label>
              {location ? (
                <Badge className="bg-green-100 text-green-700">
                  <MapPin className="h-3 w-3 mr-1" />
                  {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                </Badge>
              ) : (
                <Button variant="outline" size="sm" onClick={getLocation} disabled={gettingLocation}>
                  {gettingLocation ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />กำลังดึง...</> : <><MapPin className="h-4 w-4 mr-1" />ดึงตำแหน่ง</>}
                </Button>
              )}
            </div>

            <Button onClick={handleSubmit} disabled={loading || !selectedBranch} className="w-full bg-[#2748bf] hover:bg-[#153c85]">
              {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />กำลังเช็คอิน...</> : <><Camera className="h-4 w-4 mr-2" />เช็คอิน</>}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Today's checkin history */}
      {todayCheckins.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-bold text-[#153c85]">ประวัติเช็คอินวันนี้</h2>
          {todayCheckins.map((ci) => (
            <Card key={ci.id}>
              <CardContent className="p-3 flex items-center gap-3">
                {ci.photoUrl ? (
                  <img src={ci.photoUrl} alt="checkin" className="w-12 h-12 object-cover rounded-lg" />
                ) : (
                  <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center"><ImageIcon className="h-5 w-5 text-gray-300" /></div>
                )}
                <div>
                  <p className="font-medium text-sm">{ci.branchName}</p>
                  <p className="text-xs text-gray-500">{fmtTime(ci.checkinTime)}</p>
                </div>
                <CheckCircle2 className="h-5 w-5 text-green-500 ml-auto" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
