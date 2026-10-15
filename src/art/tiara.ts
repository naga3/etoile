/** ティアラと光の粒。ティアラは一度だけ描いて使い回す */
const SW = 48
const SH = 40
const OX = 24
const OY = 24

export function makeTiaraSprite(): HTMLCanvasElement {
  const k = 3
  const c = document.createElement('canvas')
  c.width = SW * k
  c.height = SH * k
  const g = c.getContext('2d')!
  g.scale(k, k)
  g.translate(OX, OY)

  // 後光
  const glow = g.createRadialGradient(0, -3, 0, 0, -3, 22)
  glow.addColorStop(0, 'rgba(255,240,190,0.75)')
  glow.addColorStop(0.5, 'rgba(255,220,150,0.25)')
  glow.addColorStop(1, 'rgba(255,220,150,0)')
  g.fillStyle = glow
  g.fillRect(-OX, -OY, SW, SH)

  // 冠の透かし
  const gold = g.createLinearGradient(0, -14, 0, 9)
  gold.addColorStop(0, '#fff8d2')
  gold.addColorStop(0.45, '#f6cd55')
  gold.addColorStop(1, '#b07a12')
  g.beginPath()
  g.moveTo(-17, 6)
  g.quadraticCurveTo(-16, -1, -13, -3.5)
  g.quadraticCurveTo(-11, 0, -8.5, 1)
  g.quadraticCurveTo(-7, -5, -5, -8.5)
  g.quadraticCurveTo(-3, -3, -2, -1)
  g.quadraticCurveTo(-1.5, -9, 0, -13.5)
  g.quadraticCurveTo(1.5, -9, 2, -1)
  g.quadraticCurveTo(3, -3, 5, -8.5)
  g.quadraticCurveTo(7, -5, 8.5, 1)
  g.quadraticCurveTo(11, 0, 13, -3.5)
  g.quadraticCurveTo(16, -1, 17, 6)
  g.closePath()
  g.fillStyle = gold
  g.fill()
  g.strokeStyle = '#94650c'
  g.lineWidth = 0.7
  g.stroke()

  // 輪
  const band = g.createLinearGradient(0, 2, 0, 10)
  band.addColorStop(0, '#ffeeb0')
  band.addColorStop(1, '#c08a1a')
  g.beginPath()
  g.moveTo(-18.5, 6)
  g.quadraticCurveTo(0, 0.5, 18.5, 6)
  g.lineTo(18, 9.5)
  g.quadraticCurveTo(0, 4.5, -18, 9.5)
  g.closePath()
  g.fillStyle = band
  g.fill()
  g.stroke()

  // 輪に並ぶ小さな石
  for (let i = -3; i <= 3; i++) {
    const x = i * 5
    const y = 7.75 - 2.65 * (1 - (x / 18.5) ** 2)
    g.fillStyle = i % 2 === 0 ? '#ff8fb8' : '#ffffff'
    g.beginPath()
    g.arc(x, y, 0.95, 0, Math.PI * 2)
    g.fill()
  }

  // 脇の青い石
  for (const x of [-8.5, 8.5]) {
    const blue = g.createRadialGradient(x - 0.6, 1.4, 0.2, x, 2.2, 2.4)
    blue.addColorStop(0, '#e4f5ff')
    blue.addColorStop(0.45, '#3d9be9')
    blue.addColorStop(1, '#0d3f8f')
    g.fillStyle = blue
    g.beginPath()
    g.arc(x, 2.2, 2.1, 0, Math.PI * 2)
    g.fill()
  }

  // 真ん中のしずく形の石
  const pink = g.createRadialGradient(-0.8, -5.8, 0.3, 0, -4, 4.5)
  pink.addColorStop(0, '#ffe3ee')
  pink.addColorStop(0.4, '#f0508a')
  pink.addColorStop(1, '#8a1240')
  g.beginPath()
  g.moveTo(0, -8.8)
  g.bezierCurveTo(3.6, -5, 3.2, -1, 0, -1)
  g.bezierCurveTo(-3.2, -1, -3.6, -5, 0, -8.8)
  g.fillStyle = pink
  g.fill()
  g.strokeStyle = '#6d0e33'
  g.lineWidth = 0.5
  g.stroke()

  // 先端の真珠
  for (const [x, y] of [[0, -13.5], [-5, -8.5], [5, -8.5], [-13, -3.5], [13, -3.5]]) {
    const pearl = g.createRadialGradient(x - 0.5, y - 1.6, 0.1, x, y - 1, 1.9)
    pearl.addColorStop(0, '#ffffff')
    pearl.addColorStop(1, '#d9cde6')
    g.fillStyle = pearl
    g.beginPath()
    g.arc(x, y - 1, 1.7, 0, Math.PI * 2)
    g.fill()
  }
  return c
}

/** 揺れながら光るティアラ。(x, y) は当たり判定の中心 */
export function drawTiara(
  ctx: CanvasRenderingContext2D, sprite: HTMLCanvasElement, x: number, y: number, time: number, seed: number,
): void {
  const by = y + Math.sin(time * 2.6 + seed) * 3
  blitTiara(ctx, sprite, x, by, 1)
  const tw = Math.max(0, Math.sin(time * 1.9 + seed * 1.7)) ** 6
  if (tw > 0.02) sparkle(ctx, x, by - 14, 8 * tw, time, `rgba(255,255,255,${tw})`)
}

export function blitTiara(
  ctx: CanvasRenderingContext2D, sprite: HTMLCanvasElement, x: number, y: number, scale: number,
): void {
  ctx.drawImage(sprite, x - OX * scale, y - OY * scale, SW * scale, SH * scale)
}

/** 四つ角のきらめき */
export function sparkle(
  ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number, color: string,
): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rot)
  ctx.fillStyle = color
  ctx.beginPath()
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4
    const rr = i % 2 ? r * 0.22 : r
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr)
  }
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

/** 五芒星の道筋を作る（塗りは呼び出し側） */
export function starPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, inner: number): void {
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const rr = i % 2 ? inner : r
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
  }
  ctx.closePath()
}
