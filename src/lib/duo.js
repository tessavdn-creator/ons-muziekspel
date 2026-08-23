export const DUO_SCORE_KEY = 'trackback.duo-score.v1'

export const cleanAnswer = value => String(value || '')
  .toLowerCase()
  .replace(/p!nk/g, 'pink')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]/g, '')

const editDistance = (left, right) => {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let row = 1; row <= left.length; row += 1) {
    let diagonal = previous[0]
    previous[0] = row
    for (let column = 1; column <= right.length; column += 1) {
      const above = previous[column]
      previous[column] = Math.min(previous[column] + 1, previous[column - 1] + 1, diagonal + Number(left[row - 1] !== right[column - 1]))
      diagonal = above
    }
  }
  return previous[right.length]
}

const answerParts = value => {
  const original = String(value || '')
  const parts = original.split(/\s*(?:,|&|\+|\/|;|\bx\b|\bfeat(?:uring)?\.?\b|\bft\.?\b|\bwith\b)\s*/i)
  return [...new Set([original, ...parts].map(cleanAnswer).filter(Boolean))]
}

export const answerMatches = (answer, guess) => {
  const entered = cleanAnswer(guess)
  if (entered.length < 3) return false
  return answerParts(answer).some(expected => {
    if (expected.includes(entered) || entered.includes(expected)) return true
    if (entered.length < 4 || expected.length < 4) return false
    const allowedErrors = Math.max(1, Math.floor(Math.max(expected.length, entered.length) / 6))
    return editDistance(expected, entered) <= allowedErrors
  })
}

export const duoRoundPoints = checks => (checks.timeline ? 2 : 0) + (checks.artist ? 1 : 0) + (checks.title ? 1 : 0)

export const clampPlayerCount = value => {
  const count = Number(value)
  return Math.min(6, Math.max(1, Number.isFinite(count) && count > 0 ? count : 2))
}

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
