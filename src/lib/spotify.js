const TOKEN_KEY = 'giftster.spotify.token.v1'
const CLIENT_KEY = 'giftster.spotify.client-id'
const VERIFIER_KEY = 'giftster.spotify.verifier'
const STATE_KEY = 'giftster.spotify.state'

const base64url = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

export const getClientId = () => localStorage.getItem(CLIENT_KEY) || ''
export const setClientId = id => localStorage.setItem(CLIENT_KEY, id.trim())
const readToken = () => {
  try { return JSON.parse(localStorage.getItem(TOKEN_KEY)) || {} } catch { return {} }
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
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(64)))
  const state = base64url(crypto.getRandomValues(new Uint8Array(24)))
  const challenge = base64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)))
  sessionStorage.setItem(VERIFIER_KEY, verifier)
  sessionStorage.setItem(STATE_KEY, state)
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
  if (query.get('error')) throw new Error('Spotify-koppeling is geannuleerd.')
  if (!code || !verifier) return false
  if (!query.get('state') || query.get('state') !== sessionStorage.getItem(STATE_KEY)) throw new Error('Spotify-login kon niet veilig worden gecontroleerd.')
  const body = new URLSearchParams({
    client_id: getClientId(), grant_type: 'authorization_code', code,
    redirect_uri: `${location.origin}${location.pathname}`, code_verifier: verifier,
  })
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body,
  })
  if (!response.ok) throw new Error('Spotify-login kon niet worden afgerond.')
  const data = await response.json()
  localStorage.setItem(TOKEN_KEY, JSON.stringify({
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    authorizedAt: Date.now(),
  }))
  sessionStorage.removeItem(VERIFIER_KEY)
  sessionStorage.removeItem(STATE_KEY)
  history.replaceState({}, '', location.pathname)
  return true
}

async function spotifyFetch(path, options = {}) {
  const token = await getAccessToken()
  const response = await fetch(`https://api.spotify.com/v1${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers },
  })
  if (!response.ok) {
    const message = (await response.json().catch(() => null))?.error?.message
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
      name: 'Ons muziekspel',
      getOAuthToken: callback => getAccessToken().then(callback).catch(error => onState?.({ error: error.message })),
      volume: 0.8,
    })
    player.addListener('ready', event => { deviceId = event.device_id })
    player.addListener('player_state_changed', state => onState?.(state))
    player.addListener('authentication_error', event => onState?.({ error: event.message }))
    player.addListener('account_error', event => onState?.({ error: event.message }))
    await player.connect()
    await player.activateElement()
  }
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
