import { describe, expect, it } from 'vitest'
import { webcrypto } from 'node:crypto'
import { parseCsv } from './collection.js'
import { playlistIdFrom } from './spotify.js'

globalThis.crypto = webcrypto

describe('CSV import', () => {
  it('leest quoted komma’s en Spotify-links', () => {
    const [track] = parseCsv('Title,Artist,Year,Spotify URL\n"Song, Part 2",Blur,1997,https://open.spotify.com/track/abc123')
    expect(track).toMatchObject({ title: 'Song, Part 2', artist: 'Blur', year: '1997', spotifyUri: 'spotify:track:abc123' })
  })
})

describe('Spotify playlist links', () => {
  it('haalt het id uit URL en URI', () => {
    expect(playlistIdFrom('https://open.spotify.com/playlist/37i9dQZF1DX')).toBe('37i9dQZF1DX')
    expect(playlistIdFrom('spotify:playlist:37i9dQZF1DX')).toBe('37i9dQZF1DX')
  })
})
