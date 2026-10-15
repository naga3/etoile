/**
 * 音。ブラウザの中で合成して鳴らすので、音のファイルは使わない。
 * ブラウザは画面に触れるまで音を出させないので、最初の操作で unlock() を呼ぶ。
 */
import { type Inst, type Song } from './songs'

const MUTE_KEY = 'tiara-muted'
const LOOKAHEAD = 0.2 // 何秒先まで予約しておくか
const VOLUME = 0.8

let ctx: AudioContext | null = null
let master: GainNode
let musicBus: GainNode
let sfxBus: GainNode
let muted = localStorage.getItem(MUTE_KEY) === '1'

interface Ev { beat: number; dur: number; midi: number; inst: Inst; vol: number }
interface Playing {
  song: Song
  out: GainNode
  intro: Ev[]
  loop: Ev[]
  /** 予約済みの位置。inIntro の間は前奏の列、それ以降は繰り返しの列を指す */
  inIntro: boolean
  index: number
  /** いま読んでいる列の 0 拍目の時刻 */
  base: number
}
let current: Playing | null = null
let ground = 0

const freq = (m: number) => 440 * 2 ** ((m - 69) / 12)

export function isMuted(): boolean {
  return muted
}

export function toggleMute(): void {
  muted = !muted
  localStorage.setItem(MUTE_KEY, muted ? '1' : '0')
  if (ctx) master.gain.setTargetAtTime(muted ? 0 : VOLUME, ctx.currentTime, 0.05)
}

export function unlock(): void {
  if (ctx) {
    if (ctx.state === 'suspended') void ctx.resume()
    return
  }
  ctx = new AudioContext()
  master = ctx.createGain()
  master.gain.value = muted ? 0 : VOLUME
  master.connect(ctx.destination)

  const reverb = ctx.createConvolver()
  reverb.buffer = impulse(ctx, 2.4)
  const wet = ctx.createGain()
  wet.gain.value = 0.32
  reverb.connect(wet).connect(master)

  musicBus = ctx.createGain()
  musicBus.gain.value = 0.7
  sfxBus = ctx.createGain()
  sfxBus.gain.value = 0.9
  for (const bus of [musicBus, sfxBus]) {
    bus.connect(master)
    bus.connect(reverb)
  }
  window.setInterval(tick, 50)
}

/** 曲を替える。いまの曲は 1 秒かけて消える */
export function playSong(song: Song | null): void {
  if (!ctx || current?.song === song) return
  if (current) {
    const old = current.out
    old.gain.setTargetAtTime(0, ctx.currentTime, 0.35)
    window.setTimeout(() => old.disconnect(), 2500)
    current = null
  }
  if (!song) return
  const out = ctx.createGain()
  out.connect(musicBus)
  const flat = (from: number, to: number, shift: number) => {
    const evs: Ev[] = []
    for (const p of song.parts) {
      for (const [beat, dur, midi] of p.notes) {
        if (beat >= from && beat < to) evs.push({ beat: beat - shift, dur, midi, inst: p.inst, vol: p.vol })
      }
    }
    return evs.sort((a, b) => a.beat - b.beat)
  }
  current = {
    song,
    out,
    intro: flat(0, song.intro, 0),
    loop: flat(song.intro, song.intro + song.loop, song.intro),
    inIntro: song.intro > 0,
    index: 0,
    base: ctx.currentTime + 0.1,
  }
  tick()
}

function tick() {
  if (!ctx || !current) return
  const p = current
  const spb = 60 / p.song.bpm
  const now = ctx.currentTime
  // 裏のタブにいた間に遅れた分は鳴らさずに飛ばす
  for (let guard = 0; guard < 2000; guard++) {
    const list = p.inIntro ? p.intro : p.loop
    if (p.index >= list.length) {
      p.base += (p.inIntro ? p.song.intro : p.song.loop) * spb
      p.inIntro = false
      p.index = 0
      continue
    }
    const ev = list[p.index]
    const t = p.base + ev.beat * spb
    if (t > now + LOOKAHEAD) break
    if (t >= now - 0.05) voice(ev.inst, p.out, Math.max(t, now), ev.midi, ev.dur * spb, ev.vol)
    p.index++
  }
}

// --- 楽器 ---

