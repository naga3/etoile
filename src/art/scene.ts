import { STAGE_BACK_Y, VIEW_H as H, VIEW_W as W } from '../constants'
import { type RGB, css, darken, hex, lighten, mix } from './color'
import { sparkle } from './tiara'

export const SERIF = '"Hiragino Mincho ProN", "Yu Mincho", "YuMincho", "Noto Serif JP", serif'

/** 幕ごとの色と明かり。幕の変わり目では間を混ぜる */
export interface Mood {
  skyTop: RGB
  skyBottom: RGB
  hillFar: RGB
  hillNear: RGB
  set: RGB
  sunColor: RGB
  sun: number
  sunY: number
  moon: number
  stars: number
  lake: number
  glitter: number
  /** 舞台の暗さ。スポットライトの外が沈む */
  dark: number
}

const MOODS: Mood[] = [
  // 序曲：明け方
  {
    skyTop: hex('#f7c3d5'), skyBottom: hex('#ffe6cc'), hillFar: hex('#efb2c6'), hillNear: hex('#e09ab3'),
    set: hex('#f3cfdc'), sunColor: hex('#fff0c8'), sun: 0.9, sunY: 250, moon: 0, stars: 0, lake: 0, glitter: 0, dark: 0,
  },
  // 第一幕：朝の庭
  {
    skyTop: hex('#a6d5f0'), skyBottom: hex('#f2f5e1'), hillFar: hex('#b6d9c2'), hillNear: hex('#8cc3a0'),
    set: hex('#c4e2cb'), sunColor: hex('#fffbea'), sun: 1, sunY: 110, moon: 0, stars: 0, lake: 0.25, glitter: 0, dark: 0,
  },
  // 第二幕：夕映え
  {
    skyTop: hex('#8f5698'), skyBottom: hex('#ffb07a'), hillFar: hex('#c27a8f'), hillNear: hex('#8a4c78'),
    set: hex('#dba0b4'), sunColor: hex('#ffc982'), sun: 1, sunY: 300, moon: 0, stars: 0.15, lake: 0.5, glitter: 0,
    dark: 0.12,
  },
  // 第三幕：月の湖
  {
    skyTop: hex('#121a42'), skyBottom: hex('#34427c'), hillFar: hex('#29356a'), hillNear: hex('#1b2350'),
    set: hex('#47528c'), sunColor: hex('#fff6dc'), sun: 0, sunY: 300, moon: 1, stars: 1, lake: 1, glitter: 0, dark: 0.38,
  },
  // 終幕：星空
  {
    skyTop: hex('#22103c'), skyBottom: hex('#7b3e86'), hillFar: hex('#4a2664'), hillNear: hex('#32194b'),
    set: hex('#6c4a8e'), sunColor: hex('#fff6dc'), sun: 0, sunY: 300, moon: 0.25, stars: 1, lake: 0.6, glitter: 1,
    dark: 0.28,
  },
]

/** f は幕の番号。小数のときは前後の幕を混ぜる */
export function moodAt(f: number): Mood {
  const i = Math.max(0, Math.min(MOODS.length - 2, Math.floor(f)))
  const t = Math.max(0, Math.min(1, f - i))
  const a = MOODS[i]
  const b = MOODS[i + 1]
  const n = (x: number, y: number) => x + (y - x) * t
  return {
    skyTop: mix(a.skyTop, b.skyTop, t),
    skyBottom: mix(a.skyBottom, b.skyBottom, t),
    hillFar: mix(a.hillFar, b.hillFar, t),
    hillNear: mix(a.hillNear, b.hillNear, t),
    set: mix(a.set, b.set, t),
    sunColor: mix(a.sunColor, b.sunColor, t),
    sun: n(a.sun, b.sun),
    sunY: n(a.sunY, b.sunY),
    moon: n(a.moon, b.moon),
    stars: n(a.stars, b.stars),
    lake: n(a.lake, b.lake),
    glitter: n(a.glitter, b.glitter),
    dark: n(a.dark, b.dark),
  }
}

const wrap = (v: number, m: number) => ((v % m) + m) % m

// --- 書き割り（いちばん奥の絵） ---

