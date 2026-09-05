# Persoonlijke en algemene edities

## Algemene edities

Algemene edities staan in `public/decks/` en worden opgenomen in `public/decks/index.json`. Ze verschijnen automatisch in de algemene bibliotheek van persoonlijke cadeaupagina’s.

Huidige algemene editie:

- **Guilty Pleasures** — 100 nummers.

## Persoonlijke editie van Iris

Iris heeft drie privé-edities:

- **Hidden Corners** — 100 nummers;
- **The Crooked Timeline** — 100 nummers;
- **After Dark** — 100 nummers.
- **Crowd Pleasers** — 100 toegankelijke publieksfavorieten uit de top van de officiële NPO Radio 2 Top 2000 van 2025.

Samen vormen deze vier delen één persoonlijke bibliotheek van 400 unieke kaarten. De eerste drie zijn eigenzinniger en moeilijker; Crowd Pleasers is bewust laagdrempelig.

Iris ziet via haar cadeau-QR uitsluitend deze vier persoonlijke edities. De
algemene bibliotheek is voor haar verborgen en haar play-app gebruikt alleen
het basisspel Tijdlijn, zonder spelwisselaar.

De online cadeau-inhoud staat versleuteld in `public/gifts/g-7n4p2d8k.json`. De sleutel staat alleen in de persoonlijke QR/link. Zonder die sleutel kan de website het cadeau niet ontsleutelen.

Wie de volledige persoonlijke QR of link krijgt, kan de editie wel openen. Behandel die daarom als een toegangssleutel en publiceer hem niet.

## Persoonlijke editie van Nikki

Nikki heeft **Full Throttle**: 300 unieke kaarten, verspreid geselecteerd uit de 1.612 nummers van haar openbare playlist Auto classics. Exacte dubbelen zijn verwijderd en geen enkele artiest domineert de selectie.

De online cadeau-inhoud staat versleuteld in `public/gifts/g-m8q4v2zk.json`. Net als bij Iris staat de ontsleutelsleutel uitsluitend in Nikki's persoonlijke QR/link.

## Persoonlijke editie van Lodewijk

Lodewijk heeft **Lodewijk zijn Platenkast**: 300 kaarten met het zwaartepunt op de jaren 60, 70 en 80, aangevuld met een herkenbaar staartje uit de jaren 90 en 00. Daarvan zijn er 26 Nederlandstalig of Nederpop.

De bronnen zijn de publieke Spotify-decenniumlijsten, de top van de NPO Radio 2 Top 2000 en vier Nederlandse lijsten. Die laatste zijn nodig omdat de internationale lijsten vrijwel geen Nederlands repertoire bevatten, terwijl dat voor een Nederlandse Top 2000-liefhebber juist de herkenbaarste kaarten zijn. Het Nederlandse quotum werkt twee kanten op: zonder bovengrens vulden die lijsten de jaren 70 en 80 bijna helemaal, want ze leveren honderden hoog noterende kandidaten.

Deze editie wordt op 50 × 50 mm gedrukt, 20 kaarten per A4.

De online cadeau-inhoud staat versleuteld in `public/gifts/g-5k9w3rt2.json`, met de sleutel uitsluitend in zijn persoonlijke QR/link.

## Persoonlijke editie van Tessa

Tessa heeft **Alles Door Elkaar**: 300 kaarten uit haar drie eigen playlists door elkaar. Alle 300 komen rechtstreeks uit HotGirlsSummer (28), Guilty Pleasures (329) en Ahrtal (175), samen 511 unieke nummers.

### De volledige playlist ophalen zonder login

Dit kostte drie pogingen en is de moeite waard om te onthouden:

| ingang | wat hij geeft |
| --- | --- |
| `open.spotify.com/embed/playlist/<id>` | maximaal 100 nummers, ook met `offset` of `limit` |
| `api.spotify.com` met de anonieme token uit die embedpagina | 429 QUOTA_EXCEEDED, altijd |
| `api-partner.spotify.com/pathfinder` met diezelfde token | **alles**, in pagina's van 100 |

