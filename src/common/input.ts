/** マウスクリック・タッチを統合して座標を返す */
export interface PointerEvent {
  x: number
  y: number
}

type PointerCallback = (e: PointerEvent) => void

export function setupPointer(canvas: HTMLCanvasElement, onTap: PointerCallback): void {
  // マウスクリック
  canvas.addEventListener('click', (e) => {
    onTap({ x: e.offsetX, y: e.offsetY })
  })

  // タッチ
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault()
    const touch = e.touches[0]
    const rect = canvas.getBoundingClientRect()
    onTap({
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
    })
  }, { passive: false })
}

const HOLD_KEYS = ['Space', 'Enter', 'ArrowUp']

/**
 * 「押している間だけ」の入力を統合する（押す/離す）。
 * マウス・タッチ・キー（スペース、Enter、↑）をまとめ、カーソルが外れた場合も離した扱いにする。
 */
export function setupHold(
  canvas: HTMLCanvasElement,
  onDown: () => void,
  onUp: () => void,
  /** 押した位置がボタンなどで、長押しとして扱わないときに true を返す */
  intercept: (clientX: number, clientY: number) => boolean = () => false,
): void {
  canvas.addEventListener('mousedown', (e) => {
    e.preventDefault()
    if (!intercept(e.clientX, e.clientY)) onDown()
  })
  window.addEventListener('mouseup', () => onUp())
  canvas.addEventListener('mouseleave', () => onUp())
  canvas.addEventListener('contextmenu', (e) => e.preventDefault())
  window.addEventListener('keydown', (e) => {
    if (!HOLD_KEYS.includes(e.code)) return
    e.preventDefault()
    if (!e.repeat) onDown()
  })
  window.addEventListener('keyup', (e) => {
    if (HOLD_KEYS.includes(e.code)) onUp()
  })
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault()
    const t = e.changedTouches[0]
    if (!intercept(t.clientX, t.clientY)) onDown()
  }, { passive: false })
  canvas.addEventListener('touchend', (e) => { e.preventDefault(); onUp() }, { passive: false })
  canvas.addEventListener('touchcancel', () => onUp())
}
