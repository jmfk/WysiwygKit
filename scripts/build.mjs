import { build } from 'vite'
import { mkdir, cp, readFile, writeFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
const root = process.cwd(),
  core = JSON.parse(await readFile('packages/core/package.json', 'utf8'))
await build({
  configFile: false,
  build: {
    lib: {
      entry: resolve('packages/core/src/index.ts'),
      formats: ['es'],
      fileName: () => 'index.js',
    },
    outDir: 'packages/core/dist',
    rollupOptions: {
      external: (id) =>
        Object.keys(core.dependencies).some((dep) => id === dep || id.startsWith(dep + '/')),
    },
  },
})
await cp('.types/core/src', 'packages/core/dist', { recursive: true })
await cp('packages/core/src/style.css', 'packages/core/dist/style.css')
await build({
  configFile: false,
  build: {
    lib: {
      entry: resolve('packages/react/src/index.tsx'),
      formats: ['es'],
      fileName: () => 'index.js',
    },
    outDir: 'packages/react/dist',
    rollupOptions: { external: ['react', 'react/jsx-runtime', '@wysiwygkit/core'] },
  },
})
await cp('.types/react/src', 'packages/react/dist', { recursive: true })
const out = 'packages/swift/Sources/WysiwygKit/Resources/editor'
await build({
  configFile: false,
  define: { 'process.env.NODE_ENV': '"production"' },
  build: {
    lib: {
      entry: resolve('packages/native/bridge.ts'),
      name: 'WysiwygNative',
      formats: ['iife'],
      fileName: () => 'engine.js',
      cssFileName: 'style',
    },
    outDir: out,
    emptyOutDir: true,
    chunkSizeWarningLimit: 1200,
  },
})
await writeFile(
  out + '/index.html',
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src data: blob: https: http:; connect-src 'none'; base-uri 'none'; form-action 'none'"><title>WysiwygKit</title><link rel="stylesheet" href="style.css"></head><body style="margin:0"><div id="editor"></div><script src="engine.js"></script></body></html>\n`,
)
let notices =
  'WysiwygKit 0.1.0 — MIT\nOriginal project license: see LICENSE.\n\nBundled dependency notices\n==========================\n'
const visited = new Set()
async function visit(name) {
  if (visited.has(name)) return
  visited.add(name)
  let pkg
  try {
    pkg = JSON.parse(await readFile(`node_modules/${name}/package.json`, 'utf8'))
  } catch {
    return
  }
  if (['react', 'react-dom'].includes(name)) return
  notices += `\n${name} ${pkg.version} (${pkg.license ?? 'see license'})\n`
  for (const file of await readdir(`node_modules/${name}`)) {
    if (/^licen[cs]e(?:\.|$)/i.test(file)) {
      try {
        notices += (await readFile(`node_modules/${name}/${file}`, 'utf8')) + '\n'
      } catch {}
    }
  }
  for (const dependency of Object.keys(pkg.dependencies ?? {})) await visit(dependency)
}
for (const name of Object.keys(core.dependencies)) await visit(name)
await writeFile(out + '/THIRD_PARTY_NOTICES.txt', notices.trimEnd() + '\n')
await cp('LICENSE', out + '/LICENSE.txt')
const assets = {}
for (const name of (await readdir(out)).sort()) {
  const bytes = await readFile(out + '/' + name)
  assets[name] = { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }
}
await writeFile(
  out + '/manifest.json',
  JSON.stringify({ engineVersion: '0.1.0', protocolVersion: 1, assets }, null, 2) + '\n',
)
for (const path of ['packages/core/dist', 'packages/react/dist']) {
  await cp('LICENSE', path + '/LICENSE')
  await cp('README.md', path + '/README.md')
}
console.log('Built core, React and the shared offline native engine.')
