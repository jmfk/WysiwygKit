import { test, expect } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import type { WysiwygEditor } from '../../packages/core/src/index'
declare global {
  interface Window {
    demoEditor: WysiwygEditor
  }
}
test.beforeEach(async ({ page }) => {
  await page.goto('/demos/web/')
  await expect(page.getByRole('textbox', { name: 'Document editor' })).toBeVisible()
})
test('typing, formatting, undo and source snapshot', async ({ page }) => {
  const editor = page.getByRole('textbox', { name: 'Document editor' })
  await editor.click()
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+End' : 'Control+End')
  await page.keyboard.type(' A new ending.')
  await page.getByRole('button', { name: 'Export snapshot', exact: true }).click()
  expect(await page.locator('#source').inputValue()).toContain('A new ending.')
  await page.locator('[data-command=undo]').click()
  await page.getByRole('button', { name: 'Export snapshot', exact: true }).click()
  expect(await page.locator('#source').inputValue()).not.toContain('A new ending.')
})
test('table insertion and row editing through public commands', async ({ page }) => {
  const existing = page.locator('.tiptap table').first()
  const originalRows = await existing.locator('tr').count()
  await page.evaluate(() => window.demoEditor.execute('table'))
  await expect(page.locator('.tiptap table')).toHaveCount(2)
  // Insertion selects its new table. Exercise the API without racing a separate DOM selectionchange.
  const inserted = page.locator('.tiptap table').last()
  const before = await inserted.locator('tr').count()
  expect(await page.evaluate(() => window.demoEditor.commandState('addRow').enabled)).toBe(true)
  expect(await page.evaluate(() => window.demoEditor.execute('addRow'))).toBe(true)
  await expect(inserted.locator('tr')).toHaveCount(before + 1)
  await expect(existing.locator('tr')).toHaveCount(originalRows)
})
test('Fountain has screenplay elements and protected source metadata', async ({ page }) => {
  await page.locator('#format').selectOption('fountain')
  await expect(page.locator('[data-screenplay=character]')).toHaveCount(2)
  await page.getByRole('button', { name: 'Export snapshot', exact: true }).click()
  const source = await page.locator('#source').inputValue()
  expect(source).toContain('[[Keep this note when saving.]]')
  expect(source).toContain('#1#')
  expect(source).toContain('@ليلى')
  expect(await page.evaluate(() => window.demoEditor.execute('table'))).toBe(false)
})
test('independent UI locale, RTL content and read-only state', async ({ page }) => {
  await page.locator('#locale').selectOption('ar')
  await expect(page.locator('.wk-editor')).toHaveAttribute('dir', 'rtl')
  await expect(page.locator('.tiptap')).toHaveAttribute('dir', 'auto')
  await page.locator('#direction').selectOption('ltr')
  await expect(page.locator('.tiptap')).toHaveAttribute('dir', 'ltr')
  await page.locator('#readonly').check()
  await expect(page.locator('.tiptap')).toHaveAttribute('contenteditable', 'false')
  const changed = await page.evaluate(() => window.demoEditor.execute('bold'))
  expect(changed).toBe(false)
})
test('command palette and literal replacement', async ({ page }) => {
  await page.getByRole('textbox', { name: 'Document editor' }).click()
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+k' : 'Control+k')
  await page.getByRole('textbox', { name: 'Search commands' }).fill('Find')
  await page.locator('.wk-command-list button').filter({ hasText: 'Find' }).click()
  await page.getByRole('textbox', { name: 'Find text' }).fill('A place to write')
  await page.getByRole('textbox', { name: 'Replacement', exact: true }).fill('A place to think')
  await page.getByRole('button', { name: 'Replace all', exact: true }).click()
  await expect(page.locator('.tiptap h1')).toHaveText('A place to think')
})
test('unsafe input is rejected atomically; scripts do not execute', async ({ page }) => {
  const result = await page.evaluate(async () => {
    try {
      await window.demoEditor.loadDocument({
        id: 'bad',
        format: 'html',
        source: '<p onclick="window.pwned=true">Hi<script>window.pwned=true</script></p>',
      })
      return 'accepted'
    } catch {
      return 'rejected'
    }
  })
  expect(result).toBe('rejected')
  expect(await page.evaluate(() => window.demoEditor.state().format)).toBe('markdown')
  expect(await page.evaluate(() => 'pwned' in window)).toBe(false)
})
test('remote image import makes no automatic network request', async ({ page }) => {
  let requested = false
  await page.route('https://external.invalid/**', (route) => {
    requested = true
    return route.abort()
  })
  await page.evaluate(() =>
    window.demoEditor.loadDocument({
      id: 'image',
      format: 'markdown',
      source: '![alt](https://external.invalid/pixel.png)',
    }),
  )
  await page.getByRole('button', { name: 'Export snapshot', exact: true }).click()
  expect(requested).toBe(false)
  expect(await page.locator('#source').inputValue()).toContain('external.invalid')
})
test('React Strict Mode and rerenders retain a live editor and undo', async ({ page }) => {
  await page.goto('/demos/react/')
  await expect(page.locator('.tiptap')).toHaveCount(1)
  await page.getByRole('textbox', { name: 'Document editor' }).click()
  await page.keyboard.type('Typed ')
  await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption('dark')
  await expect(page.locator('.tiptap')).toContainText('Typed')
  await page.locator('[data-command=undo]').click()
  await expect(page.locator('.tiptap')).not.toContainText('Typed')
})
test('native asset bridge rejects versions and stale identities', async ({ page }) => {
  await page.goto('/packages/swift/Sources/WysiwygKit/Resources/editor/index.html')
  const result = await page.evaluate(async () => {
    const api = (
      window as unknown as {
        wysiwygNative: {
          receive: (
            v: unknown,
          ) => Promise<{ ok: boolean; error?: { code: string }; result?: unknown }>
        }
      }
    ).wysiwygNative
    const mismatch = await api.receive({ protocolVersion: 99, id: 'a', operation: 'initialize' })
    const initialized = await api.receive({
      protocolVersion: 1,
      id: 'b',
      operation: 'initialize',
      payload: { document: { id: 'native-test', format: 'markdown', source: '# Native' } },
    })
    const stale = await api.receive({
      protocolVersion: 1,
      id: 'c',
      operation: 'snapshot',
      documentId: 'wrong',
    })
    const good = await api.receive({
      protocolVersion: 1,
      id: 'd',
      operation: 'snapshot',
      documentId: 'native-test',
    })
    return { mismatch, initialized, stale, good }
  })
  expect(result.mismatch.error?.code).toBe('PROTOCOL_MISMATCH')
  expect(result.initialized.ok).toBe(true)
  expect(result.stale.error?.code).toBe('STALE_DOCUMENT')
  expect(result.good.ok).toBe(true)
})
test('shared surface visual regression @visual', async ({ page }) => {
  await page.locator('#theme').selectOption('light')
  await expect(page.locator('.wk-editor')).toHaveScreenshot('markdown-light.png', {
    animations: 'disabled',
  })
  await page.locator('#format').selectOption('fountain')
  await page.locator('#theme').selectOption('dark')
  await expect(page.locator('.wk-editor')).toHaveScreenshot('fountain-dark.png', {
    animations: 'disabled',
  })
})
test('local image insertion and focal metadata survive export/reload', async ({ page }) => {
  await page.locator('[data-command=image]').click()
  await page
    .locator('input[type=file]')
    .setInputFiles(fileURLToPath(new URL('../fixtures/pixel.png', import.meta.url)))
  await expect(page.locator('.wk-image img')).toBeVisible()
  await page.locator('.wk-image img').click()
  expect(
    await page.evaluate(() =>
      window.demoEditor.execute('imageFocus', { focus: { x: 0.2, y: 0.8 }, aspectRatio: 1 }),
    ),
  ).toBe(true)
  const retained = await page.evaluate(async () => {
    const snapshot = await window.demoEditor.getSnapshot()
    await window.demoEditor.loadDocument(snapshot)
    return (await window.demoEditor.getSnapshot()).metadata?.images[0].metadata.focus
  })
  expect(retained).toEqual({ x: 0.2, y: 0.8 })
})
