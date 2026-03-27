import type { UserRole } from '@/types/database'

const ROLE_HOME: Record<UserRole, string> = {
  user: '/dashboard',
  coach: '/coach',
  head_coach: '/coach',
  admin: '/admin',
  super_admin: '/admin',
}

export function getHomePathForRole(role?: UserRole | null) {
  if (!role) return '/dashboard'
  return ROLE_HOME[role] || '/dashboard'
}