De webplayer gebruikt die derde ingang zelf. Er hoort een vaste query-hash bij die in de webplayer-bundel staat. Verandert die hash, dan haal je hem daar opnieuw uit:

```bash
curl -s https://open.spotify.com/playlist/<id> | grep -o 'web-player\.[a-f0-9]*\.js'
curl -s https://open.spotifycdn.com/cdn/build/web-player/<bestand> \
  | grep -o 'fetchPlaylist","query","[a-f0-9]\{64\}'
```

De variabelen zijn `{uri, offset, limit, enableWatchFeedEntrypoint}`; die laatste is verplicht, ook al doet hij hier niets. Per pagina komen titel, alle artiesten los, album, uitgavedatum en hoes mee, dus er hoeft geen losse trackpagina meer opgehaald te worden. Dat lost meteen het oude probleem op waarbij "Earth, Wind & Fire" uit een ld+json-omschrijving als "Earth" tevoorschijn kwam.

`build-tessa-pool.mjs` valt terug op de embed als dit faalt, en zegt dan luid dat de lijst bij 100 stopt.

### Kiezen uit 511 nummers

Drie regels, allemaal tegen een scheve stapel:

- **Over de lijsten.** Naar rato zou Guilty Pleasures met 326 kandidaten 185 van de 300 kaarten pakken, en dat is nu net de lijst die het minst Nederlands is (9%) en het minst recent (8% van na 2005). Ahrtal en HotGirlsSummer staan er precies andersom in: 24% en 64% Nederlands, 30% en 64% van na 2005. De verdeling ligt daarom vast op **28 + 135 + 137**, in te stellen met `TESSA_LIJST_QUOTA`.

  Ahrtal verder leegtrekken helpt niet: bij 158 in plaats van 135 blijft het aantal Nederlandse kaarten gelijk op 53 en komen er drie recente bij. De winst zit in de eerste stap, niet in de laatste.

- **Binnen een lijst.** De eerste zoveel nummers pakken zou de oudste helft overslaan, want Spotify bewaart de volgorde van toevoegen. De lijst wordt in evenveel vakjes geknipt als er kaarten nodig zijn en uit ieder vakje komt er een.

- **Binnen een vakje.** Ruime QR eerst, dan de artiest met de minste kaarten, en dan gaat een Nederlandstalig of recenter nummer voor. Dit breekt alleen een gelijkspel binnen hetzelfde vakje, dus de selectie loopt nog steeds van de eerste tot de laatste toevoeging.

Hooguit vijf kaarten per artiest; in de praktijk komt er geen artiest boven vier uit. Deze editie wordt op 50 × 50 mm gedrukt, 20 kaarten per A4, in hetzelfde doosje als dat van Lodewijk.

De online cadeau-inhoud staat versleuteld in `public/gifts/g-t7k2m9wq.json`, met de sleutel uitsluitend in haar persoonlijke link.

### Aanvullen uit de artiestentops (nu niet gebruikt)

`expand-tessa-pool.mjs` kan de pool aanvullen met de publieke top van dezelfde artiesten. Dat was nodig zolang alleen de embed beschikbaar leek. Nu de volledige lijsten binnenkomen, staat die stap uit.

Blijft hij nuttig voor een volgende editie, houd dan de zeef in `build-tessa-edition.mjs` aan. Een artiestentop is een momentopname en bevat drie soorten nummers die niet op een kaart horen:

| wat | voorbeeld dat er doorheen kwam |
| --- | --- |
| remix of heruitgave van iets dat al in het deck zit | Chipz — 1001 Arabian Nights (Hak op de Tak Remix) |
| cover van iets dat al in het deck zit | Kygo — What's Love Got to Do with It, naast die van Tina Turner |
| dezelfde plaat, andere schrijfwijze | KISS — I Was Made For Lovin' You naast I Was Made for Loving You |
| splinternieuwe single die nog niemand kent | Kanye West — I CAN'T WAIT (2026) |

