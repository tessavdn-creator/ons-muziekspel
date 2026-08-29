// Splitst een dubbelzijdige kaarten-PDF in losse voor- en achterkantbestanden,
// voor wie geen duplexprinter heeft en het papier met de hand omdraait.
//
// De achterkanten bestaan in twee varianten. Welke je nodig hebt hangt af van
// hoe jouw printer het papier weer inneemt, en dat is per apparaat anders. Met
// het testvel kost uitzoeken welke het is precies een blad papier.
import { mkdtemp, rm, readdir, mkdir, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { tmpdir } from 'node:os'
import path from 'node:path'

const run = promisify(execFile)
const [duplexA, duplexB, doel] = process.argv.slice(2)
if (!duplexA || !duplexB || !doel) {
  throw new Error('Gebruik: node scripts/split-front-back.mjs GESPIEGELD.pdf ONGESPIEGELD.pdf UITVOERMAP')
}

const splits = async pdf => {
  const temp = await mkdtemp(path.join(tmpdir(), 'trackback-split-'))
  await run('pdfseparate', [pdf, path.join(temp, 'p-%04d.pdf')])
  const pagina = (await readdir(temp)).filter(n => n.endsWith('.pdf')).sort()
  return {
    temp,
    voor: pagina.filter((_, index) => index % 2 === 0).map(n => path.join(temp, n)),
    achter: pagina.filter((_, index) => index % 2 === 1).map(n => path.join(temp, n)),
  }
}

const bundel = async (delen, naar) => {
  await run('pdfunite', [...delen, naar])
  return delen.length
}

await mkdir(doel, { recursive: true })
const a = await splits(duplexA)
const b = await splits(duplexB)
try {
  const voorkanten = await bundel(a.voor, path.join(doel, '01 ALLE VOORKANTEN.pdf'))
  const achterA = await bundel(a.achter, path.join(doel, '02 ACHTERKANTEN A - omslaan lange zijde.pdf'))
  const achterB = await bundel(b.achter, path.join(doel, '03 ACHTERKANTEN B - andere kant om.pdf'))

  // Testvellen: een enkel blad, zodat uitzoeken welke variant klopt een vel kost.
  await bundel([a.voor[0]], path.join(doel, '00 TESTVEL - stap 1 voorkant.pdf'))
  await bundel([a.achter[0]], path.join(doel, '00 TESTVEL - stap 2 achterkant A.pdf'))
  await bundel([b.achter[0]], path.join(doel, '00 TESTVEL - stap 2 achterkant B.pdf'))

  console.log(`${voorkanten} voorkanten, ${achterA} achterkanten A, ${achterB} achterkanten B`)
} finally {
  await rm(a.temp, { recursive: true, force: true })
  await rm(b.temp, { recursive: true, force: true })
}
