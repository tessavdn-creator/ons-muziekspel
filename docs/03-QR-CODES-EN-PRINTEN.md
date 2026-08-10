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

- 60 kaarten voor Hidden Corners;
- 60 kaarten voor The Crooked Timeline;
- 60 kaarten voor After Dark;
- 100 kaarten voor Guilty Pleasures;
- Iris’ bibliotheek-QR;
- een CSV- en JSON-inhoudsopgave;
- één ZIP-bestand.

Benodigde invoer:

```bash
SPOTIFY_CLIENT_ID='jouw-publieke-client-id' \
IRIS_GIFT_KEY='de-sleutel-uit-de-persoonlijke-link' \
npm run generate:qrs
```

De definitieve uitvoer komt standaard in `Documenten/TRACKBACK QR-codes/trackback-qr-bundle-...`.

Gebruik hier nooit een Spotify Client Secret of access token.

## Printadvies

- Print QR-codes met een volledig witte rand.
- Laat de printer niet automatisch extreem verkleinen.
- Test op zowel iPhone als Android als dat mogelijk is.
- Houd glanzend papier uit direct licht tijdens het scannen.
- Bewaar de CSV-inhoudsopgave apart; daarop staan de kaartnummers en antwoorden.

