import { mkdir, writeFile } from 'node:fs/promises'

const playlistId = process.argv[2]
const slug = process.argv[3] || 'spotify-deck'
if (!playlistId) throw new Error('Gebruik: node scripts/import-spotify-embed.mjs PLAYLIST_ID [slug]')

const extract = html => {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s)
  if (!match) throw new Error('Spotify embed-data ontbreekt')
  return JSON.parse(match[1]).props.pageProps.state.data.entity
}

const getEntity = async (type, id) => {
  const response = await fetch(`https://open.spotify.com/embed/${type}/${id}`)
  if (!response.ok) throw new Error(`Spotify ${response.status} voor ${type}/${id}`)
  return extract(await response.text())
}

const rock = /Heart|Meat Loaf|Extreme|Roxette|Foreigner|The Bangles|The Radios|Bonnie Tyler|Wilson Phillips/i
const disco = /Diana Ross|Janet Jackson|Chaka Khan|The Spinners|Lutricia McNeal|Close II You/i
const soul = /Marvin Gaye|Temptations|Aretha Franklin|Whitney Houston|Boyz II Men|Alicia Keys|Toni Braxton|Erykah Badu|Lauryn Hill|Fugees|Oleta Adams|En Vogue|Eternal|Al Green|Tracy Chapman|Babyface|K-Ci/i
const dutch = /Trijntje Oosterhuis|Marco Borsato|Ruth Jacott|Paul de Leeuw|Linda Roos|Gordon|Gerard Joling|Total Touch/i

const classify = (artist, year, title) => {
  const genre = rock.test(artist) ? 'rock' : disco.test(artist) ? 'disco' : soul.test(artist) ? 'soul' : 'pop'
  const tags = [`${Math.floor(Number(year) / 10) * 10}s`, genre]
  if (artist.includes(',') || /feat\.|with /i.test(title)) tags.push('duet')
  if (dutch.test(artist)) tags.push('nederlands')
  if (Number(year) < 1980) tags.push('classic')
  if (/love|lief|heart|hart/i.test(title)) tags.push('liefde')
  return { genre, tags }
}

const playlist = await getEntity('playlist', playlistId)
const sourceTracks = playlist.trackList.filter(track => track.entityType === 'track')
const details = new Array(sourceTracks.length)
let cursor = 0

await Promise.all(Array.from({ length: 8 }, async () => {
  while (cursor < sourceTracks.length) {
    const index = cursor++
    const source = sourceTracks[index]
    const id = source.uri.split(':').pop()
    const detail = await getEntity('track', id)
    const year = detail.releaseDate?.isoString?.slice(0, 4) || ''
    const artist = detail.artists?.map(item => item.name).join(', ') || source.subtitle
    const classification = classify(artist, year, detail.title)
    details[index] = {
      id: `gp-${String(index + 1).padStart(3, '0')}-${id.slice(0, 6)}`,
      title: detail.title,
      artist,
      year,
      album: '',
      image: detail.visualIdentity?.image?.at(-1)?.url || '',
      spotifyUri: detail.uri,
      externalUrl: `https://open.spotify.com/track/${id}`,
      audioUrl: '',
      ...classification,
    }
    process.stdout.write(`\r${details.filter(Boolean).length}/${sourceTracks.length}`)
  }
}))

const deck = {
  id: slug,
  name: playlist.name,
  creator: playlist.subtitle,
  source: `https://open.spotify.com/playlist/${playlistId}`,
  importedAt: new Date().toISOString(),
  tracks: details,
}

await mkdir('public/decks', { recursive: true })
await writeFile(`public/decks/${slug}.json`, `${JSON.stringify(deck, null, 2)}\n`)
console.log(`\npublic/decks/${slug}.json geschreven`)
