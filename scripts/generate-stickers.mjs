// Gera o pacote padrão de figurinhas (SVG) organizado por categoria.
// Uso: node scripts/generate-stickers.mjs
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '../src/renderer/src/assets/stickers')

const INK = '#3d2a22'

const P = (d, fill, extra = '') => `<path d="${d}" fill="${fill}" ${extra}/>`
const PS = (d, fill, stroke, sw = 4, extra = '') =>
  `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" ${extra}/>`
const L = (d, stroke, sw = 5, extra = '') =>
  `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`
const C = (cx, cy, r, fill, extra = '') => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" ${extra}/>`
const E = (cx, cy, rx, ry, fill, extra = '') =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" ${extra}/>`
const R = (x, y, w, h, rx, fill, extra = '') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" ${extra}/>`

function star(cx, cy, r, fill, extra = '') {
  const pts = []
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const rr = i % 2 ? r * 0.45 : r
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(1)} ${(cy + Math.sin(a) * rr).toFixed(1)}`)
  }
  return `<polygon points="${pts.join(' ')}" fill="${fill}" ${extra}/>`
}

function heart(cx, cy, r, fill, extra = '') {
  return P(
    `M${cx} ${cy + r * 0.9} C${cx - r * 1.55} ${cy - r * 0.15} ${cx - r * 0.9} ${cy - r} ${cx} ${cy - r * 0.35} ` +
      `C${cx + r * 0.9} ${cy - r} ${cx + r * 1.55} ${cy - r * 0.15} ${cx} ${cy + r * 0.9} Z`,
    fill,
    extra
  )
}

function burst(cx, cy, r1, r2, n, fill, extra = '') {
  const pts = []
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n
    const rr = i % 2 ? r2 : r1
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(1)} ${(cy + Math.sin(a) * rr).toFixed(1)}`)
  }
  return `<polygon points="${pts.join(' ')}" fill="${fill}" ${extra}/>`
}

function sparkle(cx, cy, r, fill = '#fff7b2') {
  return P(`M${cx} ${cy - r} Q${cx + r * 0.2} ${cy - r * 0.2} ${cx + r} ${cy} ` +
    `Q${cx + r * 0.2} ${cy + r * 0.2} ${cx} ${cy + r} Q${cx - r * 0.2} ${cy + r * 0.2} ${cx - r} ${cy} ` +
    `Q${cx - r * 0.2} ${cy - r * 0.2} ${cx} ${cy - r} Z`, fill)
}

function drop(cx, cy, r, fill) {
  return P(`M${cx} ${cy - r * 1.6} Q${cx + r * 1.15} ${cy + r * 0.2} ${cx} ${cy + r} ` +
    `Q${cx - r * 1.15} ${cy + r * 0.2} ${cx} ${cy - r * 1.6} Z`, fill)
}

function wrap(bg, art) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg[0]}"/><stop offset="1" stop-color="${bg[1]}"/></linearGradient></defs>
<rect x="3" y="3" width="122" height="122" rx="30" fill="url(#bg)"/>
<rect x="3" y="3" width="122" height="122" rx="30" fill="none" stroke="#ffffff" stroke-opacity="0.45" stroke-width="3"/>
<ellipse cx="44" cy="28" rx="34" ry="19" fill="#ffffff" opacity="0.12"/>
${art}
</svg>
`
}

function eyes(kind, color = INK) {
  const lx = 47
  const rx = 81
  const y = 58
  switch (kind) {
    case 'happy':
      return L(`M${lx - 8} ${y + 2} q8 -9 16 0`, color, 5) + L(`M${rx - 8} ${y + 2} q8 -9 16 0`, color, 5)
    case 'wide':
      return C(lx, y, 8, '#fff', `stroke="${color}" stroke-width="2"`) + C(lx, y, 3.6, color) +
        C(rx, y, 8, '#fff', `stroke="${color}" stroke-width="2"`) + C(rx, y, 3.6, color)
    case 'closed':
      return L(`M${lx - 8} ${y} q8 7 16 0`, color, 5) + L(`M${rx - 8} ${y} q8 7 16 0`, color, 5)
    case 'sleepy':
      return L(`M${lx - 9} ${y} h18`, color, 5) + L(`M${rx - 9} ${y} h18`, color, 5)
    case 'wink':
      return L(`M${lx - 8} ${y + 2} q8 -9 16 0`, color, 5) + C(rx, y, 4.5, color)
    case 'sad':
      return L(`M${lx - 7} ${y - 2} q7 7 14 0`, color, 5) + L(`M${rx - 7} ${y - 2} q7 7 14 0`, color, 5)
    case 'hearts':
      return heart(lx, y, 8, '#ff3b6b') + heart(rx, y, 8, '#ff3b6b')
    case 'stars':
      return star(lx, y, 10, '#ffd23f') + star(rx, y, 10, '#ffd23f')
    case 'x':
      return L(`M${lx - 6} ${y - 6} l12 12 M${lx + 6} ${y - 6} l-12 12`, color, 4.5) +
        L(`M${rx - 6} ${y - 6} l12 12 M${rx + 6} ${y - 6} l-12 12`, color, 4.5)
    case 'up':
      return C(lx, y - 2, 4.6, color) + C(rx, y - 2, 4.6, color)
    case 'side':
      return C(lx - 2, y, 4.6, color) + C(rx - 2, y, 4.6, color)
    default:
      return C(lx, y, 5, color) + C(rx, y, 5, color) + C(lx + 2, y - 2, 1.6, '#fff') + C(rx + 2, y - 2, 1.6, '#fff')
  }
}

function mouth(kind, color = INK) {
  const y = 86
  switch (kind) {
    case 'smile':
      return L(`M50 ${y - 2} q14 13 28 0`, color, 5)
    case 'bigsmile':
      return P(`M45 ${y - 3} q19 25 38 0 z`, '#5b2a24') + E(64, y + 12, 9, 5, '#ff7a8a')
    case 'grin':
      return P(`M46 ${y - 3} q18 18 36 0 z`, '#5b2a24') + R(49, y - 1, 30, 7, 3, '#fff')
    case 'frown':
      return L(`M50 ${y + 7} q14 -13 28 0`, color, 5)
    case 'o':
      return E(64, y + 1, 8, 10, '#5b2a24')
    case 'flat':
      return L(`M53 ${y + 2} h22`, color, 5)
    case 'wavy':
      return L(`M49 ${y} q6 -6 12 0 t12 0 t12 0`, color, 4.5)
    case 'kiss':
      return E(64, y, 7, 8, '#e0245e') + L(`M60 ${y + 3} q4 3 8 0`, '#a80f3e', 2)
    case 'tongue':
      return P(`M50 ${y - 3} q14 17 28 0 z`, '#5b2a24') + E(64, y + 8, 7, 7, '#ff6b81')
    case 'teeth':
      return R(46, y - 3, 36, 14, 7, '#fff', `stroke="${color}" stroke-width="3"`) + L(`M64 ${y - 3} v14`, '#d8d2cc', 2)
    default:
      return L(`M52 ${y} h24`, color, 5)
  }
}

function face({ bg, skin = '#ffcf9e', eye = 'normal', mouth: m = 'smile', blush = false, extra = '' }) {
  return wrap(
    bg,
    `${C(64, 64, 42, skin, `stroke="#00000018" stroke-width="2"`)}
