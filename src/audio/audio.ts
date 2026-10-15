/**
 * 音。ブラウザの中で合成して鳴らすので、音のファイルは使わない。
 * ブラウザは画面に触れるまで音を出させないので、最初の操作で unlock() を呼ぶ。
 */
import { type Inst, type Song } from './songs'

const MUTE_KEY = 'tiara-muted'
const VOLUME = 0.8
const REVERB = 2.4 // 残響の長さ（秒）
const SONG_RATE = 24000 // 書き出す曲のサンプリング周波数。高い倍音まで足りて、メモリは半分ですむ
const SONG_HEAD = 4 // 前の周の余韻が消えきるまでの秒数。2 周目の頭をこの長さだけ書き足す
const SEAM = 0.02 // つなぎ目で混ぜ合わせる長さ（秒）

let ctx: AudioContext | null = null
let master: GainNode
let musicBus: GainNode
let sfxBus: GainNode
let muted = localStorage.getItem(MUTE_KEY) === '1'

interface Playing { song: Song; out: GainNode; src?: AudioBufferSourceNode }
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

  // その場で鳴らす残響は効果音だけに使う。曲の残響は書き出しに含める
  const reverb = ctx.createConvolver()
  reverb.buffer = impulse(ctx, REVERB)
  const wet = ctx.createGain()
  wet.gain.value = 0.32
  reverb.connect(wet).connect(master)

  musicBus = ctx.createGain()
  musicBus.gain.value = 0.7
  musicBus.connect(master)
  sfxBus = ctx.createGain()
  sfxBus.gain.value = 0.9
  sfxBus.connect(master)
  sfxBus.connect(reverb)
}

// --- 曲 ---
// スマホでは、その場で何十もの音を合成すると計算が追いつかず音が途切れる。
// そこで曲はあらかじめ音の波形に書き出し、それを繰り返し再生する。

const rendered = new Map<Song, Promise<AudioBuffer>>()

/**
 * 繰り返す区間。1 周目の頭から SONG_HEAD 秒ずらすと、区間の頭と終わりがどちらも
 * 「前の周の余韻が消えた後の同じ位置」になり、つなぎ目で響きが途切れない。
 */
function loopPoints(song: Song): [number, number] {
  const spb = 60 / song.bpm
  return [song.intro * spb + SONG_HEAD, (song.intro + song.loop) * spb + SONG_HEAD]
}

/** 曲を書き出す。前奏と 1 周、それに 2 周目の頭 SONG_HEAD 秒。旋律に左右の広がりはないので 1 チャンネル */
function renderSong(song: Song): Promise<AudioBuffer> {
  const spb = 60 / song.bpm
  const [, end] = loopPoints(song)
  const off = new OfflineAudioContext(1, Math.ceil(end * SONG_RATE), SONG_RATE)
  const dry = off.createGain()
  dry.connect(off.destination)
  const reverb = off.createConvolver()
  reverb.buffer = impulse(off, REVERB)
  const wet = off.createGain()
  wet.gain.value = 0.32
  dry.connect(reverb)
  reverb.connect(wet).connect(off.destination)
  for (const p of song.parts) {
    for (const [beat, dur, midi] of p.notes) {
      voice(off, p.inst, dry, beat * spb, midi, dur * spb, p.vol)
      if (beat >= song.intro && (beat - song.intro) * spb < SONG_HEAD) {
        voice(off, p.inst, dry, (beat + song.loop) * spb, midi, dur * spb, p.vol)
      }
    }
  }
  return off.startRendering().then((buf) => smoothSeam(buf, song))
}

/**
 * つなぎ目の段差を消す。区間の終わり SEAM 秒を、区間の頭の直前の波形へ少しずつ混ぜ替える。
 * 終わりの一点が頭の直前とそろうので、頭へ戻った瞬間に音が飛ばない。
 */
function smoothSeam(buf: AudioBuffer, song: Song): AudioBuffer {
  const [start, end] = loopPoints(song)
  const a = Math.round(start * buf.sampleRate)
  const b = Math.min(buf.length, Math.round(end * buf.sampleRate))
  const n = Math.round(SEAM * buf.sampleRate)
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const d = buf.getChannelData(ch)
    for (let i = 0; i < n; i++) {
      const w = (i + 1) / n
      d[b - n + i] = d[b - n + i] * (1 - w) + d[a - n + i] * w
    }
  }
  return buf
}

/** 書き出した曲は取っておく（全曲で 15MB ほど） */
function songBuffer(song: Song): Promise<AudioBuffer> {
  let b = rendered.get(song)
  if (!b) {
    b = renderSong(song)
    rendered.set(song, b)
  }
  return b
}

/** 次に使う曲を先に書き出しておく。書き出しは音を出さないので、画面に触れる前から始めてよい */
export function prepareSong(song: Song | undefined): void {
  if (song) void songBuffer(song)
}

/** 曲を替える。いまの曲は 1 秒ほどかけて消える */
export function playSong(song: Song | null): void {
  if (!ctx || current?.song === song) return
  const now = ctx.currentTime
  if (current) {
    current.out.gain.setTargetAtTime(0, now, 0.35)
    current.src?.stop(now + 2.5)
    current = null
  }
  if (!song) return
  const playing: Playing = { song, out: ctx.createGain() }
  playing.out.connect(musicBus)
  current = playing
  void songBuffer(song).then((buf) => {
    if (!ctx || current !== playing) return
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.loop = true
    ;[src.loopStart, src.loopEnd] = loopPoints(song)
    src.connect(playing.out)
    src.start()
    playing.src = src
  })
}

// --- 楽器 ---

function voice(c: BaseAudioContext, inst: Inst, dest: AudioNode, t: number, midi: number, dur: number, vol: number): void {
  const f = freq(midi)
  const g = c.createGain()
  g.connect(dest)
  const osc = (type: OscillatorType, fr: number, gain: number, decay?: number) => {
    const o = c.createOscillator()
    o.type = type
    o.frequency.value = fr
    const og = c.createGain()
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
    const lp = c.createBiquadFilter()
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
    const lp = c.createBiquadFilter()
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

function impulse(c: BaseAudioContext, seconds: number): AudioBuffer {
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
  for (let k = 0; k < n; k++) voice(ctx, 'harp', sfxBus, ctx.currentTime + k * 0.03, scaleNote(k) - 24, 0.2, 0.1)
}

/** 弧を全部取った */
export function bravaSound(): void {
  if (!ctx) return
  for (let k = 0; k < 4; k++) sparkle(ctx.currentTime + 0.08 + k * 0.06, scaleNote([0, 2, 4, 5][k]), 0.12)
}
