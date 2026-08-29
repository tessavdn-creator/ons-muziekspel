// Inlegkaart voor Lodewijks doosje: 122 x 52 mm, past in de opening en ligt
// bovenop de rechtopstaande kaarten. Alles staat op EEN kant: niets vouwen,
// niets dubbelzijdig. Uitknippen en erin leggen.
import { mkdir, readFile, writeFile, rm, mkdtemp } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import QRCode from 'qrcode'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const chrome = process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const baseUrl = String(process.env.TRACKBACK_BASE_URL || 'https://tessavdn-creator.github.io/ons-muziekspel/').replace(/\/$/, '')
const output = process.argv[2] || path.join(root, '..', '1 PRINTEN', 'Lodewijk', 'Cadeau en uitnodiging', 'TRACKBACK-Lodewijk-inlegkaart-doosje.pdf')

const key = (await readFile(path.join(root, '.private/gifts/lodewijk.key'), 'utf8')).trim()
const giftUrl = `${baseUrl}/#gift=g-5k9w3rt2.${key}`
const qr = await QRCode.toDataURL(giftUrl, { width: 900, margin: 1, errorCorrectionLevel: 'H', color: { dark: '#2a1008', light: '#ffffff' } })

// Voorkant: spelen met de geprinte kaarten. Achterkant: spelen zonder, via de
// app en een Spotify-playlist. De uitgebreide uitleg staat op zijn eigen pagina.
const metKaarten = [
  'Scan de code hiernaast en koppel Spotify. Eén telefoon is de dj.',
  'Iedereen begint met één kaart, jaartal naar boven.',
  'De dj scant een kaart. Je hoort het nummer, het jaar blijft geheim.',
  'Leg hem in je rij: ervoor, erna of ertussen.',
  'De dj onthult. Goed geraden? Dan houd je de kaart.',
  'Wie als eerste tien op een rij heeft, wint.',
]
const zonderKaarten = [
  'Scan de code hiernaast en koppel Spotify.',
  'Kies Speel Samen, en daarna Vrije Spotify-playlist.',
  'Maak een live kamer. Er verschijnt één QR-code.',
  'Iedereen scant die en doet mee op zijn eigen telefoon.',
  'Kies een playlist. Het spel deelt de nummers vanzelf uit.',
  'Zelfde spel, alleen zonder kaarten op tafel.',
]

const maakKaart = (kop, stappen, staart) => `<div class="kaart">
  <div class="qr"><img src="${qr}" alt=""></div>
  <div class="tekst">
    <span class="merk">TRACKBACK</span>
    <h1>${kop}</h1>
    <ol>${stappen.map(stap => `<li>${stap}</li>`).join('')}</ol>
    <small>${staart}</small>
  </div>
</div>`

const voorkant = maakKaart('Lodewijk zijn Platenkast', metKaarten, 'Bij Tijdlijn hoef je niets in te typen. Alleen scannen, luisteren en de kaart neerleggen.')
const achterkant = maakKaart('Ook zonder de kaartjes', zonderKaarten, 'Handig onderweg of als de doos niet bij de hand is. De kaarten blijven gewoon werken.')

const html = `<!doctype html><html lang="nl"><head><meta charset="utf-8"><title>TRACKBACK inlegkaart Lodewijk</title><style>
@page{size:A4 portrait;margin:0}
*{box-sizing:border-box}
html,body{margin:0;background:#fff;font-family:Arial,Helvetica,sans-serif}
/* Het blok staat exact in het midden van het vel, horizontaal en verticaal. Daardoor
   liggen de kaartjes na het omdraaien op precies dezelfde plek, welke kant je het
   papier ook terugstopt. En omdat de vier kaartjes per vel gelijk zijn, hoeft er
   niets gespiegeld te worden. */
.vel{width:210mm;height:297mm;display:grid;grid-template-rows:repeat(4,52mm);gap:9mm;align-content:center;justify-content:center}
.kaart{width:122mm;height:52mm;overflow:hidden;padding:4.5mm 5.5mm;color:#2a1008;background:#fff;border:.4mm solid #2a1008;display:grid;grid-template-columns:30mm 1fr;gap:5mm;align-items:center;break-inside:avoid;print-color-adjust:exact;-webkit-print-color-adjust:exact}
.qr{width:30mm;height:30mm;background:#fff}
.qr img{display:block;width:100%;height:100%}
.merk{font-family:"Arial Black",Arial,sans-serif;font-size:7.5pt;letter-spacing:.14em;color:#f5a623}
.tekst h1{margin:.8mm 0 1.6mm;font-family:"Arial Black",Arial,sans-serif;font-size:11.5pt;line-height:1;color:#2a1008}
.tekst ol{margin:0;padding-left:4mm;font-size:6pt;line-height:1.4;color:#3d2415}
.tekst li{margin-bottom:.35mm}
.tekst li::marker{color:#f5a623;font-weight:900}
.tekst small{display:block;margin-top:1.6mm;padding-top:1.2mm;border-top:.3mm solid #f5a623;font-size:5.2pt;color:#6b5344}
</style></head><body>
<div class="vel">${[0,1,2,3].map(() => voorkant).join('')}</div>
<div class="vel">${[0,1,2,3].map(() => achterkant).join('')}</div>
</body></html>`

const temp = await mkdtemp(path.join(os.tmpdir(), 'trackback-insert-'))
try {
  const bron = path.join(temp, 'inlegkaart.html')
  await writeFile(bron, html)
  await mkdir(path.dirname(output), { recursive: true })
  await new Promise((resolve, reject) => {
    const proces = spawn(chrome, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', `--print-to-pdf=${output}`, pathToFileURL(bron).href], { stdio: 'ignore' })
    proces.on('error', reject)
    proces.on('exit', code => (code === 0 ? resolve() : reject(new Error(`Chrome gaf ${code}`))))
  })
  console.log(`Inlegkaart: ${output}`)
  console.log('Twee paginas: 1 = met kaarten, 2 = zonder kaarten. Vier kaartjes per pagina.')
  console.log('Print pagina 1, draai het vel om zoals je wilt, print pagina 2. Het blok staat gecentreerd, dus het valt altijd goed.')
} finally {
  await rm(temp, { recursive: true, force: true })
}
