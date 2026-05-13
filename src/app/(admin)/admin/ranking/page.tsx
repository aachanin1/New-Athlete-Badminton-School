import { RankingContent } from '@/components/shared/ranking-content'
import { requireAdminPageAccess } from '@/lib/auth/admin'

export const dynamic = 'force-dynamic'

export default async function AdminRankingPage() {
  await requireAdminPageAccess()

  return <RankingContent />
}
