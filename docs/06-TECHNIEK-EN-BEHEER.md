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
- `scripts/` — import-, curatie-, encryptie-, QR- en controletools
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

## Valkuilen die zich stil voordoen

### Jaartallen uit MusicBrainz

`enrich-years-musicbrainz.mjs` vroeg lange tijd maar acht zoekresultaten op. Voor een beroemd nummer bestaan in MusicBrainz tientallen tot honderden losse recording-records, één per verzamelaar of remaster, en die komen op zoekscore binnen in plaats van op datum. Met acht resultaten zie je dus alleen heruitgaven en kies je een veel te laat jaar: *Respect* van Aretha Franklin werd 1992 in plaats van 1967.

Het script vraagt nu honderd resultaten op. Dat lost de meeste gevallen op, maar niet alle: bij nummers met honderden heruitgaven, zoals *Whole Lotta Love*, blijft ook honderd te weinig. Toets een nieuwe editie daarom altijd aan een tweede signaal, bijvoorbeeld het decennium van de bronlijst, en neem de vroegste van de bronnen. Een heruitgave is altijd later dan het origineel, nooit vroeger.

De edities **Full Throttle** (Nikki) en de drie eerste Iris-edities zijn met de oude versie gebouwd en bevatten hierdoor foute jaartallen: 44 respectievelijk 20 kaarten zitten er meer dan twee jaar naast. Deze zijn al gedrukt en niet gecorrigeerd. *Crowd Pleasers* is wel goed, want die gebruikte de officiële Top 2000-lijst.

### Ophaalscripts die stil blijven hangen

Node's `fetch` kent geen standaard tijdslimiet. Een verbinding die blijft hangen legt een script stil zonder ooit een fout te geven: twee jaartalrondes stonden zo een uur op 0% processorgebruik terwijl MusicBrainz zelf gewoon binnen een halve seconde antwoordde. Stilte ziet er hetzelfde uit als "nog bezig". Alle drie de `enrich-years-*`-scripts wikkelen hun verzoeken nu in `haalOp`, met 20 seconden limiet en drie pogingen.

### De pool opnieuw opbouwen wist opgehaalde jaartallen

`build-lodewijk-pool.mjs` bouwde de kandidatenlijst vanaf nul. Een bron toevoegen aan `SOURCES` gooide daarmee ruim een uur aan MusicBrainz- en iTunes-werk weg. Het script versmelt nu met de bestaande pool op `spotifyUri`.

### zbarimg leest streepjescodes die er niet zijn

Met alleen `-Sqrcode.enable` blijven de andere symbologieen actief, en die zien in een QR-patroon soms een Interleaved 2 of 5 met zestien cijfers. Gebruik `-Sdisable -Sqrcode.enable`, anders meldt de controle een onleesbare kaart die niet bestaat.

### QR-afbeeldingen verschillen per build

`fflate` zet een tijdstempel in de gzip-kop van de kaartpayload. Twee builds van dezelfde editie geven daardoor verschillende QR-áfbeeldingen met identieke inhoud. Een pixelvergelijking tussen twee builds is dus geen bruikbare regressietest; vergelijk de gedecodeerde inhoud met `verify-printed-cards.mjs`.

## Lokale browseropslag

De Studio bewaart de actieve collectie, Client ID, spelkeuze en printinstellingen lokaal in de browser. Een andere browser of computer krijgt deze gegevens niet automatisch. Download daarom regelmatig een JSON-back-up van de actieve collectie.

