export const STORAGE_KEY = 'giftster.collection.v1'

export const demoTracks = [
  { id: 'demo-dreams', title: 'Dreams', artist: 'The Cranberries', year: '1993', spotifyUri: 'spotify:track:0gEyKnHvgkrkBM6fbeHdwK', externalUrl: 'https://open.spotify.com/track/0gEyKnHvgkrkBM6fbeHdwK' },
  { id: 'demo-september', title: 'September', artist: 'Earth, Wind & Fire', year: '1978', spotifyUri: 'spotify:track:2grjqo0Frpf2okIBiifQKs', externalUrl: 'https://open.spotify.com/track/2grjqo0Frpf2okIBiifQKs' },
  { id: 'demo-dancing', title: 'Dancing Queen', artist: 'ABBA', year: '1976', spotifyUri: 'spotify:track:0GjEhVFGZW8afUYGChu3Rr', externalUrl: 'https://open.spotify.com/track/0GjEhVFGZW8afUYGChu3Rr' },
]

export function randomId() {
  const bytes = crypto.getRandomValues(new Uint8Array(9))
  return Array.from(bytes, byte => byte.toString(36).padStart(2, '0')).join('').slice(0, 14)
}

export function normalizeTrack(track) {
  const externalUrl = track.externalUrl || ''
  const spotifyId = externalUrl.match(/open\.spotify\.com\/track\/([A-Za-z0-9]+)/)?.[1]
  return {
    id: track.id || randomId(),
    title: String(track.title || '').trim(),
    artist: String(track.artist || '').trim(),
    year: String(track.year || '').slice(0, 4),
    album: String(track.album || '').trim(),
    image: track.image || '',
    spotifyUri: track.spotifyUri || (spotifyId ? `spotify:track:${spotifyId}` : ''),
    externalUrl,
    audioUrl: track.audioUrl || '',
    genre: track.genre || 'pop',
    tags: Array.isArray(track.tags) ? track.tags : [],
  }
}

export function loadCollection() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    if (saved?.tracks?.length) return saved
  } catch { /* start clean */ }
  return { name: 'Voor jou', tracks: demoTracks.map(normalizeTrack) }
}

export function saveCollection(collection) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(collection))
}

export function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean)
  if (!lines.length) return []
  const split = line => {
    const cells = []; let value = ''; let quoted = false
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i]
      if (char === '"' && line[i + 1] === '"') { value += '"'; i += 1 }
      else if (char === '"') quoted = !quoted
      else if (char === ',' && !quoted) { cells.push(value); value = '' }
      else value += char
    }
    cells.push(value)
    return cells.map(cell => cell.trim())
  }
  const headers = split(lines[0]).map(h => h.toLowerCase())
  return lines.slice(1).map(line => {
    const values = split(line)
    const get = (...names) => values[headers.findIndex(h => names.includes(h))] || ''
    const spotify = get('spotifyurl', 'spotify url', 'url', 'track uri', 'uri')
    return normalizeTrack({
      title: get('title', 'track name', 'track'),
      artist: get('artist', 'artist name'),
      year: get('year', 'release year', 'released'),
      album: get('album', 'album name'),
      externalUrl: spotify.startsWith('http') ? spotify : '',
      spotifyUri: spotify.startsWith('spotify:') ? spotify : spotify.match(/track\/([\w]+)/)?.[1] ? `spotify:track:${spotify.match(/track\/([\w]+)/)[1]}` : '',
      audioUrl: get('audiourl', 'audio url', 'preview url'),
      genre: get('genre', 'stijl') || 'pop',
    })
  }).filter(track => track.title && track.artist)
}

export function exportCollection(collection) {
  const blob = new Blob([JSON.stringify(collection, null, 2)], { type: 'application/json' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${collection.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'muziekspel'}.json`
  link.click()
  URL.revokeObjectURL(link.href)
}

export function encodeCard(track, clientId = '') {
  const payload = JSON.stringify({
    v: 1,
    i: track.id,
    s: track.spotifyUri,
    t: track.title,
    a: track.artist,
    y: track.year,
    l: track.album,
    c: clientId,
    g: track.genre || 'pop',
    x: track.tags || [],
  })
  const bytes = compressSync(strToU8(payload), { level: 9 })
  let binary = ''
  bytes.forEach(byte => { binary += String.fromCharCode(byte) })
  return `z${btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`
}

export function decodeCard(value) {
  try {
    const compressed = value.startsWith('z')
    const encoded = compressed ? value.slice(1) : value
    const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/')
    const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='))
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0))
    const data = JSON.parse(compressed ? strFromU8(decompressSync(bytes)) : new TextDecoder().decode(bytes))
    if (data.v !== 1 || !data.i || !data.t || !data.a) return null
    return {
      track: normalizeTrack({ id: data.i, spotifyUri: data.s, title: data.t, artist: data.a, year: data.y, album: data.l, genre: data.g, tags: data.x }),
      clientId: data.c || '',
    }
  } catch { return null }
}
import { compressSync, decompressSync, strToU8, strFromU8 } from 'fflate'
