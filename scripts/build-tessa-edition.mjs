import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import QRCode from 'qrcode'
import { encodeCard } from '../src/lib/collection.js'
import { bepaalJaar, bronnenVan, toonBronnen } from './lib-release-year.mjs'

const [input = '.private/tessa-pool.json', output = '.private/tessa-edition.json'] = process.argv.slice(2)
const clientId = String(process.env.SPOTIFY_CLIENT_ID || '3cdd431703234d9081c53217dd1b3b2c').trim()
const baseUrl = 'https://tessavdn-creator.github.io/ons-muziekspel'

const TOTAL = 300
// Haar eigen lijsten mogen de stapel bepalen; alleen Céline Dion en Mariah Carey
// lopen anders weg met de Guilty Pleasures-hoek. Extra's uit de artiestentops
// staan strenger aan de lijn, want die zijn aanvulling en geen keuze van haar.
const MAX_PER_ARTIST = 6
const MAX_PER_ARTIST_EXTRA = 2

// Op 50 mm is de QR 31 mm. Versie 13 (69 modules) haalde in de proef nog 0,16 mm
// inktvloei; daarboven wordt de marge te dun. Langere titels kosten modules, dus
// de selectie geeft voorrang aan kaarten die ruim binnen die grens blijven.
const QR_COMFORTABLE = 69
const QR_LIMIT = 77

// Een artiestentop is een MOMENTOPNAME. Daar staan drie soorten nummers in die
// niet op een kaart horen, en alle drie zijn ze in de eerste ronde langsgekomen:
//
//   1. remixen en heruitgaven van een nummer dat al in het deck zit
//      (Chipz - 1001 Arabian Nights - Hak op de Tak Remix, K-otic - Damn 2.0)
//   2. covers van een nummer dat al in het deck zit, door een andere artiest
//      (Kygo - What's Love Got to Do with It naast die van Tina Turner)
//   3. splinternieuwe singles die nog niemand kent
//      (Kanye West - I CAN'T WAIT uit 2026)
//
// Bij 1 en 2 hoort de speler twee keer hetzelfde nummer met twee verschillende
// jaartallen, en dat is niet uit te leggen aan tafel. Bij 3 sneuvelt de enige eis
// die zij stelde: het moet herkenbaar zijn. Haar EIGEN nummers vallen buiten deze
// zeef; die heeft ze zelf gekozen, hoe nieuw of hoe geremixt ook.
const DERIVATIEF = /\b(remix|rework|bootleg|mashup|edit|versie|version|\d\.0|re-?recorded|sped ?up|slowed|instrumental|karaoke|acoustic|unplugged|live|cover)\b/i
const NIEUWSTE_AANVULLING = 2023

// Handmatig geweigerde kaarten. Haar eigen lijsten gaan verder ongemoeid; dit is
// alleen voor wat aan tafel niet uit te leggen valt. Twee coverartiesten spelen
// hetzelfde nummer van Prince, en dan liggen er twee kaarten met dezelfde titel
// en een verschil van negentien jaar.
const UITGESLOTEN = new Map([
  ['spotify:track:2VrJiJV9RahxDgTmbV24k7', 'Fairy Scapes - The Most Beautiful Girl in the World: zelfde nummer als de versie van Purple die al in het deck zit'],
])

const dropSuffix = /\s+-\s+.*\b(remaster(ed)?|mono|stereo|single version|single remix|album version|radio edit|radio version|re-?recorded|version|mix|edit|take \d+|live at|from ["“]).*$/i
// Alleen haakjes weghalen die puur technisch zijn. Betekenisvolle haakjes blijven
// staan: (I've Had) The Time Of My Life en Damn (I Think I Love You) horen voluit
// op de kaart.
const dropParen = /\s*\((\d{4}\s*)?(remaster(ed)?|mono|stereo|single version|album version|radio edit|re-?recorded)(\s*\d{4})?\)\s*$/i
const cleanTitle = value => String(value)
  .replace(dropSuffix, '')
  .replace(dropParen, '')
  .replace(/\s*\(feat\.[^)]*\)\s*/gi, ' ')
  .replace(/\s*-\s*$/, '')
  .replace(/\s{2,}/g, ' ')
  .trim()
const primaryArtist = value => String(value).split(/,|&| feat\.| with /i)[0].trim()
const normalize = value => String(value).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '')
const hash = value => createHash('sha256').update(value).digest().readUInt32BE(0)

