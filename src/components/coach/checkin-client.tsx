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
  date: string
  startTime: string
  endTime: string
  canRetroactiveCheckin: boolean
}

interface CheckinHistory {
  id: string
  scheduleSlotId: string
  branchName: string
  courseType: string
  date: string
  startTime: string
  endTime: string
  checkinTime: string
  photoUrl: string | null
}

interface CheckinClientProps {
  slots: SlotOption[]
  todayCheckins: CheckinHistory[]
  initialSlotId?: string | null
  selectedDate: string
  today: string
}

type CameraState = 'idle' | 'requesting' | 'ready' | 'blocked'
type LocationState = 'idle' | 'requesting' | 'ready' | 'blocked'
type CheckinWindowState = 'early' | 'open' | 'expired'

function getSecureContextError(feature: string) {
  if (typeof window === 'undefined') return null
  if (window.isSecureContext || ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)) return null
  return `เบราว์เซอร์มือถือจะอนุญาต${feature}เฉพาะเว็บ HTTPS เท่านั้น ถ้าทดสอบจากมือถือผ่าน IP/LAN ให้ใช้ staging/production HTTPS หรือ tunnel HTTPS ก่อน`
}

function getCameraErrorMessage(error: unknown) {
  const secureContextError = getSecureContextError('กล้อง')
  if (secureContextError) return secureContextError

  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
      return 'ระบบยังไม่ได้สิทธิ์ใช้กล้องหน้า กรุณาอนุญาตกล้องใน browser/site settings แล้วกดเปิดกล้องหน้าอีกครั้ง'
    }
    if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      return 'ไม่พบกล้องบนอุปกรณ์นี้ กรุณาตรวจสอบว่ามีกล้องหน้าและไม่ได้ถูกแอปอื่นใช้งานอยู่'
    }
    if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
      return 'กล้องถูกใช้งานอยู่หรือเปิดไม่ได้ กรุณาปิดแอปที่ใช้กล้องอยู่แล้วลองใหม่'
    }
    if (error.name === 'OverconstrainedError') {
      return 'ไม่สามารถเปิดกล้องหน้าด้วยค่าที่ร้องขอได้ กรุณาลองกดเปิดกล้องหน้าอีกครั้ง'
    }
  }

  return 'กรุณาอนุญาตให้ระบบใช้กล้องหน้า เพื่อถ่ายเซลฟี่เช็คอิน'
}

function getLocationErrorMessage(error?: GeolocationPositionError) {
  const secureContextError = getSecureContextError('ตำแหน่ง GPS')
  if (secureContextError) return secureContextError

  if (error?.code === 1) {
    return 'ระบบยังไม่ได้สิทธิ์ตำแหน่งที่ตั้ง กรุณาอนุญาต Location ใน browser/site settings แล้วกดอนุญาตตำแหน่งอีกครั้ง'
  }
  if (error?.code === 2) {
    return 'มือถือยังหาตำแหน่ง GPS ไม่ได้ กรุณาเปิด Location ของเครื่องและลองอีกครั้ง'
  }
  if (error?.code === 3) {
    return 'ขอตำแหน่ง GPS ไม่ทันเวลา กรุณาอยู่ในพื้นที่ที่สัญญาณดีขึ้นแล้วกดอนุญาตตำแหน่งอีกครั้ง'
  }

  return 'กรุณาอนุญาตตำแหน่งที่ตั้งก่อนเช็คอิน ระบบต้องบันทึกพิกัดพร้อมรูปเซลฟี่'
}

function waitForVideoReady(video: HTMLVideoElement) {
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0 && video.videoHeight > 0) {
    return Promise.resolve()
  }

  return new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup()
      reject(new Error('video_ready_timeout'))
    }, 8000)

    const done = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        cleanup()
        resolve()
      }
    }

    const cleanup = () => {
      window.clearTimeout(timeout)
      video.removeEventListener('loadedmetadata', done)
      video.removeEventListener('canplay', done)
    }

    video.addEventListener('loadedmetadata', done)
    video.addEventListener('canplay', done)
  })
}

function getCheckinWindowState(startTime: string, nowMs: number): CheckinWindowState {
  const [hourText, minuteText] = startTime.split(':')
  const hour = Number(hourText)
  const minute = Number(minuteText)
  const start = new Date(nowMs)
  start.setHours(Number.isFinite(hour) ? hour : 0, Number.isFinite(minute) ? minute : 0, 0, 0)

  const earliest = start.getTime() - (30 * 60 * 1000)
  const latest = start.getTime() + (30 * 60 * 1000)

  if (nowMs < earliest) return 'early'
  if (nowMs > latest) return 'expired'
  return 'open'
}

function getCheckinWindowLabel(state: CheckinWindowState) {
  if (state === 'open') return 'เช็คอินได้'
  if (state === 'early') return 'ยังไม่ถึงเวลา'
  return 'หมดเวลาเช็คอิน'
}

