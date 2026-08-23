import { describe, expect, it } from 'vitest'
import { buildRoomInviteUrl } from './rooms.js'

describe('room invites', () => {
  it('preserves the app path and adds only the room id', () => {
    const invite = new URL(buildRoomInviteUrl('https://example.com/ons-muziekspel/?card=old#admin', 'room-123'))
    expect(invite.pathname).toBe('/ons-muziekspel/')
    expect(invite.searchParams.get('room')).toBe('room-123')
    expect(invite.searchParams.has('card')).toBe(false)
    expect(invite.hash).toBe('#play')
  })
})
