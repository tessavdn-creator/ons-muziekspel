const TOKEN_KEY = 'giftster.spotify.token.v1'
const CLIENT_KEY = 'giftster.spotify.client-id'
const VERIFIER_KEY = 'giftster.spotify.verifier'
const STATE_KEY = 'giftster.spotify.state'
const OAUTH_CLIENT_KEY = 'giftster.spotify.oauth-client'
const RETURN_HASH_KEY = 'giftster.spotify.return-hash'
const DEFAULT_CLIENT_ID = '3cdd431703234d9081c53217dd1b3b2c'

const base64url = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

export const getClientId = () => {
  const saved = localStorage.getItem(CLIENT_KEY) || ''
  return /^[A-Za-z0-9]{32}$/.test(saved) ? saved : DEFAULT_CLIENT_ID
}
const readToken = () => {
  try { return JSON.parse(localStorage.getItem(TOKEN_KEY)) || {} } catch { return {} }
}
export const clearSpotifySession = () => localStorage.removeItem(TOKEN_KEY)
export const setClientId = id => {
  const candidate = id.trim()
  const next = /^[A-Za-z0-9]{32}$/.test(candidate) ? candidate : DEFAULT_CLIENT_ID
  const previous = getClientId()
  localStorage.setItem(CLIENT_KEY, next)
  if (previous && previous !== next) clearSpotifySession()
}
export const getToken = () => {
  const token = readToken()
  return token.clientId === getClientId() && token.expiresAt > Date.now() + 30000 ? token.accessToken : ''
}
export const hasSpotifySession = () => {
  const token = readToken()
  return token.clientId === getClientId() && Boolean(getToken() || token.refreshToken)
}

async function getAccessToken() {
  const current = getToken()
  if (current) return current
  const saved = readToken()
  if (!saved.refreshToken) throw new Error('Log opnieuw in bij Spotify.')
  if (saved.clientId && saved.clientId !== getClientId()) {
    clearSpotifySession()
    throw new Error('De Spotify Client ID is gewijzigd. Verbind Spotify opnieuw.')
  }
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token', refresh_token: saved.refreshToken, client_id: getClientId(),
    }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    if (data.error === 'invalid_grant') localStorage.removeItem(TOKEN_KEY)
    throw new Error(data.error === 'invalid_grant' ? 'Je Spotify-koppeling is verlopen. Verbind Spotify opnieuw.' : 'Spotify-token kon niet worden vernieuwd.')
  }
  const updated = {
    ...saved,
    clientId: getClientId(),
    accessToken: data.access_token,
    refreshToken: data.refresh_token || saved.refreshToken,
    expiresAt: Date.now() + data.expires_in * 1000,
  }
  localStorage.setItem(TOKEN_KEY, JSON.stringify(updated))
  return updated.accessToken
}

export async function loginSpotify() {
  const clientId = getClientId()
  if (!clientId) throw new Error('Vul eerst je Spotify Client ID in.')
  if (!/^[A-Za-z0-9]{32}$/.test(clientId)) throw new Error('Deze Spotify Client ID lijkt niet geldig.')
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(64)))
  const state = base64url(crypto.getRandomValues(new Uint8Array(24)))
  const challenge = base64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)))
  localStorage.setItem(VERIFIER_KEY, verifier)
  localStorage.setItem(STATE_KEY, state)
  localStorage.setItem(OAUTH_CLIENT_KEY, clientId)
  const activeRoom = new URLSearchParams(location.search).get('room')
  localStorage.setItem(RETURN_HASH_KEY, `${activeRoom ? `?room=${encodeURIComponent(activeRoom)}` : ''}${location.hash === '#admin' ? '#admin' : '#play'}`)
  const redirectUri = `${location.origin}${location.pathname}`
  const scopes = ['streaming', 'user-read-email', 'user-read-private', 'user-modify-playback-state', 'playlist-read-private']
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    state,
    scope: scopes.join(' '),
    show_dialog: 'false',
  })
  location.href = `https://accounts.spotify.com/authorize?${params}`
}

