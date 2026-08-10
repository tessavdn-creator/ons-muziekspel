import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { randomBytes, createCipheriv } from 'node:crypto'
import { dirname } from 'node:path'

const [input, giftId, output, keyFile] = process.argv.slice(2)
if (!input || !giftId || !output || !keyFile) throw new Error('Gebruik: node scripts/encrypt-gift.mjs INVOER.json GIFT-ID UITVOER.json PRIVÉSLEUTEL.txt')
const base64url = value => Buffer.from(value).toString('base64url')
let key
try { key = Buffer.from((await readFile(keyFile, 'utf8')).trim(), 'base64url') } catch { key = randomBytes(32) }
if (key.length !== 32) throw new Error('De privésleutel moet 32 bytes zijn.')
const iv = randomBytes(12)
const cipher = createCipheriv('aes-256-gcm', key, iv)
const encrypted = Buffer.concat([cipher.update(await readFile(input)), cipher.final(), cipher.getAuthTag()])
await mkdir(dirname(output), { recursive: true })
await mkdir(dirname(keyFile), { recursive: true })
await writeFile(output, `${JSON.stringify({ v: 1, iv: base64url(iv), data: base64url(encrypted) })}\n`)
await writeFile(keyFile, `${base64url(key)}\n`, { mode: 0o600 })
console.log(`#gift=${giftId}.${base64url(key)}`)