// De accentkleur van iedere kaart komt uit het genre, dus een grove indeling maakt
// het deck visueel eentonig. Volgorde telt: Nederlandstalig gaat voor, daarna de
// stijlen die het duidelijkst een eigen kleur verdienen. Dit is een andere wereld
// dan Lodewijks platenkast, dus de lijsten zijn op haar repertoire geschreven.
const NEDERLANDS = /yes-?r|guus meeuwis|marco borsato|trijntje|ruth jacott|paul de leeuw|gerard joling|gordon|nick & simon|jan smit|frans bauer|kinderen voor kinderen|brainpower|de jeugd van tegenwoordig|the opposites|def rhymz|gers pardoel|kraantje pappie|ali b|lange frans|k-liber|jody bernal|antoon|bizzey|goldband|roxy dekker|snelle|suzan|broederliefde|turfy gang|twarres|doe maar|clouseau|golden earring|acda|bl[oø]f|van dik hout|racoon|anouk|ilse delange|k-otic|jamai|linda roos|total touch|yves berendse|martin morero|wesly bronkhorst|palm trees|justen de wildt|sick & nimon|lil rain|swifty|the cooldown caf|chipz|2 brothers on the 4th floor|the underdog project|outlandish|nielson|typhoon|maan|davina michelle|rolf sanchez|xander|dre[sz]den/i
const ELECTRONIC = /vengaboys|basshunter|darude|milk inc|haddaway|snap!|bomfunk|culture beat|alcazar|o-zone|dj snake|david guetta|calvin harris|avicii|swedish house|armin|tiesto|martin garrix|robin schulz|toy-box|las ketchup|gusttavo|scooter|2 unlimited|technotronic|corona|la bouche|eiffel 65|daft punk|modjo|stardust|groove coverage|cascada|dj sammy|lasgo|ian van dahl|safri duo|sylver|pitbull|taio cruz|jason derulo|flo rida|sean paul|kevin lyttle|lumidee|gyptian|wisin|fuse odg|major lazer|sigala|jax jones|joel corry|purple disco/i
const SOUL = /whitney houston|mariah carey|c[eé]line dion|toni braxton|alicia keys|erykah badu|lauryn hill|fugees|en vogue|eternal|boyz ii men|all-4-one|3t|k-ci|sisqo|usher|beyonc|rihanna|destiny|marvin gaye|aretha|chaka khan|diana ross|the spinners|temptations|babyface|dionne warwick|oleta adams|lisa stansfield|vanessa williams|leona lewis|jojo|jamelia|seal|barbra streisand|luther vandross|janet jackson|tina turner|gnarls barkley|outkast|nelly|50 cent|jay-?z|ja[yŸ]-z|ms\. lauryn|lianne la havas|justin nozuka|batiste|eva cassidy|tracy chapman|sin[eé]ad|maria mckee|lutricia mcneal|close ii you|arthur baker|marc anthony/i
const ROCK = /bon jovi|queen|\bkiss\b|linkin park|disturbed|evanescence|red hot chili|heart|foreigner|extreme|meat loaf|the police|dire straits|roxette|bonnie tyler|eagle-eye cherry|the fratellis|santana|toto|wilson phillips|the bangles|the radios|a-ha|eurythmics|culture club|simply red|joe cocker|elton john|andrea bocelli|michael bubl|savage garden|maroon 5|gwen stefani|no doubt|the killers|coldplay|kate winslet|peter andre|shania twain|leann rimes|natasha bedingfield|ed sheeran|harry styles|tommy cash/i
const DISCO = /boney m|ricchi e poveri|abba|bee gees|donna summer|earth, wind|kool & the gang|sister sledge|gloria gaynor|village people|daryl hall|hall & oates/i
const CLASSIC = /elvis presley|frank sinatra|nat king cole|the platters|connie francis|dean martin|ella fitzgerald|louis armstrong|pok[eé]mon/i