${blush ? E(33, 79, 9, 5, '#ff8fa3', 'opacity=".6"') + E(95, 79, 9, 5, '#ff8fa3', 'opacity=".6"') : ''}
${eyes(eye)}${mouth(m)}${extra}`
  )
}

// ---------- reações ----------
const R_BG = [
  ['#ffd8a8', '#ffb36b'],
  ['#ffe0e9', '#ff9db5'],
  ['#d8f0ff', '#8fd0ff'],
  ['#e4ffd8', '#9fe07a'],
  ['#eee0ff', '#b99cff'],
  ['#fff3c4', '#ffd15c'],
  ['#ffe0d1', '#ff9f7a'],
  ['#d8fff2', '#6fe0c0']
]

const tears = P('M44 64 q7 13 0 20 q-9 -7 0 -20 Z', '#4fc3f7') + P('M84 64 q7 13 0 20 q-9 -7 0 -20 Z', '#4fc3f7')
const zzz = L('M92 22 h13 l-13 13 h13', '#e8f4ff', 4) +
  L('M100 40 h10 l-10 10 h10', '#e8f4ff', 3.5) + L('M106 53 h8 l-8 8 h8', '#e8f4ff', 3)
const sweat = drop(104, 34, 7, '#9fe3ff')
const heartsAround = heart(28, 28, 7, '#ff5c8a') + heart(104, 96, 6, '#ff5c8a') + heart(101, 25, 5, '#ff9db5')
const sparkles = sparkle(25, 30, 8) + sparkle(104, 96, 7) + sparkle(104, 28, 5, '#fff')
const angerMark = L('M94 22 q8 -6 14 2 M100 32 l10 -8 M96 38 l8 -10', '#e53935', 4)
const exclaim = R(104, 22, 8, 22, 4, '#e53935') + C(108, 51, 4.5, '#e53935')
const question = L('M101 23 q8 -8 15 0 q0 6 -7 9 v5', '#e8f4ff', 5) + C(109, 47, 3.6, '#e8f4ff')
const confusion = question + L('M25 28 q6 -5 11 0 M28 36 h7', '#fff', 3.5)

function handBase(skin = '#ffcf9e') {
  return R(38, 62, 52, 40, 15, skin, `stroke="#00000015" stroke-width="2"`) +
    L('M52 76 h24 M52 86 h24', '#c98f63', 3)
}

const thumbsUp = R(38, 66, 52, 36, 14, '#ffcf9e', `stroke="#00000015" stroke-width="2"`) +
  R(48, 30, 17, 42, 8, '#ffcf9e', `stroke="#00000015" stroke-width="2"`) +
  L('M56 40 v22', '#d9a06e', 3) + L('M66 72 h16', '#c98f63', 3) +
  R(30, 92, 68, 18, 9, '#4f7cff')

const peaceHand = R(40, 60, 48, 42, 14, '#ffcf9e', `stroke="#00000015" stroke-width="2"`) +
  R(50, 20, 13, 56, 6.5, '#ffcf9e', `stroke="#00000015" stroke-width="2"`, 'transform="rotate(-12 56 48)"') +
  R(66, 20, 13, 56, 6.5, '#ffcf9e', `stroke="#00000015" stroke-width="2"`, 'transform="rotate(12 72 48)"') +
  L('M52 78 h22', '#c98f63', 3) + R(32, 92, 64, 18, 9, '#4f7cff')

const clapHands = R(18, 40, 30, 46, 14, '#ffcf9e', `stroke="#00000015" stroke-width="2"`, 'transform="rotate(-18 33 63)"') +
  R(80, 40, 30, 46, 14, '#ffcf9e', `stroke="#00000015" stroke-width="2"`, 'transform="rotate(18 95 63)"') +
  L('M30 52 l-8 -10 M27 62 h-12 M30 72 l-8 10', '#ffd15c', 4) +
  L('M98 52 l8 -10 M101 62 h12 M98 72 l8 10', '#ffd15c', 4) +
  sparkle(64, 34, 9) + sparkle(64, 96, 7)

const reacoes = [
  ['feliz', face({ bg: R_BG[0], eye: 'happy', mouth: 'smile', blush: true })],
  ['triste', face({ bg: R_BG[2], eye: 'sad', mouth: 'frown', extra: drop(47, 74, 6, '#9fe3ff') })],
  ['bravo', face({ bg: R_BG[6], skin: '#ffb08a', eye: 'x', mouth: 'frown', extra: angerMark })],
  ['apaixonado', face({ bg: R_BG[1], eye: 'hearts', mouth: 'smile', blush: true, extra: heartsAround })],
  ['rindo', face({ bg: R_BG[5], eye: 'happy', mouth: 'bigsmile', blush: true, extra: sparkles })],
  ['chorando', face({ bg: R_BG[2], eye: 'closed', mouth: 'frown', extra: tears })],
  ['sonolento', face({ bg: R_BG[4], eye: 'closed', mouth: 'o', extra: zzz })],
  ['surpreso', face({ bg: R_BG[3], eye: 'wide', mouth: 'o', extra: sparkles })],
  ['confuso', face({ bg: R_BG[4], eye: 'side', mouth: 'wavy', extra: confusion })],
  ['envergonhado', face({ bg: R_BG[1], eye: 'wink', mouth: 'smile', blush: true, extra: sparkle(30, 30, 6, '#fff') })],
  ['pensativo', face({ bg: R_BG[0], eye: 'up', mouth: 'flat', extra: question })],
  ['assustado', face({ bg: R_BG[4], eye: 'wide', mouth: 'o', extra: sweat })],
  ['entediado', face({ bg: R_BG[2], eye: 'sleepy', mouth: 'flat', extra: L('M96 30 q8 4 4 10', '#9fe3ff', 3) })],
  ['empolgado', face({ bg: R_BG[5], eye: 'stars', mouth: 'bigsmile', extra: sparkles })],
  ['doente', face({ bg: R_BG[3], skin: '#cde8a8', eye: 'x', mouth: 'wavy', extra: drop(104, 34, 6, '#a8e6a1') })],
  ['cansado', face({ bg: R_BG[2], eye: 'sleepy', mouth: 'o', extra: sweat + L('M92 90 q8 4 14 0', '#9fe3ff', 3) })],
  ['beijo', face({ bg: R_BG[1], eye: 'closed', mouth: 'kiss', blush: true, extra: heart(104, 30, 7, '#ff5c8a') })],
  ['careta', face({ bg: R_BG[3], eye: 'wink', mouth: 'tongue', extra: sparkle(28, 32, 6, '#fff') })],
  ['oculos', face({ bg: R_BG[0], eye: 'normal', mouth: 'smile', extra: C(47, 58, 11, 'none', 'stroke="#243b6b" stroke-width="4"') + C(81, 58, 11, 'none', 'stroke="#243b6b" stroke-width="4"') + L('M58 58 h12 M36 55 l-8 -4 M92 55 l8 -4', '#243b6b', 4) })],
  ['chocado', face({ bg: R_BG[6], eye: 'wide', mouth: 'o', extra: exclaim })],
  ['palmas', wrap(R_BG[5], clapHands)],
  ['paz', wrap(R_BG[3], peaceHand + sparkle(28, 30, 7) + sparkle(102, 92, 6))],
  ['duvida', face({ bg: R_BG[4], eye: 'side', mouth: 'flat', extra: question })],
  ['joinha', wrap(R_BG[3], thumbsUp + sparkle(104, 28, 7))],
  ['raiva', face({ bg: R_BG[6], skin: '#ffa07a', eye: 'x', mouth: 'teeth', extra: angerMark + L('M30 30 l-8 -8 M26 40 l-12 2', '#e53935', 4) })]
]

// ---------- animais ----------
function ears(kind, fur, inner = '#ffb3c1') {
  switch (kind) {
    case 'pointy':
      return PS('M30 48 L21 12 L55 31 Z', fur, '#00000018') + PS('M98 48 L107 12 L73 31 Z', fur, '#00000018') +
        P('M33 42 L27 20 L48 32 Z', inner) + P('M95 42 L101 20 L80 32 Z', inner)
    case 'round':
      return C(36, 35, 15, fur) + C(92, 35, 15, fur) + C(36, 35, 8, inner) + C(92, 35, 8, inner)
    case 'long':
      return E(44, 27, 10, 25, fur) + E(84, 27, 10, 25, fur) +
        E(44, 27, 5, 17, inner) + E(84, 27, 5, 17, inner)
    case 'floppy':
      return E(29, 52, 12, 23, fur, 'transform="rotate(14 29 52)"') +
        E(99, 52, 12, 23, fur, 'transform="rotate(-14 99 52)"')
    case 'tiny':
      return C(39, 38, 9, fur) + C(89, 38, 9, fur)
    case 'horns':
      return PS('M38 34 L32 12 L52 26 Z', '#e8d6a8', '#b8a06a') + PS('M90 34 L96 12 L76 26 Z', '#e8d6a8', '#b8a06a')
    default:
      return ''
  }
}

function animal(name, { bg, fur, inner, ear = 'round', muzzle, nose = '#3d2a22', eye = 'normal', extra = '', earColor }) {
  const art = `${ears(ear, earColor || fur, inner)}