export async function finishSpotifyLogin() {
  const query = new URLSearchParams(location.search)
  const code = query.get('code')
  const verifier = localStorage.getItem(VERIFIER_KEY)
  const returnHash = localStorage.getItem(RETURN_HASH_KEY) || '#play'
  const oauthClientId = localStorage.getItem(OAUTH_CLIENT_KEY) || getClientId()
  const restoreRoute = () => history.replaceState({}, '', `${location.pathname}${returnHash}`)
  const clearOAuthState = () => {
    localStorage.removeItem(VERIFIER_KEY)
    localStorage.removeItem(STATE_KEY)
    localStorage.removeItem(OAUTH_CLIENT_KEY)
    localStorage.removeItem(RETURN_HASH_KEY)
  }
  if (query.get('error')) {
    restoreRoute()
    clearOAuthState()
    throw new Error(query.get('error') === 'access_denied' ? 'Spotify-koppeling is geannuleerd.' : `Spotify weigerde de koppeling (${query.get('error')}).`)
  }
  if (!code || !verifier) return false
  if (!query.get('state') || query.get('state') !== localStorage.getItem(STATE_KEY)) {
    restoreRoute()
    clearOAuthState()
    throw new Error('Spotify-login kon niet veilig worden gecontroleerd. Probeer opnieuw te verbinden.')
  }
  const body = new URLSearchParams({
    client_id: oauthClientId, grant_type: 'authorization_code', code,
    redirect_uri: `${location.origin}${location.pathname}`, code_verifier: verifier,
  })
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    clearSpotifySession()
    restoreRoute()
    clearOAuthState()
    throw new Error(data.error_description || (data.error === 'invalid_grant'
      ? 'De Spotify-login is verlopen. Probeer opnieuw te verbinden.'
      : `Spotify-login kon niet worden afgerond (${data.error || response.status}).`))
  }
  setClientId(oauthClientId)
  localStorage.setItem(TOKEN_KEY, JSON.stringify({
    clientId: oauthClientId,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    authorizedAt: Date.now(),
  }))
  clearOAuthState()
  restoreRoute()

  const profileResponse = await fetch('https://api.spotify.com/v1/me', {
    headers: { Authorization: `Bearer ${data.access_token}` },
  })
  const profile = await profileResponse.json().catch(() => ({}))
  if (!profileResponse.ok) {
    clearSpotifySession()
    if (profileResponse.status === 403) throw new Error('Dit Spotify-account heeft nog geen toegang. Voeg het account toe bij Spotify Developer Dashboard → Settings → Users Management.')
    if (profileResponse.status === 429) throw new Error('De Spotify-limiet is tijdelijk bereikt. Probeer het over een paar minuten opnieuw.')
    throw new Error(profile?.error?.message || `Spotify-accountcontrole gaf fout ${profileResponse.status}.`)
  }
  if (profile.product && profile.product !== 'premium') {
    clearSpotifySession()
    throw new Error('Voor afspelen in TRACKBACK is een Spotify Premium-account nodig.')
  }
  return true
}

async function spotifyFetch(path, options = {}) {
  const token = await getAccessToken()
  const response = await fetch(`https://api.spotify.com/v1${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers },
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    const message = payload?.error?.message
    const reason = payload?.error?.reason
    if (response.status === 401) {
      clearSpotifySession()
      throw new Error('Je Spotify-koppeling is verlopen. Verbind Spotify opnieuw.')
    }
    if (response.status === 403) throw new Error('Dit Spotify-account is niet toegelaten voor deze app of heeft geen Premium.')
    if (response.status === 429) throw new Error(reason === 'QUOTA_EXCEEDED' ? 'De Spotify-daglimiet voor deze ontwikkelapp is bereikt.' : 'Spotify krijgt te veel verzoeken. Probeer het zo opnieuw.')
    throw new Error(message || `Spotify gaf fout ${response.status}.`)
  }
  return response.status === 204 ? null : response.json()
}

export function playlistIdFrom(value) {
  return value.match(/playlist[/:]([A-Za-z0-9]+)/)?.[1] || (value.match(/^[A-Za-z0-9]{22}$/) ? value : '')
}

export async function importPlaylist(value) {
  const id = playlistIdFrom(value)
  if (!id) throw new Error('Dit lijkt niet op een Spotify-playlistlink.')
  const info = await spotifyFetch(`/playlists/${id}`)
  let url = `/playlists/${id}/items?limit=50&offset=0`
  const items = []
  while (url) {
    const page = await spotifyFetch(url.replace('https://api.spotify.com/v1', ''))
    items.push(...page.items)
    url = page.next
  }
  return {
    name: info.name,
    tracks: items.map(row => row.item || row.track).filter(Boolean).map(track => ({
      title: track.name,
      artist: track.artists?.map(a => a.name).join(', ') || '',
      year: track.album?.release_date?.slice(0, 4) || '',
      album: track.album?.name || '',
      image: track.album?.images?.[0]?.url || '',
      spotifyUri: track.uri,
      externalUrl: track.external_urls?.spotify || '',
    })),
  }
}

export async function searchSpotifyPlaylists(query) {
  const value = query.trim()
  if (value.length < 2) return []
  const directId = playlistIdFrom(value)
  const data = directId
    ? { playlists: { items: [await spotifyFetch(`/playlists/${directId}`)] } }
    : await spotifyFetch(`/search?q=${encodeURIComponent(value)}&type=playlist&limit=12`)
  const normalizedQuery = cleanSearchValue(value)
  return (data.playlists?.items || []).filter(Boolean).map(playlist => ({
    id: playlist.id,
    name: playlist.name,
    description: playlist.description || '',
    owner: playlist.owner?.display_name || 'Spotify',
    image: playlist.images?.[0]?.url || '',
    uri: playlist.uri || `spotify:playlist:${playlist.id}`,
    total: playlist.items?.total ?? playlist.tracks?.total ?? 0,
    externalUrl: playlist.external_urls?.spotify || `https://open.spotify.com/playlist/${playlist.id}`,
  })).sort((left, right) => playlistRelevance(right, normalizedQuery) - playlistRelevance(left, normalizedQuery))
}

