import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'

const [inputPdf, outputPdf, rawCardCount = '100'] = process.argv.slice(2)
if (!inputPdf || !outputPdf) {
  throw new Error('Gebruik: node scripts/build-single-sided-fold-cards.mjs INVOER.pdf UITVOER.pdf [AANTAL_KAARTEN]')
}

const cardCount = Number(rawCardCount)
if (!Number.isInteger(cardCount) || cardCount < 1) throw new Error('Ongeldig aantal kaarten.')

const run = (command, args) => {
  const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 })
  if (result.status !== 0) throw new Error(`${command} mislukt:\n${result.stderr || result.stdout}`)
}

const temp = await mkdtemp(path.join(os.tmpdir(), 'trackback-fold-cards-'))
const sourcePrefix = path.join(temp, 'source')
const pageFiles = []

// The existing compact Iris PDF is the source of truth. Rendering it at
// 300 dpi preserves the tested QR codes and all current card artwork.
run('pdftoppm', ['-r', '300', '-png', inputPdf, sourcePrefix])

const sourcePages = (await readdir(temp))
  .filter(file => /^source-\d+\.png$/.test(file))
  .sort((left, right) => Number(left.match(/\d+/)[0]) - Number(right.match(/\d+/)[0]))

const expectedSourcePages = Math.ceil(cardCount / 8) * 2
if (sourcePages.length !== expectedSourcePages) {
  throw new Error(`Verwacht ${expectedSourcePages} bronpagina's, gevonden: ${sourcePages.length}.`)
}

// A4 at 300 dpi. The original grid starts at these measured PDF positions.
const cropWidth = 1051
const cropHeight = 803
const columnX = [174, 1255]
const rowY = [103, 936, 1769, 2602]
const horizontalBorder = 189
const verticalBorder = 148

for (let outputPage = 0; outputPage < Math.ceil(cardCount / 4); outputPage += 1) {
  const stripFiles = []
  for (let slot = 0; slot < 4; slot += 1) {
    const cardIndex = outputPage * 4 + slot
    const sourceSheet = Math.floor(cardIndex / 8)
    const position = cardIndex % 8
    const row = Math.floor(position / 2)
    const column = position % 2
    const frontPage = path.join(temp, sourcePages[sourceSheet * 2])
    const backPage = path.join(temp, sourcePages[sourceSheet * 2 + 1])
    const frontCrop = `${cropWidth}x${cropHeight}+${columnX[column]}+${rowY[row]}`
    // Duplex backs were mirrored per row. Undo that mapping for the fold pair.
    const backCrop = `${cropWidth}x${cropHeight}+${columnX[1 - column]}+${rowY[row]}`
    const stripFile = path.join(temp, `strip-${String(outputPage + 1).padStart(3, '0')}-${slot + 1}.png`)
    run('/opt/homebrew/bin/magick', [
      '(', frontPage, '-crop', frontCrop, '+repage', ')',
      '(', backPage, '-crop', backCrop, '+repage', ')',
      '+append',
      stripFile,
    ])
    stripFiles.push(stripFile)
  }
  const outputPageFile = path.join(temp, `fold-${String(outputPage + 1).padStart(3, '0')}.png`)
  run('/opt/homebrew/bin/magick', [
    ...stripFiles,
    '-append',
    '-bordercolor', 'white', '-border', `${horizontalBorder}x${verticalBorder}`,
    '-stroke', '#ffcf25', '-strokewidth', '2',
    '-draw', `line ${horizontalBorder + cropWidth},${verticalBorder} ${horizontalBorder + cropWidth},${3508 - verticalBorder}`,
    '-units', 'PixelsPerInch', '-density', '300',
    outputPageFile,
  ])
  pageFiles.push(outputPageFile)
}

run('/opt/homebrew/bin/magick', [
  '-units', 'PixelsPerInch', '-density', '300', '-page', '2480x3508',
  ...pageFiles,
  '-compress', 'Zip', outputPdf,
])

await rm(temp, { recursive: true, force: true })
console.log(`${cardCount} enkelzijdige vouwkaarten: ${outputPdf}`)
