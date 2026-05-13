import { PublicNavbar } from '@/components/layout/public-navbar'
import { RankingContent } from '@/components/shared/ranking-content'

export const dynamic = 'force-dynamic'

export default function RankingPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <PublicNavbar />
      <RankingContent />
    </div>
  )
}
