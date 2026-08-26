// Leest de gedrukte kaarten-PDF terug: rastert iedere voorkant, decodeert elke
// QR met een echte scanner-decoder en legt de inhoud naast de editie. Zo is
// bewezen dat alle kaarten werken, niet alleen de eerste en de laatste.
import { readFile, mkdtemp, rm, readdir } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { decompressSync, strFromU8 } from 'fflate'

const run = promisify(execFile)
const [pdf, editionFile] = process.argv.slice(2)
if (!pdf || !editionFile) throw new Error('Gebruik: node scripts/verify-printed-cards.mjs KAARTEN.pdf EDITIE.json')
const dpi = Number(process.env.VERIFY_DPI || 300)
// Rasterafmetingen van het vel, nodig om de achterkanten per vakje te lezen.
const kaartMm = Number(process.env.VERIFY_CARD_MM || 50)
const kolommen = Number(process.env.VERIFY_COLUMNS || 4)
const rijen = Number(process.env.VERIFY_ROWS || 5)
const gapMm = Number(process.env.VERIFY_GAP_MM || 0)
const perVel = kolommen * rijen
const punt = mm => (mm * 72) / 25.4

const edition = JSON.parse(await readFile(editionFile, 'utf8'))
const byId = new Map(edition.tracks.map(track => [track.id, track]))

