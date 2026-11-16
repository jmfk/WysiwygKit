import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
const root = 'packages/swift/Sources/WysiwygKit/Resources/editor'
const manifest = JSON.parse(await readFile(root + '/manifest.json', 'utf8'))
if (manifest.engineVersion !== '0.1.0' || manifest.protocolVersion !== 1)
  throw new Error('Unexpected engine/protocol version')
for (const [name, expected] of Object.entries(manifest.assets)) {
  if (name.includes('/') || name.includes('..')) throw new Error('Invalid manifest path')
  const data = await readFile(root + '/' + name)
  if (
    data.length !== expected.bytes ||
    createHash('sha256').update(data).digest('hex') !== expected.sha256
  )
    throw new Error(`Asset mismatch: ${name}`)
}
console.log(
  `PASS: ${Object.keys(manifest.assets).length} bundled assets match their versioned manifest.`,
)
