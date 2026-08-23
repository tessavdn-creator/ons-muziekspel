import { readFile, writeFile } from 'node:fs/promises'

const irisEditions = JSON.parse(await readFile('.private/iris-three-editions-300.json', 'utf8'))
const crowdSource = JSON.parse(await readFile('.private/iris-crowd-pleasers.json', 'utf8'))
const nikkiEdition = JSON.parse(await readFile('.private/nikki-edition.json', 'utf8'))
const crowdPleasers = {
  ...crowdSource,
  id: 'iris-crowd-pleasers-01',
  name: 'Crowd Pleasers',
  subtitle: 'De Top 2000-editie',
  description: 'Honderd grote publieksfavorieten uit de top van de officiële NPO Radio 2 Top 2000 van 2025. Toegankelijker, herkenbaarder en ideaal om nieuwe spelers mee te laten beginnen.',
  difficulty: 'easy',
  tracks: crowdSource.tracks.map(track => ({ ...track, tags: [...new Set([...(track.tags || []), 'top-2000', 'toegankelijk'])] })),
}

const iris = {
  v: 3,
  recipient: 'Iris',
  title: 'Iris haar platenkast',
  celebrationMessage: 'Een eigen TRACKBACK-spel met vierhonderd nummers: drie eigenzinnige dwaalroutes én een toegankelijke Top 2000-set — speciaal voor jou gemaakt.',
  message: 'Vier muzikale routes van honderd kaarten: drie uitdagende reizen door jouw muzikale wereld en Crowd Pleasers vol grote hits om lekker laagdrempelig mee te beginnen.',
  taste: ['dreampop', 'psychedelische blues', 'vintage jazz', 'wereldmuziek', 'spiritueel'],
  showPublicEditions: false,
  // Tijdlijn blijft de standaard; Duo verschijnt als expliciete extra keuze.
  gameModes: ['timeline', 'duo'],
  editions: [...irisEditions, crowdPleasers],
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
