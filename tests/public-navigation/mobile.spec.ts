import { test, expect, sections, menuTrigger, menu, expectMenuStaysOpen, expectSectionPosition, dismissDialog } from './fixtures'

test('fresh menu supports close, backdrop and repeated opening', async ({ page }) => {
  await page.goto('/')
  for (let round = 0; round < 3; round++) {
    await menuTrigger(page).tap()
    await expectMenuStaysOpen(page)
    if (round === 1) {
      await page.touchscreen.tap(20, 300)
      await expect(menu(page)).toBeHidden()
    } else {
      await dismissDialog(menu(page))
    }
    await expect(menuTrigger(page)).toHaveAttribute('aria-expanded', 'false')
  }
})

for (const section of sections) {
  test(`direct arrival at ${section.id} keeps the menu open`, async ({ page }) => {
    await page.goto(`/#${section.id}`)
    await expectSectionPosition(page, section.id)
    await menuTrigger(page).tap()
    await expectMenuStaysOpen(page)
    await dismissDialog(menu(page))
  })
}

for (const section of sections) {
  test(`select ${section.id}, scroll, reopen and dismiss`, async ({ page }) => {
    await page.goto('/')
    await menuTrigger(page).tap()
    await expectMenuStaysOpen(page)
    await menu(page).getByRole('link', { name: section.name, exact: true }).tap()
    await expect(menu(page)).toBeHidden()
    await expect(page).toHaveURL(new RegExp(`/#${section.id}$`))
    await expectSectionPosition(page, section.id)
    await menuTrigger(page).tap()
    await expectMenuStaysOpen(page)
    await dismissDialog(menu(page))
    await expectSectionPosition(page, section.id)
  })
}

for (const action of ['เข้าสู่ระบบ', 'สมัครสมาชิก']) {
  test(`section link → menu → ${action} → close → menu`, async ({ page }) => {
    await page.goto('/#pricing')
    await expectSectionPosition(page, 'pricing')
    await menuTrigger(page).tap()
    await expectMenuStaysOpen(page)
    await menu(page).getByRole('button', { name: action, exact: true }).tap()
    const auth = page.getByRole('dialog', { name: action, exact: true })
    await expect(auth).toBeVisible()
    await expect(menu(page)).toBeHidden()
    await expect(auth.getByLabel('อีเมล', { exact: true })).toBeVisible()
    await expect(auth.getByLabel('รหัสผ่าน', { exact: true })).toBeVisible()
    await dismissDialog(auth)
    await menuTrigger(page).tap()
    await expectMenuStaysOpen(page)
  })
}

test('Ranking navigation and return to home section retain working menu', async ({ page }) => {
  await page.goto('/#pricing')
  await menuTrigger(page).tap()
  await expectMenuStaysOpen(page)
  await menu(page).getByRole('link', { name: 'อันดับนักเรียน', exact: true }).tap()
  await expect(page).toHaveURL(/\/ranking$/)
  await expect(page.getByRole('heading', { name: /อันดับนักเรียน/ }).first()).toBeVisible()
  await menuTrigger(page).tap()
  await expectMenuStaysOpen(page)
  await menu(page).getByRole('link', { name: 'สาขาต่างๆ', exact: true }).tap()
  await expect(page).toHaveURL(/\/#branches$/)
  await expectSectionPosition(page, 'branches')
  await menuTrigger(page).tap()
  await expectMenuStaysOpen(page)
})

test('logo return to hero permits reopening menu', async ({ page }) => {
  await page.goto('/#contact')
  await expectSectionPosition(page, 'contact')
  await page.getByRole('button', { name: 'New Athlete School New Athlete School', exact: true }).tap()
  await expect(page).toHaveURL(/\/#hero$/)
  await expectSectionPosition(page, 'hero')
  await menuTrigger(page).tap()
  await expectMenuStaysOpen(page)
})

test('reduced motion still scrolls and keeps menu open', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/#levels')
  await expectSectionPosition(page, 'levels')
  await menuTrigger(page).tap()
  await expectMenuStaysOpen(page)
  await menu(page).getByRole('link', { name: 'คอร์สเรียน & ราคา', exact: true }).tap()
  await expectSectionPosition(page, 'pricing')
  await menuTrigger(page).tap()
  await expectMenuStaysOpen(page)
})
