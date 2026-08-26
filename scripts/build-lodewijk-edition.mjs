import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import QRCode from 'qrcode'
import { encodeCard } from '../src/lib/collection.js'

const [input = '.private/lodewijk-pool.json', output = '.private/lodewijk-edition.json'] = process.argv.slice(2)
const clientId = String(process.env.SPOTIFY_CLIENT_ID || '3cdd431703234d9081c53217dd1b3b2c').trim()
const baseUrl = 'https://tessavdn-creator.github.io/ons-muziekspel'

// Zwaartepunt op de jaren waarin Lodewijk opgroeide, met een herkenbaar staartje
// zodat jongere gasten ook mee kunnen leggen.
const QUOTA = { 1960: 70, 1970: 85, 1980: 85, 1990: 40, 2000: 20 }
const TOTAL = Object.values(QUOTA).reduce((sum, value) => sum + value, 0)
const MAX_PER_ARTIST = 4

// De internationale decenniumlijsten leveren nauwelijks Nederlands repertoire,
// terwijl dat voor een Nederlandse Top 2000-liefhebber juist de herkenbaarste
// kaarten zijn. Per decennium wordt daarom eerst een vast aantal Nederlandse
// kaarten gevuld, zwaarder in de jaren waarin de Nederpop bloeide. Wat daarna
// nog uit een Nederlandse lijst in de gewone ronde komt, telt er bovenop.
const NEDERLANDS_QUOTA = { 1960: 3, 1970: 9, 1980: 9, 1990: 3, 2000: 1 }

// Op 50 mm is de QR 31 mm. Versie 13 (69 modules) haalde in de proef nog 0,16 mm
// inktvloei; daarboven wordt de marge te dun. Langere titels kosten modules, dus
// de selectie geeft voorrang aan kaarten die ruim binnen die grens blijven.
const QR_COMFORTABLE = 69
const QR_LIMIT = 77

