/**
 * バレリーナの絵。原点は足元（床に触れる点）で、上が負。
 * 歩きとためは横向き、空中は正面向きの体を回して描く。
 */
const C = {
  skin: '#ffe4d6',
  skinShade: '#f0c4b2',
  tights: '#ffdfe4',
  tightsShade: '#ecbcc6',
  shoe: '#f7b2c6',
  shoeShade: '#df8ea8',
  bodice: '#e0577f',
  bodiceLight: '#f58fae',
  bodiceDark: '#ad345c',
  tutu: ['#f2a8c3', '#ffd0e0', '#fff1f6'],
  pleat: 'rgba(214,110,150,0.35)',
  hair: '#4b2d24',
  hairLight: 'rgba(160,100,80,0.55)',
  blush: 'rgba(255,128,160,0.45)',
  lash: '#3a2420',
  lip: '#e2557f',
  flower: '#ff7aa2',
}

const TH = 22 // 腿
const SH = 22 // すね
const FT = 8 // 足先
const UA = 14 // 上腕
const FA = 13 // 前腕
const HIP = 52 // 正面向きでつま先立ちのときの腰の高さ

export type Pose =
  | { kind: 'run'; phase: number }
  | { kind: 'plie'; depth: number; arms: number }
  | { kind: 'turn'; angle: number; passe: number }

export function drawDancer(ctx: CanvasRenderingContext2D, pose: Pose): void {
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (pose.kind === 'turn') drawTurn(ctx, pose.angle, pose.passe)
  else drawSide(ctx, pose.kind === 'run' ? runPose(pose.phase) : pliePose(pose.depth, pose.arms))
}

// --- 横向き ---

/** 角度は真下を 0 とし、前（右）へ倒すほど正 */
interface Leg { thigh: number; shin: number; foot: number }
interface Arm { upper: number; fore: number }
interface Side { back: Leg; front: Leg; backArm: Arm; frontArm: Arm; lean: number }

/** つま先で小走りする（パ・ド・クーリュ） */
function runPose(phase: number): Side {
  const leg = (ph: number): Leg => {
    const thigh = 0.45 * Math.sin(ph)
    const shin = thigh - (0.2 + 0.6 * Math.max(0, Math.cos(ph)))
    return { thigh, shin, foot: shin - 0.25 }
  }
  const sway = Math.sin(phase * 2) * 0.05
  return {
    back: leg(phase + Math.PI),
    front: leg(phase),
    backArm: { upper: -1.3 + sway, fore: -1.6 + sway },
    frontArm: { upper: 1.85 - sway, fore: 2.15 - sway },
    lean: 0.05,
  }
}

/** 膝を曲げてためる（プリエ）。arms で腕を下から胸の前へ上げる */
function pliePose(depth: number, arms: number): Side {
  const d = depth
  return {
    front: { thigh: 0.75 * d, shin: -0.45 * d, foot: Math.PI / 2 },
    back: { thigh: 0.55 * d - 0.05, shin: -0.6 * d - 0.05, foot: -Math.PI / 2 },
    frontArm: { upper: 0.35 + 0.9 * arms, fore: 1.35 + 0.9 * arms },
    backArm: { upper: 0.2 + 0.8 * arms, fore: 1.2 + 0.8 * arms },
    lean: 0.04 * d,
  }
}

interface LegPts { kx: number; ky: number; ax: number; ay: number; tx: number; ty: number }

function legPoints(l: Leg): LegPts {
  const kx = Math.sin(l.thigh) * TH
  const ky = Math.cos(l.thigh) * TH
  const ax = kx + Math.sin(l.shin) * SH
  const ay = ky + Math.cos(l.shin) * SH
  return { kx, ky, ax, ay, tx: ax + Math.sin(l.foot) * FT, ty: ay + Math.cos(l.foot) * FT }
}

function drawSide(ctx: CanvasRenderingContext2D, s: Side): void {
  const b = legPoints(s.back)
  const f = legPoints(s.front)
  // いちばん低い点が床に触れるように腰の高さを決める
  const hipY = -Math.max(b.ay, b.ty, f.ay, f.ty)
  const shoulder = { x: 27 * Math.sin(s.lean) + 0.5, y: -27 * Math.cos(s.lean) }

  ctx.save()
  ctx.translate(0, hipY)
  drawArm(ctx, shoulder, s.backArm, C.skinShade)
  drawLeg(ctx, 0, 0, b, C.tightsShade, C.shoeShade)
  drawLeg(ctx, 0, 0, f, C.tights, C.shoe)
  ctx.save()
  ctx.rotate(s.lean * 0.5)
  tutu(ctx, -1, 0)
  ctx.restore()
  ctx.save()
  ctx.rotate(s.lean)
  torsoSide(ctx)
  ctx.restore()
  drawArm(ctx, shoulder, s.frontArm, C.skin)
  ctx.restore()
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, w: number): void {
  ctx.lineWidth = w
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
}

