import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import os from 'node:os'
import QRCode from 'qrcode'

const baseUrl = String(process.env.TRACKBACK_BASE_URL || 'https://tessavdn-creator.github.io/ons-muziekspel/').replace(/\/$/, '')
const outputRoot = process.env.TRACKBACK_INVITE_OUTPUT || join(os.homedir(), 'Documents', 'TRACKBACK QR-codes', 'Persoonlijke edities')
const gifts = [
  { name: 'Iris', id: 'g-7n4p2d8k', keyFile: '.private/gifts/iris.key', title: 'Iris haar platenkast', subtitle: '3 persoonlijke edities · 300 kaarten' },
  { name: 'Nikki', id: 'g-m8q4v2zk', keyFile: '.private/gifts/nikki.key', title: 'Full Throttle', subtitle: 'Nikki’s Auto Classics · 300 kaarten' },
]

for (const gift of gifts) {
  const key = (await readFile(gift.keyFile, 'utf8')).trim()
  const url = `${baseUrl}/#gift=${gift.id}.${key}`
  const directory = join(outputRoot, gift.name)
  await mkdir(directory, { recursive: true })
  const qrDataUrl = await QRCode.toDataURL(url, { width: 1400, margin: 4, errorCorrectionLevel: 'H', color: { dark: '#110e18', light: '#ffffff' } })
  await QRCode.toFile(join(directory, `${gift.name.toLowerCase()}-cadeau-qr.png`), url, { width: 1400, margin: 4, errorCorrectionLevel: 'H', color: { dark: '#110e18', light: '#ffffff' } })
  await writeFile(join(directory, `TRACKBACK voor ${gift.name}.webloc`), `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>URL</key><string>${url}</string></dict></plist>\n`)
  await writeFile(join(directory, `${gift.name.toLowerCase()}-uitnodiging.html`), `<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>TRACKBACK voor ${gift.name}</title><style>@import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=DM+Sans:wght@600;800&display=swap');@page{size:148mm 210mm;margin:0}*{box-sizing:border-box}html,body{width:100%;height:100%;margin:0;background:#07050d;color:#fff;font-family:'DM Sans',sans-serif}.card{width:100%;height:100%;overflow:hidden;position:relative;padding:12mm;text-align:center;background:radial-gradient(circle at 10% 12%,#ffd51f 0 16mm,transparent 16.3mm),radial-gradient(circle at 92% 34%,rgba(182,76,255,.65),transparent 35mm),radial-gradient(circle at 8% 91%,rgba(40,216,189,.55),transparent 28mm),#07050d}.brand{display:block;font:11pt 'Archivo Black';letter-spacing:.22em}.eyebrow{display:block;margin-top:8mm;color:#ffd51f;font-size:7pt;font-weight:800;letter-spacing:.2em;text-transform:uppercase}h1{margin:3mm 0 2mm;color:#fff;font:27pt/0.93 'Archivo Black';letter-spacing:-.05em;text-transform:uppercase;text-shadow:2px 2px 0 #ff278b}h2{margin:0 0 4mm;color:#ff7fc0;font:15pt 'Archivo Black'}p{margin:0;color:#cfc6d8;font-size:8.5pt}.qr{width:62mm;height:62mm;margin:7mm auto 5mm;padding:3mm;border-radius:6mm;background:#fff;box-shadow:3mm 3mm 0 #ff278b}.qr img{width:100%;display:block}.scan{display:block;font:11pt 'Archivo Black';text-transform:uppercase}.foot{margin-top:6mm;color:#8f8799;font-size:6.5pt;letter-spacing:.12em}.dots{position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle,#fff 0 1px,transparent 1.5px) 0 0/24mm 24mm;opacity:.18}</style></head><body><main class="card"><div class="dots"></div><strong class="brand">TRACKBACK</strong><span class="eyebrow">Een persoonlijk muziekcadeau voor</span><h1>Gefeliciteerd,<br>${gift.name}!</h1><h2>${gift.title}</h2><p>${gift.subtitle}</p><div class="qr"><img src="${qrDataUrl}" alt="Cadeau QR-code"></div><strong class="scan">Scan & pak je cadeau uit</strong><p class="foot">LISTEN · PLACE · REVEAL</p></main></body></html>`)
}

await writeFile(join(outputRoot, 'LEES-MIJ.txt'), 'TRACKBACK PERSOONLIJKE UITNODIGINGEN\n\nIedere map bevat een privé-QR, een printbare uitnodiging en een klikbare link. Deel alleen de map van de juiste ontvanger: de QR is de toegangssleutel tot haar persoonlijke bibliotheek.\n')
console.log(`Uitnodigingen gemaakt in ${outputRoot}`)
