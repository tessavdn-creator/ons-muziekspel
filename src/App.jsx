import { useEffect, useMemo, useRef, useState } from 'react'
import { BrowserQRCodeReader } from '@zxing/browser'
import QRCode from 'qrcode'
import {
  ArrowLeft, Check, ChevronRight, Clock3, Download, ExternalLink,
  FileText, FileUp, Gift, Grid3X3, ImageUp, Import, Library, Mic2, Music2, Pause, Pencil, Play,
  Plus, Printer, QrCode, RotateCcw, ScanLine, Settings, Sparkles, Trash2, Trophy, X,
  UserPlus,
} from 'lucide-react'
import {
  clearCollection, decodeCard, encodeCard, exportCollection, loadCollection, normalizeTrack, parseCsv,
  randomId, saveCollection,
} from './lib/collection.js'
import {
  activateSpotifyElement, connectPlayer, finishSpotifyLogin, getClientId, hasSpotifySession,
  importPlaylist, loginSpotify, pauseSpotify, playSpotify, setClientId,
} from './lib/spotify.js'
import { clearSavedGiftRefs, giftRefFromHash, loadGift } from './lib/gifts.js'

const ADMIN_NAV = [
  { id: 'home', label: 'Overzicht', icon: Sparkles },
  { id: 'collection', label: 'Muziek', icon: Library },
  { id: 'cards', label: 'Print & deel', icon: QrCode },
  { id: 'settings', label: 'Spotify', icon: Settings },
]
const APP_VERSION = '0.9.0 — TRACKBACK'
const LEGACY_PRIVATE_EDITION_IDS = new Set(['hidden-corners-01', 'time-warp-01', 'after-dark-01'])
const GAME_MODES = [
  { id: 'timeline', name: 'Tijdlijn', text: 'Leg de hit op de juiste plek in de tijd.', icon: Clock3, steps: ['Scan en speel de verborgen hit', 'Leg de kaart vóór, na of tussen je eerdere hits', 'Onthul het jaar en controleer de plek'], score: 'Goed geplaatst? Houd de kaart. De eerste met 10 kaarten wint.' },
  { id: 'guess', name: 'Raad de hit', text: 'Noem titel en artiest voordat je onthult.', icon: Mic2, steps: ['Scan en luister zonder naar de kaart te kijken', 'Vul titel en artiest in', 'Onthul het antwoord en tel de punten'], score: '1 punt voor de titel + 1 punt voor de artiest.' },
  { id: 'bingo', name: 'Muziekbingo', text: 'Streep decennia, genres en verrassingen af.', icon: Grid3X3, steps: ['Pak een geprinte of digitale bingokaart', 'Scan, luister en onthul het nummer', 'Streep ieder passend vak af'], score: 'Drie vakken op één horizontale, verticale of diagonale rij is bingo.' },
  { id: 'battle', name: 'Battle of the Hits', text: 'Stem welke guilty pleasure doorgaat.', icon: Trophy, steps: ['De eerste gescande hit wordt kampioen', 'Scan een nieuwe hit als uitdager', 'Iedereen stemt welke hit doorgaat'], score: 'De hit die aan het einde nog kampioen is, wint de avond.' },
]

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
const answerKey = value => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')

