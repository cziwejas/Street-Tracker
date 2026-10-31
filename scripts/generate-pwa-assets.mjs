import { mkdir, readFile, writeFile } from 'node:fs/promises'
import sharp from 'sharp'

// Use the same vector mark as the app header. All PNGs have an opaque background;
// the maskable variants keep the whole mark inside the central safe circle.
const root = new URL('../', import.meta.url)
const publicRoot = new URL('public/', root)
const source = await readFile(new URL('favicon.svg', publicRoot), 'utf8')
const pngOptions = { palette: true, colours: 32, compressionLevel: 9 }

for (const [filename, size, maskable] of [
  ['favicon-32.png', 32, false],
  ['apple-touch-icon.png', 180, false],
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-maskable-192.png', 192, true],
  ['icon-maskable-512.png', 512, true],
]) {
  const svg = maskable
    ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#101418"/><svg x="10" y="10" width="80" height="80">${source}</svg></svg>`
    : source
  await writeFile(new URL(filename, publicRoot), await sharp(Buffer.from(svg)).resize(size, size).png(pngOptions).toBuffer())
}

// CSS viewport width/height and pixel ratio. Exact media queries let iOS choose
// a native-resolution launch image in either orientation, including older SEs.
const screens = [
  [320, 568, 2], [375, 667, 2], [414, 736, 3], [375, 812, 3],
  [414, 896, 2], [414, 896, 3], [390, 844, 3], [393, 852, 3],
  [402, 874, 3], [420, 912, 3], [428, 926, 3], [430, 932, 3], [440, 956, 3],
]
await mkdir(new URL('splash/', publicRoot), { recursive: true })
const links = []
for (const [width, height, ratio] of screens) {
  for (const orientation of ['portrait', 'landscape']) {
    const w = orientation === 'portrait' ? width : height
    const h = orientation === 'portrait' ? height : width
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w * ratio}" height="${h * ratio}" viewBox="0 0 ${w} ${h}">
      <rect width="${w}" height="${h}" fill="#101418"/>
      <svg x="${(w - 112) / 2}" y="${(h - 112) / 2}" width="112" height="112">${source}</svg>
    </svg>`
    const filename = `splash/${w * ratio}x${h * ratio}.png`
    // Different viewport/ratio combinations can share a physical resolution.
    await writeFile(new URL(filename, publicRoot), await sharp(Buffer.from(svg)).png(pngOptions).toBuffer())
    links.push(`    <link rel="apple-touch-startup-image" href="/${filename}" media="(device-width: ${width}px) and (device-height: ${height}px) and (-webkit-device-pixel-ratio: ${ratio}) and (orientation: ${orientation})" />`)
  }
}
const htmlFile = new URL('index.html', root)
const html = await readFile(htmlFile, 'utf8')
await writeFile(htmlFile, html.replace(
  /    <!-- pwa:startup-images -->[\s\S]*?    <!-- \/pwa:startup-images -->/,
  `    <!-- pwa:startup-images -->\n${links.join('\n')}\n    <!-- /pwa:startup-images -->`,
))
console.log('Generated PWA icons and iPhone launch images from public/favicon.svg.')