${C(64, 68, 38, fur, `stroke="#00000015" stroke-width="2"`)}
${extra}
${muzzle ? E(64, 82, 20, 15, muzzle) : ''}
${eyes(eye)}
${P('M58 76 q6 6 12 0 z', nose)}
${L('M64 80 v5 M64 85 q-7 6 -12 1 M64 85 q7 6 12 1', '#5a3a2a', 2.6)}
${blush()}`
  return wrap(bg, art)
}

function blush() {
  return E(33, 82, 7, 4, '#ff8fa3', 'opacity=".45"') + E(95, 82, 7, 4, '#ff8fa3', 'opacity=".45"')
}

const A_BG = [
  ['#d8f0ff', '#8fd0ff'],
  ['#e4ffd8', '#9fe07a'],
  ['#fff0d1', '#ffc46b'],
  ['#ffe0e9', '#ff9db5'],
  ['#eee0ff', '#b99cff'],
  ['#d8fff2', '#6fe0c0']
]

const animais = [
  ['gato', animal('gato', { bg: A_BG[0], fur: '#e89a4c', inner: '#ffd7a8', ear: 'pointy', muzzle: '#ffe6c7' })],
  ['cachorro', animal('cachorro', { bg: A_BG[2], fur: '#c98a52', inner: '#f2d3b3', ear: 'floppy', muzzle: '#f2d3b3' })],
  ['urso', animal('urso', { bg: A_BG[2], fur: '#9a6a43', inner: '#d9b28a', ear: 'round', muzzle: '#d9b28a' })],
  ['raposa', animal('raposa', { bg: A_BG[2], fur: '#ef7d3a', inner: '#ffd7c2', ear: 'pointy', muzzle: '#fff3e6', extra: P('M30 64 q14 12 20 26 q-18 -2 -20 -26 Z', '#fff3e6') + P('M98 64 q-14 12 -20 26 q18 -2 20 -26 Z', '#fff3e6') })],
  ['coelho', animal('coelho', { bg: A_BG[3], fur: '#f2f2f2', inner: '#ffb3c1', ear: 'long', muzzle: '#ffffff' })],
  ['panda', animal('panda', { bg: A_BG[5], fur: '#f7f7f7', ear: 'round', earColor: '#2c2c2c', inner: '#2c2c2c', muzzle: '#ffffff', extra: E(47, 58, 12, 14, '#2c2c2c', 'transform="rotate(-18 47 58)"') + E(81, 58, 12, 14, '#2c2c2c', 'transform="rotate(18 81 58)"') })],
  ['porco', animal('porco', { bg: A_BG[3], fur: '#ffb6c8', inner: '#ff8fab', ear: 'pointy', muzzle: '#ff8fab', nose: '#e05a83' })],
  ['vaca', animal('vaca', { bg: A_BG[1], fur: '#f7f7f7', inner: '#ffb3c1', ear: 'round', muzzle: '#ffd7e0', nose: '#e08a9a', extra: P('M36 48 q10 -10 18 -2 q-8 12 -18 2 Z', '#3c3c3c') + P('M78 92 q12 4 16 -6 q-14 -6 -16 6 Z', '#3c3c3c') })],
  ['leao', animal('leao', { bg: A_BG[2], fur: '#e0a33e', inner: '#f7c46a', ear: 'tiny', muzzle: '#f7d9a8', extra: burst(64, 66, 54, 44, 12, '#c47a26', 'opacity=".9"') })],
  ['macaco', animal('macaco', { bg: A_BG[1], fur: '#9a6a43', inner: '#e0b48a', ear: 'round', muzzle: '#e8c4a0', extra: E(64, 66, 27, 26, '#e8c4a0') })],
  ['coala', animal('coala', { bg: A_BG[4], fur: '#b9c0c8', inner: '#e8edf2', ear: 'round', muzzle: '#e8edf2', nose: '#3c3c3c' })],
  ['coruja', animal('coruja', { bg: A_BG[4], fur: '#b98a5a', inner: '#f0d6b8', ear: 'pointy', muzzle: '#f0d6b8', extra: C(47, 58, 14, '#fff') + C(81, 58, 14, '#fff') + C(47, 58, 6, '#3d2a22') + C(81, 58, 6, '#3d2a22') + P('M58 74 L64 86 L70 74 Z', '#ffb347') })],
  ['rato', animal('rato', { bg: A_BG[4], fur: '#b9b9b9', inner: '#ffb3c1', ear: 'round', muzzle: '#e8e8e8', nose: '#ff8fab', extra: L('M22 74 h14 M22 82 h14 M92 74 h14 M92 82 h14', '#8a8a8a', 2) })],
  ['tigre', animal('tigre', { bg: A_BG[2], fur: '#f0a03c', inner: '#ffd7a8', ear: 'round', muzzle: '#fff3e6', extra: L('M38 44 l8 10 M52 40 l4 12 M90 44 l-8 10 M76 40 l-4 12 M32 74 l10 4 M96 74 l-10 4', '#3c2a1a', 4) })],
  ['lobo', animal('lobo', { bg: A_BG[0], fur: '#8f9bab', inner: '#d7e0ea', ear: 'pointy', muzzle: '#d7e0ea', eye: 'normal' })],
  ['ovelha', animal('ovelha', { bg: A_BG[5], fur: '#f2f2f2', inner: '#ffd7e0', ear: 'floppy', muzzle: '#ffe8ee', extra: C(36, 40, 13, '#f7f7f7') + C(52, 33, 13, '#f7f7f7') + C(76, 33, 13, '#f7f7f7') + C(92, 40, 13, '#f7f7f7') })],
  ['galinha', animal('galinha', { bg: A_BG[2], fur: '#fff7e6', inner: '#ffb3c1', ear: 'none', muzzle: '#ffd15c', nose: '#ffb347', extra: P('M52 30 q4 -16 12 -6 q4 -14 10 0 q8 -10 8 8 Z', '#e53935') })],
  ['sapo', wrap(A_BG[1], E(64, 70, 40, 34, '#7cc95c') + C(45, 44, 14, '#7cc95c') + C(83, 44, 14, '#7cc95c') + C(45, 44, 9, '#fff') + C(83, 44, 9, '#fff') + C(45, 44, 4, INK) + C(83, 44, 4, INK) + L('M50 84 q14 10 28 0', '#3d6b2a', 4) + E(33, 78, 7, 4, '#ff8fa3', 'opacity=".5"') + E(95, 78, 7, 4, '#ff8fa3', 'opacity=".5"'))],
  ['pinguim', wrap(A_BG[0], E(64, 68, 36, 42, '#2f3a4a') + E(64, 74, 24, 32, '#ffffff') + C(48, 52, 5, INK) + C(80, 52, 5, INK) + P('M56 64 L64 74 L72 64 Z', '#ffb347') + E(52, 116, 12, 7, '#ffb347') + E(76, 116, 12, 7, '#ffb347'))],
  ['peixe', wrap(A_BG[0], E(58, 66, 34, 24, '#4fb7e8') + P('M92 66 L114 48 L110 66 L114 84 Z', '#3d9fce') + P('M54 44 Q64 30 74 44 Z', '#3d9fce') + C(42, 60, 5, '#fff') + C(42, 60, 2.6, INK) + L('M72 56 q8 10 0 20', '#2f8bb5', 3) + E(30, 84, 6, 10, '#7fd6f7'))],
  ['baleia', wrap(A_BG[0], P('M18 78 Q22 42 60 42 Q100 42 106 72 Q108 86 94 84 L30 92 Q16 92 18 78 Z', '#4f9fe0') + P('M22 84 Q42 96 72 90 Q98 88 104 74 Q98 92 76 98 Q44 104 22 84 Z', '#3d86c4') + C(42, 60, 5, '#fff') + C(42, 60, 2.6, INK) + L('M84 84 q10 6 18 2', '#2f6ea8', 3) + L('M54 38 q-4 -12 6 -16 M66 38 q4 -14 -4 -20', '#9fe3ff', 4))],
  ['tartaruga', wrap(A_BG[1], E(64, 72, 40, 32, '#7cc95c') + P('M26 72 Q32 34 64 30 Q96 34 102 72 Z', '#6fae3f') + L('M40 60 l-4 14 M52 52 l-4 22 M64 48 v26 M76 52 l4 22 M88 60 l4 14', '#4f8a2a', 3) + C(46, 94, 8, '#7cc95c') + C(82, 94, 8, '#7cc95c') + C(64, 104, 10, '#7cc95c') + C(64, 104, 5, INK))],
  ['abelha', wrap(A_BG[2], E(64, 68, 30, 24, '#ffd15c') + L('M44 60 v18 M56 54 v30 M68 54 v30 M80 60 v18', '#3c2a1a', 5) + E(46, 38, 16, 11, '#cfe9ff', 'opacity=".85"') + E(82, 38, 16, 11, '#cfe9ff', 'opacity=".85"') + C(48, 64, 4, INK) + C(80, 64, 4, INK) + L('M34 64 q-10 6 -6 14 M94 64 q10 6 6 14', '#3c2a1a', 3))],
  ['borboleta', wrap(A_BG[3], E(44, 52, 22, 26, '#ff9db5', 'transform="rotate(-18 44 52)"') + E(84, 52, 22, 26, '#b99cff', 'transform="rotate(18 84 52)"') + E(44, 86, 17, 19, '#ffc2d1', 'transform="rotate(16 44 86)"') + E(84, 86, 17, 19, '#d4c4ff', 'transform="rotate(-16 84 86)"') + E(64, 68, 5, 30, '#3c2a1a') + L('M64 40 q-8 -10 -14 -12 M64 40 q8 -10 14 -12', '#3c2a1a', 3))],
  ['unicornio', animal('unicornio', { bg: A_BG[4], fur: '#fff2f7', inner: '#ffb3c1', ear: 'pointy', muzzle: '#ffe0ea', extra: P('M56 34 L64 4 L72 34 Z', '#ffd23f') + L('M60 30 l8 -6 M58 24 l8 -6', '#e0a800', 2) + P('M30 40 q-8 18 2 28 q8 -14 6 -30 Z', '#b99cff') + P('M36 36 q-6 20 4 32 q8 -16 4 -34 Z', '#ff9db5') + P('M42 34 q-4 18 4 28 q6 -14 2 -30 Z', '#9fe3ff') })]
]

// categorias registradas no fim do arquivo


const C_BG = [
  ['#fff3c4', '#ffd15c'],
  ['#ffe0d1', '#ff9f7a'],
  ['#ffe8d6', '#f0b27a'],
  ['#ffe0e9', '#ff9db5'],
  ['#e4ffd8', '#9fe07a'],
  ['#fff7e6', '#ffd7a8']
]

const comida = [
  ['cafe', wrap(C_BG[2], E(64, 102, 34, 8, '#00000022') + P('M30 52 h58 v24 q0 16 -16 16 h-26 q-16 0 -16 -16 Z', '#ffffff') + P('M88 58 q17 0 17 14 t-17 14', 'none', 'stroke="#ffffff" stroke-width="8"') + E(59, 74, 18, 8, '#b5713d') + L('M48 38 q-5 -10 3 -16 M64 38 q5 -10 -3 -16 M80 38 q-5 -10 3 -16', '#ffffff', 3, 'opacity=".75"'))],
  ['pizza', wrap(C_BG[0], PS('M64 10 L112 106 Q64 122 16 106 Z', '#ffd166', '#a97400') + P('M64 16 L106 100 Q64 112 22 100 Z', '#ffcf40') + P('M18 106 Q64 122 110 106 L110 116 Q64 130 18 116 Z', '#d18a3a') + C(52, 62, 9, '#e0245e') + C(78, 82, 8, '#e0245e') + C(66, 44, 6, '#e0245e') + C(46, 90, 6, '#e0245e') + P('M70 66 q6 4 2 10 q-6 -2 -2 -10 Z', '#3fbf6f') + P('M56 78 q6 4 2 10 q-6 -2 -2 -10 Z', '#3fbf6f'))],
  ['hamburguer', wrap(C_BG[1], E(64, 40, 40, 20, '#e8a34b') + C(50, 32, 3, '#fff3c4') + C(64, 28, 3, '#fff3c4') + C(78, 32, 3, '#fff3c4') + R(26, 48, 76, 12, 6, '#7cc95c') + R(24, 58, 80, 14, 7, '#8a4b2a') + R(28, 70, 72, 10, 5, '#ffd15c') + E(64, 84, 40, 16, '#e8a34b'))],
  ['bolo', wrap(C_BG[3], R(30, 62, 68, 34, 8, '#ffb6c8') + P('M30 62 q17 14 34 0 t34 0 v10 h-68 Z', '#fff0f5') + R(30, 82, 68, 14, 7, '#ff8fab') + R(60, 30, 8, 24, 4, '#9fe3ff') + P('M64 18 q6 8 0 12 q-6 -4 0 -12 Z', '#ffd23f') + C(38, 100, 4, '#fff') + C(52, 102, 3, '#fff') + C(76, 101, 4, '#fff') + C(90, 99, 3, '#fff'))],
  ['donut', wrap(C_BG[3], C(64, 68, 25, 'none', 'stroke="#c98a52" stroke-width="22"') + C(64, 68, 25, 'none', 'stroke="#ff9db5" stroke-width="13" stroke-dasharray="18 7"') + L('M40 50 l6 4 M84 48 l-5 5 M50 84 l5 -5 M80 86 l-6 -4', '#fff', 4))],
  ['taco', wrap(C_BG[4], P('M18 78 Q22 34 64 34 Q106 34 110 78 Q64 96 18 78 Z', '#f0c36b') + P('M26 68 q38 -14 76 0 q-8 12 -38 12 q-30 0 -38 -12 Z', '#7cc95c') + C(46, 64, 5, '#e0245e') + C(64, 60, 5, '#e0245e') + C(82, 64, 5, '#e0245e') + L('M34 76 q30 10 60 0', '#e8a34b', 5))],
  ['sushi', wrap(C_BG[1], E(64, 72, 36, 24, '#f7f2e6', 'stroke="#e0d6c2" stroke-width="2"') + P('M28 68 Q64 40 100 68 Q64 78 28 68 Z', '#ff8a6b') + R(52, 48, 24, 44, 8, '#2f3a2a') + L('M40 62 q24 8 48 0', '#ffd7c2', 3))],
  ['sorvete', wrap(C_BG[2], P('M44 68 L64 116 L84 68 Z', '#e8a34b') + L('M50 78 l26 14 M58 90 l18 10', '#c47a26', 3) + C(64, 44, 20, '#ff9db5') + C(47, 58, 16, '#9fe3ff') + C(81, 58, 16, '#ffd15c') + C(64, 30, 14, '#b99cff') + C(64, 18, 4, '#e0245e'))],
  ['biscoito', wrap(C_BG[2], C(64, 66, 38, '#d9a066', 'stroke="#a97400" stroke-width="3"') + C(48, 54, 5, '#5a3a1a') + C(74, 50, 5, '#5a3a1a') + C(60, 76, 5, '#5a3a1a') + C(84, 74, 4, '#5a3a1a') + C(38, 74, 4, '#5a3a1a') + C(72, 90, 4, '#5a3a1a'))],
  ['maca', wrap(C_BG[4], P('M64 44 q-20 -16 -34 2 q-14 22 6 42 q12 12 28 0 q16 12 28 0 q20 -20 6 -42 q-14 -18 -34 -2 Z', '#e53935') + L('M64 44 v-14', '#6b4a2a', 5) + P('M64 32 q14 -14 24 -8 q-4 14 -24 8 Z', '#4fae4f') + E(44, 60, 6, 10, '#ff8a8a', 'opacity=".5"'))],
  ['banana', wrap(C_BG[0], P('M28 38 Q30 92 86 96 Q110 98 106 82 Q58 74 48 34 Q44 22 28 38 Z', '#ffd23f', 'stroke="#d9a800" stroke-width="3"') + P('M32 44 Q52 84 100 88 Q70 92 44 72 Q34 56 32 44 Z', '#ffe98a', 'opacity=".7"') + L('M28 38 l-6 -10 M106 82 l10 -8', '#6b4a2a', 5))],
  ['uva', wrap(C_BG[3], C(64, 82, 30, 'none', 'stroke="#b99cff" stroke-width="4"') + C(52, 58, 10, '#b99cff') + C(76, 58, 10, '#b99cff') + C(44, 74, 10, '#9b7bef') + C(64, 72, 10, '#9b7bef') + C(84, 74, 10, '#9b7bef') + C(54, 90, 10, '#8a63e8') + C(74, 90, 10, '#8a63e8') + L('M64 48 v-14', '#6b4a2a', 4) + P('M64 38 q16 -14 24 -6 q-8 12 -24 6 Z', '#4fae4f'))],
  ['melancia', wrap(C_BG[4], P('M12 92 Q14 28 64 28 Q114 28 116 92 Z', '#4fae4f') + P('M22 88 Q24 38 64 38 Q104 38 106 88 Z', '#f7f2e6') + P('M30 84 Q32 48 64 48 Q96 48 98 84 Z', '#ff6b81') + E(52, 64, 3, 6, '#3c2a1a') + E(76, 64, 3, 6, '#3c2a1a') + E(64, 76, 3, 6, '#3c2a1a'))],
  ['morango', wrap(C_BG[3], P('M64 112 Q24 84 26 54 Q28 34 46 38 Q56 40 64 30 Q72 40 82 38 Q100 34 102 54 Q104 84 64 112 Z', '#e53935') + P('M64 30 q-12 -12 -22 -8 q4 12 22 8 q12 12 22 8 q-4 -12 -22 -8 Z', '#4fae4f') + E(48, 60, 3, 5, '#ffe98a') + E(80, 60, 3, 5, '#ffe98a') + E(60, 78, 3, 5, '#ffe98a') + E(72, 88, 3, 5, '#ffe98a') + E(44, 84, 3, 5, '#ffe98a'))],
  ['pipoca', wrap(C_BG[0], P('M36 60 L92 60 L82 116 L46 116 Z', '#e53935') + R(40, 66, 44, 8, 4, '#fff', 'opacity=".85"') + C(44, 52, 13, '#fff7e6') + C(64, 46, 15, '#fff7e6') + C(84, 52, 13, '#fff7e6') + C(54, 38, 10, '#fff7e6') + C(76, 38, 10, '#fff7e6') + L('M52 74 l-4 34 M64 74 v34 M76 74 l4 34', '#b71c1c', 2, 'opacity=".6"'))],
  ['hotdog', wrap(C_BG[1], E(64, 70, 42, 20, '#e8a34b') + E(64, 58, 38, 15, '#c47a26') + E(64, 52, 40, 12, '#ff8a6b') + L('M34 52 q10 10 20 0 t20 0 t20 0', '#ffd23f', 4) + L('M40 66 q22 8 48 0', '#7cc95c', 4))],
  ['batata_frita', wrap(C_BG[5], P('M38 58 L90 58 L82 116 L46 116 Z', '#e53935') + R(42, 64, 44, 9, 4, '#fff', 'opacity=".85"') + R(46, 12, 10, 52, 4, '#ffd23f', 'transform="rotate(-8 51 38)"') + R(60, 8, 10, 56, 4, '#ffd23f') + R(74, 12, 10, 52, 4, '#ffd23f', 'transform="rotate(8 79 38)"') + R(34, 26, 10, 38, 4, '#f0b22a', 'transform="rotate(-18 39 45)"') + R(86, 26, 10, 38, 4, '#f0b22a', 'transform="rotate(18 91 45)"'))],
  ['cerveja', wrap(C_BG[0], R(34, 40, 50, 62, 8, '#f0b22a') + R(84, 52, 16, 34, 8, 'none', 'stroke="#f0b22a" stroke-width="9"') + E(59, 42, 25, 12, '#fff7e6') + C(48, 32, 9, '#fff7e6') + C(66, 30, 11, '#fff7e6') + C(76, 36, 7, '#fff7e6') + L('M46 58 v34 M60 58 v34 M72 58 v34', '#d99a1a', 2, 'opacity=".6"') + C(50, 74, 3, '#fff', 'opacity=".7"') + C(66, 88, 2.5, '#fff', 'opacity=".7"'))],
  ['leite', wrap(C_BG[0], P('M42 34 L86 34 L92 52 L92 112 L36 112 L36 52 Z', '#ffffff') + P('M42 34 L64 14 L86 34 Z', '#d8e8f7') + R(36, 66, 56, 22, 3, '#4f9fe0') + C(64, 77, 8, '#fff') + L('M42 34 L64 54 L86 34', '#cfe0f0', 3))],
  ['queijo', wrap(C_BG[0], P('M14 88 L68 34 Q72 30 78 34 L110 66 Q114 70 110 76 L92 88 Z', '#ffd15c', 'stroke="#d9a800" stroke-width="3"') + E(48, 74, 8, 6, '#d9a800') + E(74, 60, 6, 5, '#d9a800') + E(84, 80, 5, 4, '#d9a800') + E(60, 86, 4, 3, '#d9a800'))],
  ['ovo', wrap(C_BG[2], P('M24 70 Q24 40 52 36 Q74 34 86 50 Q104 52 104 74 Q104 98 74 100 Q46 102 34 90 Q24 84 24 70 Z', '#fffaf0', 'stroke="#e0d6c2" stroke-width="3"') + C(64, 70, 20, '#ffd23f') + E(58, 64, 6, 4, '#fff3a0', 'opacity=".8"'))],
  ['pao', wrap(C_BG[2], P('M20 76 Q20 44 52 38 Q64 22 78 38 Q108 42 108 76 Q108 98 84 98 L44 98 Q20 98 20 76 Z', '#e8a34b', 'stroke="#b5713d" stroke-width="3"') + L('M42 46 q6 10 0 20 M64 40 q6 10 0 20 M86 46 q6 10 0 20', '#b5713d', 4))],
  ['abacate', wrap(C_BG[4], P('M64 108 Q28 92 28 58 Q28 26 64 24 Q100 26 100 58 Q100 92 64 108 Z', '#6fae3f') + P('M64 100 Q36 86 36 60 Q36 36 64 34 Q92 36 92 60 Q92 86 64 100 Z', '#cde8a8') + C(64, 74, 15, '#8a5a2a') + C(59, 69, 4, '#b98550', 'opacity=".8"'))],
  ['cereja', wrap(C_BG[3], L('M52 62 Q58 30 78 24 M52 62 Q44 30 30 26', '#4fae4f', 5) + C(48, 80, 20, '#e0245e') + C(80, 84, 19, '#c81e4a') + E(42, 74, 5, 8, '#ff8a9a', 'opacity=".7"') + P('M78 24 q18 -10 24 2 q-14 8 -24 -2 Z', '#4fae4f') + P('M30 26 q-14 -12 -20 -2 q10 10 20 2 Z', '#4fae4f'))],
  ['pirulito', wrap(C_BG[3], C(64, 48, 30, '#ff9db5', 'stroke="#e05a83" stroke-width="4"') + L('M64 48 m-2 0 a2 2 0 1 1 4 0 a8 8 0 1 1 -16 0 a14 14 0 1 1 28 0 a20 20 0 1 1 -40 0', '#fff', 4) + R(60, 78, 8, 42, 4, '#fff7e6', 'stroke="#d9c8a8" stroke-width="2"'))]
]

const N_BG = [
  ['#d8f0ff', '#8fd0ff'],
  ['#e4ffd8', '#9fe07a'],
  ['#fff3c4', '#ffd15c'],
  ['#d8fff2', '#6fe0c0'],
  ['#e0e8ff', '#9fb4ff'],
  ['#ffe0d1', '#ff9f7a']
]

const natureza = [
  ['fogo', wrap(N_BG[5], P('M64 112 Q28 100 28 70 Q28 48 46 32 Q48 56 60 60 Q56 34 72 12 Q100 40 100 72 Q100 102 64 112 Z', '#ff7a18') + P('M64 106 Q40 96 40 74 Q40 58 52 46 Q54 66 64 70 Q64 50 72 36 Q90 54 90 76 Q90 98 64 106 Z', '#ffd23f') + P('M64 100 Q52 94 52 80 Q52 70 62 62 Q70 72 70 82 Q70 94 64 100 Z', '#fff3c4'))],
  ['sol', wrap(N_BG[0], C(64, 64, 26, '#ffd23f', 'stroke="#e0a800" stroke-width="3"') + L('M64 12 v14 M64 102 v14 M12 64 h14 M102 64 h14 M27 27 l10 10 M91 91 l10 10 M101 27 l-10 10 M37 91 l-10 10', '#ffb347', 6) + E(56, 58, 5, 7, '#3d2a22') + E(72, 58, 5, 7, '#3d2a22') + L('M54 76 q10 8 20 0', '#a97400', 4))],
  ['lua', wrap(N_BG[4], P('M82 18 Q44 22 40 60 Q36 98 76 110 Q54 92 54 64 Q54 36 82 18 Z', '#fff3c4', 'stroke="#e0c86a" stroke-width="3"') + star(96, 32, 6, '#fff7b2') + star(104, 58, 4, '#fff7b2') + star(88, 84, 5, '#fff7b2'))],
  ['estrela', wrap(N_BG[4], star(64, 64, 46, '#ffd23f', 'stroke="#e0a800" stroke-width="3"') + star(64, 64, 26, '#fff3a0') + E(54, 58, 4, 6, '#3d2a22') + E(72, 58, 4, 6, '#3d2a22') + L('M56 74 q8 6 16 0', '#a97400', 3))],
  ['nuvem', wrap(N_BG[0], P('M28 84 Q14 84 14 70 Q14 56 30 54 Q32 34 52 32 Q70 30 78 46 Q96 44 104 58 Q116 60 116 74 Q116 86 102 86 Z', '#ffffff', 'stroke="#b9d8ee" stroke-width="3"') + L('M40 64 q6 -6 12 0 M62 54 q8 -6 16 0', '#cfe6f5', 3))],
  ['chuva', wrap(N_BG[0], P('M30 72 Q16 72 16 58 Q16 44 32 42 Q34 24 52 22 Q70 20 78 36 Q96 34 104 48 Q114 50 114 62 Q114 74 100 74 Z', '#ffffff', 'stroke="#b9d8ee" stroke-width="3"') + drop(40, 90, 6, '#4fb7e8') + drop(60, 96, 6, '#4fb7e8') + drop(80, 90, 6, '#4fb7e8') + drop(100, 96, 6, '#4fb7e8'))],
  ['floco_neve', wrap(N_BG[0], L('M64 16 v92 M24 40 l80 48 M104 40 L24 88', '#9fe3ff', 6) + L('M64 32 l-10 -10 M64 32 l10 -10 M64 94 l-10 10 M64 94 l10 10 M38 48 l-14 2 M38 48 l-2 -14 M90 48 l14 2 M90 48 l2 -14 M38 80 l-14 -2 M38 80 l-2 14 M90 80 l14 -2 M90 80 l2 14', '#cfefff', 4))],
  ['arco_iris', wrap(N_BG[0], L('M18 98 Q18 34 64 34 Q110 34 110 98', '#e53935', 8) + L('M28 98 Q28 44 64 44 Q100 44 100 98', '#ff9800', 8) + L('M38 98 Q38 54 64 54 Q90 54 90 98', '#ffd23f', 8) + L('M48 98 Q48 64 64 64 Q80 64 80 98', '#4fae4f', 8) + L('M58 98 Q58 74 64 74 Q70 74 70 98', '#4f9fe0', 8))],
  ['arvore', wrap(N_BG[1], R(56, 74, 16, 36, 4, '#8a5a2a') + C(64, 50, 32, '#4fae4f') + C(42, 66, 20, '#3f9a3f') + C(86, 66, 20, '#3f9a3f') + C(64, 70, 20, '#5fbf5f') + C(52, 44, 8, '#7cc95c') + C(76, 48, 7, '#7cc95c'))],
  ['flor', wrap(N_BG[3], E(64, 40, 14, 22, '#ff9db5') + E(40, 58, 14, 22, '#ff9db5', 'transform="rotate(70 40 58)"') + E(88, 58, 14, 22, '#ff9db5', 'transform="rotate(-70 88 58)"') + E(52, 80, 14, 22, '#ffb6c8', 'transform="rotate(35 52 80)"') + E(76, 80, 14, 22, '#ffb6c8', 'transform="rotate(-35 76 80)"') + C(64, 62, 15, '#ffd23f') + C(60, 58, 4, '#e0a800') + R(60, 82, 8, 30, 4, '#4fae4f'))],
  ['folha', wrap(N_BG[1], P('M24 104 Q24 40 76 24 Q108 16 104 46 Q98 88 48 104 Q34 108 24 104 Z', '#6fae3f', 'stroke="#3f7a2a" stroke-width="3"') + L('M30 100 Q58 74 96 32', '#3f7a2a', 4) + L('M52 76 l-2 18 M68 62 l-2 20 M82 50 l-2 18 M44 88 l-14 2 M66 70 l18 -2 M82 56 l16 -2', '#4fae4f', 3))],
  ['montanha', wrap(N_BG[4], P('M8 104 L46 36 L68 72 L82 52 L120 104 Z', '#6b7c93') + P('M46 36 L60 62 L52 60 L46 68 L38 58 Z', '#ffffff') + P('M82 52 L94 72 L86 70 L80 76 L74 68 Z', '#ffffff') + C(96, 26, 10, '#ffd23f'))],
  ['onda', wrap(N_BG[0], P('M10 76 Q28 44 52 60 Q62 68 56 80 Q50 92 64 94 Q90 98 118 70 L118 112 L10 112 Z', '#4fb7e8') + P('M10 92 Q40 76 64 88 Q92 102 118 86 L118 112 L10 112 Z', '#2f8bb5') + P('M64 66 q8 -8 16 0 q-8 12 -16 0 Z', '#cfefff'))],
  ['raio', wrap(N_BG[4], P('M70 8 L34 68 L58 68 L48 120 L94 52 L68 52 Z', '#ffd23f', 'stroke="#e0a800" stroke-width="3"') + P('M66 24 L48 58 L62 58 L56 102 L80 60 L64 60 Z', '#fff3c4', 'opacity=".7"'))],
  ['tornado', wrap(N_BG[4], P('M24 20 L104 20 L96 36 L36 36 Z', '#9fb4ff') + P('M38 42 L94 42 L88 56 L44 56 Z', '#8aa0f0') + P('M48 62 L86 62 L80 76 L54 76 Z', '#7a90e0') + P('M56 82 L80 82 L74 98 L62 98 Z', '#6a80d0') + L('M60 98 q-6 10 4 14', '#6a80d0', 6))],
  ['cacto', wrap(N_BG[2], P('M50 108 L50 44 Q50 28 64 28 Q78 28 78 44 L78 108 Z', '#4fae4f') + P('M50 68 q-18 0 -18 -18 v-8', 'none', 'stroke="#4fae4f" stroke-width="14"') + P('M78 58 q18 0 18 -18 v-10', 'none', 'stroke="#4fae4f" stroke-width="14"') + L('M58 44 v8 M70 44 v8 M58 62 v8 M70 62 v8', '#3f8a3f', 2) + P('M34 108 L94 108 L88 120 L40 120 Z', '#e8a34b'))],
  ['cogumelo', wrap(N_BG[2], P('M18 62 Q18 22 64 22 Q110 22 110 62 Q64 74 18 62 Z', '#e53935') + C(42, 42, 8, '#fff7e6') + C(72, 34, 6, '#fff7e6') + C(90, 50, 7, '#fff7e6') + C(60, 54, 5, '#fff7e6') + R(52, 62, 24, 46, 10, '#fff7e6') + E(46, 84, 7, 4, '#ff8fa3', 'opacity=".5"') + E(82, 84, 7, 4, '#ff8fa3', 'opacity=".5"'))],
  ['planeta', wrap(N_BG[4], C(64, 62, 34, '#9fb4ff') + C(52, 50, 8, '#7a90e0') + C(76, 78, 10, '#7a90e0') + C(82, 46, 5, '#c4d0ff') + L('M20 76 Q64 96 108 52', '#ffd23f', 7) + star(24, 28, 5, '#fff7b2') + star(104, 24, 4, '#fff7b2'))],
  ['cometa', wrap(N_BG[4], C(84, 48, 22, '#ffd23f', 'stroke="#e0a800" stroke-width="3"') + L('M62 62 L16 104 M60 54 L12 78 M68 72 L34 116', '#fff3a0', 8) + C(78, 42, 6, '#fff7b2', 'opacity=".8"') + star(30, 28, 5, '#fff7b2'))],
  ['vulcao', wrap(N_BG[5], P('M12 112 L46 54 L82 54 L116 112 Z', '#6b5b4a') + P('M46 54 L64 42 L82 54 Z', '#8a7a68') + P('M54 54 L60 82 Q64 96 58 112 L48 112 Z', '#ff7a18') + P('M74 54 L70 78 Q66 94 74 112 L84 112 Z', '#e53935') + L('M58 30 q-8 -14 2 -20 M70 28 q8 -14 0 -20', '#8a8a8a', 5, 'opacity=".6"'))],
  ['ilha', wrap(N_BG[0], E(64, 100, 44, 12, '#f0c36b') + E(64, 108, 50, 8, '#4fb7e8') + L('M64 98 Q60 66 58 48', '#8a5a2a', 7) + P('M58 50 Q30 36 24 52 Q44 62 58 54 Z', '#4fae4f') + P('M58 50 Q86 30 96 46 Q78 60 58 56 Z', '#3f9a3f') + C(66, 46, 5, '#8a5a2a'))],
  ['boneco_neve', wrap(N_BG[0], C(64, 88, 26, '#ffffff', 'stroke="#cfe0f0" stroke-width="3"') + C(64, 52, 20, '#ffffff', 'stroke="#cfe0f0" stroke-width="3"') + C(64, 24, 15, '#ffffff', 'stroke="#cfe0f0" stroke-width="3"') + C(59, 20, 2.5, INK) + C(69, 20, 2.5, INK) + P('M64 24 L72 27 L64 30 Z', '#ff9800') + R(54, 8, 20, 6, 3, '#3c2a1a') + R(52, 30, 24, 6, 3, '#e53935') + C(64, 54, 2.5, INK) + C(64, 64, 2.5, INK) + C(64, 78, 2.5, INK))],
  ['vento', wrap(N_BG[3], L('M12 44 h48 q12 0 12 -10 t-12 -10 t-10 8', '#9fe3ff', 6) + L('M12 66 h66 q14 0 14 12 t-14 12 t-12 -8', '#6fb8d8', 6) + L('M12 88 h34 q10 0 10 8', '#cfefff', 5))],
  ['nascer_sol', wrap(N_BG[5], P('M8 88 Q64 54 120 88 L120 116 L8 116 Z', '#6fe0c0') + C(64, 70, 28, '#ffd23f') + L('M64 16 v14 M28 28 l8 10 M100 28 l-8 10 M14 58 h14 M100 58 h14', '#ffb347', 5) + L('M20 88 h88', '#4fb7e8', 5, 'opacity=".6"'))],
  ['oceano', wrap(N_BG[0], P('M8 64 Q28 46 48 64 T88 64 T128 64 L128 116 L8 116 Z', '#4fb7e8') + P('M8 80 Q28 62 48 80 T88 80 T128 80 L128 116 L8 116 Z', '#2f8bb5') + P('M8 96 Q28 78 48 96 T88 96 T128 96 L128 116 L8 116 Z', '#1f6f99') + C(96, 34, 14, '#ffd23f'))]
]

const O_BG = [
  ['#d8f0ff', '#8fd0ff'],
  ['#eee0ff', '#b99cff'],
  ['#fff3c4', '#ffd15c'],
  ['#ffe0e9', '#ff9db5'],
  ['#d8fff2', '#6fe0c0'],
  ['#e0e8ff', '#9fb4ff']
]

const objetos = [
  ['foguete', wrap(O_BG[5], P('M64 8 Q84 34 84 70 L44 70 Q44 34 64 8 Z', '#f2f2f2', 'stroke="#c9d0d8" stroke-width="3"') + C(64, 44, 11, '#9fe3ff', 'stroke="#6fb8d8" stroke-width="3"') + C(64, 44, 4, '#4f9fe0') + P('M44 70 L28 96 L46 88 Z', '#e53935') + P('M84 70 L100 96 L82 88 Z', '#e53935') + P('M54 70 L64 98 L74 70 Z', '#ff9800') + P('M60 70 L64 90 L68 70 Z', '#ffd23f'))],
  ['bola', wrap(O_BG[0], C(64, 64, 40, '#ffffff', 'stroke="#b9c0c8" stroke-width="3"') + P('M64 50 L76 59 L71 73 L57 73 L52 59 Z', '#2c2c2c') + P('M64 26 L72 32 L69 40 L59 40 L56 32 Z', '#2c2c2c') + L('M64 24 v26 M56 32 L40 26 M72 32 L88 26 M52 59 L34 68 M76 59 L94 68 M57 73 L52 94 M71 73 L76 94', '#b9c0c8', 4))],
  ['livro', wrap(O_BG[1], R(30, 26, 68, 76, 6, '#3a5fd0') + R(24, 22, 68, 76, 6, '#5b7dff', 'stroke="#3a5fd0" stroke-width="3"') + L('M92 22 v76', '#3a5fd0', 6) + L('M36 42 h42 M36 54 h42 M36 66 h30', '#cfe0ff', 4))],
  ['lapis', wrap(O_BG[2], R(56, 22, 18, 70, 3, '#ffd23f', 'stroke="#e0a800" stroke-width="3"') + P('M56 92 L65 116 L74 92 Z', '#f0c8a0', 'stroke="#c9a878" stroke-width="2"') + P('M61 108 L65 116 L69 108 Z', '#3c2a1a') + R(56, 14, 18, 12, 3, '#ff9db5') + R(56, 20, 18, 6, 3, '#b9c0c8'))],
  ['telefone', wrap(O_BG[5], R(40, 14, 48, 100, 13, '#2f3a4a', 'stroke="#1f2a38" stroke-width="3"') + R(46, 24, 36, 72, 6, '#9fe3ff') + L('M52 38 h20 M52 50 h14', '#4f9fe0', 3) + C(64, 106, 4, '#8a8f98'))],
  ['notebook', wrap(O_BG[5], R(32, 26, 64, 46, 6, '#6b7c93') + R(38, 32, 52, 34, 4, '#9fe3ff') + R(44, 38, 18, 6, 3, '#cfefff') + P('M16 74 L112 74 L120 90 L8 90 Z', '#b9c0c8', 'stroke="#8a8f98" stroke-width="2"') + R(58, 80, 12, 4, 2, '#8a8f98'))],
  ['camera', wrap(O_BG[5], R(24, 42, 80, 54, 10, '#3c4a5a', 'stroke="#2a3542" stroke-width="3"') + C(64, 69, 18, '#9fe3ff', 'stroke="#6fb8d8" stroke-width="3"') + C(64, 69, 10, '#4f9fe0') + C(70, 62, 4, '#fff', 'opacity=".7"') + R(72, 32, 22, 14, 4, '#3c4a5a') + C(90, 52, 4, '#ffd23f'))],
  ['fone', wrap(O_BG[1], L('M32 76 Q32 26 64 26 Q96 26 96 76', '#3c4a5a', 11) + R(22, 68, 20, 36, 10, '#3c4a5a') + R(86, 68, 20, 36, 10, '#3c4a5a') + E(32, 86, 6, 11, '#9fe3ff') + E(96, 86, 6, 11, '#9fe3ff'))],
  ['presente', wrap(O_BG[3], R(26, 58, 76, 50, 6, '#f26b5e', 'stroke="#c81e4a" stroke-width="3"') + R(20, 42, 88, 20, 6, '#e53935', 'stroke="#c81e4a" stroke-width="3"') + R(57, 42, 14, 66, 3, '#ffd23f') + R(20, 58, 88, 12, 3, '#ffd23f') + P('M58 40 q-22 -4 -18 -18 q14 -2 18 18 Z', '#ffd23f', 'stroke="#e0a800" stroke-width="2"') + P('M70 40 q22 -4 18 -18 q-14 -2 -18 18 Z', '#ffd23f', 'stroke="#e0a800" stroke-width="2"'))],
  ['balao', wrap(O_BG[3], E(64, 52, 30, 35, '#ff5c8a', 'stroke="#d63f6d" stroke-width="3"') + E(53, 40, 6, 11, '#ffffff', 'opacity=".55"') + P('M58 86 L64 98 L70 86 Z', '#d63f6d') + L('M64 98 q10 14 -4 24 q-8 6 0 12', '#8a8f98', 3))],
  ['chave', wrap(O_BG[2], C(44, 42, 20, 'none', 'stroke="#ffd23f" stroke-width="13"') + C(44, 42, 8, 'none', 'stroke="#e0a800" stroke-width="4"') + R(56, 54, 14, 56, 5, '#ffd23f', 'stroke="#e0a800" stroke-width="2"') + R(68, 88, 16, 9, 4, '#ffd23f') + R(68, 102, 18, 9, 4, '#ffd23f'))],
  ['relogio', wrap(O_BG[0], C(64, 64, 40, '#ffffff', 'stroke="#4f7cff" stroke-width="6"') + L('M64 64 V40 M64 64 L84 76', '#3d2a22', 5) + C(64, 64, 5, '#3d2a22') + L('M64 30 v6 M64 92 v6 M30 64 h6 M92 64 h6', '#4f7cff', 4))],
  ['guarda_chuva', wrap(O_BG[5], P('M16 68 Q16 22 64 22 Q112 22 112 68 Q100 56 92 68 Q80 52 64 68 Q48 52 36 68 Q28 56 16 68 Z', '#4f7cff', 'stroke="#3a5fd0" stroke-width="3"') + L('M64 68 v34 q0 9 -11 9', '#6b7c93', 7))],
  ['coroa', wrap(O_BG[2], P('M18 92 L26 38 L46 62 L64 26 L82 62 L102 38 L110 92 Z', '#ffd23f', 'stroke="#e0a800" stroke-width="3"') + C(26, 42, 5, '#e53935') + C(64, 32, 5, '#4f9fe0') + C(102, 42, 5, '#e53935') + R(18, 92, 92, 12, 5, '#e0a800'))],
  ['diamante', wrap(O_BG[0], P('M32 44 L64 16 L96 44 L64 108 Z', '#9fe3ff', 'stroke="#4f9fe0" stroke-width="3"') + P('M32 44 L64 16 L96 44 Z', '#dff5ff') + L('M32 44 L96 44 M64 16 L50 44 L64 108 M96 44 L78 44', '#6fc4ee', 3))],
  ['dinheiro', wrap(O_BG[4], R(16, 42, 96, 48, 6, '#7cc95c', 'stroke="#3f8a3f" stroke-width="3"') + R(24, 50, 80, 32, 4, '#9fe07a') + C(64, 66, 13, '#fff3a0', 'stroke="#e0c86a" stroke-width="3"') + C(64, 66, 6, '#e0c86a'))],
  ['violao', wrap(O_BG[2], R(57, 18, 14, 60, 6, '#8a5a2a', 'stroke="#6b4a2a" stroke-width="2"') + R(54, 10, 20, 14, 4, '#3c2a1a') + E(50, 86, 27, 23, '#c47a26', 'stroke="#8a5a2a" stroke-width="3"') + C(50, 86, 9, '#3c2a1a') + L('M64 24 v52', '#e0c8a0', 2))],
  ['controle', wrap(O_BG[1], P('M24 52 Q24 38 42 38 L86 38 Q104 38 104 52 L104 84 Q104 98 90 98 Q78 98 72 88 L68 80 L60 80 L56 88 Q50 98 38 98 Q24 98 24 84 Z', '#8a8f98', 'stroke="#5f6670" stroke-width="3"') + L('M42 56 v18 M33 65 h18', '#3c4a5a', 5) + C(84, 58, 7, '#e53935') + C(84, 74, 7, '#4f9fe0'))],
  ['lampada', wrap(O_BG[2], C(64, 50, 28, '#fff3a0', 'stroke="#e0a800" stroke-width="3"') + L('M56 50 q8 -9 16 0', '#ffd23f', 3) + P('M50 76 h28 v8 h-28 Z', '#b9c0c8') + R(52, 88, 24, 12, 4, '#8a8f98') + L('M64 18 v-8 M38 34 l-8 -8 M90 34 l8 -8', '#ffd23f', 4))],
  ['ima', wrap(O_BG[3], P('M30 28 h20 v42 q0 14 14 14 t14 -14 v-42 h20 v42 q0 34 -34 34 t-34 -34 Z', '#e53935', 'stroke="#b71c1c" stroke-width="3"') + R(30, 28, 20, 16, 3, '#b9c0c8') + R(78, 28, 20, 16, 3, '#4f9fe0'))],
  ['tesoura', wrap(O_BG[5], L('M36 98 L84 40 M92 98 L44 40', '#b9c0c8', 8) + C(36, 102, 10, 'none', 'stroke="#8a8f98" stroke-width="6"') + C(92, 102, 10, 'none', 'stroke="#8a8f98" stroke-width="6"') + C(64, 66, 5, '#3c4a5a'))],
  ['martelo', wrap(O_BG[0], R(58, 44, 12, 66, 5, '#8a5a2a', 'stroke="#6b4a2a" stroke-width="2"') + R(36, 22, 56, 24, 6, '#8a8f98', 'stroke="#5f6670" stroke-width="3"') + R(36, 28, 56, 6, 3, '#b9c0c8'))],
  ['mochila', wrap(O_BG[1], R(30, 46, 68, 64, 14, '#4f7cff', 'stroke="#3a5fd0" stroke-width="3"') + R(42, 22, 44, 30, 14, 'none', 'stroke="#3a5fd0" stroke-width="10"') + R(50, 70, 28, 26, 7, '#3a5fd0') + C(64, 83, 4, '#ffd23f') + L('M36 46 h56', '#3a5fd0', 4))],
  ['oculos_sol', wrap(O_BG[4], C(42, 66, 20, '#3c4a5a', 'stroke="#2a3542" stroke-width="4"') + C(88, 66, 20, '#3c4a5a', 'stroke="#2a3542" stroke-width="4"') + L('M62 64 q2 -4 4 0', '#2a3542', 6) + L('M22 60 l-12 -8 M106 60 l12 -8', '#2a3542', 6) + L('M30 60 q10 -10 22 0', '#9fe3ff', 4, 'opacity=".75"') + L('M76 60 q10 -10 22 0', '#9fe3ff', 4, 'opacity=".75"'))],
  ['trofeu', wrap(O_BG[2], P('M40 24 h48 v18 q0 24 -24 24 t-24 -24 Z', '#ffd23f', 'stroke="#e0a800" stroke-width="3"') + P('M40 30 h-12 q0 20 14 20', 'none', 'stroke="#e0a800" stroke-width="6"') + P('M88 30 h12 q0 20 -14 20', 'none', 'stroke="#e0a800" stroke-width="6"') + R(58, 66, 12, 18, 3, '#e0a800') + R(46, 84, 36, 12, 4, '#b9840a') + R(38, 96, 52, 12, 5, '#8a5a2a'))]
]

const S_BG = [
  ['#ffe0e9', '#ff9db5'],
  ['#fff3c4', '#ffd15c'],
  ['#e0e8ff', '#9fb4ff'],
  ['#d8fff2', '#6fe0c0'],
  ['#eee0ff', '#b99cff'],
  ['#ffe0d1', '#ff9f7a']
]

const simbolos = [
  ['coracao', wrap(S_BG[0], heart(64, 58, 42, '#ff3b6b', 'stroke="#d61e4d" stroke-width="3"') + E(48, 42, 7, 12, '#ffffff', 'opacity=".5"'))],
  ['festa', wrap(S_BG[1], P('M28 102 L74 30 L100 58 Z', '#ff9800', 'stroke="#e07a00" stroke-width="3"') + L('M44 92 L58 74 M52 100 L66 84', '#fff3c4', 4) + star(96, 26, 9, '#e53935') + star(28, 30, 7, '#4f9fe0') + star(104, 78, 7, '#3fbf6f') + C(24, 70, 5, '#b99cff') + C(84, 108, 5, '#b99cff'))],
  ['coracao_partido', wrap(S_BG[5], heart(64, 58, 42, '#ff3b6b', 'stroke="#d61e4d" stroke-width="3"') + L('M64 16 v30 L54 58 L74 76 L60 102', '#ffe0e9', 7))],
  ['brilho', wrap(S_BG[3], sparkle(60, 60, 44) + sparkle(102, 30, 16, '#cff2ff') + sparkle(100, 96, 13, '#cff2ff') + sparkle(22, 96, 9, '#cff2ff'))],
  ['check', wrap(S_BG[3], L('M28 68 L52 92 L100 32', '#3fbf6f', 14))],
  ['xis', wrap(S_BG[0], L('M34 34 L94 94 M94 34 L34 94', '#e53935', 14))],
  ['mais', wrap(S_BG[2], L('M64 26 v76 M26 64 h76', '#4f7cff', 15))],
  ['menos', wrap(S_BG[5], L('M28 64 h72', '#ff9800', 15))],
  ['interrogacao', wrap(S_BG[4], L('M46 42 q0 -20 18 -20 t18 18 q0 12 -16 18 v10', '#b99cff', 13) + C(66, 94, 8, '#b99cff'))],
  ['exclamacao', wrap(S_BG[1], R(58, 18, 13, 58, 6, '#f0a000') + C(64, 92, 9, '#f0a000'))],
  ['infinito', wrap(S_BG[2], L('M38 64 C38 46 56 46 64 64 C72 82 90 82 90 64 C90 46 72 46 64 64 C56 82 38 82 38 64', '#4f7cff', 11))],
  ['yin_yang', wrap(S_BG[4], C(64, 64, 40, '#ffffff', 'stroke="#3c3c3c" stroke-width="3"') + P('M64 24 A40 40 0 0 1 64 104 A20 20 0 0 0 64 64 A20 20 0 0 1 64 24 Z', '#2c2c2c') + C(64, 44, 7, '#ffffff') + C(64, 84, 7, '#2c2c2c'))],
  ['caveira', wrap(S_BG[5], P('M34 90 Q20 86 20 64 Q20 28 64 28 Q108 28 108 64 Q108 86 94 90 L94 102 Q94 108 88 108 L84 108 Q78 108 78 102 L78 94 L50 94 L50 102 Q50 108 44 108 L40 108 Q34 108 34 102 Z', '#f2f2f2', 'stroke="#b9c0c8" stroke-width="3"') + C(48, 62, 11, INK) + C(80, 62, 11, INK) + P('M58 82 L64 74 L70 82 Z', INK) + L('M52 90 v8 M64 90 v8 M76 90 v8', INK, 3))],
  ['nota_musical', wrap(S_BG[4], E(42, 84, 15, 11, '#b99cff', 'transform="rotate(-20 42 84)"') + E(84, 76, 15, 11, '#b99cff', 'transform="rotate(-20 84 76)"') + R(52, 30, 8, 54, 3, '#b99cff') + R(94, 22, 8, 54, 3, '#b99cff') + P('M52 32 L102 22 L102 42 L52 52 Z', '#b99cff'))],
  ['sino', wrap(S_BG[1], P('M64 20 Q92 20 92 56 L96 84 L32 84 L36 56 Q36 20 64 20 Z', '#ffd23f', 'stroke="#e0a800" stroke-width="3"') + C(64, 94, 9, '#e0a800') + C(64, 12, 6, '#e0a800') + L('M44 74 q20 8 40 0', '#e0a800', 3))],
  ['cadeado', wrap(S_BG[1], P('M46 56 v-14 q0 -18 18 -18 t18 18 v14', 'none', 'stroke="#e0a800" stroke-width="11"') + R(34, 54, 60, 54, 12, '#ffd23f', 'stroke="#e0a800" stroke-width="3"') + C(64, 76, 8, '#8a5a2a') + R(60, 82, 8, 15, 3, '#8a5a2a'))],
  ['bandeira', wrap(S_BG[2], L('M34 16 v100', '#8a8f98', 7) + P('M34 22 L100 34 L100 64 L34 52 Z', '#e53935') + C(50, 38, 4, '#ffd23f', 'opacity=".9"'))],
  ['alvo', wrap(S_BG[0], C(64, 64, 42, 'none', 'stroke="#e53935" stroke-width="9"') + C(64, 64, 28, 'none', 'stroke="#f2f2f2" stroke-width="9"') + C(64, 64, 14, 'none', 'stroke="#e53935" stroke-width="9"') + C(64, 64, 6, '#e53935'))],
  ['dado', wrap(S_BG[3], R(30, 30, 68, 68, 14, '#ffffff', 'stroke="#b9c0c8" stroke-width="3"') + C(48, 48, 7, INK) + C(80, 48, 7, INK) + C(64, 64, 7, INK) + C(48, 80, 7, INK) + C(80, 80, 7, INK))],
  ['trevo', wrap(S_BG[3], heart(64, 44, 18, '#3fbf6f') + `<g transform="rotate(90 64 64)">${heart(64, 44, 18, '#3fbf6f')}</g>` + `<g transform="rotate(180 64 64)">${heart(64, 44, 18, '#3fbf6f')}</g>` + `<g transform="rotate(270 64 64)">${heart(64, 44, 18, '#3fbf6f')}</g>` + L('M64 66 q0 22 10 34', '#2f8f4f', 6))],
  ['seta_cima', wrap(S_BG[2], L('M64 104 V30', '#4f7cff', 15) + P('M64 14 L38 50 L90 50 Z', '#4f7cff'))],
  ['seta_baixo', wrap(S_BG[5], L('M64 24 V98', '#ff9800', 15) + P('M64 114 L38 78 L90 78 Z', '#ff9800'))],
  ['medalha', wrap(S_BG[1], L('M46 14 l18 32 M82 14 L64 46', '#4f9fe0', 9) + C(64, 78, 32, '#ffd23f', 'stroke="#e0a800" stroke-width="3"') + star(64, 78, 19, '#fff3a0') + C(64, 78, 5, '#e0a800'))],
  ['escudo', wrap(S_BG[2], P('M64 12 L104 26 Q104 76 64 112 Q24 76 24 26 Z', '#4f7cff', 'stroke="#3a5fd0" stroke-width="3"') + P('M64 22 L94 32 Q94 72 64 100 Q34 72 34 32 Z', '#6b93ff') + L('M44 62 L58 76 L86 44', '#ffffff', 10))],
  ['olho', wrap(S_BG[4], P('M16 64 Q64 22 112 64 Q64 106 16 64 Z', '#ffffff', 'stroke="#b9c0c8" stroke-width="3"') + C(64, 64, 19, '#4f9fe0') + C(64, 64, 8, INK) + C(58, 57, 5, '#ffffff'))]
]

const GROUPS = [
  ['reacoes', 'Reações', reacoes],
  ['animais', 'Animais', animais],
  ['comida', 'Comida', comida],
  ['natureza', 'Natureza', natureza],
  ['objetos', 'Objetos', objetos],
  ['simbolos', 'Símbolos', simbolos]
]

rmSync(OUT, { recursive: true, force: true })
const all = new Set()
let total = 0
for (const [id, label, items] of GROUPS) {
  mkdirSync(join(OUT, id), { recursive: true })
  for (const [name, svg] of items) {
    if (!/^[a-z0-9_-]{1,32}$/.test(name)) throw new Error(`nome inválido: ${name}`)
    if (all.has(name)) throw new Error(`nome duplicado: ${name}`)
    all.add(name)
    writeFileSync(join(OUT, id, `${name}.svg`), svg)
    total++
  }
  console.log(`${id.padEnd(10)} ${label.padEnd(10)} ${items.length}`)
}
console.log(`total      ${total}`)