function GiftLanding({ gift, onSelect, onClose }) {
  return <main className="gift-landing">
    <button className="round-button gift-close" onClick={onClose} aria-label="Terug"><ArrowLeft /></button>
    <div className="gift-stars" aria-hidden="true"><i /><i /><i /><i /><i /></div>
    <header><div className="gift-seal"><Gift /></div><strong className="gift-brand">TRACKBACK</strong><span className="eyebrow">Speciaal samengesteld voor</span><h1>{gift.recipient}</h1><p>{gift.message}</p></header>
    {gift.taste?.length > 0 && <div className="taste-tags">{gift.taste.map(tag => <span key={tag}>{tag}</span>)}</div>}
    <section className="edition-shelf"><div className="edition-heading"><div><span className="eyebrow">Jouw platenkast</span><h2>Kies een editie</h2></div><small>{gift.editions.length} {gift.editions.length === 1 ? 'editie' : 'edities'}</small></div>
      <div className="edition-grid">{gift.editions.map((edition, index) => <article key={edition.id || edition.name}>
        <div className="edition-art">{edition.tracks?.[0]?.image ? <img src={edition.tracks[0].image} alt="" /> : <Music2 />}<b>{String(index + 1).padStart(2, '0')}</b></div>
        <div className="edition-copy"><span>{edition.subtitle || 'Persoonlijke mix'}</span><h3>{edition.name}</h3><p>{edition.description}</p><small>{edition.tracks?.length || 0} nummers {edition.difficulty === 'expert' ? '· Expert' : ''}</small></div>
        <button className="primary-button" onClick={() => onSelect(edition)}>Open editie <ChevronRight /></button>
      </article>)}</div>
      <p className="edition-update"><Sparkles /> Nieuwe edities die voor jou worden gemaakt verschijnen automatisch achter dezelfde persoonlijke QR.</p>
    </section>
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
  if (!champion || champion.id === track.id) return <div className="game-result battle-result"><Trophy /><div><strong>{champion ? 'Regerend kampioen' : 'Start de battle'}</strong><span>{track.title}</span></div>{!champion && <button onClick={() => choose(track)}>Maak kampioen</button>}</div>
  return <div className="game-result"><div className="result-heading"><Trophy /><strong>Wie gaat door?</strong></div><div className="battle-buttons"><button onClick={() => choose(champion)}><small>Kampioen</small>{champion.title}<span>{champion.artist}</span></button><b>VS</b><button onClick={() => choose(track)}><small>Uitdager</small>{track.title}<span>{track.artist}</span></button></div></div>
}

function Player({ track, onBack, onNext, gameMode }) {
  const [revealed, setRevealed] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [message, setMessage] = useState('Klaar om af te spelen')
  const [titleGuess, setTitleGuess] = useState('')
  const [artistGuess, setArtistGuess] = useState('')
  const audioRef = useRef(null)
  useEffect(() => () => { audioRef.current?.pause(); pauseSpotify().catch(() => {}) }, [track?.id])

  const start = async () => {
    activateSpotifyElement()?.catch(() => {})
    try {
      setMessage('Muziek wordt gestart…')
      if (track.audioUrl) {
        audioRef.current = new Audio(track.audioUrl)
        audioRef.current.addEventListener('ended', () => setPlaying(false))
        await audioRef.current.play()
      } else if (track.spotifyUri && hasSpotifySession()) {
        await playSpotify(track.spotifyUri, state => state?.error && setMessage(state.error))
      } else if (track.spotifyUri) {
        sessionStorage.setItem('giftster.pending-track', JSON.stringify(track))
        setMessage('Je wordt veilig met Spotify verbonden…')
        await loginSpotify()
        return
      } else throw new Error('Deze kaart heeft nog geen interne afspeelbron.')
      setPlaying(true)
      if (track.audioUrl || hasSpotifySession()) setMessage('Nu aan het spelen')
    } catch (error) { setMessage(error.message); setPlaying(false) }
  }
  const pause = async () => {
    audioRef.current?.pause()
    await pauseSpotify().catch(() => {})
    setPlaying(false); setMessage('Gepauzeerd')
  }
  return <main className={`player-screen theme-${track.genre || 'pop'} ${revealed ? 'is-revealed' : ''}`}>
    <header className="player-header">
      <button className="round-button" onClick={onBack}><ArrowLeft /></button>
      <span>{GAME_MODES.find(game => game.id === gameMode)?.name || 'Kaart gevonden'}</span><span className="status-dot" />
    </header>
    {!revealed ? <>
      <div className="secret-art"><div className="record"><Music2 /><span /></div><div className="sound-wave">{[1,2,3,4,5,6,7].map(i => <i key={i} />)}</div></div>
      <div className="secret-copy"><span className="eyebrow">Geheim nummer</span><h1>Luister goed…</h1><p>{message}</p></div>
      <button className="play-or-pause" onClick={playing ? pause : start}>{playing ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}</button>
      {gameMode === 'guess' && <div className="guess-fields"><input value={titleGuess} onChange={event => setTitleGuess(event.target.value)} placeholder="Titel…" /><input value={artistGuess} onChange={event => setArtistGuess(event.target.value)} placeholder="Artiest…" /></div>}
      <button className="reveal-button" onClick={() => setRevealed(true)}><Sparkles /> Onthul het nummer</button>
    </> : <>
      <div className="reveal-art">{track.image ? <img src={track.image} alt="" /> : <div><Music2 /></div>}<span className="year-stamp">{track.year || '????'}</span></div>
      <div className="reveal-copy"><span className="eyebrow">Het was…</span><h1>{track.title}</h1><p>{track.artist}</p>{track.album && <small>{track.album}</small>}</div>
      {gameMode === 'guess' && <div className="game-result guess-result"><strong>{Number(answerKey(track.title).includes(answerKey(titleGuess)) && titleGuess.length > 2) + Number(answerKey(track.artist).includes(answerKey(artistGuess)) && artistGuess.length > 2)} / 2 punten</strong><span>Titel {answerKey(track.title).includes(answerKey(titleGuess)) && titleGuess.length > 2 ? '✓' : '✕'} · Artiest {answerKey(track.artist).includes(answerKey(artistGuess)) && artistGuess.length > 2 ? '✓' : '✕'}</span></div>}
      {gameMode === 'bingo' && <BingoResult track={track} />}
      {gameMode === 'battle' && <BattleResult track={track} />}
      <div className="player-actions">
        <button className="secondary-button" onClick={() => setRevealed(false)}><RotateCcw /> Verberg</button>
        <button className="primary-button" onClick={onNext}>Volgende kaart <ChevronRight /></button>
      </div>
    </>}
  </main>
}

