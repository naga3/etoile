/**
 * 曲の譜面。旋律はチャイコフスキーのバレエ曲（パブリックドメイン）から写し、
 * 伴奏は和音だけを決めて、下の型（ワルツ・ズンチャ・アルペジオ）で組み立てる。
 * 音符は「拍:音名/長さ」で書く。拍は 4 分音符 1 つが 1。
 */
export type Inst = 'bell' | 'pluck' | 'harp' | 'pad'
export type Note = [beat: number, dur: number, midi: number]

export interface Part { inst: Inst; vol: number; notes: Note[] }
export interface Song {
  bpm: number
  /** 前奏の拍数。前奏は最初の一回だけで、そのあと loop 拍を繰り返す */
  intro: number
  loop: number
  parts: Part[]
  /** 効果音に使う音（その曲の調のペンタトニック） */
  scale: number[]
}

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export function midi(name: string): number {
  const m = /^([A-G]#?)(-?\d)$/.exec(name)
  if (!m) throw new Error(`bad note ${name}`)
  return NAMES.indexOf(m[1]) + 12 * (Number(m[2]) + 1)
}

/** "0:A#4/0.25 1:D#5/0.25 ..." を音符の列にする */
function notes(src: string, shift = 0, offset = 0): Note[] {
  return src.trim().split(/\s+/).map((tok) => {
    const [at, rest] = tok.split(':')
    const [name, dur] = rest.split('/')
    return [Number(at) + offset, Number(dur), midi(name) + shift]
  })
}

/** "低音|上の和音" を [低音, 和音] にする */
function chord(src: string): [number, number[]] {
  const [bass, upper] = src.split('|')
  return [midi(bass.trim()), upper.trim().split(/\s+/).map(midi)]
}

/** 3 拍子：1 拍目に低音、2・3 拍目に和音 */
function waltz(bars: string[]): { bass: Note[]; chords: Note[] } {
  const bass: Note[] = []
  const chords: Note[] = []
  bars.forEach((src, i) => {
    const [b, up] = chord(src)
    bass.push([i * 3, 1.2, b])
    for (const k of [1, 2]) for (const n of up) chords.push([i * 3 + k, 0.6, n])
  })
  return { bass, chords }
}

/** 2 拍子の行進：表拍に低音、裏拍に和音 */
function oompah(beats: string[]): { bass: Note[]; chords: Note[] } {
  const bass: Note[] = []
  const chords: Note[] = []
  beats.forEach((src, i) => {
    const [b, up] = chord(src)
    bass.push([i, 0.4, b])
    for (const n of up) chords.push([i + 0.5, 0.3, n])
  })
  return { bass, chords }
}

/** 和音を伸ばす弦と、8 分音符で上下する竪琴。halves は半小節（2 拍）ごとの和音 */
function arpeggio(halves: string[]): { pad: Note[]; harp: Note[] } {
  const pad: Note[] = []
  const harp: Note[] = []
  halves.forEach((src, i) => {
    const [b, up] = chord(src)
    const t = i * 2
    for (const n of up) pad.push([t, 2, n])
    const tones = [b + 12, ...up.map((n) => n + 12)]
    ;[0, 1, 2, 1].forEach((j, k) => harp.push([t + k * 0.5, 0.9, tones[j % tones.length]]))
  })
  return { pad, harp }
}

const pent = (...ns: string[]) => ns.map(midi)

// --- 開演前・カーテンコール：オルゴール（オリジナル） ---
const boxChords = ['C3|E4 G4', 'E3|G3 B3', 'F2|A3 C4', 'G2|B3 D4', 'C3|E4 G4', 'A2|C4 E4', 'D3|F4 A4', 'G2|B3 F4']
const box = waltz(boxChords)
export const MUSIC_BOX: Song = {
  bpm: 92,
  intro: 0,
  loop: 24,
  parts: [
    {
      inst: 'bell', vol: 0.32, notes: notes(`
        0:E5/1 1:G5/1 2:C6/1 3:B5/2 5:A5/1 6:A5/1 7:C6/1 8:F6/1 9:D6/2 11:B5/1
        12:E5/1 13:G5/1 14:C6/1 15:E6/2 17:C6/1 18:D6/1 19:F6/1 20:A5/1 21:B5/2 23:G5/1`),
    },
    { inst: 'harp', vol: 0.16, notes: box.bass },
    { inst: 'harp', vol: 0.08, notes: box.chords },
  ],
  scale: pent('C6', 'D6', 'E6', 'G6', 'A6'),
}

// --- 序曲：くるみ割り人形「小序曲」 変ロ長調 2/4 ---
const ovBeats = [
  'Bb', 'Eb', 'F7', 'Bb', 'Eb', 'F7', 'Bb', 'F7', 'Bb', 'Eb', 'F7', 'Bb', 'Eb', 'Bb', 'F7', 'Bb',
]
const OV: Record<string, string> = { Bb: 'A#2|D4 F4', Eb: 'D#3|G3 A#3', F7: 'F2|A3 C4 D#4' }
const ov = oompah([...ovBeats, ...ovBeats].map((c) => OV[c]))
export const OVERTURE: Song = {
  bpm: 112,
  intro: 0,
  loop: 32,
  parts: [
    {
      inst: 'bell', vol: 0.3, notes: notes(`
        0:A#4/0.25 1:D#5/0.25 1.75:D5/0.25 2:C5/0.5 2.5:G5/0.25 3:F5/0.25 3.5:A#4/0.25 4:D#5/0.5 4.5:D5/0.5
        5:C5/0.25 5.5:A#4/0.25 6:D5/1 7:C5/0.5 8:A#4/0.25 9:D#5/0.25 9.75:D5/0.25 10:C5/0.5 10.5:G5/0.25
        11:F5/0.25 11.5:A#5/0.5 12:G5/0.5 12.5:F5/0.25 13:D#5/0.25 13.5:D5/0.25 14:C5/0.25 14.5:D5/0.25
        15:A#4/0.25 16:A#4/0.25 17:D#5/0.25 17.75:D5/0.25 18:C5/0.5 18.5:G5/0.25 19:F5/0.25 19.5:A#4/0.25
        20:D#5/0.5 20.5:D5/0.5 21:C5/0.25 21.5:A#4/0.25 22:D5/1 23:C5/0.5 24:A#4/0.25 25:D#5/0.25
        25.75:D5/0.25 26:C5/0.5 26.5:G5/0.25 27:F5/0.25 27.5:A#5/0.5 28:G5/0.5 28.5:F5/0.25 29:D#5/0.25
        29.5:D5/0.25 30:C5/0.25 30.5:D5/0.25 31:A#4/0.25 31.5:D5/0.125 31.75:D5/0.125`, 12),
    },
    { inst: 'pluck', vol: 0.3, notes: ov.bass },
    { inst: 'pluck', vol: 0.1, notes: ov.chords },
  ],
  scale: pent('A#5', 'C6', 'D6', 'F6', 'G6'),
}

// --- 第一幕：くるみ割り人形「花のワルツ」 ニ長調 3/4 ---
const fl = waltz([
  'D2|F#3 A3', 'A2|C#4 G4', 'D2|F#3 A3', 'D2|F#3 A3', 'D2|F#3 A3', 'A2|C#4 G4', 'D2|F#3 A3', 'A2|C#4 G4',
  'B2|D#4 A4', 'E2|G3 B3', 'D2|F#3 C4', 'G2|B3 D4', 'F#2|A#3 E4', 'E2|G3 B3 C#4', 'F#2|A3 D4', 'A2|C#4 G4',
])
export const FLOWERS: Song = {
  bpm: 168,
  intro: 0,
  loop: 48,
  parts: [
    {
      inst: 'bell', vol: 0.3, notes: notes(`
        0:A5/1 1:D6/1 2:F#6/1 3:G6/2.75 5.75:F#6/0.25 6:F#6/6 12:A5/1 13:D6/1 14:F#6/1 15:G6/1 16:F#6/1.75
        17.75:E6/0.25 18:A6/2 20:D6/1 22:A5/0.5 22.5:B5/0.5 23:C#6/0.5 23.5:D6/0.5 24:D#6/0.5 24.5:F#6/0.5
        25:D#6/0.5 25.5:F#6/0.5 26:E6/0.5 28:C6/0.5 28.5:D6/0.5 29:D#6/0.5 29.5:E6/0.5 30:F#6/0.5 30.5:A6/0.5
        31:F#6/0.5 31.5:A6/0.5 32:G6/0.5 34:E6/0.5 34.5:F#6/0.5 35:G6/0.5 35.5:A6/0.5 36:A#6/0.5 36.5:C#7/0.5
        37:B6/0.5 37.5:A#6/0.5 38:B6/0.5 38.5:C#7/0.5 39:E7/0.5 39.5:D7/0.5 40:C#7/0.5 40.5:D7/0.5 41:B6/0.5
        41.5:G6/0.5 42:F#6/2 44:E6/1.5 45.5:D#6/0.5 46:D6/0.5 46.5:C#6/0.5 47:B5/0.5 47.5:A#5/0.5`, -12),
    },
    { inst: 'pluck', vol: 0.32, notes: fl.bass },
    { inst: 'harp', vol: 0.08, notes: fl.chords },
  ],
  scale: pent('D6', 'E6', 'F#6', 'A6', 'B6'),
}

// --- 第二幕：眠れる森の美女「ワルツ（花のワルツ／ガーランド・ワルツ）」 ヘ長調 3/4 ---
const ga = waltz([
  'F2|A3 C4', 'C2|E3 A3 C4', 'F2|A3 C4', 'C2|E3 A3 C4', 'G2|A#3 C4 E4', 'E2|A#3 C4', 'D#2|A#3 C4', 'E2|A#3 C4',
  'C2|E3 G3', 'D2|G3 B3', 'D#2|G3 C#4', 'E2|G3 A#3 C4', 'F2|A3 C4', 'C2|F3 A3', 'E2|G3 A#3 C4', 'C2|G3 A#3',
])
export const GARLAND: Song = {
  bpm: 176,
  intro: 0,
  loop: 48,
  parts: [
    {
      inst: 'bell', vol: 0.3, notes: notes(`
        0:F5/3 3:E5/3 6:F5/2 8:D5/1 9:E5/1 10:F5/1 11:D5/1 12:E5/2 14:G5/1 15:A5/2 17:F#5/1 18:G5/6
        24:C6/3 27:B5/3 30:A#5/2 32:G5/1 33:A#5/1 34:A5/1 35:G5/1 36:D6/2 38:C6/1 39:A#5/2 41:A5/1
        42:A5/1 43:G5/1 44:F#5/1 45:G5/1 46:D5/1 47:E5/1`),
    },
    { inst: 'pluck', vol: 0.3, notes: ga.bass },
    { inst: 'pad', vol: 0.05, notes: ga.chords },
  ],
  scale: pent('F6', 'G6', 'A6', 'C7', 'D7'),
}

// --- 第三幕：白鳥の湖「情景」 ロ短調 4/4 ---
const sw = arpeggio([
  'B2|D4 F#4', 'B2|D4 F#4', 'B2|D4 F#4', 'B2|D4 F#4', 'B2|D4 F#4', 'G2|B3 D4', 'B2|D4 F#4', 'F#2|A#3 C#4',
  'B2|D4 F#4', 'B2|D4 F#4', 'B2|D4 F#4', 'B2|D4 F#4', 'B2|D4 F#4', 'G2|B3 D4', 'B2|D4 F#4', 'B2|D4 F#4',
])
export const SWAN: Song = {
  bpm: 76,
  intro: 0,
  loop: 32,
  parts: [
    {
      inst: 'bell', vol: 0.34, notes: notes(`
        0:F#5/2 2:B4/0.5 2.5:C#5/0.5 3:D5/0.5 3.5:E5/0.5 4:F#5/1.5 5.5:D5/0.5 6:F#5/1.5 7.5:D5/0.5
        8:F#5/1.5 9.5:B4/0.5 10:D5/0.5 10.5:B4/0.5 11:G4/0.5 11.5:D5/0.5 12:B4/2.5 14.5:E5/0.5 15:D5/0.5
        15.5:C#5/0.5 16:F#5/2 18:B4/0.5 18.5:C#5/0.5 19:D5/0.5 19.5:E5/0.5 20:F#5/1.5 21.5:D5/0.5
        22:F#5/1.5 23.5:D5/0.5 24:F#5/1.5 25.5:B4/0.5 26:D5/0.5 26.5:B4/0.5 27:G4/0.5 27.5:D5/0.5
        28:B4/3 31:B4/1`, 12),
    },
    { inst: 'pad', vol: 0.06, notes: sw.pad },
    { inst: 'harp', vol: 0.12, notes: sw.harp },
  ],
  scale: pent('B5', 'D6', 'E6', 'F#6', 'A6'),
}

// --- 終幕：くるみ割り人形「金平糖の精の踊り」 ホ短調 2/4 ---
// 前奏 8 拍（低音の E と裏拍の和音）のあと、旋律の 32 拍を繰り返す
const spIntro = oompah(['E2|G3 B3 E4', 'E2|A3 C4 F#4', 'E2|A#3 C#4 G4', 'E2|A3 C4 D#4',
  'E2|G3 B3 E4', 'E2|A3 C4 F#4', 'E2|A#3 C#4 G4', 'E2|A3 C4 D#4'])
const spLoop = oompah([
  'E2|G3 B3', 'E2|A3 C4', 'E2|A#3 C#4', 'E2|B3 D4', 'E2|C#4 E4', 'E2|D#4 F#4', 'E2|E4 G4', 'E2|E4 G4',
  'A#2|E3 G3 C4', 'A2|D#3 F#3 C4', 'G2|E3 G3 B3', 'F#2|F#3 A#3', 'F#2|G#3 B3', 'F#2|A#3 C#4', 'B2|F#3 B3', 'F#2|A#3 C#4',
  'E2|G3 B3', 'E2|A3 C4', 'E2|A#3 C#4', 'E2|B3 D4', 'E2|C#4 E4', 'E2|D#4 F#4', 'E2|E4 G4', 'E2|E4 G4',
  'C#3|F#3 C#4', 'C#3|F#3 A#3', 'B2|E3 B3', 'B2|E3 G3', 'A2|D3 A3', 'A2|D3 F#3', 'G2|F#3 A3', 'E2|G3 B3',
])
export const SUGAR_PLUM: Song = {
  bpm: 66,
  intro: 8,
  loop: 32,
  parts: [
    {
      inst: 'bell', vol: 0.36, notes: notes(`
        0.5:G5/0.125 0.75:E5/0.125 1:G5/0.25 1.5:F#5/0.25 2:D#5/0.25 2.5:E5/0.25 3:D5/0.125 3.25:D5/0.125
        3.5:D5/0.25 4:C#5/0.125 4.25:C#5/0.125 4.5:C#5/0.25 5:C5/0.125 5.25:C5/0.125 5.5:C5/0.25 6:B4/0.125
        6.25:E5/0.125 6.5:C5/0.125 6.75:E5/0.125 7:B4/0.25 8.5:G4/0.125 8.75:E4/0.125 9:G4/0.25 9.5:F#4/0.25
        10:C5/0.25 10.5:B4/0.25 11:G5/0.125 11.25:G5/0.125 11.5:G5/0.25 12:F#5/0.125 12.25:F#5/0.125
        12.5:F#5/0.25 13:E5/0.125 13.25:E5/0.125 13.5:E5/0.25 14:D#5/0.125 14.25:F#5/0.125 14.5:E5/0.125
        14.75:F#5/0.125 15:D#5/0.25 16.5:G5/0.125 16.75:E5/0.125 17:G5/0.25 17.5:F#5/0.25 18:D#5/0.25
        18.5:E5/0.25 19:D5/0.125 19.25:D5/0.125 19.5:D5/0.25 20:C#5/0.125 20.25:C#5/0.125 20.5:C#5/0.25
        21:C5/0.125 21.25:C5/0.125 21.5:C5/0.25 22:B4/0.125 22.25:E5/0.125 22.5:C5/0.125 22.75:E5/0.125
        23:B4/0.25 24.5:E5/0.125 24.75:C#5/0.125 25:E5/0.25 25.5:D#5/0.25 26.5:D5/0.125 26.75:B4/0.125
        27:D5/0.25 27.5:C#5/0.25 28.5:C5/0.125 28.75:A4/0.125 29:C5/0.25 29.5:B4/0.25 30.5:B4/0.125
        30.625:D#5/0.125 30.75:F#5/0.125 30.875:B5/0.125 31:E5/0.5`, 12, 8),
    },
    { inst: 'pluck', vol: 0.32, notes: [...spIntro.bass, ...spLoop.bass.map(([b, d, m]): Note => [b + 8, d, m])] },
    { inst: 'pluck', vol: 0.12, notes: [...spIntro.chords, ...spLoop.chords.map(([b, d, m]): Note => [b + 8, d, m])] },
  ],
  scale: pent('E6', 'G6', 'A6', 'B6', 'D7'),
}

/** 幕の番号ごとの曲 */
export const ACT_SONGS = [OVERTURE, FLOWERS, GARLAND, SWAN, SUGAR_PLUM]
