export const DUO_SCORE_KEY = 'trackback.duo-score.v1'

export const cleanAnswer = value => String(value || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]/g, '')

export const answerMatches = (answer, guess) => {
  const expected = cleanAnswer(answer)
  const entered = cleanAnswer(guess)
  return entered.length > 2 && (expected.includes(entered) || entered.includes(expected))
}

export const duoRoundPoints = checks => (checks.timeline ? 2 : 0) + (checks.artist ? 1 : 0) + (checks.title ? 1 : 0)

export const clampPlayerCount = value => Math.min(6, Math.max(2, Number(value) || 2))

export const freshDuoMatch = (playerCount = 2) => ({
  rounds: 0,
  players: Array.from({ length: clampPlayerCount(playerCount) }, (_, index) => ({
    name: `Speler ${String.fromCharCode(65 + index)}`,
    score: 0,
  })),
})

export const loadDuoMatch = (storage, playerCount = 2) => {
  const count = clampPlayerCount(playerCount)
  try {
    const saved = JSON.parse(storage?.getItem(DUO_SCORE_KEY) || 'null')
    if (saved?.players?.length === count) return saved
  } catch { /* Start met een schone score bij beschadigde lokale data. */ }
  return freshDuoMatch(count)
}