const genreFor = (artist, year) => {
  const value = String(artist)
  if (NEDERLANDS.test(value)) return 'nederlands'
  if (ELECTRONIC.test(value)) return 'electronic'
  if (DISCO.test(value)) return 'disco'
  if (SOUL.test(value)) return 'soul'
  if (ROCK.test(value)) return 'rock'
  if (CLASSIC.test(value)) return 'classic'
  return Number(year) < 1965 ? 'classic' : 'pop'
}

const pool = JSON.parse(await readFile(input, 'utf8')).tracks.filter(track => !UITGESLOTEN.has(track.spotifyUri))

// Handmatig gecontroleerde jaartallen krijgen voorrang op alle geautomatiseerde
// bronnen. Geen enkele publieke bron heeft dit repertoire volledig goed, en deze
// kaarten worden gedrukt: een fout is daarna niet meer te herstellen. Het bestand
// is een eenvoudige CSV met spotifyUri, jaar en reden, en mag ontbreken.
const overrides = new Map()
try {
  const regels = (await readFile('.private/tessa-jaartallen-handmatig.csv', 'utf8')).split(/\r?\n/).filter(Boolean)
  for (const regel of regels.slice(1)) {
    const cellen = regel.match(/("(?:[^"]|"")*"|[^,]*)/g).filter((_, index) => index % 2 === 0).map(cel => cel.replace(/^"|"$/g, '').replaceAll('""', '"'))
    const [uri, jaar] = cellen
    if (/^spotify:track:[A-Za-z0-9]+$/.test(uri || '') && /^(19|20)\d{2}$/.test(jaar || '')) overrides.set(uri, jaar)
  }
  console.log(`Handmatige jaartallen ingelezen: ${overrides.size}.`)
} catch { /* nog geen correctielijst, dat mag */ }

// 1. Jaartal vaststellen. Vijf bronnen die op verschillende manieren falen; de
// meest genoemde waarde wint, met de mediaan als gelijkspelbreker. Er is hier
// GEEN decenniumzeef zoals bij Lodewijk: zijn pool kwam uit decenniumplaylists
// die zelf een periode meegaven, haar playlists zeggen niets over een jaar.
const rejected = []
const dated = []
const review = []
for (const track of pool) {
  if (overrides.has(track.spotifyUri)) {
    dated.push({ ...track, year: overrides.get(track.spotifyUri), yearSource: 'handmatig gecontroleerd', yearConfidence: 'handmatig' })
    continue
  }
  const bronnen = bronnenVan(track)
  const uitslag = bepaalJaar(bronnen)
  if (!uitslag) { rejected.push({ ...track, reason: `geen bruikbaar jaartal (${toonBronnen(bronnen)})` }); continue }
  if (uitslag.eens < 2) {
    review.push({ spotifyUri: track.spotifyUri, artiest: track.artist, titel: track.title, opname: bronnen.opname || '', uitgave: bronnen.uitgave || '', spotify: bronnen.spotify || '', itunes: [bronnen.itunesVroeg, bronnen.itunesVaak].filter(Boolean).join(' / '), gekozen: uitslag.jaar, zekerheid: uitslag.zekerheid, bron: track.sources.join(' + ') })
  }
  dated.push({ ...track, year: String(uitslag.jaar), yearSource: toonBronnen(bronnen), yearConfidence: uitslag.zekerheid })
}

// 2. Ontdubbelen op titel plus hoofdartiest. Dezelfde hit staat in meerdere van
// haar lijsten, en een artiestentop levert soms nog een andere uitgave van een
// nummer dat al op haar lijst staat. Een eigen kaart wint altijd van een extra.
const unique = new Map()
for (const track of [...dated].sort((links, rechts) => Number(Boolean(links.extra)) - Number(Boolean(rechts.extra)))) {
  const title = cleanTitle(track.title)
  const key = `${normalize(title)}|${normalize(primaryArtist(track.artist))}`
  const existing = unique.get(key)
  if (existing) { existing.sources = [...new Set([...existing.sources, ...track.sources])]; continue }
  unique.set(key, { ...track, title })
}

