// De pool aanvullen met de bekendste nummers van precies de artiesten die al in
// Tessa's eigen lijsten staan.
//
// Waarom zo: haar twee langste playlists geven publiek maar 100 van hun nummers
// prijs, dus de pool is te klein voor 300 kaarten. Zelf nummers verzinnen zou
// gokken zijn; de publieke top van HAAR artiesten is per definitie hetzelfde
// smaakprofiel en per definitie het herkenbaarste werk van die artiest.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { join } from 'node:path'

const poolFile = process.argv[2] || '.private/tessa-pool.json'
const wanted = Number(process.argv[3] || 260)
const cacheDirectory = '.private/spotify-embed-cache'
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
const extract = html => {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s)
  return match ? JSON.parse(match[1]).props.pageProps.state.data.entity : null
}
const hash = value => createHash('sha256').update(value).digest().readUInt32BE(0)
const nette = value => String(value ?? '').replace(/[   ]/g, ' ').replace(/\s+/g, ' ').trim()

async function entity(type, id) {
  const cacheFile = join(cacheDirectory, `${type === 'track' ? 'track-page' : type}-${id}.json`)
  try { return JSON.parse(await readFile(cacheFile, 'utf8')) } catch { /* nog niet gecachet */ }
  for (let attempt = 0; attempt < 7; attempt += 1) {
    const response = await fetch(type === 'track' ? `https://open.spotify.com/track/${id}` : `https://open.spotify.com/embed/${type}/${id}`, { signal: AbortSignal.timeout(20000) })
    if (response.ok) {
      const html = await response.text()
      let result = extract(html)
      if (type === 'track') {
        const ldMatch = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)
        const ld = ldMatch ? JSON.parse(ldMatch[1]) : null
        const artistIds = [...new Set([...html.matchAll(/https:\/\/open\.spotify\.com\/artist\/([A-Za-z0-9]+)/g)].map(match => match[1]))]
        const artistNames = String(ld?.description || '').match(/Song · (.*?) · \d{4}/)?.[1]?.split(', ') || []
        result = ld ? {
          title: ld.name,
          uri: `spotify:track:${id}`,
          releaseDate: { isoString: ld.datePublished || '' },
          artists: artistIds.map((artistId, index) => ({ name: artistNames[index] || artistNames[0] || '', uri: `spotify:artist:${artistId}` })),
          visualIdentity: { image: [{ url: html.match(/<meta property="og:image" content="([^"]+)"/)?.[1] || '' }] },
        } : null
      }
      if (!result) throw new Error(`Geen publieke ${type}-details voor ${id}`)
      await mkdir(cacheDirectory, { recursive: true })
      await writeFile(cacheFile, `${JSON.stringify(result)}\n`)
      await wait(250)
      return result
    }
    if (response.status !== 429) throw new Error(`${response.status} voor ${type}/${id}`)
    await wait((Number(response.headers.get('retry-after')) || 4 + attempt * 3) * 1000)
  }
  throw new Error(`Spotify blijft verzoeken begrenzen voor ${type}/${id}`)
}

const document = JSON.parse(await readFile(poolFile, 'utf8'))
const pool = document.tracks
const eigen = new Set(pool.map(track => track.spotifyUri))

// 1. De artiesten van haar eigen nummers verzamelen. Alleen de EERSTE artiest van
// een nummer telt als smaaksignaal: bij "Taio Cruz, Flo Rida" is het de eerste
// die op haar lijst hoort, niet iedere gast die meezingt.
const artiesten = new Map()
for (const track of pool) {
  if (track.extra) continue
  const detail = await entity('track', track.spotifyUri.split(':').pop())
  const eerste = (detail.artists || [])[0]
  if (!eerste?.uri) continue
  const bestaand = artiesten.get(eerste.uri)
  if (bestaand) bestaand.gewicht += 1
  else artiesten.set(eerste.uri, { uri: eerste.uri, naam: nette(eerste.name) || nette(track.artist.split(',')[0]), gewicht: 1 })
}
console.log(`${artiesten.size} artiesten uit haar eigen lijsten.`)

// 2. De publieke top van elke artiest ophalen.
const kandidaten = []
let teller = 0
for (const artiest of artiesten.values()) {
  teller += 1
  process.stdout.write(`\rartiest ${teller}/${artiesten.size}`)
  let detail
  try { detail = await entity('artist', artiest.uri.split(':').pop()) } catch { continue }
  for (const [rang, track] of (detail?.trackList || []).entries()) {
    if (!track.uri?.startsWith('spotify:track:') || eigen.has(track.uri)) continue
    if (kandidaten.some(kandidaat => kandidaat.spotifyUri === track.uri)) continue
    kandidaten.push({
      spotifyUri: track.uri,
      title: nette(track.title),
      artist: nette(track.subtitle) || artiest.naam,
      artistRank: rang + 1,
      gewicht: artiest.gewicht,
      sources: [`Top van ${artiest.naam}`],
    })
  }
}
console.log(`\n${kandidaten.length} kandidaten uit de artiestentops.`)

// 3. Rangschikken. Een artiest die vaker op haar lijsten staat weegt zwaarder, en
// binnen een artiest gaat de hoogst genoteerde track voor: dat is de bekendste.
// Per artiest hooguit vier extra's, anders vult Céline Dion het hele restant.
const perArtiest = new Map()
const gekozen = []
for (const kandidaat of [...kandidaten].sort((links, rechts) =>
  rechts.gewicht - links.gewicht || links.artistRank - rechts.artistRank || hash(links.spotifyUri) - hash(rechts.spotifyUri))) {
  const sleutel = kandidaat.artist.split(',')[0].trim().toLowerCase()
  const aantal = perArtiest.get(sleutel) || 0
  if (aantal >= 4) continue
  perArtiest.set(sleutel, aantal + 1)
  gekozen.push(kandidaat)
  if (gekozen.length >= wanted) break
}
console.log(`${gekozen.length} extra kandidaten gekozen, van ${perArtiest.size} artiesten.`)

// 4. Details ophalen voor alleen de gekozen extra's.
let cursor = 0
let mislukt = 0
await Promise.all(Array.from({ length: 3 }, async () => {
  while (cursor < gekozen.length) {
    const index = cursor++
    const kandidaat = gekozen[index]
    const id = kandidaat.spotifyUri.split(':').pop()
    try {
      const detail = await entity('track', id)
      kandidaat.title = nette(detail.title) || kandidaat.title
      kandidaat.spotifyYear = detail.releaseDate?.isoString?.slice(0, 4) || ''
      kandidaat.image = detail.visualIdentity?.image?.at(-1)?.url || ''
      kandidaat.externalUrl = `https://open.spotify.com/track/${id}`
      kandidaat.album = ''
      kandidaat.sourcePosition = kandidaat.artistRank
      kandidaat.extra = true
    } catch (error) {
      kandidaat.error = error.message
      mislukt += 1
    }
    process.stdout.write(`\rdetails ${index + 1}/${gekozen.length} (${mislukt} mislukt)`)
  }
}))

const bruikbaar = gekozen.filter(kandidaat => !kandidaat.error && kandidaat.spotifyYear)
const samen = [...pool.filter(track => !track.extra), ...bruikbaar]

// Eerder opgehaalde jaartallen behouden, net als in de poolbouwer.
const perUri = new Map(pool.map(track => [track.spotifyUri, track]))
for (const track of samen) {
  const oud = perUri.get(track.spotifyUri)
  if (!oud) continue
  for (const veld of ['year', 'yearSource', 'yearMatchScore', 'releaseGroupYear', 'releaseGroupError', 'itunesYear', 'itunesModalYear', 'itunesHits', 'itunesError']) {
    if (oud[veld] !== undefined) track[veld] = oud[veld]
  }
}

await writeFile(poolFile, `${JSON.stringify({ ...document, tracks: samen }, null, 2)}\n`)
console.log(`\n${samen.length} kandidaten in ${poolFile}: ${samen.filter(track => !track.extra).length} van haar eigen lijsten, ${bruikbaar.length} uit de artiestentops.`)
