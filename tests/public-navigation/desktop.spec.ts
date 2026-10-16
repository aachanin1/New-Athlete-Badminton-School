import { test, expect, sections, menuTrigger, expectSectionPosition, dismissDialog } from './fixtures'

test('desktop section navigation and Ranking return', async ({ page }) => {
  await page.goto('/')
  await expect(menuTrigger(page)).toBeHidden()
  for (const section of sections) {
    await page.locator(`header nav a[href="#${section.id}"]`).click()
    await expect(page).toHaveURL(new RegExp(`/#${section.id}$`))
    await expectSectionPosition(page, section.id)
  }
  await page.locator('header nav a[href="/ranking"]').click()
  await expect(page).toHaveURL(/\/ranking$/)
  await expect(page.getByRole('heading', { name: /อันดับนักเรียน/ }).first()).toBeVisible()
  await page.locator('header nav a[href="/#pricing"]').click()
  await expect(page).toHaveURL(/\/#pricing$/)
  await expectSectionPosition(page, 'pricing')
})

test('desktop login and registration dialog entry', async ({ page }) => {
  await page.goto('/#pricing')
  for (const action of ['เข้าสู่ระบบ', 'สมัครสมาชิก']) {
    await page.locator('header nav').getByRole('button', { name: action, exact: true }).click()
    const auth = page.getByRole('dialog', { name: action, exact: true })
    await expect(auth).toBeVisible()
    await expect(auth.getByLabel('อีเมล', { exact: true })).toBeVisible()
    await dismissDialog(auth)
  }
})
