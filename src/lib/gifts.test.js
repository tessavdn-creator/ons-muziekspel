import { describe, expect, it } from 'vitest'
import { giftRefFromHash } from './gifts.js'

describe('persoonlijke cadeau-links', () => {
  it('leest alleen een geldige gift-id met sleutel', () => {
    expect(giftRefFromHash('#gift=g-7n4p2d8k.geheime-sleutel')).toEqual({ id: 'g-7n4p2d8k', key: 'geheime-sleutel' })
    expect(giftRefFromHash('#play')).toBeNull()
    expect(giftRefFromHash('#gift=zonder-sleutel')).toBeNull()
  })
})
