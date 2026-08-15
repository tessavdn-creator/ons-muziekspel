# Spotify en meerdere telefoons

## Aanbevolen voor een spelavond

Gebruik één telefoon als DJ-telefoon. Alleen dat toestel scant de kaarten en speelt de muziek af. De andere spelers gebruiken de fysieke kaarten en hoeven niets te installeren of te koppelen.

Dit is de eenvoudigste opzet en voorkomt dat Spotify-testplaatsen onnodig bezet raken.

## Development Mode

- De eigenaar van de Spotify-app heeft Premium nodig.
- Development Mode ondersteunt maximaal vijf toegestane Spotify-gebruikers.
- Een extra gebruiker moet in het Spotify Developer Dashboard aan **Users Management** worden toegevoegd.
- Een Client ID is openbaar en kan veilig in een QR-kaart staan.
- Een Client Secret en access token mogen nooit worden gedeeld of in een QR worden gezet.

De app gebruikt Authorization Code met PKCE. Tokens worden alleen lokaal in de browser van het gekoppelde toestel opgeslagen.

Deze Spotify-controle is voor volledige nummers verplicht. TRACKBACK handelt de PKCE-code volledig onzichtbaar af: de speler kiest alleen **Koppel Spotify**, logt bij Spotify in en keert terug naar het spel. Er hoeft nergens een Client ID of verificatiecode te worden overgetypt.

## Nieuwe telefoon

Een definitief geprinte TRACKBACK-kaart neemt de publieke Client ID mee. Bij de eerste afspeelpoging opent Spotify de veilige inlogpagina. Daarna zet TRACKBACK de mobiele browserplayer vooraf klaar en activeert de playknop het geluid rechtstreeks. Dezelfde telefoon kan volgende kaarten afspelen zolang de toestemming geldig is.

## Beperking voor een volwaardige app

Spotify staat games en muziekquizzen met Spotify-content niet toe zonder schriftelijke toestemming. De huidige Spotify-adapter is daarom alleen geschikt als privé technisch prototype. Voor openbare of commerciële publicatie is een andere, rechtmatig gelicentieerde audiobron of expliciete toestemming nodig.
