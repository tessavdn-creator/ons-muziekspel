// Derde jaartalbron naast de opnamezoektocht en Spotify.
//
// De drie bronnen falen onafhankelijk van elkaar. Een heruitgave of verzamelaar
// maakt het jaar te LAAT; een gelijknamig ander nummer van dezelfde artiest maakt
// het te VROEG. Geen enkele bron is dus alleen te vertrouwen, maar de mediaan van
// de drie gooit een uitschieter in beide richtingen weg.
//
// Deze bron vraagt naar de release-group: de oorspronkelijke single of het album,
// niet naar de losse opnames.
import { readFile, writeFile } from 'node:fs/promises'

const file = process.argv[2] || '.private/lodewijk-pool.json'
const document = JSON.parse(await readFile(file, 'utf8'))
const tracks = Array.isArray(document) ? document.flatMap(edition => edition.tracks || []) : document.tracks
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
const clean = value => value
  .replace(/\s+-\s+(\d{4} )?(Remaster|Radio|Edit|Live|Mono|Stereo|Single|Album|From |Pop On-).*/i, '')
  .replace(/\s+\(feat\..*\)$/i, '')
  .replace(/\s+\((Mono|Stereo)\)$/i, '')
  .trim()
const normalize = value => clean(value).normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, ' ').trim().toLowerCase()

for (let index = 0; index < tracks.length; index += 1) {
  const track = tracks[index]
  if (track.releaseGroupYear !== undefined) { process.stdout.write(`\r${index + 1}/${tracks.length}`); continue }
  const title = clean(track.title)
  const artist = track.artist.split(',')[0].trim()
  const query = `releasegroup:"${title.replaceAll('"', '')}" AND artist:"${artist.replaceAll('"', '')}"`
  const url = `https://musicbrainz.org/ws/2/release-group/?query=${encodeURIComponent(query)}&fmt=json&limit=50`
  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'TrackbackPrivateGame/0.6 (https://github.com/tessavdn-creator/ons-muziekspel)' } })
    if (response.status === 503) { await wait(2500); index -= 1; continue }
    if (!response.ok) throw new Error(String(response.status))
    const data = await response.json()
    const wantedTitle = normalize(title)
    const wantedArtist = normalize(artist)
    const years = (data['release-groups'] || [])
      .filter(group => Number(group.score) >= 90
        && normalize(group.title || '') === wantedTitle
        && (group['artist-credit'] || []).map(credit => normalize(credit.name || '')).includes(wantedArtist)
        && /single|album|ep/i.test(group['primary-type'] || '')
        && !(group['secondary-types'] || []).some(type => /compilation|live|remix/i.test(type)))
      .map(group => Number((group['first-release-date'] || '').slice(0, 4)))
      .filter(year => year >= 1940 && year <= new Date().getFullYear())
      .sort((left, right) => left - right)
    track.releaseGroupYear = years.length ? String(years[0]) : ''
  } catch (error) {
    track.releaseGroupYear = ''
    track.releaseGroupError = error.message
  }
  process.stdout.write(`\r${index + 1}/${tracks.length}`)
  if ((index + 1) % 10 === 0) await writeFile(file, `${JSON.stringify(document, null, 2)}\n`)
  await wait(1050)
}

await writeFile(file, `${JSON.stringify(document, null, 2)}\n`)
const gevonden = tracks.filter(track => track.releaseGroupYear).length
console.log(`\n${file} aangevuld: ${gevonden} van ${tracks.length} nummers hebben een uitgavejaar.`)
