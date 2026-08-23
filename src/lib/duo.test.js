import { describe, expect, it } from 'vitest'
import { answerMatches, clampPlayerCount, duoRoundPoints, freshDuoMatch, loadDuoMatch } from './duo.js'

describe('TRACKBACK Duo', () => {
  it('verdeelt twee punten voor de tijdlijn en één per muziekgok', () => {
    expect(duoRoundPoints({ timeline: true, artist: true, title: true })).toBe(4)
    expect(duoRoundPoints({ timeline: false, artist: true, title: false })).toBe(1)
  })

  it('accepteert hoofdletters, accenten en duidelijke verkorte antwoorden', () => {
    expect(answerMatches('Céline Dion', 'celine dion')).toBe(true)
    expect(answerMatches('I Wanna Dance with Somebody', 'dance with somebody')).toBe(true)
    expect(answerMatches('Lady Gaga, Bruno Mars', 'bruno marz')).toBe(true)
    expect(answerMatches('P!nk feat. Nate Ruess', 'pink')).toBe(true)
    expect(answerMatches('Madonna', 'Maroon')).toBe(false)
    expect(answerMatches('Queen', 'q')).toBe(false)
  })

  it('valt bij ongeldige opslag veilig terug op een nieuw duel', () => {
    expect(loadDuoMatch({ getItem: () => '{kapot' })).toEqual(freshDuoMatch())
  })

  it('maakt een scorebord voor één tot zes spelers', () => {
    expect(clampPlayerCount(1)).toBe(1)
    expect(clampPlayerCount(9)).toBe(6)
    expect(freshDuoMatch(4).players.map(player => player.name)).toEqual(['Speler A', 'Speler B', 'Speler C', 'Speler D'])
    expect(loadDuoMatch({ getItem: () => JSON.stringify(freshDuoMatch(3)) }, 3).players).toHaveLength(3)
  })
})
