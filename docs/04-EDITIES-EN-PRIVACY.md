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

Tessa heeft **Alles Door Elkaar**: 300 kaarten uit haar drie eigen playlists door elkaar. 209 kaarten komen rechtstreeks uit HotGirlsSummer, Guilty Pleasures en Ahrtal; de overige 91 komen uit de publieke top van precies dezelfde artiesten.

Die aanvulling was nodig omdat de publieke embed-pagina van Spotify nooit meer dan 100 nummers per playlist prijsgeeft, en twee van haar lijsten zijn langer (329 en 175). Zonder eigen Spotify-login zijn 223 van haar 532 nummers zichtbaar. De aanvulling uit haar eigen artiesten is een beter antwoord dan nummers verzinnen: dezelfde smaak, en het hoogst genoteerde werk van een artiest is per definitie het herkenbaarste.

Wil je de volledige lijsten alsnog: importeer ze in Studio met een Spotify-login, download per lijst de JSON-back-up, zet die in `.private/tessa-bronnen/` en draai `build-tessa-pool.mjs` opnieuw. Een bestand daar wint van de embed.

Een artiestentop is wel een momentopname, en daar staan drie soorten nummers in die niet op een kaart horen. `build-tessa-edition.mjs` zeeft ze eruit:

| wat | voorbeeld dat er in de eerste ronde doorheen kwam |
| --- | --- |
| remix of heruitgave van een nummer dat al in het deck zit | Chipz — 1001 Arabian Nights (Hak op de Tak Remix) |
| cover van een nummer dat al in het deck zit | Kygo — What's Love Got to Do with It, naast die van Tina Turner |
| dezelfde plaat, andere schrijfwijze | KISS — I Was Made For Lovin' You naast I Was Made for Loving You |
| splinternieuwe single die nog niemand kent | Kanye West — I CAN'T WAIT (2026) |

Aanvullingen van na 2023 vallen daarom af. Haar eigen nummers vallen buiten die zeef: die heeft zij zelf gekozen, hoe nieuw of hoe geremixt ook.

Deze editie wordt op 50 × 50 mm gedrukt, 20 kaarten per A4, in hetzelfde doosje als dat van Lodewijk.

De online cadeau-inhoud staat versleuteld in `public/gifts/g-t7k2m9wq.json`, met de sleutel uitsluitend in haar persoonlijke link.

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

Voor Tessa's editie draait dezelfde weging, maar **zonder de periodezeef**: haar bronnen zijn playlists die niets over een jaar zeggen, terwijl Lodewijks decenniumlijsten dat wel deden. Twaalf kaarten zijn daar met de hand gecorrigeerd in `.private/tessa-jaartallen-handmatig.csv`, waaronder KISS — I Was Made for Lovin' You (de bronnen zagen alleen heruitgaven en kozen 2022 in plaats van 1979) en Las Ketchup — The Ketchup Song (2000 in plaats van 2002).

Blijft een nummer onbevestigd, dan komt het in `.private/lodewijk-jaartallen-controleren.csv`. Dat bestand heeft de kolommen om meteen als `.private/lodewijk-jaartallen-handmatig.csv` terug te voeren; handmatige jaartallen krijgen voorrang op alle bronnen.

Beide uitnodigings-QR's openen eerst een persoonlijke felicitatie met confetti. Daarna verschijnt de privébibliotheek. Gewone speelkaart-QR's slaan deze cadeau-onthulling over.

## Privébronbestanden

De map `.private/` bevat de onversleutelde bron-, sleutel- en curatiebestanden van Iris, Nikki, Lodewijk en Tessa. Deze bestanden zijn alleen voor beheer en mogen niet op een publieke website, in een openbare repository of in een gedeeld downloadpakket terechtkomen.

De gewone play-app toont persoonlijke edities nooit automatisch. Ze openen uitsluitend via hun unieke cadeaulink.