const cleanSearchValue = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
const playlistRelevance = (playlist, query) => {
  const name = cleanSearchValue(playlist.name)
  if (!query) return 0
  if (name === query) return 100
  if (name.startsWith(query)) return 60
  if (name.includes(query)) return 30
  return query.split(' ').filter(word => word.length > 1 && name.includes(word)).length
}

export async function getSpotifyPlaylistAnchors(playlist) {
  const id = playlist?.id || playlistIdFrom(playlist?.uri || '')
  if (!id) throw new Error('Deze playlist kan niet worden voorbereid.')
  const total = Math.max(0, Number(playlist.total) || 0)
  const limit = Math.min(50, Math.max(10, total || 10))
  const offset = total > limit ? Math.floor(Math.random() * (total - limit + 1)) : 0
  const page = await spotifyFetch(`/playlists/${id}/items?limit=${limit}&offset=${offset}`)
  const tracks = (page.items || []).map(row => row.item || row.track).filter(Boolean).map(track => ({
    id: track.id || track.uri || '', title: track.name || '',
    artist: track.artists?.map(artist => artist.name).join(', ') || '',
    year: track.album?.release_date?.slice(0, 4) || '', image: track.album?.images?.[0]?.url || '',
  })).filter(track => /^\d{4}$/.test(track.year))
  const unique = [...new Map(tracks.map(track => [`${track.year}-${track.id}`, track])).values()]
  if (unique.length < 2) throw new Error('Deze playlist bevat te weinig nummers met een bekend jaartal.')
  const shuffled = unique.sort(() => Math.random() - 0.5).slice(0, 2)
  return shuffled.sort((a, b) => Number(a.year) - Number(b.year))
}

let player
let deviceId
let sdkPromise
let connectPromise
let activationPromise
let stateReporter

const friendlyPlayerError = message => {
  if (/premium|account/i.test(message || '')) return 'Voor afspelen is een toegestaan Spotify Premium-account nodig.'
  if (/auth|token/i.test(message || '')) return 'De Spotify-koppeling is verlopen. Verbind Spotify opnieuw.'
  return message || 'Spotify kon dit nummer niet afspelen.'
}

async function loadSpotifySdk() {
  if (window.Spotify) return window.Spotify
  if (!sdkPromise) {
    sdkPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Spotify-speler laden duurt te lang. Controleer je internetverbinding.')), 15000)
      window.onSpotifyWebPlaybackSDKReady = () => { clearTimeout(timeout); resolve(window.Spotify) }
      let script = document.querySelector('script[src="https://sdk.scdn.co/spotify-player.js"]')
      if (!script) {
        script = document.createElement('script')
        script.src = 'https://sdk.scdn.co/spotify-player.js'
        script.async = true
        document.head.appendChild(script)
      }
      script.addEventListener('error', () => { clearTimeout(timeout); reject(new Error('Spotify-speler kon niet laden.')) }, { once: true })
    })
  }
  return sdkPromise
}

const waitForDevice = async () => {
  for (let tries = 0; !deviceId && tries < 100; tries += 1) await new Promise(resolve => setTimeout(resolve, 150))
  if (!deviceId) throw new Error('Spotify reageert niet. Sluit andere Spotify-tabbladen en probeer opnieuw.')
  return deviceId
}

