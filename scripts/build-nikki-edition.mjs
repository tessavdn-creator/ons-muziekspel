import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'

const [input = '.private/nikki-playlist-full-index.json', output = '.private/nikki-edition.json'] = process.argv.slice(2)
const playlist = JSON.parse(await readFile(input, 'utf8'))
const normalize = value => String(value).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '')
const hash = value => createHash('sha256').update(value).digest().readUInt32BE(0)

const unique = [...new Map(playlist.tracks.map(track => [
  `${normalize(track.title)}|${track.artists.map(normalize).join(',')}`,
  track,
])).values()].sort((left, right) => left.position - right.position)

const amount = 300
const buckets = Array.from({ length: amount }, (_, index) => unique.slice(
  Math.floor(index * unique.length / amount),
  Math.floor((index + 1) * unique.length / amount),
))
const artistCounts = new Map()
const selected = []
for (const bucket of buckets) {
  const ranked = [...bucket].sort((left, right) => {
    const penalty = track => {
      const primaryArtist = track.artists[0] || ''
      const versionPenalty = /\b(live|karaoke|instrumental|sped up|slowed|tribute)\b/i.test(track.title) ? 6 : 0
      return (artistCounts.get(primaryArtist) || 0) * 8 + versionPenalty
    }
    return penalty(left) - penalty(right) || hash(left.id) - hash(right.id)
  })
  const choice = ranked.find(track => (artistCounts.get(track.artists[0] || '') || 0) < 4) || ranked[0]
  selected.push(choice)
  const primaryArtist = choice.artists[0] || ''
  artistCounts.set(primaryArtist, (artistCounts.get(primaryArtist) || 0) + 1)
}

const tracks = selected.map((track, index) => ({
  id: `nikki-${String(index + 1).padStart(3, '0')}-${track.id.slice(0, 6)}`,
  title: track.title,
  artist: track.artists.join(', '),
  year: '',
  album: track.album || '',
  image: track.image || '',
  spotifyUri: `spotify:track:${track.id}`,
  externalUrl: `https://open.spotify.com/track/${track.id}`,
  audioUrl: '',
  genre: 'pop',
  tags: ['auto-classics', 'persoonlijk'],
  sourcePosition: track.position,
}))

const deck = {
  id: 'nikki-full-throttle-01',
  name: 'Full Throttle',
  recipient: 'Nikki',
  source: `https://open.spotify.com/playlist/${playlist.id}`,
  subtitle: 'Nikki’s Auto Classics',
  description: 'Driehonderd persoonlijke favorieten voor onderweg: grote refreinen, tijdloze classics, dansvloerenergie en genoeg verrassingen om de tijdlijn spannend te houden.',
  difficulty: 'normal',
  tracks,
}

await writeFile(output, `${JSON.stringify(deck, null, 2)}\n`)
console.log(`${tracks.length} kaarten geselecteerd uit ${unique.length} unieke tracks.`)
console.log(`Meest voorkomende artiest in de selectie: ${Math.max(...artistCounts.values())} kaarten.`)
