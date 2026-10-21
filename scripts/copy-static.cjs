const fs = require('fs')
const path = require('path')

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

ensureDir(path.join(__dirname, '..', 'dist', 'renderer'))
ensureDir(path.join(__dirname, '..', 'dist', 'engine'))

const copies = [
  ['src/renderer/index.html', 'dist/renderer/index.html'],
  ['src/renderer/overlay.html', 'dist/renderer/overlay.html'],
  ['src/renderer/styles.css', 'dist/renderer/styles.css'],
  ['src/engine/engine.py', 'dist/engine/engine.py']
]

for (const [src, dest] of copies) {
  fs.copyFileSync(path.join(__dirname, '..', src), path.join(__dirname, '..', dest))
}
