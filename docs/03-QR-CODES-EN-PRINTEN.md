# QR-codes en printen

## Wat zit in een speelkaart-QR?

Een kaart bevat compact en gecomprimeerd:

- kaart-ID;
- titel, artiest, jaar en album voor de onthulling;
- Spotify URI;
- publieke Spotify Client ID;
- genre en spel-tags;
- eventueel een rechtstreekse eigen audio-URL.

De gegevens zijn gecodeerd voor gebruiksgemak, niet cryptografisch geheim. Een technisch onderlegde gebruiker kan de inhoud uitlezen.

## Complete QR-bundel

Het commando `npm run generate:qrs` maakt:

- 100 kaarten voor Hidden Corners;
- 100 kaarten voor The Crooked Timeline;
- 100 kaarten voor After Dark;
- 100 kaarten voor Crowd Pleasers;
- 300 kaarten voor Nikki's Full Throttle;
- 100 kaarten voor Guilty Pleasures;
- Iris’ en Nikki's bibliotheek-QR;
- een CSV- en JSON-inhoudsopgave;
- één ZIP-bestand.

Benodigde invoer:

```bash
SPOTIFY_CLIENT_ID='jouw-publieke-client-id' \
npm run generate:qrs
```

Op de beheercomputer leest de generator de twee cadeausleutels automatisch uit `.private/gifts/`. Op een andere computer kunnen `IRIS_GIFT_KEY` en `NIKKI_GIFT_KEY` als omgevingsvariabelen worden meegegeven.

De definitieve uitvoer komt standaard in `Documenten/TRACKBACK QR-codes/trackback-qr-bundle-...`.

Gebruik hier nooit een Spotify Client Secret of access token.

De losse cadeau-uitnodigingen staan in `Documenten/TRACKBACK QR-codes/Persoonlijke edities/`. Iedere ontvangersmap bevat een QR-PNG, een printbare A5-PDF, een HTML-versie en een klikbare `.webloc`.

## Printadvies

- De speelkaarten zijn vierkant. Er zijn twee rasters, in te stellen met `TRACKBACK_CARD_MM`:
  - **60 mm**, 12 per A4, met 3 mm tussenruimte en snijhoekjes per kaart. Dit is de standaard en het formaat van Iris en Nikki.
  - **50 mm**, 20 per A4, zonder tussenruimte. Snijden gaat hier op de ticks in de papiermarge: iedere snede is exact 50 mm, wat op een hefboomsnijmachine één instelling van de aanleg betekent.
- Kleiner dan 50 mm kan niet. De QR moet de kaart-ID, Spotify-link, titel, artiest, jaar en Client ID dragen; bij 45 mm zakt de modulegrootte onder 0,40 mm en gaan kaarten met lange titels stil weigeren. Gemeten inktvloei-tolerantie: 0,20 mm bij 60 mm, 0,16 mm bij 50 mm, tegen 0,05 tot 0,10 mm die een inkjet op 100 tot 120 g/m² in de praktijk geeft.
- Controleer na het genereren met `node scripts/verify-printed-cards.mjs KAARTEN.pdf EDITIE.json`. Die leest iedere QR uit de PDF terug, vergelijkt de inhoud met de editie, en toetst per vakje of de achterkant bij de juiste voorkant hoort na het omslaan. Voor het 60 mm-raster: `VERIFY_CARD_MM=60 VERIFY_COLUMNS=3 VERIFY_ROWS=4 VERIFY_GAP_MM=3`.

## Snijtekens

De snijtekens lopen door tot ongeveer 3 mm van de papierrand, aan alle vier de kanten. Dat is bewust: op een hefboomsnijmachine snijd je eerst de marge weg, en tekens die vlak bij het kaartblok staan zijn dan meteen verdwenen. Een lang teken houdt zijn referentie tot de laatste snede.

Er zit geen aparte meetlat op het vel. De schaalcontrole zit in de tekens zelf, want de afstand tussen twee aangrenzende tekens is per definitie de kaartmaat. Meet die na met een liniaal voordat je gaat snijden.

## Printen zonder duplexprinter

Kan de printer niet zelf dubbelzijdig, dan splitst `scripts/split-front-back.mjs` een kaarten-PDF in losse voor- en achterkantbestanden.

De achterkanten komen in twee varianten, omdat het van de printer afhangt hoe het papier weer wordt ingenomen. Variant A is per rij gespiegeld, voor wie omslaat aan de lange zijde; variant B is ongespiegeld. Die tweede maak je met `TRACKBACK_BACK_MIRROR=none` op de generator. Er horen testvellen van een enkel blad bij, zodat uitzoeken welke variant klopt geen vijftien vellen kost.
- Iedere persoonlijke set heeft een eigen basiskleur; genreaccenten maken rock, disco, electronic, soul, Nederlands en classics extra herkenbaar.
- Print QR-codes met een volledig witte rand.
- Laat de printer niet automatisch extreem verkleinen.
- Test op zowel iPhone als Android als dat mogelijk is.
- Houd glanzend papier uit direct licht tijdens het scannen.
- Bewaar de CSV-inhoudsopgave apart; daarop staan de kaartnummers en antwoorden.