### Jaartallen

Voor een tijdlijnspel is het jaartal de kern van de kaart, en juist daar zitten de valkuilen. Geen enkele publieke bron heeft dit repertoire goed genoeg.

Er stemmen daarom vijf signalen mee, die op verschillende manieren falen:

| signaal | faalt hoe |
| --- | --- |
| MusicBrainz recording | te laat, honderden losse records per beroemd nummer |
| MusicBrainz release-group | te laat bij een verzamelaar, soms te vroeg |
| Spotify releasedatum | te laat bij een remaster: *Hit the Road Jack* staat er als 2021 |
| iTunes, vroegste treffer | te vroeg bij een gelijknamig nummer: *Billie Jean* uit 1966 |
| iTunes, meest genoemde jaar | meestal de echte uitgave |

De **meest genoemde** waarde wint, met de mediaan als gelijkspelbreker. Gemeten op 27 met de hand nagekeken nummers: 24 exact en alle 27 binnen een jaar, tegen 17 exact en bijna drie jaar gemiddelde afwijking toen alleen de mediaan van drie bronnen werd gebruikt.

Daarna volgt een zeef op de periode van de bronlijst, met twee jaar marge. Die volgorde is belangrijk: zeef je eerst, dan knip je juist het goede antwoord weg. *Enjoy the Silence* staat in All Out 80s maar is van 1990, en dan blijft alleen het foute 1985 over. Een bron die twee decennia beslaat krijgt een bereik in plaats van één decennium; zonder dat glipte *Sound Of The Screaming Day* van Golden Earring erdoor op 2008 terwijl het van 1968 is.

Voor Tessa's editie draait dezelfde weging, maar **zonder de periodezeef**: haar bronnen zijn playlists die niets over een jaar zeggen, terwijl Lodewijks decenniumlijsten dat wel deden. Elf kaarten zijn daar met de hand gecorrigeerd in `.private/tessa-jaartallen-handmatig.csv`. De patronen die daarin terugkomen:

- **alleen heruitgaven gevonden**: KISS — I Was Made for Lovin' You kreeg 2022 in plaats van 1979, Elvis Presley — In the Ghetto 2002 in plaats van 1969, Roy Orbison — In Dreams 1987 (de heruitgave na *Blue Velvet*) in plaats van 1963;
- **een gelijknamig ander nummer**: Enrique Iglesias — Bailando kreeg 1998 van een enkele iTunes-treffer, terwijl het 2014 is;
- **de opnamedatum in plaats van de uitgave**: Bob Carlisle — Butterfly Kisses kreeg 1995, maar de eerste uitgave is 1996;
- **te weinig treffers om iets te bevestigen**: Las Ketchup — The Ketchup Song kwam op 2000 uit één iTunes-regel, terwijl het de zomer van 2002 is.

De les: bij minder dan vijf iTunes-treffers zegt een eensgezind jaartal weinig. Die kaarten zijn stuk voor stuk met de hand tegen MusicBrainz gelegd.

Blijft een nummer onbevestigd, dan komt het in `.private/lodewijk-jaartallen-controleren.csv`. Dat bestand heeft de kolommen om meteen als `.private/lodewijk-jaartallen-handmatig.csv` terug te voeren; handmatige jaartallen krijgen voorrang op alle bronnen.

Beide uitnodigings-QR's openen eerst een persoonlijke felicitatie met confetti. Daarna verschijnt de privébibliotheek. Gewone speelkaart-QR's slaan deze cadeau-onthulling over.

## Privébronbestanden

De map `.private/` bevat de onversleutelde bron-, sleutel- en curatiebestanden van Iris, Nikki, Lodewijk en Tessa. Deze bestanden zijn alleen voor beheer en mogen niet op een publieke website, in een openbare repository of in een gedeeld downloadpakket terechtkomen.

De gewone play-app toont persoonlijke edities nooit automatisch. Ze openen uitsluitend via hun unieke cadeaulink.
