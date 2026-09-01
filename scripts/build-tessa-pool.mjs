// Kandidatenpool voor Tessa's eigen editie.
//
// Bronnen zijn haar drie playlists, door elkaar. Twee daarvan zijn langer dan
// 100 nummers en de publieke embed-pagina van Spotify geeft er nooit meer dan
// 100 terug. Volledige lijsten komen daarom uit TRACKBACK Studio: importeren,
// JSON-back-up downloaden, bestand in .private/tessa-bronnen/ zetten. Staat daar
// een bestand voor een playlist, dan wint dat van de embed.
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const SOURCES = [
  { id: '0mbXpqoWeMl6wiEFaweY3h', label: 'HotGirlsSummer' },
  { id: '2QRsBvib65NIjRSfr6zI0W', label: 'Guilty Pleasures' },
  { id: '3joZgzEMsF0be2lJMC3iGv', label: 'Ahrtal' },
]

const cacheDirectory = '.private/spotify-embed-cache'
const bronDirectory = '.private/tessa-bronnen'
const output = process.argv[2] || '.private/tessa-pool.json'
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
const extract = html => {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s)
  return match ? JSON.parse(match[1]).props.pageProps.state.data.entity : null
}

// Zelfde cache- en herhaalgedrag als build-lodewijk-pool.mjs, zodat een halve run
// niet opnieuw honderden verzoeken naar Spotify stuurt.
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

// Spotify zet in playlist-subtitles een harde spatie (U+00A0) na de komma. Die
// telt dubbel in de UTF-8 van de QR-payload en levert onzichtbare verschillen op
// bij vergelijken, dus alle witruimte wordt gewoon gemaakt.
const nette = value => String(value ?? '').replace(/[   ]/g, ' ').replace(/\s+/g, ' ').trim()

// Studio-exports inlezen. Het bestand bevat geen playlist-id, dus de koppeling
// loopt via de naam; blijft die uit, dan telt het bestand als losse extra bron.
const studioBestanden = []
try {
  for (const naam of (await readdir(bronDirectory)).filter(naam => naam.endsWith('.json'))) {
    const inhoud = JSON.parse(await readFile(join(bronDirectory, naam), 'utf8'))
    const tracks = (inhoud.tracks || []).filter(track => track.spotifyUri)
    if (tracks.length) studioBestanden.push({ naam, label: nette(inhoud.name) || naam.replace(/\.json$/, ''), tracks })
  }
} catch { /* map bestaat nog niet */ }

const candidates = new Map()
const voegToe = (uri, gegevens, label, positie) => {
  const bestaande = candidates.get(uri)
  if (bestaande) { if (!bestaande.sources.includes(label)) bestaande.sources.push(label); return }
  candidates.set(uri, { spotifyUri: uri, ...gegevens, sourcePosition: positie, sources: [label] })
}

for (const source of SOURCES) {
  const studio = studioBestanden.find(bestand => bestand.label.toLowerCase() === source.label.toLowerCase())
  if (studio) {
    studio.gebruikt = true
    for (const [positie, track] of studio.tracks.entries()) {
      voegToe(track.spotifyUri, { title: nette(track.title), artist: nette(track.artist), album: nette(track.album), image: track.image || '', spotifyYear: String(track.year || '').slice(0, 4) }, source.label, positie + 1)
    }
    console.log(`${source.label.padEnd(18)} ${studio.tracks.length} tracks uit Studio, pool nu ${candidates.size}`)
    continue
  }
  const playlist = await entity('playlist', source.id)
  const tracks = (playlist.trackList || []).filter(track => track.uri?.startsWith('spotify:track:'))
  for (const [positie, track] of tracks.entries()) {
    voegToe(track.uri, { title: nette(track.title), artist: nette(track.subtitle), album: '', image: '', spotifyYear: '' }, source.label, positie + 1)
  }
  console.log(`${source.label.padEnd(18)} ${tracks.length} tracks uit embed (max 100!), pool nu ${candidates.size}`)
}

for (const bestand of studioBestanden.filter(bestand => !bestand.gebruikt)) {
  for (const [positie, track] of bestand.tracks.entries()) {
    voegToe(track.spotifyUri, { title: nette(track.title), artist: nette(track.artist), album: nette(track.album), image: track.image || '', spotifyYear: String(track.year || '').slice(0, 4) }, bestand.label, positie + 1)
  }
  console.log(`${bestand.label.padEnd(18)} ${bestand.tracks.length} tracks uit ${bestand.naam}, pool nu ${candidates.size}`)
}

// Releasedatum, hoes en artiestnamen per nummer. Drie parallelle lezers; de cache
// vangt herhaalde runs op en entity() begrenst zichzelf al.
const pool = [...candidates.values()]
let cursor = 0
let failed = 0
await Promise.all(Array.from({ length: 3 }, async () => {
  while (cursor < pool.length) {
    const index = cursor++
    const track = pool[index]
    if (track.image && track.spotifyYear && track.externalUrl) continue
    const id = track.spotifyUri.split(':').pop()
    try {
      const detail = await entity('track', id)
      track.title = nette(detail.title) || track.title
      // NIET de artiesten van de trackpagina gebruiken wanneer de bron al een
      // naam gaf. Die worden uit de ld+json-omschrijving gehaald door op ", " te
      // splitsen, en dat knipt een artiestnaam die zelf een komma bevat
      // doormidden: "Earth, Wind & Fire" wordt dan "Earth".
      if (!track.artist) track.artist = detail.artists?.map(artist => artist.name).filter(Boolean).join(', ') || ''
      track.spotifyYear = track.spotifyYear || detail.releaseDate?.isoString?.slice(0, 4) || ''
      track.image = track.image || detail.visualIdentity?.image?.at(-1)?.url || ''
      track.externalUrl = `https://open.spotify.com/track/${id}`
    } catch (error) {
      track.error = error.message
      failed += 1
    }
    process.stdout.write(`\r${index + 1}/${pool.length} (${failed} mislukt)`)
  }
}))

const usable = pool.filter(track => !track.error && track.spotifyYear)

// Jaartallen uit MusicBrainz en iTunes kosten ruim een uur om op te halen. Zonder
// deze samenvoeging gooit een nieuwe bron in SOURCES al dat werk weg, want de
// pool wordt vanaf nul opgebouwd.
let bewaard = 0
try {
  const vorige = JSON.parse(await readFile(output, 'utf8')).tracks || []
  const perUri = new Map(vorige.map(track => [track.spotifyUri, track]))
  for (const track of usable) {
    const oud = perUri.get(track.spotifyUri)
    if (!oud) continue
    for (const veld of ['year', 'yearSource', 'yearMatchScore', 'releaseGroupYear', 'releaseGroupError', 'itunesYear', 'itunesModalYear', 'itunesHits', 'itunesError']) {
      if (oud[veld] !== undefined) track[veld] = oud[veld]
    }
    bewaard += 1
  }
} catch { /* nog geen eerdere pool */ }

await writeFile(output, `${JSON.stringify({ id: 'tessa-pool', name: 'Tessa kandidatenpool', tracks: usable }, null, 2)}\n`)
if (bewaard) console.log(`Eerder opgehaalde jaartallen behouden voor ${bewaard} nummers.`)
console.log(`\n${usable.length} bruikbare kandidaten in ${output} (${failed} mislukt, ${pool.length - usable.length - failed} zonder jaartal)`)
