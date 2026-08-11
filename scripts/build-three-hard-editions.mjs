import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'

const [input, output, sizeArgument = '60', curatedInput] = process.argv.slice(2)
if (!input || !output) throw new Error('Gebruik: node scripts/build-three-hard-editions.mjs KANDIDATEN.json UITVOER.json [KAARTEN-PER-EDITIE] [GECONTROLEERDE-METADATA.json]')
const editionSize = Number(sizeArgument)
if (!Number.isInteger(editionSize) || editionSize < 1) throw new Error('KAARTEN-PER-EDITIE moet een positief geheel getal zijn.')
let pool = JSON.parse(await readFile(input, 'utf8')).tracks
if (curatedInput) {
  const curated = JSON.parse(await readFile(curatedInput, 'utf8')).tracks
  const byUri = new Map(curated.map(track => [track.spotifyUri, track]))
  pool = pool.map(track => {
    const known = byUri.get(track.spotifyUri)
    return known ? { ...track, year: known.year, spotifyYear: known.spotifyYear, yearSource: known.yearSource, yearMatchScore: known.yearMatchScore, genre: known.genre, tags: known.tags } : track
  })
}
const score = track => createHash('sha256').update(track.spotifyUri).digest().readUInt32BE(0)
const order = tracks => [...tracks].sort((a, b) => score(a) - score(b))
const clean = track => {
  const { sourceRank, ...result } = track
  result.tags = [...new Set([...(result.tags || []), `${Math.floor(Number(result.year) / 10) * 10}s`, result.genre, 'expert'])]
  return result
}
const unique = tracks => [...new Map(tracks.map(track => [track.spotifyUri, track])).values()]
const take = (tracks, amount) => unique(tracks).slice(0, amount)

const seeds = order(pool.filter(track => track.sourceRank === 0))
const deepCuts = order(pool.filter(track => track.sourceRank > 0))
const hidden = take([...seeds, ...deepCuts], editionSize)
const hiddenUris = new Set(hidden.map(track => track.spotifyUri))

const byDecade = new Map()
for (const track of order(pool).filter(track => !hiddenUris.has(track.spotifyUri))) {
  const decade = Math.floor(Number(track.year) / 10) * 10
  if (!byDecade.has(decade)) byDecade.set(decade, [])
  byDecade.get(decade).push(track)
}
const timeline = []
while (timeline.length < editionSize) {
  let added = false
  for (const decade of [...byDecade.keys()].sort()) {
    const next = byDecade.get(decade).shift()
    if (next) { timeline.push(next); added = true }
    if (timeline.length === editionSize) break
  }
  if (!added) break
}

const alreadyUsed = new Set([...hidden, ...timeline].map(track => track.spotifyUri))
const nighttime = track => (track.tags || []).some(tag => /Dreampop|TEMPLELAER|Franco|Dream Behind|🍑/i.test(tag)) || ['soul', 'electronic'].includes(track.genre)
const afterDark = take([
  ...order(pool.filter(track => nighttime(track) && !alreadyUsed.has(track.spotifyUri))),
  ...order(pool.filter(track => !alreadyUsed.has(track.spotifyUri))),
  ...order(pool.filter(nighttime)),
  ...order(pool),
], editionSize)

const uniqueAcrossEditions = new Set([...hidden, ...timeline, ...afterDark].map(track => track.spotifyUri))
if (hidden.length !== editionSize || timeline.length !== editionSize || afterDark.length !== editionSize || uniqueAcrossEditions.size !== editionSize * 3) {
  throw new Error(`Onvoldoende unieke kandidaten: ${uniqueAcrossEditions.size}/${editionSize * 3} kaarten verdeeld.`)
}

const edition = (id, name, subtitle, description, tracks) => ({
  id, name, subtitle, description, difficulty: 'expert', tracks: tracks.map(clean),
})
const editions = [
  edition('hidden-corners-01', 'Hidden Corners', 'De diepe platenkast', `${editionSize} eigenzinnige keuzes en deep cuts. Weinig inkoppers, veel momenten waarop je het bijna weet.`, hidden),
  edition('time-warp-01', 'The Crooked Timeline', 'Van 1941 tot nu', `${editionSize} nummers, bewust verspreid over meerdere decennia. Remasters verraden het antwoord niet: het oorspronkelijke opnamejaar telt.`, timeline),
  edition('after-dark-01', 'After Dark', 'Nachtelijke rituelen', `${editionSize} stukken vol dreampop, vintage jazz, wereldmuziek, blues en psychedelische rafelranden.`, afterDark),
]

await writeFile(output, `${JSON.stringify(editions, null, 2)}\n`)
console.log(editions.map(item => `${item.name}: ${item.tracks.length}`).join('\n'))
