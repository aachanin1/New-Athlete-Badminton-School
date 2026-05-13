import { LevelsSettingsClient } from '@/components/admin/levels-settings-client'
import { requireSuperAdminPageAccess } from '@/lib/auth/admin'
import type { LevelCategory } from '@/types/database'

interface LevelRow {
  id: number
  name: string
  description: string | null
  category: LevelCategory
  program_name: string | null
  requirements: string | null
  is_active: boolean | null
  updated_at: string | null
}

export default async function LevelSettingsPage() {
  const { supabase } = await requireSuperAdminPageAccess()

  const { data: levels } = await supabase
    .from('levels')
    .select('id, name, description, category, program_name, requirements, is_active, updated_at')
    .order('id', { ascending: true }) as { data: LevelRow[] | null }

  const levelList = (levels || []).map((level) => ({
    id: level.id,
    name: level.name,
    description: level.description,
    category: level.category,
    program_name: level.program_name,
    requirements: level.requirements,
    is_active: level.is_active ?? true,
    updated_at: level.updated_at,
  }))

  return <LevelsSettingsClient levels={levelList} />
}