function drawLeg(
  ctx: CanvasRenderingContext2D, hx: number, hy: number, p: LegPts, color: string, shoe: string,
): void {
  ctx.strokeStyle = color
  line(ctx, hx, hy, hx + p.kx, hy + p.ky, 7.5)
  line(ctx, hx + p.kx, hy + p.ky, hx + p.ax, hy + p.ay, 5.6)
  ctx.strokeStyle = shoe
  line(ctx, hx + p.ax, hy + p.ay, hx + p.tx, hy + p.ty, 4.4)
  // 足首で交差するリボン
  const len = Math.hypot(p.kx - p.ax, p.ky - p.ay) || 1
  const ux = (p.kx - p.ax) / len
  const uy = (p.ky - p.ay) / len
  const ax = hx + p.ax
  const ay = hy + p.ay
  line(ctx, ax + ux * 6 - uy * 2.6, ay + uy * 6 + ux * 2.6, ax + ux * 1.5 + uy * 2.6, ay + uy * 1.5 - ux * 2.6, 1.1)
  line(ctx, ax + ux * 6 + uy * 2.6, ay + uy * 6 - ux * 2.6, ax + ux * 1.5 - uy * 2.6, ay + uy * 1.5 + ux * 2.6, 1.1)
}

/** 肘で丸みのついた腕 */
function drawArm(ctx: CanvasRenderingContext2D, s: { x: number; y: number }, arm: Arm, color: string): void {
  const ex = s.x + Math.sin(arm.upper) * UA
  const ey = s.y + Math.cos(arm.upper) * UA
  const hx = ex + Math.sin(arm.fore) * FA
  const hy = ey + Math.cos(arm.fore) * FA
  ctx.strokeStyle = color
  ctx.lineWidth = 3.6
  ctx.beginPath()
  ctx.moveTo(s.x, s.y)
  ctx.quadraticCurveTo(ex, ey, hx, hy)
  ctx.stroke()
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.ellipse(hx, hy, 2.6, 1.6, Math.atan2(Math.cos(arm.fore), Math.sin(arm.fore)), 0, Math.PI * 2)
  ctx.fill()
}

/** 腰を原点に、右を向いた胴と頭 */
function torsoSide(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = C.skin
  line(ctx, 1, -27, 2.5, -35, 5.5)
  ctx.fillStyle = C.skin
  ctx.beginPath()
  ctx.ellipse(0.5, -25, 6.5, 4.5, 0, 0, Math.PI * 2)
  ctx.fill()

  const g = ctx.createLinearGradient(-7, 0, 9, 0)
  g.addColorStop(0, C.bodiceDark)
  g.addColorStop(0.55, C.bodice)
  g.addColorStop(1, C.bodiceLight)
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.moveTo(-6, 3)
  ctx.bezierCurveTo(-7.5, -6, -5, -13, -6.5, -21)
  ctx.quadraticCurveTo(-6.5, -25, -4, -27)
  ctx.quadraticCurveTo(1.5, -24.5, 7, -24.5)
  ctx.bezierCurveTo(9, -21, 8, -16, 5, -12)
  ctx.bezierCurveTo(3.5, -7, 6, -1, 6.5, 3)
  ctx.closePath()
  ctx.fill()
  // 胸元の飾り
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  for (const [x, y] of [[0, -24.5], [3, -24.2], [5.6, -24.2]]) {
    ctx.beginPath()
    ctx.arc(x, y, 0.7, 0, Math.PI * 2)
    ctx.fill()
  }

  headSide(ctx, 3.5, -43)
}

