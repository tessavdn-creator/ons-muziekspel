import { beforeEach, describe, expect, it, vi } from 'vitest'

const CLIENT_ID = '3cdd431703234d9081c53217dd1b3b2c'

class StorageMock {
  constructor() { this.values = new Map() }
  getItem(key) { return this.values.get(key) ?? null }
  setItem(key, value) { this.values.set(key, String(value)) }
  removeItem(key) { this.values.delete(key) }
}

describe('Spotify playback', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
    globalThis.localStorage = new StorageMock()
    globalThis.sessionStorage = new StorageMock()
    globalThis.window = {}
    globalThis.document = { querySelector: () => null, createElement: vi.fn(), head: { appendChild: vi.fn() } }
  })

  it('gebruikt automatisch de geldige standaard Client ID', async () => {
    const { getClientId, hasSpotifySession, setClientId } = await import('./spotify.js')
    expect(getClientId()).toBe(CLIENT_ID)
    localStorage.setItem('giftster.spotify.token.v1', JSON.stringify({ clientId: `${CLIENT_ID}6`, accessToken: 'oud', refreshToken: 'oud', expiresAt: Date.now() + 3600000 }))
    expect(hasSpotifySession()).toBe(false)
    setClientId(`${CLIENT_ID}6`)
    expect(getClientId()).toBe(CLIENT_ID)
  })

  it('bereidt de browserplayer voor en activeert hem vóór het afspeelverzoek', async () => {
    const calls = []
    let instance
    class PlayerMock {
      constructor() { this.listeners = {}; instance = this }
      addListener(name, callback) { this.listeners[name] = callback }
      async connect() { calls.push('connect'); this.listeners.ready({ device_id: 'phone-device' }); return true }
      activateElement() { calls.push('activate'); return Promise.resolve() }
      getCurrentState() { return Promise.resolve({ paused: true }) }
      resume() { calls.push('resume'); return Promise.resolve() }
      pause() { return Promise.resolve() }
    }
    window.Spotify = { Player: PlayerMock }
    localStorage.setItem('giftster.spotify.token.v1', JSON.stringify({
      clientId: CLIENT_ID,
      accessToken: 'test-token',
      refreshToken: 'refresh-token',
      expiresAt: Date.now() + 3600000,
    }))
    globalThis.fetch = vi.fn(async url => {
      calls.push(String(url).includes('/me/player/play') ? 'play-request' : 'fetch')
      return { ok: true, status: 204 }
    })

    const { activateSpotifyElement, playSpotify, prepareSpotifyPlayer } = await import('./spotify.js')
    await prepareSpotifyPlayer()
    const activation = activateSpotifyElement()
    expect(calls).toEqual(['connect', 'activate'])
    await activation
    await playSpotify('spotify:track:test')

    expect(instance).toBeTruthy()
    expect(calls).toEqual(['connect', 'activate', 'play-request', 'resume'])
    expect(fetch).toHaveBeenCalledWith(
      'https://api.spotify.com/v1/me/player/play?device_id=phone-device',
      expect.objectContaining({ method: 'PUT' }),
    )
  })

  it('zoekt Spotify-playlists en maakt compacte keuzeresultaten', async () => {
    localStorage.setItem('giftster.spotify.token.v1', JSON.stringify({
      clientId: CLIENT_ID,
      accessToken: 'test-token',
      refreshToken: 'refresh-token',
      expiresAt: Date.now() + 3600000,
    }))
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ playlists: { items: [{
        id: 'top2000', name: 'Top 2000', uri: 'spotify:playlist:top2000',
        owner: { display_name: 'NPO Radio 2' }, images: [{ url: 'https://image.example/top.jpg' }],
        items: { total: 2000 }, external_urls: { spotify: 'https://open.spotify.com/playlist/top2000' },
      }] } }),
    }))

    const { searchSpotifyPlaylists } = await import('./spotify.js')
    const playlists = await searchSpotifyPlaylists('Top 2000')

    expect(playlists[0]).toMatchObject({ name: 'Top 2000', owner: 'NPO Radio 2', total: 2000 })
    expect(fetch).toHaveBeenCalledWith(
      'https://api.spotify.com/v1/search?q=Top%202000&type=playlist&limit=10',
      expect.any(Object),
    )
  })

  it('laadt ook de privéplaylists van de ingelogde gebruiker', async () => {
    localStorage.setItem('giftster.spotify.token.v1', JSON.stringify({
      clientId: CLIENT_ID,
      accessToken: 'test-token',
      refreshToken: 'refresh-token',
      expiresAt: Date.now() + 3600000,
    }))
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ items: [{
        id: 'private-playlist-id', name: 'Vakantie geheim', public: false,
        owner: { display_name: 'Tessa' }, images: [], items: { total: 123 },
      }] }),
    }))

    const { getMySpotifyPlaylists } = await import('./spotify.js')
    const playlists = await getMySpotifyPlaylists()

    expect(playlists[0]).toMatchObject({ name: 'Vakantie geheim', public: false, owner: 'Tessa', total: 123 })
    expect(fetch).toHaveBeenCalledWith(
      'https://api.spotify.com/v1/me/playlists?limit=50&offset=0',
      expect.any(Object),
    )
  })
})
