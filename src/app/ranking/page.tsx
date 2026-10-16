import { PublicNavbar } from '@/components/layout/public-navbar'
import { RankingContent } from '@/components/shared/ranking-content'
import { PublicAuthProvider } from '@/components/shared/public-auth-provider'

export const dynamic = 'force-dynamic'

export default function RankingPage() {
  return (
    <PublicAuthProvider>
    <div className="min-h-screen bg-gray-50">
      <PublicNavbar />
      <RankingContent enableSearch />
    </div>
    </PublicAuthProvider>
  )
}
