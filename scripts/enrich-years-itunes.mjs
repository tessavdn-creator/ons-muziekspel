// Vierde jaartalbron. Belangrijk omdat hij de ANDERE kant op faalt dan de rest:
// MusicBrainz en Spotify vallen te laat uit door heruitgaven, iTunes valt te
// vroeg uit doordat een gelijknamig ander nummer meetelt (Billie Jean uit 1966
// is niet dat van Michael Jackson). Twee bronnen met tegengestelde fouten maken
// een mediaan pas echt robuust.
//
// Per nummer worden twee signalen bewaard: het vroegste jaar en het meest
// voorkomende jaar onder de treffers. Welke van de twee beter werkt, wordt
// gemeten en niet aangenomen.
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
const normalize = value => String(value).normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, ' ').trim().toLowerCase()

// Node's fetch heeft geen tijdslimiet. Een verbinding die blijft hangen legt het
// hele script stil zonder ooit een fout te geven. Deze wikkel breekt af en
// probeert opnieuw, zodat een enkele slechte verbinding een run van een uur niet
// laat stranden.
const haalOp = async (url, opties = {}, pogingen = 3) => {
  for (let poging = 1; poging <= pogingen; poging += 1) {
    try {
      return await fetch(url, { ...opties, signal: AbortSignal.timeout(20000) })
    } catch (error) {
      if (poging === pogingen) throw new Error(`geen antwoord na ${pogingen} pogingen: ${error.message}`)
      await new Promise(resolve => setTimeout(resolve, 2000 * poging))
    }
  }
}

for (let index = 0; index < tracks.length; index += 1) {
  const track = tracks[index]
  if (track.itunesYear !== undefined) { process.stdout.write(`\r${index + 1}/${tracks.length}`); continue }
  const title = clean(track.title)
  const artist = track.artist.split(',')[0].trim()
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(`${artist} ${title}`)}&media=music&entity=song&limit=100`
  try {
    const response = await haalOp(url)
    if (response.status === 403 || response.status === 429) { await wait(20000); index -= 1; continue }
    if (!response.ok) throw new Error(String(response.status))
    const data = await response.json()
    const wantedTitle = normalize(title)
    const wantedArtist = normalize(artist)
    const years = (data.results || [])
      .filter(item => normalize(item.trackName || '').startsWith(wantedTitle) && normalize(item.artistName || '').includes(wantedArtist))
      .map(item => Number(String(item.releaseDate || '').slice(0, 4)))
      .filter(year => year >= 1940 && year <= new Date().getFullYear())
    const tally = new Map()
    years.forEach(year => tally.set(year, (tally.get(year) || 0) + 1))
    const modal = [...tally.entries()].sort((left, right) => right[1] - left[1] || left[0] - right[0])[0]
    track.itunesYear = years.length ? String(Math.min(...years)) : ''
    track.itunesModalYear = modal ? String(modal[0]) : ''
    track.itunesHits = years.length
  } catch (error) {
    track.itunesYear = ''
    track.itunesModalYear = ''
    track.itunesError = error.message
  }
  process.stdout.write(`\r${index + 1}/${tracks.length}`)
  if ((index + 1) % 20 === 0) await writeFile(file, `${JSON.stringify(document, null, 2)}\n`)
  await wait(600)
}

await writeFile(file, `${JSON.stringify(document, null, 2)}\n`)
console.log(`\n${file} aangevuld: ${tracks.filter(track => track.itunesYear).length} van ${tracks.length} nummers hebben een iTunes-jaar.`)
