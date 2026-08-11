import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const [input, output] = process.argv.slice(2)
if (!input || !output) throw new Error('Gebruik: node scripts/expand-profile-edition.mjs INVOER.json UITVOER.json')
const deck = JSON.parse(await readFile(input, 'utf8'))
const cacheDirectory = '.private/spotify-embed-cache'
const extract = html => {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s)
  return match ? JSON.parse(match[1]).props.pageProps.state.data.entity : null
}
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))
const entity = async (type, id) => {
  const cacheFile = join(cacheDirectory, `${type === 'track' ? 'track-page' : type}-${id}.json`)
  try { return JSON.parse(await readFile(cacheFile, 'utf8')) } catch { /* Nog niet gecachet. */ }
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
    const retryAfter = Number(response.headers.get('retry-after')) || 4 + attempt * 3
    await wait(retryAfter * 1000)
  }
  throw new Error(`Spotify blijft verzoeken begrenzen voor ${type}/${id}`)
}

const artistSeeds = new Map()
for (const track of deck.tracks) {
  const detail = await entity('track', track.spotifyUri.split(':').pop())
  for (const artist of detail.artists || []) {
    if (artist?.uri && !artistSeeds.has(artist.uri)) artistSeeds.set(artist.uri, { genre: track.genre, tags: track.tags })
  }
}

const candidates = new Map(deck.tracks.map(track => [track.spotifyUri, { ...track, sourceRank: 0 }]))
for (const [artistUri, seed] of artistSeeds) {
  const artist = await entity('artist', artistUri.split(':').pop())
  // De hele publieke top 10 vormt een brede kandidatenpool. De uiteindelijke
  // verdeler spreidt de inkoppers en deep cuts over verschillende edities.
  for (const [index, track] of (artist?.trackList || []).entries()) {
    if (!candidates.has(track.uri)) candidates.set(track.uri, {
      spotifyUri: track.uri, title: track.title, artist: track.subtitle, genre: seed.genre,
      tags: [...new Set([...(seed.tags || []), index > 3 ? 'deep-cut' : 'artist-pick'])], sourceRank: index + 1,
    })
  }
}

const tracks = [...candidates.values()]
let cursor = 0
await Promise.all(Array.from({ length: 3 }, async () => {
  while (cursor < tracks.length) {
    const index = cursor++
    const track = tracks[index]
    if (track.image && track.externalUrl) continue
    const id = track.spotifyUri.split(':').pop()
    const detail = await entity('track', id)
    tracks[index] = {
      id: track.id || `iris-pool-${String(index + 1).padStart(3, '0')}-${id.slice(0, 6)}`,
      title: detail.title,
      artist: track.artist || detail.artists?.map(artist => artist.name).join(', ') || '',
      year: detail.releaseDate?.isoString?.slice(0, 4) || '', album: '',
      image: detail.visualIdentity?.image?.at(-1)?.url || '', spotifyUri: detail.uri,
      externalUrl: `https://open.spotify.com/track/${id}`, audioUrl: '',
      genre: track.genre || 'pop', tags: track.tags || [], sourceRank: track.sourceRank,
    }
    process.stdout.write(`\r${index + 1}/${tracks.length}`)
  }
}))

await writeFile(output, `${JSON.stringify({ ...deck, name: 'Iris uitgebreide kandidaten', tracks }, null, 2)}\n`)
console.log(`\n${tracks.length} unieke tracks in ${output}`)
