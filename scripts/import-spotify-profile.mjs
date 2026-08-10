import { writeFile } from 'node:fs/promises'

const profile = process.argv[2]
const output = process.argv[3] || '/tmp/spotify-profile-edition.json'
if (!profile) throw new Error('Gebruik: node scripts/import-spotify-profile.mjs PROFIEL_URL [UITVOER.json]')

const extract = html => {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s)
  return match ? JSON.parse(match[1]).props.pageProps.state.data.entity : null
}
const fetchText = async url => {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${response.status} voor ${url}`)
  return response.text()
}
const profileHtml = await fetchText(profile)
const profileName = profileHtml.match(/<meta property="og:title" content="([^"]+)"/)?.[1] || 'Spotify-profiel'
const playlistIds = [...profileHtml.matchAll(/href="\/playlist\/([A-Za-z0-9]+)"/g)].map(match => match[1])
const uniquePlaylistIds = [...new Set(playlistIds)]
const sourceTracks = []

for (const playlistId of uniquePlaylistIds) {
  const playlist = extract(await fetchText(`https://open.spotify.com/embed/playlist/${playlistId}`))
  for (const track of playlist?.trackList || []) {
    if (track.entityType === 'track') sourceTracks.push({ ...track, playlist: playlist.name })
  }
}

const uniqueTracks = [...new Map(sourceTracks.map(track => [track.uri, track])).values()]
const details = new Array(uniqueTracks.length)
let cursor = 0
await Promise.all(Array.from({ length: 6 }, async () => {
  while (cursor < uniqueTracks.length) {
    const index = cursor++
    const source = uniqueTracks[index]
    const id = source.uri.split(':').pop()
    const detail = extract(await fetchText(`https://open.spotify.com/embed/track/${id}`))
    details[index] = {
      id: `profile-${String(index + 1).padStart(3, '0')}-${id.slice(0, 6)}`,
      title: detail.title,
      artist: detail.artists?.map(artist => artist.name).join(', ') || source.subtitle,
      year: detail.releaseDate?.isoString?.slice(0, 4) || '',
      album: '',
      image: detail.visualIdentity?.image?.at(-1)?.url || '',
      spotifyUri: detail.uri,
      externalUrl: `https://open.spotify.com/track/${id}`,
      audioUrl: '',
      genre: 'pop',
      tags: [source.playlist],
    }
    process.stdout.write(`\r${details.filter(Boolean).length}/${uniqueTracks.length}`)
  }
}))

await writeFile(output, `${JSON.stringify({
  id: `profile-${new URL(profile).pathname.split('/').pop()}`,
  name: `${profileName} · Hidden Corners`,
  recipient: profileName,
  source: profile,
  playlists: uniquePlaylistIds.length,
  tracks: details,
}, null, 2)}\n`)
console.log(`\n${output} geschreven`)
