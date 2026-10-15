import { setupStage } from './common/canvas'
import { startLoop } from './common/game-loop'
import { setupHold } from './common/input'
import { loadBest, saveBest } from './common/storage'
import {
  BODY_C, CHARGE_TIME, COLLECT_R, DANCER_X, FLOOR_Y, LAND_TIME, STRIDE, VIEW_H as H, VIEW_W as W,
  flightTime, jumpHeight, liftAt, turnsFor,
} from './constants'
import { buildCourse } from './course'
import { type Pose, drawDancer } from './art/dancer'
import {
  SERIF, drawBackdrop, drawFloor, drawFootlights, drawMainCurtain, drawSets, makeProscenium, moodAt,
} from './art/scene'
import { blitTiara, drawTiara, makeTiaraSprite, sparkle, starPath } from './art/tiara'
import { bravaSound, collectSound, isMuted, jumpSound, playSong, toggleMute, unlock } from './audio/audio'
import { ACT_SONGS, MUSIC_BOX } from './audio/songs'

const canvas = document.getElementById('game') as HTMLCanvasElement
const stage = setupStage(canvas, W, H)
const ctx = stage.ctx

const BEST_KEY = 'tiara-best-v2'
const course = buildCourse()
const total = course.tiaras.length
const tiaraSprite = makeTiaraSprite()
const proscenium = makeProscenium()

// 踊り手はいったん別のキャンバスに描き、本体と床の映り込みの両方に使う
const DW = 240
const DH = 280
const DOX = 120
const DOY = 250
const dancerLayer = document.createElement('canvas')
const dctx = dancerLayer.getContext('2d')!

// --- 状態 ---
type Phase = 'title' | 'opening' | 'play' | 'bow' | 'closing' | 'result'

interface Particle {
  x: number; y: number; vx: number; vy: number; life: number; max: number
  size: number; color: string; kind: 'spark' | 'petal'; rot: number; world: boolean
}
interface Popup { x: number; y: number; text: string; life: number; big: boolean }
interface Flyer { x: number; y: number; t: number }

let phase: Phase = 'title'
let phaseT = 0
let time = 0
let curtain = 0

let wx = 0 // 踊り手の足元の x（ワールド）
let lift = 0 // 床から足までの高さ
let air = false
let airT = 0
let jumpP = 0
let jumpSpeed = 0
let takeoffX = 0
let charging = false
let power = 0
let held = false
let airPress = false // 空中で押した。押したまま着地すれば、すぐために入る
let walkPhase = 0
let landT = 0
let combo = 0
let count = 0
let actIdx = 0
let bannerT = 99
let camLock = 0
let hudBump = 0
let best = loadBest(BEST_KEY)
let newBest = false
let particles: Particle[] = []
let popups: Popup[] = []
let flyers: Flyer[] = []

const ease = (t: number) => t * t * (3 - 2 * t)
const clamp01 = (t: number) => Math.max(0, Math.min(1, t))

function actAt(x: number): number {
  let i = 0
  while (i + 1 < course.acts.length && course.acts[i + 1].x <= x) i++
  return i
}
const speedAt = (x: number) => course.acts[actAt(x)].speed

/** 幕の番号を小数で返す。変わり目の 500px で色を混ぜる */
function actFloat(x: number): number {
  let f = 0
  for (let i = 1; i < course.acts.length; i++) f += ease(clamp01((x - course.acts[i].x + 250) / 500))
  return f
}

const camX = () => (phase === 'bow' || phase === 'closing' || phase === 'result' ? camLock : wx - DANCER_X)

function go(p: Phase) {
  phase = p
  phaseT = 0
}

function reset() {
  for (const t of course.tiaras) t.collected = false
  for (const g of course.groups) g.got = 0
  wx = 0
  lift = 0
  air = false
  charging = false
  power = 0
  airPress = false
  walkPhase = 0
  landT = 0
  combo = 0
  count = 0
  actIdx = 0
  bannerT = 99
  newBest = false
  particles = []
  popups = []
  flyers = []
}

