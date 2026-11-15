import 'server-only'
import { getServiceRoleClient } from '@/lib/auth/admin'

export interface PublicBranch {
  id: string
  name: string
}

export async function readPublicBranches(): Promise<PublicBranch[] | null> {
  try {
    const { data, error } = await getServiceRoleClient()
      .from('branches')
      .select('id,name')
      .eq('is_active', true)
      .order('name')

    if (error || !data) return null
    return data
  } catch {
    return null
  }
}
