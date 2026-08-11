import { readFile, writeFile } from 'node:fs/promises'

const irisEditions = JSON.parse(await readFile('.private/iris-three-editions-300.json', 'utf8'))
const nikkiEdition = JSON.parse(await readFile('.private/nikki-edition.json', 'utf8'))

const iris = {
  v: 3,
  recipient: 'Iris',
  title: 'Iris haar platenkast',
  celebrationMessage: 'Een eigen TRACKBACK-spel met driehonderd nummers uit de verborgen hoeken van jouw muzikale wereld — speciaal voor jou gemaakt.',
  message: 'Drie muzikale dwaalroutes van honderd kaarten door de verborgen hoeken van jouw Spotify-platenkast. Persoonlijk, eigenzinnig en expres niet te makkelijk.',
  taste: ['dreampop', 'psychedelische blues', 'vintage jazz', 'wereldmuziek', 'spiritueel'],
  editions: irisEditions,
}

const nikki = {
  v: 3,
  recipient: 'Nikki',
  title: 'Nikki’s Auto Classics',
  celebrationMessage: 'Jouw enorme Auto classics-playlist is veranderd in een eigen muziekspel met driehonderd kaarten. Voor autoritten, feestavonden en sterke verhalen.',
  message: 'Een persoonlijke selectie van driehonderd tracks uit jouw Auto classics: herkenbaar genoeg om mee te zingen en gevarieerd genoeg om iedereen uit te dagen.',
  taste: ['auto classics', 'rock anthems', 'pop', 'dance', 'meezingers'],
  editions: [nikkiEdition],
}

await writeFile('.private/iris-manifest.json', `${JSON.stringify(iris, null, 2)}\n`)
await writeFile('.private/nikki-manifest.json', `${JSON.stringify(nikki, null, 2)}\n`)
console.log(`Iris: ${iris.editions.reduce((sum, edition) => sum + edition.tracks.length, 0)} kaarten`)
console.log(`Nikki: ${nikki.editions.reduce((sum, edition) => sum + edition.tracks.length, 0)} kaarten`)
