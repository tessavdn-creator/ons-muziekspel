import { readFile, writeFile } from 'node:fs/promises'

const [input, output] = process.argv.slice(2)
if (!input || !output) throw new Error('Gebruik: node scripts/expand-profile-edition.mjs INVOER.json UITVOER.json')
const deck = JSON.parse(await readFile(input, 'utf8'))
const extract = html => {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s)
  return match ? JSON.parse(match[1]).props.pageProps.state.data.entity : null
}
const entity = async (type, id) => {
  const response = await fetch(`https://open.spotify.com/embed/${type}/${id}`)
  if (!response.ok) throw new Error(`${response.status} voor ${type}/${id}`)
  return extract(await response.text())
}

const artistSeeds = new Map()
for (const track of deck.tracks) {
  const detail = await entity('track', track.spotifyUri.split(':').pop())
  const artist = detail.artists?.[0]
  if (artist?.uri && !artistSeeds.has(artist.uri)) artistSeeds.set(artist.uri, { genre: track.genre, tags: track.tags })
}

const candidates = new Map(deck.tracks.map(track => [track.spotifyUri, { ...track, sourceRank: 0 }]))
for (const [artistUri, seed] of artistSeeds) {
  const artist = await entity('artist', artistUri.split(':').pop())
  // Posities 3 t/m 7 houden de mix herkenbaar, maar vermijden vooral de inkoppers.
  for (const [index, track] of (artist?.trackList || []).slice(2, 7).entries()) {
    if (!candidates.has(track.uri)) candidates.set(track.uri, {
      spotifyUri: track.uri, title: track.title, artist: track.subtitle, genre: seed.genre,
      tags: [...new Set([...(seed.tags || []), 'deep-cut'])], sourceRank: index + 3,
    })
  }
}

const tracks = [...candidates.values()]
let cursor = 0
await Promise.all(Array.from({ length: 8 }, async () => {
  while (cursor < tracks.length) {
    const index = cursor++
    const track = tracks[index]
    if (track.image && track.externalUrl) continue
    const id = track.spotifyUri.split(':').pop()
    const detail = await entity('track', id)
    tracks[index] = {
      id: track.id || `iris-pool-${String(index + 1).padStart(3, '0')}-${id.slice(0, 6)}`,
      title: detail.title,
      artist: detail.artists?.map(artist => artist.name).join(', ') || track.artist,
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
