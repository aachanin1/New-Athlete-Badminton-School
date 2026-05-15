'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, Camera, CheckCircle2, Clock, ImageIcon, Loader2, MapPin, RefreshCw, Video } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { fmtTime } from '@/lib/utils'

interface SlotOption {
  id: string
  branchId: string
  branchName: string
  courseType: string
  startTime: string
  endTime: string
}

interface CheckinHistory {
  id: string
  scheduleSlotId: string
  branchName: string
  courseType: string
  startTime: string
  endTime: string
  checkinTime: string
  photoUrl: string | null
}

interface CheckinClientProps {
  slots: SlotOption[]
  todayCheckins: CheckinHistory[]
}

type CameraState = 'idle' | 'requesting' | 'ready' | 'blocked'
type LocationState = 'idle' | 'requesting' | 'ready' | 'blocked'

export function CheckinClient({ slots, todayCheckins }: CheckinClientProps) {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [selectedSlotId, setSelectedSlotId] = useState(slots.length === 1 ? slots[0].id : '')
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [cameraState, setCameraState] = useState<CameraState>('idle')
  const [locationState, setLocationState] = useState<LocationState>('idle')
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)

  const checkedSlotIds = useMemo(() => new Set(todayCheckins.map((checkin) => checkin.scheduleSlotId)), [todayCheckins])

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState('blocked')
      setError('เบราว์เซอร์ไม่รองรับการเปิดกล้อง กรุณาใช้ Chrome/Safari/Edge เวอร์ชันล่าสุด')
      return
    }

    setCameraState('requesting')
    setError(null)

    try {
      stopCamera()
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCameraState('ready')
    } catch {
      setCameraState('blocked')
      setError('กรุณาอนุญาตให้ระบบใช้กล้องหน้า เพื่อถ่ายเซลฟี่เช็คอิน')
    }
  }

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocationState('blocked')
      setError('เบราว์เซอร์ไม่รองรับ GPS')
      return
    }

    setLocationState('requesting')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({ lat: position.coords.latitude, lng: position.coords.longitude })
        setLocationState('ready')
      },
      () => {
        setLocation(null)
        setLocationState('blocked')
        setError('กรุณาอนุญาตตำแหน่งที่ตั้งก่อนเช็คอิน ระบบต้องบันทึกพิกัดพร้อมรูปเซลฟี่')
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  }

  const captureSelfie = async () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || cameraState !== 'ready') {
      setError('กรุณาเปิดกล้องหน้าก่อนถ่ายเซลฟี่')
      return
    }

    const width = video.videoWidth || 720
    const height = video.videoHeight || 720
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d')
    if (!context) {
      setError('ไม่สามารถถ่ายภาพจากกล้องได้ กรุณาลองใหม่')
      return
    }

    context.drawImage(video, 0, 0, width, height)

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
    if (!blob) {
      setError('ไม่สามารถสร้างรูปเซลฟี่ได้ กรุณาลองใหม่')
      return
    }

    const selfieFile = new File([blob], `coach-selfie-${Date.now()}.jpg`, { type: 'image/jpeg' })
    setPhoto(selfieFile)
    setPhotoPreview(URL.createObjectURL(blob))
    setError(null)
  }

  useEffect(() => {
    requestLocation()
    startCamera()

    return () => {
      stopCamera()
      if (photoPreview) URL.revokeObjectURL(photoPreview)
    }
    // The initial permission prompts should run once when the check-in page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSubmit = async () => {
    if (!selectedSlotId) {
      setError('กรุณาเลือกรอบสอน')
      return
    }
    if (!photo) {
      setError('กรุณาถ่ายเซลฟี่จากกล้องหน้าก่อนเช็คอิน')
      return
    }
    if (!location) {
      requestLocation()
      setError('กรุณาอนุญาตตำแหน่งที่ตั้งก่อนเช็คอิน')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('scheduleSlotId', selectedSlotId)
      formData.append('photo', photo)
      formData.append('photoSource', 'camera_capture')
      formData.append('lat', location.lat.toString())
      formData.append('lng', location.lng.toString())

      const res = await fetch('/api/coach/checkin', {
        method: 'POST',
        body: formData,
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setError(json?.error || 'เช็คอินไม่สำเร็จ')
        setLoading(false)
        return
      }

      setSuccess(true)
      setLoading(false)
      stopCamera()
      setTimeout(() => router.refresh(), 1500)
    } catch {
      setError('เกิดข้อผิดพลาด')
      setLoading(false)
    }
  }

  const formatCheckinTime = (value: string) => new Date(value).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#153c85]">เช็คอิน</h1>
        <p className="mt-1 text-sm text-gray-500">เช็คอินรายรอบสอนด้วยกล้องหน้าเท่านั้น พร้อมพิกัดตำแหน่ง ก่อนเริ่ม 30 นาที ถึงหลังเริ่ม 30 นาที</p>
      </div>

      {success ? (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="py-8 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-green-500" />
            <p className="text-lg font-bold text-green-700">เช็คอินสำเร็จ</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="space-y-4 p-4">
            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">เลือกรอบสอนของตัวเอง</label>
              {slots.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-sm text-gray-400">
                  วันนี้ยังไม่มีรอบสอนที่ถูกมอบหมายให้คุณ
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {slots.map((slot) => {
                    const isChecked = checkedSlotIds.has(slot.id)
                    const isSelected = selectedSlotId === slot.id

                    return (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => setSelectedSlotId(slot.id)}
                        disabled={isChecked}
                        className={`rounded-lg border p-3 text-left text-sm font-medium transition-all ${isSelected ? 'border-[#2748bf] bg-[#2748bf]/5 text-[#2748bf]' : 'border-gray-200 hover:border-gray-300'} ${isChecked ? 'cursor-not-allowed opacity-70' : ''}`}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1"><Clock className="h-4 w-4" />{fmtTime(slot.startTime)} - {fmtTime(slot.endTime)}</span>
                          <Badge className="bg-blue-100 text-blue-700">{slot.courseType || 'คอร์ส'}</Badge>
                          {isChecked && <Badge variant="outline">เช็คอินแล้ว</Badge>}
                        </div>
                        <p className="mt-1 flex items-center gap-1 text-xs text-gray-500"><MapPin className="h-3 w-3" />{slot.branchName}</p>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-sm font-medium">กล้องหน้าเซลฟี่ *</label>
                <Badge className={cameraState === 'ready' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}>
                  <Camera className="mr-1 h-3 w-3" />
                  {cameraState === 'ready' ? 'กล้องพร้อม' : 'รออนุญาตกล้อง'}
                </Badge>
              </div>

              <div className="overflow-hidden rounded-xl border bg-black">
                {photoPreview ? (
                  <Image src={photoPreview} alt="selfie preview" width={720} height={420} unoptimized className="max-h-72 w-full object-cover" />
                ) : (
                  <video ref={videoRef} playsInline muted className="max-h-72 w-full bg-black object-cover" />
                )}
              </div>
              <canvas ref={canvasRef} className="hidden" />

              <div className="grid gap-2 sm:grid-cols-2">
                <Button type="button" variant="outline" onClick={startCamera} disabled={cameraState === 'requesting'}>
                  {cameraState === 'requesting' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Video className="mr-2 h-4 w-4" />}
                  เปิดกล้องหน้า
                </Button>
                <Button type="button" onClick={captureSelfie} disabled={cameraState !== 'ready'} className="bg-[#2748bf] hover:bg-[#153c85]">
                  <Camera className="mr-2 h-4 w-4" />
                  ถ่ายเซลฟี่
                </Button>
              </div>
              {photoPreview && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setPhoto(null)
                    setPhotoPreview(null)
                    startCamera()
                  }}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  ถ่ายใหม่
                </Button>
              )}
              <p className="text-xs text-gray-400">ระบบไม่เปิดให้ browse หรือเลือกรูปจากเครื่อง เพื่อให้หลักฐานเช็คอินมาจากกล้องหน้าเท่านั้น</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">ตำแหน่ง GPS *</label>
              {location ? (
                <Badge className="bg-green-100 text-green-700">
                  <MapPin className="mr-1 h-3 w-3" />
                  {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                </Badge>
              ) : (
                <Button variant="outline" size="sm" onClick={requestLocation} disabled={locationState === 'requesting'}>
                  {locationState === 'requesting' ? (
                    <>
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      กำลังขอตำแหน่ง...
                    </>
                  ) : (
                    <>
                      <MapPin className="mr-1 h-4 w-4" />
                      อนุญาตตำแหน่ง
                    </>
                  )}
                </Button>
              )}
              <p className="text-xs text-gray-400">ถ้ายังไม่ได้เปิดตำแหน่ง เบราว์เซอร์จะแสดงคำขออนุญาตตำแหน่งให้อัตโนมัติ</p>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={loading || !selectedSlotId || !photo || !location || checkedSlotIds.has(selectedSlotId)}
              className="w-full bg-[#2748bf] hover:bg-[#153c85]"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  กำลังเช็คอิน...
                </>
              ) : (
                <>
                  <Camera className="mr-2 h-4 w-4" />
                  เช็คอิน
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {todayCheckins.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-bold text-[#153c85]">ประวัติเช็คอินวันนี้</h2>
          {todayCheckins.map((checkin) => (
            <Card key={checkin.id}>
              <CardContent className="flex items-center gap-3 p-3">
                {checkin.photoUrl ? (
                  <Image src={checkin.photoUrl} alt="checkin" width={48} height={48} className="h-12 w-12 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100">
                    <ImageIcon className="h-5 w-5 text-gray-300" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium">{fmtTime(checkin.startTime)} - {fmtTime(checkin.endTime)} - {checkin.branchName}</p>
                  <p className="text-xs text-gray-500">{checkin.courseType || 'คอร์ส'} - เช็คอิน {formatCheckinTime(checkin.checkinTime)}</p>
                </div>
                <CheckCircle2 className="ml-auto h-5 w-5 text-green-500" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
