import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const [input, output = input] = process.argv.slice(2)
if (!input) throw new Error('Gebruik: node scripts/enrich-spotify-details.mjs INVOER.json [UITVOER.json]')
const deck = JSON.parse(await readFile(input, 'utf8'))
const cacheDirectory = '.private/spotify-embed-cache'
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))
const extract = (html, id) => {
  const match = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)
  if (!match) return null
  const data = JSON.parse(match[1])
  return {
    title: data.name,
    uri: `spotify:track:${id}`,
    releaseDate: { isoString: data.datePublished || '' },
    visualIdentity: { image: [{ url: html.match(/<meta property="og:image" content="([^"]+)"/)?.[1] || '' }] },
  }
}
const classify = (artist, year, title) => {
  const value = `${artist} ${title}`.toLowerCase()
  if (/metal|zeppelin|maiden|motörhead|whitesnake|aerosmith|stones|queen|springsteen|u2|chili peppers|nirvana|foo fighters/.test(value)) return 'rock'
  if (/disco|funk|chic|earth, wind|bee gees|donna summer/.test(value)) return 'disco'
  if (/soul|aretha|marvin gaye|stevie wonder|temptations/.test(value)) return 'soul'
  if (/tiësto|guetta|avicii|fisher|dance|remix|dj /.test(value)) return 'electronic'
  if (/andré hazes|andre hazes|guus meeuwis|de dijk|marco borsato|acda|nick & simon|goldband/.test(value)) return 'nederlands'
  return Number(year) < 1980 ? 'classic' : 'pop'
}
const entity = async id => {
  const cacheFile = join(cacheDirectory, `track-page-${id}.json`)
  try { return JSON.parse(await readFile(cacheFile, 'utf8')) } catch { /* Nog niet gecachet. */ }
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const response = await fetch(`https://open.spotify.com/track/${id}`)
    if (response.ok) {
      const result = extract(await response.text(), id)
      if (!result) throw new Error(`Geen publieke trackdetails voor ${id}`)
      await mkdir(cacheDirectory, { recursive: true })
      await writeFile(cacheFile, `${JSON.stringify(result)}\n`)
      await wait(120)
      return result
    }
    if (response.status !== 429) throw new Error(`${response.status} voor track/${id}`)
    const retryAfter = Number(response.headers.get('retry-after')) || 8 + attempt * 6
    console.log(`\nSpotify pauzeert; ${retryAfter}s wachten…`)
    await wait(retryAfter * 1000)
  }
  throw new Error(`Spotify blijft verzoeken begrenzen voor track/${id}`)
}

for (let index = 0; index < deck.tracks.length; index += 1) {
  const track = deck.tracks[index]
  const id = track.spotifyUri.split(':').pop()
  const detail = await entity(id)
  const year = detail.releaseDate?.isoString?.slice(0, 4) || track.year || ''
  const artist = detail.artists?.map(item => item.name).join(', ') || track.artist
  track.title = detail.title || track.title
  track.artist = artist
  track.year = year
  track.spotifyYear = year
  track.image = detail.visualIdentity?.image?.at(-1)?.url || track.image
  track.genre = classify(artist, year, track.title)
  track.tags = [...new Set([...(track.tags || []).filter(tag => !/^\d{4}s$/.test(tag)), `${Math.floor(Number(year) / 10) * 10}s`, track.genre])]
  track.yearSource = 'Spotify release; oorspronkelijke uitgave volgt waar nodig'
  if ((index + 1) % 10 === 0 || index === deck.tracks.length - 1) await writeFile(output, `${JSON.stringify(deck, null, 2)}\n`)
  process.stdout.write(`\r${index + 1}/${deck.tracks.length}`)
}
console.log(`\n${output} verrijkt`)