export async function prepareSpotifyPlayer(onState) {
  stateReporter = onState || stateReporter
  await getAccessToken()
  await loadSpotifySdk()
  if (!player) {
    player = new window.Spotify.Player({
      name: 'TRACKBACK',
      getOAuthToken: callback => getAccessToken().then(callback).catch(error => stateReporter?.({ error: error.message })),
      volume: 0.8,
    })
    player.addListener('ready', event => { deviceId = event.device_id; stateReporter?.({ ready: true }) })
    player.addListener('not_ready', () => { deviceId = undefined; stateReporter?.({ error: 'Spotify is even niet bereikbaar. Probeer opnieuw.' }) })
    player.addListener('player_state_changed', state => stateReporter?.(state))
    const reportError = event => stateReporter?.({ error: friendlyPlayerError(event.message) })
    player.addListener('authentication_error', reportError)
    player.addListener('account_error', reportError)
    player.addListener('initialization_error', reportError)
    player.addListener('playback_error', reportError)
  }
  if (!connectPromise) {
    connectPromise = player.connect().then(connected => {
      if (!connected) throw new Error('Spotify-speler kon geen verbinding maken.')
      return connected
    }).catch(error => { connectPromise = undefined; throw error })
  }
  await connectPromise
  return waitForDevice()
}

export function activateSpotifyElement() {
  if (!player) return null
  activationPromise = player.activateElement()
  return activationPromise
}

export async function playSpotify(uri, onState) {
  const id = await prepareSpotifyPlayer(onState)
  if (activationPromise) await activationPromise
  else await player.activateElement()
  await spotifyFetch(`/me/player/play?device_id=${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify({ uris: [uri] }) })
  await new Promise(resolve => setTimeout(resolve, 350))
  const state = await player.getCurrentState().catch(() => null)
  if (state?.paused) await player.resume()
}

const playbackTrack = async (state, playlist) => {
  const current = state?.track_window?.current_track
  if (!current?.id || current.type !== 'track') return null
  const detail = await spotifyFetch(`/tracks/${current.id}`)
  return {
    id: `playlist-${current.id}-${Date.now()}`,
    title: detail.name || current.name,
    artist: detail.artists?.map(artist => artist.name).join(', ') || current.artists?.map(artist => artist.name).join(', ') || '',
    year: detail.album?.release_date?.slice(0, 4) || '',
    album: detail.album?.name || current.album?.name || '',
    image: detail.album?.images?.[0]?.url || current.album?.images?.[0]?.url || '',
    spotifyUri: detail.uri || current.uri,
    externalUrl: detail.external_urls?.spotify || '',
    genre: 'pop',
    playlistName: playlist?.name || '',
  }
}

const waitForPlaylistTrack = async (previousUri, playlist) => {
  for (let tries = 0; tries < 30; tries += 1) {
    const state = await player?.getCurrentState().catch(() => null)
    const currentUri = state?.track_window?.current_track?.uri
    if (currentUri && currentUri !== previousUri) {
      const track = await playbackTrack(state, playlist)
      if (track) return track
    }
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  throw new Error('Spotify kon geen nummer uit deze playlist starten. Probeer een andere playlist.')
}

export async function startSpotifyPlaylist(playlist, onState) {
  const id = await prepareSpotifyPlayer(onState)
  if (activationPromise) await activationPromise
  else await player.activateElement()
  const previousState = await player.getCurrentState().catch(() => null)
  const previousUri = previousState?.track_window?.current_track?.uri || ''
  const total = Number(playlist.total) || 0
  const offset = total > 1 ? { position: Math.floor(Math.random() * total) } : undefined
  await spotifyFetch(`/me/player/play?device_id=${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify({ context_uri: playlist.uri, ...(offset ? { offset } : {}) }),
  })
  return waitForPlaylistTrack(previousUri, playlist)
}

export async function nextSpotifyPlaylistTrack(previousUri, playlist, onState) {
  const id = await prepareSpotifyPlayer(onState)
  await spotifyFetch(`/me/player/next?device_id=${encodeURIComponent(id)}`, { method: 'POST' })
  return waitForPlaylistTrack(previousUri, playlist)
}

export async function resumeSpotify() {
  if (!player) await prepareSpotifyPlayer()
  await player.resume()
}

export async function pauseSpotify() {
  if (player) await player.pause()
}