// --- 入力 ---
function press() {
  held = true
  unlock()
  if (phase === 'title') { open(); return }
  if (phase === 'result') {
    if (phaseT > 0.8) {
      reset()
      open()
    }
    return
  }
  if (phase !== 'play') return
  if (air) airPress = true
  else if (!charging) startCharge()
}

function release() {
  held = false
  airPress = false
  if (charging) jump()
}

/** 幕を開け、序曲を始める */
function open() {
  go('opening')
  playSong(ACT_SONGS[0])
}

// 左上の音のボタン
const MUTE_BTN = { x: 30, y: 21, r: 18 }
function hitMute(cx: number, cy: number): boolean {
  const p = stage.toView(cx, cy)
  if (Math.hypot(p.x - MUTE_BTN.x, p.y - MUTE_BTN.y) > MUTE_BTN.r) return false
  toggleMute()
  return true
}

setupHold(canvas, press, release, hitMute)
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyM' && !e.repeat) toggleMute()
})

function startCharge() {
  charging = true
  power = 0
}

function jump() {
  charging = false
  air = true
  airT = 0
  jumpP = power
  jumpSound(power)
  takeoffX = wx
  jumpSpeed = speedAt(wx)
  combo = 0
}

function land(T: number) {
  wx = takeoffX + jumpSpeed * T
  lift = 0
  air = false
  landT = LAND_TIME
  combo = 0
  for (let i = 0; i < 6; i++) {
    const d = i < 3 ? -1 : 1
    particles.push({
      x: wx + d * 6, y: FLOOR_Y - 2, vx: d * (40 + Math.random() * 50), vy: -20 - Math.random() * 30,
      life: 0, max: 0.35, size: 2, color: '#fff3e6', kind: 'spark', rot: 0, world: true,
    })
  }
  if (held && airPress) {
    airPress = false
    startCharge()
  }
}

// --- 更新 ---
function update(dt: number) {
  time += dt
  phaseT += dt
  bannerT += dt
  hudBump = Math.max(0, hudBump - dt * 4)

  switch (phase) {
    case 'opening':
      curtain = ease(clamp01(phaseT / 1.2))
      if (phaseT >= 1.2) {
        go('play')
        bannerT = 0
      }
      break
    case 'play':
      play(dt)
      break
    case 'bow':
      bow(dt)
      break
    case 'closing':
      curtain = 1 - ease(clamp01(phaseT / 1.1))
      if (phaseT >= 1.1) finish()
      break
  }
  if ((phase === 'bow' && phaseT > 1) || phase === 'closing' || phase === 'result') {
    if (Math.random() < dt * 24) petal()
  }
  updateEffects(dt)
}

function play(dt: number) {
  if (charging) {
    // ためている間は時間が止まる。踏み切りの位置と力だけを考えればよい
    power = Math.min(1, power + dt / CHARGE_TIME)
    if (Math.random() < dt * 40 * (0.3 + power)) chargeSpark()
    return
  }
  if (air) {
    airT += dt
    const T = flightTime(jumpP)
    if (airT >= T) land(T)
    else {
      wx = takeoffX + jumpSpeed * airT
      lift = liftAt(jumpP, airT)
    }
  } else {
    const v = speedAt(wx)
    wx += v * dt
    walkPhase += v * dt * STRIDE
    landT = Math.max(0, landT - dt)
  }
  collect()
  const i = actAt(wx)
  if (i !== actIdx) {
    actIdx = i
    bannerT = 0
    playSong(ACT_SONGS[i])
  }
  if (!air && wx >= course.goalX) {
    camLock = wx - DANCER_X
    go('bow')
  }
}

/** ゴールの後、歩みをゆるめて正面を向き、腕を上げる */
function bow(dt: number) {
  const v = speedAt(wx) * Math.max(0, 1 - phaseT)
  wx += v * dt
  walkPhase += v * dt * STRIDE
  if (phaseT >= 2.8) go('closing')
}