function voice(inst: Inst, dest: AudioNode, t: number, midi: number, dur: number, vol: number): void {
  if (!ctx) return
  const f = freq(midi)
  const g = ctx.createGain()
  g.connect(dest)
  const osc = (type: OscillatorType, fr: number, gain: number, decay?: number) => {
    const o = ctx!.createOscillator()
    o.type = type
    o.frequency.value = fr
    const og = ctx!.createGain()
    og.gain.setValueAtTime(gain, t)
    if (decay) og.gain.exponentialRampToValueAtTime(0.0001, t + decay)
    o.connect(og).connect(g)
    return o
  }
  let end: number
  const oscs: OscillatorNode[] = []

  if (inst === 'bell') {
    // チェレスタ風：基音に、すぐ消える高い倍音を重ねる
    end = t + Math.max(dur, 0.12) + 0.9
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(vol, t + 0.004)
    g.gain.exponentialRampToValueAtTime(vol * 0.35, t + 0.3)
    g.gain.exponentialRampToValueAtTime(0.0001, end)
    oscs.push(osc('sine', f, 1), osc('sine', f * 2, 0.16, 0.6), osc('sine', f * 4.02, 0.2, 0.12))
  } else if (inst === 'pluck') {
    // ピチカート
    end = t + Math.min(dur, 0.6) + 0.25
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 1100
    g.disconnect()
    g.connect(lp).connect(dest)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006)
    g.gain.exponentialRampToValueAtTime(vol * 0.25, t + 0.18)
    g.gain.exponentialRampToValueAtTime(0.0001, end)
    oscs.push(osc('triangle', f, 1), osc('sine', f * 2, 0.3, 0.15))
  } else if (inst === 'harp') {
    end = t + Math.max(dur, 0.3) + 1
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(vol, t + 0.005)
    g.gain.exponentialRampToValueAtTime(0.0001, end)
    oscs.push(osc('triangle', f, 1), osc('sine', f * 3, 0.12, 0.25))
  } else {
    // 弦の和音
    end = t + dur + 0.5
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 1500
    g.disconnect()
    g.connect(lp).connect(dest)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(vol, t + Math.min(0.25, dur * 0.4))
    g.gain.setValueAtTime(vol, t + dur)
    g.gain.linearRampToValueAtTime(0.0001, end)
    oscs.push(osc('sawtooth', f * 1.003, 0.5), osc('sawtooth', f * 0.997, 0.5))
  }
  for (const o of oscs) {
    o.start(t)
    o.stop(end + 0.05)
  }
}

function impulse(c: AudioContext, seconds: number): AudioBuffer {
  const len = Math.floor(c.sampleRate * seconds)
  const buf = c.createBuffer(2, len, c.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3
  }
  return buf
}

// --- 効果音 ---

function scaleNote(i: number): number {
  const s = current?.song.scale ?? [84, 86, 88, 91, 93]
  return s[i % s.length] + 12 * Math.floor(i / s.length)
}

/**
 * きらっと光る短い音。旋律より 1 オクターブ上で、少し下から音程をすくい上げ、
 * すぐ消える。5 度上の小さなこだまをつけ、左右にも散らして曲と重ならないようにする。
 */
function sparkle(t: number, midi: number, vol: number): void {
  if (!ctx) return
  const pan = ctx.createStereoPanner()
  pan.pan.value = Math.random() * 0.6 - 0.3
  pan.connect(sfxBus)
  const ping = (at: number, f: number, v: number, len: number) => {
    const g = ctx!.createGain()
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(v, at + 0.002)
    g.gain.exponentialRampToValueAtTime(0.0001, at + len)
    g.connect(pan)
    for (const [mul, gain] of [[1, 1], [2, 0.25]]) {
      const o = ctx!.createOscillator()
      o.frequency.setValueAtTime(f * mul * 0.94, at)
      o.frequency.exponentialRampToValueAtTime(f * mul, at + 0.015)
      const og = ctx!.createGain()
      og.gain.value = gain
      o.connect(og).connect(g)
      o.start(at)
      o.stop(at + len + 0.02)
    }
  }
  const f = freq(midi + 12)
  ping(t, f, vol, 0.14)
  ping(t + 0.05, f * 1.5, vol * 0.45, 0.1)
}

/** ティアラを取った。空中で続けて取るほど音が上がる */
export function collectSound(combo: number): void {
  if (!ctx) return
  const i = combo > 0 ? Math.min(combo - 1, 9) : ground++ % 3
  sparkle(ctx.currentTime, scaleNote(i), 0.16)
}

/** 跳んだ。ためた分だけ竪琴が駆け上がる */
export function jumpSound(power: number): void {
  if (!ctx) return
  const n = 3 + Math.round(power * 5)
  for (let k = 0; k < n; k++) voice('harp', sfxBus, ctx.currentTime + k * 0.03, scaleNote(k) - 24, 0.2, 0.1)
}

/** 弧を全部取った */
export function bravaSound(): void {
  if (!ctx) return
  for (let k = 0; k < 4; k++) sparkle(ctx.currentTime + 0.08 + k * 0.06, scaleNote([0, 2, 4, 5][k]), 0.12)
}
