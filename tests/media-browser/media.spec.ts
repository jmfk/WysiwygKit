import { test, expect } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import type { WysiwygEditor } from '../../packages/core/src/index'
declare global {
  interface Window {
    mediaEditor: WysiwygEditor
  }
}
for (const demo of ['media', 'media-react']) {
  test(`${demo}: upload, independent crops, restore and durable publication`, async ({ page }) => {
    await page.goto(`/demos/${demo}/`)
    await expect(page.locator('.tiptap')).toHaveCount(1)
    await page.locator('[data-command=image]').click()
    await page
      .locator('input[type=file]')
      .setInputFiles(fileURLToPath(new URL('../fixtures/pixel.png', import.meta.url)))
    await expect
      .poll(() =>
        page
          .locator('.wk-image img')
          .evaluateAll(
            (images) => images.length === 1 && (images[0] as HTMLImageElement).naturalWidth > 0,
          ),
      )
      .toBe(true)
    await page.locator('#focus-x').fill('0.1')
    await page.locator('#focus-y').fill('0.8')
    await page.locator('#apply-focus').click()
    await page.locator('#duplicate-placement').click()
    await expect(page.locator('.wk-image img')).toHaveCount(2)
    await page.locator('#placement').selectOption({ index: 1 })
    await page.locator('#focus-x').fill('0.9')
    await page.locator('#apply-focus').click()
    const independent = await page.evaluate(() => {
      const images = window.mediaEditor.getHTMLSnapshot().images
      return (
        images.length === 2 &&
        images[0].asset?.id === images[1].asset?.id &&
        images[0].occurrenceId !== images[1].occurrenceId &&
        images[0].focus?.x === 0.1 &&
        images[1].focus?.x === 0.9
      )
    })
    expect(independent).toBe(true)
    await page.locator('#preview-variants').click()
    await expect
      .poll(() =>
        page
          .locator('#previews img')
          .evaluateAll(
            (images) =>
              images.length === 3 && images.every((i) => (i as HTMLImageElement).naturalWidth > 0),
          ),
      )
      .toBe(true)
    await page.locator('#save-media').click()
    const saved = await page.locator('#media-snapshot').inputValue()
    expect(saved.includes('asset:')).toBe(true)
    expect(/X-Amz-|\/api\/media\/preview|IMGPROXY_KEY/i.test(saved)).toBe(false)
    await page.locator('#restore-media').click()
    await expect(page.locator('.wk-image img')).toHaveCount(2)
    const before = await page.evaluate(() => ({
      source: window.mediaEditor.getSource(),
      state: window.mediaEditor.state(),
    }))
    await page.locator('#refresh-images').click()
    await page.locator('#publish-media').click()
    await expect
      .poll(async () => (await page.locator('#published-html').inputValue()).includes('srcset='))
      .toBe(true)
    const html = await page.locator('#published-html').inputValue()
    expect(/X-Amz-|\/api\/media\/preview|asset:/i.test(html)).toBe(false)
    const after = await page.evaluate(() => ({
      source: window.mediaEditor.getSource(),
      state: window.mediaEditor.state(),
    }))
    expect(after.source).toBe(before.source)
    expect(after.state.revision).toBe(before.state.revision)
    expect(after.state.dirty).toBe(before.state.dirty)
    const publicDelivery = await page.evaluate(async (html) => {
      const doc = new DOMParser().parseFromString(html, 'text/html')
      const image = new Image()
      image.src = doc.querySelector('img')!.src
      await image.decode()
      return image.naturalWidth > 0
    }, html)
    expect(publicDelivery).toBe(true)
    await expect(page.locator('#media-error')).toBeEmpty()
  })
}
test('host rejects an unrelated browser origin and missing demo intent', async ({
  page,
  request,
}) => {
  const foreign = await request.post('http://127.0.0.1:13701/api/media/uploads', {
    headers: { Origin: 'https://unrelated.invalid', 'x-wysiwyg-demo': '1' },
    data: {},
  })
  expect(foreign.status()).toBe(403)
  await page.goto('/demos/media/')
  expect(
    await page.evaluate(
      async () =>
        (
          await fetch('/api/media/uploads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{}',
          })
        ).status,
    ),
  ).toBe(403)
})

for (const change of ['placement', 'document'] as const) {
  test(`pending crops are discarded after changing ${change}`, async ({ page }) => {
    await page.goto('/demos/media/')
    await expect(page.locator('.tiptap')).toHaveCount(1)
    await page.locator('[data-command=image]').click()
    await page
      .locator('input[type=file]')
      .setInputFiles(fileURLToPath(new URL('../fixtures/pixel.png', import.meta.url)))
    await expect(page.locator('#placement option')).toHaveCount(1)
    await page.locator('#duplicate-placement').click()
    await expect(page.locator('#placement option')).toHaveCount(2)
    let release!: () => void, started!: () => void, finished!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const pending = new Promise<void>((resolve) => {
      started = resolve
    })
    const done = new Promise<void>((resolve) => {
      finished = resolve
    })
    await page.route('**/api/media/resolve', async (route) => {
      if (route.request().postDataJSON()?.variant?.width !== 480) {
        await route.continue()
        return
      }
      started()
      await gate
      // Non-secret synthetic response: a cancelled client must ignore even a late success.
      await route
        .fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            url: '/tests/fixtures/pixel.png',
            width: 480,
            height: 270,
            expiresAt: Date.now() + 60000,
          }),
        })
        .catch(() => undefined)
      finished()
    })
    await page.locator('#preview-variants').click()
    await pending
    if (change === 'placement') await page.locator('#placement').selectOption({ index: 1 })
    else
      await page.evaluate(() =>
        window.mediaEditor.loadDocument({
          id: 'replacement',
          format: 'markdown',
          source: 'Replacement',
        }),
      )
    release()
    await done
    // A fresh request completes after the delayed response and lets its continuations settle.
    await page.evaluate(async () => {
      await fetch('/api/media/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
    })
    await expect(page.locator('#previews img')).toHaveCount(0)
    await expect(page.locator('#media-error')).toBeEmpty()
  })
}
