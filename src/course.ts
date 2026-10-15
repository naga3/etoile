import { BODY_C, FLOOR_Y, flightTime, liftAt } from './constants'

export interface Tiara { x: number; y: number; group: number; collected: boolean }
export interface Group { kind: 'row' | 'arc'; total: number; got: number }
export interface Act {
  x: number
  speed: number
  num: string
  name: string
  /** ためている間の補助。path は軌道を全部、height は高さだけ見せる */
  guide: 'path' | 'height'
}
export interface Course { tiaras: Tiara[]; groups: Group[]; marks: number[]; acts: Act[]; goalX: number }

type Hop = [power: number, count: number]

/**
 * 決まった並びのステージを組む。
 * 弧のティアラは「その位置から、その力で跳んだときの通り道」に置くので、
 * 踏み切りと力が合えば一回の跳躍でまとめて取れる。
 */
export function buildCourse(): Course {
  const tiaras: Tiara[] = []
  const groups: Group[] = []
  const marks: number[] = []
  const acts: Act[] = []
  let x = 0
  let speed = 0
  let marked = false

  const act = (a: Omit<Act, 'x'>, mark: boolean) => {
    acts.push({ x, ...a })
    speed = a.speed
    marked = mark
    x += 320
  }

  const newGroup = (kind: Group['kind'], total: number) => {
    groups.push({ kind, total, got: 0 })
    return groups.length - 1
  }

  /** 床に並べる。歩くだけで取れる */
  const row = (n: number, gap = 64) => {
    const g = newGroup('row', n)
    for (let i = 0; i < n; i++) {
      tiaras.push({ x: x + i * gap, y: FLOOR_Y - BODY_C, group: g, collected: false })
    }
    x += (n - 1) * gap + 220
  }

  /** いまの x から力 p で跳んだ通り道に n 個並べ、着地点を返す */
  const hop = (p: number, n: number) => {
    const g = newGroup('arc', n)
    const T = flightTime(p)
    for (let i = 0; i < n; i++) {
      // 両端は床に近すぎて歩きで取れてしまうので、少し内側から置く
      const t = T * (n === 1 ? 0.5 : 0.18 + (0.64 * i) / (n - 1))
      tiaras.push({ x: x + speed * t, y: FLOOR_Y - BODY_C - liftAt(p, t), group: g, collected: false })
    }
    if (marked) marks.push(x)
    return x + speed * T
  }

  /** 跳躍を並べる。2 つ以上なら着地してすぐ次を跳ぶ連続ジャンプになる */
  const jumps = (...hops: Hop[]) => {
    for (const [p, n] of hops) x = hop(p, n)
    x += 240
  }

  // 序曲：低い跳躍で操作を覚える。床に踏み切りの印（バミリ）がある
  act({ num: '序曲', name: '幕が上がる', speed: 240, guide: 'path' }, true)
  row(4)
  jumps([0.15, 3])
  row(3)
  jumps([0.4, 4])
  jumps([0.25, 3])

  // 第一幕：高さを使い分ける。連続ジャンプが初めて出る
  act({ num: '第一幕', name: '朝の庭', speed: 260, guide: 'path' }, true)
  jumps([0.55, 5])
  row(3)
  jumps([0.8, 6])
  jumps([0.3, 3], [0.3, 3])
  jumps([0.6, 5])
  row(4)

  // 第二幕：印と軌道の補助が外れ、高さの目安だけになる
  act({ num: '第二幕', name: '夕映えの回廊', speed: 280, guide: 'height' }, false)
  jumps([0.7, 5])
  jumps([0.35, 4])
  jumps([0.5, 4], [0.9, 6])
  row(3)
  jumps([1, 7])
  jumps([0.2, 3], [0.2, 3], [0.2, 3])

  // 第三幕：高さの違う連続ジャンプ。最後は階段のように上がっていく
  act({ num: '第三幕', name: '月の湖', speed: 300, guide: 'height' }, false)
  jumps([0.6, 5], [0.3, 4], [0.9, 6])
  row(3)
  jumps([0.3, 4], [0.5, 4], [0.7, 5], [0.9, 6])
  jumps([0.45, 5])

  // 終幕：いちばん高い跳躍を二回続け、カーテンコールの花道へ
  act({ num: '終幕', name: '星のエトワール', speed: 320, guide: 'height' }, false)
  jumps([1, 7], [1, 7])
  jumps([0.6, 5])
  row(6, 56)

  return { tiaras, groups, marks, acts, goalX: x }
}