function finish() {
  go('result')
  playSong(MUSIC_BOX)
  newBest = count > best
  if (newBest) {
    best = count
    saveBest(BEST_KEY, best)
  }
}

function collect() {
  const cy = FLOOR_Y - BODY_C - lift
  const cam = camX()
  for (const t of course.tiaras) {
    if (t.collected || Math.abs(t.x - wx) > COLLECT_R) continue
    if ((t.x - wx) ** 2 + (t.y - cy) ** 2 > COLLECT_R ** 2) continue
    t.collected = true
    count++
    const g = course.groups[t.group]
    g.got++
    burst(t.x, t.y)
    flyers.push({ x: t.x - cam, y: t.y, t: 0 })
    if (air) {
      combo++
      if (combo >= 2) popups.push({ x: t.x, y: t.y - 24, text: `×${combo}`, life: 0, big: false })
    }
    collectSound(air ? combo : 0)
    if (g.kind === 'arc' && g.got === g.total) {
      bravaSound()
      popups.push({ x: t.x, y: t.y - 52, text: 'Brava!', life: 0, big: true })
      for (let i = 0; i < 2; i++) burst(t.x, t.y)
    }
  }
}

// --- 演出 ---
function burst(x: number, y: number) {
  for (let i = 0; i < 10; i++) {
    const a = Math.random() * Math.PI * 2
    const s = 60 + Math.random() * 130
    particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, max: 0.45 + Math.random() * 0.3,
      size: 3 + Math.random() * 3.5, color: Math.random() < 0.5 ? '#fff6c8' : '#ffd36b',
      kind: 'spark', rot: Math.random() * Math.PI, world: true,
    })
  }
}

function chargeSpark() {
  const a = Math.random() * Math.PI * 2
  const r = 50 + Math.random() * 20
  particles.push({
    x: wx + Math.cos(a) * r, y: FLOOR_Y - BODY_C + Math.sin(a) * r * 0.8,
    vx: -Math.cos(a) * r * 2.2, vy: -Math.sin(a) * r * 1.76, life: 0, max: 0.42,
    size: 2.6, color: '#ffe9a8', kind: 'spark', rot: 0, world: true,
  })
}

const PETALS = ['#ff8fb1', '#ffc2d4', '#ff6f9a', '#fff0f5']
function petal() {
  particles.push({
    x: Math.random() * W, y: -10, vx: -10 + Math.random() * 30, vy: 45 + Math.random() * 45, life: 0, max: 14,
    size: 4 + Math.random() * 3, color: PETALS[(Math.random() * PETALS.length) | 0], kind: 'petal',
    rot: Math.random() * Math.PI * 2, world: false,
  })
}

function updateEffects(dt: number) {
  for (const p of particles) {
    p.life += dt
    p.x += p.vx * dt
    p.y += p.vy * dt
    if (p.kind === 'spark') {
      p.vx *= 1 - 3 * dt
      p.vy *= 1 - 3 * dt
      p.rot += dt * 4
    } else {
      p.x += Math.sin(time * 2 + p.rot) * 24 * dt
      p.rot += dt * 2
    }
  }
  particles = particles.filter((p) => p.life < p.max && p.y < H + 20)
  for (const u of popups) {
    u.life += dt
    u.y -= 28 * dt
  }
  popups = popups.filter((u) => u.life < 1.1)
  for (const f of flyers) {
    f.t += dt * 2.2
    if (f.t >= 1) hudBump = 1
  }
  flyers = flyers.filter((f) => f.t < 1)
}