function headSide(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  const r = 8.5
  bun(ctx, cx - 7, cy - 5)

  ctx.fillStyle = C.skin
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(cx + 7.5, cy - 2)
  ctx.quadraticCurveTo(cx + 10.4, cy + 1.2, cx + 7.8, cy + 2.4)
  ctx.fill()

  // 髪。後ろから頭頂を覆い、額の生え際へ
  ctx.fillStyle = C.hair
  ctx.beginPath()
  ctx.arc(cx, cy, r + 0.6, Math.PI * 0.62, Math.PI * 1.9)
  ctx.quadraticCurveTo(cx + 1.5, cy - 4, cx - 3, cy + 3)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = C.hairLight
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.arc(cx - 0.5, cy - 0.5, r - 1.5, Math.PI * 1.15, Math.PI * 1.55)
  ctx.stroke()
  flower(ctx, cx - 2.5, cy - 9.5)

  // 伏せたまつげ・頬・口
  ctx.strokeStyle = C.lash
  ctx.lineWidth = 1.1
  ctx.beginPath()
  ctx.arc(cx + 4.4, cy - 0.8, 2.1, Math.PI * 0.15, Math.PI * 0.85)
  ctx.stroke()
  line(ctx, cx + 6.3, cy - 0.1, cx + 7.4, cy - 0.9, 0.9)
  ctx.fillStyle = C.blush
  ctx.beginPath()
  ctx.ellipse(cx + 4.3, cy + 3.1, 2.4, 1.5, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = C.lip
  ctx.beginPath()
  ctx.arc(cx + 7, cy + 4.6, 0.9, 0, Math.PI * 2)
  ctx.fill()
}

function bun(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = C.hair
  ctx.beginPath()
  ctx.arc(x, y, 5.2, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = C.hairLight
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(x, y, 3.2, Math.PI * 1.1, Math.PI * 1.7)
  ctx.stroke()
}

function flower(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = C.flower
  for (let i = 0; i < 5; i++) {
    const a = (i * Math.PI * 2) / 5
    ctx.beginPath()
    ctx.arc(x + Math.cos(a) * 1.7, y + Math.sin(a) * 1.7, 1.4, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = '#fff3c4'
  ctx.beginPath()
  ctx.arc(x, y, 0.9, 0, Math.PI * 2)
  ctx.fill()
}

/**
 * 重なったスカート（パンケーキ型のチュチュ）。
 * 縁の飾りとひだを spin だけずらして描くと、体の回転につれて回って見える。
 */
function tutu(ctx: CanvasRenderingContext2D, cy: number, spin: number): void {
  for (let i = 0; i < 3; i++) {
    const rx = 35 - i * 5.5
    const ry = 7.5 - i * 1.6
    const y = cy - i * 2
    const n = 16 - i * 3
    ctx.fillStyle = C.tutu[i]
    ctx.beginPath()
    ctx.ellipse(0, y, rx, ry, 0, 0, Math.PI * 2)
    for (let k = 0; k < n; k++) {
      const a = spin + (k / n) * Math.PI * 2
      const sa = Math.sin(a)
      if (sa < -0.2) continue
      const px = Math.cos(a) * rx
      const py = y + sa * ry
      ctx.moveTo(px + 2.8, py)
      ctx.arc(px, py, 2.8, 0, Math.PI * 2)
    }
    ctx.fill()

    ctx.strokeStyle = C.pleat
    ctx.lineWidth = 0.8
    ctx.beginPath()
    for (let k = 0; k < n; k++) {
      const a = spin + ((k + 0.5) / n) * Math.PI * 2
      const sa = Math.sin(a)
      if (sa < 0.05) continue
      ctx.moveTo(Math.cos(a) * rx * 0.35, y + sa * ry * 0.35)
      ctx.lineTo(Math.cos(a) * rx * 0.97, y + sa * ry * 0.97)
    }
    ctx.stroke()
  }
  // スパンコール
  ctx.fillStyle = 'rgba(255,255,255,0.95)'
  for (let k = 0; k < 7; k++) {
    const a = spin + (k / 7) * Math.PI * 2
    const sa = Math.sin(a)
    if (sa < 0) continue
    ctx.beginPath()
    ctx.arc(Math.cos(a) * 17, cy - 4 + sa * 2.2, 0.9, 0, Math.PI * 2)
    ctx.fill()
  }
}

// --- 正面向き（空中で回る） ---

/**
 * angle が 0 で正面、π/2 で右向き。passe で片脚を軸足の膝へ引き上げる。
 * 横幅を cos で縮めて、縦の軸のまわりの回転に見せる。
 */
function drawTurn(ctx: CanvasRenderingContext2D, angle: number, passe: number): void {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  const wf = 0.62 + 0.38 * Math.abs(c)
  const ax = Math.max(0.3, Math.abs(c))

  const support = () => {
    ctx.strokeStyle = C.tights
    line(ctx, 0, -HIP, 0, -30, 7.5)
    line(ctx, 0, -30, 0, -8, 5.6)
    ctx.strokeStyle = C.shoe
    line(ctx, 0, -8, 0, 0, 4.4)
    line(ctx, -2.6, -13, 2.6, -9, 1.1)
    line(ctx, 2.6, -13, -2.6, -9, 1.1)
  }
  const bent = (color: string, shoe: string) => {
    const kx = 16 * c * passe
    const ky = -30 - 10 * passe
    const anx = 5 * c * passe
    const any = -8 - 23.5 * passe
    const tx = 1 * c * passe
    const ty = -29 * passe
    ctx.strokeStyle = color
    line(ctx, 0, -HIP, kx, ky, 7.5)
    line(ctx, kx, ky, anx, any, 5.6)
    ctx.strokeStyle = shoe
    line(ctx, anx, any, tx, ty, 4.4)
  }
  if (s > 0) {
    bent(C.tightsShade, C.shoeShade)
    support()
  } else {
    support()
    bent(C.tights, C.shoe)
  }

  ctx.save()
  ctx.translate(0, -HIP)
  tutu(ctx, -1, angle)

  // 胴
  ctx.strokeStyle = C.skin
  line(ctx, 0, -27, 0, -35, 5.5)
  ctx.fillStyle = C.skin
  ctx.beginPath()
  ctx.ellipse(0, -25, 8.5 * wf, 4, 0, 0, Math.PI * 2)
  ctx.fill()
  const g = ctx.createLinearGradient(-8 * wf, 0, 8 * wf, 0)
  g.addColorStop(0, C.bodiceLight)
  g.addColorStop(0.5, C.bodice)
  g.addColorStop(1, C.bodiceDark)
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.moveTo(-7 * wf, 3)
  ctx.bezierCurveTo(-6.5 * wf, -6, -5 * wf, -12, -7.5 * wf, -21)
  ctx.quadraticCurveTo(-8 * wf, -25, -6.5 * wf, -26)
  if (c > 0) {
    ctx.quadraticCurveTo(-3 * wf, -27, 0, -23.5)
    ctx.quadraticCurveTo(3 * wf, -27, 6.5 * wf, -26)
  } else {
    ctx.quadraticCurveTo(0, -25, 6.5 * wf, -26)
  }
  ctx.quadraticCurveTo(8 * wf, -25, 7.5 * wf, -21)
  ctx.bezierCurveTo(5 * wf, -12, 6.5 * wf, -6, 7 * wf, 3)
  ctx.closePath()
  ctx.fill()
  if (c <= 0) {
    // 背中の編み上げ
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'
    for (let y = -22; y < -8; y += 4) {
      line(ctx, -2 * wf, y, 2 * wf, y + 3, 0.7)
      line(ctx, 2 * wf, y, -2 * wf, y + 3, 0.7)
    }
  }

  // 頭の上で輪を作る腕（アン・クーロンヌ）。顔が奥を向くと腕が手前になる
  const arms = () => {
    ctx.strokeStyle = C.skin
    ctx.lineWidth = 3.6
    for (const d of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(d * 8.5 * wf, -27)
      ctx.quadraticCurveTo(d * 22 * ax, -38, d * 18 * ax, -52)
      ctx.quadraticCurveTo(d * 13 * ax, -64, d * 3.5 * ax, -66)
      ctx.stroke()
      ctx.fillStyle = C.skin
      ctx.beginPath()
      ctx.ellipse(d * 2.5 * ax, -66.3, 2.4, 1.6, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  if (c < 0) arms()
  headFront(ctx, c, s)
  if (c >= 0) arms()
  ctx.restore()
}

function headFront(ctx: CanvasRenderingContext2D, c: number, s: number): void {
  const r = 8.5
  const cx = s * 1.5
  const cy = -43
  const bunAt = () => {
    bun(ctx, cx - s * 6.5, cy - 7)
    flower(ctx, cx - s * 3, cy - 10)
  }
  if (c >= 0) bunAt()

  ctx.fillStyle = C.skin
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = C.hair
  if (c > 0.05) {
    // 真ん中分けの生え際
    const a0 = Math.PI * 0.95
    ctx.beginPath()
    ctx.arc(cx, cy, r + 0.6, a0, Math.PI * 2.05)
    ctx.quadraticCurveTo(cx + 5, cy - 5, cx + s * 3, cy - 7)
    ctx.quadraticCurveTo(cx - 5, cy - 5, cx + (r + 0.6) * Math.cos(a0), cy + (r + 0.6) * Math.sin(a0))
    ctx.fill()

    const fx = cx + s * 2.5
    ctx.strokeStyle = C.lash
    ctx.lineWidth = 1.1
    ctx.fillStyle = C.blush
    for (const d of [-1, 1]) {
      ctx.beginPath()
      ctx.arc(fx + d * 3.3 * c, cy, 1.9, Math.PI * 0.15, Math.PI * 0.85)
      ctx.stroke()
      ctx.beginPath()
      ctx.ellipse(fx + d * 4.6 * c, cy + 3, 2.2, 1.4, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = C.lip
    ctx.beginPath()
    ctx.arc(fx, cy + 4.6, 0.95, 0, Math.PI * 2)
    ctx.fill()
  } else {
    ctx.beginPath()
    ctx.arc(cx, cy, r + 0.6, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = C.hairLight
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.arc(cx, cy, r - 2, Math.PI * 1.2, Math.PI * 1.6)
    ctx.stroke()
  }
  if (c < 0) bunAt()
}
