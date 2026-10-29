#!/usr/bin/env node
// ------------------------------------------------------------
// patch-electron-dev — só macOS, só desenvolvimento.
// O nome em negrito na barra de menus ("Electron") vem do Info.plist do
// Electron.app dentro de node_modules; app.setName() não o altera em dev.
// Aqui trocamos o nome para CallVortex e o ícone pela logo do app.
// Idempotente; o app empacotado (electron-builder) já usa productName e
// build/icon.png. Precisa ser reexecutado se o Electron for reinstalado.
// Uso: node scripts/patch-electron-dev.mjs
// ------------------------------------------------------------
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, copyFileSync, rmSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

if (process.platform !== 'darwin') process.exit(0)

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const NAME = 'CallVortex'

let electronDir
try {
  electronDir = dirname(createRequire(join(root, 'package.json')).resolve('electron/package.json'))
} catch {
  console.error('[patch-electron-dev] electron não encontrado — rode pnpm install')
  process.exit(1)
}
const app = join(electronDir, 'dist', 'Electron.app')
const plist = join(app, 'Contents', 'Info.plist')
const icns = join(app, 'Contents', 'Resources', 'electron.icns')
const logo = join(root, 'build', 'icon.png')
if (!existsSync(plist)) {
  console.error('[patch-electron-dev] Electron.app ausente — o binário do Electron não foi baixado')
  process.exit(1)
}

const PLISTBUDDY = '/usr/libexec/PlistBuddy'
const read = (key) => {
  try {
    return execFileSync(PLISTBUDDY, ['-c', `Print :${key}`, plist]).toString().trim()
  } catch {
    return ''
  }
}
const set = (key, value) => {
  try {
    execFileSync(PLISTBUDDY, ['-c', `Set :${key} ${value}`, plist])
  } catch {
    execFileSync(PLISTBUDDY, ['-c', `Add :${key} string ${value}`, plist])
  }
}

let changed = false
for (const key of ['CFBundleName', 'CFBundleDisplayName']) {
  if (read(key) !== NAME) {
    set(key, NAME)
    changed = true
  }
}

// Ícone: gera o .icns a partir de build/icon.png; a marca ao lado evita refazer
const stamp = join(electronDir, 'dist', '.callvortex-icon')
const logoSig = existsSync(logo) ? String(readFileSync(logo).length) : ''
const stamped = existsSync(stamp) ? readFileSync(stamp, 'utf8').trim() : ''
if (logoSig && stamped !== logoSig) {
  const tmp = mkdtempSync(join(tmpdir(), 'cv-icon-'))
  try {
    const iconset = join(tmp, 'icon.iconset')
    mkdirSync(iconset)
    for (const size of [16, 32, 128, 256, 512]) {
      for (const scale of [1, 2]) {
        const px = size * scale
        const file = scale === 1 ? `icon_${size}x${size}.png` : `icon_${size}x${size}@2x.png`
        execFileSync('sips', ['-z', String(px), String(px), logo, '--out', join(iconset, file)], { stdio: 'ignore' })
      }
    }
    const out = join(tmp, 'icon.icns')
    execFileSync('iconutil', ['-c', 'icns', iconset, '-o', out])
    copyFileSync(out, icns)
    writeFileSync(stamp, logoSig)
    changed = true
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}

if (changed) {
  // força o Launch Services/Dock a reler nome e ícone
  execFileSync('touch', [app])
  console.log(`[patch-electron-dev] Electron.app → ${NAME}`)
} else {
  console.log('[patch-electron-dev] já aplicado')
}
