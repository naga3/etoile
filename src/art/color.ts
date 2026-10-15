export type RGB = [number, number, number]

export function hex(h: string): RGB {
  const n = parseInt(h.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

export function css(c: RGB, alpha = 1): string {
  return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${alpha})`
}

export const lighten = (c: RGB, t: number) => mix(c, [255, 255, 255], t)
export const darken = (c: RGB, t: number) => mix(c, [0, 0, 0], t)