export function drawBackdrop(ctx: CanvasRenderingContext2D, cam: number, m: Mood, time: number): void {
  const sky = ctx.createLinearGradient(0, 0, 0, STAGE_BACK_Y)
  sky.addColorStop(0, css(m.skyTop))
  sky.addColorStop(1, css(m.skyBottom))
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, W, STAGE_BACK_Y)

  if (m.stars > 0.01) {
    for (let i = 0; i < 80; i++) {
      const x = (i * 241.7 + 37) % W
      const y = 30 + ((i * 97.3) % 280)
      const tw = 0.55 + 0.45 * Math.sin(time * (1.3 + (i % 5) * 0.3) + i)
      ctx.fillStyle = `rgba(255,250,235,${m.stars * tw * (0.35 + (i % 4) * 0.15)})`
      ctx.beginPath()
      ctx.arc(x, y, 0.7 + (i % 3) * 0.45, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  if (m.sun > 0.01) glowDisc(ctx, 715, m.sunY, 44, m.sunColor, m.sun)
  if (m.moon > 0.01) moonDisc(ctx, 735, 108, 32, m.moon)

  ridge(ctx, cam * 0.06, 312, 30, m.hillFar, 0.3)
  if (m.lake > 0.01) lake(ctx, cam, m, time)
  ridge(ctx, cam * 0.14, 380, 14, m.hillNear, 2.1)

  if (m.glitter > 0.01) {
    for (let i = 0; i < 36; i++) {
      const y = 20 + wrap(i * 61 + time * (16 + (i % 4) * 7), 360)
      const x = ((i * 233.3) % W) + Math.sin(time * 0.8 + i) * 10
      const a = m.glitter * (0.4 + 0.4 * Math.sin(time * 3 + i * 2))
      sparkle(ctx, x, y, 2.5 + (i % 3), time + i, `rgba(255,228,150,${Math.max(0, a)})`)
    }
  }
}

function glowDisc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: RGB, a: number): void {
  const g = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 3.6)
  g.addColorStop(0, css(color, 0.55 * a))
  g.addColorStop(1, css(color, 0))
  ctx.fillStyle = g
  ctx.fillRect(x - r * 3.6, y - r * 3.6, r * 7.2, r * 7.2)
  ctx.fillStyle = css(lighten(color, 0.35), a)
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
}

function moonDisc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, a: number): void {
  glowDisc(ctx, x, y, r, hex('#dfe6ff'), a * 0.8)
  ctx.fillStyle = `rgba(255,251,232,${a})`
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = `rgba(190,180,160,${0.22 * a})`
  for (const [dx, dy, rr] of [[-10, -8, 7], [9, 6, 9], [-4, 14, 4], [12, -12, 4]]) {
    ctx.beginPath()
    ctx.arc(x + dx, y + dy, rr, 0, Math.PI * 2)
    ctx.fill()
  }
}

function ridge(ctx: CanvasRenderingContext2D, off: number, base: number, amp: number, color: RGB, seed: number): void {
  ctx.fillStyle = css(color)
  ctx.beginPath()
  ctx.moveTo(0, STAGE_BACK_Y)
  for (let x = 0; x <= W; x += 8) {
    const u = x + off
    const y = base - amp * (0.6 * Math.sin(u * 0.0061 + seed) + 0.4 * Math.sin(u * 0.0173 + seed * 2.3) + 0.6)
    ctx.lineTo(x, y)
  }
  ctx.lineTo(W, STAGE_BACK_Y)
  ctx.closePath()
  ctx.fill()
}

