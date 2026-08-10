# Ons Muziekspel

Een muziekspel met twee gescheiden ervaringen. Timepop Studio importeert nummers en maakt kaarten; de openbare play-app scant en speelt ze af zonder titel, artiest of jaartal vooraf te tonen.

- Admin: `https://tessavdn-creator.github.io/ons-muziekspel/#admin`
- Play: `https://tessavdn-creator.github.io/ons-muziekspel/#play`

## Starten

```bash
npm install
npm run dev
```

Open de getoonde lokale URL. Voor cameratoegang op een echte telefoon moet de app via HTTPS worden gepubliceerd; `localhost` op dezelfde computer is ook toegestaan.

## Eerste spel maken

1. Open **Collectie** en voeg nummers toe of importeer een CSV/JSON.
2. Gebruik voor CSV de kolommen `Title, Artist, Year, Spotify URL, Audio URL`.
3. Open **Kaarten**, vul het definitieve HTTPS-adres van de app in en print eerst één testvel.
4. Open de play-app op de speltelefoon, kies **Scan een kaart** en geef cameratoegang.

Nieuwe QR-codes zijn zelfstandig. Ze bevatten compact gecodeerd de kaart-ID, Spotify URI, onthulgegevens en publieke Spotify Client ID. Een andere telefoon hoeft de collectie dus niet te importeren. Dit is codering voor gebruiksgemak, geen cryptografische beveiliging tegen technisch inspecteren.

## Spotify-prototype

1. Maak in het Spotify Developer Dashboard een app aan.
2. Voeg de Redirect URI toe die onder **Instellen** wordt getoond.
3. Plak de Client ID, verbind Spotify en importeer een playlist waarvan je eigenaar/collaborator bent.
4. Een Premium-account is nodig voor playback in de webapp.
5. Voeg iedere vriend in het Developer Dashboard toe via **Settings → Users Management**. Development Mode ondersteunt maximaal vijf toegelaten Spotify-gebruikers.

Plak nooit handmatig een access token of Client Secret in de app of broncode. De browser gebruikt Authorization Code met PKCE, bewaart de refresh token lokaal en vernieuwt access tokens automatisch. Spotify vraagt na het verlopen of intrekken van de koppeling opnieuw om toestemming.

De Spotify-adapter is een privé technisch prototype. De actuele Spotify-policy verbiedt muziektrivia en vereist bij streaming zichtbare metadata. Gebruik dit niet als publiek of commercieel Spotify-product zonder afzonderlijke toestemming.

## Controle

```bash
npm test
npm run build
```
