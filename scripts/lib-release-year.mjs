// Het uitgavejaar van een nummer bepalen uit meerdere publieke bronnen.
//
// Geen enkele publieke catalogus heeft populair repertoire betrouwbaar goed, en
// ze falen op verschillende manieren:
//
//   opname       MusicBrainz recording   te LAAT, honderden losse records per hit
//   uitgave      MusicBrainz release-group  te LAAT bij een verzamelaar
//   spotify      Spotify releasedatum    te LAAT bij een remaster
//   itunesVroeg  vroegste iTunes-treffer te VROEG bij een gelijknamig nummer
//   itunesVaak   meest voorkomende iTunes-jaar, meestal de echte uitgave
//
// Daarom wint niet de mediaan maar de MEEST GENOEMDE waarde, met de mediaan als
// gelijkspelbreker. Gemeten op 27 met de hand nagekeken nummers: 24 exact goed en
// alle 27 binnen een jaar, tegen 17 exact en bijna drie jaar gemiddelde afwijking
// met alleen de mediaan van drie bronnen.
//
// Deze regel staat apart omdat twee scripts hem gebruiken. Een tweede kopie zou
// stilletjes uit de pas gaan lopen, en dat merk je pas op gedrukte kaarten.

export const VROEGSTE_JAAR = 1940

const mediaan = waarden => [...waarden].sort((links, rechts) => links - rechts)[Math.floor(waarden.length / 2)]

export function stemming(jaren) {
  const tally = new Map()
  jaren.forEach(jaar => tally.set(jaar, (tally.get(jaar) || 0) + 1))
  const hoogste = Math.max(...tally.values())
  const kandidaten = [...tally.entries()].filter(([, aantal]) => aantal === hoogste).map(([jaar]) => jaar)
  if (kandidaten.length === 1) return kandidaten[0]
  const midden = mediaan(jaren)
  return kandidaten.reduce((beste, jaar) => (Math.abs(jaar - midden) < Math.abs(beste - midden) ? jaar : beste))
}

// bronnen: { opname, uitgave, spotify, itunesVroeg, itunesVaak } als getallen of 0.
// periode: optioneel { vanaf, totEn }. Buiten die periode plus twee jaar marge is
// een uitkomst onzin en wordt alleen binnen de periode opnieuw gestemd. Die zeef
// draait NA de stemming: andersom knip je juist het goede antwoord weg, want
// Enjoy the Silence staat in All Out 80s maar is van 1990.
export function bepaalJaar(bronnen, periode = {}) {
  const vanaf = Number(periode.vanaf) || 0
  const totEn = Number(periode.totEn) || 0
  const heeftPeriode = vanaf > 0 && totEn >= vanaf
  const nu = new Date().getFullYear()
  const alle = Object.values(bronnen).map(Number).filter(jaar => jaar >= VROEGSTE_JAAR && jaar <= nu)
  if (!alle.length) return null

  let bruikbaar = alle
  let jaar = stemming(alle)
  if (heeftPeriode && (jaar < vanaf - 2 || jaar > totEn + 2)) {
    const binnen = alle.filter(kandidaat => kandidaat >= vanaf && kandidaat <= totEn)
    if (!binnen.length) return null
    bruikbaar = binnen
    jaar = stemming(binnen)
  }

  const eens = bruikbaar.filter(kandidaat => Math.abs(kandidaat - jaar) <= 1).length
  return {
    jaar,
    eens,
    bronnenGebruikt: bruikbaar.length,
    zekerheid: eens >= 3 ? 'drie of meer bronnen eens' : eens === 2 ? 'twee bronnen eens' : 'geen enkele bevestiging',
  }
}

// De vijf signalen uit een verrijkte track halen.
export function bronnenVan(track) {
  return {
    opname: track.yearSource === 'MusicBrainz first release' ? Number(track.year) || 0 : 0,
    uitgave: Number(track.releaseGroupYear) || 0,
    spotify: Number(track.spotifyYear) || 0,
    itunesVroeg: Number(track.itunesYear) || 0,
    itunesVaak: Number(track.itunesModalYear) || 0,
  }
}

export const toonBronnen = bronnen =>
  `opname ${bronnen.opname || '-'} / uitgave ${bronnen.uitgave || '-'} / Spotify ${bronnen.spotify || '-'} / iTunes ${bronnen.itunesVroeg || '-'}, ${bronnen.itunesVaak || '-'}`
