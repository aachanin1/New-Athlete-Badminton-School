import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

type EmailOtpType = 'signup' | 'invite' | 'magiclink' | 'recovery' | 'email_change' | 'email'

const emailOtpTypes = new Set<EmailOtpType>([
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
])

function isEmailOtpType(type: string | null): type is EmailOtpType {
  return Boolean(type && emailOtpTypes.has(type as EmailOtpType))
}

function getSafeNext(nextParam: string | null) {
  if (!nextParam || !nextParam.startsWith('/') || nextParam.startsWith('//')) {
    return '/dashboard'
  }

  return nextParam
}

function getAppRedirectUrl(request: Request, origin: string, next: string) {
  const forwardedHost = request.headers.get('x-forwarded-host')
  const isLocalEnv = process.env.NODE_ENV === 'development'

  if (isLocalEnv) {
    return `${origin}${next}`
  }

  if (forwardedHost) {
    return `https://${forwardedHost}${next}`
  }

  return `${origin}${next}`
}

function getLoginErrorUrl(origin: string, message: string) {
  const loginUrl = new URL('/auth/login', origin)
  loginUrl.searchParams.set('error', message)
  return loginUrl
}

function getLoginVerifiedUrl(origin: string) {
  const loginUrl = new URL('/auth/login', origin)
  loginUrl.searchParams.set('verified', '1')
  return loginUrl
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const callbackError = searchParams.get('error_description') ?? searchParams.get('error')
  const next = getSafeNext(searchParams.get('next'))

  if (callbackError) {
    return NextResponse.redirect(getLoginErrorUrl(origin, callbackError))
  }

  const supabase = await createClient()

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return NextResponse.redirect(getAppRedirectUrl(request, origin, next))
    }

    return NextResponse.redirect(getLoginErrorUrl(origin, error.message))
  }

  if (tokenHash && isEmailOtpType(type)) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    })

    if (!error) {
      return NextResponse.redirect(getAppRedirectUrl(request, origin, next))
    }

    return NextResponse.redirect(getLoginErrorUrl(origin, error.message))
  }

  return NextResponse.redirect(getLoginVerifiedUrl(origin))
}
