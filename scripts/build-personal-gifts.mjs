import { readFile, writeFile } from 'node:fs/promises'

const irisEditions = JSON.parse(await readFile('.private/iris-three-editions-300.json', 'utf8'))
const crowdSource = JSON.parse(await readFile('.private/iris-crowd-pleasers.json', 'utf8'))
const nikkiEdition = JSON.parse(await readFile('.private/nikki-edition.json', 'utf8'))
const lodewijkEdition = JSON.parse(await readFile('.private/lodewijk-edition.json', 'utf8'))
const tessaEdition = JSON.parse(await readFile('.private/tessa-edition.json', 'utf8'))
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

const lodewijk = {
  v: 3,
  recipient: 'Lodewijk',
  title: 'Lodewijk zijn Platenkast',
  celebrationMessage: 'Driehonderd kaarten uit de tijd dat de platen nog draaiden. Jouw jaren 60, 70 en 80, in een eigen muziekspel.',
  message: 'De grote hits waar jij mee opgroeide, met genoeg uit de jaren 90 en 00 erbij zodat iedereen aan tafel mee kan leggen.',
  taste: ['jaren 60', 'jaren 70', 'jaren 80', 'Top 2000', 'meezingers'],
  // Guilty Pleasures hoort niet bij zijn cadeau, dus de algemene bibliotheek blijft verborgen.
  showPublicEditions: false,
  // Alleen Tijdlijn, met Samen als expliciete extra keuze. Bij Tijdlijn hoef je
  // niets in te typen: scannen, luisteren, kaart neerleggen, onthullen. Typen komt
  // alleen voor bij Samen en bij Raad de hit, en die laatste laten we weg.
  gameModes: ['timeline', 'duo'],
  howTo: [
    'Eén telefoon is de dj. Die scant de kaarten en speelt de muziek.',
    'Koppel Spotify op die telefoon. Dat hoeft maar één keer.',
    'Iedere speler krijgt één kaart met het jaartal naar boven. Dat is het begin van je tijdlijn.',
    'De dj scant een nieuwe kaart. Je hoort het nummer, maar ziet titel noch jaartal.',
    'Leg de kaart in je eigen rij: vóór, ná of tussen de kaarten die je al hebt.',
    'De dj onthult. Ligt hij goed, dan houd je hem. Zo niet, dan gaat hij terug.',
    'Wie als eerste tien kaarten op een rij heeft, wint.',
  ],
  editions: [lodewijkEdition],
}

const tessa = {
  v: 3,
  recipient: 'Tessa',
  title: 'Alles Door Elkaar',
  celebrationMessage: 'Jouw drie playlists zijn door elkaar geschud tot één muziekspel van driehonderd kaarten. HotGirlsSummer, Guilty Pleasures en Ahrtal, op tafel.',
  message: 'Driehonderd kaarten uit je eigen lijsten, alles door elkaar, aangevuld met het bekendste werk van precies dezelfde artiesten.',
  taste: ['guilty pleasures', 'jaren 90', 'jaren 00', 'meezingers', 'r&b'],
  // De algemene bibliotheek bevat Guilty Pleasures, en dat is dezelfde playlist
  // waar haar eigen kaarten deels uit komen. Twee keer hetzelfde in één app zou
  // alleen maar verwarren, dus die blijft verborgen.
  showPublicEditions: false,
  gameModes: ['timeline', 'duo'],
  editions: [tessaEdition],
}

await writeFile('.private/tessa-manifest.json', `${JSON.stringify(tessa, null, 2)}\n`)
await writeFile('.private/lodewijk-manifest.json', `${JSON.stringify(lodewijk, null, 2)}\n`)
await writeFile('.private/iris-manifest.json', `${JSON.stringify(iris, null, 2)}\n`)
await writeFile('.private/nikki-manifest.json', `${JSON.stringify(nikki, null, 2)}\n`)
console.log(`Iris: ${iris.editions.reduce((sum, edition) => sum + edition.tracks.length, 0)} kaarten`)
console.log(`Nikki: ${nikki.editions.reduce((sum, edition) => sum + edition.tracks.length, 0)} kaarten`)
console.log(`Lodewijk: ${lodewijk.editions.reduce((sum, edition) => sum + edition.tracks.length, 0)} kaarten`)
console.log(`Tessa: ${tessa.editions.reduce((sum, edition) => sum + edition.tracks.length, 0)} kaarten`)
