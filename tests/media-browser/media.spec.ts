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
