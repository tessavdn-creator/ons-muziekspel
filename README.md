# Ons Muziekspel

Een local-first muziekspel voor een persoonlijke kaartenset. De app importeert nummers, maakt geheime QR-kaarten, scant ze met de telefooncamera en onthult titel/artiest/jaar pas wanneer de spelers dat willen.

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
4. Importeer via **Collectie → CSV / JSON** dezelfde JSON-back-up op de speltelefoon.
5. Open **Spelen**, kies **Scan een kaart** en geef cameratoegang.

De QR-code bevat alleen een willekeurige kaart-ID. De bijbehorende collectie staat in de lokale opslag van de browser en moet daarom op het speltoestel aanwezig zijn.

## Spotify-prototype

1. Maak in het Spotify Developer Dashboard een app aan.
2. Voeg de Redirect URI toe die onder **Instellen** wordt getoond.
3. Plak de Client ID, verbind Spotify en importeer een playlist waarvan je eigenaar/collaborator bent.
4. Een Premium-account is nodig voor playback in de webapp.

De Spotify-adapter is een privé technisch prototype. De actuele Spotify-policy verbiedt muziektrivia en vereist bij streaming zichtbare metadata. Gebruik dit niet als publiek of commercieel Spotify-product zonder afzonderlijke toestemming.

## Controle

```bash
npm test
npm run build
```