function PlayHome({ collection, onOpenTrack, resolveCard, gameMode, setGameMode }) {
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState('')
  const [showAlternatives, setShowAlternatives] = useState(gameMode !== 'timeline')
  const activeGame = GAME_MODES.find(game => game.id === gameMode) || GAME_MODES[0]
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
      <span className="eyebrow">Het hoofdspel</span>
      <h1>Luister.<br /><em>Leg de tijdlijn.</em></h1>
      <p>Hoor een verborgen hit en bepaal of hij vóór, na of tussen de kaarten op tafel hoort.</p>
      <button className={`main-game-card ${gameMode === 'timeline' ? 'active' : ''}`} onClick={() => { setGameMode('timeline'); setShowAlternatives(false) }}>
        <div className="main-game-title"><span><Clock3 /></span><div><small>Aanbevolen · hoofdspel</small><strong>Tijdlijn</strong></div>{gameMode === 'timeline' && <Check />}</div>
        <ol><li><b>1</b> Scan een kaart</li><li><b>2</b> Luister zonder titel</li><li><b>3</b> Leg hem in de tijd</li></ol>
      </button>
      <div className="game-switch-bar"><span><activeGame.icon /><small>Je speelt</small><strong>{activeGame.name}</strong></span><button onClick={() => setShowAlternatives(value => !value)}>{showAlternatives ? 'Sluiten' : 'Wissel spel'} <ChevronRight /></button></div>
      {showAlternatives && <div className="alternate-games">{GAME_MODES.map(game => <button className={gameMode === game.id ? 'active' : ''} key={game.id} onClick={() => { setGameMode(game.id); setShowAlternatives(false) }}><game.icon /><span><strong>{game.name}</strong><small>{game.text}</small></span>{gameMode === game.id && <Check />}</button>)}</div>}
      <div className="game-explanation"><div className="explanation-title"><activeGame.icon /><div><small>Zo speel je</small><strong>{activeGame.name}</strong></div></div><ol>{activeGame.steps.map((step, index) => <li key={step}><b>{index + 1}</b>{step}</li>)}</ol><p><Trophy /> {activeGame.score}</p></div>
      <button className="scan-button" onClick={() => setScanning(true)}><span><ScanLine /></span>{gameMode === 'timeline' ? 'Scan voor de tijdlijn' : `Scan voor ${activeGame.name}`}</button>
      {error && <div className="inline-error">{error}</div>}
    </section>
    <section className="quick-test">
      <span>Snel testen</span>
      <div>{collection.tracks.slice(0, 3).map((track, index) => <button key={track.id} onClick={() => onOpenTrack(track)}><b>{String(index + 1).padStart(2, '0')}</b><span>Verborgen kaart</span><ChevronRight /></button>)}</div>
    </section>
  </main>
}

