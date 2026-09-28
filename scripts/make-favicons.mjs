/**
 * Raster favicon fallbacks, generated from public/favicon.svg.
 *
 * The SVG is the real favicon and every current browser prefers it — it is
 * the only one that can flip black-to-white with prefers-color-scheme, so
 * the mark survives a dark tab strip. These exist for what cannot read it:
 * older Safari, link-preview and RSS scrapers, and bookmark UIs, most of
 * which request /favicon.ico from the site root without being asked.
 *
 * Run: npm run favicons
 */
import { Buffer } from 'node:buffer'
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const src = path.join(root, 'public', 'favicon.svg')

/**
 * A raster cannot respond to the colour scheme, so it is drawn once in the
 * site's ink. Black on a dark tab strip would vanish, so this is the warm
 * near-black from the palette rather than pure #000 — it stays legible
 * against grey chrome without looking like a different mark.
 */
const INK = '#3A332B'

/** iOS composites a home-screen icon onto black, so it needs a real ground. */
const CLAY = '#D2CBBC'

const star = (size, fill) =>
  sharp(Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="${size}" height="${size}">` +
    `<path fill="${fill}" d="M10 1 L12.23 6.93 L18.56 7.22 L13.61 11.17 L15.29 17.28 L10 13.8 ` +
    `L4.71 17.28 L6.39 11.17 L1.44 7.22 L7.77 6.93 Z"/></svg>`,
  ))

/**
 * Pack PNGs into an .ico.
 *
 * sharp cannot emit ICO, but the format has allowed whole PNGs inside it
 * since Vista, so this is a 6-byte directory header plus one 16-byte entry
 * per image and then the PNG bytes verbatim. Far less code than a BMP
 * encoder and every browser that asks for .ico accepts it.
 */
function ico(images) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // 1 = icon
  header.writeUInt16LE(images.length, 4)

  let offset = 6 + images.length * 16
  const entries = []

  for (const { size, data } of images) {
    const entry = Buffer.alloc(16)
    entry.writeUInt8(size >= 256 ? 0 : size, 0) // 0 means 256
    entry.writeUInt8(size >= 256 ? 0 : size, 1)
    entry.writeUInt8(0, 2) // palette count
    entry.writeUInt8(0, 3) // reserved
    entry.writeUInt16LE(1, 4) // colour planes
    entry.writeUInt16LE(32, 6) // bits per pixel
    entry.writeUInt32LE(data.length, 8)
    entry.writeUInt32LE(offset, 12)
    entries.push(entry)
    offset += data.length
  }

  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)])
}

const sizes = [16, 32, 48]
const pngs = await Promise.all(
  sizes.map(async (size) => ({ size, data: await star(size, INK).png().toBuffer() })),
)

await writeFile(path.join(root, 'public', 'favicon.ico'), ico(pngs))
console.log(`favicon.ico      ${sizes.join('/')}px`)

// Padded to ~72% so the star is not jammed into the corners of the rounded
// square iOS crops it into.
await star(132, INK)
  .extend({ top: 24, bottom: 24, left: 24, right: 24, background: CLAY })
  .flatten({ background: CLAY })
  .png()
  .toFile(path.join(root, 'public', 'apple-touch-icon.png'))
console.log('apple-touch-icon.png  180px')

console.log(`\nsource ${path.relative(root, src)} is unchanged and still the primary icon.`)
