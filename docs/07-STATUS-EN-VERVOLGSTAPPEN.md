# Status en vervolgstappen

## Wat werkt nu

- mobielvriendelijke play-app in dark mode;
- live QR-scanner en scan vanuit foto;
- verborgen playback en onthulling;
- Tijdlijn, Raad de hit, Muziekbingo en Battle of the Hits;
- Spotify-login met PKCE en tokenvernieuwing;
- playlistimport voor eigenaar/collaborator;
- kaart-, bingo-, cover-, regel- en scoreprintables;
- algemene editiecatalogus;
- versleutelde persoonlijke cadeaupagina's met felicitatie en confetti;
- 400 persoonlijke kaarten voor Iris en 300 voor Nikki;
- vierkante speelkaarten met een eigen setkleur en genreaccenten;
- één algemene editie;
- persoonlijke A5-uitnodigingen, QR-codes en klikbare links in Documenten;
- volledige QR-bundelgenerator;
- automatische tests, build en GitHub Pages-publicatie.

## Nog nodig voor de definitieve QR-bundel

De publieke Spotify Client ID moet één keer aan de QR-generator worden doorgegeven. Daarna kunnen de 800 definitieve speelkaartcodes — 400 voor Iris, 300 voor Nikki en 100 algemeen — plus de ZIP in Documenten worden gemaakt.

## Logische volgende productstappen

1. Een beheerde database toevoegen voor edities en gebruikers.
2. Inloggen en rollen toevoegen voor maker, eigenaar en speler.
3. Publiceren van algemene edities rechtstreeks vanuit Studio.
4. Persoonlijke cadeau-edities vanuit Studio genereren en bijwerken.
5. Een toegestane audiobron en rechtenmodel kiezen.
6. Echte groepssessies, teams en scorebord toevoegen.
7. Automatische end-to-endtests voor camera-, print- en loginroutes uitbreiden.

Zonder backend is de huidige versie bewust een statische, lokale Studio met een openbare play-app. Dat is geschikt voor privéproeven en cadeaus, maar nog niet voor een zelfstandig commercieel platform.
