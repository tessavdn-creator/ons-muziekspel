import { useEffect, useMemo, useRef, useState } from 'react'
import { BrowserQRCodeReader } from '@zxing/browser'
import QRCode from 'qrcode'
import {
  ArrowLeft, Camera, Check, ChevronRight, CirclePlay, Download, ExternalLink,
  FileUp, Gift, Import, Library, Music2, Pause, Pencil, Play, Plus, Printer,
  QrCode, RotateCcw, ScanLine, Settings, Sparkles, Trash2, X,
  UserPlus,
} from 'lucide-react'
import {
  decodeCard, encodeCard, exportCollection, loadCollection, normalizeTrack, parseCsv,
  randomId, saveCollection,
} from './lib/collection.js'
import {
  activateSpotifyElement, connectPlayer, finishSpotifyLogin, getClientId, hasSpotifySession,
  importPlaylist, loginSpotify, pauseSpotify, playSpotify, setClientId,
} from './lib/spotify.js'

const ADMIN_NAV = [
  { id: 'collection', label: 'Collectie', icon: Library },
  { id: 'cards', label: 'Kaarten', icon: QrCode },
  { id: 'settings', label: 'Instellen', icon: Settings },
  { id: 'preview', label: 'Play-app', icon: CirclePlay },
]
const APP_VERSION = '0.4.0 — admin + play'

