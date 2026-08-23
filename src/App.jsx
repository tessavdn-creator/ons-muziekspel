import { useEffect, useMemo, useRef, useState } from 'react'
import { BrowserQRCodeReader } from '@zxing/browser'
import QRCode from 'qrcode'
import {
  ArrowLeft, Check, ChevronRight, Clock3, Download, ExternalLink,
  FileText, FileUp, Gift, Grid3X3, ImageUp, Import, Library, Mic2, Music2, Pause, Pencil, Play,
  Plus, Printer, QrCode, RotateCcw, ScanLine, Search, Settings, Sparkles, Trash2, Trophy, X,
  UserPlus, Users,
} from 'lucide-react'
import {
  clearCollection, decodeCard, encodeCard, exportCollection, loadCollection, normalizeTrack, parseCsv,
  randomId, saveCollection,
} from './lib/collection.js'
import {
  activateSpotifyElement, clearSpotifySession, finishSpotifyLogin, getClientId, hasSpotifySession,
  getMySpotifyPlaylists, getSpotifyPlaylistAnchors, importPlaylist, loginSpotify, nextSpotifyPlaylistTrack, pauseSpotify, playSpotify, preparePublicSpotifyPlaylist, prepareSpotifyPlayer,
  resumeSpotify, searchSpotifyPlaylists, setClientId, startSpotifyPlaylist,
} from './lib/spotify.js'
import { clearSavedGiftRefs, giftRefFromHash, loadGift } from './lib/gifts.js'
import { answerMatches, clampPlayerCount, DUO_SCORE_KEY, duoRoundPoints, freshDuoMatch, loadDuoMatch } from './lib/duo.js'
import {
  closeRoom, createRoom, currentRoomUid, ensureRoomUser, joinRoom, leaveRoom, nextRoomRound, reconnectRoom, revealRoom,
  roomIdFromUrl, roomInviteUrl, scoreRoomPlayer, setRoomDigitalTimeline, setRoomTrack, startRoomGuessDeadline, submitRoomGuess, subscribeMyRoomGuess,
  subscribeRoomPlayers, subscribeRoomPublic, subscribeRoundAnswer, subscribeRoundGuesses, subscribeRoundScores,
} from './lib/rooms.js'

const ADMIN_NAV = [
  { id: 'home', label: 'Overzicht', icon: Sparkles },
  { id: 'settings', label: 'Importeren', icon: Import },
  { id: 'collection', label: 'Muziek', icon: Library },
  { id: 'cards', label: 'Printen', icon: QrCode },
]
const APP_VERSION = '0.20.5 — VOLGEND NUMMER'
const GROUP_PLAYER_COUNT_KEY = 'trackback.group-player-count.v1'
const resetSpotifyRequested = new URLSearchParams(location.search).get('resetSpotify') === '1'
if (resetSpotifyRequested) {
  clearSpotifySession()
  ;['giftster.spotify.verifier', 'giftster.spotify.state', 'giftster.spotify.oauth-client', 'giftster.spotify.return-hash', 'giftster.pending-track'].forEach(key => sessionStorage.removeItem(key))
  history.replaceState({}, '', `${location.pathname}#play`)
}
const LEGACY_PRIVATE_EDITION_IDS = new Set(['hidden-corners-01', 'time-warp-01', 'after-dark-01'])
const IRIS_EDITION_IDS = new Set([...LEGACY_PRIVATE_EDITION_IDS, 'iris-crowd-pleasers-01'])
const loadCurrentCollection = () => {
  const loaded = loadCollection()
  if (IRIS_EDITION_IDS.has(loaded.id) && !loaded.gameModes?.includes('duo')) {
    const migrated = { ...loaded, gameModes: ['timeline', 'duo'] }
    saveCollection(migrated)
    return migrated
  }
  return loaded
}
const assetUrl = path => `${import.meta.env.BASE_URL}${path}`
const ARTIST_GIMMICKS = [
  { match: /little willie john/i, label: 'Little Willie John', image: 'assets/artists/iris/01-little-willie-john.png', kind: 'Artiest' },
  { match: /paul rodgers|\bfree\b/i, label: 'Paul Rodgers · Free', image: 'assets/artists/iris/02-paul-rodgers-free.png', kind: 'Artiest' },
  { match: /ry cooder/i, label: 'Ry Cooder', image: 'assets/artists/iris/03-ry-cooder.png', kind: 'Artiest' },
  { match: /sidney bechet/i, label: 'Sidney Bechet', image: 'assets/artists/iris/04-sidney-bechet.png', kind: 'Artiest' },
  { match: /alvin lee|ten years after/i, label: 'Alvin Lee · Ten Years After', image: 'assets/artists/iris/05-alvin-lee-ten-years-after.png', kind: 'Artiest' },
  { match: /john mayall/i, label: 'John Mayall', image: 'assets/artists/iris/06-john-mayall.png', kind: 'Artiest' },
  { match: /hildegard von bingen/i, label: 'Hildegard von Bingen', image: 'assets/artists/iris/07-hildegard-von-bingen.png', kind: 'Artiest' },
  { match: /le trio joubran/i, label: 'Le Trio Joubran', image: 'assets/artists/iris/08-le-trio-joubran.png', kind: 'Artiest' },
  { match: /elvis presley/i, label: 'Elvis Presley', image: 'assets/artists/retro/01-elvis-presley.png', kind: 'Artiest' },
  { match: /aretha franklin/i, label: 'Aretha Franklin', image: 'assets/artists/retro/02-aretha-franklin.png', kind: 'Artiest' },
  { match: /diana ross/i, label: 'Diana Ross', image: 'assets/artists/retro/03-diana-ross.png', kind: 'Artiest' },
  { match: /david bowie/i, label: 'David Bowie', image: 'assets/artists/retro/04-david-bowie.png', kind: 'Artiest' },
  { match: /michael jackson/i, label: 'Michael Jackson', image: 'assets/artists/retro/05-michael-jackson.png', kind: 'Artiest' },
  { match: /kurt cobain|nirvana/i, label: 'Kurt Cobain · Nirvana', image: 'assets/artists/retro/06-kurt-cobain.png', kind: 'Artiest' },
  { match: /britney spears/i, label: 'Britney Spears', image: 'assets/artists/retro/07-britney-spears.png', kind: 'Artiest' },
  { match: /daft punk/i, label: 'Daft Punk', image: 'assets/artists/retro/08-daft-punk.png', kind: 'Artiest' },
  { match: /freddie mercury|\bqueen\b/i, label: 'Freddie Mercury · Queen', image: 'assets/artists/lineup/01-freddie-mercury.png', kind: 'Artiest' },
  { match: /chris martin|coldplay/i, label: 'Chris Martin · Coldplay', image: 'assets/artists/lineup/02-chris-martin.png', kind: 'Artiest' },
  { match: /stevie nicks|fleetwood mac/i, label: 'Stevie Nicks · Fleetwood Mac', image: 'assets/artists/lineup/03-stevie-nicks.png', kind: 'Artiest' },
  { match: /eddie vedder|pearl jam/i, label: 'Eddie Vedder · Pearl Jam', image: 'assets/artists/lineup/04-eddie-vedder.png', kind: 'Artiest' },
  { match: /c[eé]line dion/i, label: 'Céline Dion', image: 'assets/artists/lineup/05-celine-dion.png', kind: 'Artiest' },
  { match: /mariah carey/i, label: 'Mariah Carey', image: 'assets/artists/lineup/06-mariah-carey.png', kind: 'Artiest' },
  { match: /whitney houston/i, label: 'Whitney Houston', image: 'assets/artists/lineup/07-whitney-houston.png', kind: 'Artiest' },
  { match: /shania twain/i, label: 'Shania Twain', image: 'assets/artists/lineup/08-shania-twain.png', kind: 'Artiest' },
  { match: /lady gaga/i, label: 'Lady Gaga', image: 'assets/artists/lineup/09-lady-gaga.png', kind: 'Artiest' },
  { match: /rihanna/i, label: 'Rihanna', image: 'assets/artists/lineup/10-rihanna.png', kind: 'Artiest' },
  { match: /\bp!nk\b|\bpink\b/i, label: 'P!nk', image: 'assets/artists/lineup/11-pink.png', kind: 'Artiest' },
  { match: /elton john/i, label: 'Elton John', image: 'assets/artists/lineup/12-elton-john.png', kind: 'Artiest' },
  { match: /kiya tabassian/i, label: 'Kiya Tabassian', image: 'assets/artists/lineup/13-kiya-tabassian.png', kind: 'Artiest' },
  { match: /ablaye cissoko/i, label: 'Ablaye Cissoko', image: 'assets/artists/lineup/14-ablaye-cissoko.png', kind: 'Artiest' },
  { match: /florent h[eé]au/i, label: 'Florent Héau', image: 'assets/artists/lineup/15-florent-heau.png', kind: 'Artiest' },
]
const EDITION_LINEUPS = {
  'hidden-corners-01': [ARTIST_GIMMICKS[0], ARTIST_GIMMICKS[2], ARTIST_GIMMICKS[3], ARTIST_GIMMICKS[30]],
  'time-warp-01': [ARTIST_GIMMICKS[6], ARTIST_GIMMICKS[1], ARTIST_GIMMICKS[2], ARTIST_GIMMICKS[5]],
  'after-dark-01': [ARTIST_GIMMICKS[7], ARTIST_GIMMICKS[28], ARTIST_GIMMICKS[29], ARTIST_GIMMICKS[30]],
  'iris-crowd-pleasers-01': [ARTIST_GIMMICKS[16], ARTIST_GIMMICKS[17], ARTIST_GIMMICKS[18], ARTIST_GIMMICKS[19]],
  'nikki-full-throttle-01': [ARTIST_GIMMICKS[11], ARTIST_GIMMICKS[24], ARTIST_GIMMICKS[25], ARTIST_GIMMICKS[26]],
  'guilty-pleasures': [ARTIST_GIMMICKS[20], ARTIST_GIMMICKS[21], ARTIST_GIMMICKS[22], ARTIST_GIMMICKS[23]],
}
const artistGimmick = track => ARTIST_GIMMICKS.find(gimmick => gimmick.match.test(track?.artist || ''))
const GAME_MODES = [
  { id: 'timeline', name: 'Tijdlijn', text: 'Leg de hit op de juiste plek in de tijd.', type: 'favoriet', meta: '2–10 spelers · ±30 min', icon: Clock3, setup: 'Geef iedere speler één kaart met het jaartal zichtbaar als start van de tijdlijn.', prompt: 'Leg de kaart eerst in je tijdlijn. Onthul pas als iedereen heeft gekozen.', steps: ['Scan en speel de verborgen hit', 'Leg de kaart vóór, na of tussen je eerdere hits', 'Onthul het jaar en controleer de plek'], score: 'Goed geplaatst? Houd de kaart. De eerste met 10 kaarten wint.' },
  { id: 'duo', name: 'Samen', text: 'Eén gezamenlijke tijdlijn, iedereen een eigen gok en score.', type: 'duo', meta: '2–6 spelers · met of zonder kaarten', icon: Users, setup: 'Kies eerst: volledig digitaal zonder kaarten, of spelen met jullie geprinte kaarten.', prompt: 'Iedereen vergrendelt op de eigen telefoon een geheime gok en kiest een plek in de gezamenlijke tijdlijn.', steps: ['Maak een kamer en deel de QR-code', 'Start digitaal een playlist of scan een kaart', 'Iedereen raadt, kiest een plek en zet de gok vast'], score: 'Juiste plek: 2 punten · artiest: 1 · titel: 1. Na 12 nummers wint de hoogste score.' },
  { id: 'guess', name: 'Raad de hit', text: 'Noem titel en artiest voordat je onthult.', type: 'favoriet', meta: '1–10 spelers · direct spelen', icon: Mic2, setup: 'Speel alleen, in teams of allemaal tegen elkaar. Spreek af wie het antwoord mag geven.', prompt: 'Vul je gok in of roep hem hardop. Onthul daarna pas het antwoord.', steps: ['Scan en luister zonder naar de kaart te kijken', 'Vul titel en artiest in', 'Onthul het antwoord en tel de punten'], score: '1 punt voor de titel + 1 punt voor de artiest.' },
  { id: 'bingo', name: 'Muziekbingo', text: 'Streep decennia, genres en verrassingen af.', type: 'groep', meta: '3+ spelers · bingokaarten nodig', icon: Grid3X3, setup: 'Geef iedere speler een andere geprinte bingokaart. De telefoon kan één digitale kaart bijhouden.', prompt: 'Luister goed en kijk na de onthulling welke vakken je mag afstrepen.', steps: ['Pak een geprinte of digitale bingokaart', 'Scan, luister en onthul het nummer', 'Streep ieder passend vak af'], score: 'Drie vakken op één horizontale, verticale of diagonale rij is bingo.' },
  { id: 'battle', name: 'Battle of the Hits', text: 'Stem samen welke hit doorgaat.', type: 'groep', meta: '3+ spelers · geen score nodig', icon: Trophy, setup: 'Geen kaarten verdelen en geen scoreformulier: kies alleen samen de beste hit.', prompt: 'Luister naar de uitdager. Na de onthulling stemt iedereen welke hit doorgaat.', steps: ['De eerste gescande hit wordt kampioen', 'Scan een nieuwe hit als uitdager', 'Iedereen stemt welke hit doorgaat'], score: 'De hit die aan het einde nog kampioen is, wint de avond.' },
]
const PRINT_GAME_MODES = GAME_MODES.filter(game => game.id !== 'duo')