// 3. QR-dichtheid meten per kandidaat.
const candidates = []
for (const track of unique.values()) {
  const card = { ...track, id: 'tessa-000-000000', album: '', audioUrl: '', genre: genreFor(track.artist, track.year), tags: [] }
  const url = `${baseUrl}/?card=${encodeCard(card, clientId)}#play`
  const modules = QRCode.create(url, { errorCorrectionLevel: 'M' }).modules.size
  if (modules > QR_LIMIT) { rejected.push({ ...track, reason: `QR te dicht (${modules} modules)` }); continue }
  candidates.push({ ...card, modules, decade: Math.floor(Number(track.year) / 10) * 10 })
}

// 3b. Aanvullingen streng zeven. Zie de toelichting bij DERIVATIEF hierboven.
const eigenKaarten = candidates.filter(track => !track.extra)
const eigenTitels = new Set(eigenKaarten.map(track => normalize(cleanTitle(track.title))))
// Alleen gelijke titels vergelijken is niet genoeg: Spotify schrijft hetzelfde
// nummer twee keer anders. Zij heeft "I Was Made for Loving You" van KISS staan,
// en de artiestentop leverde "I Was Made For Lovin' You" — dezelfde plaat, twee
// kaarten met hetzelfde jaartal. Bij dezelfde hoofdartiest is een gelijk begin
// van de titel daarom al genoeg reden om de aanvulling te laten vallen.
const eigenBegin = new Set(eigenKaarten.map(track => `${normalize(primaryArtist(track.artist))}|${normalize(cleanTitle(track.title)).slice(0, 10)}`))
const geweigerdeExtras = []

const bruikbareExtras = candidates.filter(track => !track.extra || (() => {
  if (DERIVATIEF.test(track.title)) { geweigerdeExtras.push(`${track.artist} - ${track.title} (bewerking)`); return false }
  if (Number(track.year) > NIEUWSTE_AANVULLING) { geweigerdeExtras.push(`${track.artist} - ${track.title} (${track.year}, te nieuw)`); return false }
  if (eigenTitels.has(normalize(cleanTitle(track.title)))) { geweigerdeExtras.push(`${track.artist} - ${track.title} (staat al in haar lijst)`); return false }
  if (eigenBegin.has(`${normalize(primaryArtist(track.artist))}|${normalize(cleanTitle(track.title)).slice(0, 10)}`)) { geweigerdeExtras.push(`${track.artist} - ${track.title} (andere schrijfwijze van een nummer uit haar lijst)`); return false }
  return true
})())

// 4. Kiezen. Haar eigen nummers gaan er eerst in, allemaal, zolang de
// artiestenlimiet dat toelaat. Dit is haar stapel; wat zij zelf opsloeg heeft
// altijd voorrang op een aanvulling.
const artistCount = new Map()
const selected = []
const neem = track => {
  artistCount.set(normalize(primaryArtist(track.artist)), (artistCount.get(normalize(primaryArtist(track.artist))) || 0) + 1)
  selected.push(track)
}
const ruimteVoor = (track, limiet) => (artistCount.get(normalize(primaryArtist(track.artist))) || 0) < limiet

// Haar drie lijsten leveren samen meer dan 300 bruikbare kandidaten, dus er moet
// gekozen worden. Twee regels bepalen dat.
//
// Ten eerste de verdeling OVER de lijsten. Zuiver naar rato zou HotGirlsSummer
// (28 nummers) op zestien kaarten uitkomen en dan is die lijst nauwelijks
// vertegenwoordigd. Een lijst die kleiner is dan zijn evenredige deel gaat er
// daarom in zijn geheel in; wat overblijft wordt over de rest naar rato verdeeld.
//
// Ten tweede de keuze BINNEN een lijst. De eerste zoveel nummers pakken zou de
// oudste helft van een playlist overslaan, want Spotify bewaart de volgorde
// waarin ze zijn toegevoegd. De lijst wordt daarom in evenveel vakjes geknipt
// als er kaarten nodig zijn, en uit ieder vakje komt er een. Zo loopt de selectie
// van begin tot eind door de hele playlist.
const perLijst = new Map()
for (const track of bruikbareExtras.filter(track => !track.extra)) {
  const lijst = track.sources[0] || 'onbekend'
  if (!perLijst.has(lijst)) perLijst.set(lijst, [])
  perLijst.get(lijst).push(track)
}
for (const tracks of perLijst.values()) tracks.sort((links, rechts) => links.sourcePosition - rechts.sourcePosition)

