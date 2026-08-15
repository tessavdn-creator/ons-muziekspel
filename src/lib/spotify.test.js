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
})