function CardQr({ value, size = 220 }) {
  const [src, setSrc] = useState('')
  useEffect(() => { QRCode.toDataURL(value, { width: size, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#15120f', light: '#fffaf1' } }).then(setSrc) }, [value, size])
  return src ? <img className="qr-image" src={src} alt="QR-code" /> : <div className="qr-placeholder" />
}

function ScannerView({ onScan, onClose }) {
  const videoRef = useRef(null)
  const [error, setError] = useState('')
  useEffect(() => {
    const reader = new BrowserQRCodeReader()
    let controls
    reader.decodeFromVideoDevice(undefined, videoRef.current, result => {
      if (result) {
        controls?.stop()
        onScan(result.getText())
      }
    }).then(value => { controls = value }).catch(() => setError('Camera kon niet starten. Geef cameratoegang en probeer opnieuw.'))
    return () => controls?.stop()
  }, [onScan])
  return <div className="scanner-screen">
    <button className="round-button scanner-close" onClick={onClose} aria-label="Sluiten"><X /></button>
    <div className="scanner-copy"><span>Richt op de kaart</span><small>De muziek blijft geheim</small></div>
    <video ref={videoRef} muted playsInline />
    <div className="scan-frame"><i /><i /><i /><i /><div className="scan-line" /></div>
    {error && <div className="toast error">{error}</div>}
  </div>
}

function Player({ track, onBack, onNext }) {
  const [revealed, setRevealed] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [message, setMessage] = useState('Klaar om af te spelen')
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
  return <main className={`player-screen ${revealed ? 'is-revealed' : ''}`}>
    <header className="player-header">
      <button className="round-button" onClick={onBack}><ArrowLeft /></button>
      <span>Kaart gevonden</span><span className="status-dot" />
    </header>
    {!revealed ? <>
      <div className="secret-art"><div className="record"><Music2 /><span /></div><div className="sound-wave">{[1,2,3,4,5,6,7].map(i => <i key={i} />)}</div></div>
      <div className="secret-copy"><span className="eyebrow">Geheim nummer</span><h1>Luister goed…</h1><p>{message}</p></div>
      <button className="play-or-pause" onClick={playing ? pause : start}>{playing ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}</button>
      <button className="reveal-button" onClick={() => setRevealed(true)}><Sparkles /> Onthul het nummer</button>
    </> : <>
      <div className="reveal-art">{track.image ? <img src={track.image} alt="" /> : <div><Music2 /></div>}<span className="year-stamp">{track.year || '????'}</span></div>
      <div className="reveal-copy"><span className="eyebrow">Het was…</span><h1>{track.title}</h1><p>{track.artist}</p>{track.album && <small>{track.album}</small>}</div>
      <div className="player-actions">
        <button className="secondary-button" onClick={() => setRevealed(false)}><RotateCcw /> Verberg</button>
        <button className="primary-button" onClick={onNext}>Volgende kaart <ChevronRight /></button>
      </div>
    </>}
  </main>
}

function PlayHome({ collection, onOpenTrack, resolveCard }) {
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState('')
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
    <div className="hero-brand"><div className="brand-mark"><Music2 /></div><span>TIMEPOP</span></div>
    <section className="play-hero">
      <span className="eyebrow">Muziek door de jaren</span>
      <h1>Scan. Luister.<br /><em>Raad de tijd.</em></h1>
      <p>Scan een kaart zonder te verklappen welk nummer er speelt.</p>
      <button className="scan-button" onClick={() => setScanning(true)}><span><ScanLine /></span>Scan een kaart</button>
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
    <div className="form-grid">{field('title', 'Titel', 'Bijvoorbeeld: Dreams')}{field('artist', 'Artiest', 'The Cranberries')}{field('year', 'Jaar', '1993')}{field('album', 'Album', 'No Need to Argue')}{field('externalUrl', 'Spotify-link', 'https://open.spotify.com/track/…')}{field('audioUrl', 'Directe audio-URL (optioneel)', 'https://…/nummer.mp3')}</div>
    <button className="primary-button wide" disabled={!track.title || !track.artist}><Check /> Opslaan</button>
  </form></div>
}

function CollectionPage({ collection, setCollection }) {
  const [editing, setEditing] = useState(null)
  const [adding, setAdding] = useState(false)
  const fileRef = useRef(null)
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
  return <main className="page content-page">
    <PageTitle eyebrow="Jouw muziek" title="Collectie" description={`${collection.tracks.length} kaarten klaar voor het spel`} />
    <div className="toolbar">
      <button className="primary-button" onClick={() => setAdding(true)}><Plus /> Nummer</button>
      <button className="secondary-button" onClick={() => fileRef.current.click()}><FileUp /> CSV / JSON</button>
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
  const clientId = getClientId()
  const cardUrl = track => `${baseUrl.replace(/\/$/, '')}?card=${encodeCard(track, clientId)}#play`
  const sheets = useMemo(() => Array.from({ length: Math.ceil(collection.tracks.length / 6) }, (_, i) => collection.tracks.slice(i * 6, i * 6 + 6)), [collection])
  const saveBase = value => { setBaseUrl(value); localStorage.setItem('giftster.base-url', value) }
  return <main className="page content-page cards-page">
    <PageTitle eyebrow="Klaar om te drukken" title="Speelkaarten" description="Zes kaarten per A4, ingericht voor dubbelzijdig printen" />
    <div className="print-controls no-print"><label><span>Adres van de play-app</span><input value={baseUrl} onChange={event => saveBase(event.target.value)} /></label><button className="primary-button" disabled={!clientId} onClick={() => print()}><Printer /> Print kaarten</button></div>
    <div className={`print-note no-print ${!clientId ? 'is-warning' : ''}`}><QrCode /><p>{clientId ? <><strong>Zelfstandige QR-kaarten.</strong> Je vriend hoeft de collectie niet te importeren; de kaart opent direct in de play-app.</> : <><strong>Client ID ontbreekt.</strong> Vul die eerst in onder Instellen, anders kunnen andere telefoons Spotify niet koppelen.</>}</p></div>
    <div className="deck-preview">{collection.tracks.map((track, index) => <div className="mini-card" key={track.id}><CardQr value={cardUrl(track)} size={150} /><span>KAART {String(index + 1).padStart(2, '0')}</span></div>)}</div>
    <div className="print-deck">{sheets.flatMap((sheet, sheetIndex) => [
      <section className="print-sheet fronts" key={`front-${sheetIndex}`}>{sheet.map((track, index) => <div className="print-card card-front" key={track.id}><div className="card-brand"><Music2 /> TIMEPOP</div><CardQr value={cardUrl(track)} size={300} /><strong>SCAN OM TE SPELEN</strong><span>Kaart {String(sheetIndex * 6 + index + 1).padStart(2, '0')}</span></div>)}</section>,
      <section className="print-sheet backs" key={`back-${sheetIndex}`}>{[...sheet].reduce((rows, item, i) => { const row = Math.floor(i / 2); (rows[row] ||= []).push(item); return rows }, []).flatMap(row => row.reverse()).map(track => <div className="print-card card-back" key={track.id}><span className="back-year">{track.year || '????'}</span><div><strong>{track.title}</strong><span>{track.artist}</span>{track.album && <small>{track.album}</small>}</div><Music2 /></div>)}</section>,
    ])}</div>
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
    <PageTitle eyebrow="Verbindingen" title="Instellen" description="Koppel Spotify of werk volledig met eigen audiobestanden" />
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
  const [tab, setTab] = useState('collection')
  const [activeTrack, setActiveTrack] = useState(null)
  const setCollection = value => { setCollectionState(value); saveCollection(value) }

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
    const route = () => setMode(location.hash === '#admin' ? 'admin' : 'play')
    addEventListener('hashchange', route)
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

  if (activeTrack) return <Player track={activeTrack} onBack={() => setActiveTrack(null)} onNext={() => setActiveTrack(null)} />
  if (mode === 'play') return <PlayHome collection={collection} onOpenTrack={setActiveTrack} resolveCard={resolveCard} />
  return <div className="app-shell">
    <header className="admin-topbar no-print"><a className="admin-logo" href="#admin"><span><Music2 /></span>TIMEPOP <small>STUDIO</small></a><a className="preview-link" href="#play"><Play /> Open play-app</a></header>
    {tab === 'collection' && <CollectionPage collection={collection} setCollection={setCollection} />}
    {tab === 'cards' && <CardsPage collection={collection} />}
    {tab === 'settings' && <SettingsPage collection={collection} setCollection={setCollection} />}
    <nav className="bottom-nav admin-nav no-print">{ADMIN_NAV.map(item => <button className={tab === item.id ? 'active' : ''} onClick={() => item.id === 'preview' ? location.hash = '#play' : setTab(item.id)} key={item.id}><item.icon /><span>{item.label}</span></button>)}</nav>
  </div>
}
