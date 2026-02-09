import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

const PUBLIC_ROUTES = ['/', '/ranking', '/auth', '/auth/callback', '/auth/login', '/auth/register', '/api']

const ROLE_ROUTES: Record<string, string[]> = {
  user: ['/dashboard'],
  coach: ['/coach', '/dashboard'],
  head_coach: ['/coach', '/dashboard'],
  admin: ['/admin', '/coach', '/dashboard'],
  super_admin: ['/admin', '/coach', '/dashboard'],
}

const ROLE_HOME: Record<string, string> = {
  user: '/dashboard',
  coach: '/coach',
  head_coach: '/coach',
  admin: '/admin',
  super_admin: '/admin',
}

export async function middleware(request: NextRequest) {
  const { user, supabaseResponse, supabase } = await updateSession(request)
  const { pathname } = request.nextUrl

  // Allow public routes
  if (PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(route + '/'))) {
    // If logged in user visits /auth, redirect to their home
    if (pathname.startsWith('/auth') && user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      const role = profile?.role || 'user'
      const homeUrl = new URL(ROLE_HOME[role] || '/dashboard', request.url)
      return NextResponse.redirect(homeUrl)
    }
    return supabaseResponse
  }

  // Protected routes: redirect to login if not authenticated
  if (!user) {
    const loginUrl = new URL('/auth/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Get user role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role || 'user'
  const allowedPrefixes = ROLE_ROUTES[role] || ['/dashboard']

  // Check if user has access to the requested route
  const hasAccess = allowedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + '/')
  )

  if (!hasAccess) {
    const homeUrl = new URL(ROLE_HOME[role] || '/dashboard', request.url)
    return NextResponse.redirect(homeUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
