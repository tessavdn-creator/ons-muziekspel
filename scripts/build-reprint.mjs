// Bouwt een gedeeltelijke herdruk: alleen de kaarten waarvan het jaartal is
// gecorrigeerd, met hun OORSPRONKELIJKE kaartnummer erop. Zo zijn ze een voor
// een te vervangen in de bestaande doos, in plaats van een hele oplage opnieuw
// te drukken voor een handvol correcties.
import { readFile, writeFile } from 'node:fs/promises'

const bronnen = [
  { eigenaar: 'Nikki', file: '.private/nikki-edition.json' },
  { eigenaar: 'Iris', file: '.private/iris-three-editions-300.json' },
]
const uitvoer = process.argv[2] || '.private/herdruk-edities.json'

const gewijzigd = new Set()
const csv = await readFile('.private/jaartallen-gewijzigd.csv', 'utf8')
for (const regel of csv.split(/\r?\n/).slice(1).filter(Boolean)) {
  const cellen = regel.match(/("(?:[^"]|"")*"|[^,]*)/g).filter((_, index) => index % 2 === 0).map(cel => cel.replace(/^"|"$/g, '').replaceAll('""', '"'))
  if (cellen[2]) gewijzigd.add(cellen[2])
}

const herdrukken = []
for (const bron of bronnen) {
  const document = JSON.parse(await readFile(bron.file, 'utf8'))
  for (const editie of Array.isArray(document) ? document : [document]) {
    // Het kaartnummer is de positie in de oorspronkelijke editie, en die telt
    // vanaf een. Dat nummer staat op de gedrukte kaart en moet gelijk blijven.
    const kaarten = (editie.tracks || [])
      .map((track, index) => ({ ...track, cardNumber: index + 1 }))
      .filter(track => gewijzigd.has(track.id))
    if (!kaarten.length) continue
    herdrukken.push({ ...editie, owner: bron.eigenaar, tracks: kaarten })
    console.log(`${bron.eigenaar} · ${editie.name}: ${kaarten.length} van ${editie.tracks.length} kaarten opnieuw drukken`)
  }
}

await writeFile(uitvoer, `${JSON.stringify(herdrukken, null, 2)}\n`)
const totaal = herdrukken.reduce((som, editie) => som + editie.tracks.length, 0)
console.log(`\n${totaal} kaarten in ${uitvoer}`)