function TrackEditor({ initial, onSave, onCancel }) {
  const [track, setTrack] = useState(normalizeTrack(initial || {}))
  const field = (key, label, placeholder) => <label><span>{label}</span><input value={track[key]} placeholder={placeholder} onChange={event => setTrack({ ...track, [key]: event.target.value })} /></label>
  return <div className="modal-layer"><form className="modal-card" onSubmit={event => { event.preventDefault(); onSave(track) }}>
    <div className="modal-title"><div><span className="eyebrow">Kaartgegevens</span><h2>{initial ? 'Nummer bewerken' : 'Nummer toevoegen'}</h2></div><button type="button" className="round-button" onClick={onCancel}><X /></button></div>
    <div className="form-grid">{field('title', 'Titel', 'Bijvoorbeeld: Dreams')}{field('artist', 'Artiest', 'The Cranberries')}{field('year', 'Jaar', '1993')}{field('album', 'Album', 'No Need to Argue')}<label><span>Genrethema</span><select value={track.genre} onChange={event => setTrack({ ...track, genre: event.target.value })}><option value="pop">Pop neon</option><option value="disco">Disco fever</option><option value="rock">Rock stage</option><option value="electronic">Electronic club</option><option value="soul">Soul lounge</option></select></label>{field('externalUrl', 'Spotify-link', 'https://open.spotify.com/track/…')}{field('audioUrl', 'Directe audio-URL (optioneel)', 'https://…/nummer.mp3')}</div>
    <button className="primary-button wide" disabled={!track.title || !track.artist}><Check /> Opslaan</button>
  </form></div>
}

