import { useCallback, useEffect, useRef, useState, type HTMLAttributes } from 'react'

export type PressPoint = { x: number; y: number }

const interactive = 'a, button, input, textarea, select, [contenteditable], [role="menu"], dialog'
const LONG_PRESS_MS = 460
const PULSE_MS = 180

/** 长按打开操作菜单。手指开始滑动时取消计时，释放时不触发原来的点击。 */
export const useLongPress = (enabled: boolean) => {
  const [point, setPoint] = useState<PressPoint | null>(null)
  const [pulsing, setPulsing] = useState(false)
  const press = useRef<{ id: number; point: PressPoint; timer: number; pulseTimer: number } | null>(
    null
  )
  const suppressClick = useRef(false)
  const clearTimer = useCallback(() => {
    window.clearTimeout(press.current?.timer)
    window.clearTimeout(press.current?.pulseTimer)
    press.current = null
  }, [])
  const cancel = () => {
    clearTimer()
    setPulsing(false)
  }
  useEffect(() => {
    if (!enabled) {
      setPulsing(false)
      setPoint(null)
    }
    return clearTimer
  }, [clearTimer, enabled])

  const handlers: HTMLAttributes<HTMLElement> = enabled
    ? {
        onPointerDown: (event) => {
          suppressClick.current = false
          cancel()
          if (
            event.pointerType !== 'touch' ||
            !event.isPrimary ||
            (event.target as Element).closest(interactive)
          ) {
            return
          }
          const { pointerId, clientX, clientY, currentTarget } = event
          const origin = { x: clientX, y: clientY }
          const pulseTimer = window.setTimeout(() => setPulsing(true), LONG_PRESS_MS - PULSE_MS)
          const timer = window.setTimeout(() => {
            setPulsing(false)
            if (!currentTarget.isConnected) {
              return
            }
            suppressClick.current = true
            currentTarget.setPointerCapture(pointerId)
            window.getSelection()?.removeAllRanges()
            setPoint(origin)
          }, LONG_PRESS_MS)
          press.current = { id: pointerId, point: origin, timer, pulseTimer }
        },
        onPointerMove: (event) => {
          const current = press.current
          if (
            current?.id === event.pointerId &&
            Math.hypot(event.clientX - current.point.x, event.clientY - current.point.y) > 10
          ) {
            cancel()
          }
        },
        onPointerUp: cancel,
        onPointerCancel: cancel,
        onClickCapture: (event) => {
          if (suppressClick.current) {
            suppressClick.current = false
            event.preventDefault()
            event.stopPropagation()
          }
        },
        onContextMenu: (event) => {
          if (press.current || suppressClick.current) {
            event.preventDefault()
          }
        },
      }
    : {}

  return {
    handlers,
    point: enabled ? point : null,
    pulsing: enabled && pulsing,
    dismiss: () => setPoint(null),
  }
}
