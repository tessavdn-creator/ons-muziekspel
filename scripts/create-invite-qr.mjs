import QRCode from 'qrcode'
import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

const [url, output] = process.argv.slice(2)
if (!url || !output) throw new Error('Gebruik: node scripts/create-invite-qr.mjs URL UITVOER.png')
await mkdir(dirname(output), { recursive: true })
await QRCode.toFile(output, url, {
  width: 1400,
  margin: 4,
  errorCorrectionLevel: 'H',
  color: { dark: '#110e18', light: '#ffffff' },
})
console.log(output)
