import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

// Publieke Spotify-decenniumplaylists. Mainstream en per decennium al gecureerd,
// precies de smaak die Lodewijk vroeg: Top 2000-materiaal uit de jaren 60, 70 en 80
// met een herkenbaar staartje uit de jaren 90 en 00.
const SOURCES = [
  { id: '37i9dQZF1DXaKIA8E7WcJj', label: 'All Out 60s', decade: 1960 },
  { id: '37i9dQZF1DWTJ7xPn4vNaz', label: 'All Out 70s', decade: 1970 },
  { id: '37i9dQZF1DX4UtSsGT1Sbe', label: 'All Out 80s', decade: 1980 },
  { id: '37i9dQZF1DXbTxeAdrVG2l', label: 'All Out 90s', decade: 1990 },
  { id: '37i9dQZF1DX4o1oenSJRJd', label: 'All Out 2000s', decade: 2000 },
  { id: '1DTzz7Nh2rJBnyFbjsH1Mh', label: 'NPO Radio 2 Top 2000', decade: 0 },
  // Nederlandstalig en Nederpop. De internationale decenniumlijsten leveren daar
  // vrijwel niets van, terwijl het voor een Nederlandse Top 2000-liefhebber juist
  // de herkenbaarste kaarten zijn. Alleen lijsten met Top 2000-repertoire; de
  // levenslied-lijsten zijn bewust overgeslagen.
  { id: '37i9dQZF1DWVXT3RJ6KlMl', label: "70's Nederlandstalig", decade: 1970, dutch: true },
  { id: '32q3ESMN38guDPjZfNZj39', label: 'Nederlandstalig jaren 80', decade: 1980, dutch: true },
  // Deze twee beslaan twee decennia. Zonder bereik zou er helemaal geen zeef op
  // staan, en dan glipt een nummer waarvan alleen heruitgaven in de catalogi
  // staan er met een veel te laat jaar doorheen.
  { id: '0TBMW48OYBbAD1YvQQiv81', label: 'Nederpop classics 70/80', decade: 0, from: 1970, to: 1989, dutch: true },
  { id: '1BPAXk4WYb9Tv52sI2mOqw', label: 'Nederpop jaren 60 en 70', decade: 0, from: 1960, to: 1979, dutch: true },
]

const cacheDirectory = '.private/spotify-embed-cache'
const output = process.argv[2] || '.private/lodewijk-pool.json'
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
const extract = html => {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s)
  return match ? JSON.parse(match[1]).props.pageProps.state.data.entity : null
}

// Zelfde cache- en herhaalgedrag als expand-profile-edition.mjs, zodat een halve
// run niet opnieuw honderden verzoeken naar Spotify stuurt.
async function entity(type, id) {
  const cacheFile = join(cacheDirectory, `${type === 'track' ? 'track-page' : type}-${id}.json`)
  try { return JSON.parse(await readFile(cacheFile, 'utf8')) } catch { /* nog niet gecachet */ }
  for (let attempt = 0; attempt < 7; attempt += 1) {
    const response = await fetch(type === 'track' ? `https://open.spotify.com/track/${id}` : `https://open.spotify.com/embed/${type}/${id}`)
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

// Spotify zet in playlist-subtitles een harde spatie (U+00A0) na de komma.
// Die telt dubbel in de UTF-8 van de QR-payload en levert onzichtbare verschillen
// op bij vergelijken, dus alle witruimte wordt gewoon gemaakt.
const nette = value => String(value ?? '').replace(/[\u00a0\u2007\u202f]/g, ' ').replace(/\s+/g, ' ').trim()

const candidates = new Map()
for (const source of SOURCES) {
  const playlist = await entity('playlist', source.id)
  const tracks = (playlist.trackList || []).filter(track => track.entityType === 'track' || track.uri?.startsWith('spotify:track:'))
  for (const [position, track] of tracks.entries()) {
    const existing = candidates.get(track.uri)
    if (existing) { existing.sources.push(source.label); existing.dutch = existing.dutch || Boolean(source.dutch); continue }
    candidates.set(track.uri, {
      spotifyUri: track.uri,
      title: nette(track.title),
      artist: nette(track.subtitle),
      sourceDecade: source.decade,
      sourceFrom: source.from || (source.decade || 0),
      sourceTo: source.to || (source.decade ? source.decade + 9 : 0),
      dutch: Boolean(source.dutch),
      sourcePosition: position + 1,
      sources: [source.label],
    })
  }
  console.log(`${source.label.padEnd(22)} ${tracks.length} tracks, pool nu ${candidates.size}`)
}

// Releasedatum, hoes en artiestnamen per nummer ophalen. Drie parallelle lezers,
// want de cache vangt herhaalde runs op en Spotify begrenst hierboven al netjes.
const pool = [...candidates.values()]
let cursor = 0
let failed = 0
await Promise.all(Array.from({ length: 3 }, async () => {
  while (cursor < pool.length) {
    const index = cursor++
    const track = pool[index]
    const id = track.spotifyUri.split(':').pop()
    try {
      const detail = await entity('track', id)
      track.title = nette(detail.title) || track.title
      // NIET de artiesten van de trackpagina gebruiken. Die worden uit de
      // ld+json-omschrijving gehaald door op ", " te splitsen, en dat knipt een
      // artiestnaam die zelf een komma bevat doormidden: "Earth, Wind & Fire"
      // wordt dan "Earth". De subtitle uit de playlist is Spotify's eigen
      // weergavenaam en klopt wel, dus die blijft staan.
      if (!track.artist) track.artist = detail.artists?.map(artist => artist.name).filter(Boolean).join(', ') || ''
      track.spotifyYear = detail.releaseDate?.isoString?.slice(0, 4) || ''
      track.image = detail.visualIdentity?.image?.at(-1)?.url || ''
      track.externalUrl = `https://open.spotify.com/track/${id}`
    } catch (error) {
      track.error = error.message
      failed += 1
    }
    process.stdout.write(`\r${index + 1}/${pool.length} (${failed} mislukt)`)
  }
}))

const usable = pool.filter(track => !track.error && track.spotifyYear)

// Jaartallen uit MusicBrainz en iTunes kosten ruim een uur om op te halen en
// worden hier bewaard. Zonder deze samenvoeging gooit een nieuwe bron in de
// lijst hierboven al dat werk weg, want de pool wordt vanaf nul opgebouwd.
let bewaard = 0
try {
  const vorige = JSON.parse(await readFile(output, 'utf8')).tracks || []
  const perUri = new Map(vorige.map(track => [track.spotifyUri, track]))
  for (const track of usable) {
    const oud = perUri.get(track.spotifyUri)
    if (!oud) continue
    for (const veld of ['year', 'yearSource', 'yearMatchScore', 'releaseGroupYear', 'releaseGroupError', 'itunesYear', 'itunesModalYear', 'itunesHits', 'itunesError']) {
      if (oud[veld] !== undefined) { track[veld] = oud[veld]; }
    }
    bewaard += 1
  }
} catch { /* nog geen eerdere pool */ }

await writeFile(output, `${JSON.stringify({ id: 'lodewijk-pool', name: 'Lodewijk kandidatenpool', tracks: usable }, null, 2)}\n`)
if (bewaard) console.log(`Eerder opgehaalde jaartallen behouden voor ${bewaard} nummers.`)
console.log(`\n${usable.length} bruikbare kandidaten in ${output} (${failed} mislukt, ${pool.length - usable.length - failed} zonder jaartal)`)
