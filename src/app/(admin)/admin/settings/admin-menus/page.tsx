import { createClient } from '@/lib/supabase/server'
import { requireSuperAdminPageAccess } from '@/lib/auth/admin'
import {
  ADMIN_MENU_ITEMS,
  ADMIN_MENU_PERMISSION_SETTING_KEY,
  getAllowedAdminMenuKeys,
} from '@/lib/admin-navigation'
import { AdminMenuPermissionsClient } from '@/components/admin/admin-menu-permissions-client'

export default async function AdminMenuPermissionsPage() {
  await requireSuperAdminPageAccess()
  const supabase = createClient()

  const { data: permissionSetting } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', ADMIN_MENU_PERMISSION_SETTING_KEY)
    .maybeSingle() as unknown as { data: { value: unknown } | null }

  return (
    <AdminMenuPermissionsClient
      menuItems={ADMIN_MENU_ITEMS}
      initialAllowedMenuKeys={getAllowedAdminMenuKeys(permissionSetting?.value)}
      hasSetting={!!permissionSetting}
    />
  )
}