const verdeel = (lijsten, teVerdelen) => {
  const toewijzing = new Map()
  let rest = teVerdelen
  let open = [...lijsten]
  let veranderd = true
  while (veranderd) {
    veranderd = false
    const totaal = open.reduce((som, [, tracks]) => som + tracks.length, 0)
    for (const [naam, tracks] of open) {
      if (tracks.length <= Math.floor(rest * tracks.length / totaal) || tracks.length * open.length <= rest) {
        // Deze lijst is kleiner dan zijn evenredige deel: helemaal meenemen.
        toewijzing.set(naam, tracks.length)
        rest -= tracks.length
        open = open.filter(([andere]) => andere !== naam)
        veranderd = true
        break
      }
    }
  }
  const totaal = open.reduce((som, [, tracks]) => som + tracks.length, 0)
  let uitgedeeld = 0
  open.forEach(([naam, tracks], index) => {
    const deel = index === open.length - 1 ? rest - uitgedeeld : Math.round(rest * tracks.length / totaal)
    toewijzing.set(naam, deel)
    uitgedeeld += deel
  })
  return toewijzing
}

// Naar rato zou Guilty Pleasures met 326 kandidaten 185 van de 300 kaarten
// pakken, en dat is precies de lijst die het minst Nederlands (9%) en het minst
// recent is (8% van na 2005). Ahrtal en HotGirlsSummer zijn andersom: 24% en 64%
// Nederlands, 30% en 64% van na 2005. Een vaste verdeling zet die twee zwaarder
// aan, zodat het deck niet in de jaren 80 en 90 blijft hangen.
const LIJST_QUOTA = Object.fromEntries((process.env.TESSA_LIJST_QUOTA || 'HotGirlsSummer=28,Ahrtal=135,Guilty Pleasures=137')
  .split(',').map(regel => { const [naam, aantal] = regel.split('='); return [naam.trim(), Number(aantal)] }))
const quota = Object.keys(LIJST_QUOTA).length === perLijst.size
  ? new Map([...perLijst.keys()].map(naam => [naam, Math.min(LIJST_QUOTA[naam] ?? 0, perLijst.get(naam).length)]))
  : verdeel([...perLijst.entries()], TOTAL)
const genomen = new Set()
for (const [lijst, tracks] of perLijst) {
  const wens = quota.get(lijst) || 0
  const beschikbaar = tracks.filter(track => !genomen.has(track.spotifyUri))
  for (let vakje = 0; vakje < wens; vakje += 1) {
    const van = Math.floor(vakje * beschikbaar.length / wens)
    const tot = Math.max(van + 1, Math.floor((vakje + 1) * beschikbaar.length / wens))
    const keuzes = beschikbaar.slice(van, tot).filter(track => !genomen.has(track.spotifyUri))
    if (!keuzes.length) continue
    // Binnen een vakje wint een ruime QR, daarna een artiest die nog weinig
    // kaarten heeft. Blijft het gelijk, dan gaat een Nederlandstalig of recenter
    // nummer voor: het deck hing zwaar in de jaren 80 en 90 en was maar voor een
    // zevende Nederlands, terwijl juist die kaarten aan tafel het hardst
    // meegezongen worden. Dit breekt alleen een gelijkspel binnen hetzelfde
    // vakje, dus de selectie loopt nog steeds van de eerste tot de laatste
    // toevoeging van de playlist.
    keuzes.sort((links, rechts) => {
      const comfort = track => (track.modules <= QR_COMFORTABLE ? 0 : 1)
      const druk = track => artistCount.get(normalize(primaryArtist(track.artist))) || 0
      const voorkeur = track => (track.genre === 'nederlands' ? 0 : 1) + (Number(track.year) >= 2005 ? 0 : 1)
      return comfort(links) - comfort(rechts) || druk(links) - druk(rechts) || voorkeur(links) - voorkeur(rechts) || hash(links.spotifyUri) - hash(rechts.spotifyUri)
    })
    const keuze = keuzes.find(track => ruimteVoor(track, MAX_PER_ARTIST)) || null
    if (!keuze) continue
    neem(keuze)
    genomen.add(keuze.spotifyUri)
  }
  console.log(`${lijst.padEnd(18)} ${selected.filter(track => (track.sources[0] || '') === lijst).length} van ${wens} kaarten uit ${tracks.length} kandidaten`)
}

