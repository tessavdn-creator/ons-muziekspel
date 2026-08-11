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

- De speelkaarten zijn vierkant: 89 × 89 mm, zes kaarten per A4-vel.
- Iedere persoonlijke set heeft een eigen basiskleur; genreaccenten maken rock, disco, electronic, soul, Nederlands en classics extra herkenbaar.
- Print QR-codes met een volledig witte rand.
- Laat de printer niet automatisch extreem verkleinen.
- Test op zowel iPhone als Android als dat mogelijk is.
- Houd glanzend papier uit direct licht tijdens het scannen.
- Bewaar de CSV-inhoudsopgave apart; daarop staan de kaartnummers en antwoorden.
