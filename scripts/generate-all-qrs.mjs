import { readFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import QRCode from 'qrcode'
import { zipSync } from 'fflate'
import { encodeCard, normalizeTrack } from '../src/lib/collection.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const clientId = String(process.env.SPOTIFY_CLIENT_ID || '').trim()
const giftKey = String(process.env.IRIS_GIFT_KEY || '').trim()
const baseUrl = String(process.env.TRACKBACK_BASE_URL || 'https://tessavdn-creator.github.io/ons-muziekspel/').trim()
const customOutput = String(process.env.TRACKBACK_QR_OUTPUT || '').trim()

if (!/^[A-Za-z0-9]{10,80}$/.test(clientId)) throw new Error('SPOTIFY_CLIENT_ID ontbreekt of lijkt niet geldig.')
if (!/^[A-Za-z0-9_-]{20,100}$/.test(giftKey)) throw new Error('IRIS_GIFT_KEY ontbreekt of lijkt niet geldig.')

const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 13).replace('T', '-')
const output = customOutput ? path.resolve(customOutput) : path.join(root, 'private-output', `trackback-qr-bundle-${stamp}`)
const zipFiles = {}
const utf8 = value => new TextEncoder().encode(value)
const fromBase64Url = value => Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
const slug = value => String(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'editie'
const csvCell = value => `"${String(value ?? '').replaceAll('"', '""')}"`

async function decryptGift() {
  const envelope = JSON.parse(await readFile(path.join(root, 'public/gifts/g-7n4p2d8k.json'), 'utf8'))
  const encrypted = fromBase64Url(envelope.data)
  const decipher = crypto.createDecipheriv('aes-256-gcm', fromBase64Url(giftKey), fromBase64Url(envelope.iv))
  decipher.setAuthTag(encrypted.subarray(encrypted.length - 16))
  const plaintext = Buffer.concat([decipher.update(encrypted.subarray(0, -16)), decipher.final()])
  return JSON.parse(plaintext.toString('utf8'))
}

async function loadPublicEditions() {
  const catalog = JSON.parse(await readFile(path.join(root, 'public/decks/index.json'), 'utf8'))
  return Promise.all((catalog.editions || []).map(async entry => ({
    ...JSON.parse(await readFile(path.join(root, 'public/decks', entry.file), 'utf8')),
    ...entry,
  })))
}

async function addFile(relativePath, data) {
  const bytes = typeof data === 'string' ? utf8(data) : new Uint8Array(data)
  const destination = path.join(output, relativePath)
  await mkdir(path.dirname(destination), { recursive: true })
  await writeFile(destination, bytes)
  zipFiles[relativePath] = bytes
}

const gift = await decryptGift()
const editions = [...gift.editions, ...await loadPublicEditions()]
const manifest = {
  generatedAt: new Date().toISOString(),
  app: 'TRACKBACK',
  baseUrl,
  editions: [],
}
const csvRows = [['editie', 'kaart', 'titel', 'artiest', 'jaar', 'qr_bestand', 'spotify_uri']]

for (const edition of editions) {
  const editionSlug = slug(edition.name)
  const editionManifest = { id: edition.id, name: edition.name, cards: [] }
  for (const [index, rawTrack] of (edition.tracks || []).entries()) {
    const track = normalizeTrack(rawTrack)
    const cardNumber = String(index + 1).padStart(3, '0')
    const relativePath = `${editionSlug}/kaart-${cardNumber}.png`
    const cardUrl = `${baseUrl.replace(/\/$/, '')}/?card=${encodeCard(track, clientId)}#play`
    const png = await QRCode.toBuffer(cardUrl, { type: 'png', width: 900, margin: 3, errorCorrectionLevel: 'M', color: { dark: '#050509', light: '#ffffff' } })
    await addFile(relativePath, png)
    editionManifest.cards.push({ number: index + 1, title: track.title, artist: track.artist, year: track.year, file: relativePath, spotifyUri: track.spotifyUri })
    csvRows.push([edition.name, index + 1, track.title, track.artist, track.year, relativePath, track.spotifyUri])
  }
  manifest.editions.push(editionManifest)
}

const irisLibraryUrl = `${baseUrl.replace(/\/$/, '')}/#gift=g-7n4p2d8k.${giftKey}`
const irisQr = await QRCode.toBuffer(irisLibraryUrl, { type: 'png', width: 1200, margin: 4, errorCorrectionLevel: 'Q', color: { dark: '#050509', light: '#ffffff' } })
await addFile('iris-bibliotheek-qr.png', irisQr)
await addFile('inhoud.json', `${JSON.stringify(manifest, null, 2)}\n`)
await addFile('inhoud.csv', `${csvRows.map(row => row.map(csvCell).join(',')).join('\n')}\n`)
await addFile('LEES-MIJ.txt', `TRACKBACK QR-BUNDEL\n\n${manifest.editions.map(edition => `- ${edition.name}: ${edition.cards.length} kaarten`).join('\n')}\n\nTotaal: ${manifest.editions.reduce((sum, edition) => sum + edition.cards.length, 0)} speelkaart-QR-codes.\nDezelfde kaarten werken voor Tijdlijn, Raad de hit, Muziekbingo en Battle of the Hits.\nDe publieke Spotify Client ID is in iedere speelkaart gecodeerd; een Client Secret is niet opgenomen.\n`)

const zipPath = `${output}.zip`
await mkdir(path.dirname(zipPath), { recursive: true })
await writeFile(zipPath, zipSync(zipFiles, { level: 6 }))

console.log(JSON.stringify({ output, zipPath, editions: manifest.editions.map(({ name, cards }) => ({ name, cards: cards.length })), totalCards: manifest.editions.reduce((sum, edition) => sum + edition.cards.length, 0) }, null, 2))