function lake(ctx: CanvasRenderingContext2D, cam: number, m: Mood, time: number): void {
  const top = 352
  const g = ctx.createLinearGradient(0, top, 0, STAGE_BACK_Y)
  g.addColorStop(0, css(lighten(m.skyBottom, 0.15), m.lake))
  g.addColorStop(1, css(m.skyTop, m.lake))
  ctx.fillStyle = g
  ctx.fillRect(0, top, W, STAGE_BACK_Y - top)

  ctx.lineWidth = 1.2
  for (let i = 0; i < 18; i++) {
    const y = top + 4 + ((i * 5.3) % 40)
    const x = wrap(i * 157 - cam * 0.1, W)
    const len = 20 + (i % 4) * 14
    ctx.strokeStyle = `rgba(255,255,255,${0.22 * m.lake * (0.6 + 0.4 * Math.sin(time * 2 + i))})`
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + len, y)
    ctx.stroke()
  }
  // 月や夕日の映り込み
  const glints: [number, RGB, number][] = [[735, hex('#fffbe8'), m.moon], [715, m.sunColor, m.sun * (m.sunY > 220 ? 1 : 0.3)]]
  for (const [gx, color, a] of glints) {
    if (a < 0.01) continue
    ctx.fillStyle = css(color, 0.55 * a * m.lake)
    for (let j = 0; j < 8; j++) {
      const w = 18 - j * 1.4 + Math.sin(time * 3 + j) * 3
      ctx.fillRect(gx - w / 2, top + 4 + j * 5.5, w, 1.6)
    }
  }
}

// --- 大道具（書き割りの手前に立つ板） ---

export function drawSets(ctx: CanvasRenderingContext2D, cam: number, m: Mood): void {
  const gap = 540
  const off = cam * 0.7
  const base = STAGE_BACK_Y + 3
  const first = Math.floor((off - 350) / gap)
  for (let i = first; i <= first + 3; i++) {
    const x = i * gap + 150 - off
    if (x < -200 || x > W + 200) continue
    const kind = wrap(i, 3)
    if (kind === 0) treeFlat(ctx, x, base, m.set)
    else if (kind === 1) archFlat(ctx, x, base, m.set)
    else bushFlat(ctx, x, base, m.set)
  }
}

function blobs(ctx: CanvasRenderingContext2D, x: number, base: number, list: number[][], set: RGB): void {
  ctx.fillStyle = css(darken(set, 0.16))
  ctx.beginPath()
  for (const [bx, by, r] of list) {
    ctx.moveTo(x + bx + 3 + r, base + by + 4)
    ctx.arc(x + bx + 3, base + by + 4, r, 0, Math.PI * 2)
  }
  ctx.fill()
  ctx.fillStyle = css(set)
  ctx.beginPath()
  for (const [bx, by, r] of list) {
    ctx.moveTo(x + bx + r, base + by)
    ctx.arc(x + bx, base + by, r, 0, Math.PI * 2)
  }
  ctx.fill()
  ctx.fillStyle = css(lighten(set, 0.3), 0.7)
  ctx.beginPath()
  for (const [bx, by, r] of list) {
    const hx = x + bx - r * 0.3
    const hy = base + by - r * 0.3
    ctx.moveTo(hx + r * 0.42, hy)
    ctx.arc(hx, hy, r * 0.42, 0, Math.PI * 2)
  }
  ctx.fill()
}

function treeFlat(ctx: CanvasRenderingContext2D, x: number, base: number, set: RGB): void {
  ctx.fillStyle = css(darken(set, 0.4))
  ctx.beginPath()
  ctx.moveTo(x - 8, base)
  ctx.lineTo(x - 4.5, base - 100)
  ctx.lineTo(x + 4.5, base - 100)
  ctx.lineTo(x + 8, base)
  ctx.closePath()
  ctx.fill()
  blobs(ctx, x, base, [[0, -128, 42], [-36, -104, 30], [36, -108, 32], [-16, -160, 30], [20, -154, 28]], set)
}

function bushFlat(ctx: CanvasRenderingContext2D, x: number, base: number, set: RGB): void {
  blobs(ctx, x, base, [[0, -26, 26], [-32, -18, 20], [32, -20, 22], [-12, -42, 18], [14, -40, 17]], set)
  // 小さな花
  ctx.fillStyle = css(lighten(mix(set, hex('#ff8fb1'), 0.6), 0.2))
  for (const [fx, fy] of [[-30, -26], [-8, -50], [18, -44], [34, -24], [4, -20], [-18, -12]]) {
    ctx.beginPath()
    ctx.arc(x + fx, base + fy, 2.6, 0, Math.PI * 2)
    ctx.fill()
  }
}

