// Herstelt de uitgavejaren van bestaande edities met de gecorrigeerde stemming.
//
// De oude versie van enrich-years-musicbrainz.mjs vroeg acht zoekresultaten op
// waar een beroemd nummer er honderden heeft, allemaal heruitgaven, en koos
// daaruit het vroegste. Dat leverde jaartallen op die tientallen jaren te laat
// waren: Stand By Me van Ben E. King werd 1989 in plaats van 1961.
//
// Alleen het JAARTAL wordt aangepast. De kaartkeuze, de volgorde en de
// kaart-ID's blijven exact zoals ze waren, zodat een nieuwe oplage naast de oude
// te leggen is.
import { readFile, writeFile } from 'node:fs/promises'
import { bepaalJaar, bronnenVan, toonBronnen } from './lib-release-year.mjs'

const werkbestand = process.argv[2] || '.private/herstel-jaartallen.json'
const doelen = [
  { eigenaar: 'nikki', file: '.private/nikki-edition.json' },
  { eigenaar: 'iris', file: '.private/iris-three-editions-300.json' },
]

const werk = JSON.parse(await readFile(werkbestand, 'utf8')).tracks
const perId = new Map()
for (const track of werk) {
  const uitslag = bepaalJaar(bronnenVan(track))
  perId.set(track.id, { uitslag, bronnen: bronnenVan(track), track })
}

const wijzigingen = []
const onbevestigd = []
const nietToegepast = []
let ongewijzigd = 0
let geenBron = 0

for (const doel of doelen) {
  const document = JSON.parse(await readFile(doel.file, 'utf8'))
  const edities = Array.isArray(document) ? document : [document]
  for (const editie of edities) {
    for (const track of editie.tracks || []) {
      const gevonden = perId.get(track.id)
      if (!gevonden || !gevonden.uitslag) { geenBron += 1; continue }
      const { uitslag, bronnen } = gevonden
      const oud = String(track.year || '')
      const nieuw = String(uitslag.jaar)

      // Vangrail. De oude fout maakte jaartallen te LAAT, dus dat is wat we hier
      // repareren. Een uitkomst die nog verder vooruit springt repareert niets en
      // komt meestal doordat alleen heruitgaven in de catalogi staan: Sidney Bechet
      // kreeg zo 1972 terwijl hij in 1959 overleed. Zulke sprongen worden alleen
      // gevolgd als er echt drie bronnen achter staan; anders blijft het oude jaar
      // staan en gaat de kaart naar de controlelijst.
      const vooruit = Number(nieuw) > Number(oud)
      if (vooruit && uitslag.eens < 3) {
        nietToegepast.push({ eigenaar: doel.eigenaar, editie: editie.name, id: track.id, artiest: track.artist, titel: track.title, oud, voorstel: nieuw, zekerheid: uitslag.zekerheid, bronnen: toonBronnen(bronnen) })
        continue
      }
      if (uitslag.eens < 2) {
        onbevestigd.push({ eigenaar: doel.eigenaar, editie: editie.name, id: track.id, artiest: track.artist, titel: track.title, oud, nieuw, bronnen: toonBronnen(bronnen) })
      }
      if (oud !== nieuw) {
        wijzigingen.push({ eigenaar: doel.eigenaar, editie: editie.name, id: track.id, artiest: track.artist, titel: track.title, oud, nieuw, verschil: Number(nieuw) - Number(oud), zekerheid: uitslag.zekerheid, bronnen: toonBronnen(bronnen) })
      } else ongewijzigd += 1
      track.year = nieuw
      track.yearSource = toonBronnen(bronnen)
      track.yearConfidence = uitslag.zekerheid
      delete track.yearMatchScore
      // Het decennium in de tags moet het nieuwe jaartal volgen.
      if (Array.isArray(track.tags)) {
        track.tags = [...new Set([...track.tags.filter(tag => !/^\d{4}s$/.test(tag)), `${Math.floor(uitslag.jaar / 10) * 10}s`])]
      }
    }
  }
  await writeFile(doel.file, `${JSON.stringify(document, null, 2)}\n`)
}

const cel = waarde => `"${String(waarde ?? '').replaceAll('"', '""')}"`
const csv = rijen => rijen.map(rij => rij.map(cel).join(',')).join('\n')
await writeFile('.private/jaartallen-gewijzigd.csv', `${csv([
  ['eigenaar', 'editie', 'kaart', 'artiest', 'titel', 'oud jaar', 'nieuw jaar', 'verschil', 'zekerheid', 'bronnen'],
  ...wijzigingen.map(w => [w.eigenaar, w.editie, w.id, w.artiest, w.titel, w.oud, w.nieuw, w.verschil, w.zekerheid, w.bronnen]),
])}\n`)
await writeFile('.private/jaartallen-onbevestigd.csv', `${csv([
  ['eigenaar', 'editie', 'kaart', 'artiest', 'titel', 'oud jaar', 'nieuw jaar', 'bronnen'],
  ...onbevestigd.map(w => [w.eigenaar, w.editie, w.id, w.artiest, w.titel, w.oud, w.nieuw, w.bronnen]),
])}\n`)

await writeFile('.private/jaartallen-niet-toegepast.csv', `${csv([
  ['eigenaar', 'editie', 'kaart', 'artiest', 'titel', 'oud jaar', 'voorstel', 'zekerheid', 'bronnen'],
  ...nietToegepast.map(w => [w.eigenaar, w.editie, w.id, w.artiest, w.titel, w.oud, w.voorstel, w.zekerheid, w.bronnen]),
])}\n`)

const groot = wijzigingen.filter(w => Math.abs(w.verschil) > 2)
console.log(`Gecontroleerd: ${werk.length} kaarten.`)
console.log(`Ongewijzigd: ${ongewijzigd}. Aangepast: ${wijzigingen.length}, waarvan ${groot.length} met meer dan twee jaar verschil.`)
console.log(`Zonder bruikbare bron: ${geenBron}.`)
console.log(`Nog onbevestigd (minder dan twee bronnen eens): ${onbevestigd.length}.`)
console.log(`Vooruitsprong niet gevolgd, oude jaar blijft staan: ${nietToegepast.length}, zie .private/jaartallen-niet-toegepast.csv`)
console.log('\nGrootste correcties:')
for (const w of [...groot].sort((links, rechts) => Math.abs(rechts.verschil) - Math.abs(links.verschil)).slice(0, 12)) {
  console.log(`  ${w.oud} -> ${w.nieuw}  (${w.verschil > 0 ? '+' : ''}${w.verschil})  ${w.artiest} - ${w.titel.slice(0, 42)}`)
}
console.log('\nVolledige lijst: .private/jaartallen-gewijzigd.csv')
