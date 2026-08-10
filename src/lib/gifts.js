const ACCESS_KEY = 'timepop.gift-access.v1'

const fromBase64Url = value => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='))
  return Uint8Array.from(binary, character => character.charCodeAt(0))
}

export function giftRefFromHash(hash = location.hash) {
  if (!hash.startsWith('#gift=')) return null
  const [id, key] = hash.slice(6).split('.')
  return /^[a-z0-9-]{3,80}$/i.test(id || '') && key ? { id, key } : null
}

export function clearSavedGiftRefs() {
  const hadSavedRefs = Boolean(localStorage.getItem(ACCESS_KEY))
  localStorage.removeItem(ACCESS_KEY)
  return hadSavedRefs
}

export async function loadGift(ref) {
  const response = await fetch(`${import.meta.env.BASE_URL}gifts/${encodeURIComponent(ref.id)}.json`, { cache: 'no-store' })
  if (!response.ok) throw new Error('Deze persoonlijke editie bestaat niet of is niet meer beschikbaar.')
  const envelope = await response.json()
  const key = await crypto.subtle.importKey('raw', fromBase64Url(ref.key), 'AES-GCM', false, ['decrypt'])
  try {
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64Url(envelope.iv) }, key, fromBase64Url(envelope.data))
    const gift = JSON.parse(new TextDecoder().decode(plaintext))
    if (!Array.isArray(gift.editions)) throw new Error('invalid')
    return gift
  } catch {
    throw new Error('De persoonlijke sleutel in deze uitnodiging klopt niet.')
  }
}