function StudioHome({ collection, setTab }) {
  const hasClient = Boolean(getClientId())
  const steps = [
    { number: '01', title: 'Kies de muziek', text: `${collection.name} · ${collection.tracks.length} nummers actief`, icon: Music2, action: 'Nummers beheren', tab: 'collection', done: collection.tracks.length > 0 },
    { number: '02', title: 'Maak het persoonlijk', text: 'Geef de editie een naam en vul de ontvanger in.', icon: Gift, action: 'Personaliseren', tab: 'cards', done: Boolean(localStorage.getItem('timepop.recipient')) },
    { number: '03', title: 'Controleer Spotify', text: hasClient ? 'Client ID staat klaar voor de QR-kaarten.' : 'Client ID ontbreekt nog.', icon: Settings, action: hasClient ? 'Instellingen bekijken' : 'Spotify instellen', tab: 'settings', done: hasClient },
    { number: '04', title: 'Print en geef cadeau', text: 'Tijdlijn als hoofdspel, met drie bonusvarianten.', icon: Printer, action: 'Naar printstudio', tab: 'cards', done: false },
  ]
  return <main className="page content-page studio-home">
    <PageTitle eyebrow="TRACKBACK Studio" title="Van playlist naar cadeau" description="Werk de vier stappen af; de studio bewaart alles automatisch op dit toestel." />
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
    <PageTitle eyebrow="Stap 1 van 4" title="Muziek in deze editie" description={`${collection.tracks.length} kaarten klaar voor het spel`} />
    <div className="toolbar">
      <button className="primary-button" onClick={() => setAdding(true)}><Plus /> Nummer</button>
      <button className="secondary-button" onClick={() => fileRef.current.click()}><FileUp /> CSV / JSON</button>
      <button className="preset-button" onClick={loadGuiltyPleasures} disabled={presetBusy}><Sparkles /> {presetBusy ? 'Laden…' : 'Guilty Pleasures · 100'}</button>
      <button className="icon-button" onClick={() => exportCollection(collection)} title="Back-up downloaden"><Download /></button>
      <input ref={fileRef} type="file" accept=".csv,.json" hidden onChange={event => importFile(event.target.files[0])} />
    </div>
    <div className="track-list">{collection.tracks.map((track, index) => <article key={track.id} className="track-row">
      <span className="track-number">{String(index + 1).padStart(2, '0')}</span>
      <div className="track-thumb">{track.image ? <img src={track.image} alt="" /> : <Music2 />}</div>
      <div className="track-info"><strong>{track.title}</strong><span>{track.artist}</span></div>
      <span className="track-year">{track.year || '—'}</span>
      <button className="row-button" onClick={() => setEditing(track)}><Pencil /></button>
      <button className="row-button danger" onClick={() => confirm(`‘${track.title}’ verwijderen?`) && setCollection({ ...collection, tracks: collection.tracks.filter(item => item.id !== track.id) })}><Trash2 /></button>
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
  return <main className={`page content-page cards-page print-${printMode}`}>
    <PageTitle eyebrow="Stap 2 en 4" title="Personaliseren, printen & delen" description="Maak eerst het cadeau persoonlijk en kies daarna wat je wilt afdrukken" />
    <div className="print-controls no-print"><div className="edition-fields"><label><span>Editienaam</span><input value={editionName} onChange={event => saveEdition('timepop.edition-name', event.target.value, setEditionName)} placeholder="Guilty Pleasures" /></label><label><span>Cadeau voor</span><input value={recipient} onChange={event => saveEdition('timepop.recipient', event.target.value, setRecipient)} placeholder="Bijvoorbeeld Sophie" /></label><label><span>Adres van de play-app</span><input value={baseUrl} onChange={event => saveBase(event.target.value)} /></label></div><div className="print-buttons"><button className="primary-button" disabled={!clientId || printBusy} onClick={() => doPrint('cards')}><Printer /> {printBusy ? 'QR-codes maken…' : `${collection.tracks.length} kaarten`}</button><button className="secondary-button" disabled={printBusy} onClick={() => doPrint('bingo')}><Grid3X3 /> 12 bingokaarten</button><button className="secondary-button" disabled={printBusy} onClick={() => doPrint('rules')}><FileText /> Cover + regels + score</button></div></div>
    <div className={`print-note no-print ${!clientId ? 'is-warning' : ''}`}><QrCode /><p>{clientId ? <><strong>Zelfstandige QR-kaarten.</strong> Je vriend hoeft de collectie niet te importeren; de kaart opent direct in de play-app.</> : <><strong>Client ID ontbreekt.</strong> Vul die eerst in onder Instellen, anders kunnen andere telefoons Spotify niet koppelen.</>}</p></div>
    <div className="deck-preview">{collection.tracks.map((track, index) => <div className={`mini-card genre-${track.genre || 'pop'}`} key={track.id}><CardQr value={cardUrl(track)} size={190} /><span>KAART {String(index + 1).padStart(2, '0')}</span></div>)}</div>
    <div className="print-deck">{sheets.flatMap((sheet, sheetIndex) => [
      <section className="print-sheet fronts" key={`front-${sheetIndex}`}>{sheet.map((track, index) => <div className={`print-card card-front genre-${track.genre || 'pop'}`} key={track.id}><div className="card-brand"><Music2 /> TRACKBACK</div><div className="card-edition">{editionName || collection.name}</div><div className="card-qr-shell"><CardQr value={cardUrl(track)} size={360} /></div><strong>LISTEN · PLACE · REVEAL</strong><span>KAART {String(sheetIndex * 6 + index + 1).padStart(2, '0')}</span></div>)}</section>,
      <section className="print-sheet backs" key={`back-${sheetIndex}`}>{[...sheet].reduce((rows, item, i) => { const row = Math.floor(i / 2); (rows[row] ||= []).push(item); return rows }, []).flatMap(row => row.reverse()).map(track => <div className="print-card card-back" key={track.id}><div className="back-brand">{editionName || collection.name}</div><span className="back-year">{track.year || '????'}</span><div><strong>{track.title}</strong><span>{track.artist}</span>{track.album && <small>{track.album}</small>}</div><Music2 /></div>)}</section>,
    ])}</div>
    <div className="bingo-print-deck">{Array.from({ length: 6 }, (_, page) => <section className="bingo-print-page" key={page}>{bingoBoards.slice(page * 2, page * 2 + 2).map((board, index) => <div className="print-bingo-card" key={index}><header><div><Music2 /><strong>TRACKBACK</strong></div><span>MUZIEKBINGO · KAART {String(page * 2 + index + 1).padStart(2, '0')}</span></header><div className="print-bingo-grid">{board.map(([id, label]) => <span key={id}>{label}</span>)}</div><small>Een vak telt zodra de DJ het nummer onthult. Drie op een rij = BINGO!</small></div>)}</section>)}</div>
    <div className="rules-print-deck">
      <section className="gift-cover"><div className="cover-orbit"><Music2 /></div><span className="cover-label">EEN PERSOONLIJKE TRACKBACK EDITIE</span><h1>{editionName || collection.name}</h1>{recipient && <h2>voor {recipient}</h2>}<p>De tijdlijn · drie bonusspellen · eindeloos veel muziek</p><div className="cover-games">{GAME_MODES.map(game => <span key={game.id}><game.icon />{game.name}</span>)}</div><footer>TRACKBACK · LISTEN · PLACE · REVEAL</footer></section>
      <section className="rules-page"><header><Music2 /><div><strong>TRACKBACK</strong><span>{editionName || collection.name}</span></div></header><h1>De tijdlijn.<br />Plus drie extra's.</h1><p className="rules-intro">Begin met het Tijdlijnspel: scan, luister en leg de hit op de juiste plek. Zin in afwisseling? Kies daarna een van de compacte bonusspellen.</p><div className="rules-grid">{GAME_MODES.map((game, index) => <article className={game.id === 'timeline' ? 'main-rule' : ''} key={game.id}><b>{game.id === 'timeline' ? 'HOOFDSPEL' : `0${index + 1}`}</b><game.icon /><h2>{game.name}</h2><p>{game.id === 'timeline' ? 'Scan een kaart en luister zonder titel of artiest te zien. Leg hem vóór, na of tussen de hits in jouw tijdlijn. Goed geplaatst? Houd de kaart en verdien 1 punt.' : game.id === 'guess' ? 'Schrijf of noem titel en artiest vóór de onthulling. Ieder goed antwoord is 1 punt.' : game.id === 'bingo' ? 'Iedereen pakt een bingokaart. Streep na iedere onthulling passende vakken af. Drie op een rij wint.' : 'De eerste hit is kampioen. Stem bij iedere nieuwe uitdager. De laatste overgebleven hit wint de avond.'}</p></article>)}</div><footer>TIP · Eén telefoon kan DJ zijn; de overige spelers hoeven dan niets te koppelen.</footer></section>
      <section className="score-page"><header><div><Music2 /><strong>TRACKBACK</strong></div><span>SCOREFORMULIER</span></header><h1>Wie kent de hits?</h1><div className="score-meta"><span>Datum ____________________</span><span>Team ____________________</span></div><table><thead><tr><th>Speler / team</th>{Array.from({ length: 10 }, (_, index) => <th key={index}>{index + 1}</th>)}<th>Totaal</th></tr></thead><tbody>{Array.from({ length: 10 }, (_, row) => <tr key={row}><td>{row + 1}. __________________</td>{Array.from({ length: 11 }, (_, cell) => <td key={cell} />)}</tr>)}</tbody></table><div className="score-notes"><strong>Finale / notities</strong></div><footer>Tijdlijn: 1 punt · Raad de hit: maximaal 2 punten · Bingo en Battle: speel om eeuwige roem</footer></section>
    </div>
  </main>
}

function SettingsPage({ collection, setCollection }) {
  const [client, setClient] = useState(getClientId())
  const [playlist, setPlaylist] = useState('')
  const [status, setStatus] = useState(hasSpotifySession() ? 'Spotify is verbonden.' : '')
  const [busy, setBusy] = useState(false)
  const connect = async () => { setClientId(client); await loginSpotify() }
  const doImport = async () => {
    setBusy(true); setStatus('Playlist wordt opgehaald…')
    try { const result = await importPlaylist(playlist); setCollection({ name: result.name, tracks: result.tracks.map(track => normalizeTrack({ ...track, id: randomId() })) }); setStatus(`${result.tracks.length} nummers geïmporteerd.`) }
    catch (error) { setStatus(error.message) } finally { setBusy(false) }
  }
  return <main className="page content-page settings-page">
    <PageTitle eyebrow="Stap 3 van 4" title="Spotify & afspelen" description="Koppel Spotify of werk volledig met eigen audiobestanden" />
    <section className="settings-card spotify-card"><div className="settings-icon spotify-icon"><Music2 /></div><div className="settings-body"><span className="eyebrow">Gedeelde Spotify-app</span><h2>Spotify koppelen</h2><p>Deze publieke Client ID wordt veilig in iedere nieuwe QR opgenomen. Vrienden loggen daarmee op hun eigen Spotify-account in.</p><p>Voeg exact deze Redirect URI toe in het Spotify Developer Dashboard:</p><code>{`${location.origin}${location.pathname}`}</code><label><span>Client ID</span><input value={client} onChange={event => { setClient(event.target.value); setClientId(event.target.value) }} placeholder="Bijvoorbeeld 1a2b3c…" /></label><button className="spotify-button" onClick={connect}>Verbinden met Spotify <ExternalLink /></button></div></section>
    <section className="settings-card"><div className="settings-icon"><Import /></div><div className="settings-body"><h2>Playlist importeren</h2><p>Onder development mode werkt dit voor een playlist waarvan jouw Spotify-account eigenaar of collaborator is.</p><label><span>Spotify-playlistlink</span><input value={playlist} onChange={event => setPlaylist(event.target.value)} placeholder="https://open.spotify.com/playlist/…" /></label><button className="primary-button" disabled={!playlist || !hasSpotifySession() || busy} onClick={doImport}><Import /> {busy ? 'Bezig…' : 'Hele playlist importeren'}</button></div></section>
    {status && <div className="status-message"><Check /> {status}</div>}
    <section className="settings-card"><div className="settings-icon"><UserPlus /></div><div className="settings-body"><h2>Vrienden toelaten</h2><p>Open jouw app in het Spotify Developer Dashboard en ga naar <strong>Settings → Users Management → Add new user</strong>. Voeg daar de naam en het Spotify-e-mailadres van je vriend toe. In Development Mode kunnen maximaal vijf Spotify-gebruikers de play-app gebruiken.</p></div></section>
    <section className="settings-card warning-card"><div className="settings-icon"><Gift /></div><div className="settings-body"><h2>Goed om te weten</h2><p>De verborgen Spotify-speler is bedoeld als privé technisch prototype. Spotify vereist normaal zichtbare metadata en staat muziektrivia zonder aparte toestemming niet toe. Voor volledig zelfstandige playback kun je per nummer een eigen, rechtmatig gebruikte audio-URL invullen.</p><small>Versie {APP_VERSION}</small></div></section>
  </main>
}

function PageTitle({ eyebrow, title, description }) { return <header className="page-title"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></header> }
function Empty({ icon: Icon, title, text }) { return <div className="empty"><Icon /><h3>{title}</h3><p>{text}</p></div> }

export default function App() {
  const [collection, setCollectionState] = useState(loadCollection)
  const [mode, setMode] = useState(location.hash === '#admin' ? 'admin' : 'play')
  const [tab, setTab] = useState('home')
  const [activeTrack, setActiveTrack] = useState(null)
  const [gift, setGift] = useState(null)
  const [giftError, setGiftError] = useState('')
  const [gameMode, setGameModeState] = useState(localStorage.getItem('timepop.game-mode') || 'timeline')
  const setGameMode = mode => { localStorage.setItem('timepop.game-mode', mode); setGameModeState(mode) }
  const setCollection = value => { setCollectionState(value); saveCollection(value) }
  const openGift = async ref => {
    setGiftError(''); setGift({ loading: true, recipient: 'Jouw cadeau', editions: [] })
    try {
      const loaded = await loadGift(ref)
      setGift(loaded); setMode('play')
    } catch (error) { setGift(null); setGiftError(error.message) }
  }
  const openEdition = edition => {
    const value = { ...edition, tracks: (edition.tracks || []).map(normalizeTrack) }
    setCollectionState(value); setGift(null); history.replaceState({}, '', `${location.pathname}#play`)
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

  useEffect(() => {
    const hadLegacyGift = clearSavedGiftRefs()
    if (hadLegacyGift && LEGACY_PRIVATE_EDITION_IDS.has(collection.id)) {
      clearCollection()
      setCollectionState(loadCollection())
    }
    const route = () => {
      setMode(location.hash === '#admin' ? 'admin' : 'play')
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
      if (connected || hasSpotifySession()) connectPlayer().catch(() => {})
      const pending = sessionStorage.getItem('giftster.pending-track')
      if (connected && pending) {
        sessionStorage.removeItem('giftster.pending-track')
        setActiveTrack(normalizeTrack(JSON.parse(pending)))
        history.replaceState({}, '', `${location.pathname}#play`)
      }
    }).catch(error => alert(error.message))
    return () => removeEventListener('hashchange', route)
  }, [])

  if (gift?.loading) return <main className="gift-loading"><Gift /><h1>Jouw cadeau wordt geopend…</h1></main>
  if (gift) return <GiftLanding gift={gift} onSelect={openEdition} onClose={() => { setGift(null); history.replaceState({}, '', `${location.pathname}#play`) }} />
  if (activeTrack) return <Player track={activeTrack} gameMode={gameMode} onBack={() => setActiveTrack(null)} onNext={() => setActiveTrack(null)} />
  if (mode === 'play') return <><PlayHome collection={collection} onOpenTrack={setActiveTrack} resolveCard={resolveCard} gameMode={gameMode} setGameMode={setGameMode} />{giftError && <div className="toast error gift-error">{giftError}</div>}</>
  return <div className="app-shell">
    <header className="admin-topbar no-print"><a className="admin-logo" href="#admin"><span><Music2 /></span>TRACKBACK <small>STUDIO</small></a><a className="preview-link" href="#play"><Play /> Open play-app</a></header>
    {tab === 'home' && <StudioHome collection={collection} setTab={setTab} />}
    {tab === 'collection' && <CollectionPage collection={collection} setCollection={setCollection} />}
    {tab === 'cards' && <CardsPage collection={collection} />}
    {tab === 'settings' && <SettingsPage collection={collection} setCollection={setCollection} />}
    <nav className="bottom-nav admin-nav no-print">{ADMIN_NAV.map(item => <button className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)} key={item.id}><item.icon /><span>{item.label}</span></button>)}</nav>
  </div>
}
