/**
 * Turn full-resolution painting originals into web assets.
 *
 *   art-src/<id>.{jpg,jpeg,png}   →   public/art/<id>.webp        (lightbox)
 *                                     public/art/<id>-thumb.webp  (grid)
 *                                     src/content/art-dims.json   (aspect ratios)
 *
 * Run with `npm run art:compress` after dropping a new painting in
 * art-src/. Originals stay gitignored — they are ~60MB and would bloat
 * the repo permanently; only the .webp output is committed.
 *
 * The dims file is what lets the gallery reserve each card's exact
 * aspect ratio before the image loads, so a slow connection doesn't
 * make the grid jump around as pieces arrive.
 */
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import sharp from 'sharp'

const root = fileURLToPath(new URL('..', import.meta.url))
const SRC = path.join(root, 'art-src')
const OUT = path.join(root, 'public', 'art')
const DIMS = path.join(root, 'src', 'content', 'art-dims.json')

const FULL_MAX = 1800 // longest edge in the lightbox
const THUMB_W = 700 // grid cards are never wider than this on a 2x screen
const SOURCE_EXT = new Set(['.jpg', '.jpeg', '.png'])

await mkdir(OUT, { recursive: true })

const files = (await readdir(SRC)).filter((f) => SOURCE_EXT.has(path.extname(f).toLowerCase()))

if (files.length === 0) {
  console.error(`No images found in ${SRC}`)
  process.exit(1)
}

const dims = {}
let savedBytes = 0

for (const file of files.sort()) {
  const id = path.basename(file, path.extname(file))
  const input = path.join(SRC, file)

  const image = sharp(input)
  const meta = await image.metadata()

  // EXIF orientation 5-8 mean the stored pixels are rotated 90°, so the
  // displayed aspect ratio is the transpose of width/height. Recording
  // the raw values would make those cards render sideways in the grid.
  const swapped = (meta.orientation ?? 1) >= 5
  const width = swapped ? meta.height : meta.width
  const height = swapped ? meta.width : meta.height

  const full = await sharp(input)
    .rotate() // bake EXIF orientation into the pixels
    .resize({ width: FULL_MAX, height: FULL_MAX, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(path.join(OUT, `${id}.webp`))

  const thumb = await sharp(input)
    .rotate()
    .resize({ width: THUMB_W, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(path.join(OUT, `${id}-thumb.webp`))

  // sharp only reports metadata.size for buffer inputs, not file paths,
  // so measure the original on disk instead of trusting it.
  const before = (await stat(input)).size
  savedBytes += before - full.size - thumb.size
  dims[id] = { w: width, h: height }

  const kb = (n) => `${(n / 1024).toFixed(0)}kB`
  console.log(
    `${id.padEnd(26)} ${String(width).padStart(5)}x${String(height).padEnd(5)} ` +
      `${kb(before).padStart(8)} → ${kb(full.size).padStart(7)} + ${kb(thumb.size)}`,
  )
}

await writeFile(DIMS, `${JSON.stringify(dims, null, 2)}\n`)

console.log(`\n${files.length} pieces · saved ${(savedBytes / 1024 / 1024).toFixed(1)}MB`)
console.log(`dims → ${path.relative(root, DIMS)}`)
