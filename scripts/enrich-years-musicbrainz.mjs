import { readFile, writeFile } from 'node:fs/promises'

const file = process.argv[2] || 'public/decks/guilty-pleasures.json'
const document = JSON.parse(await readFile(file, 'utf8'))
const tracks = Array.isArray(document) ? document.flatMap(edition => edition.tracks || []) : document.tracks
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
const clean = value => value
  .replace(/\s+-\s+(\d{4} )?(Remaster|Radio|Edit|Live|From |Pop On-).*/i, '')
  .replace(/\s+\(feat\..*\)$/i, '')
  .trim()
const normalize = value => clean(value)
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/gi, ' ')
  .trim()
  .toLowerCase()

for (let index = 0; index < tracks.length; index += 1) {
  const track = tracks[index]
  if (track.yearSource === 'MusicBrainz first release' || track.yearSource === 'Handmatig gecontroleerd') {
    process.stdout.write(`\r${index + 1}/${tracks.length}`)
    continue
  }
  if (track.spotifyYear) track.year = track.spotifyYear
  const title = clean(track.title)
  const artist = track.artist.split(',')[0].trim()
  const query = `recording:"${title.replaceAll('"', '')}" AND artist:"${artist.replaceAll('"', '')}"`
  // Beroemde nummers hebben in MusicBrainz tientallen tot honderden losse
  // recording-records, één per verzamelaar of remaster. Die komen NIET op datum
  // binnen maar op zoekscore. Met een kleine limiet zie je alleen heruitgaven en
  // kies je een veel te laat jaar: Respect van Aretha Franklin werd zo 1992 in
  // plaats van 1967. Ruim ophalen en daarna de vroegste nemen is de enige
  // manier om de oorspronkelijke uitgave te pakken.
  const url = `https://musicbrainz.org/ws/2/recording/?query=${encodeURIComponent(query)}&fmt=json&limit=100`
  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'TimepopPrivateGame/0.5 (https://github.com/tessavdn-creator/ons-muziekspel)' } })
    if (response.status === 503) { await wait(2500); index -= 1; continue }
    if (!response.ok) throw new Error(String(response.status))
    const data = await response.json()
    const wantedTitle = normalize(title)
    const wantedArtist = normalize(artist)
    const candidates = data.recordings
      .filter(item => {
        const year = Number(item['first-release-date']?.slice(0, 4))
        const creditedArtists = (item['artist-credit'] || []).map(credit => normalize(credit.name || ''))
        return Number(item.score) >= 90
          && normalize(item.title || '') === wantedTitle
          && creditedArtists.includes(wantedArtist)
          && year >= 1900
          && year <= new Date().getFullYear()
      })
      .sort((left, right) => left['first-release-date'].localeCompare(right['first-release-date']))
    if (candidates.length) {
      const best = candidates[0]
      track.spotifyYear ||= track.year
      track.year = best['first-release-date'].slice(0, 4)
      track.yearSource = 'MusicBrainz first release'
      track.yearMatchScore = best.score
      track.tags = [...new Set([...(track.tags || []).filter(tag => !/^\d{4}s$/.test(tag)), `${Math.floor(Number(track.year) / 10) * 10}s`])]
    } else track.yearSource = 'Spotify release'
  } catch (error) {
    track.yearSource = `Spotify (${error.message})`
  }
  process.stdout.write(`\r${index + 1}/${tracks.length}`)
  if ((index + 1) % 10 === 0) await writeFile(file, `${JSON.stringify(document, null, 2)}\n`)
  await wait(1050)
}

await writeFile(file, `${JSON.stringify(document, null, 2)}\n`)
console.log(`\n${file} verrijkt`)
