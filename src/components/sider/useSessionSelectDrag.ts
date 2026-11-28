import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
  type SetStateAction,
} from 'react'

/** 触屏需要先横向滑动才进入拖选，竖向滑动仍交给列表滚动。 */
const TOUCH_SLOP = 10
const MOUSE_SLOP = 4
/** 手指靠近列表上下边缘时自动滚动，越靠近越快 */
const EDGE = 56
const MAX_SPEED = 14

type Drag = {
  id: number
  touch: boolean
  x: number
  y: number
  active: boolean
  anchor: number
  /** 拖动前的选择，退出范围的会话恢复原状 */
  base: ReadonlySet<string>
  /** 起点会话原来未选中时整段选中，否则整段取消 */
  select: boolean
  lastX: number
  lastY: number
  frame: number
}

const sessionAt = (x: number, y: number) =>
  document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-session-id]')?.dataset.sessionId

const sameSet = (a: ReadonlySet<string>, b: ReadonlySet<string>) =>
  a.size === b.size && [...a].every((id) => b.has(id))

/**
 * 多选模式下按住会话拖过其他会话，批量选中或取消，规则与系统相册一致：
 * 起点决定这一段是选中还是取消，范围随手指伸缩，退回时恢复原来的状态。
 */
export const useSessionSelectDrag = ({
  listRef,
  ids,
  selection,
  disabled,
  setSelection,
}: {
  listRef: RefObject<HTMLElement>
  /** 当前渲染的会话，按列表顺序 */
  ids: readonly string[]
  selection: ReadonlySet<string> | null
  disabled: boolean
  setSelection: Dispatch<SetStateAction<Set<string> | null>>
}) => {
  const drag = useRef<Drag | null>(null)
  const suppressClick = useRef(false)
  const latest = useRef({ ids, selection })
  latest.current = { ids, selection }
  const enabled = selection !== null && !disabled

  const stop = useCallback(() => {
    if (drag.current) {
      cancelAnimationFrame(drag.current.frame)
      drag.current = null
    }
    delete listRef.current?.dataset.selectDragging
  }, [listRef])
  useEffect(() => {
    if (!enabled) {
      stop()
    }
    return stop
  }, [enabled, stop])

  const paint = (x: number, y: number) => {
    const current = drag.current
    const id = sessionAt(x, y)
    const index = id ? latest.current.ids.indexOf(id) : -1
    if (!current || index < 0) {
      return
    }
    const [from, to] = current.anchor < index ? [current.anchor, index] : [index, current.anchor]
    const next = new Set(current.base)
    for (const sessionId of latest.current.ids.slice(from, to + 1)) {
      if (current.select) {
        next.add(sessionId)
      } else {
        next.delete(sessionId)
      }
    }
    setSelection((previous) => (previous && sameSet(previous, next) ? previous : next))
  }

  const autoScroll = () => {
    const current = drag.current
    const list = listRef.current
    if (!current?.active || !list) {
      return
    }
    const { top, bottom } = list.getBoundingClientRect()
    const speed =
      current.lastY < top + EDGE
        ? -MAX_SPEED * Math.min(1, (top + EDGE - current.lastY) / EDGE)
        : current.lastY > bottom - EDGE
          ? MAX_SPEED * Math.min(1, (current.lastY - bottom + EDGE) / EDGE)
          : 0
    if (speed !== 0) {
      const before = list.scrollTop
      list.scrollTop += speed
      if (list.scrollTop !== before) {
        paint(current.lastX, current.lastY)
      }
    }
    current.frame = requestAnimationFrame(autoScroll)
  }

  if (!enabled) {
    return {}
  }

  return {
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      suppressClick.current = false
      stop()
      if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) {
        return
      }
      const id = (event.target as Element).closest<HTMLElement>('[data-session-id]')?.dataset
        .sessionId
      const anchor = id ? latest.current.ids.indexOf(id) : -1
      if (!id || anchor < 0) {
        return
      }
      const base = latest.current.selection ?? new Set<string>()
      drag.current = {
        id: event.pointerId,
        touch: event.pointerType !== 'mouse',
        x: event.clientX,
        y: event.clientY,
        active: false,
        anchor,
        base,
        select: !base.has(id),
        lastX: event.clientX,
        lastY: event.clientY,
        frame: 0,
      }
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      const current = drag.current
      if (current?.id !== event.pointerId) {
        return
      }
      current.lastX = event.clientX
      current.lastY = event.clientY
      if (!current.active) {
        const dx = Math.abs(event.clientX - current.x)
        const dy = Math.abs(event.clientY - current.y)
        if (current.touch) {
          if (dy > TOUCH_SLOP && dy >= dx) {
            stop()
            return
          }
          if (dx < TOUCH_SLOP || dx < 1.2 * dy) {
            return
          }
        } else if (Math.max(dx, dy) < MOUSE_SLOP) {
          return
        }
        current.active = true
        event.currentTarget.setPointerCapture(event.pointerId)
        event.currentTarget.dataset.selectDragging = ''
        current.frame = requestAnimationFrame(autoScroll)
      }
      paint(event.clientX, event.clientY)
    },
    onPointerUp: (event: PointerEvent<HTMLElement>) => {
      if (drag.current?.id === event.pointerId) {
        suppressClick.current = drag.current.active
        stop()
      }
    },
    onPointerCancel: stop,
    // 拖动松手后浏览器仍会派发 click，拦下来避免把起点会话又切换一次。
    onClickCapture: (event: MouseEvent<HTMLElement>) => {
      if (suppressClick.current) {
        suppressClick.current = false
        event.preventDefault()
        event.stopPropagation()
      }
    },
  }
}
