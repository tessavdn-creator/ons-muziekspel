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
  return token.expiresAt > Date.now() + 30000 ? token.accessToken : ''
}
export const hasSpotifySession = () => Boolean(getToken() || readToken().refreshToken)

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
  sessionStorage.setItem(VERIFIER_KEY, verifier)
  sessionStorage.setItem(STATE_KEY, state)
  sessionStorage.setItem(OAUTH_CLIENT_KEY, clientId)
  sessionStorage.setItem(RETURN_HASH_KEY, location.hash === '#admin' ? '#admin' : '#play')
  const redirectUri = `${location.origin}${location.pathname}`
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    state,
    scope: 'playlist-read-private streaming user-read-email user-read-private user-modify-playback-state',
  })
  location.href = `https://accounts.spotify.com/authorize?${params}`
}

export async function finishSpotifyLogin() {
  const query = new URLSearchParams(location.search)
  const code = query.get('code')
  const verifier = sessionStorage.getItem(VERIFIER_KEY)
  const returnHash = sessionStorage.getItem(RETURN_HASH_KEY) || '#play'
  const oauthClientId = sessionStorage.getItem(OAUTH_CLIENT_KEY) || getClientId()
  const restoreRoute = () => history.replaceState({}, '', `${location.pathname}${returnHash}`)
  const clearOAuthState = () => {
    sessionStorage.removeItem(VERIFIER_KEY)
    sessionStorage.removeItem(STATE_KEY)
    sessionStorage.removeItem(OAUTH_CLIENT_KEY)
    sessionStorage.removeItem(RETURN_HASH_KEY)
  }
  if (query.get('error')) {
    restoreRoute()
    clearOAuthState()
    throw new Error(query.get('error') === 'access_denied' ? 'Spotify-koppeling is geannuleerd.' : `Spotify weigerde de koppeling (${query.get('error')}).`)
  }
  if (!code || !verifier) return false
  if (!query.get('state') || query.get('state') !== sessionStorage.getItem(STATE_KEY)) {
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
  return value.match(/playlist[/:]([A-Za-z0-9]+)/)?.[1] || (value.match(/^[A-Za-z0-9]+$/) ? value : '')
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

let player
let deviceId
export async function connectPlayer(onState) {
  await getAccessToken()
  if (!window.Spotify) {
    await new Promise((resolve, reject) => {
      window.onSpotifyWebPlaybackSDKReady = resolve
      const script = document.createElement('script')
      script.src = 'https://sdk.scdn.co/spotify-player.js'
      script.onerror = () => reject(new Error('Spotify-speler kon niet laden.'))
      document.head.appendChild(script)
    })
  }
  if (!player) {
    player = new window.Spotify.Player({
      name: 'TRACKBACK',
      getOAuthToken: callback => getAccessToken().then(callback).catch(error => onState?.({ error: error.message })),
      volume: 0.8,
    })
    player.addListener('ready', event => { deviceId = event.device_id })
    player.addListener('player_state_changed', state => onState?.(state))
    player.addListener('authentication_error', event => onState?.({ error: event.message }))
    player.addListener('account_error', event => onState?.({ error: event.message }))
    player.addListener('initialization_error', event => onState?.({ error: event.message }))
    player.addListener('playback_error', event => onState?.({ error: event.message }))
    const connected = await player.connect()
    if (!connected) throw new Error('Spotify-speler kon geen verbinding maken.')
  }
  await player.activateElement()
  for (let tries = 0; !deviceId && tries < 20; tries += 1) await new Promise(resolve => setTimeout(resolve, 150))
  if (!deviceId) throw new Error('Spotify-speler werd niet op tijd actief.')
  return deviceId
}

export function activateSpotifyElement() {
  return player?.activateElement()
}

export async function playSpotify(uri, onState) {
  const id = await connectPlayer(onState)
  await spotifyFetch(`/me/player/play?device_id=${id}`, { method: 'PUT', body: JSON.stringify({ uris: [uri] }) })
}

export async function pauseSpotify() {
  if (player) await player.pause()
}