const decodePayload = url => {
  const value = new URL(url).searchParams.get('card')
  if (!value) throw new Error('geen card-parameter')
  const base64 = value.slice(1).replace(/-/g, '+').replace(/_/g, '/')
  const bytes = Buffer.from(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='), 'base64')
  return JSON.parse(strFromU8(decompressSync(new Uint8Array(bytes))))
}

const temp = await mkdtemp(join(tmpdir(), 'trackback-verify-'))
const gevonden = new Map()
const problemen = []
try {
  await run('pdftoppm', ['-r', String(dpi), '-png', pdf, join(temp, 'vel')])
  const pages = (await readdir(temp)).filter(name => name.endsWith('.png')).sort()
  // Oneven PDF-pagina's zijn de voorkanten; daar staan de QR-codes op.
  const fronts = pages.filter((_, index) => index % 2 === 0)
  for (const page of fronts) {
    let stdout = ''
    // Eerst alle symbologieen uit, dan alleen QR aan. Zonder -Sdisable blijven de
    // streepjescode-lezers actief en die zien in een QR-patroon soms een
    // Interleaved 2 of 5 met zestien cijfers, wat als onleesbare kaart binnenkomt.
    try { ({ stdout } = await run('zbarimg', ['--quiet', '--raw', '-Sdisable', '-Sqrcode.enable', join(temp, page)])) }
    catch (error) { stdout = error.stdout || '' }
    const urls = stdout.split('\n').map(line => line.trim()).filter(Boolean)
    if (!urls.length) problemen.push(`${page}: geen enkele QR gelezen`)
    for (const url of urls) {
      try {
        const card = decodePayload(url)
        if (gevonden.has(card.i)) problemen.push(`${card.i} staat meer dan een keer op de vellen`)
        gevonden.set(card.i, card)
      } catch (error) { problemen.push(`${page}: onleesbare inhoud (${error.message})`) }
    }
  }
} finally { await rm(temp, { recursive: true, force: true }) }

// Dubbelzijdig drukken staat of valt met de spiegeling. Als die fout is,
// decodeert iedere QR nog steeds prima maar hoort de achterkant bij een andere
// kaart, en is de hele oplage waardeloos. Daarom wordt elk vakje op de
// achterzijde apart uitgelezen en vergeleken met de kaart die daar hoort.
const startX = (210 - (kolommen * kaartMm + (kolommen - 1) * gapMm)) / 2
const startY = (297 - (rijen * kaartMm + (rijen - 1) * gapMm)) / 2
const vakTekst = async (pagina, kolom, rij) => {
  const x = startX + kolom * (kaartMm + gapMm)
  const y = startY + rij * (kaartMm + gapMm)
  try {
    const { stdout } = await run('pdftotext', ['-f', String(pagina), '-l', String(pagina),
      '-x', String(Math.round(punt(x))), '-y', String(Math.round(punt(y))),
      '-W', String(Math.round(punt(kaartMm))), '-H', String(Math.round(punt(kaartMm))),
      '-layout', pdf, '-'])
    return stdout
  } catch { return '' }
}

const velTotaal = Math.ceil(edition.tracks.length / perVel)
for (let vel = 0; vel < velTotaal; vel += 1) {
  const achterPagina = vel * 2 + 2
  for (let rij = 0; rij < rijen; rij += 1) {
    for (let kolom = 0; kolom < kolommen; kolom += 1) {
      // Omslaan aan de lange zijde wisselt links en rechts om, dus het vakje
      // linksboven op de achterzijde hoort bij de kaart rechtsboven op de voorzijde.
      const voorKolom = kolommen - 1 - kolom
      const index = vel * perVel + rij * kolommen + voorKolom
      const track = edition.tracks[index]
      const tekst = await vakTekst(achterPagina, kolom, rij)
      if (!track) {
        if (tekst.replace(/\s|LODEWIJK|TRACKBACK/gi, '').length > 4) problemen.push(`vel ${vel + 1}, achterzijde rij ${rij + 1} kolom ${kolom + 1}: hier hoort niets te staan`)
        continue
      }
      const plat = tekst.replace(/\s+/g, ' ').trim()
      if (!plat) { problemen.push(`vel ${vel + 1}, achterzijde rij ${rij + 1} kolom ${kolom + 1}: leeg, verwacht ${track.title}`); continue }
      if (!plat.includes(track.year)) problemen.push(`vel ${vel + 1}, achterzijde rij ${rij + 1} kolom ${kolom + 1}: jaar ${track.year} van "${track.title}" staat er niet; gelezen "${plat.slice(0, 70)}"`)
      const kern = track.title.replace(/\s+/g, ' ').slice(0, 12)
      if (kern && !plat.replace(/\s/g, '').includes(kern.replace(/\s/g, ''))) problemen.push(`vel ${vel + 1}, achterzijde rij ${rij + 1} kolom ${kolom + 1}: verwacht "${track.title}", gelezen "${plat.slice(0, 70)}"`)
    }
  }
}

for (const [id, track] of byId) {
  const card = gevonden.get(id)
  if (!card) { problemen.push(`ONTBREEKT op de vellen: ${track.artist} - ${track.title}`); continue }
  if (card.t !== track.title) problemen.push(`titel wijkt af op ${id}: QR zegt "${card.t}", editie zegt "${track.title}"`)
  if (card.a !== track.artist) problemen.push(`artiest wijkt af op ${id}`)
  if (card.y !== track.year) problemen.push(`jaar wijkt af op ${id}: QR ${card.y}, editie ${track.year}`)
  if (card.s !== track.spotifyUri) problemen.push(`Spotify-link wijkt af op ${id}`)
}
for (const id of gevonden.keys()) if (!byId.has(id)) problemen.push(`onbekende kaart op de vellen: ${id}`)

console.log(`Editie: ${edition.name}, ${edition.tracks.length} kaarten`)
console.log(`Gelezen van de vellen op ${dpi} dpi: ${gevonden.size}`)
console.log(`Achterkanten gecontroleerd op de juiste kaart: ${velTotaal} vellen, ${kolommen} x ${rijen} per vel`)
if (problemen.length) {
  console.log(`\nNIET IN ORDE, ${problemen.length} punten:`)
  problemen.slice(0, 40).forEach(regel => console.log(`  - ${regel}`))
  if (problemen.length > 40) console.log(`  ... en nog ${problemen.length - 40}`)
  process.exitCode = 1
} else {
  console.log('\nIn orde: elke kaart staat er precies een keer op, de QR bevat exact wat de editie zegt, en iedere achterkant hoort bij de voorkant ernaast na het omslaan.')
}
