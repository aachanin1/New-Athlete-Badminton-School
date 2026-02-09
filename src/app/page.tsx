import Image from 'next/image'
import Link from 'next/link'
import { PublicNavbar } from '@/components/layout/public-navbar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  MapPin,
  Users,
  Trophy,
  GraduationCap,
  ArrowRight,
  Star,
  Clock,
  CheckCircle2,
  Phone,
  MessageCircle,
  Facebook,
} from 'lucide-react'

const BRANCHES = [
  'แจ้งวัฒนะ',
  'พระราม 2',
  'รามอินทรา',
  'สุวรรณภูมิ',
  'เทพารักษ์',
  'รัชดา',
  'ราชพฤกษ์-ตลิ่งชัน',
]

const FEATURES = [
  {
    icon: Users,
    title: 'เรียนแบบกลุ่ม',
    description: 'กลุ่มเล็ก 4-6 คน ดูแลอย่างทั่วถึง ทั้งเด็กและผู้ใหญ่',
  },
  {
    icon: Star,
    title: 'เรียนแบบส่วนตัว',
    description: 'Private coaching สำหรับครอบครัว ได้ทั้งเด็กและผู้ใหญ่',
  },
  {
    icon: Trophy,
    title: '60 ระดับพัฒนาการ',
    description: 'ระบบ Level ชัดเจน ตั้งแต่พื้นฐานจนถึงระดับทีมชาติ',
  },
  {
    icon: GraduationCap,
    title: 'โค้ชมืออาชีพ',
    description: 'ทีมโค้ชคุณภาพ พร้อมโปรแกรมสอนที่ออกแบบเฉพาะ',
  },
]

