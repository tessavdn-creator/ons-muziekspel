import { initializeApp } from 'firebase/app'
import { getAuth, onAuthStateChanged, signInAnonymously } from 'firebase/auth'
import { getDatabase, onDisconnect, onValue, push, ref, remove, runTransaction, set, update } from 'firebase/database'

const firebaseConfig = {
  apiKey: 'AIzaSyA9htxxipwhQ46Te7Xrce3uYoOBP3kThnY',
  authDomain: 'trackback-game-private.firebaseapp.com',
  databaseURL: 'https://trackback-game-private-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'trackback-game-private',
  appId: '1:111665030211:web:cceb6e1c56fceeb13de0f6',
  messagingSenderId: '111665030211',
}

const app = initializeApp(firebaseConfig)
const auth = getAuth(app)
const database = getDatabase(app)

const snapshotValue = snapshot => snapshot.exists() ? snapshot.val() : null
const roomCode = () => Math.random().toString(36).slice(2, 8).toUpperCase()
const safeName = value => String(value || '').trim().slice(0, 24) || 'Speler'

export const roomIdFromUrl = () => new URLSearchParams(location.search).get('room') || ''

export const buildRoomInviteUrl = (baseUrl, roomId) => {
  const url = new URL(baseUrl)
  url.searchParams.delete('card')
  url.searchParams.delete('resetSpotify')
  url.searchParams.set('room', roomId)
  url.hash = 'play'
  return url.toString()
}

export const roomInviteUrl = roomId => buildRoomInviteUrl(location.href, roomId)

export const ensureRoomUser = async () => {
  if (auth.currentUser) return auth.currentUser
  await signInAnonymously(auth)
  if (auth.currentUser) return auth.currentUser
  return new Promise((resolve, reject) => {
    const stop = onAuthStateChanged(auth, user => {
      if (!user) return
      stop()
      resolve(user)
    }, reject)
  })
}

export const createRoom = async ({ hostName = 'Spelleider', maxPlayers = 2 } = {}) => {
  const user = await ensureRoomUser()
  const room = push(ref(database, 'rooms'))
  const now = Date.now()
  await set(ref(database, `rooms/${room.key}/public`), {
    code: roomCode(), hostUid: user.uid, maxPlayers, round: 1, status: 'lobby',
    revealed: false, createdAt: now, expiresAt: now + 24 * 60 * 60 * 1000,
  })
  await set(ref(database, `rooms/${room.key}/players/${user.uid}`), {
    name: safeName(hostName), role: 'host', ready: false, score: 0, online: true, joinedAt: now,
  })
  return room.key
}

export const joinRoom = async (roomId, name) => {
  const user = await ensureRoomUser()
  const playerRef = ref(database, `rooms/${roomId}/players/${user.uid}`)
  await update(playerRef, { name: safeName(name), role: 'guest', ready: false, online: true, joinedAt: Date.now() })
  await runTransaction(ref(database, `rooms/${roomId}/players/${user.uid}/score`), score => score ?? 0)
  await onDisconnect(playerRef).update({ online: false, lastSeen: Date.now() })
  return user.uid
}

export const reconnectRoom = async roomId => {
  const user = await ensureRoomUser()
  const playerRef = ref(database, `rooms/${roomId}/players/${user.uid}`)
  await update(playerRef, { online: true, lastSeen: Date.now() })
  await onDisconnect(playerRef).update({ online: false, lastSeen: Date.now() })
}

export const subscribeRoomPublic = (roomId, callback) => onValue(ref(database, `rooms/${roomId}/public`), snapshot => callback(snapshotValue(snapshot)))
export const subscribeRoomPlayers = (roomId, callback) => onValue(ref(database, `rooms/${roomId}/players`), snapshot => callback(snapshotValue(snapshot) || {}))
export const subscribeRoundAnswer = (roomId, round, callback) => onValue(ref(database, `rooms/${roomId}/rounds/${round}/answer`), snapshot => callback(snapshotValue(snapshot)))
export const subscribeRoundGuesses = (roomId, round, callback) => onValue(ref(database, `rooms/${roomId}/rounds/${round}/guesses`), snapshot => callback(snapshotValue(snapshot) || {}))
export const subscribeMyRoomGuess = (roomId, round, uid, callback) => onValue(ref(database, `rooms/${roomId}/rounds/${round}/guesses/${uid}`), snapshot => callback(snapshotValue(snapshot)))
export const subscribeRoundScores = (roomId, round, callback) => onValue(ref(database, `rooms/${roomId}/rounds/${round}/scores`), snapshot => callback(snapshotValue(snapshot) || {}))

export const currentRoomUid = () => auth.currentUser?.uid || ''

export const setRoomTrack = async (roomId, round, track) => {
  const answer = {
    id: track.id || '', title: track.title || '', artist: track.artist || '', year: track.year || '',
    album: track.album || '', image: track.image || '', spotifyUri: track.spotifyUri || '', audioUrl: track.audioUrl || '',
  }
  await update(ref(database, `rooms/${roomId}`), {
    [`rounds/${round}/answer`]: answer,
    [`public/status`]: 'guessing',
    [`public/revealed`]: false,
  })
}

export const submitRoomGuess = async (roomId, round, guess) => {
  const user = await ensureRoomUser()
  await set(ref(database, `rooms/${roomId}/rounds/${round}/guesses/${user.uid}`), {
    title: String(guess.title || '').slice(0, 100),
    artist: String(guess.artist || '').slice(0, 100),
    position: Math.max(0, Math.min(99, Number(guess.position) || 0)),
    locked: true,
    submittedAt: Date.now(),
  })
  await update(ref(database, `rooms/${roomId}/players/${user.uid}`), { ready: true })
}

export const revealRoom = roomId => update(ref(database, `rooms/${roomId}/public`), { status: 'revealed', revealed: true })

export const scoreRoomPlayer = async (roomId, round, uid, points) => {
  await set(ref(database, `rooms/${roomId}/rounds/${round}/scores/${uid}`), points)
  await runTransaction(ref(database, `rooms/${roomId}/players/${uid}/score`), score => (Number(score) || 0) + points)
}

export const nextRoomRound = async (roomId, round, players) => {
  const updates = { 'public/round': round + 1, 'public/status': 'lobby', 'public/revealed': false }
  Object.keys(players || {}).forEach(uid => { updates[`players/${uid}/ready`] = false })
  await update(ref(database, `rooms/${roomId}`), updates)
}

export const closeRoom = roomId => update(ref(database, `rooms/${roomId}/public`), { status: 'closed', expiresAt: Date.now() })
export const leaveRoom = async roomId => {
  const user = await ensureRoomUser()
  await remove(ref(database, `rooms/${roomId}/players/${user.uid}`))
}
