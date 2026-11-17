import { deflateSync } from 'node:zlib'
// Synthetic two-frame APNG with valid chunk CRCs. No external content or credentials.
function chunk(type: string, data = Buffer.alloc(0)) {
  const bytes = Buffer.concat([Buffer.from(type), data])
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  const size = Buffer.alloc(4),
    checksum = Buffer.alloc(4)
  size.writeUInt32BE(data.length)
  checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0)
  return Buffer.concat([size, bytes, checksum])
}
export function animatedPNG() {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(1, 0)
  ihdr.writeUInt32BE(1, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const animation = Buffer.alloc(8)
  animation.writeUInt32BE(2)
  const frame = (sequence: number) => {
    const data = Buffer.alloc(26)
    data.writeUInt32BE(sequence)
    data.writeUInt32BE(1, 4)
    data.writeUInt32BE(1, 8)
    data.writeUInt16BE(1, 20)
    data.writeUInt16BE(10, 22)
    return data
  }
  const second = Buffer.alloc(4)
  second.writeUInt32BE(2)
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('acTL', animation),
    chunk('fcTL', frame(0)),
    chunk('IDAT', deflateSync(Buffer.from([0, 255, 0, 0, 255]))),
    chunk('fcTL', frame(1)),
    chunk('fdAT', Buffer.concat([second, deflateSync(Buffer.from([0, 0, 255, 0, 255]))])),
    chunk('IEND'),
  ])
}