function archFlat(ctx: CanvasRenderingContext2D, x: number, base: number, set: RGB): void {
  const body = lighten(set, 0.18)
  const shade = darken(set, 0.12)
  const light = lighten(set, 0.45)
  ctx.strokeStyle = css(shade)
  ctx.lineWidth = 18
  ctx.beginPath()
  ctx.arc(x + 2, base - 156, 62, Math.PI, 0)
  ctx.stroke()
  ctx.strokeStyle = css(body)
  ctx.lineWidth = 14
  ctx.beginPath()
  ctx.arc(x, base - 158, 62, Math.PI, 0)
  ctx.stroke()
  ctx.strokeStyle = css(light, 0.6)
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.arc(x, base - 158, 67, Math.PI * 1.05, Math.PI * 1.6)
  ctx.stroke()
  ctx.fillStyle = css(body)
  ctx.fillRect(x - 7, base - 232, 14, 16)

  for (const cx of [x - 62, x + 62]) {
    ctx.fillStyle = css(shade)
    ctx.fillRect(cx - 10, base - 150, 22, 150)
    ctx.fillStyle = css(body)
    ctx.fillRect(cx - 10, base - 150, 17, 150)
    ctx.fillStyle = css(light, 0.6)
    ctx.fillRect(cx - 7, base - 150, 3, 150)
    ctx.fillStyle = css(body)
    ctx.fillRect(cx - 15, base - 160, 30, 10)
    ctx.fillRect(cx - 14, base - 10, 28, 10)
  }
  // 花飾り
  ctx.fillStyle = css(lighten(mix(set, hex('#ff8fb1'), 0.55), 0.15))
  for (let k = 1; k < 8; k++) {
    const a = Math.PI + (k / 8) * Math.PI
    ctx.beginPath()
    ctx.arc(x + Math.cos(a) * 62, base - 158 + Math.sin(a) * 62 + 6, 3.2, 0, Math.PI * 2)
    ctx.fill()
  }
}

// --- 床 ---

const ROWS = [400, 406, 413, 422, 433, 446, 461, 479, 500, 524, 540]

export function drawFloor(ctx: CanvasRenderingContext2D, cam: number, m: Mood): void {
  const wood = ctx.createLinearGradient(0, STAGE_BACK_Y, 0, H)
  wood.addColorStop(0, css(mix(hex('#c99a6c'), m.skyBottom, 0.15)))
  wood.addColorStop(1, css(mix(hex('#7a4b30'), m.skyBottom, 0.1)))
  ctx.fillStyle = wood
  ctx.fillRect(0, STAGE_BACK_Y, W, H - STAGE_BACK_Y)

  // 板。手前ほど速く流れて、奥行きが出る
  ctx.lineWidth = 1
  for (let r = 0; r < ROWS.length - 1; r++) {
    const y0 = ROWS[r]
    const y1 = ROWS[r + 1]
    if (r % 2) {
      ctx.fillStyle = 'rgba(255,240,220,0.04)'
      ctx.fillRect(0, y0, W, y1 - y0)
    }
    ctx.strokeStyle = 'rgba(70,35,15,0.28)'
    ctx.beginPath()
    ctx.moveTo(0, y0 + 0.5)
    ctx.lineTo(W, y0 + 0.5)
    const f = 0.72 + (0.62 * ((y0 + y1) / 2 - STAGE_BACK_Y)) / (H - STAGE_BACK_Y)
    const sp = 190 * f
    for (let x = -wrap(cam * f + r * 67, sp); x < W; x += sp) {
      ctx.moveTo(x + 0.5, y0 + 1)
      ctx.lineTo(x + 0.5, y1)
    }
    ctx.stroke()
  }

  const back = ctx.createLinearGradient(0, STAGE_BACK_Y, 0, STAGE_BACK_Y + 20)
  back.addColorStop(0, 'rgba(30,10,15,0.35)')
  back.addColorStop(1, 'rgba(30,10,15,0)')
  ctx.fillStyle = back
  ctx.fillRect(0, STAGE_BACK_Y, W, 20)

  const gloss = ctx.createLinearGradient(0, 425, 0, 500)
  gloss.addColorStop(0, 'rgba(255,255,255,0)')
  gloss.addColorStop(0.4, 'rgba(255,250,240,0.1)')
  gloss.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gloss
  ctx.fillRect(0, 425, W, 75)
}