// Vakjes die leegbleven doordat de artiestenlimiet in de weg zat, alsnog vullen
// uit de rest van haar eigen lijsten.
for (const tracks of perLijst.values()) {
  for (const track of tracks) {
    if (selected.length >= TOTAL) break
    if (genomen.has(track.spotifyUri) || !ruimteVoor(track, MAX_PER_ARTIST)) continue
    neem(track)
    genomen.add(track.spotifyUri)
  }
}

const eigenAantal = selected.length

// 5. Aanvullen uit de artiestentops. Een tijdlijnspel wordt saai als bijna alle
// kaarten uit dezelfde twee decennia komen, en haar lijsten zitten zwaar op de
// jaren 90 en 00. De aanvulling gaat daarom eerst naar de decennia die nog dun
// bezet zijn; binnen een decennium wint de hoogst genoteerde artiestentrack,
// want dat is de bekendste.
const perDecennium = () => {
  const telling = new Map()
  selected.forEach(track => telling.set(track.decade, (telling.get(track.decade) || 0) + 1))
  return telling
}
const extras = bruikbareExtras.filter(track => track.extra && !genomen.has(track.spotifyUri))
const relaxed = []
for (const limiet of [MAX_PER_ARTIST_EXTRA, MAX_PER_ARTIST_EXTRA + 2, MAX_PER_ARTIST]) {
  while (selected.length < TOTAL) {
    const telling = perDecennium()
    const alGekozen = new Set(selected.map(track => track.spotifyUri))
    const beschikbaar = extras.filter(track => !alGekozen.has(track.spotifyUri) && ruimteVoor(track, limiet))
    if (!beschikbaar.length) break
    beschikbaar.sort((links, rechts) => {
      const schaarste = track => telling.get(track.decade) || 0
      const comfort = track => (track.modules <= QR_COMFORTABLE ? 0 : 1)
      return schaarste(links) - schaarste(rechts) || comfort(links) - comfort(rechts) || links.artistRank - rechts.artistRank || hash(links.spotifyUri) - hash(rechts.spotifyUri)
    })
    neem(beschikbaar[0])
  }
  if (selected.length >= TOTAL) break
  if (limiet !== MAX_PER_ARTIST) relaxed.push(`artiestenlimiet voor aanvullingen verruimd voorbij ${limiet}`)
}

// 6. Schudden op een vaste sleutel, zodat het deck niet op decennium of playlist
// geordend uit de printer komt maar iedere herbouw wel hetzelfde resultaat geeft.
const ordered = [...selected].sort((links, rechts) => hash(`tessa${links.spotifyUri}`) - hash(`tessa${rechts.spotifyUri}`))

const tracks = ordered.map((track, index) => ({
  id: `tessa-${String(index + 1).padStart(3, '0')}-${track.spotifyUri.split(':').pop().slice(0, 6)}`,
  title: track.title,
  artist: track.artist,
  year: track.year,
  album: '',
  image: track.image || '',
  spotifyUri: track.spotifyUri,
  externalUrl: track.externalUrl || '',
  audioUrl: '',
  genre: track.genre,
  tags: [...new Set([`${track.decade}s`, track.genre, track.extra ? 'aanvulling' : 'eigen playlist'])],
  yearSource: track.yearSource,
  yearConfidence: track.yearConfidence,
  spotifyYear: track.spotifyYear,
  sources: track.sources,
  qrModules: track.modules,
}))