// --- 描画 ---
function currentPose(): Pose {
  if (phase === 'bow' || phase === 'closing' || phase === 'result') {
    if (phase === 'bow' && phaseT < 1) return { kind: 'run', phase: walkPhase }
    const t = phase === 'bow' ? ease(clamp01((phaseT - 1) / 0.5)) : 1
    return { kind: 'turn', angle: (Math.PI / 2) * (1 - t), passe: 0 }
  }
  if (phase === 'title' || phase === 'opening') return { kind: 'plie', depth: 0, arms: 0 }
  if (charging) return { kind: 'plie', depth: 0.3 + 0.7 * power, arms: power }
  if (air) {
    // 右向きで踏み切り、何回か回って、また右向きで降りる
    const T = flightTime(jumpP)
    const angle = Math.PI / 2 + Math.PI * 2 * turnsFor(jumpP) * ease(clamp01(airT / T))
    return { kind: 'turn', angle, passe: Math.min(1, airT / 0.1, (T - airT) / 0.1) }
  }
  if (landT > 0) return { kind: 'plie', depth: (landT / LAND_TIME) * 0.6, arms: 0.3 }
  return { kind: 'run', phase: walkPhase }
}

function renderDancer() {
  const k = Math.min(3, stage.ratio())
  const w = Math.ceil(DW * k)
  const h = Math.ceil(DH * k)
  if (dancerLayer.width !== w || dancerLayer.height !== h) {
    dancerLayer.width = w
    dancerLayer.height = h
  }
  dctx.setTransform(1, 0, 0, 1, 0, 0)
  dctx.clearRect(0, 0, w, h)
  dctx.setTransform(k, 0, 0, k, DOX * k, DOY * k)
  drawDancer(dctx, currentPose())
}