/** 舞台の縁に並ぶ明かり */
export function drawFootlights(ctx: CanvasRenderingContext2D, time: number): void {
  ctx.fillStyle = 'rgba(30,14,10,0.85)'
  ctx.fillRect(0, H - 9, W, 9)
  for (let i = 0; i < 9; i++) {
    const x = 96 + i * 96
    const flick = 0.92 + 0.08 * Math.sin(time * 7 + i * 1.7)
    const g = ctx.createRadialGradient(x, H, 2, x, H, 90)
    g.addColorStop(0, `rgba(255,226,160,${0.42 * flick})`)
    g.addColorStop(1, 'rgba(255,210,140,0)')
    ctx.fillStyle = g
    ctx.fillRect(x - 90, H - 90, 180, 90)
    ctx.fillStyle = '#2b1a12'
    ctx.beginPath()
    ctx.ellipse(x, H - 2, 20, 7, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#fff1c2'
    ctx.beginPath()
    ctx.ellipse(x, H - 5, 11, 3, 0, 0, Math.PI * 2)
    ctx.fill()
  }
}

// --- 額縁（上の飾り幕と両脇の幕）。動かないので一度だけ描く ---

export function makeProscenium(): HTMLCanvasElement {
  const k = 2
  const c = document.createElement('canvas')
  c.width = W * k
  c.height = H * k
  const g = c.getContext('2d')!
  g.scale(k, k)

  const vig = g.createRadialGradient(W / 2, H * 0.55, 300, W / 2, H * 0.55, 640)
  vig.addColorStop(0, 'rgba(30,0,15,0)')
  vig.addColorStop(1, 'rgba(30,0,15,0.38)')
  g.fillStyle = vig
  g.fillRect(0, 0, W, H)

  // 両脇の幕
  for (const side of [1, -1]) {
    g.save()
    if (side < 0) {
      g.translate(W, 0)
      g.scale(-1, 1)
    }
    const folds = g.createLinearGradient(0, 0, 58, 0)
    const stops: [number, string][] = [
      [0, '#4d0612'], [0.18, '#9c1a2e'], [0.34, '#6a0b1b'], [0.52, '#b42239'], [0.7, '#7a0f20'], [0.88, '#a21a30'],
      [1, '#5c0716'],
    ]
    for (const [t, col] of stops) folds.addColorStop(t, col)
    g.fillStyle = folds
    g.beginPath()
    g.moveTo(0, 0)
    g.lineTo(60, 0)
    g.bezierCurveTo(54, 120, 28, 200, 30, 262)
    g.bezierCurveTo(32, 330, 56, 460, 52, 540)
    g.lineTo(0, 540)
    g.closePath()
    g.fill()
    const shade = g.createLinearGradient(0, 0, 0, H)
    shade.addColorStop(0, 'rgba(0,0,0,0.35)')
    shade.addColorStop(0.3, 'rgba(0,0,0,0)')
    shade.addColorStop(1, 'rgba(0,0,0,0.3)')
    g.fillStyle = shade
    g.fill()
    // 金の留め紐と房
    g.strokeStyle = '#d9a93a'
    g.lineWidth = 4
    g.beginPath()
    g.moveTo(0, 256)
    g.quadraticCurveTo(20, 272, 36, 262)
    g.stroke()
    g.fillStyle = '#e8bd52'
    g.beginPath()
    g.arc(36, 264, 4, 0, Math.PI * 2)
    g.fill()
    g.beginPath()
    g.moveTo(32, 266)
    g.lineTo(30, 290)
    g.lineTo(42, 290)
    g.lineTo(40, 266)
    g.closePath()
    g.fill()
    g.restore()
  }

  // 上の飾り幕
  const top = g.createLinearGradient(0, 0, 0, 28)
  top.addColorStop(0, '#4e0510')
  top.addColorStop(1, '#8f1528')
  g.fillStyle = top
  g.fillRect(0, 0, W, 28)
  for (let i = 0; i < 4; i++) {
    const x0 = i * 240
    const swag = g.createLinearGradient(0, 0, 0, 50)
    swag.addColorStop(0, '#8f1528')
    swag.addColorStop(0.55, '#b82137')
    swag.addColorStop(1, '#6c0a1a')
    g.fillStyle = swag
    g.beginPath()
    g.moveTo(x0, 0)
    g.lineTo(x0, 18)
    g.quadraticCurveTo(x0 + 120, 76, x0 + 240, 18)
    g.lineTo(x0 + 240, 0)
    g.closePath()
    g.fill()
    g.strokeStyle = 'rgba(255,150,160,0.16)'
    g.lineWidth = 3
    for (const d of [14, 26]) {
      g.beginPath()
      g.moveTo(x0 + 14, 18 + d * 0.15)
      g.quadraticCurveTo(x0 + 120, 76 - 36 + d, x0 + 226, 18 + d * 0.15)
      g.stroke()
    }
    // 金のふち飾りと玉
    g.strokeStyle = '#e7b84d'
    g.lineWidth = 3
    g.beginPath()
    g.moveTo(x0, 18)
    g.quadraticCurveTo(x0 + 120, 76, x0 + 240, 18)
    g.stroke()
    g.fillStyle = '#f5d27a'
    for (let t = 0.05; t < 1; t += 0.05) {
      const px = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * (x0 + 120) + t * t * (x0 + 240)
      const py = (1 - t) * (1 - t) * 18 + 2 * (1 - t) * t * 76 + t * t * 18
      g.beginPath()
      g.arc(px, py + 3.5, 1.6, 0, Math.PI * 2)
      g.fill()
    }
  }
  for (let i = 0; i <= 4; i++) {
    const x = i * 240
    g.fillStyle = '#e8bd52'
    g.beginPath()
    g.arc(x, 20, 4.5, 0, Math.PI * 2)
    g.fill()
    g.beginPath()
    g.moveTo(x - 3, 23)
    g.lineTo(x - 5, 42)
    g.lineTo(x + 5, 42)
    g.lineTo(x + 3, 23)
    g.closePath()
    g.fill()
  }
  return c
}

/** 開け閉めする大きな幕。open は 0 で閉、1 で開 */
export function drawMainCurtain(ctx: CanvasRenderingContext2D, open: number): void {
  if (open >= 1) return
  const half = W / 2
  const shift = open * (half + 40)
  for (const side of [-1, 1]) {
    ctx.save()
    ctx.translate(side < 0 ? -shift : half + shift, 0)
    const x0 = side < 0 ? -8 : 0
    const width = half + 8
    const g = ctx.createLinearGradient(x0, 0, x0 + width, 0)
    const folds = 9
    for (let i = 0; i <= folds * 2; i++) {
      const t = i / (folds * 2)
      g.addColorStop(t, i % 2 ? '#b8213a' : '#6e0a1c')
    }
    ctx.fillStyle = g
    ctx.fillRect(x0, 0, width, H)
    const shade = ctx.createLinearGradient(0, 0, 0, H)
    shade.addColorStop(0, 'rgba(20,0,5,0.45)')
    shade.addColorStop(0.35, 'rgba(20,0,5,0)')
    shade.addColorStop(0.85, 'rgba(20,0,5,0.1)')
    shade.addColorStop(1, 'rgba(20,0,5,0.4)')
    ctx.fillStyle = shade
    ctx.fillRect(x0, 0, width, H)
    // 合わせ目の影
    const ex = side < 0 ? x0 + width - 24 : x0
    const edge = ctx.createLinearGradient(ex, 0, ex + 24, 0)
    edge.addColorStop(side < 0 ? 0 : 1, 'rgba(0,0,0,0)')
    edge.addColorStop(side < 0 ? 1 : 0, 'rgba(20,0,5,0.45)')
    ctx.fillStyle = edge
    ctx.fillRect(ex, 0, 24, H)
    // 裾の金の帯
    ctx.fillStyle = '#d9a640'
    ctx.fillRect(x0, H - 22, width, 5)
    ctx.fillStyle = 'rgba(232,189,82,0.8)'
    for (let x = x0 + 4; x < x0 + width; x += 8) ctx.fillRect(x, H - 17, 2, 7)
    ctx.restore()
  }
}
