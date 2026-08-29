import { mkdtemp, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import crypto from 'node:crypto'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import QRCode from 'qrcode'
import { encodeCard, normalizeTrack } from '../src/lib/collection.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const baseUrl = String(process.env.TRACKBACK_BASE_URL || 'https://tessavdn-creator.github.io/ons-muziekspel/').replace(/\/$/, '')
const clientId = String(process.env.SPOTIFY_CLIENT_ID || '').trim()
// De map is per persoon ingedeeld: alles van iemand staat bij elkaar. De
// kaarten belanden in <persoon>/Kaarten, naast Cadeau en uitnodiging en Doosje 3D.
const outputRoot = path.resolve(process.env.TRACKBACK_PRINTABLE_OUTPUT || path.join(root, '..', '1 PRINTEN'))
const editionFilter = String(process.env.TRACKBACK_PRINTABLE_EDITION || '').trim().toLowerCase()
// Hoe de achterkant gespiegeld moet worden hangt af van hoe het papier terugkomt.
// TRACKBACK_BACK_MIRROR:
//   rows   links-rechts, voor omslaan aan de LANGE zijde (standaard, ook wat een
//          duplexprinter zelf doet)
//   updown boven-onder, voor omslaan aan de KORTE zijde: linksboven wordt linksonder
//   none   geen spiegeling
const backMirror = String(process.env.TRACKBACK_BACK_MIRROR || 'rows').trim().toLowerCase()
const chrome = process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const ghostscript = process.env.GS_BIN || '/opt/homebrew/bin/gs'

if (!/^[A-Za-z0-9]{32}$/.test(clientId)) throw new Error('SPOTIFY_CLIENT_ID moet exact 32 letters en/of cijfers bevatten.')

// Kaartformaten. 60 mm is het bestaande raster van Iris en Nikki en blijft de
// standaard; 50 mm zet vier kolommen op een A4 en heeft daardoor geen ruimte meer
// voor snijhoekjes tussen de kaarten. Die rasters snijd je op de randticks.
const LAYOUTS = {
  60: {
    card: 60, columns: 3, rows: 4, gap: 3, qr: 38, qrPad: 1.6,
    // Snijtekens lopen door tot vlak bij de papierrand. Op een hefboomsnijmachine
    // snijd je eerst de marge weg; korte tekens bij het blok zijn dan meteen weg,
    // en een lang teken houdt zijn referentie tot de laatste snede.
    cornerMarks: true, guide: { vInset: 2.5, vLength: 20.5, hInset: 2, hLength: 9.5 },
    ruler: false,
    extraCss: '',
  },
  50: {
    card: 50, columns: 4, rows: 5, gap: 0, qr: 31, qrPad: 1.2,
    cornerMarks: false, guide: { vInset: 3, vLength: 20.2, hInset: 0.6, hLength: 4.2 },
    // Bij een raster zonder tussenruimte hangt alles aan een print op ware
    // grootte: staat de printer op "passend maken", dan klopt de kaartmaat niet
    // en verdwijnt de QR-marge die op 50 mm toch al krapper is. Een meetlat in
    // de bovenmarge maakt dat in een oogopslag controleerbaar.
    ruler: false,
    // Alles op de kaart schaalt mee met de kleinere maat. De QR houdt bewust
    // voorrang: die krijgt eerst zijn millimeters, de tekst vult de rest.
    // Alle tekst staat 4,5 mm van de kaartrand. Dat is ruimer dan nodig lijkt,
    // maar de snijtekens worden mee geprint: staat het beeld scheef, dan schuiven
    // die mee en snijd je de kaart alsnog goed uit. Waar het wel misgaat is de
    // uitlijning tussen voor- en achterkant. Ligt de achterkant een paar millimeter
    // verschoven, dan valt tekst die dicht op de rand staat er half af. Deze marge
    // vangt dat op.
    //
    // Om die ruimte te krijgen staat SCAN LUISTER PLAATS rechtsonder in plaats van
    // onder de QR: zo staat de code als enige gecentreerd en houdt hij zijn maat.
    // De herhaalde editienaam rechtsonder is weg; die staat al rechtsboven.
    extraCss: '.front{padding:4.5mm}.card-brand{top:4.5mm;left:4.5mm;font-size:4.8pt}'
      + '.edition{top:4.5mm;left:20mm;right:4.5mm;font-size:3.6pt}'
      + '.front>strong{position:absolute;right:4.5mm;bottom:4.5mm;margin:0;font-size:3.4pt;letter-spacing:.04em}'
      + '.front>span{left:4.5mm;bottom:4.5mm;font-size:4.1pt}'
      + '.back{padding:4.5mm}.back-brand{top:4.5mm;left:4.5mm;right:4.5mm;font-size:4.3pt}'
      + '.year{font-size:16pt;padding:.7mm 2mm;border-width:.45mm;margin:1.6mm 0 2mm}'
      + '.answer{max-width:41mm}.answer strong{font-size:8.4pt}'
      + '.answer strong.medium{font-size:7.2pt}.answer strong.long{font-size:6pt}'
      + '.answer span{margin-top:1mm;font-size:6.2pt}.answer small{font-size:4.6pt}'
      + '.edition-code{display:none}',
  },
}
const layout = LAYOUTS[Number(process.env.TRACKBACK_CARD_MM || 60)]
if (!layout) throw new Error(`TRACKBACK_CARD_MM moet ${Object.keys(LAYOUTS).join(' of ')} zijn.`)
const cardsPerSheet = layout.columns * layout.rows

// Snijposities: elke kaartrand, gemeten op het volle A4 dat de printerstijl gebruikt.
const cutPositions = (count, paper) => {
  const block = count * layout.card + (count - 1) * layout.gap
  const start = (paper - block) / 2
  const edges = []
  for (let index = 0; index < count; index += 1) {
    const left = start + index * (layout.card + layout.gap)
    for (const edge of [left, left + layout.card]) if (!edges.some(value => Math.abs(value - edge) < 0.01)) edges.push(edge)
  }
  return edges
}

const giftSpecs = [
  { id: 'g-7n4p2d8k', keyFile: '.private/gifts/iris.key', owner: 'Iris' },
  { id: 'g-m8q4v2zk', keyFile: '.private/gifts/nikki.key', owner: 'Nikki' },
  { id: 'g-5k9w3rt2', keyFile: '.private/gifts/lodewijk.key', owner: 'Lodewijk' },
]

const EDITION_ORDER = {
  'hidden-corners-01': '01 Hidden Corners',
  'time-warp-01': '02 The Crooked Timeline',
  'after-dark-01': '03 After Dark',
  'iris-crowd-pleasers-01': '04 Crowd Pleasers',
  'nikki-full-throttle-01': '01 Full Throttle',
  'lodewijk-platenkast-01': '01 Lodewijk zijn Platenkast',
  'guilty-pleasures': '01 Guilty Pleasures',
}

const EDITION_THEME = {
  'hidden-corners-01': ['#ff278b', '#ffd51f', '#30102a'],
  'time-warp-01': ['#28d8bd', '#ff278b', '#092b2d'],
  'after-dark-01': ['#7259ff', '#28d8bd', '#12142f'],
  'iris-crowd-pleasers-01': ['#ff6b24', '#ffd51f', '#35180c'],
  'nikki-full-throttle-01': ['#ff3131', '#ff9c32', '#321013'],
  'lodewijk-platenkast-01': ['#f5a623', '#e0453c', '#2a1008'],
  'guilty-pleasures': ['#00ddec', '#b64cff', '#10263b'],
}

const GENRE_COLOR = {
  pop: '#ff278b', rock: '#ff3131', soul: '#ff9c32', disco: '#b64cff',
  electronic: '#00ddec', nederlands: '#ff6b24', classic: '#ffd51f',
}

const ARTIST_VISUALS = [
  { id: 'little-willie-john', match: /little willie john/i, file: 'iris/01-little-willie-john.png' },
  { id: 'paul-rodgers-free', match: /paul rodgers|\bfree\b/i, file: 'iris/02-paul-rodgers-free.png' },
  { id: 'ry-cooder', match: /ry cooder/i, file: 'iris/03-ry-cooder.png' },
  { id: 'sidney-bechet', match: /sidney bechet/i, file: 'iris/04-sidney-bechet.png' },
  { id: 'alvin-lee', match: /alvin lee|ten years after/i, file: 'iris/05-alvin-lee-ten-years-after.png' },
  { id: 'john-mayall', match: /john mayall/i, file: 'iris/06-john-mayall.png' },
  { id: 'hildegard', match: /hildegard von bingen/i, file: 'iris/07-hildegard-von-bingen.png' },
  { id: 'le-trio-joubran', match: /le trio joubran/i, file: 'iris/08-le-trio-joubran.png' },
  { id: 'elvis', match: /elvis presley/i, file: 'retro/01-elvis-presley.png' },
  { id: 'aretha', match: /aretha franklin/i, file: 'retro/02-aretha-franklin.png' },
  { id: 'diana-ross', match: /diana ross/i, file: 'retro/03-diana-ross.png' },
  { id: 'david-bowie', match: /david bowie/i, file: 'retro/04-david-bowie.png' },
  { id: 'michael-jackson', match: /michael jackson/i, file: 'retro/05-michael-jackson.png' },
  { id: 'kurt-cobain', match: /kurt cobain|nirvana/i, file: 'retro/06-kurt-cobain.png' },
  { id: 'britney', match: /britney spears/i, file: 'retro/07-britney-spears.png' },
  { id: 'daft-punk', match: /daft punk/i, file: 'retro/08-daft-punk.png' },
  { id: 'freddie-mercury', match: /freddie mercury|\bqueen\b/i, file: 'lineup/01-freddie-mercury.png' },
  { id: 'chris-martin', match: /chris martin|coldplay/i, file: 'lineup/02-chris-martin.png' },
  { id: 'stevie-nicks', match: /stevie nicks|fleetwood mac/i, file: 'lineup/03-stevie-nicks.png' },
  { id: 'eddie-vedder', match: /eddie vedder|pearl jam/i, file: 'lineup/04-eddie-vedder.png' },
  { id: 'celine-dion', match: /c[eé]line dion/i, file: 'lineup/05-celine-dion.png' },
  { id: 'mariah-carey', match: /mariah carey/i, file: 'lineup/06-mariah-carey.png' },
  { id: 'whitney-houston', match: /whitney houston/i, file: 'lineup/07-whitney-houston.png' },
  { id: 'shania-twain', match: /shania twain/i, file: 'lineup/08-shania-twain.png' },
  { id: 'lady-gaga', match: /lady gaga/i, file: 'lineup/09-lady-gaga.png' },
  { id: 'rihanna', match: /rihanna/i, file: 'lineup/10-rihanna.png' },
  { id: 'pink', match: /\bp!nk\b|\bpink\b/i, file: 'lineup/11-pink.png' },
  { id: 'elton-john', match: /elton john/i, file: 'lineup/12-elton-john.png' },
  { id: 'kiya-tabassian', match: /kiya tabassian/i, file: 'lineup/13-kiya-tabassian.png' },
  { id: 'ablaye-cissoko', match: /ablaye cissoko/i, file: 'lineup/14-ablaye-cissoko.png' },
  { id: 'florent-heau', match: /florent h[eé]au/i, file: 'lineup/15-florent-heau.png' },
]

const EDITION_LINEUP = {
  'hidden-corners-01': ['little-willie-john', 'ry-cooder', 'sidney-bechet', 'florent-heau'],
  'time-warp-01': ['hildegard', 'paul-rodgers-free', 'ry-cooder', 'john-mayall'],
  'after-dark-01': ['le-trio-joubran', 'kiya-tabassian', 'ablaye-cissoko', 'florent-heau'],
  'iris-crowd-pleasers-01': ['freddie-mercury', 'chris-martin', 'stevie-nicks', 'eddie-vedder'],
  'nikki-full-throttle-01': ['david-bowie', 'lady-gaga', 'rihanna', 'pink'],
  'lodewijk-platenkast-01': ['elvis', 'aretha', 'diana-ross', 'michael-jackson'],
  'guilty-pleasures': ['celine-dion', 'mariah-carey', 'whitney-houston', 'shania-twain'],
}

const BINGO_SPACES = [
  ['Jaren 60'], ['Jaren 70'], ['Jaren 80'], ['Jaren 90'], ['Jaren 00'], ['Jaren 10'],
  ['Pop'], ['Rock'], ['Soul'], ['Disco'], ['Electronic'], ['Nederlands'],
  ['Liefde in titel'], ['Klassieker'], ['Meerdere artiesten'],
]

const fromBase64Url = value => Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])
const slug = value => String(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'editie'
const chunks = (values, size) => Array.from({ length: Math.ceil(values.length / size) }, (_, index) => values.slice(index * size, index * size + size))
const padTo = (values, size) => [...values, ...Array(Math.max(0, size - values.length)).fill(null)]
// Omslaan aan de LANGE zijde kantelt het vel om de verticale as: wat linksboven
// zat komt rechtsboven. De achterkant moet dan per rij links-rechts gespiegeld.
const mirrorRows = (values, columns) => chunks(values, columns).flatMap(row => [...row].reverse())
// Omslaan aan de KORTE zijde kantelt om de horizontale as, als een kalenderblad:
// wat linksboven zat komt linksonder. Dan moet de RIJVOLGORDE omgekeerd en blijft
// links links.
const mirrorColumns = (values, columns) => chunks(values, columns).reverse().flat()
const csvCell = value => `"${String(value ?? '').replaceAll('"', '""')}"`
const dataUri = async file => `data:image/png;base64,${(await readFile(file)).toString('base64')}`

async function decryptGift(spec) {
  const key = (await readFile(path.join(root, spec.keyFile), 'utf8')).trim()
  const envelope = JSON.parse(await readFile(path.join(root, 'public/gifts', `${spec.id}.json`), 'utf8'))
  const encrypted = fromBase64Url(envelope.data)
  const decipher = crypto.createDecipheriv('aes-256-gcm', fromBase64Url(key), fromBase64Url(envelope.iv))
  decipher.setAuthTag(encrypted.subarray(encrypted.length - 16))
  const plaintext = Buffer.concat([decipher.update(encrypted.subarray(0, -16)), decipher.final()])
  return { ...spec, gift: JSON.parse(plaintext.toString('utf8')) }
}

async function loadEditions() {
  // Met TRACKBACK_EDITION_FILE rendert de generator een losse editiereeks uit een
  // bestand in plaats van de cadeaus en de catalogus. Gebruikt voor een
  // gedeeltelijke herdruk, waarbij alleen de gewijzigde kaarten op vel gaan.
  const losBestand = String(process.env.TRACKBACK_EDITION_FILE || '').trim()
  if (losBestand) {
    const inhoud = JSON.parse(await readFile(path.resolve(losBestand), 'utf8'))
    return (Array.isArray(inhoud) ? inhoud : [inhoud]).map(editie => ({ ...editie, owner: editie.owner || 'Herdruk' }))
  }
  const gifts = await Promise.all(giftSpecs.map(decryptGift))
  const personal = gifts.flatMap(({ owner, gift }) => gift.editions.map(edition => ({ ...edition, owner })))
  const catalog = JSON.parse(await readFile(path.join(root, 'public/decks/index.json'), 'utf8'))
  const publicEditions = await Promise.all((catalog.editions || []).map(async entry => ({
    ...JSON.parse(await readFile(path.join(root, 'public/decks', entry.file), 'utf8')),
    ...entry,
    owner: 'Algemeen',
  })))
  return [...personal, ...publicEditions]
}

function seededShuffle(values, seed) {
  const result = [...values]
  let state = seed + 1
  for (let index = result.length - 1; index > 0; index -= 1) {
    state = (state * 1664525 + 1013904223) >>> 0
    const target = state % (index + 1)
    ;[result[index], result[target]] = [result[target], result[index]]
  }
  return result
}

async function printPdf(htmlFile, pdfFile) {
  await new Promise((resolve, reject) => {
    const process = spawn(chrome, [
      '--headless=new', '--disable-gpu', '--disable-dev-shm-usage', '--no-sandbox',
      '--no-pdf-header-footer', `--print-to-pdf=${pdfFile}`, pathToFileURL(htmlFile).href,
    ], { stdio: ['ignore', 'pipe', 'pipe'] })
    let error = ''
    process.stderr.on('data', chunk => { error += chunk })
    process.on('error', reject)
    process.on('exit', code => code === 0 ? resolve() : reject(new Error(`PDF-export mislukt (${code}): ${error}`)))
  })
  const optimized = `${pdfFile}.optimized.pdf`
  await new Promise((resolve, reject) => {
    const process = spawn(ghostscript, [
      '-sDEVICE=pdfwrite', '-dCompatibilityLevel=1.6', '-dPDFSETTINGS=/printer',
      '-dNOPAUSE', '-dQUIET', '-dBATCH', `-sOutputFile=${optimized}`, pdfFile,
    ], { stdio: ['ignore', 'pipe', 'pipe'] })
    let error = ''
    process.stderr.on('data', chunk => { error += chunk })
    process.on('error', reject)
    process.on('exit', code => code === 0 ? resolve() : reject(new Error(`PDF-optimalisatie mislukt (${code}): ${error}`)))
  })
  await rename(optimized, pdfFile)
}

const documentShell = (title, styles, body) => `<!doctype html><html lang="nl"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${styles}</style></head><body>${body}</body></html>`

const cropMarks = '<i class="crop tl"></i><i class="crop tr"></i><i class="crop bl"></i><i class="crop br"></i>'
const cardSlot = (card, marked = false) => `<div class="slot">${card}${marked && layout.cornerMarks ? cropMarks : ''}</div>`
const sheetGeometry = {
  vertical: cutPositions(layout.columns, 210),
  horizontal: cutPositions(layout.rows, 297),
}
// Meetlat van 100 mm met een streepje per centimeter. Meet je 100 mm, dan
// printte de printer op ware grootte en is iedere kaart precies zo groot als bedoeld.
// Geen meetlat en geen tekst in de marge: die zou dwars door een snijteken lopen.
// De schaalcontrole zit in de tekens zelf, want de afstand tussen twee
// aangrenzende tekens is per definitie de kaartmaat. Dat staat in de leesmij.
const printRuler = () => ''

const edgeGuides = () => {
  const geometry = sheetGeometry
  return `<div class="edge-guides" aria-hidden="true">${geometry.vertical.map(position => `<i class="edge-guide vertical top" style="--pos:${position}mm"></i><i class="edge-guide vertical bottom" style="--pos:${position}mm"></i>`).join('')}${geometry.horizontal.map(position => `<i class="edge-guide horizontal left" style="--pos:${position}mm"></i><i class="edge-guide horizontal right" style="--pos:${position}mm"></i>`).join('')}</div>`
}

const sharedStyles = `
  @page{size:A4 portrait;margin:8mm}*{box-sizing:border-box}html,body{margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;color:#110e18}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.page{width:194mm;height:281mm;break-after:page;page-break-after:always;overflow:hidden;position:relative}.page:last-child{break-after:auto;page-break-after:auto}.brand{font-family:"Arial Black",Arial,sans-serif;font-weight:900;letter-spacing:.08em}.eyebrow{font-size:8pt;font-weight:900;letter-spacing:.18em;text-transform:uppercase}
`

async function cardsHtml(edition, artistPortraits) {
  const [primary, secondary, deep] = EDITION_THEME[edition.id] || EDITION_THEME['guilty-pleasures']
  const editionLabel = edition.name.toUpperCase()
  const lineup = (EDITION_LINEUP[edition.id] || EDITION_LINEUP['guilty-pleasures']).map(id => artistPortraits[id])
  const lineupMarkup = `<div class="edition-lineup">${lineup.map((portrait, index) => `<img src="${portrait}" alt="" style="--i:${index}">`).join('')}</div>`
  // cardNumber overleeft normalizeTrack niet, dus apart terugzetten. Het staat
  // alleen op een gedeeltelijke herdruk: daar moeten de nummers gelijk blijven
  // aan de oorspronkelijke oplage, anders passen de vervangen kaarten niet meer
  // bij de doos.
  const tracks = edition.tracks.map((track, index) => ({ ...normalizeTrack(track), cardNumber: track.cardNumber || 0 }))
  const sheets = chunks(tracks, cardsPerSheet)
  const pages = []
  for (const [sheetIndex, sheet] of sheets.entries()) {
    const padded = padTo(sheet, cardsPerSheet)
    const fronts = await Promise.all(padded.map(async (track, index) => {
      if (!track) return cardSlot('<div class="card blank"></div>')
      const cardUrl = `${baseUrl}/?card=${encodeCard(track, clientId)}#play`
      const qr = await QRCode.toDataURL(cardUrl, { width: 470, margin: 3, errorCorrectionLevel: 'M', color: { dark: '#050509', light: '#ffffff' } })
      const accent = GENRE_COLOR[track.genre] || primary
      return cardSlot(`<div class="card front" style="--accent:${accent}"><div class="card-brand brand">TRACKBACK</div><div class="edition">${escapeHtml(edition.name)}</div>${lineupMarkup}<div class="qr-shell"><img src="${qr}" alt=""></div><strong>SCAN · LUISTER · PLAATS</strong><span>KAART ${String(track.cardNumber || sheetIndex * cardsPerSheet + index + 1).padStart(3, '0')}</span><b class="edition-code">${escapeHtml(editionLabel)}</b></div>`, true)
    }))
    const gespiegeld = backMirror === 'none' ? padded
      : backMirror === 'updown' ? mirrorColumns(padded, layout.columns)
      : mirrorRows(padded, layout.columns)
    const backs = gespiegeld.map(track => {
      if (!track) return cardSlot('<div class="card blank"></div>')
      const accent = GENRE_COLOR[track.genre] || primary
      const actualArtist = ARTIST_VISUALS.find(candidate => candidate.match.test(track.artist || ''))
      const actualPortrait = actualArtist ? `<img class="actual-artist" src="${artistPortraits[actualArtist.id]}" alt="">` : ''
      const titleClass = track.title.length > 35 ? 'long' : track.title.length > 22 ? 'medium' : ''
      return cardSlot(`<div class="card back" style="--accent:${accent}"><div class="back-brand">${escapeHtml(edition.name)}</div>${actualPortrait}<span class="year">${escapeHtml(track.year || '????')}</span><div class="answer"><strong class="${titleClass}">${escapeHtml(track.title)}</strong><span>${escapeHtml(track.artist)}</span>${track.album ? `<small>${escapeHtml(track.album)}</small>` : ''}</div><div class="trackback-dot">●</div><b class="edition-code">${escapeHtml(editionLabel)}</b></div>`)
    })
    pages.push(`<section class="page sheet front-sheet">${fronts.join('')}${edgeGuides()}${printRuler()}</section>`, `<section class="page sheet back-sheet">${backs.join('')}</section>`)
  }
  const css = `${sharedStyles}
    :root{--primary:${primary};--secondary:${secondary};--deep:${deep}}.sheet{display:grid;grid-template-columns:repeat(${layout.columns},${layout.card}mm);grid-template-rows:repeat(${layout.rows},${layout.card}mm);place-content:center;gap:${layout.gap}mm}.slot,.card{width:${layout.card}mm;height:${layout.card}mm}.card{border-radius:0;overflow:hidden;position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}.blank{visibility:hidden}.front{color:#110e18;padding:3mm}.card-brand{position:absolute;top:2.4mm;left:3mm;font-size:5.6pt}.edition{position:absolute;top:2.8mm;left:25mm;right:3mm;overflow:hidden;text-align:right;text-overflow:ellipsis;white-space:nowrap;font-size:4.2pt;font-weight:900;letter-spacing:.05em;text-transform:uppercase}.edition-lineup,.actual-artist,.trackback-dot{display:none}.qr-shell{padding:${layout.qrPad}mm;background:#fff;border:.45mm solid #110e18}.qr-shell img{display:block;width:${layout.qr}mm;height:${layout.qr}mm}.front>strong{margin-top:2mm;font-size:5.4pt;letter-spacing:.08em}.front>span{position:absolute;left:3mm;bottom:2.8mm;font-size:4.7pt;font-weight:900;letter-spacing:.08em}.back{color:#110e18;padding:4mm}.back-brand{position:absolute;top:2.8mm;left:4mm;right:4mm;overflow:hidden;text-align:center;text-overflow:ellipsis;white-space:nowrap;font-size:5pt;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:var(--accent)}.year{padding:.8mm 2.5mm;border:.5mm solid #110e18;background:#fff;color:#110e18;font-family:"Arial Black",Arial,sans-serif;font-size:20pt;font-weight:900;line-height:1;margin:2mm 0 2.5mm}.answer{max-width:52mm}.answer strong,.answer span,.answer small{display:block}.answer strong{font-family:"Arial Black",Arial,sans-serif;font-size:10pt;line-height:1.05}.answer strong.medium{font-size:8.5pt}.answer strong.long{font-size:7pt}.answer span{margin-top:1.3mm;font-size:7.2pt;font-weight:700}.answer small{margin-top:1mm;color:#4c4652;font-size:5.3pt}.edition-code{position:absolute;right:2.5mm;bottom:2.5mm;max-width:30mm;padding:.6mm 1mm;border:.35mm solid var(--accent);background:#fff;color:#110e18;text-align:center;font:900 3.8pt/1 Arial,sans-serif;letter-spacing:.03em;white-space:nowrap;z-index:4}`
  const printerSafeCss = `
    @page{margin:0}.sheet{width:210mm;height:297mm;padding:0;overflow:hidden!important}.slot{position:relative;overflow:visible;isolation:isolate}.card{border-radius:0!important;box-shadow:none!important}.front{border:.5mm solid #110e18!important;background:#fff!important}.back{border:0!important;background:#fff!important}.card-brand{color:var(--accent)!important}.qr-shell{border-radius:0;box-shadow:none!important;transform:none!important}.crop{position:absolute;width:0;height:0;z-index:20;pointer-events:none}.crop:before,.crop:after{content:'';position:absolute;background:#000}.crop:before{width:2.5mm;height:.3mm;top:-.15mm}.crop:after{width:.3mm;height:2.5mm;left:-.15mm}.crop.tl{left:0;top:0}.crop.tr{left:${layout.card}mm;top:0}.crop.bl{left:0;top:100%}.crop.br{left:${layout.card}mm;top:100%}.crop.tl:before,.crop.bl:before{right:.5mm}.crop.tr:before,.crop.br:before{left:.5mm}.crop.tl:after,.crop.tr:after{bottom:.5mm}.crop.bl:after,.crop.br:after{top:.5mm}.edge-guides{position:absolute;inset:0;z-index:40;pointer-events:none}.edge-guide{position:absolute;display:block;background:#000}.edge-guide.vertical{left:var(--pos);width:.35mm;height:${layout.guide.vLength}mm;transform:translateX(-.175mm)}.edge-guide.vertical.top{top:${layout.guide.vInset}mm}.edge-guide.vertical.bottom{bottom:${layout.guide.vInset}mm}.edge-guide.horizontal{top:var(--pos);width:${layout.guide.hLength}mm;height:.35mm;transform:translateY(-.175mm)}.edge-guide.horizontal.left{left:${layout.guide.hInset}mm}.edge-guide.horizontal.right{right:${layout.guide.hInset}mm}`
  const rulerCss = ''
  return documentShell(`${edition.name} kaarten`, `${css}${printerSafeCss}${layout.extraCss}${rulerCss}`, pages.join(''))
}

function extrasHtml(edition, owner, lineupPortraits) {
  const [primary, secondary] = EDITION_THEME[edition.id] || EDITION_THEME['guilty-pleasures']
  const recipient = owner === 'Algemeen' ? '' : owner
  const bingoCards = Array.from({ length: 12 }, (_, index) => seededShuffle(BINGO_SPACES, index + edition.name.length * 37).slice(0, 9))
  const lineup = className => `<div class="${className}">${lineupPortraits.map((portrait, index) => `<img src="${portrait}" alt="" style="--i:${index}">`).join('')}</div>`
  const cover = `<section class="page cover">${lineup('cover-lineup')}<span class="eyebrow">EEN TRACKBACK EDITIE</span><h1>${escapeHtml(edition.name)}</h1>${recipient ? `<h2>voor ${escapeHtml(recipient)}</h2>` : ''}<p>De tijdlijn · drie bonusspellen · eindeloos veel muziek</p><div class="games"><span>TIJDLIJN</span><span>RAAD DE HIT</span><span>MUZIEKBINGO</span><span>BATTLE OF THE HITS</span></div><footer>TRACKBACK · LISTEN · PLACE · REVEAL</footer></section>`
  const rules = `<section class="page rules">${lineup('page-lineup')}<header><strong class="brand">TRACKBACK</strong><span>${escapeHtml(edition.name)}</span></header><h1>De tijdlijn.<br>Plus drie extra's.</h1><p class="intro">Begin met het Tijdlijnspel. Eén telefoon is de DJ; de overige spelers hoeven niets te koppelen.</p><div class="rule-grid"><article class="main"><b>HOOFDSPEL</b><h2>Tijdlijn</h2><p>Geef iedereen één onthulde startkaart. Scan een nieuwe kaart en luister zonder titel of artiest. Leg de hit vóór, na of tussen de kaarten in jouw tijdlijn. Onthul daarna het jaar. Goed geplaatst? Houd de kaart. De eerste met tien kaarten wint.</p></article><article><b>02</b><h2>Raad de hit</h2><p>Noem titel en artiest vóór de onthulling. Ieder goed antwoord is één punt.</p></article><article><b>03</b><h2>Muziekbingo</h2><p>Streep na iedere onthulling passende vakken af. Drie op een rij is bingo.</p></article><article><b>04</b><h2>Battle of the Hits</h2><p>De eerste hit is kampioen. Stem na iedere uitdager. De laatste hit wint.</p></article></div><footer>Scan · luister · kies · onthul</footer></section>`
  const scoreRows = Array.from({ length: 10 }, (_, index) => `<tr><td>${index + 1}. __________________</td>${Array.from({ length: 11 }, () => '<td></td>').join('')}</tr>`).join('')
  const score = `<section class="page score">${lineup('page-lineup')}<header><strong class="brand">TRACKBACK</strong><span>SCOREFORMULIER · ${escapeHtml(edition.name)}</span></header><h1>Wie kent de hits?</h1><div class="meta">Datum ____________________ &nbsp;&nbsp;&nbsp; Team ____________________</div><table><thead><tr><th>Speler / team</th>${Array.from({ length: 10 }, (_, index) => `<th>${index + 1}</th>`).join('')}<th>Totaal</th></tr></thead><tbody>${scoreRows}</tbody></table><div class="notes"><strong>Finale / notities</strong></div><footer>Tijdlijn: 1 punt · Raad de hit: maximaal 2 punten · Bingo en Battle: eeuwige roem</footer></section>`
  const bingo = chunks(bingoCards, 2).map((cards, pageIndex) => `<section class="page bingo-page">${cards.map((card, cardIndex) => `<div class="bingo">${lineup('bingo-lineup')}<header><strong class="brand">TRACKBACK</strong><span>${escapeHtml(edition.name)} · BINGO ${String(pageIndex * 2 + cardIndex + 1).padStart(2, '0')}</span></header><div class="bingo-grid">${card.map(([label]) => `<span>${label}</span>`).join('')}</div><small>Een vak telt zodra de DJ het nummer onthult. Drie op een rij = BINGO!</small></div>`).join('')}</section>`).join('')
  const css = `${sharedStyles}:root{--primary:${primary};--secondary:${secondary}}header{display:flex;align-items:center;justify-content:space-between;border-bottom:1.5mm solid #110e18;padding-bottom:5mm}.cover{padding:8mm;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;background:radial-gradient(circle at 15% 20%,var(--secondary) 0 20mm,transparent 20.3mm),radial-gradient(circle at 88% 82%,var(--primary) 0 28mm,transparent 28.3mm),radial-gradient(circle at 90% 10%,var(--primary) 0 14mm,transparent 14.3mm),#110e18;color:white}.cover-lineup{position:relative;width:112mm;height:58mm;margin-bottom:8mm}.cover-lineup img{position:absolute;left:calc(var(--i) * 23mm);top:calc((var(--i) % 2) * 4mm);width:45mm;height:52mm;object-fit:contain;filter:drop-shadow(2mm 3mm 0 var(--secondary));transform:rotate(calc((var(--i) - 1.5) * 5deg))}.cover .eyebrow{color:var(--secondary)}.cover h1{max-width:175mm;margin:6mm 0 1mm;font-family:"Arial Black",Arial,sans-serif;font-size:42pt;line-height:.92;text-transform:uppercase}.cover h2{font-family:"Arial Black",Arial,sans-serif;font-size:24pt;color:var(--primary);margin:0 0 5mm}.cover p{font-size:13pt;color:#d9d1e2}.games{display:grid;grid-template-columns:1fr 1fr;gap:3mm;margin-top:10mm}.games span{width:65mm;padding:4mm;border:.4mm solid rgba(255,255,255,.35);border-radius:3mm;font-size:8pt;font-weight:900}.cover footer,.rules footer,.score footer{position:absolute;left:8mm;right:8mm;bottom:7mm;text-align:center;font-size:8pt;font-weight:800;letter-spacing:.08em}.rules,.score{padding:8mm;border-top:4mm solid var(--primary)}.page-lineup{position:absolute;right:7mm;top:19mm;width:53mm;height:36mm}.page-lineup img{position:absolute;right:calc(var(--i) * 10mm);top:calc((var(--i) % 2) * 2mm);width:23mm;height:30mm;object-fit:contain;filter:drop-shadow(1mm 1mm 0 var(--secondary));transform:rotate(calc((var(--i) - 1.5) * 5deg))}.rules header span,.score header span{font-size:9pt;font-weight:900;letter-spacing:.14em;margin-right:56mm}.rules h1,.score h1{font-family:"Arial Black",Arial,sans-serif;font-size:34pt;line-height:.95;margin:10mm 0 5mm}.intro{width:135mm;font-size:11pt;line-height:1.5;margin-bottom:8mm}.rule-grid{display:grid;grid-template-columns:1fr 1fr;gap:5mm}.rule-grid article{min-height:58mm;border:.5mm solid #110e18;border-radius:4mm;padding:6mm;position:relative}.rule-grid article.main{grid-column:1/-1;min-height:48mm;background:#110e18;color:white;border-left:3mm solid var(--primary)}.rule-grid b{position:absolute;right:5mm;top:4mm;color:var(--primary);font-size:10pt}.rule-grid .main b{color:var(--secondary)}.rule-grid h2{font-family:"Arial Black",Arial,sans-serif;font-size:17pt;margin:3mm 0 2mm}.rule-grid p{font-size:9.5pt;line-height:1.45;margin:0}.score .meta{margin-bottom:8mm;font-size:10pt;font-weight:700}.score table{width:100%;border-collapse:collapse;table-layout:fixed}.score th,.score td{border:.4mm solid #110e18;height:13mm;text-align:center;font-size:8pt}.score th:first-child,.score td:first-child{width:42mm;text-align:left;padding-left:3mm}.score th:last-child{width:14mm}.notes{height:42mm;border:.5mm solid #110e18;margin-top:8mm;padding:4mm;font-size:9pt}.bingo-page{display:grid;grid-template-rows:1fr 1fr;gap:8mm}.bingo{border:1mm solid #110e18;border-top:4mm solid var(--primary);border-radius:4mm;padding:7mm;display:flex;flex-direction:column;position:relative}.bingo-lineup{position:absolute;right:5mm;top:4mm;width:45mm;height:25mm}.bingo-lineup img{position:absolute;right:calc(var(--i) * 8mm);top:calc((var(--i) % 2) * 1mm);width:19mm;height:22mm;object-fit:contain;filter:drop-shadow(.8mm .8mm 0 var(--secondary));transform:rotate(calc((var(--i) - 1.5) * 5deg))}.bingo header{margin-bottom:5mm;padding-right:48mm}.bingo header span{font-size:7pt;font-weight:800;letter-spacing:.06em}.bingo-grid{flex:1;display:grid;grid-template-columns:repeat(3,1fr);gap:2mm}.bingo-grid span{border:.4mm solid #110e18;border-radius:2mm;display:grid;place-items:center;text-align:center;padding:2mm;font-size:10pt;font-weight:700}.bingo small{margin-top:3mm;text-align:center;font-size:7pt}`
  const printerSafeExtrasCss = `
    body{background:#fff!important}.cover{background:#fff!important;color:#110e18!important;border-top:4mm solid var(--primary)}
    .cover .eyebrow{color:var(--primary)!important}.cover h1{color:#110e18!important}.cover h2{color:var(--primary)!important}.cover p{color:#4c4652!important}
    .cover-lineup img,.page-lineup img,.bingo-lineup img{filter:none!important}.games span{border:.5mm solid #110e18!important;background:#fff!important;color:#110e18!important}
    .rule-grid article.main{background:#fff!important;color:#110e18!important;border:.5mm solid #110e18!important;border-left:3mm solid var(--primary)!important}
    .rule-grid .main b{color:var(--primary)!important}.rules,.score,.bingo{background:#fff!important;color:#110e18!important}
  `
  return documentShell(`${edition.name} hulpmiddelen`, `${css}${printerSafeExtrasCss}`, `${cover}${rules}${score}${bingo}`)
}

async function main() {
  await mkdir(outputRoot, { recursive: true })
  const temp = await mkdtemp(path.join(os.tmpdir(), 'trackback-printables-'))
  const printAssetRoot = path.join(root, 'scripts/print-assets')
  const artistPortraits = Object.fromEntries(await Promise.all(ARTIST_VISUALS.map(async visual => [visual.id, await dataUri(path.join(printAssetRoot, 'artists', visual.file))])))
  const editions = (await loadEditions()).filter(edition => !editionFilter || `${edition.owner} ${edition.id} ${edition.name}`.toLowerCase().includes(editionFilter))
  const manifest = []
  try {
    for (const edition of editions) {
      const folder = path.join(outputRoot, edition.owner, 'Kaarten', EDITION_ORDER[edition.id] || edition.name)
      await mkdir(folder, { recursive: true })
      const prefix = `TRACKBACK - ${edition.name}`
      const cardsFile = path.join(folder, `01 ${prefix} - kaarten dubbelzijdig.pdf`)
      const extrasFile = path.join(folder, `02 ${prefix} - cover regels bingo score.pdf`)
      const cardsSource = path.join(temp, `${slug(edition.id)}-cards.html`)
      const extrasSource = path.join(temp, `${slug(edition.id)}-extras.html`)
      await writeFile(cardsSource, await cardsHtml(edition, artistPortraits))
      await writeFile(extrasSource, extrasHtml(edition, edition.owner, (EDITION_LINEUP[edition.id] || EDITION_LINEUP['guilty-pleasures']).map(id => artistPortraits[id])))
      await printPdf(cardsSource, cardsFile)
      await printPdf(extrasSource, extrasFile)
      const csv = [['kaart', 'titel', 'artiest', 'jaar', 'genre'], ...edition.tracks.map((track, index) => [index + 1, track.title, track.artist, track.year, track.genre])]
      await writeFile(path.join(folder, `03 ${prefix} - controlelijst.csv`), `${csv.map(row => row.map(csvCell).join(',')).join('\n')}\n`)
      manifest.push({ id: edition.id, owner: edition.owner, name: edition.name, cards: edition.tracks.length, cardSize: `${layout.card} × ${layout.card} mm`, cardsPerA4: cardsPerSheet, cardsPdf: path.relative(outputRoot, cardsFile), extrasPdf: path.relative(outputRoot, extrasFile) })
      console.log(`${edition.owner} · ${edition.name}: ${edition.tracks.length} kaarten`)
    }
    const total = manifest.reduce((sum, edition) => sum + edition.cards, 0)
    // De inhoudsopgave en de leesmij horen bij het geheel, niet bij een persoon.
    await writeFile(path.join(outputRoot, 'inhoud.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), baseUrl, totalCards: total, editions: manifest }, null, 2)}\n`)
    await writeFile(path.join(outputRoot, 'LEES-MIJ.txt'), `TRACKBACK — START HIER MET PRINTEN\n\n${[...new Set(manifest.map(edition => edition.owner))].join(', ')}. Eerder gemaakte printmappen zijn niet overschreven.\n\nKAARTEN\n- ${layout.card} × ${layout.card} mm, vierkante hoeken, ${cardsPerSheet} kaarten per A4.\n- Print dubbelzijdig, omslaan aan lange zijde en op 100% / werkelijke grootte.\n- Oneven pagina's zijn voorkanten; de daaropvolgende even pagina's zijn de bijpassende achterkanten.\n- Spiegel of roteer zelf niets.\n- De achterkant heeft bewust geen nauw aansluitende rand: een iets scheve Epson-print blijft daardoor bruikbaar.\n\nSNIJDEN OP EEN HEFBOOMSNIJMACHINE\n- Test eerst alleen pagina 1 en 2 van bestand 01.\n- Zet randloos printen uit.\n- Controleer de schaal met een liniaal: de afstand tussen twee snijtekens naast elkaar moet exact ${layout.card} mm zijn. Klopt dat niet, dan staat de printer op passend maken en wordt iedere kaart te klein.\n- Snijd eerst de bovenmarge weg tot de eerste tick, en daarna de linkermarge.\n- Zet de aanleg op ${layout.card} mm en snijd steeds opnieuw${layout.gap ? '' : '; elke snede scheidt twee kaarten tegelijk'}.\n- De ticks in de papiermarge geven iedere snijlijn aan; leg het mes van tick tot tick.\n\n${manifest.map(edition => `- ${edition.owner} · ${edition.name}: ${edition.cards} kaarten (${edition.cardSize}; ${cardsPerSheet} per A4)`).join('\n')}\n\nTotaal: ${total} speelkaarten.\nDe QR-codes openen ${baseUrl}/ en bevatten geen Client Secret.\n`)
  } finally {
    await rm(temp, { recursive: true, force: true })
  }
}

await main()