export function CheckinClient({ slots, todayCheckins, initialSlotId = null, selectedDate, today }: CheckinClientProps) {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [selectedSlotId, setSelectedSlotId] = useState(() => {
    const checkedIds = new Set(todayCheckins.map((checkin) => checkin.scheduleSlotId))
    if (initialSlotId && slots.some((slot) => slot.id === initialSlotId) && !checkedIds.has(initialSlotId)) return initialSlotId
    if (slots.length === 1 && !checkedIds.has(slots[0].id)) return slots[0].id
    return slots.find((slot) => !checkedIds.has(slot.id))?.id || ''
  })
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [cameraState, setCameraState] = useState<CameraState>('idle')
  const [locationState, setLocationState] = useState<LocationState>('idle')
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [showAllCheckins, setShowAllCheckins] = useState(false)

  const checkedSlotIds = useMemo(() => new Set(todayCheckins.map((checkin) => checkin.scheduleSlotId)), [todayCheckins])
  const selectedSlot = useMemo(() => slots.find((slot) => slot.id === selectedSlotId) || null, [selectedSlotId, slots])
  const selectedSlotWindowState = selectedSlot ? getCheckinWindowState(selectedSlot.startTime, nowMs) : null
  const selectedSlotCanSubmit = Boolean(selectedSlot && (selectedSlot.canRetroactiveCheckin || selectedSlotWindowState === 'open'))
  const isSelectedDateToday = selectedDate === today
  const visibleCheckins = showAllCheckins ? todayCheckins : todayCheckins.slice(0, 6)
  const hiddenCheckinCount = Math.max(0, todayCheckins.length - visibleCheckins.length)

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  const startCamera = async () => {
    const secureContextError = getSecureContextError('กล้อง')
    if (secureContextError) {
      setCameraState('blocked')
      setError(secureContextError)
      return
    }

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
        video: {
          facingMode: { ideal: 'user' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.muted = true
        videoRef.current.playsInline = true
        videoRef.current.autoplay = true
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => undefined)
        await waitForVideoReady(videoRef.current)
      }
      setCameraState('ready')
    } catch (caughtError) {
      stopCamera()
      setCameraState('blocked')
      setError(getCameraErrorMessage(caughtError))
    }
  }

  const requestLocation = () => {
    const secureContextError = getSecureContextError('ตำแหน่ง GPS')
    if (secureContextError) {
      setLocationState('blocked')
      setError(secureContextError)
      return
    }

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
        setError(null)
      },
      (caughtError) => {
        setLocation(null)
        setLocationState('blocked')
        setError(getLocationErrorMessage(caughtError))
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 },
    )
  }

  const captureSelfie = async () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || cameraState !== 'ready') {
      setError('กรุณาเปิดกล้องหน้าก่อนถ่ายเซลฟี่')
      return
    }

    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.videoWidth === 0 || video.videoHeight === 0) {
      setError('กล้องยังไม่พร้อม กรุณารอภาพจากกล้องขึ้นก่อน หรือกดเปิดกล้องหน้าอีกครั้ง')
      return
    }

    const width = video.videoWidth
    const height = video.videoHeight
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
    const timer = window.setInterval(() => setNowMs(Date.now()), 60 * 1000)
    requestLocation()
    startCamera()

    return () => {
      window.clearInterval(timer)
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

    if (!selectedSlot?.canRetroactiveCheckin && selectedSlotWindowState !== 'open') {
      setError(selectedSlotWindowState === 'early'
        ? 'ยังไม่ถึงเวลาเช็คอินรอบนี้ เช็คอินได้ตั้งแต่ก่อนเริ่มสอน 30 นาที'
        : 'หมดเวลาเช็คอินรอบนี้แล้ว เช็คอินได้ถึงหลังเริ่มสอน 30 นาทีเท่านั้น')
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
        {!isSelectedDateToday && (
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            โหมดเช็คอินย้อนหลังใช้ได้เฉพาะรอบที่ Admin ส่งกลับให้ตรวจสอบเท่านั้น และยังต้องถ่ายเซลฟี่พร้อมพิกัดเหมือนเดิม
          </p>
        )}
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
                    const windowState = getCheckinWindowState(slot.startTime, nowMs)
                    const isWindowOpen = windowState === 'open' || slot.canRetroactiveCheckin

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
                        <Badge
                          variant="outline"
                          className={isWindowOpen ? 'mt-2 border-green-200 bg-green-50 text-green-700' : 'mt-2 border-orange-200 bg-orange-50 text-orange-700'}
                        >
                          {slot.canRetroactiveCheckin ? 'Admin ส่งกลับให้เช็คย้อนหลัง' : getCheckinWindowLabel(windowState)}
                        </Badge>
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
              disabled={loading || !selectedSlotId || !photo || !location || checkedSlotIds.has(selectedSlotId) || !selectedSlotCanSubmit}
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
          <h2 className="text-lg font-bold text-[#153c85]">{isSelectedDateToday ? 'ประวัติเช็คอินวันนี้' : 'ประวัติเช็คอินวันที่เลือก'}</h2>
          {visibleCheckins.map((checkin) => (
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
          {hiddenCheckinCount > 0 && (
            <Button variant="outline" className="w-full" onClick={() => setShowAllCheckins(true)}>
              แสดงประวัติเพิ่มอีก {hiddenCheckinCount} รายการ
            </Button>
          )}
          {showAllCheckins && todayCheckins.length > 6 && (
            <Button variant="ghost" className="w-full" onClick={() => setShowAllCheckins(false)}>
              ย่อรายการประวัติเช็คอิน
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