function draw() {
  stage.begin('#140a10')
  const cam = camX()
  const mood = moodAt(actFloat(wx))
  const dsx = wx - cam
  const feetY = FLOOR_Y - lift

  drawBackdrop(ctx, cam, mood, time)
  drawSets(ctx, cam, mood)
  drawFloor(ctx, cam, mood)

  renderDancer()
  // 床への映り込み
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, FLOOR_Y, W, H - FLOOR_Y)
  ctx.clip()
  ctx.globalAlpha = 0.22 * Math.max(0, 1 - lift / 300)
  ctx.translate(0, 2 * FLOOR_Y)
  ctx.scale(1, -1)
  ctx.drawImage(dancerLayer, dsx - DOX, feetY - DOY, DW, DH)
  ctx.restore()

  drawMarks(cam)
  drawGoal(course.goalX + 260 - cam)
  drawDarkness(mood.dark, dsx, feetY)
  drawSpotlight(dsx)

  for (const t of course.tiaras) {
    if (t.collected) continue
    const x = t.x - cam
    if (x < -30 || x > W + 30) continue
    drawTiara(ctx, tiaraSprite, x, t.y, time, t.x * 0.013)
  }
  if (charging) drawGuide(dsx)

  // 足元の影とためのきらめき
  ctx.fillStyle = `rgba(60,20,30,${0.25 * Math.max(0, 1 - lift / 300)})`
  ctx.beginPath()
  ctx.ellipse(dsx, FLOOR_Y + 2, 26 * Math.max(0.4, 1 - lift / 500), 4, 0, 0, Math.PI * 2)
  ctx.fill()
  if (charging) {
    const pulse = power >= 1 ? 0.15 * Math.sin(time * 14) : 0
    ctx.strokeStyle = `rgba(255,220,130,${0.35 + 0.4 * power + pulse})`
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.ellipse(dsx, FLOOR_Y + 1, 22 + 26 * power, 4 + 3 * power, 0, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.drawImage(dancerLayer, dsx - DOX, feetY - DOY, DW, DH)

  drawParticles(cam, true)
  drawPopups(cam)
  drawFlyers()

  drawMainCurtain(ctx, curtain)
  drawFootlights(ctx, time)
  ctx.drawImage(proscenium, 0, 0, W, H)
  if (phase !== 'title' && phase !== 'result') drawHud()
  drawMuteButton()
  drawBanner()
  drawParticles(cam, false)
  if (phase === 'title') drawTitle()
  if (phase === 'result') drawResult()

  stage.screen()
  const win = stage.window()
  if (win.h > win.w) {
    ctx.fillStyle = 'rgba(255,230,200,0.75)'
    ctx.font = `15px ${SERIF}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('横向きにすると大きく遊べます', win.w / 2, win.h - 48)
  }
}

/** 床の踏み切りの印（バミリ） */
function drawMarks(cam: number) {
  for (const m of course.marks) {
    const x = m - cam
    if (x < -20 || x > W + 20) continue
    const near = Math.max(0, 1 - Math.abs(m - wx) / 160)
    ctx.save()
    ctx.translate(x, FLOOR_Y + 3)
    ctx.scale(1, 0.38)
    ctx.rotate(Math.PI / 4)
    ctx.fillStyle = `rgba(110,240,210,${0.7 + 0.3 * near})`
    ctx.fillRect(-11, -2.5, 22, 5)
    ctx.fillRect(-2.5, -11, 5, 22)
    ctx.restore()
  }
}

/** ゴールに立つ金の星 */
function drawGoal(x: number) {
  if (x < -80 || x > W + 80) return
  const sy = FLOOR_Y - 172
  const glow = ctx.createRadialGradient(x, sy, 0, x, sy, 80)
  glow.addColorStop(0, 'rgba(255,232,160,0.6)')
  glow.addColorStop(1, 'rgba(255,232,160,0)')
  ctx.fillStyle = glow
  ctx.fillRect(x - 80, sy - 80, 160, 160)
  ctx.strokeStyle = '#d9a940'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(x, FLOOR_Y)
  ctx.lineTo(x, sy + 20)
  ctx.stroke()
  ctx.fillStyle = '#b8862a'
  ctx.beginPath()
  ctx.ellipse(x, FLOOR_Y, 18, 5, 0, 0, Math.PI * 2)
  ctx.fill()
  // リボン
  ctx.strokeStyle = '#ff7aa2'
  ctx.lineWidth = 3
  for (const d of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(x, sy + 22)
    ctx.quadraticCurveTo(x + d * 18, sy + 34 + Math.sin(time * 3 + d) * 4, x + d * 12, sy + 56)
    ctx.stroke()
  }
  const g = ctx.createLinearGradient(0, sy - 28, 0, sy + 26)
  g.addColorStop(0, '#fff6cf')
  g.addColorStop(1, '#f0b835')
  ctx.fillStyle = g
  starPath(ctx, x, sy, 28, 12)
  ctx.fill()
  ctx.strokeStyle = '#a8741a'
  ctx.lineWidth = 1.2
  ctx.stroke()
  sparkle(ctx, x + 22 * Math.cos(time * 2), sy + 22 * Math.sin(time * 2), 6, time, 'rgba(255,255,255,0.9)')
}

/** 暗い幕では、踊り手のまわりだけ明るく残す */
function drawDarkness(dark: number, dsx: number, feetY: number) {
  if (dark < 0.01) return
  const cy = feetY - 50
  const g = ctx.createRadialGradient(dsx, cy, 70, dsx, cy, 460)
  g.addColorStop(0, 'rgba(8,6,30,0)')
  g.addColorStop(1, `rgba(8,6,30,${dark})`)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
}

function drawSpotlight(dsx: number) {
  const beam = ctx.createLinearGradient(0, 0, 0, FLOOR_Y + 10)
  beam.addColorStop(0, 'rgba(255,248,225,0.02)')
  beam.addColorStop(1, 'rgba(255,248,225,0.15)')
  ctx.fillStyle = beam
  ctx.beginPath()
  ctx.moveTo(dsx + 44, 0)
  ctx.lineTo(dsx + 96, 0)
  ctx.lineTo(dsx + 78, FLOOR_Y + 8)
  ctx.lineTo(dsx - 78, FLOOR_Y + 8)
  ctx.closePath()
  ctx.fill()
  ctx.save()
  ctx.translate(dsx, FLOOR_Y + 6)
  ctx.scale(1, 0.2)
  const pool = ctx.createRadialGradient(0, 0, 0, 0, 0, 90)
  pool.addColorStop(0, 'rgba(255,246,220,0.45)')
  pool.addColorStop(1, 'rgba(255,246,220,0)')
  ctx.fillStyle = pool
  ctx.fillRect(-90, -90, 180, 180)
  ctx.restore()
}

/** ためている間の目安。序盤は軌道を全部、後半は高さだけ見せる */
function drawGuide(dsx: number) {
  const act = course.acts[actIdx]
  const v = speedAt(wx)
  const apexY = FLOOR_Y - BODY_C - jumpHeight(power)
  if (act.guide === 'path') {
    const T = flightTime(power)
    ctx.fillStyle = 'rgba(255,250,225,0.85)'
    for (let i = 1; i < 24; i++) {
      const t = (T * i) / 24
      ctx.beginPath()
      ctx.arc(dsx + v * t, FLOOR_Y - BODY_C - liftAt(power, t), i % 2 ? 1.5 : 2.3, 0, Math.PI * 2)
      ctx.fill()
    }
    sparkle(ctx, dsx + (v * T) / 2, apexY, 9, time * 2, 'rgba(255,240,180,0.95)')
  } else {
    ctx.save()
    ctx.setLineDash([6, 8])
    const g = ctx.createLinearGradient(dsx, 0, dsx + 380, 0)
    g.addColorStop(0, 'rgba(255,240,200,0.7)')
    g.addColorStop(1, 'rgba(255,240,200,0)')
    ctx.strokeStyle = g
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(dsx, apexY)
    ctx.lineTo(dsx + 380, apexY)
    ctx.stroke()
    ctx.restore()
    sparkle(ctx, dsx, apexY, 9, time * 2, 'rgba(255,240,180,0.95)')
  }
}

function drawParticles(cam: number, world: boolean) {
  for (const p of particles) {
    if (p.world !== world) continue
    const a = p.kind === 'spark' ? 1 - p.life / p.max : 1
    const x = world ? p.x - cam : p.x
    ctx.globalAlpha = a
    if (p.kind === 'spark') {
      sparkle(ctx, x, p.y, p.size * (0.6 + 0.4 * a), p.rot, p.color)
    } else {
      ctx.save()
      ctx.translate(x, p.y)
      ctx.rotate(p.rot)
      ctx.scale(1, 0.45 + 0.4 * Math.sin(p.rot * 2))
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.ellipse(0, 0, p.size, p.size * 0.6, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
  }
  ctx.globalAlpha = 1
}

function drawPopups(cam: number) {
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const u of popups) {
    const a = u.life < 0.15 ? u.life / 0.15 : clamp01(1 - (u.life - 0.6) / 0.5)
    const s = u.big ? 1 + 0.35 * clamp01(1 - u.life / 0.2) : 1
    ctx.save()
    ctx.globalAlpha = a
    ctx.translate(u.x - cam, u.y)
    ctx.scale(s, s)
    ctx.font = u.big ? `italic bold 32px ${SERIF}` : `bold 18px ${SERIF}`
    ctx.lineWidth = 4
    ctx.strokeStyle = 'rgba(90,20,60,0.7)'
    ctx.strokeText(u.text, 0, 0)
    ctx.fillStyle = u.big ? '#ffe08a' : '#fff4d6'
    ctx.fillText(u.text, 0, 0)
    ctx.restore()
  }
}

const HUD_ICON = { x: 852, y: 20 }

/** 取ったティアラが右上の数へ飛んでいく */
function drawFlyers() {
  for (const f of flyers) {
    const t = ease(f.t)
    const x = f.x + (HUD_ICON.x - f.x) * t
    const y = f.y + (HUD_ICON.y - f.y) * t - Math.sin(t * Math.PI) * 40
    blitTiara(ctx, tiaraSprite, x, y, 1 - 0.3 * t)
  }
}

function drawHud() {
  const act = course.acts[actIdx]
  ctx.save()
  ctx.textBaseline = 'middle'
  ctx.shadowColor = 'rgba(40,0,10,0.8)'
  ctx.shadowBlur = 4
  ctx.fillStyle = '#f7d98a'
  ctx.textAlign = 'left'
  ctx.font = `bold 17px ${SERIF}`
  ctx.fillText(`${act.num}　${act.name}`, 70, 21)

  const k = 1 + hudBump * 0.3
  blitTiara(ctx, tiaraSprite, HUD_ICON.x, HUD_ICON.y + 2, 0.75 * k)
  ctx.font = `bold ${Math.round(22 * k)}px ${SERIF}`
  ctx.fillText(String(count), 874, 22)
  ctx.shadowBlur = 0

  // 進み具合。点は幕の頭
  const x0 = 380
  const x1 = 580
  const y = 16
  const prog = clamp01(wx / course.goalX)
  ctx.lineWidth = 2
  ctx.strokeStyle = 'rgba(255,225,160,0.3)'
  ctx.beginPath()
  ctx.moveTo(x0, y)
  ctx.lineTo(x1, y)
  ctx.stroke()
  ctx.strokeStyle = '#f7d98a'
  ctx.beginPath()
  ctx.moveTo(x0, y)
  ctx.lineTo(x0 + (x1 - x0) * prog, y)
  ctx.stroke()
  ctx.fillStyle = '#f7d98a'
  for (const a of course.acts) {
    ctx.beginPath()
    ctx.arc(x0 + ((x1 - x0) * a.x) / course.goalX, y, 2.5, 0, Math.PI * 2)
    ctx.fill()
  }
  sparkle(ctx, x1, y, 7, 0, '#ffe9a8')
  sparkle(ctx, x0 + (x1 - x0) * prog, y, 6, time * 2, '#ffffff')
  ctx.restore()
}

/** スピーカーの形。消音中は斜線を引く */
function drawMuteButton() {
  const { x, y } = MUTE_BTN
  ctx.save()
  ctx.translate(x, y)
  ctx.fillStyle = '#f7d98a'
  ctx.strokeStyle = '#f7d98a'
  ctx.lineWidth = 1.8
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(-9, -3.5)
  ctx.lineTo(-5, -3.5)
  ctx.lineTo(0, -8)
  ctx.lineTo(0, 8)
  ctx.lineTo(-5, 3.5)
  ctx.lineTo(-9, 3.5)
  ctx.closePath()
  ctx.fill()
  if (isMuted()) {
    ctx.beginPath()
    ctx.moveTo(4, -4)
    ctx.lineTo(10, 4)
    ctx.moveTo(10, -4)
    ctx.lineTo(4, 4)
    ctx.stroke()
  } else {
    for (const r of [5, 9]) {
      ctx.beginPath()
      ctx.arc(1, 0, r, -0.8, 0.8)
      ctx.stroke()
    }
  }
  ctx.restore()
}

function drawBanner() {
  if (phase !== 'play' || bannerT > 3) return
  const a = clamp01(Math.min(bannerT / 0.5, (3 - bannerT) / 0.7))
  const act = course.acts[actIdx]
  ctx.save()
  ctx.globalAlpha = a
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.shadowColor = 'rgba(50,10,40,0.7)'
  ctx.shadowBlur = 10
  ctx.fillStyle = '#fff1cf'
  ctx.font = `17px ${SERIF}`
  ctx.fillText(act.num, W / 2, 104)
  ctx.font = `bold 36px ${SERIF}`
  const y = 140 + (1 - a) * 6
  ctx.fillText(act.name, W / 2, y)
  const hw = ctx.measureText(act.name).width / 2 + 22
  ctx.shadowBlur = 0
  ctx.strokeStyle = '#f2cf7a'
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.moveTo(W / 2 - hw - 90, y)
  ctx.lineTo(W / 2 - hw, y)
  ctx.moveTo(W / 2 + hw, y)
  ctx.lineTo(W / 2 + hw + 90, y)
  ctx.stroke()
  sparkle(ctx, W / 2 - hw - 96, y, 5, 0, '#f2cf7a')
  sparkle(ctx, W / 2 + hw + 96, y, 5, 0, '#f2cf7a')
  ctx.restore()
}

function goldText(text: string, x: number, y: number, size: number) {
  ctx.font = `bold ${size}px ${SERIF}`
  const g = ctx.createLinearGradient(0, y - size / 2, 0, y + size / 2)
  g.addColorStop(0, '#fff6d0')
  g.addColorStop(0.55, '#ecbd4e')
  g.addColorStop(1, '#b98222')
  ctx.lineWidth = 5
  ctx.strokeStyle = 'rgba(60,0,15,0.6)'
  ctx.strokeText(text, x, y)
  ctx.fillStyle = g
  ctx.fillText(text, x, y)
}

function drawTitle() {
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  goldText('仮に咲くエトワール', W / 2, 205, 56)
  ctx.fillStyle = '#ffe9c4'
  ctx.font = `18px ${SERIF}`
  ctx.fillText('長押しで ためて、離して 跳ぶ', W / 2, 280)
  ctx.fillText('くるりと回って、ティアラを集めよう', W / 2, 310)
  ctx.globalAlpha = 0.55 + 0.45 * Math.sin(time * 3)
  ctx.font = `bold 19px ${SERIF}`
  ctx.fillText('タップ・クリック・スペースキーで開演', W / 2, 382)
  ctx.globalAlpha = 1
  if (best > 0) {
    ctx.font = `15px ${SERIF}`
    ctx.fillStyle = '#f2cf7a'
    ctx.fillText(`これまでの最高　${best} / ${total}`, W / 2, 436)
  }
  ctx.restore()
}

/** パリ・オペラ座の階級になぞらえた評価 */
function rankOf(n: number): string {
  const r = n / total
  if (r >= 0.95) return 'エトワール'
  if (r >= 0.8) return 'プルミエール・ダンスーズ'
  if (r >= 0.6) return 'スジェ'
  if (r >= 0.4) return 'コリフェ'
  return 'カドリーユ'
}

function drawResult() {
  ctx.save()
  ctx.globalAlpha = clamp01(phaseT / 0.5)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#ffe9c4'
  ctx.font = `18px ${SERIF}`
  ctx.fillText('— カーテンコール —', W / 2, 112)

  blitTiara(ctx, tiaraSprite, W / 2 - 92, 186, 1.5)
  ctx.textAlign = 'left'
  goldText(`${count}`, W / 2 - 58, 190, 52)
  const nw = ctx.measureText(`${count}`).width
  ctx.font = `22px ${SERIF}`
  ctx.fillStyle = '#ffe9c4'
  ctx.fillText(`/ ${total}`, W / 2 - 50 + nw, 196)

  ctx.textAlign = 'center'
  ctx.font = `15px ${SERIF}`
  ctx.fillText('あなたの位', W / 2, 258)
  goldText(rankOf(count), W / 2, 298, 38)
  ctx.font = `16px ${SERIF}`
  ctx.fillStyle = newBest ? '#ffe08a' : '#ffe9c4'
  ctx.fillText(newBest ? '新記録！' : `これまでの最高　${best}`, W / 2, 350)
  if (phaseT > 0.8) {
    ctx.globalAlpha = 0.55 + 0.45 * Math.sin(time * 3)
    ctx.font = `bold 18px ${SERIF}`
    ctx.fillStyle = '#ffe9c4'
    ctx.fillText('タップでもう一度', W / 2, 420)
  }
  ctx.restore()
}

startLoop(update, draw)
