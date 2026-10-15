/** 決まった大きさのゲーム画面を、縦横比を保ったままウィンドウいっぱいに映す */
export interface Stage {
  ctx: CanvasRenderingContext2D
  /** 余白の帯も含めて塗り、以降の描画をゲーム座標にする */
  begin(band: string): void
  /** ゲーム座標をやめて、ウィンドウの CSS ピクセルで描く */
  screen(): void
  /** ゲーム座標 1 あたりの実ピクセル数 */
  ratio(): number
  window(): { w: number; h: number }
  /** ウィンドウの座標をゲーム座標にする */
  toView(clientX: number, clientY: number): { x: number; y: number }
}

export function setupStage(canvas: HTMLCanvasElement, w: number, h: number): Stage {
  const ctx = canvas.getContext('2d')!
  let dpr = 1
  let scale = 1
  let ox = 0
  let oy = 0
  let winW = 0
  let winH = 0

  const resize = () => {
    dpr = window.devicePixelRatio || 1
    winW = window.innerWidth
    winH = window.innerHeight
    canvas.width = Math.round(winW * dpr)
    canvas.height = Math.round(winH * dpr)
    canvas.style.width = `${winW}px`
    canvas.style.height = `${winH}px`
    scale = Math.min(winW / w, winH / h)
    ox = (winW - w * scale) / 2
    oy = (winH - h * scale) / 2
  }

  resize()
  window.addEventListener('resize', resize)

  return {
    ctx,
    begin(band) {
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.fillStyle = band
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      const k = dpr * scale
      ctx.setTransform(k, 0, 0, k, dpr * ox, dpr * oy)
      ctx.save()
      ctx.beginPath()
      ctx.rect(0, 0, w, h)
      ctx.clip()
    },
    screen() {
      ctx.restore()
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    },
    ratio: () => dpr * scale,
    window: () => ({ w: winW, h: winH }),
    toView: (cx, cy) => ({ x: (cx - ox) / scale, y: (cy - oy) / scale }),
  }
}
