# Techniek en beheer

## Technische opbouw

- React 18 en Vite 5
- QR-generatie met `qrcode`
- QR-scanning met ZXing
- Compacte kaartpayloads met `fflate`
- Spotify Authorization Code met PKCE
- Statische publicatie via GitHub Pages
- Geëncrypteerde persoonlijke cadeaus met AES-GCM

## Belangrijkste mappen

- `src/` — appcode, stijlen en tests
- `src/lib/` — collectie-, cadeau- en Spotify-logica
- `public/decks/` — openbare muziekedities
- `public/gifts/` — versleutelde persoonlijke cadeaus
- `scripts/` — import-, curatie-, encryptie- en QR-tools
- `.private/` — onversleutelde privébronbestanden; nooit publiceren
- `private-output/` — lokale privé-uitvoer, zoals Iris’ QR
- `.github/workflows/` — automatische test/build/publicatie
- `dist/` — gebouwde productieversie

## Lokaal starten

```bash
npm install
npm run dev
```

## Controleren

```bash
npm test
npm run build
```

## Publiceren

Een push naar de `main`-branch start de GitHub Pages-workflow. Repository:

<https://github.com/tessavdn-creator/ons-muziekspel>

De live site staat op:

<https://tessavdn-creator.github.io/ons-muziekspel/>

## Lokale browseropslag

De Studio bewaart de actieve collectie, Client ID, spelkeuze en printinstellingen lokaal in de browser. Een andere browser of computer krijgt deze gegevens niet automatisch. Download daarom regelmatig een JSON-back-up van de actieve collectie.

