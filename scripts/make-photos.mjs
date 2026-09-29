/**
 * Turn photo album originals into web assets.
 *
 *   photo-src/<album>/<id>.{jpg,jpeg,png,heic}
 *       →  public/photos/<album>/<id>.webp        (lightbox)
 *          public/photos/<album>/<id>-thumb.webp  (grid)
 *          src/content/photo-dims.json            { "<album>/<id>": {w,h} }
 *          src/content/photo-manifest.json        { "<album>": ["id", …] }
 *
 * Run with `npm run photos:compress` after dropping a folder into
 * photo-src/. Originals stay gitignored, like art-src/ — only the .webp
 * output is committed.
 *
 * Deliberately the same shape as scripts/compress-art.mjs: same sharp
 * settings, same full/thumb split, same reason for recording dimensions
 * (the grid reserves each card's exact aspect ratio before the image
 * arrives, so a slow connection does not make the layout jump).
 *
 * This writes the photo LIST but never the album's title or date — those
 * live in src/content/photos.json and are yours. A folder with no entry
 * there is reported at the end rather than invented.
 */
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import sharp from 'sharp'

const root = fileURLToPath(new URL('..', import.meta.url))
const SRC = path.join(root, 'photo-src')
const OUT = path.join(root, 'public', 'photos')
const DIMS = path.join(root, 'src', 'content', 'photo-dims.json')
const MANIFEST = path.join(root, 'src', 'content', 'photo-manifest.json')
const ALBUMS = path.join(root, 'src', 'content', 'photos.json')

/**
 * Filenames off a phone or a camera roll are not URL material: they arrive as
 * "1 (1).jpeg", "FullSizeRender 2.jpeg", "IMG_2830.JPEG". Spaces and
 * parentheses would end up in image paths needing escaping, so the id is
 * slugified. It is derived from the filename rather than a running number so
 * that re-running after adding a photo does not renumber the others and
 * silently break an album's hand-picked `cover`.
 */
const slugify = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'photo'

/**
 * Numeric-aware sort, so "1 (2)" comes before "1 (10)". A plain sort orders
 * those the other way round, which silently shuffles an album.
 */
const natural = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

const FULL_MAX = 2000 // longest edge in the lightbox
const THUMB_W = 700 // grid cards are never wider than this on a 2x screen
const SOURCE_EXT = new Set(['.jpg', '.jpeg', '.png', '.heic'])

let albumDirs = []
try {
  albumDirs = (await readdir(SRC, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
} catch {
  console.error(`No ${path.relative(root, SRC)}/ directory yet.`)
  console.error('Create one folder per album, e.g. photo-src/kyoto-2025/, then re-run.')
  process.exit(1)
}

if (albumDirs.length === 0) {
  console.error(`${path.relative(root, SRC)}/ has no album folders in it.`)
  process.exit(1)
}

const dims = {}
const manifest = {}
let savedBytes = 0
let count = 0

for (const album of albumDirs) {
  const dir = path.join(SRC, album)
  const files = (await readdir(dir))
    .filter((file) => SOURCE_EXT.has(path.extname(file).toLowerCase()))
    .sort((a, b) => natural.compare(a, b))

  if (files.length === 0) {
    console.warn(`${album}: no images, skipped`)
    continue
  }

  await mkdir(path.join(OUT, album), { recursive: true })
  manifest[album] = []
  console.log(`\n${album}`)

  const taken = new Set()

  for (const file of files) {
    const base = slugify(path.basename(file, path.extname(file)))
    // Two different files can slugify to the same thing ("a b.jpg" and
    // "a-b.jpg"); suffix rather than silently overwrite one with the other.
    let id = base
    for (let n = 2; taken.has(id); n += 1) id = `${base}-${n}`
    taken.add(id)

    const input = path.join(dir, file)
    const key = `${album}/${id}`

    const meta = await sharp(input).metadata()

    // EXIF orientation 5-8 mean the stored pixels are rotated 90°, so the
    // displayed aspect ratio is the transpose of width/height. Recording the
    // raw values would make those cards render sideways in the grid — and
    // phone photos hit this constantly.
    const swapped = (meta.orientation ?? 1) >= 5
    const width = swapped ? meta.height : meta.width
    const height = swapped ? meta.width : meta.height

    const full = await sharp(input)
      .rotate() // bake EXIF orientation into the pixels
      .resize({ width: FULL_MAX, height: FULL_MAX, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(path.join(OUT, `${key}.webp`))

    const thumb = await sharp(input)
      .rotate()
      .resize({ width: THUMB_W, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(path.join(OUT, `${key}-thumb.webp`))

    const before = (await stat(input)).size
    savedBytes += before - full.size - thumb.size
    dims[key] = { w: width, h: height }
    manifest[album].push(id)
    count += 1

    const kb = (n) => `${(n / 1024).toFixed(0)}kB`
    console.log(
      `  ${id.padEnd(24)} ${String(width).padStart(5)}x${String(height).padEnd(5)} ` +
        `${kb(before).padStart(8)} → ${kb(full.size).padStart(7)} + ${kb(thumb.size)}`,
    )
  }
}

await writeFile(DIMS, `${JSON.stringify(dims, null, 2)}\n`)
await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`)

console.log(`\n${count} photos in ${Object.keys(manifest).length} albums`)
console.log(`saved ${(savedBytes / 1024 / 1024).toFixed(1)}MB`)
console.log(`dims     → ${path.relative(root, DIMS)}`)
console.log(`manifest → ${path.relative(root, MANIFEST)}`)

// Folders with no entry in photos.json would compress fine and then never
// appear anywhere, which is a confusing way to lose an afternoon.
try {
  const authored = JSON.parse(await readFile(ALBUMS, 'utf8'))
  const known = new Set(authored.map((a) => a.id))
  const missing = Object.keys(manifest).filter((id) => !known.has(id))
  const empty = authored.filter((a) => !manifest[a.id]).map((a) => a.id)

  if (missing.length) {
    console.log(`\nAdd these to ${path.relative(root, ALBUMS)} or they will not be listed:`)
    for (const id of missing) console.log(`  { "id": "${id}", "title": "…", "date": "…" }`)
  }
  if (empty.length) {
    console.log(`\nListed in photos.json but no photos found: ${empty.join(', ')}`)
  }
} catch {
  console.log(`\nCould not read ${path.relative(root, ALBUMS)} to cross-check album names.`)
}
