# TRACKBACK

Een muziekspel met twee gescheiden ervaringen. TRACKBACK Studio importeert nummers en maakt kaarten; de openbare play-app scant en speelt ze af zonder titel, artiest of jaartal vooraf te tonen.

- Admin: `https://tessavdn-creator.github.io/ons-muziekspel/#admin`
- Play: `https://tessavdn-creator.github.io/ons-muziekspel/#play`

De complete Nederlandse documentatie staat in [`docs/`](docs/00-START-HIER.md).

## Starten

```bash
npm install
npm run dev
```

Open de getoonde lokale URL. Voor cameratoegang op een echte telefoon moet de app via HTTPS worden gepubliceerd; `localhost` op dezelfde computer is ook toegestaan.

## Eerste spel maken

1. Open **Importeren**, koppel Spotify en importeer een playlist.
2. Open **Muziek** en controleer titels, artiesten en oorspronkelijke jaartallen.
3. Open **Printen**, vul de editienaam in en print eerst één testvel.
4. Open de play-app op de DJ-telefoon, kies **Scan een kaart** en geef cameratoegang.

Nieuwe QR-codes zijn zelfstandig. Ze bevatten compact gecodeerd de kaart-ID, Spotify URI, onthulgegevens en publieke Spotify Client ID. Een andere telefoon hoeft de collectie dus niet te importeren. Dit is codering voor gebruiksgemak, geen cryptografische beveiliging tegen technisch inspecteren.

De QR-payload wordt gecomprimeerd en met een ruime witte rand geprint. De scanner kiest bij voorkeur de 1080p-achtercamera. Werkt live scannen op een toestel niet goed, gebruik dan **Scan vanuit foto** en kies een scherpe foto van de volledige QR-code.

Per nummer kan in Studio een genrethema worden gekozen: pop, disco, rock, electronic of soul. De play-app gebruikt dit als subtiele kleurhint met bewegende discolichten.

## Spotify-prototype

1. TRACKBACK is vooraf ingesteld met de publieke Client ID.
2. Kies **Koppel Spotify** en log één keer in met een toegestaan Premium-account.
3. Importeer in Studio eventueel een playlist waarvan je eigenaar/collaborator bent.
4. Voeg iedere extra DJ in het Developer Dashboard toe via **Settings → Users Management**. Development Mode ondersteunt maximaal vijf toegelaten Spotify-gebruikers.

Een speler hoeft nooit een Client ID, verificatiecode, access token of Client Secret in te vullen. De browser gebruikt Authorization Code met PKCE, bewaart de refresh token lokaal en vernieuwt access tokens automatisch. Spotify vraagt na het verlopen of intrekken van de koppeling opnieuw om toestemming.

De Spotify-adapter is een privé technisch prototype. De actuele Spotify-policy verbiedt muziektrivia en vereist bij streaming zichtbare metadata. Gebruik dit niet als publiek of commercieel Spotify-product zonder afzonderlijke toestemming.

## Controle

```bash
npm test
npm run build
```
