import { readFile, writeFile } from 'node:fs/promises'

const [deckFile, officialJson] = process.argv.slice(2)
if (!deckFile || !officialJson) throw new Error('Gebruik: node scripts/apply-top2000-years.mjs DECK.json OFFICIELE-XLS-ALS-JSON.json')
const deck = JSON.parse(await readFile(deckFile, 'utf8'))
const rows = JSON.parse(await readFile(officialJson, 'utf8')).filter(row => Number(row.__EMPTY) >= 1)
const normalize = value => String(value).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/\s*[-(]\s*(remaster|albumversie|live).*$/i, '').replace(/[^a-z0-9]+/g, '')
const genre = track => {
  const value = `${track.artist} ${track.title}`.toLowerCase()
  if (/boudewijn|klein orkest|marco borsato|stef bos|acda|guus meeuwis|miss montreal/.test(value)) return 'nederlands'
  if (/metallica|queen|eagles|pearl jam|zeppelin|dire straits|pink floyd|guns n|cure|deep purple|fleetwood|radiohead|ac\/dc|springsteen|nirvana|bowie|nothing but thieves|rage against|black sabbath|rolling stones|volbeat|cranberries|supertramp|killers|u2|muse/.test(value)) return 'rock'
  if (/amy winehouse|michael kiwanuka/.test(value)) return 'soul'
  return 'pop'
}

if (deck.tracks.length !== 100 || rows.length < 100) throw new Error(`Verwacht 100 kaarten en minimaal 100 officiële rijen; kreeg ${deck.tracks.length} en ${rows.length}.`)
const mismatches = []
for (let index = 0; index < deck.tracks.length; index += 1) {
  const track = deck.tracks[index]
  const row = rows[index]
  if (Number(row.__EMPTY) !== index + 1 || !normalize(track.title).includes(normalize(row['NPO Radio 2 Top 2000  (2025)'])) && !normalize(row['NPO Radio 2 Top 2000  (2025)']).includes(normalize(track.title))) mismatches.push(index + 1)
  const year = Number(row.__EMPTY_2)
  if (year < 1900 || year > new Date().getFullYear()) throw new Error(`Ongeldig officieel jaartal op positie ${index + 1}.`)
  track.year = String(year)
  track.yearSource = 'Officiële NPO Radio 2 Top 2000 2025-lijst'
  track.genre = genre(track)
  track.tags = [...new Set([...(track.tags || []).filter(tag => !/^\d{4}s$/.test(tag)), `${Math.floor(year / 10) * 10}s`, track.genre, 'top-2000', 'toegankelijk'])]
  delete track.yearMatchScore
}
if (mismatches.length > 5) throw new Error(`De Spotify-volgorde wijkt af van de officiële lijst op posities: ${mismatches.join(', ')}`)

await writeFile(deckFile, `${JSON.stringify(deck, null, 2)}\n`)
console.log(`100 officiële Top 2000-jaartallen toegepast; ${mismatches.length} titelvarianten geaccepteerd.`)
