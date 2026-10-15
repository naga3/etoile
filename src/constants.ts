/** 画面と動きの決まりごと。座標はすべて 960×540 のゲーム座標 */
export const VIEW_W = 960
export const VIEW_H = 540
export const STAGE_BACK_Y = 400 // 舞台の奥の端。ここより上が書き割り
export const FLOOR_Y = 452 // 踊り手の足が乗る線
export const DANCER_X = 260 // 踊り手が映る x
export const BODY_C = 52 // 足元から体の中心まで。ティアラはここで取る
export const COLLECT_R = 44

export const GRAVITY = 1700
export const CHARGE_TIME = 0.9 // ためきるまでの秒数
export const JUMP_H_MIN = 46 // 足の上がる高さ（ためなし）
export const JUMP_H_MAX = 270 // 足の上がる高さ（ためきり）
export const LAND_TIME = 0.14 // 着地で膝を曲げている秒数
export const STRIDE = (Math.PI * 2) / 84 // 1px 進むごとの歩きの位相

/** ため p（0〜1）で跳んだときの足の最高点。ために比例させて狙いやすくする */
export function jumpHeight(p: number): number {
  return JUMP_H_MIN + (JUMP_H_MAX - JUMP_H_MIN) * p
}

export function flightTime(p: number): number {
  return (2 * Math.sqrt(2 * GRAVITY * jumpHeight(p))) / GRAVITY
}

/** 跳んでから t 秒後の足の高さ */
export function liftAt(p: number, t: number): number {
  const v = Math.sqrt(2 * GRAVITY * jumpHeight(p))
  return Math.max(0, v * t - (GRAVITY * t * t) / 2)
}

/** 空中で回る回数。高く跳ぶほど多く回る */
export function turnsFor(p: number): number {
  return 1 + Math.floor(p * 2.5)
}
