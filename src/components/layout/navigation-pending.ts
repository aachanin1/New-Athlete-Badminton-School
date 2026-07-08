'use client'

import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

const NAVIGATION_PENDING_TIMEOUT_MS = 10000

function getRouteKey(pathname: string, searchParams: { toString(): string } | null) {
  const search = searchParams?.toString()
  return search ? `${pathname}?${search}` : pathname
}

function getHrefRouteKey(href: string) {
  if (typeof window === 'undefined') return href

  try {
    const url = new URL(href, window.location.origin)
    if (url.origin !== window.location.origin) return null
    return `${url.pathname}${url.search}`
  } catch {
    return href
  }
}

function shouldIgnoreNavigationEvent(event: MouseEvent<HTMLAnchorElement>) {
  return (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    event.currentTarget.target === '_blank'
  )
}

export function useNavigationPending() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pendingHref, setPendingHref] = useState<string | null>(null)

  const currentRouteKey = useMemo(
    () => getRouteKey(pathname, searchParams),
    [pathname, searchParams],
  )

  useEffect(() => {
    if (!pendingHref) return

    if (getHrefRouteKey(pendingHref) === currentRouteKey) {
      setPendingHref(null)
      return
    }

    const timeout = window.setTimeout(() => {
      setPendingHref(null)
    }, NAVIGATION_PENDING_TIMEOUT_MS)

    return () => window.clearTimeout(timeout)
  }, [currentRouteKey, pendingHref])

  const handlePendingNavigation = useCallback((
    href: string,
    event: MouseEvent<HTMLAnchorElement>,
    afterNavigate?: () => void,
  ) => {
    afterNavigate?.()

    if (shouldIgnoreNavigationEvent(event)) return

    const nextRouteKey = getHrefRouteKey(href)
    if (!nextRouteKey || nextRouteKey === currentRouteKey) return

    setPendingHref(href)
  }, [currentRouteKey])

  const isPendingHref = useCallback((href: string) => (
    pendingHref ? getHrefRouteKey(pendingHref) === getHrefRouteKey(href) : false
  ), [pendingHref])

  return {
    handlePendingNavigation,
    isPendingHref,
    pendingHref,
  }
}
