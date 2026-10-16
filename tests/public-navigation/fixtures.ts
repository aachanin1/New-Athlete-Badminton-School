import { test as base, expect, type Locator, type Page } from '@playwright/test'

// These tests inspect navigation and dialog entry only; no account or business writes.
export const test = base.extend<{ navigationGuard: void }>({
  navigationGuard: [async ({ context, page, baseURL }, use) => {
    const errors: string[] = []
    const blocked: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await context.route('**/*', async route => {
      const request = route.request()
      const url = new URL(request.url())
      if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method()) || url.hostname !== new URL(baseURL!).hostname) {
        blocked.push(`${request.method()} ${url.origin}${url.pathname}`)
        await route.abort('blockedbyclient')
        return
      }
      await route.continue()
    })
    await use()
    expect(blocked, 'no external requests or mutations').toEqual([])
    expect(errors, 'no client runtime errors').toEqual([])
  }, { auto: true }],
})

export { expect }

export const sections = [
  { id: 'hero', name: 'หน้าแรก' },
  { id: 'pricing', name: 'คอร์สเรียน & ราคา' },
  { id: 'levels', name: 'Level พัฒนาการ' },
  { id: 'branches', name: 'สาขาต่างๆ' },
  { id: 'contact', name: 'ติดต่อสอบถาม' },
]

export const menuTrigger = (page: Page) => page.locator('header button[aria-haspopup="dialog"]')
export const menu = (page: Page) => page.getByRole('dialog', { name: 'Website navigation' })

export async function expectMenuStaysOpen(page: Page) {
  await expect(menu(page)).toBeVisible()
  // Observe beyond the effect frame and Sheet animation: the original bug closes here.
  await page.waitForTimeout(650)
  await expect(menuTrigger(page)).toHaveAttribute('aria-expanded', 'true')
  await expect(menu(page)).toBeVisible()
}

export async function expectSectionPosition(page: Page, id: string) {
  await expect.poll(async () => page.evaluate(id => {
    const element = document.getElementById(id)!
    const expected = Math.max(0, element.getBoundingClientRect().top + window.scrollY - 80)
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight
    return Math.abs(window.scrollY - Math.min(expected, maxScroll))
  }, id)).toBeLessThan(5)
}

export async function dismissDialog(dialog: Locator) {
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(dialog).toBeHidden()
}
