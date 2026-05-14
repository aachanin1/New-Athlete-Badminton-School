import { redirect } from 'next/navigation'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import {
  ADMIN_MENU_PERMISSION_SETTING_KEY,
  getAllowedAdminMenuKeys,
  type AdminMenuKey,
} from '@/lib/admin-navigation'
import { getHomePathForRole } from '@/lib/auth/redirects'
import type { UserRole } from '@/types/database'

const ADMIN_ROLES: UserRole[] = ['admin', 'super_admin']

export function getServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  }

  return createAdminClient(url, serviceKey)
}

export async function getCurrentUserWithRole() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { supabase, user: null, role: null as UserRole | null, profile: null }
  }

  const { data: profile } = await (supabase
    .from('profiles')
    .select('id, full_name, role, avatar_url')
    .eq('id', user.id)
    .single() as any)

  return {
    supabase,
    user,
    role: (profile?.role || null) as UserRole | null,
    profile: profile || null,
  }
}

export async function requireAdminUser() {
  const { supabase, user, role, profile } = await getCurrentUserWithRole()

  if (!user || !role || !ADMIN_ROLES.includes(role)) {
    return null
  }

  return { supabase, user, role, profile }
}

export async function requireAdminMenuAccess(menuKey: AdminMenuKey) {
  const ctx = await requireAdminUser()

  if (!ctx) {
    return {
      ok: false as const,
      status: 401,
      message: 'Unauthorized',
    }
  }

  if (ctx.role === 'super_admin') {
    return { ok: true as const, ctx }
  }

  const { data: permissionSetting } = await ctx.supabase
    .from('system_settings')
    .select('value')
    .eq('key', ADMIN_MENU_PERMISSION_SETTING_KEY)
    .maybeSingle() as unknown as { data: { value: unknown } | null }

  const allowedMenuKeys = getAllowedAdminMenuKeys(permissionSetting?.value)

  if (!allowedMenuKeys.includes(menuKey)) {
    return {
      ok: false as const,
      status: 403,
      message: 'ไม่มีสิทธิ์เข้าใช้เมนูนี้',
    }
  }

  return { ok: true as const, ctx }
}

export async function requireSuperAdminUser() {
  const ctx = await requireAdminUser()

  if (!ctx || ctx.role !== 'super_admin') {
    return null
  }

  return ctx
}

export async function requireAdminPageAccess() {
  const ctx = await getCurrentUserWithRole()

  if (!ctx.user) {
    redirect('/auth/login')
  }

  if (!ctx.role || !ADMIN_ROLES.includes(ctx.role)) {
    redirect(getHomePathForRole(ctx.role))
  }

  return ctx
}

export async function requireSuperAdminPageAccess() {
  const ctx = await requireAdminPageAccess()

  if (ctx.role !== 'super_admin') {
    redirect(getHomePathForRole(ctx.role))
  }

  return ctx
}
