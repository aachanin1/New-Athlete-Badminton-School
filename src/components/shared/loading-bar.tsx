'use client'

import { useEffect, useState, useCallback } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

const LOADING_TIMEOUT_MS = 10000

function getCurrentRouteKey(pathname: string, searchParams: { toString(): string }) {
  const search = searchParams.toString()
  return search ? `${pathname}?${search}` : pathname
}

function getAnchorRouteKey(anchor: HTMLAnchorElement) {
  const rawHref = anchor.getAttribute('href')
  if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('tel:') || rawHref.startsWith('mailto:')) return null

  try {
    const url = new URL(rawHref, window.location.origin)
    if (url.origin !== window.location.origin) return null
    return `${url.pathname}${url.search}`
  } catch {
    return null
  }
}

export function LoadingBar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)

  const startLoading = useCallback(() => {
    setLoading(true)
    setProgress(0)
  }, [])

  useEffect(() => {
    if (!loading) return

    const t1 = setTimeout(() => setProgress(30), 50)
    const t2 = setTimeout(() => setProgress(60), 200)
    const t3 = setTimeout(() => setProgress(80), 500)
    const timeout = setTimeout(() => {
      setLoading(false)
      setProgress(0)
    }, LOADING_TIMEOUT_MS)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      clearTimeout(timeout)
    }
  }, [loading])

  useEffect(() => {
    if (loading) {
      setProgress(100)
      const timeout = setTimeout(() => {
        setLoading(false)
        setProgress(0)
      }, 300)
      return () => clearTimeout(timeout)
    }
  }, [pathname, searchParams]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return

      const target = e.target as HTMLElement
      const anchor = target.closest('a')
      if (!anchor) return
      if (anchor.target === '_blank') return

      const nextRouteKey = getAnchorRouteKey(anchor)
      if (!nextRouteKey) return

      if (nextRouteKey !== getCurrentRouteKey(pathname, searchParams)) {
        startLoading()
      }
    }

    document.addEventListener('click', handleClick, { capture: true })
    return () => document.removeEventListener('click', handleClick, { capture: true })
  }, [pathname, searchParams, startLoading])

  if (!loading && progress === 0) return null

  return (
    <>
      <div className="fixed left-0 right-0 top-0 z-[9999] h-[3px]">
        <div
          className="h-full bg-[#f57e3b] transition-all duration-300 ease-out"
          style={{
            width: `${progress}%`,
            opacity: progress === 100 ? 0 : 1,
            transition: progress === 100
              ? 'width 200ms ease-out, opacity 300ms ease-out 200ms'
              : 'width 300ms ease-out',
          }}
        />
      </div>
      {progress < 100 && (
        <div className="pointer-events-none fixed right-4 top-4 z-[9998] rounded-full border border-[#2748bf]/15 bg-white px-3 py-1.5 text-xs font-medium text-[#153c85] shadow-md">
          กำลังโหลด...
        </div>
      )}
    </>
  )
}
