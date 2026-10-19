/** Native disabled buttons lose focus while a request runs. Restore only if
 * the operator has not moved to another control in the meantime. */
export function captureAdminReviewFocus(button: HTMLButtonElement) {
  if (document.activeElement !== button) return () => {}
  let moved = false
  const onFocus = (event: FocusEvent) => { if (event.target !== button) moved = true }
  const onPointer = (event: PointerEvent) => { if (!button.contains(event.target as Node)) moved = true }
  document.addEventListener('focusin', onFocus)
  document.addEventListener('pointerdown', onPointer)
  return () => window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
    document.removeEventListener('focusin', onFocus)
    document.removeEventListener('pointerdown', onPointer)
    if (!moved && button.isConnected && !button.disabled
      && (document.activeElement === document.body || document.activeElement === button)) button.focus({ preventScroll: true })
  }))
}

/** Preserve a surviving visible round through a scoped reconciliation. */
export function captureAdminReviewAnchor(options: { scrollLocked?: boolean } = {}) {
  const elements = [...document.querySelectorAll<HTMLElement>('[data-review-anchor]')]
  let scroller: Element | null = elements[0]?.parentElement || null
  while (scroller && scroller !== document.documentElement) {
    if (/(auto|scroll)/.test(window.getComputedStyle(scroller).overflowY) && scroller.scrollHeight > scroller.clientHeight) break
    scroller = scroller.parentElement
  }
  scroller ||= document.scrollingElement
  const scroll = scroller?.scrollTop || 0
  // Modal scroll locks can adjust scrollTop themselves. While the page is
  // locked, that change is not a new page-scroll choice by the operator.
  const scrollLocked = options.scrollLocked ?? Boolean(document.querySelector('[role="dialog"]'))
  const anchors = elements
    .map(el => ({ id: el.dataset.reviewAnchor, y: el.getBoundingClientRect().top, bottom: el.getBoundingClientRect().bottom }))
    .filter(p => p.bottom > 0)
  return () => window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
    if (!scrollLocked && Math.abs((scroller?.scrollTop || 0) - scroll) > 2) return // Do not undo a user's subsequent scroll.
    const elements = [...document.querySelectorAll<HTMLElement>('[data-review-anchor]')]
    for (const anchor of anchors) {
      const el = elements.find(node => node.dataset.reviewAnchor === anchor.id)
      if (el) { const delta = el.getBoundingClientRect().top - anchor.y; if (Math.abs(delta) > 1) scroller?.scrollBy({ top: delta, behavior: 'instant' }); break }
    }
  }))
}