const qrPromises = new Map()
const createQr = (value, size) => {
  const key = `${size}:${value}`
  if (!qrPromises.has(key)) qrPromises.set(key, QRCode.toDataURL(value, { width: size, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#050509', light: '#ffffff' } }))
  return qrPromises.get(key)
}

function CardQr({ value, size = 220 }) {
  const [src, setSrc] = useState('')
  useEffect(() => { createQr(value, size).then(setSrc) }, [value, size])
  return src ? <img className="qr-image" src={src} alt="QR-code" /> : <div className="qr-placeholder" />
}

function ScannerView({ onScan, onClose }) {
  const videoRef = useRef(null)
  const fileRef = useRef(null)
  const scanCallback = useRef(onScan)
  const scanned = useRef(false)
  const [error, setError] = useState('')
  useEffect(() => { scanCallback.current = onScan }, [onScan])
  useEffect(() => {
    const reader = new BrowserQRCodeReader()
    let controls
    reader.decodeFromConstraints({
      audio: false,
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
    }, videoRef.current, result => {
      if (result && !scanned.current) {
        scanned.current = true
        controls?.stop()
        scanCallback.current(result.getText())
      }
    }).then(value => { controls = value }).catch(() => setError('Camera kon niet starten. Geef cameratoegang en probeer opnieuw.'))
    return () => controls?.stop()
  }, [])
  const scanPhoto = async file => {
    if (!file) return
    setError('QR-code op de foto zoeken…')
    const url = URL.createObjectURL(file)
    try {
      const result = await new BrowserQRCodeReader().decodeFromImageUrl(url)
      scanCallback.current(result.getText())
    } catch { setError('Geen QR-code gevonden. Kies een scherpere foto met de hele code in beeld.') }
    finally { URL.revokeObjectURL(url) }
  }
  return <div className="scanner-screen">
    <button className="round-button scanner-close" onClick={onClose} aria-label="Sluiten"><X /></button>
    <div className="scanner-copy"><span>Richt op de kaart</span><small>De muziek blijft geheim</small></div>
    <video ref={videoRef} muted playsInline />
    <div className="scan-frame"><i /><i /><i /><i /><div className="scan-line" /></div>
    <button className="photo-scan-button" onClick={() => fileRef.current?.click()}><ImageUp /> Scan vanuit foto</button>
    <input ref={fileRef} hidden type="file" accept="image/*" onChange={event => scanPhoto(event.target.files?.[0])} />
    {error && <div className="toast error">{error}</div>}
  </div>
}

const BINGO_SPACES = [
  ['1960s', 'Jaren 60'], ['1970s', 'Jaren 70'], ['1980s', 'Jaren 80'], ['1990s', 'Jaren 90'], ['2000s', 'Jaren 00'], ['2010s', 'Jaren 10'],
  ['pop', 'Pop'], ['rock', 'Rock'], ['soul', 'Soul'], ['disco', 'Disco'], ['duet', 'Duet'], ['nederlands', 'Nederlands'],
  ['liefde', 'Liefde in titel'], ['classic', 'Klassieker'], ['multi', 'Meerdere artiesten'],
]
const shuffle = values => [...values].sort(() => Math.random() - .5)
const editionTheme = collection => {
  const value = `${collection.id || ''} ${collection.name || ''}`.toLowerCase()
  if (/hidden corners/.test(value)) return 'set-hidden'
  if (/crooked|time.warp/.test(value)) return 'set-timeline'
  if (/after dark/.test(value)) return 'set-after-dark'
  if (/top 2000|greatest hits|crowd pleasers/.test(value)) return 'set-crowd'
  if (/nikki|full throttle/.test(value)) return 'set-nikki'
  return 'set-original'
}

function GiftLanding({ gift, onSelect, onClose }) {
  const [celebrating, setCelebrating] = useState(true)
  const [publicEditions, setPublicEditions] = useState([])
  const [catalogLoading, setCatalogLoading] = useState(gift.showPublicEditions !== false)
  useEffect(() => {
    if (gift.showPublicEditions === false) {
      setCatalogLoading(false)
      return undefined
    }
    let active = true
    const loadCatalog = async () => {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}decks/index.json`, { cache: 'no-store' })
        if (!response.ok) throw new Error('catalogus niet beschikbaar')
        const catalog = await response.json()
        const editions = await Promise.all((catalog.editions || []).map(async entry => {
          const deckResponse = await fetch(`${import.meta.env.BASE_URL}decks/${entry.file}`, { cache: 'no-store' })
          if (!deckResponse.ok) throw new Error(`editie ${entry.file} niet beschikbaar`)
          return { ...await deckResponse.json(), ...entry }
        }))
        const privateIds = new Set(gift.editions.map(edition => edition.id))
        if (active) setPublicEditions(editions.filter(edition => !privateIds.has(edition.id)))
      } catch { /* De persoonlijke editie blijft ook zonder openbare catalogus bruikbaar. */ }
      finally { if (active) setCatalogLoading(false) }
    }
    loadCatalog()
    return () => { active = false }
  }, [gift])
  const editionGrid = (editions, fallbackSubtitle) => <div className="edition-grid">{editions.map((edition, index) => {
    const lineup = EDITION_LINEUPS[edition.id] || []
    return <article key={edition.id || edition.name}>
      <div className="edition-art">{edition.tracks?.[0]?.image ? <img src={edition.tracks[0].image} alt="" /> : <Music2 />}{lineup.length > 0 && <span className="edition-lineup">{lineup.map((artist, artistIndex) => <img key={artist.image} src={assetUrl(artist.image)} alt="" style={{ '--i': artistIndex }} />)}</span>}<b>{String(index + 1).padStart(2, '0')}</b></div>
      <div className="edition-copy"><span>{edition.subtitle || fallbackSubtitle}</span><h3>{edition.name}</h3><p>{edition.description}</p><small>{edition.tracks?.length || 0} nummers {edition.difficulty === 'expert' ? '· Expert' : ''}</small></div>
      <button className="primary-button" onClick={() => onSelect(edition)}>Kies editie <ChevronRight /></button>
    </article>
  })}</div>
  return <main className="gift-landing">
    {celebrating && <section className="gift-celebration" role="dialog" aria-modal="true" aria-labelledby="gift-congratulations">
      <div className="confetti" aria-hidden="true">{Array.from({ length: 36 }, (_, index) => <i key={index} style={{ '--i': index, '--x': `${(index * 29) % 100}%`, '--delay': `${(index % 11) * -.27}s`, '--duration': `${2.8 + (index % 7) * .25}s`, '--drift': `${index % 2 ? 25 : -20}px` }} />)}</div>
      <div className="celebration-glow" aria-hidden="true" />
      <div className="celebration-card">
        <img className="celebration-character" src={assetUrl(ARTIST_GIMMICKS[8].image)} alt="" />
        <span className="eyebrow">Een muzikale verrassing voor jou</span>
        <h1 id="gift-congratulations">Gefeliciteerd,<br />{gift.recipient}!</h1>
        <p>{gift.celebrationMessage || 'Je hebt je eigen TRACKBACK-editie gekregen. Een persoonlijk muziekspel, speciaal voor jou samengesteld.'}</p>
        <button className="celebration-button" onClick={() => setCelebrating(false)}>Pak je cadeau uit <Sparkles /></button>
        <small>Zet je geluid aan — hierna begint de muziek.</small>
      </div>
    </section>}
    <button className="round-button gift-close" onClick={onClose} aria-label="Terug"><ArrowLeft /></button>
    <div className="gift-stars" aria-hidden="true"><i /><i /><i /><i /><i /></div>
    <header><div className="gift-seal"><Gift /></div><strong className="gift-brand">TRACKBACK</strong><span className="eyebrow">Speciaal samengesteld voor</span><h1>{gift.recipient}</h1><p>{gift.message}</p></header>
    {gift.taste?.length > 0 && <div className="taste-tags">{gift.taste.map(tag => <span key={tag}>{tag}</span>)}</div>}
    <section className="edition-shelf"><div className="edition-heading"><div><span className="eyebrow">Alleen voor jou</span><h2>Persoonlijke edities</h2></div><small>{gift.editions.length} {gift.editions.length === 1 ? 'editie' : 'edities'}</small></div>
      {editionGrid(gift.editions, 'Persoonlijke mix')}
      <p className="edition-update"><Sparkles /> Nieuwe persoonlijke edities verschijnen automatisch achter dezelfde QR.</p>
    </section>
    {gift.showPublicEditions !== false && <section className="edition-shelf public-edition-shelf"><div className="edition-heading"><div><span className="eyebrow">Voor iedereen</span><h2>Algemene edities</h2></div><small>{catalogLoading ? 'Laden…' : `${publicEditions.length} ${publicEditions.length === 1 ? 'editie' : 'edities'}`}</small></div>
      {publicEditions.length > 0 ? editionGrid(publicEditions, 'TRACKBACK original') : !catalogLoading && <p className="catalog-empty">Er zijn nog geen algemene edities gepubliceerd.</p>}
      <p className="edition-update"><Library /> Nieuwe openbare edities komen automatisch in deze bibliotheek.</p>
    </section>}
  </main>
}

function BingoResult({ track }) {
  const [board] = useState(() => {
    const saved = JSON.parse(localStorage.getItem('timepop.bingo.board') || 'null')
    if (saved?.length === 9) return saved
    const created = shuffle(BINGO_SPACES).slice(0, 9)
    localStorage.setItem('timepop.bingo.board', JSON.stringify(created))
    return created
  })
  const [marked, setMarked] = useState(() => JSON.parse(localStorage.getItem('timepop.bingo.marked') || '[]'))
  const traits = new Set([...(track.tags || []), track.genre, `${Math.floor(Number(track.year) / 10) * 10}s`, ...(track.artist.includes(',') ? ['multi', 'duet'] : [])])
  useEffect(() => {
    const next = [...new Set([...marked, ...board.filter(([id]) => traits.has(id)).map(([id]) => id)])]
    setMarked(next); localStorage.setItem('timepop.bingo.marked', JSON.stringify(next))
  }, [track.id])
  return <div className="game-result bingo-result"><div className="result-heading"><Grid3X3 /><strong>Jouw bingokaart</strong><button onClick={() => { const next = shuffle(BINGO_SPACES).slice(0, 9); localStorage.setItem('timepop.bingo.board', JSON.stringify(next)); localStorage.removeItem('timepop.bingo.marked'); location.reload() }}>Nieuwe kaart</button></div><div className="bingo-grid">{board.map(([id, label]) => <span className={marked.includes(id) ? 'marked' : ''} key={id}>{marked.includes(id) && <Check />}{label}</span>)}</div></div>
}

function BattleResult({ track }) {
  const [champion, setChampion] = useState(() => JSON.parse(localStorage.getItem('timepop.battle.champion') || 'null'))
  const choose = winner => { localStorage.setItem('timepop.battle.champion', JSON.stringify(winner)); setChampion(winner) }
  const reset = () => { localStorage.removeItem('timepop.battle.champion'); setChampion(null) }
  if (!champion || champion.id === track.id) return <div className="game-result battle-result"><Trophy /><div><strong>{champion ? 'Regerend kampioen' : 'Start de battle'}</strong><span>{track.title}</span></div>{champion ? <button className="subtle-action" onClick={reset}>Nieuwe battle</button> : <button onClick={() => choose(track)}>Maak kampioen</button>}</div>
  return <div className="game-result"><div className="result-heading"><Trophy /><strong>Wie gaat door?</strong><button onClick={reset}>Opnieuw</button></div><div className="battle-buttons"><button onClick={() => choose(champion)}><small>Kampioen</small>{champion.title}<span>{champion.artist}</span></button><b>VS</b><button onClick={() => choose(track)}><small>Uitdager</small>{track.title}<span>{track.artist}</span></button></div></div>
}

function DuoGuessFields({ guesses, setGuesses }) {
  const update = (index, patch) => setGuesses(current => current.map((guess, guessIndex) => guessIndex === index ? { ...guess, ...patch } : guess))
  return <section className="duo-guesses" aria-label={`Geheime antwoorden voor ${guesses.length} spelers`}>
    <div className="duo-guess-heading"><Users /><div><strong>Iedereen geheim raden</strong><small>Geef de telefoon door en vergrendel je eigen antwoord.</small></div></div>
    {guesses.map((guess, index) => <article className={guess.locked ? 'is-locked' : ''} key={index}>
      <header><b>Speler {String.fromCharCode(65 + index)}</b>{guess.locked && <span><Check /> Vergrendeld</span>}</header>
      {guess.locked ? <p>Antwoord verborgen. Geef de telefoon aan de andere speler.</p> : <>
        <input value={guess.title} onChange={event => update(index, { title: event.target.value })} placeholder="Titel (mag leeg blijven)…" />
        <input value={guess.artist} onChange={event => update(index, { artist: event.target.value })} placeholder="Artiest (mag leeg blijven)…" />
        <button type="button" onClick={() => update(index, { locked: true })}><Check /> Vergrendel mijn gok</button>
      </>}
    </article>)}
    <p><Clock3 /> Leg daarna op 3–2–1 allemaal een fiche bij de gekozen plek in de gezamenlijke tijdlijn.</p>
  </section>
}

function DuoResult({ track, guesses }) {
  const [match, setMatch] = useState(() => loadDuoMatch(localStorage, guesses.length))
  const [checks, setChecks] = useState(() => guesses.map(guess => ({
    timeline: false,
    title: answerMatches(track.title, guess.title),
    artist: answerMatches(track.artist, guess.artist),
  })))
  const [saved, setSaved] = useState(false)
  const points = checks.map(duoRoundPoints)
  const toggle = (player, key) => !saved && setChecks(current => current.map((entry, index) => index === player ? { ...entry, [key]: !entry[key] } : entry))
  const saveRound = () => {
    if (saved) return
    const next = { rounds: match.rounds + 1, players: match.players.map((player, index) => ({ ...player, score: player.score + points[index] })) }
    localStorage.setItem(DUO_SCORE_KEY, JSON.stringify(next)); setMatch(next); setSaved(true)
  }
  const reset = () => {
    if (!confirm('De volledige score wissen en opnieuw beginnen?')) return
    const next = freshDuoMatch(guesses.length); localStorage.setItem(DUO_SCORE_KEY, JSON.stringify(next)); setMatch(next); setSaved(false)
  }
  return <section className="game-result duo-result">
    <div className="result-heading"><Users /><strong>TRACKBACK Samen</strong><button onClick={reset}>Nieuw spel</button></div>
    <p className="duo-result-help">Controleer de automatische gok en tik zelf aan of de plek in de tijdlijn goed was.</p>
    <div className="duo-score-grid">{match.players.map((player, index) => <article key={index}>
      <header><strong>{player.name}</strong><b>{saved ? match.players[index].score : match.players[index].score + points[index]} p</b></header>
      <small>Gok: {guesses[index].title || '—'} · {guesses[index].artist || '—'}</small>
      <div className="duo-checks">
        <button className={checks[index].timeline ? 'is-correct' : ''} aria-pressed={checks[index].timeline} onClick={() => toggle(index, 'timeline')}><Clock3 /> Tijdlijn +2</button>
        <button className={checks[index].artist ? 'is-correct' : ''} aria-pressed={checks[index].artist} onClick={() => toggle(index, 'artist')}><Mic2 /> Artiest +1</button>
        <button className={checks[index].title ? 'is-correct' : ''} aria-pressed={checks[index].title} onClick={() => toggle(index, 'title')}><Music2 /> Titel +1</button>
      </div>
    </article>)}</div>
    <button className="duo-save" disabled={saved} onClick={saveRound}>{saved ? <><Check /> Ronde {match.rounds} opgeslagen</> : <>Bewaar punten: {points.join(' · ')}</>}</button>
    <small className="duo-round-count">{match.rounds} van 12 rondes gespeeld</small>
  </section>
}

function Player({ track, onBack, onNext, gameMode, autoPlay = false, playlistMode = false, playerCount = 2 }) {
  const [revealed, setRevealed] = useState(false)
  const [playing, setPlaying] = useState(playlistMode)
  const spotifyTrack = Boolean(!track.audioUrl && track.spotifyUri)
  const [spotifyReady, setSpotifyReady] = useState(!spotifyTrack || !hasSpotifySession())
  const [spotifyPreparing, setSpotifyPreparing] = useState(false)
  const [message, setMessage] = useState(spotifyTrack && !hasSpotifySession() ? 'Koppel Spotify één keer om te luisteren' : 'Klaar om af te spelen')
  const [titleGuess, setTitleGuess] = useState('')
  const [artistGuess, setArtistGuess] = useState('')
  const [duoGuesses, setDuoGuesses] = useState(() => Array.from({ length: clampPlayerCount(playerCount) }, () => ({ title: '', artist: '', locked: false })))
  const audioRef = useRef(null)
  const autoStarted = useRef(false)
  const activeGame = GAME_MODES.find(game => game.id === gameMode) || GAME_MODES[0]
  const gimmick = artistGimmick(track)
  useEffect(() => {
    if (!spotifyTrack || !hasSpotifySession()) return undefined
    let active = true
    setSpotifyPreparing(true)
    setSpotifyReady(false)
    setMessage('Spotify-speler wordt klaargezet…')
    prepareSpotifyPlayer(state => {
      if (!active) return
      if (state?.error) { setMessage(state.error); setSpotifyPreparing(false); setSpotifyReady(false); setPlaying(false) }
      else if (state?.ready) { setMessage('Klaar om af te spelen'); setSpotifyPreparing(false); setSpotifyReady(true) }
      else if (typeof state?.paused === 'boolean') setPlaying(!state.paused)
    }).then(() => {
      if (active) { setSpotifyPreparing(false); setSpotifyReady(true); setMessage('Klaar om af te spelen') }
    }).catch(error => {
      if (active) { setSpotifyPreparing(false); setSpotifyReady(false); setMessage(error.message) }
    })
    return () => { active = false }
  }, [track?.id, spotifyTrack])
  useEffect(() => () => { audioRef.current?.pause(); if (!playlistMode) pauseSpotify().catch(() => {}) }, [track?.id, playlistMode])

  const start = async () => {
    const activation = activateSpotifyElement()
    try {
      setMessage('Muziek wordt gestart…')
      if (playlistMode) {
        await resumeSpotify()
      } else if (track.audioUrl) {
        audioRef.current = new Audio(track.audioUrl)
        audioRef.current.addEventListener('ended', () => setPlaying(false))
        await audioRef.current.play()
      } else if (track.spotifyUri && hasSpotifySession()) {
        if (spotifyPreparing) throw new Error('Spotify is nog aan het opstarten. Probeer het over een paar seconden opnieuw.')
        if (!spotifyReady) {
          setSpotifyPreparing(true)
          await prepareSpotifyPlayer(state => state?.error && setMessage(state.error))
          setSpotifyPreparing(false)
          setSpotifyReady(true)
        }
        const activeElement = activation || activateSpotifyElement()
        if (activeElement) await activeElement
        await playSpotify(track.spotifyUri, state => state?.error && setMessage(state.error))
      } else if (track.spotifyUri) {
        if (!getClientId()) throw new Error('Scan eerst een geprinte TRACKBACK-kaart om deze telefoon met Spotify in te stellen.')
        sessionStorage.setItem('giftster.pending-track', JSON.stringify(track))
        setMessage('Je wordt veilig met Spotify verbonden…')
        await loginSpotify()
        return
      } else throw new Error('Deze kaart heeft nog geen interne afspeelbron.')
      setPlaying(true)
      if (track.audioUrl || hasSpotifySession()) setMessage('Nu aan het spelen')
    } catch (error) { setMessage(error.message); setSpotifyPreparing(false); setPlaying(false) }
  }
  const pause = async () => {
    audioRef.current?.pause()
    await pauseSpotify().catch(() => {})
    setPlaying(false); setMessage('Gepauzeerd')
  }
  useEffect(() => {
    if (!autoPlay || autoStarted.current) return
    const canStart = Boolean(track.audioUrl || (spotifyTrack && hasSpotifySession() && spotifyReady && !spotifyPreparing))
    if (!canStart) return
    autoStarted.current = true
    start()
  }, [autoPlay, spotifyReady, spotifyPreparing, track?.id])
  return <main className={`player-screen mode-${gameMode} theme-${track.genre || 'pop'} ${revealed ? 'is-revealed' : ''}`}>
    <header className="player-header">
      <button className="round-button" onClick={onBack} aria-label="Terug naar scannen"><ArrowLeft /></button>
      <span>{activeGame.name}</span><span className="status-dot" />
    </header>
    {!revealed ? <>
      <div className="secret-art"><div className="record"><Music2 /><span /></div><div className="sound-wave">{[1,2,3,4,5,6,7].map(i => <i key={i} />)}</div></div>
      <div className="secret-copy"><span className="eyebrow">Geheim nummer</span><h1>Luister goed…</h1><p>{message}</p></div>
      <button className="play-or-pause" disabled={spotifyPreparing} onClick={playing ? pause : start} aria-label={playing ? 'Muziek pauzeren' : hasSpotifySession() ? 'Muziek afspelen' : 'Spotify koppelen en muziek afspelen'}>{playing ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}</button>
      <p className="round-prompt"><activeGame.icon /> {activeGame.prompt}</p>
      {gameMode === 'guess' && <div className="guess-fields"><input autoCorrect="off" value={titleGuess} onChange={event => setTitleGuess(event.target.value)} placeholder="Titel…" /><input autoCorrect="off" value={artistGuess} onChange={event => setArtistGuess(event.target.value)} placeholder="Artiest…" /><small>Een kleine spelfout mag. Bij meerdere artiesten is één juiste artiest genoeg.</small></div>}
      {gameMode === 'duo' && <DuoGuessFields guesses={duoGuesses} setGuesses={setDuoGuesses} />}
      <button className="reveal-button" disabled={gameMode === 'duo' && !duoGuesses.every(guess => guess.locked)} onClick={() => setRevealed(true)}><Sparkles /> {gameMode === 'duo' && !duoGuesses.every(guess => guess.locked) ? 'Vergrendel eerst beide gokken' : 'Onthul het nummer'}</button>
    </> : <>
      <div className="reveal-art">{track.image ? <img src={track.image} alt="" /> : <div><Music2 /></div>}{gimmick && <span className="visual-gimmick" title={gimmick.label}><img src={assetUrl(gimmick.image)} alt="" /></span>}<span className="year-stamp">{track.year || '????'}</span></div>
      <div className="reveal-copy"><span className="eyebrow">Het was…</span><h1>{track.title}</h1><p>{track.artist}</p>{track.album && <small>{track.album}</small>}{gimmick && <span className="visual-credit"><Sparkles /> {gimmick.kind} · {gimmick.label}</span>}</div>
      {gameMode === 'guess' && <div className="game-result guess-result"><strong>{Number(answerMatches(track.title, titleGuess)) + Number(answerMatches(track.artist, artistGuess))} / 2 punten</strong><span>Titel {answerMatches(track.title, titleGuess) ? '✓' : '✕'} · Artiest {answerMatches(track.artist, artistGuess) ? '✓' : '✕'}</span></div>}
      {gameMode === 'duo' && <DuoResult track={track} guesses={duoGuesses} />}
      {gameMode === 'bingo' && <BingoResult track={track} />}
      {gameMode === 'battle' && <BattleResult track={track} />}
      <div className="player-actions">
        {gameMode !== 'duo' && <button className="secondary-button" onClick={() => setRevealed(false)}><RotateCcw /> Verberg</button>}
        <button className="primary-button" onClick={onNext}>{playlistMode ? 'Volgende nummer' : 'Scan volgende kaart'} {playlistMode ? <ChevronRight /> : <ScanLine />}</button>
      </div>
    </>}
  </main>
}

function SpotifyPlaylistPicker({ onStart }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [starting, setStarting] = useState('')
  const [error, setError] = useState('')
  const [needsPlaylistPermission, setNeedsPlaylistPermission] = useState(false)
  const [resultLabel, setResultLabel] = useState('')
  const [playlistSource, setPlaylistSource] = useState('all')
  const [startMessage, setStartMessage] = useState('')
  const connected = hasSpotifySession()
  const search = async (event, suggestedQuery) => {
    event?.preventDefault(); const nextQuery = suggestedQuery || query; setPlaylistSource('all'); setQuery(nextQuery); setError(''); setSearching(true)
    try {
      const found = await searchSpotifyPlaylists(nextQuery)
      setResults(found)
      setResultLabel(`Zoekresultaten voor “${nextQuery}”`)
      if (!found.length) setError('Geen playlists gevonden. Probeer een kortere zoekterm.')
    } catch (problem) { setError(problem.message) } finally { setSearching(false) }
  }
  const loadMine = async () => {
    setPlaylistSource('mine'); setError(''); setSearching(true); setNeedsPlaylistPermission(false)
    try {
      const found = await getMySpotifyPlaylists()
      setResults(found); setResultLabel('Mijn Spotify-playlists')
      if (!found.length) setError('Spotify gaf geen eigen of gevolgde playlists terug.')
    } catch (problem) {
      setError(problem.message)
      if (/opnieuw|privéplaylists/i.test(problem.message)) setNeedsPlaylistPermission(true)
    } finally { setSearching(false) }
  }
  const renewPlaylistPermission = () => {
    clearSpotifySession()
    loginSpotify().catch(problem => setError(problem.message))
  }
  const start = async playlist => {
    setStarting(playlist.id); setError('')
    activateSpotifyElement()?.catch(() => {})
    try { await onStart(playlist, setStartMessage) } catch (problem) { setError(problem.message); setStarting(''); setStartMessage('') }
  }
  if (!connected) return <div className="playlist-connect"><p><strong>Alleen de spelleider:</strong> koppel Spotify Premium één keer op deze telefoon. Daarna vernieuwt TRACKBACK de verbinding automatisch.</p><button className="spotify-button" onClick={() => loginSpotify().catch(problem => setError(problem.message))}>Koppel één keer met Spotify <ExternalLink /></button><small>Spotify kan zelf om een wachtwoord, passkey of e-mailcode vragen. TRACKBACK kan die beveiliging niet overslaan.</small>{error && <div className="inline-error">{error}</div>}</div>
  return <div className="playlist-picker">
    <div className="playlist-source-tabs"><button className={playlistSource === 'all' ? 'active' : ''} onClick={() => { setPlaylistSource('all'); setResults([]); setResultLabel(''); setError('') }}><Search /> Zoek in heel Spotify</button><button className={playlistSource === 'mine' ? 'active' : ''} disabled={searching} onClick={loadMine}><Library /> Mijn playlists</button></div>
    {playlistSource === 'all' && <><form onSubmit={search}><label><Search /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Naam of Spotify-playlistlink…" aria-label="Spotify-playlists zoeken" /></label><button disabled={query.trim().length < 2 || searching}>{searching ? 'Zoeken…' : 'Zoek'}</button></form>
    <div className="playlist-suggestions"><span>Snel zoeken:</span>{['NPO Radio 2 Top 2000', 'Guilty pleasures', '80s hits'].map(suggestion => <button disabled={searching} onClick={() => search(null, suggestion)} key={suggestion}>{suggestion}</button>)}</div>
    <small className="playlist-search-tip"><b>Hier vind je openbare playlists</b>, zoals Radio 2 Top 2000. Je kunt ook iedere Spotify-playlistlink plakken.</small></>}
    {playlistSource === 'mine' && !searching && !results.length && !error && <p className="playlist-empty-note">Kies “Mijn playlists” om je openbare, privé- en gevolgde playlists te laden.</p>}
    {resultLabel && results.length > 0 && <h3 className="playlist-result-label">{resultLabel}</h3>}
    {starting && <div className="playlist-start-progress"><span /><strong>{startMessage || 'Playlist voorbereiden…'}</strong><small>Blijf op dit scherm; TRACKBACK maakt de digitale starttijdlijn.</small></div>}
    {results.length > 0 && <div className="playlist-results">{results.map(playlist => <article key={playlist.id}>
      {playlist.image ? <img src={playlist.image} alt="" /> : <span className="playlist-fallback"><Music2 /></span>}
      <div><strong>{playlist.name}</strong><small>{playlist.public === false ? 'Privé' : playlist.collaborative ? 'Samenwerking' : 'Openbaar'} · {playlist.owner}{playlist.total ? ` · ${playlist.total} nummers` : ''}</small><a href={playlist.externalUrl} target="_blank" rel="noreferrer">Bekijk op Spotify <ExternalLink /></a></div>
      <button disabled={Boolean(starting)} onClick={() => start(playlist)}>{starting === playlist.id ? 'Starten…' : 'Kies'}</button>
    </article>)}</div>}
    {error && <div className="inline-error">{error}{needsPlaylistPermission && <button onClick={renewPlaylistPermission}>Opnieuw koppelen voor privéplaylists</button>}</div>}
  </div>
}

function RoundSteps({ position, finalLabel }) {
  const picked = position !== null
  return <div className="round-steps" aria-label="Stappen van deze ronde">
    <span className="done"><b>1</b>Luister</span>
    <span className={picked ? 'done' : 'active'}><b>2</b>Raad</span>
    <span className={picked ? 'done' : ''}><b>3</b>Kies plek</span>
    <span className={picked ? 'active' : ''}><b>4</b>{finalLabel}</span>
  </div>
}

const timelineCardCount = round => Math.max(2, Number(round) + 1)
const timelinePositionLabel = (position, round, timeline = []) => {
  const digital = Array.isArray(timeline) && timeline.length > 0
  const cards = digital ? timeline.length : timelineCardCount(round)
  const index = Number(position)
  if (digital) {
    if (index === 0) return `Vóór ${timeline[0].year}`
    if (index === cards) return `Na ${timeline[cards - 1].year}`
    return `Tussen ${timeline[index - 1].year} en ${timeline[index].year}`
  }
  if (index === 0) return 'Ouder dan kaart 1'
  if (index === cards) return `Nieuwer dan kaart ${cards}`
  return `Tussen kaart ${index} en ${index + 1}`
}

function BaseTimelinePositionPicker({ value, onChange, round, timeline = [] }) {
  const digital = Array.isArray(timeline) && timeline.length > 0
  const cards = digital ? timeline.length : timelineCardCount(round)
  const positions = Array.from({ length: cards + 1 }, (_, index) => ({
    value: index,
    label: timelinePositionLabel(index, round, timeline),
  }))
  return <section className="timeline-picker" aria-label="Kies een plek in de tijdlijn">
    <header><Clock3 /><div><strong>2 · Kies de plek {digital ? 'in de app' : 'op tafel'}</strong><small>{digital ? 'Dit is jullie digitale tijdlijn, van oud naar nieuw.' : 'De kaarten liggen van oud naar nieuw. Tik op één vak.'}</small></div></header>
    {digital && <div className="digital-timeline">{timeline.map(track => <span key={`${track.id}-${track.year}`}><b>{track.year}</b><small>{track.title}</small></span>)}</div>}
    {cards > 2 && <span className="swipe-tip">Veeg naar links voor alle plekken →</span>}
    <div className="timeline-positions">{positions.map(position => <button type="button" className={value !== null && Number(value) === position.value ? 'active' : ''} aria-pressed={value !== null && Number(value) === position.value} onClick={() => onChange(position.value)} key={position.value}><span className="position-picture"><i />{position.value > 0 && position.value < cards && <i />}</span><b>{position.label}</b></button>)}</div>
    <p>{digital ? <><b>Geen kaarten nodig:</b> de app voegt het nummer na de onthulling zelf toe.</> : <><b>Nog niet neerleggen:</b> tik nu alleen je keuze aan. Na de onthulling leg je de kaart echt op tafel.</>}</p>
  </section>
}

function BaseRoomScoreBoard({ roomId, round, players, guesses, answer, scores, timeline = [] }) {
  const contestants = Object.entries(players)
  const [timelineChecks, setTimelineChecks] = useState({})
  const digital = Array.isArray(timeline) && timeline.length > 0
  const correctPosition = digital ? timeline.filter(track => Number(track.year) <= Number(answer.year)).length : null
  const digitalTimelinePoints = guess => digital && Number(guess.position) === correctPosition ? 2 : 0
  const save = async (uid, guess) => {
    const base = Number(answerMatches(answer.title, guess.title)) + Number(answerMatches(answer.artist, guess.artist))
    await scoreRoomPlayer(roomId, round, uid, base + (digital ? digitalTimelinePoints(guess) : timelineChecks[uid] ? 2 : 0))
  }
  return <section className="room-scoreboard">
    <h2>Controleer de ronde</h2>
    {contestants.map(([uid, player]) => {
      const guess = guesses[uid]
      const saved = scores[uid] !== undefined
      if (!guess) return <article key={uid}><strong>{player.name}</strong><span>Geen antwoord</span></article>
      const auto = Number(answerMatches(answer.title, guess.title)) + Number(answerMatches(answer.artist, guess.artist)) + digitalTimelinePoints(guess)
      return <article key={uid} className={saved ? 'is-scored' : ''}>
        <header><strong>{player.name}</strong><b>{saved ? `+${scores[uid]} punten` : `${auto} automatisch`}</b></header>
        <p>Titel: {guess.title || '—'} · artiest: {guess.artist || '—'} · gekozen plek: <strong>{timelinePositionLabel(guess.position, round, timeline)}</strong></p>
        {digital && <p>Juiste plek: <strong>{timelinePositionLabel(correctPosition, round, timeline)}</strong> · tijdlijn {digitalTimelinePoints(guess) ? 'goed (+2)' : 'niet goed'}</p>}
        {!saved && <div className={digital ? 'single-action' : ''}>{!digital && <button className={timelineChecks[uid] ? 'active' : ''} onClick={() => setTimelineChecks(value => ({ ...value, [uid]: !value[uid] }))}><Clock3 /> Tijdlijn goed +2</button>}<button onClick={() => save(uid, guess)}><Check /> {digital ? `Sla ${auto} punten op` : 'Punten opslaan'}</button></div>}
      </article>
    })}
  </section>
}

function GuessCountdown({ seconds }) {
  if (seconds === null) return null
  return <div className={`guess-countdown ${seconds <= 5 ? 'urgent' : ''}`}><Clock3 /><div><strong>Nog {seconds} seconden</strong><span>De laatste speler rondt de gok af; daarna wordt automatisch onthuld.</span></div></div>
}

function MultiplayerRoom({ roomId, resolveCard, onLeave }) {
  const [room, setRoom] = useState(null)
  const [rawPlayers, setPlayers] = useState({})
  const [answer, setAnswer] = useState(null)
  const [guesses, setGuesses] = useState({})
  const [scores, setScores] = useState({})
  const [uid, setUid] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [name, setName] = useState('')
  const [guess, setGuess] = useState({ title: '', artist: '', position: null })
  const [scanning, setScanning] = useState(false)
  const [track, setTrack] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [message, setMessage] = useState('')
  const [playlistSession, setPlaylistSession] = useState(null)
  const [now, setNow] = useState(Date.now())
  const deadlineRevealStarted = useRef(false)
  const invite = useMemo(() => roomInviteUrl(roomId), [roomId])
  const isHost = Boolean(uid && room?.hostUid === uid)
  const joined = Boolean(uid && rawPlayers[uid])
  const activePlayers = Object.fromEntries(Object.entries(rawPlayers).filter(([, player]) => player.online !== false))
  const players = activePlayers
  const guests = Object.entries(activePlayers).filter(([, player]) => player.role !== 'host')
  const isSolo = Number(room?.maxPlayers) === 1
  const readyCount = Object.values(activePlayers).filter(player => player.ready).length
  const allReady = Object.keys(activePlayers).length > 0 && readyCount === Object.keys(activePlayers).length
  const secondsLeft = room?.guessDeadline ? Math.max(0, Math.ceil((Number(room.guessDeadline) - now) / 1000)) : null
  const TimelinePositionPicker = props => <BaseTimelinePositionPicker {...props} timeline={room?.mode === 'digital' ? room.timeline || [] : []} />

  useEffect(() => {
    let active = true
    let stops = []
    ensureRoomUser().then(user => {
      if (!active) return
      setUid(user.uid)
      stops = [
        subscribeRoomPublic(roomId, value => { if (active) { setRoom(value); setLoaded(true) } }),
        subscribeRoomPlayers(roomId, value => active && setPlayers(value)),
      ]
    }).catch(error => { if (active) { setMessage(error.message); setLoaded(true) } })
    return () => { active = false; stops.forEach(stop => stop()) }
  }, [roomId])

  useEffect(() => {
    if (!uid || !joined || rawPlayers[uid]?.online !== false) return
    reconnectRoom(roomId).catch(error => setMessage(error.message))
  }, [roomId, uid, joined, rawPlayers[uid]?.online])

  useEffect(() => {
    setAnswer(null); setGuesses({}); setScores({}); setGuess({ title: '', artist: '', position: null }); setTrack(null); setPlaying(false)
    if (!room?.round || !uid) return undefined
    const stops = [subscribeRoundScores(roomId, room.round, setScores)]
    if (isHost || room.revealed) stops.push(subscribeRoundAnswer(roomId, room.round, value => { setAnswer(value); if (isHost && value) setTrack(value) }))
    if (isHost) stops.push(subscribeRoundGuesses(roomId, room.round, setGuesses))
    else stops.push(subscribeMyRoomGuess(roomId, room.round, uid, value => setGuesses(value ? { [uid]: value } : {})))
    return () => stops.forEach(stop => stop())
  }, [roomId, room?.round, room?.revealed, uid, isHost])

  useEffect(() => {
    const playerTotal = Object.keys(activePlayers).length
    if (!isHost || room?.status !== 'guessing' || playerTotal < 2 || room.guessDeadline || readyCount !== playerTotal - 1) return
    startRoomGuessDeadline(roomId).catch(error => setMessage(error.message))
  }, [roomId, room?.status, room?.guessDeadline, isHost, readyCount, Object.keys(activePlayers).length])

  useEffect(() => {
    deadlineRevealStarted.current = false
  }, [room?.round])

  useEffect(() => {
    if (room?.status !== 'guessing' || !room.guessDeadline) return undefined
    const tick = () => {
      const current = Date.now()
      setNow(current)
      if (isHost && current >= Number(room.guessDeadline) && !deadlineRevealStarted.current) {
        deadlineRevealStarted.current = true
        revealRoom(roomId).catch(error => { deadlineRevealStarted.current = false; setMessage(error.message) })
      }
    }
    tick()
    const timer = setInterval(tick, 250)
    return () => clearInterval(timer)
  }, [roomId, room?.status, room?.guessDeadline, isHost])

  const playTrack = async selected => {
    try {
      activateSpotifyElement()?.catch(() => {})
      if (selected.audioUrl) {
        const audio = new Audio(selected.audioUrl)
        await audio.play()
      } else if (selected.spotifyUri && hasSpotifySession()) {
        await prepareSpotifyPlayer()
        await playSpotify(selected.spotifyUri)
      } else if (selected.spotifyUri) {
        setMessage('Koppel Spotify op de telefoon van de spelleider en tik daarna op afspelen.')
        return
      }
      setPlaying(true); setMessage('Muziek speelt op de telefoon van de spelleider')
    } catch (error) { setMessage(error.message); setPlaying(false) }
  }
  const selectTrack = async (selected, playback = 'start') => {
    setScanning(false); setTrack(selected); setAnswer(selected); setMessage('Ronde gestart')
    await setRoomTrack(roomId, room.round, selected)
    if (playback === 'resume-context') await resumeSpotify()
    if (playback === 'start') await playTrack(selected)
    else { setPlaying(true); setMessage('Muziek speelt op de telefoon van de spelleider') }
  }
  const parseScan = text => {
    let id = text
    try { id = new URL(text).searchParams.get('card') || text } catch { /* raw id */ }
    const selected = resolveCard(id)
    if (selected) selectTrack(selected)
    else { setScanning(false); setMessage('Deze kaart hoort niet bij de gekozen editie.') }
  }
  const startPlaylist = async (playlist, onProgress) => {
    setMessage('Digitale starttijdlijn maken…'); onProgress?.('Playlist controleren…')
    let anchors
    let selected
    let preparedWhileMuted = false
    try {
      anchors = await getSpotifyPlaylistAnchors(playlist)
      onProgress?.('Eerste geheime nummer starten…')
      selected = await startSpotifyPlaylist(playlist)
    } catch (error) {
      if (error.message !== 'SPOTIFY_PLAYLIST_ITEMS_BLOCKED') throw error
      const prepared = await preparePublicSpotifyPlaylist(playlist, onProgress)
      anchors = prepared.anchors
      selected = prepared.selected
      preparedWhileMuted = true
    }
    await setRoomDigitalTimeline(roomId, anchors, playlist)
    setPlaylistSession({ playlist, currentUri: selected.spotifyUri })
    await selectTrack(normalizeTrack(selected), preparedWhileMuted ? 'resume-context' : 'already-playing')
  }
  const nextPlaylist = async () => {
    const selected = await nextSpotifyPlaylistTrack(playlistSession.currentUri, playlistSession.playlist)
    setPlaylistSession(value => ({ ...value, currentUri: selected.spotifyUri }))
    await selectTrack(normalizeTrack(selected), 'already-playing')
  }
  const resumeDigitalPlaylist = async () => {
    const selected = await startSpotifyPlaylist(room.playlist)
    setPlaylistSession({ playlist: room.playlist, currentUri: selected.spotifyUri })
    await selectTrack(normalizeTrack(selected), 'already-playing')
  }
  const stopPlaying = async () => { await pauseSpotify().catch(() => {}); setPlaying(false) }
  const share = async () => {
    if (navigator.share) await navigator.share({ title: 'Speel mee met TRACKBACK', text: `Kamer ${room.code}`, url: invite })
    else { await navigator.clipboard.writeText(invite); setMessage('Uitnodigingslink gekopieerd') }
  }
  const exit = async () => {
    if (isHost) await closeRoom(roomId)
    else if (joined) await leaveRoom(roomId)
    onLeave()
  }

  if (scanning) return <ScannerView onScan={parseScan} onClose={() => setScanning(false)} />
  if (!loaded) return <main className="room-screen room-loading"><Music2 /><h1>Kamer openen…</h1><p>Even veilig verbinden met het spel.</p></main>
  if (message && !room) return <main className="room-screen room-loading"><X /><h1>Verbinden lukt niet</h1><p>{message}</p><button onClick={() => location.reload()}>Probeer opnieuw</button></main>
  if (!room) return <main className="room-screen room-loading"><X /><h1>Kamer niet gevonden</h1><p>Vraag de spelleider om een nieuwe QR-code.</p><button onClick={onLeave}>Terug naar TRACKBACK</button></main>
  if (room.status === 'closed') return <main className="room-screen room-loading"><Music2 /><h1>Deze kamer is gesloten</h1><button onClick={onLeave}>Terug naar TRACKBACK</button></main>
  if (!joined) {
    const full = Object.keys(activePlayers).length >= Number(room.maxPlayers || 6)
    return <main className="room-screen join-room"><div className="hero-brand"><div className="brand-mark"><Users /></div><span>TRACKBACK LIVE</span></div><section><span className="eyebrow">Kamer {room.code}</span><h1>Speel mee<br />op je eigen telefoon</h1><p>Geen Spotify-account nodig. De spelleider verzorgt de muziek; jouw antwoorden blijven geheim.</p><label><span>Jouw naam</span><input autoFocus value={name} onChange={event => setName(event.target.value)} placeholder="Bijvoorbeeld Nikki" /></label><button disabled={full || name.trim().length < 2} onClick={() => joinRoom(roomId, name).catch(error => setMessage(error.message))}>{full ? 'Kamer is vol' : 'Doe mee'} <ChevronRight /></button>{message && <div className="inline-error">{message}</div>}</section></main>
  }

  return <main className={`room-screen ${isHost ? 'host-room' : 'guest-room'} room-${room.status}`}>
    <header className="room-top"><button className="round-button" onClick={exit}><ArrowLeft /></button><div><small>Kamer {room.code}</small><strong>Ronde {room.round}</strong></div><span>{Object.keys(activePlayers).length}/{room.maxPlayers} online</span></header>
    {room.status === 'lobby' && isHost && Number(room.round) === 1 && room.mode !== 'digital' && <>
      <div className={`room-guide ${isSolo ? 'solo-room-guide' : ''}`}>{!isSolo && <><span className="active"><b>1</b>Deel QR</span><span><b>2</b>Spelers</span></>}<span className={isSolo ? 'active' : ''}><b>{isSolo ? 1 : 3}</b>Startkaarten</span><span><b>{isSolo ? 2 : 4}</b>Scan</span></div>
      {!isSolo && <section className="room-invite"><span className="eyebrow">Stap 1 · iedereen een eigen telefoon</span><h1>Laat je vrienden deze QR scannen</h1><CardQr value={invite} size={280} /><strong>{room.code}</strong><p>Iedereen vult alleen een naam in. Alleen jij als spelleider koppelt Spotify.</p><button onClick={share}><QrCode /> Deel uitnodiging</button></section>}
      {!isSolo && <section className="room-players"><h2>{guests.length ? 'Al aangesloten' : 'Wachten op spelers…'}</h2>{Object.entries(activePlayers).map(([id, player]) => <span key={id}><Users /> {player.name}{player.role === 'host' ? ' · jij' : ''}</span>)}</section>}
      <section className="room-setup"><Clock3 /><div><span className="eyebrow">Stap {isSolo ? 1 : 3} · eenmalig</span><h2>Leg 2 startkaarten open op tafel</h2><p>Draai de jaartallen zichtbaar. Leg de <b>oudste links</b> en de <b>nieuwste rechts</b>. Hier tussen gaan jullie zo kiezen.</p></div></section>
      <section className="room-start"><div><span className="eyebrow">Stap {isSolo ? 2 : 4}</span><h2>Klaar? Start het eerste nummer</h2><p>Scan één nieuwe kaart zonder de achterkant te bekijken. De muziek speelt alleen op jouw telefoon.</p></div><button className="scan-button" onClick={() => setScanning(true)}><span><ScanLine /></span>Scan een kaart en start</button></section>
    </>}
    {room.status === 'lobby' && isHost && Number(room.round) === 1 && room.mode === 'digital' && <>
      <div className={`room-guide ${isSolo ? 'solo-room-guide' : ''}`}>{!isSolo && <><span className="active"><b>1</b>Deel QR</span><span><b>2</b>Spelers</span></>}<span className={isSolo ? 'active' : ''}><b>{isSolo ? 1 : 3}</b>Spotify</span><span><b>{isSolo ? 2 : 4}</b>Playlist</span></div>
      {!isSolo && <section className="room-invite"><span className="eyebrow">Stap 1 · iedereen een eigen telefoon</span><h1>Laat je vrienden deze QR scannen</h1><CardQr value={invite} size={280} /><strong>{room.code}</strong><p>Je vrienden vullen alleen hun naam in. Ze hebben geen Spotify-account en geen kaarten nodig.</p><button onClick={share}><QrCode /> Deel uitnodiging</button></section>}
      {!isSolo && <section className="room-players"><h2>{guests.length ? 'Al aangesloten' : 'Wachten op spelers…'}</h2>{Object.entries(activePlayers).map(([id, player]) => <span key={id}><Users /> {player.name}{player.role === 'host' ? ' · jij' : ''}</span>)}</section>}
      <section className="room-setup digital-room-setup"><Music2 /><div><span className="eyebrow">Stap {isSolo ? '1 en 2' : '3 en 4'}</span><h2>Digitaal betekent: geen kaarten</h2><p>Alleen jij koppelt Spotify Premium en kiest hieronder een playlist. De app maakt automatisch de starttijdlijn en start daarna het eerste geheime nummer.</p></div></section>
      <section className="room-start digital-playlist-start"><div><span className="eyebrow">Kies de muziek</span><h2>Koppel Spotify en kies een playlist</h2><p>Zoek bijvoorbeeld op Top 2000, guilty pleasures of een artiest. Daarna loopt het spel vanzelf verder.</p></div><SpotifyPlaylistPicker onStart={startPlaylist} /></section>
    </>}
    {room.status === 'lobby' && isHost && Number(room.round) > 1 && <>
      <div className="room-guide next-round-guide"><span className="active"><b>1</b>{room.mode === 'digital' ? 'App bijgewerkt' : 'Kaart ligt'}</span><span><b>2</b>{room.mode === 'digital' ? 'Start nummer' : 'Scan volgende'}</span></div>
      <section className="room-start next-round-start"><div><span className="eyebrow">Ronde {room.round}</span><h1>Klaar voor de volgende hit?</h1><p>{room.mode === 'digital' ? `De digitale tijdlijn heeft nu ${room.timeline?.length || 0} nummers. Start het volgende geheime playlistnummer.` : 'De vorige kaart ligt in de tijdlijn. Scan nu één nieuwe kaart zonder de achterkant te bekijken.'}</p></div>{room.mode === 'digital' ? <button className="scan-button" onClick={playlistSession ? nextPlaylist : resumeDigitalPlaylist}><span><Play /></span>Start volgend nummer</button> : <button className="scan-button" onClick={() => setScanning(true)}><span><ScanLine /></span>Scan volgende kaart</button>}</section>
    </>}
    {room.status === 'lobby' && !isHost && <section className="room-wait"><div className="secret-art"><div className="record"><Music2 /><span /></div></div><span className="eyebrow">Verbonden als {players[uid]?.name}</span><h1>{Number(room.round) === 1 ? 'Je bent klaar' : `Ronde ${room.round} komt eraan`}</h1><p>{Number(room.round) === 1 ? room.mode === 'digital' ? 'Geen kaarten nodig. De spelleider kiest een playlist; daarna raad jij op je eigen telefoon en kies je een plek in de digitale tijdlijn.' : 'De spelleider scant zo het eerste nummer. Daarna ga je raden, een plek kiezen en je antwoord vastzetten.' : room.mode === 'digital' ? `De app heeft de tijdlijn aangevuld. Er staan nu ${room.timeline?.length || 0} nummers in; wacht hier op de volgende hit.` : 'De vorige kaart ligt in de tijdlijn. De spelleider scant nu het volgende nummer; jij blijft gewoon op dit scherm.'}</p></section>}
    {room.status === 'guessing' && isHost && <section className="room-host-round"><RoundSteps position={guess.position} finalLabel="Zet vast" /><GuessCountdown seconds={secondsLeft} /><span className="eyebrow">Geheim nummer · ronde {room.round}</span><h1>{isSolo ? 'Wat denk jij?' : 'Luister en doe zelf mee'}</h1><div className="secret-art"><div className="record"><Music2 /><span /></div></div><button className="play-or-pause" onClick={() => playing ? stopPlaying() : playTrack(track)}>{playing ? <Pause /> : <Play />}</button>{!guesses[uid]?.locked ? <div className="host-own-guess"><strong>Jouw eigen gok</strong><small>Spelfouten worden soepel beoordeeld en één juiste artiest is genoeg. Een plek kiezen is verplicht.</small><input autoCorrect="off" value={guess.title} onChange={event => setGuess(value => ({ ...value, title: event.target.value }))} placeholder="Welke titel denk je?" /><input autoCorrect="off" value={guess.artist} onChange={event => setGuess(value => ({ ...value, artist: event.target.value }))} placeholder="Welke artiest denk je?" /><TimelinePositionPicker value={guess.position} onChange={position => setGuess(value => ({ ...value, position }))} round={room.round} /><button disabled={guess.position === null} onClick={() => submitRoomGuess(roomId, room.round, guess)}><Check /> Mijn gok vastzetten</button></div> : <div className="host-own-guess is-locked"><Check /> {isSolo ? 'Jouw gok staat vast. Je kunt nu onthullen.' : 'Jouw gok staat vast. Wacht tot iedereen groen is.'}</div>}<div className="ready-list">{Object.entries(players).map(([id, player]) => <span className={player.ready ? 'ready' : ''} key={id}>{player.ready ? <Check /> : <Clock3 />}{player.name}</span>)}</div><button className="reveal-button" disabled={!allReady && secondsLeft !== 0} onClick={() => revealRoom(roomId)}><Sparkles /> {allReady ? 'Iedereen klaar: onthul' : secondsLeft === 0 ? 'Tijd voorbij: onthul' : 'Wachten op de laatste gok'}</button>{message && <p>{message}</p>}</section>}
    {room.status === 'guessing' && !isHost && <section className="room-guess"><RoundSteps position={guess.position} finalLabel="Zet vast" /><GuessCountdown seconds={secondsLeft} /><span className="eyebrow">Ronde {room.round}</span><h1>{guesses[uid]?.locked ? 'Klaar!' : 'Wat denk jij?'}</h1>{guesses[uid]?.locked ? <><div className="locked-answer"><Check /><p>Je antwoord staat vast en blijft geheim. Wacht tot de spelleider onthult.</p></div><div className="sound-wave">{[1,2,3,4,5,6,7].map(i => <i key={i} />)}</div></> : <><div className="guess-help"><b>1 · Raad wat je kunt</b><span>Spelfouten worden soepel beoordeeld. Bij meerdere artiesten is één juiste genoeg.</span></div><label><span>Titel</span><input autoCorrect="off" value={guess.title} onChange={event => setGuess(value => ({ ...value, title: event.target.value }))} placeholder="Welke titel denk je?" /></label><label><span>Artiest</span><input autoCorrect="off" value={guess.artist} onChange={event => setGuess(value => ({ ...value, artist: event.target.value }))} placeholder="Welke artiest denk je?" /></label><TimelinePositionPicker value={guess.position} onChange={position => setGuess(value => ({ ...value, position }))} round={room.round} /><button className="reveal-button" disabled={guess.position === null} onClick={() => submitRoomGuess(roomId, room.round, guess)}><Check /> Dit is mijn definitieve gok</button></>}</section>}
    {room.status === 'revealed' && answer && <section className="room-reveal">
      <span className="eyebrow">Het was…</span><div className="reveal-art">{answer.image ? <img src={answer.image} alt="" /> : <div><Music2 /></div>}<span className="year-stamp">{answer.year || '????'}</span></div><h1>{answer.title}</h1><p>{answer.artist}</p>
      <div className="place-reveal-note"><Clock3 /><div><strong>{room.mode === 'digital' ? 'De app vult de tijdlijn aan' : 'Leg de kaart nu in de tijdlijn'}</strong><span>{room.mode === 'digital' ? `${answer.year || 'Het jaartal'} wordt automatisch op de juiste digitale plek gezet.` : `Zet ${answer.year || 'het jaartal'} op de juiste plek, van oud links naar nieuw rechts.`} Controleer daarna ieders keuze.</span></div></div>
      {isHost ? <BaseRoomScoreBoard roomId={roomId} round={room.round} players={players} guesses={guesses} answer={answer} scores={scores} timeline={room.mode === 'digital' ? room.timeline || [] : []} /> : <div className="guest-round-result"><strong>{scores[uid] === undefined ? 'De spelleider controleert de tijdlijn…' : `+${scores[uid]} punten deze ronde`}</strong><span>Totaal: {players[uid]?.score || 0} punten</span></div>}
      {isHost && <button className="primary-button wide" onClick={() => nextRoomRound(roomId, room.round, players, answer, room.mode === 'digital')}><ChevronRight /> {room.mode === 'digital' ? 'Volgende digitale ronde' : 'Kaart gelegd? Volgende ronde'}</button>}
    </section>}
  </main>
}

function PlayerCountPicker({ value, onChange }) {
  return <section className="player-count-card">
    <div><Users /><span><strong>Met hoeveel speel je?</strong><small>{value === 1 ? 'Solo: raad, plaats en verbeter je eigen score.' : 'Iedereen krijgt een eigen gok en score.'}</small></span></div>
    <div className="player-count-options">{[1, 2, 3, 4, 5, 6].map(count => <button className={value === count ? 'active' : ''} aria-pressed={value === count} onClick={() => onChange(count)} key={count}>{count === 1 ? '1 · solo' : count}</button>)}</div>
  </section>
}

function PlayHome({ collection, onOpenTrack, onStartPlaylist, onCreateRoom, resolveCard, gameMode, setGameMode, playerCount, setPlayerCount }) {
  const availableGames = collection.gameModes?.length
    ? GAME_MODES.filter(game => collection.gameModes.includes(game.id))
    : GAME_MODES
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState('')
  const [scanPlayerReady, setScanPlayerReady] = useState(!hasSpotifySession())
  const [showAlternatives, setShowAlternatives] = useState(false)
  const [showRules, setShowRules] = useState(false)
  const [creatingRoom, setCreatingRoom] = useState(false)
  const [liveMode, setLiveMode] = useState('digital')
  const activeGame = availableGames.find(game => game.id === gameMode) || availableGames[0] || GAME_MODES[0]
  const practiceTrack = useMemo(() => collection.tracks[Math.floor(Math.random() * collection.tracks.length)], [collection])
  const practiceReady = Boolean(practiceTrack?.audioUrl || getClientId())
  useEffect(() => {
    if (hasSpotifySession()) prepareSpotifyPlayer().then(() => setScanPlayerReady(true)).catch(() => setScanPlayerReady(true))
  }, [])
  const selectGame = id => { setGameMode(id); setShowAlternatives(false); setShowRules(false) }
  const parseScan = text => {
    setScanning(false)
    let id = text
    try { id = new URL(text).searchParams.get('card') || text } catch { /* raw id */ }
    const track = resolveCard(id)
    if (track) onOpenTrack(track)
    else setError('Deze kaart hoort niet bij de collectie op dit toestel.')
  }
  if (scanning) return <ScannerView onScan={parseScan} onClose={() => setScanning(false)} />
  return <main className="play-home page public-play-home">
    <div className="hero-brand"><div className="brand-mark"><Music2 /></div><span>TRACKBACK</span></div>
    <section className="play-hero">
      <span className="eyebrow">Klaar voor een ronde?</span>
      <h1>Luister.<br /><em>{gameMode === 'timeline' ? 'Leg de tijdlijn.' : `Speel ${activeGame.name}.`}</em></h1>
      <p>{gameMode === 'duo' ? 'Maak een kamer en laat iedereen met de QR-code op een eigen telefoon meedoen.' : 'Scan een kaart, luister zonder titel en speel direct.'}</p>
      {gameMode !== 'duo' && <><button className="scan-button" disabled={!scanPlayerReady} onClick={() => { activateSpotifyElement()?.catch(() => {}); setError(''); setScanning(true) }}><span><ScanLine /></span>{scanPlayerReady ? 'Scan een kaart' : 'Spotify voorbereiden…'}</button><p className="one-phone-tip"><Check /> Eén telefoon is genoeg voor de hele groep</p></>}
      {availableGames.some(game => game.id === 'duo') && gameMode !== 'duo' && <button className="duo-invite" onClick={() => selectGame('duo')}><span><Users /></span><div><small>Met z’n tweeën of meer?</small><strong>Speel Samen</strong><p>Gezamenlijke tijdlijn · eigen gok · eigen score</p></div><ChevronRight /></button>}
      {availableGames.length > 1 && <div className="game-switch-bar"><span><activeGame.icon /><small>Gekozen spel</small><strong>{activeGame.name}</strong></span><button onClick={() => setShowAlternatives(value => !value)}>{showAlternatives ? 'Sluiten' : 'Ander spel'} <ChevronRight /></button></div>}
      {availableGames.length > 1 && showAlternatives && <div className="game-menu">
        <div className="game-menu-heading"><strong>Snel beginnen</strong><small>De makkelijkste spelvormen</small></div>
        <div className="alternate-games">{availableGames.filter(game => game.type === 'favoriet').map(game => <button className={gameMode === game.id ? 'active' : ''} key={game.id} onClick={() => selectGame(game.id)}><game.icon /><span><strong>{game.name}</strong><small>{game.text}</small><em>{game.meta}</em></span>{gameMode === game.id && <Check />}</button>)}</div>
        {availableGames.some(game => game.type === 'duo') && <><div className="game-menu-heading group-heading"><strong>Samen spelen</strong><small>Eén tijdlijn, maar iedereen speelt voor zichzelf</small></div><div className="alternate-games">{availableGames.filter(game => game.type === 'duo').map(game => <button className={gameMode === game.id ? 'active' : ''} key={game.id} onClick={() => selectGame(game.id)}><game.icon /><span><strong>{game.name}</strong><small>{game.text}</small><em>{game.meta}</em></span>{gameMode === game.id && <Check />}</button>)}</div></>}
        <div className="game-menu-heading group-heading"><strong>Extra voor groepen</strong><small>Leuk als iedereen het basisspel kent</small></div>
        <div className="alternate-games">{availableGames.filter(game => game.type === 'groep').map(game => <button className={gameMode === game.id ? 'active' : ''} key={game.id} onClick={() => selectGame(game.id)}><game.icon /><span><strong>{game.name}</strong><small>{game.text}</small><em>{game.meta}</em></span>{gameMode === game.id && <Check />}</button>)}</div>
      </div>}
      <button className="rules-toggle" onClick={() => setShowRules(value => !value)}><activeGame.icon /> Hoe speel je {activeGame.name}? <ChevronRight className={showRules ? 'is-open' : ''} /></button>
      {showRules && <div className="game-explanation"><div className="explanation-title"><activeGame.icon /><div><small>In drie stappen</small><strong>{activeGame.name}</strong></div></div><div className="setup-tip"><b>Voor je begint</b>{activeGame.setup}</div><ol>{activeGame.steps.map((step, index) => <li key={step}><b>{index + 1}</b>{step}</li>)}</ol><p><Trophy /> {activeGame.score}</p></div>}
      {gameMode === 'duo' && <><section className="play-format-card"><div className="play-format-heading"><Music2 /><span><strong>Hoe willen jullie spelen?</strong><small>Kies dit vóór je de kamer maakt.</small></span></div><div className="play-format-options"><button className={liveMode === 'digital' ? 'active' : ''} aria-pressed={liveMode === 'digital'} onClick={() => setLiveMode('digital')}><span>Digitaal</span><strong>Zonder kaarten</strong><small>Playlist kiezen; de app maakt de tijdlijn.</small></button><button className={liveMode === 'cards' ? 'active' : ''} aria-pressed={liveMode === 'cards'} onClick={() => setLiveMode('cards')}><span>Met kaarten</span><strong>Scannen en neerleggen</strong><small>Gebruik jullie geprinte QR-kaarten op tafel.</small></button></div></section><PlayerCountPicker value={playerCount} onChange={setPlayerCount} /><section className="live-room-cta"><Users /><div><small>{playerCount === 1 ? 'Solo · je eigen score' : liveMode === 'digital' ? 'Digitaal · geen kaarten nodig' : 'Met geprinte kaarten'}</small><strong>{playerCount === 1 ? 'Start een solospel' : 'Maak een live kamer'}</strong><p>{playerCount === 1 ? 'Geen kamer delen: kies muziek, raad titel en artiest en plaats iedere hit in je eigen tijdlijn.' : liveMode === 'digital' ? 'Deel één QR-code, kies daarna een Spotify-playlist en speel volledig via ieders telefoon.' : 'Deel één QR-code en scan de geprinte muziekkaarten met de telefoon van de spelleider.'}</p></div><button disabled={creatingRoom} onClick={async () => { setCreatingRoom(true); try { await onCreateRoom(playerCount, liveMode) } finally { setCreatingRoom(false) } }}>{creatingRoom ? 'Spel maken…' : playerCount === 1 ? 'Start solo' : liveMode === 'digital' ? 'Start zonder kaarten' : 'Start met kaarten'} <ChevronRight /></button></section></>}
      {error && <div className="inline-error">{error}</div>}
    </section>
    {gameMode !== 'duo' && <section className="quick-test practice-card">
      <span>Nog geen kaarten bij de hand?</span>
      <h2>Probeer één oefenronde</h2>
      <p>{practiceReady ? 'Zo ontdek je zonder QR-kaart eerst rustig hoe luisteren en onthullen werkt.' : 'Scan eerst één geprinte TRACKBACK-kaart. Daarmee wordt deze telefoon automatisch voor Spotify ingesteld.'}</p>
      <button className="secondary-button" disabled={!practiceTrack || !practiceReady} onClick={() => { activateSpotifyElement()?.catch(() => {}); if (practiceTrack) onOpenTrack(practiceTrack) }}><Play /> {practiceReady ? 'Start oefenronde' : 'Eerst een kaart scannen'} <ChevronRight /></button>
    </section>}
  </main>
}

function TrackEditor({ initial, onSave, onCancel }) {
  const [track, setTrack] = useState(normalizeTrack(initial || {}))
  const field = (key, label, placeholder) => <label><span>{label}</span><input value={track[key]} placeholder={placeholder} onChange={event => setTrack({ ...track, [key]: event.target.value })} /></label>
  return <div className="modal-layer"><form className="modal-card" onSubmit={event => { event.preventDefault(); onSave(track) }}>
    <div className="modal-title"><div><span className="eyebrow">Kaartgegevens</span><h2>{initial ? 'Nummer bewerken' : 'Nummer toevoegen'}</h2></div><button type="button" className="round-button" onClick={onCancel} aria-label="Venster sluiten"><X /></button></div>
    <div className="form-grid">{field('title', 'Titel', 'Bijvoorbeeld: Dreams')}{field('artist', 'Artiest', 'The Cranberries')}{field('year', 'Jaar', '1993')}{field('album', 'Album', 'No Need to Argue')}<label><span>Genrethema</span><select value={track.genre} onChange={event => setTrack({ ...track, genre: event.target.value })}><option value="pop">Pop neon</option><option value="disco">Disco fever</option><option value="rock">Rock stage</option><option value="electronic">Electronic club</option><option value="soul">Soul lounge</option></select></label>{field('externalUrl', 'Spotify-link', 'https://open.spotify.com/track/…')}{field('audioUrl', 'Directe audio-URL (optioneel)', 'https://…/nummer.mp3')}</div>
    <button className="primary-button wide" disabled={!track.title || !track.artist}><Check /> Opslaan</button>
  </form></div>
}

function StudioHome({ collection, setTab }) {
  const spotifyConnected = hasSpotifySession()
  const steps = [
    { number: '01', title: 'Koppel & importeer', text: spotifyConnected ? 'Spotify staat klaar. Importeer een playlist of vervang de huidige.' : 'Koppel één keer Spotify; TRACKBACK is al technisch ingesteld.', icon: Import, action: spotifyConnected ? 'Playlist importeren' : 'Spotify koppelen', tab: 'settings', done: spotifyConnected },
    { number: '02', title: 'Controleer de muziek', text: `${collection.name} · ${collection.tracks.length} nummers. Check vooral titels en jaartallen.`, icon: Music2, action: 'Nummers controleren', tab: 'collection', done: collection.tracks.length > 3 },
    { number: '03', title: 'Personaliseer & print', text: 'Geef de editie een naam en print kaarten, regels en scorebladen.', icon: Printer, action: 'Naar de printstudio', tab: 'cards', done: Boolean(localStorage.getItem('timepop.recipient')) },
  ]
  return <main className="page content-page studio-home">
    <PageTitle eyebrow="TRACKBACK Studio" title="Van playlist naar spel" description="Drie duidelijke stappen. Alles wordt automatisch op dit toestel bewaard." />
    <section className="active-edition"><div className="active-record"><Music2 /></div><div><span className="eyebrow">Actieve editie</span><h2>{collection.name}</h2><p>{collection.tracks.length} nummers · klaar om te bewerken</p></div><button className="secondary-button" onClick={() => setTab('collection')}>Open editie <ChevronRight /></button></section>
    <div className="studio-flow">{steps.map(step => <article className={step.done ? 'is-done' : ''} key={step.number}><b>{step.done ? <Check /> : step.number}</b><step.icon /><div><h3>{step.title}</h3><p>{step.text}</p></div><button onClick={() => setTab(step.tab)}>{step.action}<ChevronRight /></button></article>)}</div>
    <section className="studio-gifts"><div><span className="eyebrow">Privé delen</span><h2>Cadeau-edities blijven verborgen</h2><p>Een persoonlijke editie opent alleen via de unieke cadeau-QR of link en verschijnt nooit in de algemene play-app.</p></div><Gift /></section>
  </main>
}

function CollectionPage({ collection, setCollection }) {
  const [editing, setEditing] = useState(null)
  const [adding, setAdding] = useState(false)
  const fileRef = useRef(null)
  const [presetBusy, setPresetBusy] = useState(false)
  const saveTrack = track => {
    const exists = collection.tracks.some(item => item.id === track.id)
    setCollection({ ...collection, tracks: exists ? collection.tracks.map(item => item.id === track.id ? normalizeTrack(track) : item) : [...collection.tracks, normalizeTrack(track)] })
    setEditing(null); setAdding(false)
  }
  const importFile = async file => {
    if (!file) return
    const text = await file.text()
    if (file.name.endsWith('.json')) {
      const data = JSON.parse(text)
      setCollection({ name: data.name || collection.name, tracks: data.tracks.map(normalizeTrack) })
    } else setCollection({ ...collection, tracks: [...collection.tracks, ...parseCsv(text)] })
  }
  const loadGuiltyPleasures = async () => {
    if (collection.tracks.length > 3 && !confirm('Huidige collectie vervangen door Guilty Pleasures (100 nummers)? Download eventueel eerst een JSON-back-up.')) return
    setPresetBusy(true)
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}decks/guilty-pleasures.json`)
      if (!response.ok) throw new Error('Deck kon niet worden geladen')
      const deck = await response.json()
      setCollection({ ...deck, tracks: deck.tracks.map(normalizeTrack) })
    } catch (error) { alert(error.message) } finally { setPresetBusy(false) }
  }
  return <main className="page content-page">
    <PageTitle eyebrow="Stap 2 van 3" title="Controleer je muziek" description={`${collection.tracks.length} kaarten · controleer titels, artiesten en vooral de oorspronkelijke jaartallen`} />
    <div className="toolbar">
      <button className="primary-button" onClick={() => setAdding(true)}><Plus /> Nummer</button>
      <button className="secondary-button" onClick={() => fileRef.current.click()}><FileUp /> CSV / JSON</button>
      <button className="preset-button" onClick={loadGuiltyPleasures} disabled={presetBusy}><Sparkles /> {presetBusy ? 'Laden…' : 'Guilty Pleasures · 100'}</button>
      <button className="icon-button" onClick={() => exportCollection(collection)} title="Back-up downloaden" aria-label="JSON-back-up downloaden"><Download /></button>
      <input ref={fileRef} type="file" accept=".csv,.json" hidden onChange={event => importFile(event.target.files[0])} />
    </div>
    <div className="track-list">{collection.tracks.map((track, index) => <article key={track.id} className="track-row">
      <span className="track-number">{String(index + 1).padStart(2, '0')}</span>
      <div className="track-thumb">{track.image ? <img src={track.image} alt="" /> : <Music2 />}</div>
      <div className="track-info"><strong>{track.title}</strong><span>{track.artist}</span></div>
      <span className="track-year">{track.year || '—'}</span>
      <button className="row-button" onClick={() => setEditing(track)} aria-label={`${track.title} bewerken`}><Pencil /></button>
      <button className="row-button danger" onClick={() => confirm(`‘${track.title}’ verwijderen?`) && setCollection({ ...collection, tracks: collection.tracks.filter(item => item.id !== track.id) })} aria-label={`${track.title} verwijderen`}><Trash2 /></button>
    </article>)}</div>
    {!collection.tracks.length && <Empty icon={Music2} title="Nog geen nummers" text="Voeg handmatig een nummer toe of importeer een bestand." />}
    {(editing || adding) && <TrackEditor initial={editing} onSave={saveTrack} onCancel={() => { setEditing(null); setAdding(false) }} />}
  </main>
}

function CardsPage({ collection }) {
  const [baseUrl, setBaseUrl] = useState(localStorage.getItem('giftster.base-url') || `${location.origin}${location.pathname}`)
  const [editionName, setEditionName] = useState(localStorage.getItem('timepop.edition-name') || collection.name || 'Guilty Pleasures')
  const [recipient, setRecipient] = useState(localStorage.getItem('timepop.recipient') || '')
  const clientId = getClientId()
  const theme = editionTheme(collection)
  const playbackReady = collection.tracks.length > 0 && (Boolean(clientId) || collection.tracks.every(track => track.audioUrl))
  const [printMode, setPrintMode] = useState('cards')
  const [printBusy, setPrintBusy] = useState(false)
  const cardUrl = track => `${baseUrl.replace(/\/$/, '')}?card=${encodeCard(track, clientId)}#play`
  const sheets = useMemo(() => Array.from({ length: Math.ceil(collection.tracks.length / 6) }, (_, i) => collection.tracks.slice(i * 6, i * 6 + 6)), [collection])
  const saveBase = value => { setBaseUrl(value); localStorage.setItem('giftster.base-url', value) }
  const bingoBoards = useMemo(() => Array.from({ length: 12 }, (_, board) => Array.from({ length: 9 }, (_, cell) => BINGO_SPACES[(board * 4 + cell * 7) % BINGO_SPACES.length])), [])
  const saveEdition = (key, value, setter) => { setter(value); localStorage.setItem(key, value) }
  const doPrint = async mode => {
    setPrintBusy(true); setPrintMode(mode)
    if (mode === 'cards') await Promise.all(collection.tracks.map(track => createQr(cardUrl(track), 360)))
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    print(); setPrintBusy(false)
  }
  return <main className={`page content-page cards-page print-${printMode} ${theme}`}>
    <PageTitle eyebrow="Stap 3 van 3" title="Personaliseer & print" description="Vul de naam in en kies daarna alleen wat je nodig hebt" />
    <div className="print-controls no-print"><div><div className="edition-fields"><label><span>Editienaam</span><input value={editionName} onChange={event => saveEdition('timepop.edition-name', event.target.value, setEditionName)} placeholder="Guilty Pleasures" /></label><label><span>Cadeau voor (optioneel)</span><input value={recipient} onChange={event => saveEdition('timepop.recipient', event.target.value, setRecipient)} placeholder="Bijvoorbeeld Sophie" /></label></div><details className="advanced-print"><summary>Geavanceerd: adres van de play-app</summary><label><span>Play-app URL</span><input value={baseUrl} onChange={event => saveBase(event.target.value)} /></label></details></div><div className="print-buttons"><button className="primary-button" disabled={!playbackReady || printBusy} onClick={() => doPrint('cards')}><Printer /> {printBusy ? 'Print klaarmaken…' : `${collection.tracks.length} QR-kaarten`}</button><button className="secondary-button" disabled={printBusy} onClick={() => doPrint('bingo')}><Grid3X3 /> Bingokaarten</button><button className="secondary-button" disabled={printBusy} onClick={() => doPrint('rules')}><FileText /> Cover, regels & score</button></div></div>
    <div className={`print-note no-print ${!playbackReady ? 'is-warning' : ''}`}><QrCode /><p>{playbackReady ? <><strong>Klaar om te printen.</strong> Iedere kaart bevat het nummer en opent direct in de play-app.</> : <><strong>Afspelen is nog niet ingesteld.</strong> Koppel eerst Spotify onder Importeren, of voeg eigen audio-URL's aan alle nummers toe.</>}</p></div>
    <div className="preview-heading no-print"><div><span className="eyebrow">Voorbeeld</span><h2>Zo zien de eerste kaarten eruit</h2></div><small>Bij printen worden alle {collection.tracks.length} kaarten gemaakt.</small></div>
    <div className="deck-preview">{collection.tracks.slice(0, 6).map((track, index) => <div className={`mini-card genre-${track.genre || 'pop'}`} key={track.id}><CardQr value={cardUrl(track)} size={190} /><span>KAART {String(index + 1).padStart(2, '0')}</span></div>)}</div>
    {printBusy && <div className="print-deck">{sheets.flatMap((sheet, sheetIndex) => [
      <section className="print-sheet fronts" key={`front-${sheetIndex}`}>{sheet.map((track, index) => <div className={`print-card card-front genre-${track.genre || 'pop'}`} key={track.id}><div className="card-brand"><Music2 /> TRACKBACK</div><div className="card-edition">{editionName || collection.name}</div><div className="card-qr-shell"><CardQr value={cardUrl(track)} size={360} /></div><strong>LISTEN · PLACE · REVEAL</strong><span>KAART {String(sheetIndex * 6 + index + 1).padStart(2, '0')}</span></div>)}</section>,
      <section className="print-sheet backs" key={`back-${sheetIndex}`}>{[...sheet].reduce((rows, item, i) => { const row = Math.floor(i / 2); (rows[row] ||= []).push(item); return rows }, []).flatMap(row => row.reverse()).map(track => <div className={`print-card card-back genre-${track.genre || 'pop'}`} key={track.id}><div className="back-brand">{editionName || collection.name}</div><span className="back-year">{track.year || '????'}</span><div><strong>{track.title}</strong><span>{track.artist}</span>{track.album && <small>{track.album}</small>}</div><Music2 /></div>)}</section>,
    ])}</div>}
    {printBusy && <div className="bingo-print-deck">{Array.from({ length: 6 }, (_, page) => <section className="bingo-print-page" key={page}>{bingoBoards.slice(page * 2, page * 2 + 2).map((board, index) => <div className="print-bingo-card" key={index}><header><div><Music2 /><strong>TRACKBACK</strong></div><span>MUZIEKBINGO · KAART {String(page * 2 + index + 1).padStart(2, '0')}</span></header><div className="print-bingo-grid">{board.map(([id, label]) => <span key={id}>{label}</span>)}</div><small>Een vak telt zodra de DJ het nummer onthult. Drie op een rij = BINGO!</small></div>)}</section>)}</div>}
    {printBusy && <div className="rules-print-deck">
      <section className="gift-cover"><div className="cover-orbit"><Music2 /></div><span className="cover-label">EEN PERSOONLIJKE TRACKBACK EDITIE</span><h1>{editionName || collection.name}</h1>{recipient && <h2>voor {recipient}</h2>}<p>De tijdlijn · drie bonusspellen · eindeloos veel muziek</p><div className="cover-games">{PRINT_GAME_MODES.map(game => <span key={game.id}><game.icon />{game.name}</span>)}</div><footer>TRACKBACK · LISTEN · PLACE · REVEAL</footer></section>
      <section className="rules-page"><header><Music2 /><div><strong>TRACKBACK</strong><span>{editionName || collection.name}</span></div></header><h1>De tijdlijn.<br />Plus drie extra's.</h1><p className="rules-intro">Begin met het Tijdlijnspel: geef iedereen één onthulde startkaart, scan een nieuwe kaart en leg de hit op de juiste plek. Zin in afwisseling? Kies daarna een compact bonusspel.</p><div className="rules-grid">{PRINT_GAME_MODES.map((game, index) => <article className={game.id === 'timeline' ? 'main-rule' : ''} key={game.id}><b>{game.id === 'timeline' ? 'HOOFDSPEL' : `0${index + 1}`}</b><game.icon /><h2>{game.name}</h2><p>{game.id === 'timeline' ? 'Iedereen begint met één kaart waarop het jaar zichtbaar is. Scan een nieuwe kaart en luister zonder titel of artiest. Leg hem vóór, na of tussen de hits in jouw tijdlijn. Goed geplaatst? Houd de kaart.' : game.id === 'guess' ? 'Schrijf of noem titel en artiest vóór de onthulling. Ieder goed antwoord is 1 punt.' : game.id === 'bingo' ? 'Iedereen pakt een bingokaart. Streep na iedere onthulling passende vakken af. Drie op een rij wint.' : 'De eerste hit is kampioen. Stem bij iedere nieuwe uitdager. De laatste overgebleven hit wint de avond.'}</p></article>)}</div><footer>TIP · Eén telefoon kan DJ zijn; de overige spelers hoeven dan niets te koppelen.</footer></section>
      <section className="score-page"><header><div><Music2 /><strong>TRACKBACK</strong></div><span>SCOREFORMULIER</span></header><h1>Wie kent de hits?</h1><div className="score-meta"><span>Datum ____________________</span><span>Team ____________________</span></div><table><thead><tr><th>Speler / team</th>{Array.from({ length: 10 }, (_, index) => <th key={index}>{index + 1}</th>)}<th>Totaal</th></tr></thead><tbody>{Array.from({ length: 10 }, (_, row) => <tr key={row}><td>{row + 1}. __________________</td>{Array.from({ length: 11 }, (_, cell) => <td key={cell} />)}</tr>)}</tbody></table><div className="score-notes"><strong>Finale / notities</strong></div><footer>Tijdlijn: 1 punt · Raad de hit: maximaal 2 punten · Bingo en Battle: speel om eeuwige roem</footer></section>
    </div>}
  </main>
}

function SettingsPage({ collection, setCollection }) {
  const [client, setClient] = useState(getClientId())
  const [playlist, setPlaylist] = useState('')
  const [status, setStatus] = useState(hasSpotifySession() ? 'Spotify is verbonden.' : '')
  const [busy, setBusy] = useState(false)
  const connect = async () => {
    try { setClientId(client); setStatus('Spotify-login wordt geopend…'); await loginSpotify() }
    catch (error) { setStatus(error.message) }
  }
  const doImport = async () => {
    setBusy(true); setStatus('Playlist wordt opgehaald…')
    try { const result = await importPlaylist(playlist); setCollection({ name: result.name, tracks: result.tracks.map(track => normalizeTrack({ ...track, id: randomId() })) }); setStatus(`${result.tracks.length} nummers geïmporteerd.`) }
    catch (error) { setStatus(error.message) } finally { setBusy(false) }
  }
  return <main className="page content-page settings-page">
    <PageTitle eyebrow="Stap 1 van 3" title="Koppel & importeer" description="Dit stel je één keer in; daarna kun je steeds nieuwe playlists omzetten naar een spel" />
    <section className="settings-card spotify-card"><div className="settings-icon spotify-icon"><Music2 /></div><div className="settings-body"><span className="eyebrow">Eenmalig op deze telefoon</span><h2>{hasSpotifySession() ? 'Spotify is verbonden' : 'Spotify koppelen'}</h2><p>TRACKBACK is al ingesteld. Log alleen in met het Spotify Premium-account waarmee je tijdens het spel wilt luisteren.</p><div className="spotify-actions"><button className="spotify-button" onClick={connect}>{hasSpotifySession() ? 'Spotify opnieuw koppelen' : 'Koppel Spotify'} <ExternalLink /></button>{hasSpotifySession() && <button className="secondary-button" onClick={() => location.assign(`${location.pathname}?resetSpotify=1#play`)}>Spotify ontkoppelen</button>}</div><details className="setup-help"><summary>Geavanceerd: andere Spotify Developer-app</summary><p>Alleen voor beheer: pas hier eventueel de Client ID aan en registreer exact deze Redirect URI.</p><code>{`${location.origin}${location.pathname}`}</code><label><span>Client ID</span><input value={client} onChange={event => { setClient(event.target.value); setClientId(event.target.value) }} /></label></details></div></section>
    <section className="settings-card import-card"><div className="settings-icon"><Import /></div><div className="settings-body"><span className="eyebrow">Maak een nieuwe editie</span><h2>Playlist importeren</h2><p>Plak een Spotify-playlistlink. De huidige muziekcollectie wordt na jouw bevestiging vervangen door de geïmporteerde playlist.</p><label><span>Spotify-playlistlink</span><input value={playlist} onChange={event => setPlaylist(event.target.value)} placeholder="https://open.spotify.com/playlist/…" /></label><button className="primary-button" disabled={!playlist || !hasSpotifySession() || busy} onClick={() => (!collection.tracks.length || confirm(`‘${collection.name}’ vervangen door deze Spotify-playlist?`)) && doImport()}><Import /> {busy ? 'Playlist ophalen…' : 'Importeer hele playlist'}</button>{!hasSpotifySession() ? <small className="field-help">Koppel hierboven eerst Spotify om te kunnen importeren.</small> : <small className="field-help">Spotify laat momenteel alleen playlists van jezelf of playlists waaraan je meewerkt volledig importeren.</small>}</div></section>
    {status && <div className="status-message"><Check /> {status}</div>}
    <details className="technical-details"><summary><Settings /> Testgebruikers, limieten & techniek</summary><section className="settings-card"><div className="settings-icon"><UserPlus /></div><div className="settings-body"><h2>Vrienden toelaten</h2><p>Voor een gezellige avond is één DJ-telefoon het eenvoudigst. De eigenaar van de Spotify-app heeft Premium nodig. Wil iemand toch op zijn eigen Spotify-account afspelen? Voeg die persoon dan in het Spotify Developer Dashboard toe via <strong>Settings → Users Management</strong>. Development Mode ondersteunt maximaal vijf Spotify-gebruikers.</p></div></section><section className="settings-card warning-card"><div className="settings-icon"><Gift /></div><div className="settings-body"><h2>Prototype en muziekrechten</h2><p>De verborgen Spotify-speler is bedoeld als privé technisch prototype. Spotify staat games met Spotify-content niet toe zonder afzonderlijke schriftelijke toestemming. Voor een volwaardige openbare app is daarom een productiegeschikte, rechtmatig gelicentieerde audiobron nodig.</p><small>Versie {APP_VERSION}</small></div></section></details>
  </main>
}

function PageTitle({ eyebrow, title, description }) { return <header className="page-title"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></header> }
function Empty({ icon: Icon, title, text }) { return <div className="empty"><Icon /><h3>{title}</h3><p>{text}</p></div> }

export default function App() {
  const [collection, setCollectionState] = useState(loadCurrentCollection)
  const [mode, setMode] = useState(location.hash === '#admin' ? 'admin' : 'play')
  const [tab, setTab] = useState('home')
  const [activeTrack, setActiveTrack] = useState(null)
  const [autoPlayTrackId, setAutoPlayTrackId] = useState('')
  const [playlistSession, setPlaylistSession] = useState(null)
  const [liveRoomId, setLiveRoomId] = useState(roomIdFromUrl)
  const [gift, setGift] = useState(null)
  const [giftError, setGiftError] = useState('')
  const [gameMode, setGameModeState] = useState(localStorage.getItem('timepop.game-mode') || 'timeline')
  const [playerCount, setPlayerCountState] = useState(() => clampPlayerCount(localStorage.getItem(GROUP_PLAYER_COUNT_KEY)))
  const setGameMode = mode => { localStorage.setItem('timepop.game-mode', mode); setGameModeState(mode) }
  const setPlayerCount = value => {
    const count = clampPlayerCount(value)
    localStorage.setItem(GROUP_PLAYER_COUNT_KEY, String(count))
    localStorage.setItem(DUO_SCORE_KEY, JSON.stringify(freshDuoMatch(count)))
    setPlayerCountState(count)
  }
  const setCollection = value => { setCollectionState(value); saveCollection(value) }
  const openLiveRoom = id => {
    const url = new URL(location.href)
    url.searchParams.delete('card')
    url.searchParams.set('room', id)
    url.hash = 'play'
    history.replaceState({}, '', url)
    setLiveRoomId(id); setMode('play')
  }
  const createLiveRoom = async (count, liveMode) => openLiveRoom(await createRoom({ maxPlayers: count, mode: liveMode }))
  const leaveLiveRoom = () => {
    const url = new URL(location.href)
    url.searchParams.delete('room')
    url.hash = 'play'
    history.replaceState({}, '', url)
    setLiveRoomId('')
  }
  const openGift = async ref => {
    setGiftError(''); setGift({ loading: true, recipient: 'Jouw cadeau', editions: [] })
    try {
      const loaded = await loadGift(ref)
      setGift(loaded); setMode('play')
    } catch (error) { setGift(null); setGiftError(error.message) }
  }
  const openEdition = edition => {
    const value = { ...edition, gameModes: gift?.gameModes || edition.gameModes, tracks: (edition.tracks || []).map(normalizeTrack) }
    const sharedClientId = edition.clientId || gift?.clientId
    if (sharedClientId) setClientId(sharedClientId)
    const allowedModes = value.gameModes?.length ? value.gameModes : GAME_MODES.map(game => game.id)
    if (!allowedModes.includes(gameMode)) setGameMode(allowedModes[0] || 'timeline')
    setCollection(value); setGift(null); history.replaceState({}, '', `${location.pathname}#play`)
  }

  const resolveCard = value => {
    const decoded = decodeCard(value)
    if (decoded) {
      if (decoded.clientId) setClientId(decoded.clientId)
      return decoded.track
    }
    const spotifyId = value.match(/open\.spotify\.com\/track\/([A-Za-z0-9]+)/)?.[1]
    return collection.tracks.find(item => item.id === value || (spotifyId && item.spotifyUri === `spotify:track:${spotifyId}`))
  }
  const startPlaylistGame = async playlist => {
    const track = await startSpotifyPlaylist(playlist)
    setPlaylistSession({ playlist, currentUri: track.spotifyUri })
    setAutoPlayTrackId('')
    setActiveTrack(normalizeTrack(track))
  }
  const nextPlaylistRound = async () => {
    if (!playlistSession) return
    try {
      const track = await nextSpotifyPlaylistTrack(playlistSession.currentUri, playlistSession.playlist)
      setPlaylistSession(current => ({ ...current, currentUri: track.spotifyUri }))
      setActiveTrack(normalizeTrack(track))
    } catch (error) { alert(error.message) }
  }

  useEffect(() => {
    const hadLegacyGift = clearSavedGiftRefs()
    if (hadLegacyGift && LEGACY_PRIVATE_EDITION_IDS.has(collection.id)) {
      clearCollection()
      setCollectionState(loadCollection())
    }
    const route = () => {
      setMode(location.hash === '#admin' ? 'admin' : 'play')
      setLiveRoomId(roomIdFromUrl())
      const giftRef = giftRefFromHash()
      if (giftRef) openGift(giftRef)
    }
    addEventListener('hashchange', route)
    const giftRef = giftRefFromHash()
    if (giftRef) openGift(giftRef)
    const cardValue = new URLSearchParams(location.search).get('card')
    if (cardValue) {
      const track = resolveCard(cardValue)
      if (track) setActiveTrack(track)
    }
    finishSpotifyLogin().then(connected => {
      if (connected) setMode(location.hash === '#admin' ? 'admin' : 'play')
      const pending = sessionStorage.getItem('giftster.pending-track')
      if (connected && pending) {
        sessionStorage.removeItem('giftster.pending-track')
        setActiveTrack(normalizeTrack(JSON.parse(pending)))
        history.replaceState({}, '', `${location.pathname}#play`)
        setMode('play')
      }
    }).catch(error => {
      setMode(location.hash === '#admin' ? 'admin' : 'play')
      alert(error.message)
    })
    return () => removeEventListener('hashchange', route)
  }, [])

  if (gift?.loading) return <main className="gift-loading"><Gift /><h1>Jouw cadeau wordt geopend…</h1></main>
  if (gift) return <GiftLanding gift={gift} onSelect={openEdition} onClose={() => { setGift(null); history.replaceState({}, '', `${location.pathname}#play`) }} />
  if (liveRoomId) return <MultiplayerRoom roomId={liveRoomId} resolveCard={resolveCard} onLeave={leaveLiveRoom} />
  if (activeTrack) return <Player key={activeTrack.id} track={activeTrack} gameMode={gameMode} playerCount={playerCount} autoPlay={autoPlayTrackId === activeTrack.id} playlistMode={Boolean(playlistSession)} onBack={() => { setAutoPlayTrackId(''); setPlaylistSession(null); setActiveTrack(null); pauseSpotify().catch(() => {}) }} onNext={playlistSession ? nextPlaylistRound : () => { setAutoPlayTrackId(''); setActiveTrack(null) }} />
  if (mode === 'play') return <><PlayHome collection={collection} onOpenTrack={track => { setPlaylistSession(null); setAutoPlayTrackId(track.id); setActiveTrack(track) }} onStartPlaylist={startPlaylistGame} onCreateRoom={createLiveRoom} resolveCard={resolveCard} gameMode={gameMode} setGameMode={setGameMode} playerCount={playerCount} setPlayerCount={setPlayerCount} />{giftError && <div className="toast error gift-error">{giftError}</div>}</>
  return <div className="app-shell">
    <header className="admin-topbar no-print"><a className="admin-logo" href="#admin"><span><Music2 /></span>TRACKBACK <small>STUDIO</small></a><a className="preview-link" href="#play"><Play /> Open play-app</a></header>
    {tab === 'home' && <StudioHome collection={collection} setTab={setTab} />}
    {tab === 'collection' && <CollectionPage collection={collection} setCollection={setCollection} />}
    {tab === 'cards' && <CardsPage collection={collection} />}
    {tab === 'settings' && <SettingsPage collection={collection} setCollection={setCollection} />}
    <nav className="bottom-nav admin-nav no-print">{ADMIN_NAV.map(item => <button className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)} key={item.id}><item.icon /><span>{item.label}</span></button>)}</nav>
  </div>
}
