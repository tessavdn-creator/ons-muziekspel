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

Lodewijk heeft **Lodewijk zijn Platenkast**: 300 kaarten met het zwaartepunt op de jaren 60, 70 en 80, aangevuld met een herkenbaar staartje uit de jaren 90 en 00. De nummers komen uit de publieke Spotify-decenniumlijsten en de top van de NPO Radio 2 Top 2000.

Deze editie wordt op 50 × 50 mm gedrukt, 20 kaarten per A4.

De online cadeau-inhoud staat versleuteld in `public/gifts/g-5k9w3rt2.json`, met de sleutel uitsluitend in zijn persoonlijke QR/link.

### Jaartallen

Voor een tijdlijnspel is het jaartal de kern van de kaart, en juist daar zitten de valkuilen. Spotify geeft vaak de datum van een heruitgave: *Hit the Road Jack* van Ray Charles staat er als 2021. MusicBrainz heeft voor beroemde nummers honderden losse records, één per verzamelaar of remaster, en levert dan ook een veel te laat jaar.

Beide bronnen falen dezelfde kant op: een heruitgave is altijd **later** dan het origineel. Daarom neemt `build-lodewijk-edition.mjs` de vroegste van de twee, en toetst die aan het decennium van de bronlijst. Wat daarna nog uiteenloopt, komt in `.private/lodewijk-jaartallen-controleren.csv` voor handmatige controle.

Beide uitnodigings-QR's openen eerst een persoonlijke felicitatie met confetti. Daarna verschijnt de privébibliotheek. Gewone speelkaart-QR's slaan deze cadeau-onthulling over.

## Privébronbestanden

De map `.private/` bevat de onversleutelde bron-, sleutel- en curatiebestanden van Iris en Nikki. Deze bestanden zijn alleen voor beheer en mogen niet op een publieke website, in een openbare repository of in een gedeeld downloadpakket terechtkomen.

De gewone play-app toont persoonlijke edities nooit automatisch. Ze openen uitsluitend via hun unieke cadeaulink.