const LEVEL_RANGES = [
  { emoji: '👶', range: 'LV 1-30', label: 'ชุดพื้นฐาน', desc: 'ฝึกวิธีการรับลูกจากคู่แข่ง', color: 'bg-blue-50 border-blue-200' },
  { emoji: '🔨', range: 'LV 31-39', label: 'ชุดนักกีฬา', desc: 'ฝึกวิธีการตีลูกทำแต้ม', color: 'bg-orange-50 border-orange-200' },
  { emoji: '🧠', range: 'LV 40-43', label: 'ชุดนักกีฬา', desc: 'ฝึกวิสัยทัศน์การเล่นเกม + แข่งระดับสโมสร', color: 'bg-purple-50 border-purple-200' },
  { emoji: '💪', range: 'LV 44-60', label: 'ชุดนักกีฬา', desc: 'เทคนิคขั้นสูง ระดับทีมชาติ', color: 'bg-red-50 border-red-200' },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white scroll-smooth">
      <PublicNavbar />

      {/* Hero Section */}
      <section id="hero" className="relative overflow-hidden bg-gradient-to-br from-[#153c85] to-[#2748bf] text-white scroll-mt-16">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="container mx-auto px-4 py-20 md:py-32 relative">
          <div className="max-w-3xl mx-auto text-center">
            <div className="flex justify-center mb-8">
              <Image
                src="/logo new-athlete-school.jpg"
                alt="New Athlete School"
                width={120}
                height={120}
                className="rounded-full border-4 border-white/20 shadow-2xl"
              />
            </div>
            <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
              New Athlete
              <span className="block text-[#f57e3b]">Badminton School</span>
            </h1>
            <p className="text-lg md:text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
              โรงเรียนสอนแบดมินตันสำหรับเด็กและผู้ใหญ่ 7 สาขาทั่วกรุงเทพฯ
              พัฒนาทักษะตั้งแต่พื้นฐานจนถึงระดับนักกีฬาทีมชาติ
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link href="/auth/register">
                <Button size="lg" className="bg-[#f57e3b] hover:bg-[#e06a2a] text-white text-lg px-8 py-6 w-[220px]">
                  สมัครเรียนเลย
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/ranking">
                <Button size="lg" className="bg-white text-[#153c85] border-2 border-white hover:bg-white/90 text-lg px-8 py-6 font-semibold w-[220px]">
                  <Trophy className="mr-2 h-5 w-5" />
                  ดูอันดับนักเรียน
                </Button>
              </Link>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white to-transparent" />
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-[#153c85] mb-4">
              ทำไมต้อง New Athlete?
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              เราออกแบบหลักสูตรเพื่อพัฒนานักแบดมินตันอย่างเป็นระบบ
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map((feature) => (
              <Card key={feature.title} className="border-0 shadow-md hover:shadow-lg transition-shadow">
                <CardContent className="p-6 text-center">
                  <div className="w-14 h-14 bg-[#2748bf]/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <feature.icon className="h-7 w-7 text-[#2748bf]" />
                  </div>
                  <h3 className="font-bold text-lg mb-2 text-gray-900">{feature.title}</h3>
                  <p className="text-gray-500 text-sm">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-gray-50 scroll-mt-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-[#153c85] mb-4">
              คอร์สเรียน & ราคา
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Kids Group */}
            <Card className="border-2 border-[#2748bf]/20 hover:border-[#2748bf] transition-colors">
              <CardContent className="p-6">
                <div className="text-center mb-6">
                  <span className="text-4xl">🏸</span>
                  <h3 className="font-bold text-xl mt-2 text-[#153c85]">เด็ก (กลุ่ม)</h3>
                  <p className="text-gray-500 text-sm">4-6 คน / กลุ่ม • 2 ชม.</p>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">รายครั้ง</span>
                    <span className="font-bold">700 บาท</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">4 ครั้ง/เดือน</span>
                    <span className="font-bold">2,500 บาท</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">8 ครั้ง/เดือน</span>
                    <span className="font-bold">4,000 บาท</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">12 ครั้ง/เดือน</span>
                    <span className="font-bold">5,200 บาท</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">16 ครั้ง/เดือน</span>
                    <span className="font-bold">6,500 บาท</span>
                  </div>
                  <div className="flex justify-between text-sm bg-[#f57e3b]/10 p-2 rounded">
                    <span className="text-[#f57e3b] font-medium">19+ ครั้ง/เดือน</span>
                    <span className="font-bold text-[#f57e3b]">7,000 บาท</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Adult Group */}
            <Card className="border-2 border-[#2748bf]/20 hover:border-[#2748bf] transition-colors">
              <CardContent className="p-6">
                <div className="text-center mb-6">
                  <span className="text-4xl">💪</span>
                  <h3 className="font-bold text-xl mt-2 text-[#153c85]">ผู้ใหญ่ (กลุ่ม)</h3>
                  <p className="text-gray-500 text-sm">1-6 คน / กลุ่ม • 2 ชม.</p>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">รายครั้ง</span>
                    <span className="font-bold">600 บาท</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">10 ครั้ง</span>
                    <span className="font-bold">5,500 บาท</span>
                  </div>
                  <div className="flex justify-between text-sm bg-[#f57e3b]/10 p-2 rounded">
                    <span className="text-[#f57e3b] font-medium">16 ครั้ง</span>
                    <span className="font-bold text-[#f57e3b]">8,000 บาท</span>
                  </div>
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                    <p className="text-xs text-blue-700 flex items-start gap-1">
                      <Clock className="h-3 w-3 mt-0.5 shrink-0" />
                      แพ็กเกจ 10-16 ครั้ง ใช้ได้ภายใน 10 เดือน
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Private */}
            <Card className="border-2 border-[#f57e3b]/30 hover:border-[#f57e3b] transition-colors relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#f57e3b] text-white text-xs font-bold px-4 py-1 rounded-full">
                ครอบครัว
              </div>
              <CardContent className="p-6">
                <div className="text-center mb-6">
                  <span className="text-4xl">⭐</span>
                  <h3 className="font-bold text-xl mt-2 text-[#153c85]">Private</h3>
                  <p className="text-gray-500 text-sm">เด็ก & ผู้ใหญ่ • 1 ชม.</p>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">รายชั่วโมง</span>
                    <span className="font-bold">900 บาท</span>
                  </div>
                  <div className="flex justify-between text-sm bg-[#f57e3b]/10 p-2 rounded">
                    <span className="text-[#f57e3b] font-medium">10 ชั่วโมง</span>
                    <span className="font-bold text-[#f57e3b]">8,000 บาท</span>
                  </div>
                  <div className="mt-4 p-3 bg-orange-50 rounded-lg">
                    <p className="text-xs text-orange-700 flex items-start gap-1">
                      <CheckCircle2 className="h-3 w-3 mt-0.5 shrink-0" />
                      เหมาะสำหรับครอบครัว เรียนด้วยกันได้
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Levels Section */}
      <section id="levels" className="py-20 bg-white scroll-mt-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-[#153c85] mb-4">
              ระบบ Level พัฒนาการ
            </h2>
            <p className="text-gray-500">60 ระดับ แบ่งเป็น 4 ชุดหลัก</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {LEVEL_RANGES.map((level) => (
              <Card key={level.range} className={`border-2 ${level.color}`}>
                <CardContent className="p-6 text-center">
                  <span className="text-4xl">{level.emoji}</span>
                  <h3 className="font-bold text-lg mt-3 text-gray-900">{level.label}</h3>
                  <p className="text-[#2748bf] font-bold text-sm mt-1">{level.range}</p>
                  <p className="text-gray-500 text-sm mt-2">{level.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Branches Section */}
      <section id="branches" className="py-20 bg-gray-50 scroll-mt-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-[#153c85] mb-4">
              7 สาขาทั่วกรุงเทพฯ
            </h2>
            <p className="text-gray-500">เลือกสาขาที่สะดวก เปลี่ยนสาขาได้ตลอด</p>
          </div>
          <div className="flex flex-wrap justify-center gap-4 max-w-3xl mx-auto">
            {BRANCHES.map((branch) => (
              <div
                key={branch}
                className="flex items-center gap-2 bg-white px-5 py-3 rounded-full shadow-sm border hover:border-[#2748bf] hover:shadow-md transition-all"
              >
                <MapPin className="h-4 w-4 text-[#f57e3b]" />
                <span className="font-medium text-gray-700">{branch}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-20 bg-gradient-to-br from-[#153c85] to-[#2748bf] text-white scroll-mt-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              ติดต่อสอบถาม
            </h2>
            <p className="text-blue-100 max-w-xl mx-auto">
              สนใจสมัครเรียนหรือสอบถามข้อมูลเพิ่มเติม ติดต่อเราได้เลย
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto mb-12">
            <a
              href="https://www.facebook.com/profile.php?id=100063472047226"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-3 bg-white/10 hover:bg-white/20 backdrop-blur rounded-xl p-6 transition-colors"
            >
              <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center">
                <Facebook className="h-7 w-7 text-white" />
              </div>
              <span className="font-semibold text-lg">Facebook</span>
              <span className="text-blue-200 text-sm">New Athlete School</span>
            </a>

            <a
              href="https://line.me/R/ti/p/@newathlete"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-3 bg-white/10 hover:bg-white/20 backdrop-blur rounded-xl p-6 transition-colors"
            >
              <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center">
                <MessageCircle className="h-7 w-7 text-white" />
              </div>
              <span className="font-semibold text-lg">Line Official</span>
              <span className="text-blue-200 text-sm">@newathlete</span>
            </a>

            <a
              href="tel:0800596004"
              className="flex flex-col items-center gap-3 bg-white/10 hover:bg-white/20 backdrop-blur rounded-xl p-6 transition-colors"
            >
              <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center">
                <Phone className="h-7 w-7 text-white" />
              </div>
              <span className="font-semibold text-lg">โทรศัพท์</span>
              <span className="text-blue-200 text-sm">080-059-6004</span>
            </a>
          </div>

          <div className="text-center">
            <p className="text-blue-100 mb-6">พร้อมเริ่มต้นเส้นทางแบดมินตัน?</p>
            <Link href="/auth/register">
              <Button size="lg" className="bg-[#f57e3b] hover:bg-[#e06a2a] text-white text-lg px-10 py-6">
                สมัครสมาชิกฟรี
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <Image
                src="/logo new-athlete-school.jpg"
                alt="New Athlete School"
                width={40}
                height={40}
                className="rounded-full"
              />
              <div>
                <p className="font-bold text-white">New Athlete Badminton School</p>
                <p className="text-sm">โรงเรียนสอนแบดมินตัน</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <a
                href="https://www.facebook.com/profile.php?id=100063472047226"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition-colors"
              >
                <Facebook className="h-5 w-5" />
              </a>
              <a
                href="tel:0800596004"
                className="hover:text-white transition-colors"
              >
                <Phone className="h-5 w-5" />
              </a>
            </div>
            <p className="text-sm">
              © {new Date().getFullYear()} New Athlete School. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