const dropSuffix = /\s+-\s+.*\b(remaster(ed)?|mono|stereo|single version|album version|radio edit|re-?recorded|version|mix|edit|take \d+|live at|from ["“]).*$/i
// Alleen haakjes weghalen die puur technisch zijn. Betekenisvolle haakjes
// blijven staan: (What A) Wonderful World, (Sittin' On) The Dock of the Bay en
// Voodoo Child (Slight Return) horen voluit op de kaart.
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

// De accentkleur van iedere kaart komt uit het genre, dus een grove indeling
// maakt het deck visueel eentonig. Volgorde telt: Nederlandstalig gaat voor,
// daarna de stijlen die het duidelijkst een eigen kleur verdienen.
const NEDERLANDS = /boudewijn de groot|golden earring|doe maar|klein orkest|het goede doel|frank boeijen|herman van veen|drukwerk|toontje lager|\bbzn\b|andr[eé] hazes|rob de nijs|normaal|the scene|\bnits\b|vof de kunst|danny vera|marco borsato|guus meeuwis|acda|\bbl[oø]f\b|\bkane\b|di-rect|anouk|ilse delange|racoon|van dik hout|het klein orkest|zangeres zonder naam|ramses shaffy|liesbeth list/i
const ELECTRONIC = /kraftwerk|depeche mode|new order|pet shop boys|erasure|yazoo|soft cell|human league|daft punk|\bmoby\b|the prodigy|underworld|jean-michel jarre|giorgio moroder|a-ha|ultravox|visage|gary numan|orchestral manoeuvres|\bomd\b|eurythmics|tears for fears|duran duran|spandau ballet|alphaville|the buggles|dead or alive|bronski beat|frankie goes to hollywood|yello|art of noise|propaganda|talk talk|thompson twins|howard jones|\berasure\b/i
const DISCO = /bee gees|donna summer|\bchic\b|\babba\b|kool & the gang|earth, wind|village people|sister sledge|gloria gaynor|boney m|kc and the sunshine|tavares|diana ross|barry white|the trammps|silver convention|thelma houston|anita ward|amii stewart|ottawan|the jacksons|rose royce|heatwave|shalamar|imagination|odyssey|gibson brothers|baccara|eruption|arabesque|patrick hernandez|lipps|\bchange\b|evelyn king|the pointer sisters|sylvester/i
const SOUL = /aretha|marvin gaye|otis redding|stevie wonder|temptations|four tops|sam cooke|ben e\.? king|percy sledge|wilson pickett|al green|curtis mayfield|isley|supremes|smokey robinson|ray charles|tina turner|james brown|bill withers|gladys knight|dionne warwick|erma franklin|etta james|jackson 5|betty everett|martha reeves|mary wells|edwin starr|jr\.? walker|the drifters|solomon burke|booker t|sam & dave|arthur conley|eddie floyd|carla thomas|the miracles|the marvelettes|the shirelles|the ronettes|the chiffons|aaron neville|lionel richie|commodores|teddy pendergrass|luther vandross|anita baker|\bsade\b|simply red|hall & oates|otis|the o.jays|harold melvin|stylistics|delfonics|chi-lites|roberta flack|donny hathaway|nina simone|dusty springfield|joe cocker|\bthe staple singers\b|sly & the family stone|marlena shaw|the spinners|average white band|\bwar\b|ike & tina/i
const ROCK = /the beatles|rolling stones|led zeppelin|pink floyd|the who\b|deep purple|black sabbath|\bqueen\b|ac\/dc|eagles|dire straits|fleetwood mac|creedence|jimi hendrix|the doors|springsteen|van halen|guns n|\bu2\b|the police|the clash|ramones|lynyrd|steppenwolf|santana|thin lizzy|scorpions|\bkansas\b|\btoto\b|journey|foreigner|bon jovi|nirvana|pearl jam|metallica|the kinks|the animals|\bcream\b|ten years after|\bfree\b|the beach boys|the byrds|buffalo springfield|the monkees|the turtles|simon & garfunkel|bob dylan|david bowie|neil young|crosby|jefferson airplane|velvet underground|t\.? ?rex|roxy music|the cure|the smiths|r\.e\.m\.|talking heads|blondie|joan jett|pat benatar|\bheart\b|\bboston\b|\bstyx\b|\brush\b|cheap trick|the pretenders|the jam\b|elvis costello|tom petty|mellencamp|bryan adams|def leppard|aerosmith|\bkiss\b|alice cooper|meat loaf|supertramp|genesis|\byes\b|moody blues|procol harum|status quo|bad company|bachman|grand funk|zz top|doobie brothers|steely dan|little feat|allman|chicago|the yardbirds|manfred mann|the troggs|the hollies|the searchers|small faces|the zombies|canned heat|jethro tull|emerson|king crimson|uriah heep|nazareth|slade|wishbone|golden earring|dr\. hook|10cc|electric light orchestra|\belo\b|the stranglers|joy division|siouxsie|the b-52|devo|the knack|survivor|europe|whitesnake|dio|iron maiden|judas priest|motorhead|the eagles/i
const CLASSIC = /elvis presley|chuck berry|buddy holly|little richard|jerry lee lewis|everly brothers|roy orbison|frank sinatra|dean martin|nat king cole|ella fitzgerald|louis armstrong|bill haley|fats domino|the platters|connie francis|brenda lee|patsy cline|johnny cash|frankie valli|four seasons|paul anka|neil sedaka|bobby darin|the tokens|skeeter davis|the shadows|cliff richard|tom jones|engelbert|\bthe drifters\b|sam the sham|del shannon|gene pitney|dion\b|ricky nelson|the ventures|duane eddy|nancy sinatra/i

const genreFor = (artist, year, uitNederlandseLijst = false) => {
  const value = String(artist)
  // Uit een Nederlandse bronlijst is een betrouwbaarder signaal dan een
  // namenlijst: Q65, Catapult en Toontje Lager staan daar niet in.
  if (uitNederlandseLijst || NEDERLANDS.test(value)) return 'nederlands'
  if (ELECTRONIC.test(value)) return 'electronic'
  if (DISCO.test(value)) return 'disco'
  if (SOUL.test(value)) return 'soul'
  if (ROCK.test(value)) return 'rock'
  if (CLASSIC.test(value)) return 'classic'
  return Number(year) < 1965 ? 'classic' : 'pop'
}

const pool = JSON.parse(await readFile(input, 'utf8')).tracks

// Handmatig gecontroleerde jaartallen krijgen voorrang op alle geautomatiseerde
// bronnen. Geen enkele publieke bron heeft dit repertoire volledig goed, en deze
// kaarten worden gedrukt: een fout is daarna niet meer te herstellen. Het bestand
// is een eenvoudige CSV met spotifyUri, jaar en reden, en mag ontbreken.
const overrides = new Map()
try {
  const regels = (await readFile('.private/lodewijk-jaartallen-handmatig.csv', 'utf8')).split(/\r?\n/).filter(Boolean)
  for (const regel of regels.slice(1)) {
    const cellen = regel.match(/("(?:[^"]|"")*"|[^,]*)/g).filter((_, index) => index % 2 === 0).map(cel => cel.replace(/^"|"$/g, '').replaceAll('""', '"'))
    const [uri, jaar] = cellen
    if (/^spotify:track:[A-Za-z0-9]+$/.test(uri || '') && /^(19|20)\d{2}$/.test(jaar || '')) overrides.set(uri, jaar)
  }
  console.log(`Handmatige jaartallen ingelezen: ${overrides.size}.`)
} catch { /* nog geen correctielijst, dat mag */ }

// 1. Jaartal vaststellen en de bron ervan wegen. Het decennium van de
// Spotify-decenniumplaylist is een onafhankelijke, door mensen samengestelde
// controle op wat MusicBrainz teruggaf.
// Drie jaartalbronnen die onafhankelijk van elkaar falen:
//   1. MusicBrainz opnamezoektocht  : te LAAT bij veel heruitgaven
//   2. MusicBrainz release-group    : te LAAT bij een verzamelaar, soms te vroeg
//   3. Spotify releasedatum         : te LAAT bij een remaster
// En allemaal kunnen ze te VROEG uitvallen als een gelijknamig ander nummer van
// dezelfde artiest matcht. Geen enkele bron is dus alleen te vertrouwen. De
// mediaan van de drie gooit een uitschieter in beide richtingen weg; op de
// negen lastigste gevallen gaf dat acht keer exact het goede jaar.
// Het decennium van de Spotify-decenniumlijst is de laatste zeef.
const rejected = []
const dated = []
const review = []
const mediaan = values => [...values].sort((left, right) => left - right)[Math.floor(values.length / 2)]

// Vijf jaartalsignalen die onafhankelijk van elkaar falen:
//   opname       MusicBrainz recording, te LAAT bij veel heruitgaven
//   uitgave      MusicBrainz release-group, te LAAT bij een verzamelaar
//   spotify      releasedatum, te LAAT bij een remaster
//   itunesVroeg  vroegste iTunes-treffer, te VROEG bij een gelijknamig nummer
//   itunesVaak   meest voorkomende iTunes-jaar, meestal de echte uitgave
//
// Niet de mediaan maar de MEEST GENOEMDE waarde wint, met de mediaan als
// gelijkspelbreker. Gemeten op 27 met de hand nagekeken nummers: 24 exact goed
// en alle 27 binnen een jaar, tegen 17 exact en gemiddeld bijna drie jaar
// afwijking toen alleen de mediaan van drie bronnen werd gebruikt.
const stemming = years => {
  const tally = new Map()
  years.forEach(year => tally.set(year, (tally.get(year) || 0) + 1))
  const hoogste = Math.max(...tally.values())
  const kandidaten = [...tally.entries()].filter(([, count]) => count === hoogste).map(([year]) => year)
  if (kandidaten.length === 1) return kandidaten[0]
  const midden = mediaan(years)
  return kandidaten.reduce((best, year) => (Math.abs(year - midden) < Math.abs(best - midden) ? year : best))
}

for (const track of pool) {
  if (overrides.has(track.spotifyUri)) {
    dated.push({ ...track, year: overrides.get(track.spotifyUri), yearSource: 'handmatig gecontroleerd', yearConfidence: 'handmatig' })
    continue
  }
  // Een bron dekt een periode: een decenniumlijst een decennium, een lijst die
  // twee decennia beslaat navenant meer. Buiten die periode plus een kleine
  // marge is een jaartal onzin.
  const vanaf = Number(track.sourceFrom) || (track.sourceDecade || 0)
  const totEn = Number(track.sourceTo) || (track.sourceDecade ? track.sourceDecade + 9 : 0)
  const heeftBereik = vanaf > 0 && totEn >= vanaf
  const inDecade = year => !heeftBereik || (year >= vanaf && year <= totEn)
  const bronnen = {
    opname: track.yearSource === 'MusicBrainz first release' ? Number(track.year) || 0 : 0,
    uitgave: Number(track.releaseGroupYear) || 0,
    spotify: Number(track.spotifyYear) || 0,
    itunesVroeg: Number(track.itunesYear) || 0,
    itunesVaak: Number(track.itunesModalYear) || 0,
  }
  const toon = `opname ${bronnen.opname || '-'} / uitgave ${bronnen.uitgave || '-'} / Spotify ${bronnen.spotify || '-'} / iTunes ${bronnen.itunesVroeg || '-'}, ${bronnen.itunesVaak || '-'}`
  const alle = Object.values(bronnen).filter(year => year >= 1940)
  if (!alle.length) { rejected.push({ ...track, reason: `geen bruikbaar jaartal (${toon})` }); continue }

  // De stemming gaat VOOR de decenniumzeef. Andersom knipt de zeef juist het
  // goede antwoord weg: Enjoy the Silence staat in All Out 80s maar is van 1990,
  // en dan blijft alleen het foute 1985 over. Een decenniumlijst is de keuze van
  // een samensteller, geen harde grens, dus er zit marge omheen. De zeef grijpt
  // alleen nog in bij echte onzin, zoals Spotify dat Hit the Road Jack op 2021 zet.
  let bruikbaar = alle
  let year = stemming(alle)
  const ruim = jaar => !heeftBereik || (jaar >= vanaf - 2 && jaar <= totEn + 2)
  if (!ruim(year)) {
    const binnen = alle.filter(inDecade)
    if (!binnen.length) { rejected.push({ ...track, reason: `geen jaartal tussen ${vanaf} en ${totEn} (${toon})` }); continue }
    bruikbaar = binnen
    year = stemming(binnen)
  }

  const eens = bruikbaar.filter(jaar => Math.abs(jaar - year) <= 1).length
  const confidence = eens >= 3 ? 'drie of meer bronnen eens'
    : eens === 2 ? 'twee bronnen eens'
    : 'geen enkele bevestiging'
  if (eens < 2) {
    review.push({ spotifyUri: track.spotifyUri, artiest: track.artist, titel: track.title, opname: bronnen.opname || '', uitgave: bronnen.uitgave || '', spotify: bronnen.spotify || '', itunes: [bronnen.itunesVroeg, bronnen.itunesVaak].filter(Boolean).join(' / '), gekozen: year, zekerheid: confidence, bron: track.sources.join(' + ') })
  }
  dated.push({ ...track, year: String(year), yearSource: toon, yearConfidence: confidence })
}

// 2. Ontdubbelen op titel plus hoofdartiest, want dezelfde hit staat vaak in
// meerdere decenniumlijsten of ook nog in de Top 2000.
const unique = new Map()
for (const track of dated) {
  const title = cleanTitle(track.title)
  const key = `${normalize(title)}|${normalize(primaryArtist(track.artist))}`
  const existing = unique.get(key)
  if (existing) { existing.sources = [...new Set([...existing.sources, ...track.sources])]; continue }
  unique.set(key, { ...track, title })
}

// 3. QR-dichtheid meten per kandidaat.
const candidates = []
for (const track of unique.values()) {
  const card = { ...track, id: 'lodewijk-000-000000', album: '', audioUrl: '', genre: genreFor(track.artist, track.year, track.dutch), tags: [] }
  const url = `${baseUrl}/?card=${encodeCard(card, clientId)}#play`
  const modules = QRCode.create(url, { errorCorrectionLevel: 'M' }).modules.size
  if (modules > QR_LIMIT) { rejected.push({ ...track, reason: `QR te dicht (${modules} modules)` }); continue }
  candidates.push({ ...card, modules, decade: Math.floor(Number(track.year) / 10) * 10 })
}

// 4. Verdelen over de decennia met spreiding over artiesten.
const artistCount = new Map()
const selected = []
const shortfall = []
const shortfallNl = []
const relaxed = []
for (const [decade, wanted] of Object.entries(QUOTA)) {
  const bucket = candidates
    .filter(track => track.decade === Number(decade))
    .sort((left, right) => {
      // Ruime QR eerst, dan een hoge notering in de bronlijst, dan een vaste
      // maar willekeurig ogende volgorde zodat het deck niet alfabetisch oogt.
      const comfort = track => (track.modules <= QR_COMFORTABLE ? 0 : 1)
      const reach = track => -track.sources.length
      return comfort(left) - comfort(right)
        || reach(left) - reach(right)
        || left.sourcePosition - right.sourcePosition
        || hash(left.spotifyUri) - hash(right.spotifyUri)
    })
  // De artiestenlimiet geldt over het hele deck, en de decennia worden op
  // volgorde gevuld. Zonder speling zouden artiesten die zowel in de jaren 70
  // als 80 scoorden hun plekken in het eerste decennium opmaken en het krappe
  // tweede decennium leegtrekken. De limiet gaat daarom pas omhoog als een
  // decennium anders niet volloopt.
  let taken = 0
  const genomen = new Set()
  const neem = track => {
    const artist = normalize(primaryArtist(track.artist))
    artistCount.set(artist, (artistCount.get(artist) || 0) + 1)
    selected.push(track)
    genomen.add(track.spotifyUri)
    taken += 1
  }
  // Eerst het Nederlandse deel van dit decennium.
  const nlWens = NEDERLANDS_QUOTA[decade] || 0
  let nlTaken = 0
  for (const track of bucket) {
    if (nlTaken >= nlWens || taken >= wanted) break
    if (!track.dutch || genomen.has(track.spotifyUri)) continue
    if ((artistCount.get(normalize(primaryArtist(track.artist))) || 0) >= MAX_PER_ARTIST) continue
    neem(track)
    nlTaken += 1
  }
  if (nlTaken < nlWens) shortfallNl.push(`${decade}s: ${nlTaken} van ${nlWens} Nederlandse kaarten`)
  for (const cap of [MAX_PER_ARTIST, MAX_PER_ARTIST + 2, Infinity]) {
    for (const track of bucket) {
      if (taken >= wanted) break
      if (genomen.has(track.spotifyUri)) continue
      // Het quotum is ook een BOVENgrens. De vier Nederlandse bronlijsten leveren
      // honderden kandidaten die hoog noteren, en zonder deze rem vulden die de
      // jaren 70 en 80 bijna helemaal: 115 Nederlandse kaarten in plaats van 25.
      if (track.dutch && nlTaken >= nlWens) continue
      const artist = normalize(primaryArtist(track.artist))
      if ((artistCount.get(artist) || 0) >= cap) continue
      neem(track)
    }
    if (taken >= wanted) break
    if (cap !== Infinity) relaxed.push(`${decade}s had een ruimere artiestenlimiet nodig dan ${cap}`)
  }
  if (taken < wanted) shortfall.push(`${decade}s: ${taken} van ${wanted} (pool had er ${bucket.length})`)
}

// 5. Schudden op een vaste sleutel, zodat het deck niet per decennium geordend
// uit de printer komt maar iedere herbouw wel hetzelfde resultaat geeft.
const ordered = [...selected].sort((left, right) => hash(`lodewijk${left.spotifyUri}`) - hash(`lodewijk${right.spotifyUri}`))

const tracks = ordered.map((track, index) => ({
  id: `lodewijk-${String(index + 1).padStart(3, '0')}-${track.spotifyUri.split(':').pop().slice(0, 6)}`,
  title: track.title,
  artist: track.artist,
  year: track.year,
  album: '',
  image: track.image || '',
  spotifyUri: track.spotifyUri,
  externalUrl: track.externalUrl || '',
  audioUrl: '',
  genre: track.genre,
  tags: [...new Set([`${track.decade}s`, track.genre, 'top-2000'])],
  yearSource: track.yearSource,
  yearConfidence: track.yearConfidence,
  spotifyYear: track.spotifyYear,
  sources: track.sources,
  qrModules: track.modules,
}))

const deck = {
  id: 'lodewijk-platenkast-01',
  name: 'Lodewijk zijn Platenkast',
  recipient: 'Lodewijk',
  subtitle: 'Zijn jaren 60, 70 en 80',
  description: 'Driehonderd kaarten uit de tijd waarin de platen nog draaiden: de grote hits van de jaren 60, 70 en 80, met een herkenbaar staartje uit de jaren 90 en 00 zodat iedereen aan tafel mee kan leggen.',
  difficulty: 'normal',
  tracks,
}

await writeFile(output, `${JSON.stringify(deck, null, 2)}\n`)

// Kaarten waarover de twee bronnen het oneens zijn, apart wegschrijven zodat ze
// met de hand na te kijken zijn voordat er 300 kaarten de printer in gaan.
const gekozenUris = new Set(tracks.map(track => track.spotifyUri))
// Alleen de kaarten die het deck ook echt gehaald hebben.
const teControleren = review.filter(row => gekozenUris.has(row.spotifyUri))
// Kolomvolgorde is zo gekozen dat dit bestand na aanvulling direct als
// .private/lodewijk-jaartallen-handmatig.csv te hergebruiken is.
const csv = [['spotifyUri', 'jaar', 'reden', 'artiest', 'titel', 'opname', 'uitgave', 'spotify', 'itunes', 'gekozen', 'zekerheid', 'bron'], ...teControleren.map(row => [row.spotifyUri, '', '', row.artiest, row.titel, row.opname, row.uitgave, row.spotify, row.itunes, row.gekozen, row.zekerheid, row.bron])]
await writeFile('.private/lodewijk-jaartallen-controleren.csv', `${csv.map(r => r.map(v => `"${String(v ?? '').replaceAll('"', '""')}"`).join(',')).join('\n')}\n`)
const perDecade = {}
tracks.forEach(track => { const decade = `${Math.floor(Number(track.year) / 10) * 10}s`; perDecade[decade] = (perDecade[decade] || 0) + 1 })
const perGenre = {}
tracks.forEach(track => { perGenre[track.genre] = (perGenre[track.genre] || 0) + 1 })
const zekerheden = {}
tracks.forEach(track => { zekerheden[track.yearConfidence] = (zekerheden[track.yearConfidence] || 0) + 1 })

console.log(`Pool: ${pool.length} nummers, ${dated.length} met een betrouwbaar jaartal, ${unique.size} uniek, ${candidates.length} met een scanbare QR.`)
console.log(`Gekozen: ${tracks.length} kaarten.`)
console.log(`Per decennium: ${Object.entries(perDecade).sort().map(([decade, count]) => `${decade} ${count}`).join(', ')}`)
if (shortfallNl.length) console.log(`Nederlands quotum niet gehaald: ${shortfallNl.join('; ')}`)
console.log(`Per genre: ${Object.entries(perGenre).sort((left, right) => right[1] - left[1]).map(([genre, count]) => `${genre} ${count}`).join(', ')}`)
console.log(`Zekerheid jaartal: ${Object.entries(zekerheden).sort((left, right) => right[1] - left[1]).map(([label, count]) => `${count} ${label}`).join(', ')}.`)
console.log(`Ruime QR (<= ${QR_COMFORTABLE} modules): ${tracks.filter(track => track.qrModules <= QR_COMFORTABLE).length} van ${tracks.length}; drukste kaart ${Math.max(...tracks.map(track => track.qrModules))} modules.`)
console.log(`Meest voorkomende artiest: ${Math.max(...artistCount.values())} kaarten.`)
if (relaxed.length) console.log(`Artiestenlimiet verruimd: ${[...new Set(relaxed)].join('; ')}`)
if (shortfall.length) console.log(`LET OP, quotum niet gehaald:\n  ${shortfall.join('\n  ')}`)
console.log(`Handmatig na te kijken: ${teControleren.length} kaarten, zie .private/lodewijk-jaartallen-controleren.csv`)
console.log(`Afgevallen: ${rejected.length}.`)