const deck = {
  id: 'tessa-alles-door-elkaar-01',
  name: 'Alles Door Elkaar',
  recipient: 'Tessa',
  subtitle: 'Haar drie playlists op één stapel',
  description: 'Driehonderd kaarten uit haar eigen playlists, alles door elkaar: de meezingers, de guilty pleasures en de nummers waar de avond op losgaat. Gekozen van begin tot eind uit alle drie de lijsten, zodat geen enkele hoek wordt overgeslagen.',
  difficulty: 'normal',
  tracks,
}
await writeFile(output, `${JSON.stringify(deck, null, 2)}\n`)

// Kaarten waarover de bronnen het oneens zijn apart wegschrijven, zodat ze met de
// hand na te kijken zijn voordat er 300 kaarten de printer in gaan.
const gekozenUris = new Set(tracks.map(track => track.spotifyUri))
const teControleren = review.filter(rij => gekozenUris.has(rij.spotifyUri))
// Kolomvolgorde is zo gekozen dat dit bestand na aanvulling direct als
// .private/tessa-jaartallen-handmatig.csv te hergebruiken is.
const csv = [['spotifyUri', 'jaar', 'reden', 'artiest', 'titel', 'opname', 'uitgave', 'spotify', 'itunes', 'gekozen', 'zekerheid', 'bron'], ...teControleren.map(rij => [rij.spotifyUri, '', '', rij.artiest, rij.titel, rij.opname, rij.uitgave, rij.spotify, rij.itunes, rij.gekozen, rij.zekerheid, rij.bron])]
await writeFile('.private/tessa-jaartallen-controleren.csv', `${csv.map(rij => rij.map(waarde => `"${String(waarde ?? '').replaceAll('"', '""')}"`).join(',')).join('\n')}\n`)

const perDecade = {}
tracks.forEach(track => { const decade = `${Math.floor(Number(track.year) / 10) * 10}s`; perDecade[decade] = (perDecade[decade] || 0) + 1 })
const perGenre = {}
tracks.forEach(track => { perGenre[track.genre] = (perGenre[track.genre] || 0) + 1 })
const zekerheden = {}
tracks.forEach(track => { zekerheden[track.yearConfidence] = (zekerheden[track.yearConfidence] || 0) + 1 })

console.log(`Pool: ${pool.length} nummers, ${dated.length} met een bruikbaar jaartal, ${unique.size} uniek, ${candidates.length} met een scanbare QR.`)
console.log(`Gekozen: ${tracks.length} kaarten, waarvan ${eigenAantal} uit haar eigen playlists en ${tracks.length - eigenAantal} uit de artiestentops.`)
console.log(`Per decennium: ${Object.entries(perDecade).sort().map(([decade, aantal]) => `${decade} ${aantal}`).join(', ')}`)
console.log(`Per genre: ${Object.entries(perGenre).sort((links, rechts) => rechts[1] - links[1]).map(([genre, aantal]) => `${genre} ${aantal}`).join(', ')}`)
console.log(`Zekerheid jaartal: ${Object.entries(zekerheden).sort((links, rechts) => rechts[1] - links[1]).map(([label, aantal]) => `${aantal} ${label}`).join(', ')}.`)
console.log(`Ruime QR (<= ${QR_COMFORTABLE} modules): ${tracks.filter(track => track.qrModules <= QR_COMFORTABLE).length} van ${tracks.length}; drukste kaart ${Math.max(...tracks.map(track => track.qrModules))} modules.`)
console.log(`Meest voorkomende artiest: ${Math.max(...artistCount.values())} kaarten.`)
if (relaxed.length) console.log(`${[...new Set(relaxed)].join('; ')}`)
console.log(`Handmatig na te kijken: ${teControleren.length} kaarten, zie .private/tessa-jaartallen-controleren.csv`)
if (process.env.TOON_GEWEIGERD) console.log(geweigerdeExtras.map(regel => `  - ${regel}`).join('\n'))
console.log(`Aanvullingen geweigerd: ${geweigerdeExtras.length} (bewerkingen, covers van eigen nummers en alles na ${NIEUWSTE_AANVULLING}).`)
console.log(`Afgevallen: ${rejected.length}.`)
