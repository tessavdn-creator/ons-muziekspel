import { describe, expect, it } from 'vitest'
import { webcrypto } from 'node:crypto'
import { decodeCard, encodeCard, normalizeTrack, parseCsv } from './collection.js'
import { playlistIdFrom } from './spotify.js'

if (!globalThis.crypto) Object.defineProperty(globalThis, 'crypto', { value: webcrypto })

describe('CSV import', () => {
  it('leest quoted komma’s en Spotify-links', () => {
    const [track] = parseCsv('Title,Artist,Year,Spotify URL\n"Song, Part 2",Blur,1997,https://open.spotify.com/track/abc123')
    expect(track).toMatchObject({ title: 'Song, Part 2', artist: 'Blur', year: '1997', spotifyUri: 'spotify:track:abc123' })
  })

  it('maakt van een handmatige Spotify-link een interne track-URI', () => {
    expect(normalizeTrack({ title: 'Test', artist: 'Test', externalUrl: 'https://open.spotify.com/track/abc123?si=xyz' }).spotifyUri).toBe('spotify:track:abc123')
  })
})

describe('Spotify playlist links', () => {
  it('haalt het id uit URL en URI', () => {
    expect(playlistIdFrom('https://open.spotify.com/playlist/37i9dQZF1DX')).toBe('37i9dQZF1DX')
    expect(playlistIdFrom('spotify:playlist:37i9dQZF1DX')).toBe('37i9dQZF1DX')
  })
})

describe('zelfstandige speelkaarten', () => {
  it('bewaart unicode metadata, Spotify URI en publieke Client ID', () => {
    const original = normalizeTrack({ id: 'kaart-1', title: 'Alors on danse', artist: 'Stromae & Zoë', year: '2009', spotifyUri: 'spotify:track:abc', genre: 'electronic' })
    const result = decodeCard(encodeCard(original, 'public-client-id'))
    expect(result.track).toMatchObject({ id: 'kaart-1', title: 'Alors on danse', artist: 'Stromae & Zoë', year: '2009', spotifyUri: 'spotify:track:abc', genre: 'electronic' })
    expect(result.clientId).toBe('public-client-id')
  })

  it('blijft eerder geprinte ongecomprimeerde kaarten lezen', () => {
    const oldData = { v: 1, i: 'oud', s: 'spotify:track:oud', t: 'Oude kaart', a: 'Artiest', y: '1988', l: '', c: '' }
    const legacy = btoa(JSON.stringify(oldData)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    expect(decodeCard(legacy)?.track).toMatchObject({ id: 'oud', title: 'Oude kaart', year: '1988' })
  })
})
